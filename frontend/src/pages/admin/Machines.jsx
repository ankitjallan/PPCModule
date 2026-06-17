import React, { useState, useEffect } from 'react';
import { masterService } from '../../services/masterService';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import PageHeader from '../../components/ui/PageHeader';
import Badge from '../../components/ui/Badge';

const EMPTY_FORM = { name: '', machine_code: '', process_category_id: '', speed_mpm: '', width_mm: '', is_active: true };

const Machines = () => {
  const [machines, setMachines] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = async () => {
    setLoading(true);
    try {
      const [m, c] = await Promise.all([masterService.getMachines({ is_active: 'all' }), masterService.getProcessCategories()]);
      setMachines(m.data);
      setCategories(c.data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModal(true);
  };

  const openEdit = (m) => {
    setEditingId(m.id);
    setForm({ name: m.name, machine_code: m.machine_code, process_category_id: m.process_category_id || '', speed_mpm: m.speed_mpm, width_mm: m.width_mm, is_active: m.is_active });
    setFormError('');
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name || !form.machine_code) { setFormError('Name and machine code are required'); return; }
    setSaving(true);
    try {
      if (editingId) await masterService.updateMachine(editingId, form);
      else await masterService.createMachine(form);
      showToast(`Machine ${editingId ? 'updated' : 'created'}`);
      setModal(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save machine');
    } finally { setSaving(false); }
  };

  const categoryOpts = categories.map(c => ({ value: c.id, label: c.name }));

  const columns = [
    { key: 'machine_code', header: 'Code', render: (v) => <span className="font-mono font-bold text-blue-800">{v}</span> },
    { key: 'name', header: 'Name', render: (v) => <span className="font-medium">{v}</span> },
    { key: 'process_category_name', header: 'Category', render: (v) => v ? <Badge>{v}</Badge> : '-' },
    { key: 'speed_mpm', header: 'Speed (m/min)', render: (v) => `${Number(v || 0).toFixed(0)} m/min` },
    { key: 'width_mm', header: 'Width (mm)', render: (v) => `${v || 0} mm` },
    { key: 'is_active', header: 'Status', render: (v) => v ? <Badge variant="green">Active</Badge> : <Badge variant="red">Inactive</Badge> },
    {
      key: 'actions', header: '',
      render: (_, row) => <Button size="xs" variant="secondary" onClick={() => openEdit(row)}>Edit</Button>
    },
  ];

  return (
    <div className="space-y-4">
      {toast && <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      <PageHeader
        title="Machines"
        subtitle="Manage production machines and their configurations"
        actions={<Button onClick={openCreate}>+ Add Machine</Button>}
      />

      <Table columns={columns} data={machines} loading={loading} compact />

      <Modal
        isOpen={modal}
        onClose={() => setModal(false)}
        title={editingId ? 'Edit Machine' : 'Add Machine'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit" form="machine-form" loading={saving}>{editingId ? 'Update' : 'Create'}</Button>
          </>
        }
      >
        {formError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>}
        <form id="machine-form" onSubmit={handleSubmit} className="space-y-4">
          <Input label="Machine Name" required value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
          <Input
            label="Machine Code"
            required
            value={form.machine_code}
            onChange={(e) => setForm(f => ({ ...f, machine_code: e.target.value.toUpperCase() }))}
            hint="Unique identifier e.g. PR-01"
            disabled={!!editingId}
          />
          <Select
            label="Process Category"
            value={form.process_category_id}
            onChange={(e) => setForm(f => ({ ...f, process_category_id: e.target.value }))}
            options={categoryOpts}
            placeholder="Select category..."
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Speed (m/min)" type="number" step="0.1" value={form.speed_mpm} onChange={(e) => setForm(f => ({ ...f, speed_mpm: e.target.value }))} />
            <Input label="Width (mm)" type="number" value={form.width_mm} onChange={(e) => setForm(f => ({ ...f, width_mm: e.target.value }))} />
          </div>
          {editingId && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="m_active" checked={form.is_active} onChange={(e) => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4" />
              <label htmlFor="m_active" className="text-sm font-medium text-gray-700">Active</label>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
};

export default Machines;

import React, { useState, useEffect } from 'react';
import { masterService } from '../../services/masterService';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import PageHeader from '../../components/ui/PageHeader';

const EMPTY_FORM = { name: '', sequence_order: '' };

const ProcessCategories = () => {
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
      const res = await masterService.getProcessCategories();
      setCategories(res.data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModal(true);
  };

  const openEdit = (c) => {
    setEditingId(c.id);
    setForm({ name: c.name, sequence_order: c.sequence_order });
    setFormError('');
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name) { setFormError('Name is required'); return; }
    setSaving(true);
    try {
      if (editingId) await masterService.updateProcessCategory(editingId, form);
      else await masterService.createProcessCategory(form);
      showToast(`Process category ${editingId ? 'updated' : 'created'}`);
      setModal(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save category');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await masterService.deleteProcessCategory(id);
      showToast('Category deleted');
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Cannot delete - may be in use');
    }
  };

  const columns = [
    { key: 'id', header: '#', render: (v) => <span className="text-gray-400">{v}</span> },
    { key: 'sequence_order', header: 'Order', render: (v) => <span className="font-semibold">{v}</span> },
    { key: 'name', header: 'Category Name', render: (v) => <span className="font-semibold text-gray-900">{v}</span> },
    { key: 'created_at', header: 'Created', render: (v) => new Date(v).toLocaleDateString('en-IN') },
    {
      key: 'actions', header: '',
      render: (_, row) => (
        <div className="flex gap-1">
          <Button size="xs" variant="secondary" onClick={() => openEdit(row)}>Edit</Button>
          <Button size="xs" variant="danger" onClick={() => handleDelete(row.id, row.name)}>Delete</Button>
        </div>
      )
    },
  ];

  return (
    <div className="space-y-4">
      {toast && <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      <PageHeader
        title="Process Categories"
        subtitle="Define production process categories (Printing, Lamination, etc.)"
        actions={<Button onClick={openCreate}>+ Add Category</Button>}
      />

      <Table columns={columns} data={categories} loading={loading} compact />

      <Modal
        isOpen={modal}
        onClose={() => setModal(false)}
        title={editingId ? 'Edit Process Category' : 'Add Process Category'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit" form="pc-form" loading={saving}>{editingId ? 'Update' : 'Create'}</Button>
          </>
        }
      >
        {formError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>}
        <form id="pc-form" onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Category Name"
            required
            value={form.name}
            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Printing, Lamination..."
          />
          <Input
            label="Sequence Order"
            type="number"
            value={form.sequence_order}
            onChange={(e) => setForm(f => ({ ...f, sequence_order: e.target.value }))}
            hint="Used for display ordering"
          />
        </form>
      </Modal>
    </div>
  );
};

export default ProcessCategories;

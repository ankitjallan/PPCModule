import React, { useState, useEffect, useCallback } from 'react';
import { masterService } from '../../services/masterService';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import PageHeader from '../../components/ui/PageHeader';
import Badge from '../../components/ui/Badge';

const EMPTY_FORM = { name: '', code: '', contact_person: '', email: '', phone: '', address: '' };

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await masterService.getCustomers({ search, includeInactive: 'true' });
      setCustomers(res.data);
    } catch {} finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModal(true);
  };

  const openEdit = (c) => {
    setEditingId(c.id);
    setForm({ name: c.name, code: c.code, contact_person: c.contact_person || '', email: c.email || '', phone: c.phone || '', address: c.address || '' });
    setFormError('');
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name || !form.code) { setFormError('Name and code are required'); return; }
    setSaving(true);
    try {
      if (editingId) await masterService.updateCustomer(editingId, form);
      else await masterService.createCustomer(form);
      showToast(`Customer ${editingId ? 'updated' : 'created'}`);
      setModal(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save customer');
    } finally { setSaving(false); }
  };

  const handleDeactivate = async (id) => {
    if (!confirm('Deactivate this customer?')) return;
    try {
      await masterService.deleteCustomer(id);
      showToast('Customer deactivated');
      load();
    } catch { showToast('Failed'); }
  };

  const columns = [
    { key: 'code', header: 'Code', render: (v) => <span className="font-mono font-bold text-blue-800">{v}</span> },
    { key: 'name', header: 'Name', render: (v) => <span className="font-medium">{v}</span> },
    { key: 'contact_person', header: 'Contact', render: (v) => v || '-' },
    { key: 'email', header: 'Email', render: (v) => <span className="text-xs">{v || '-'}</span> },
    { key: 'phone', header: 'Phone', render: (v) => v || '-' },
    { key: 'is_active', header: 'Status', render: (v) => v ? <Badge variant="green">Active</Badge> : <Badge variant="red">Inactive</Badge> },
    {
      key: 'actions', header: '',
      render: (_, row) => (
        <div className="flex gap-1">
          <Button size="xs" variant="secondary" onClick={() => openEdit(row)}>Edit</Button>
          {row.is_active && <Button size="xs" variant="danger" onClick={() => handleDeactivate(row.id)}>Deactivate</Button>}
        </div>
      )
    },
  ];

  return (
    <div className="space-y-4">
      {toast && <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      <PageHeader
        title="Customers"
        subtitle="Manage customer master data"
        actions={<Button onClick={openCreate}>+ Add Customer</Button>}
      />

      <div className="bg-white rounded-lg border border-gray-200 p-4 flex gap-4 items-end">
        <div className="w-64">
          <Input label="Search" placeholder="Name or code..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button variant="secondary" onClick={() => setSearch('')}>Clear</Button>
      </div>

      <Table columns={columns} data={customers} loading={loading} compact />

      <Modal
        isOpen={modal}
        onClose={() => setModal(false)}
        title={editingId ? 'Edit Customer' : 'Add Customer'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit" form="cust-form" loading={saving}>{editingId ? 'Update' : 'Create'}</Button>
          </>
        }
      >
        {formError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>}
        <form id="cust-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input label="Customer Name" required value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <Input
              label="Customer Code"
              required
              value={form.code}
              onChange={(e) => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              disabled={!!editingId}
              hint="Short unique identifier"
            />
            <Input label="Contact Person" value={form.contact_person} onChange={(e) => setForm(f => ({ ...f, contact_person: e.target.value }))} />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
            <Input label="Phone" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-700">Address</label>
              <textarea
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                value={form.address}
                onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))}
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Customers;

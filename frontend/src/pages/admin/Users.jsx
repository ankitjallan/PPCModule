import React, { useState, useEffect, useCallback } from 'react';
import { masterService } from '../../services/masterService';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import PageHeader from '../../components/ui/PageHeader';
import Badge from '../../components/ui/Badge';

const EMPTY_FORM = { name: '', email: '', password: '', role_name: '', is_active: true };

const Users = () => {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roles, setRoles] = useState([]);
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [pwModal, setPwModal] = useState(false);
  const [pwUser, setPwUser] = useState(null);
  const [newPw, setNewPw] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await masterService.getUsers({ page, limit: 20, search });
      setUsers(res.data.data);
      setPagination(res.data.pagination);
    } catch {} finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    masterService.getRoles().then(r => setRoles(r.data)).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModal(true);
  };

  const openEdit = (user) => {
    setEditingId(user.id);
    setForm({ name: user.name, email: user.email, password: '', role_name: user.role_name, is_active: user.is_active });
    setFormError('');
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name || !form.email || !form.role_name) {
      setFormError('Name, email and role are required');
      return;
    }
    if (!editingId && !form.password) {
      setFormError('Password is required for new users');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const update = { name: form.name, email: form.email, role_name: form.role_name, is_active: form.is_active };
        await masterService.updateUser(editingId, update);
        showToast('User updated');
      } else {
        await masterService.createUser(form);
        showToast('User created');
      }
      setModal(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save user');
    } finally { setSaving(false); }
  };

  const handleDeactivate = async (id) => {
    if (!confirm('Deactivate this user?')) return;
    try {
      await masterService.deleteUser(id);
      showToast('User deactivated');
      load();
    } catch { showToast('Failed to deactivate user'); }
  };

  const handleResetPw = async () => {
    if (!newPw || newPw.length < 8) { alert('Password must be at least 8 characters'); return; }
    try {
      await masterService.resetUserPassword(pwUser.id, newPw);
      showToast('Password reset successfully');
      setPwModal(false);
      setNewPw('');
    } catch { showToast('Failed to reset password'); }
  };

  const roleOpts = roles.map(r => ({ value: r.name, label: r.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }));

  const columns = [
    { key: 'name', header: 'Name', render: (v) => <span className="font-medium">{v}</span> },
    { key: 'email', header: 'Email', render: (v) => <span className="text-xs font-mono">{v}</span> },
    { key: 'role_name', header: 'Role', render: (v) => <Badge status={v}>{v?.replace(/_/g, ' ')}</Badge> },
    { key: 'is_active', header: 'Status', render: (v) => v ? <Badge variant="green">Active</Badge> : <Badge variant="red">Inactive</Badge> },
    { key: 'last_login', header: 'Last Login', render: (v) => v ? new Date(v).toLocaleDateString('en-IN') : 'Never' },
    { key: 'created_at', header: 'Created', render: (v) => new Date(v).toLocaleDateString('en-IN') },
    {
      key: 'actions', header: '',
      render: (_, row) => (
        <div className="flex gap-1">
          <Button size="xs" variant="secondary" onClick={() => openEdit(row)}>Edit</Button>
          <Button size="xs" variant="ghost" onClick={() => { setPwUser(row); setNewPw(''); setPwModal(true); }}>
            Reset PW
          </Button>
          {row.is_active && (
            <Button size="xs" variant="danger" onClick={() => handleDeactivate(row.id)}>Deactivate</Button>
          )}
        </div>
      )
    },
  ];

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>
      )}

      <PageHeader
        title="User Management"
        subtitle="Manage system users and roles"
        actions={<Button onClick={openCreate}>+ Add User</Button>}
      />

      <div className="bg-white rounded-lg border border-gray-200 p-4 flex gap-4 items-end">
        <div className="w-64">
          <Input
            label="Search"
            placeholder="Name or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Button variant="secondary" onClick={() => { setSearch(''); setPage(1); }}>Clear</Button>
      </div>

      <Table columns={columns} data={users} loading={loading} pagination={pagination} onPageChange={setPage} compact />

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modal}
        onClose={() => setModal(false)}
        title={editingId ? 'Edit User' : 'Add New User'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit" form="user-form" loading={saving}>{editingId ? 'Update' : 'Create'}</Button>
          </>
        }
      >
        {formError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>}
        <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            required
            value={form.name}
            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
          />
          {!editingId && (
            <Input
              label="Password"
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
              hint="Minimum 8 characters"
            />
          )}
          <Select
            label="Role"
            required
            value={form.role_name}
            onChange={(e) => setForm(f => ({ ...f, role_name: e.target.value }))}
            options={roleOpts}
            placeholder="Select role..."
          />
          {editingId && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={(e) => setForm(f => ({ ...f, is_active: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Active</label>
            </div>
          )}
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={pwModal}
        onClose={() => setPwModal(false)}
        title={`Reset Password: ${pwUser?.name}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPwModal(false)}>Cancel</Button>
            <Button onClick={handleResetPw}>Reset Password</Button>
          </>
        }
      >
        <Input
          label="New Password"
          type="password"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          hint="Minimum 8 characters"
          autoFocus
        />
      </Modal>
    </div>
  );
};

export default Users;

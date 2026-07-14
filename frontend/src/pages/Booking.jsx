import React, { useState, useEffect } from 'react';
import { orderService } from '../services/orderService';
import { masterService } from '../services/masterService';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';

const STATUS_OPTS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'ON_HOLD', label: 'On Hold' },
];
const PRIORITY_OPTS = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

const EMPTY_FORM = {
  customer_id: '', fg_code_id: '', job_name: '', order_type: 'NEW',
  qty_kg: '', qty_rolls: '', delivery_date: '', priority: 'NORMAL', remarks: '',
};

const Booking = () => {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  const [customers, setCustomers] = useState([]);
  const [fgCodes, setFgCodes] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await orderService.getSalesOrders({ page, limit: 20, status: filterStatus, search });
      setOrders(res.data.data);
      setPagination(res.data.pagination);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const loadMasters = async () => {
    try {
      const [cust, fgs] = await Promise.all([
        masterService.getCustomers(),
        masterService.getFGCodes(),
      ]);
      setCustomers(cust.data);
      setFgCodes(fgs.data);
    } catch {}
  };

  useEffect(() => { loadOrders(); }, [page, filterStatus, search]);
  useEffect(() => { loadMasters(); }, []);

  const handleCustomerChange = async (customerId) => {
    setForm(f => ({ ...f, customer_id: customerId, fg_code_id: '' }));
    if (customerId) {
      try {
        const res = await masterService.getFGCodes({ customer_id: customerId });
        setFgCodes(res.data);
      } catch {}
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.customer_id || !form.fg_code_id || !form.qty_kg || !form.delivery_date) {
      setFormError('Customer, FG Code, Quantity and Delivery Date are required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        qty_kg: form.qty_kg === '' ? null : Number(form.qty_kg),
        qty_rolls: form.qty_rolls === '' ? null : Number(form.qty_rolls),
      };
      await orderService.createSalesOrder(payload);
      showToast('Sales order created successfully');
      setModal(false);
      setForm(EMPTY_FORM);
      loadOrders();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create order');
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePO = async (soId) => {
    try {
      await orderService.createFromSO(soId);
      showToast('Production order created successfully');
      loadOrders();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create production order');
    }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '-';

  const columns = [
    { key: 'so_number', header: 'SO Number', render: (v) => <span className="font-mono text-xs font-semibold text-blue-800">{v}</span> },
    { key: 'so_date', header: 'SO Date', render: fmtDate },
    { key: 'customer_name', header: 'Customer', render: (v) => <span className="text-xs font-medium">{v}</span> },
    { key: 'fg_code', header: 'FG Code', render: (v) => <span className="font-mono text-xs">{v}</span> },
    { key: 'job_name', header: 'Job Name', render: (v) => v || '-' },
    { key: 'order_type', header: 'Type', render: (v) => <Badge status={v}>{v}</Badge> },
    { key: 'qty_kg', header: 'Qty (KG)', render: (v) => <span className="font-semibold">{Number(v).toLocaleString()}</span> },
    { key: 'delivery_date', header: 'Delivery', render: (v) => {
      const isOverdue = v && new Date(v) < new Date() ? 'text-red-600 font-semibold' : 'text-gray-700';
      return <span className={isOverdue}>{fmtDate(v)}</span>;
    }},
    { key: 'priority', header: 'Priority', render: (v) => <Badge status={v}>{v}</Badge> },
    { key: 'status', header: 'Status', render: (v) => <Badge status={v}>{v}</Badge> },
    {
      key: 'actions', header: 'Actions',
      render: (_, row) => (
        <div className="flex gap-1">
          {row.status === 'CONFIRMED' && !row.production_order_id && (
            <Button size="xs" variant="success" onClick={() => handleCreatePO(row.id)}>
              Create PO
            </Button>
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
        title="Order Booking"
        subtitle="Create and manage sales orders"
        actions={
          <Button onClick={() => { setModal(true); setForm(EMPTY_FORM); setFormError(''); }}>
            + New Order
          </Button>
        }
      />

      <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap gap-4 items-end">
        <div className="w-64">
          <Input
            label="Search"
            placeholder="SO number or job name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="w-44">
          <Select
            label="Status"
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            options={STATUS_OPTS}
            placeholder="All Statuses"
          />
        </div>
        <Button variant="secondary" onClick={() => { setSearch(''); setFilterStatus(''); setPage(1); }}>
          Clear
        </Button>
      </div>

      <Table
        columns={columns}
        data={orders}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        compact
      />

      {/* Create Order Modal */}
      <Modal
        isOpen={modal}
        onClose={() => setModal(false)}
        title="New Sales Order"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit" form="so-form" loading={saving}>Create Order</Button>
          </>
        }
      >
        {formError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>
        )}
        <form id="so-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Select
                label="Customer"
                required
                value={form.customer_id}
                onChange={(e) => handleCustomerChange(e.target.value)}
                options={customers.map(c => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
                placeholder="Select customer..."
              />
            </div>
            <div className="col-span-2">
              <Select
                label="FG Code"
                required
                value={form.fg_code_id}
                onChange={(e) => setForm(f => ({ ...f, fg_code_id: e.target.value }))}
                options={fgCodes.map(f => ({ value: f.id, label: `${f.fg_code}${f.description ? ' - ' + f.description : ''}` }))}
                placeholder="Select FG code..."
              />
            </div>
            <div className="col-span-2">
              <Input
                label="Job Name"
                value={form.job_name}
                onChange={(e) => setForm(f => ({ ...f, job_name: e.target.value }))}
                placeholder="Enter job name..."
              />
            </div>
            <Select
              label="Order Type"
              value={form.order_type}
              onChange={(e) => setForm(f => ({ ...f, order_type: e.target.value }))}
              options={[{ value: 'NEW', label: 'New' }, { value: 'REPEAT', label: 'Repeat' }]}
            />
            <Select
              label="Priority"
              value={form.priority}
              onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}
              options={PRIORITY_OPTS}
            />
            <Input
              label="Quantity (KG)"
              type="number"
              required
              step="0.001"
              value={form.qty_kg}
              onChange={(e) => setForm(f => ({ ...f, qty_kg: e.target.value }))}
              placeholder="0.000"
            />
            <Input
              label="Quantity (Rolls)"
              type="number"
              value={form.qty_rolls}
              onChange={(e) => setForm(f => ({ ...f, qty_rolls: e.target.value }))}
              placeholder="Optional"
            />
            <div className="col-span-2">
              <Input
                label="Delivery Date"
                type="date"
                required
                value={form.delivery_date}
                onChange={(e) => setForm(f => ({ ...f, delivery_date: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-700">Remarks</label>
              <textarea
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                value={form.remarks}
                onChange={(e) => setForm(f => ({ ...f, remarks: e.target.value }))}
                placeholder="Optional notes..."
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Booking;

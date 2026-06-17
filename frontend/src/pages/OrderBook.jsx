import React, { useState, useEffect, useCallback } from 'react';
import { orderService } from '../services/orderService';
import { masterService } from '../services/masterService';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import PageHeader from '../components/ui/PageHeader';
import DateRangePicker from '../components/ui/DateRangePicker';

const OrderBook = () => {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    status: '', customer_id: '', order_type: '', search: '',
    date_from: '', date_to: '',
  });
  const [customers, setCustomers] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orderService.getSalesOrders({ page, limit: 20, ...filters });
      setOrders(res.data.data);
      setPagination(res.data.pagination);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    masterService.getCustomers().then(r => setCustomers(r.data)).catch(() => {});
  }, []);

  const setFilter = (key, val) => {
    setFilters(f => ({ ...f, [key]: val }));
    setPage(1);
  };

  const fmtDate = (d) => d ? new Date(d + 'T00:00').toLocaleDateString('en-IN') : '-';

  const isOverdue = (date, status) =>
    date && new Date(date) < new Date() && !['COMPLETED', 'CANCELLED'].includes(status);

  const columns = [
    { key: 'so_number', header: 'SO #', render: (v) => <span className="font-mono text-xs font-bold text-blue-800">{v}</span> },
    { key: 'so_date', header: 'SO Date', render: fmtDate },
    { key: 'customer_name', header: 'Customer' },
    { key: 'fg_code', header: 'FG Code', render: (v) => <span className="font-mono text-xs">{v}</span> },
    { key: 'job_name', header: 'Job Name', render: (v) => <span className="text-xs">{v || '-'}</span> },
    { key: 'order_type', header: 'Type', render: (v) => <Badge status={v}>{v}</Badge> },
    { key: 'qty_kg', header: 'Qty KG', render: (v) => Number(v).toLocaleString() },
    {
      key: 'delivery_date', header: 'Delivery',
      render: (v, row) => (
        <span className={isOverdue(v, row.status) ? 'text-red-600 font-bold' : ''}>
          {fmtDate(v)}
          {isOverdue(v, row.status) && ' ⚠'}
        </span>
      )
    },
    { key: 'priority', header: 'Priority', render: (v) => <Badge status={v}>{v}</Badge> },
    { key: 'status', header: 'Status', render: (v) => <Badge status={v}>{v}</Badge> },
    {
      key: 'production_status', header: 'Prod. Status',
      render: (v) => v ? <Badge status={v}>{v}</Badge> : <span className="text-gray-400 text-xs">No PO</span>
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Order Book"
        subtitle="View all sales orders and their production status"
      />

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-52">
            <Input
              label="Search"
              placeholder="SO number or job name..."
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
            />
          </div>
          <div className="w-44">
            <Select
              label="Customer"
              value={filters.customer_id}
              onChange={(e) => setFilter('customer_id', e.target.value)}
              options={customers.map(c => ({ value: c.id, label: c.name }))}
              placeholder="All Customers"
            />
          </div>
          <div className="w-40">
            <Select
              label="Status"
              value={filters.status}
              onChange={(e) => setFilter('status', e.target.value)}
              options={[
                { value: 'PENDING', label: 'Pending' },
                { value: 'CONFIRMED', label: 'Confirmed' },
                { value: 'IN_PROGRESS', label: 'In Progress' },
                { value: 'COMPLETED', label: 'Completed' },
                { value: 'CANCELLED', label: 'Cancelled' },
              ]}
              placeholder="All Statuses"
            />
          </div>
          <div className="w-36">
            <Select
              label="Order Type"
              value={filters.order_type}
              onChange={(e) => setFilter('order_type', e.target.value)}
              options={[{ value: 'NEW', label: 'New' }, { value: 'REPEAT', label: 'Repeat' }]}
              placeholder="All Types"
            />
          </div>
          <DateRangePicker
            label="Delivery"
            from={filters.date_from}
            to={filters.date_to}
            onFromChange={(v) => setFilter('date_from', v)}
            onToChange={(v) => setFilter('date_to', v)}
          />
          <Button
            variant="secondary"
            onClick={() => {
              setFilters({ status: '', customer_id: '', order_type: '', search: '', date_from: '', date_to: '' });
              setPage(1);
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="text-sm text-gray-500 px-1">
        {pagination.total} orders found
      </div>

      <Table
        columns={columns}
        data={orders}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        compact
      />
    </div>
  );
};

export default OrderBook;

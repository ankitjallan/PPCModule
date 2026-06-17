import React, { useState, useEffect } from 'react';
import { orderService } from '../services/orderService';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { FullPageSpinner } from '../components/ui/Spinner';

const StageCell = ({ target, ptd, status }) => {
  if (target === null || target === undefined) {
    return <span className="text-gray-300 text-xs">-</span>;
  }
  const pct = target > 0 ? Math.min(Math.round((ptd / target) * 100), 100) : 0;
  const color = pct >= 100 ? 'bg-green-500' : pct > 0 ? 'bg-blue-500' : 'bg-gray-200';
  return (
    <div className="flex flex-col gap-0.5 min-w-[80px]">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">{Number(ptd || 0).toFixed(1)}/{Number(target).toFixed(1)}</span>
        <span className={`font-semibold ${pct >= 100 ? 'text-green-600' : 'text-blue-600'}`}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const PendingOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await orderService.getPendingOrders();
      setOrders(res.data);
    } catch {
      setError('Failed to load pending orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const fmtDate = (d) => d ? new Date(d + 'T00:00').toLocaleDateString('en-IN') : '-';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pending Order Tracker"
        subtitle="Real-time production stage tracking for all open orders"
        actions={
          <Button variant="secondary" onClick={load}>Refresh</Button>
        }
      />

      {loading ? <FullPageSpinner /> : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-blue-800 text-white">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">WO #</th>
                  <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">SO #</th>
                  <th className="px-3 py-3 text-left font-semibold">Customer</th>
                  <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">FG Code</th>
                  <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Delivery</th>
                  <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Priority</th>
                  <th className="px-3 py-3 text-center font-semibold">Printing</th>
                  <th className="px-3 py-3 text-center font-semibold">ECL</th>
                  <th className="px-3 py-3 text-center font-semibold">Lam 1</th>
                  <th className="px-3 py-3 text-center font-semibold">Lam 2</th>
                  <th className="px-3 py-3 text-center font-semibold">Slitting</th>
                  <th className="px-3 py-3 text-center font-semibold">Pouching</th>
                  <th className="px-3 py-3 text-left font-semibold">RM Short</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-10 text-center text-gray-400">
                      No pending production orders
                    </td>
                  </tr>
                ) : orders.map((row, idx) => {
                  const isOverdue = row.delivery_date && new Date(row.delivery_date) < new Date();
                  return (
                    <tr key={idx} className={`${idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'} hover:bg-blue-50 transition-colors`}>
                      <td className="px-3 py-2 font-mono font-bold text-blue-800">{row.wo_number}</td>
                      <td className="px-3 py-2 font-mono text-blue-700">{row.so_number}</td>
                      <td className="px-3 py-2 max-w-[140px] truncate">{row.customer_name}</td>
                      <td className="px-3 py-2 font-mono">{row.fg_code}</td>
                      <td className={`px-3 py-2 font-medium whitespace-nowrap ${isOverdue ? 'text-red-600' : 'text-gray-700'}`}>
                        {fmtDate(row.delivery_date)}
                        {isOverdue && ' ⚠'}
                      </td>
                      <td className="px-3 py-2"><Badge status={row.priority}>{row.priority}</Badge></td>
                      <td className="px-3 py-2">
                        <StageCell target={row.print_target} ptd={row.print_ptd} status={row.print_status} />
                      </td>
                      <td className="px-3 py-2">
                        <StageCell target={row.ecl_target} ptd={row.ecl_ptd} status={row.ecl_status} />
                      </td>
                      <td className="px-3 py-2">
                        <StageCell target={row.lam1_target} ptd={row.lam1_ptd} status={row.lam1_status} />
                      </td>
                      <td className="px-3 py-2">
                        <StageCell target={row.lam2_target} ptd={row.lam2_ptd} status={row.lam2_status} />
                      </td>
                      <td className="px-3 py-2">
                        <StageCell target={row.slit_target} ptd={row.slit_ptd} status={row.slit_status} />
                      </td>
                      <td className="px-3 py-2">
                        <StageCell target={row.pouch_target} ptd={row.pouch_ptd} status={row.pouch_status} />
                      </td>
                      <td className="px-3 py-2">
                        {row.short_rm ? (
                          <span className="text-red-600 font-medium">{row.short_rm}</span>
                        ) : (
                          <span className="text-green-600">OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center gap-6 text-xs text-gray-600">
            <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 bg-gray-200 rounded-full" /> Not started</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 bg-blue-500 rounded-full" /> In progress</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 bg-green-500 rounded-full" /> Completed</div>
            <div className="flex items-center gap-1.5"><span className="text-gray-400">-</span> Stage not applicable</div>
            <span className="ml-auto">{orders.length} open orders</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingOrders;

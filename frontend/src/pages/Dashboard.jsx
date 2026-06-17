import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { dashboardService } from '../services/dashboardService';
import StatCard from '../components/ui/StatCard';
import DateRangePicker from '../components/ui/DateRangePicker';
import Badge from '../components/ui/Badge';
import { FullPageSpinner } from '../components/ui/Spinner';

const fmtDate = (d) => new Date(d + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const PIE_COLORS = ['#1e3a8a','#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6'];

// Icons
const OrdersIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);
const OverdueIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const EffIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);
const DelivIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const Dashboard = () => {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await dashboardService.getDashboard({ dateFrom, dateTo });
      setData(res.data);
    } catch (err) {
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [dateFrom, dateTo]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Production overview and key metrics</p>
        </div>
        <DateRangePicker
          from={dateFrom}
          to={dateTo}
          onFromChange={setDateFrom}
          onToChange={setDateTo}
          label=""
        />
      </div>

      {loading ? <FullPageSpinner /> : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
      ) : data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Open Orders"
              value={fmtNum(data.openOrders?.count)}
              subtitle={`${fmtNum(data.openOrders?.totalQty)} KG total`}
              icon={OrdersIcon}
              color="blue"
            />
            <StatCard
              title="Overdue Orders"
              value={fmtNum(data.overdueOrders)}
              subtitle="Past delivery date"
              icon={OverdueIcon}
              color="red"
            />
            <StatCard
              title="Efficiency %"
              value={`${data.efficiencyPct}%`}
              subtitle="Actual vs target output"
              icon={EffIcon}
              color="green"
            />
            <StatCard
              title="On-Time Delivery"
              value={`${data.onTimeDeliveryPct}%`}
              subtitle="Completed on or before due date"
              icon={DelivIcon}
              color="indigo"
            />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Output Trend */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Daily Output Trend (KG)</h3>
              {data.dailyOutputTrend?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={data.dailyOutputTrend}>
                    <defs>
                      <linearGradient id="colorKg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1e3a8a" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#1e3a8a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="entry_date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`${fmtNum(v)} KG`, 'Output']} labelFormatter={fmtDate} />
                    <Area type="monotone" dataKey="total_kg" stroke="#1e3a8a" fill="url(#colorKg)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No data in selected range</div>
              )}
            </div>

            {/* Orders by Status */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Orders by Status</h3>
              {data.ordersByStatus?.length > 0 ? (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart>
                      <Pie data={data.ordersByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80}>
                        {data.ordersByStatus.map((entry, index) => (
                          <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {data.ordersByStatus.map((row, i) => (
                      <div key={row.status} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-gray-600">{row.status}</span>
                        </div>
                        <span className="font-semibold text-gray-900">{row.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">No orders</div>
              )}
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Machine Utilization */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Machine Utilization</h3>
              {data.machineUtilization?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.machineUtilization} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="machine_name" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip formatter={(v) => [`${v}%`, 'Utilization']} />
                    <Bar dataKey="utilization_pct" fill="#1e3a8a" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">No machine plan data</div>
              )}
            </div>

            {/* RM Shortage Alerts */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                RM Shortage Alerts
                {data.rmShortageAlerts?.length > 0 && (
                  <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                    {data.rmShortageAlerts.length}
                  </span>
                )}
              </h3>
              {data.rmShortageAlerts?.length > 0 ? (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {data.rmShortageAlerts.map(rm => (
                    <div key={rm.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2">
                      <div>
                        <p className="font-medium text-gray-800">{rm.item_code}</p>
                        <p className="text-xs text-gray-500 truncate max-w-[200px]">{rm.item_name}</p>
                      </div>
                      <div className="text-right">
                        <Badge status="SHORT">SHORT</Badge>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {rm.days_cover != null ? `${rm.days_cover}d cover` : 'No data'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-green-600 text-sm font-medium">
                  No RM shortages detected
                </div>
              )}
            </div>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Customers */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Top Customers (Open Orders)</h3>
              <div className="space-y-2">
                {data.topCustomers?.slice(0, 6).map((c, i) => (
                  <div key={c.id} className="flex items-center gap-3 text-sm">
                    <span className="w-5 text-gray-400 font-medium">{i + 1}.</span>
                    <span className="flex-1 text-gray-700 truncate">{c.customer_name}</span>
                    <span className="text-gray-500">{c.order_count} orders</span>
                    <span className="font-semibold text-gray-900">{fmtNum(c.total_qty)} KG</span>
                  </div>
                ))}
                {(!data.topCustomers || data.topCustomers.length === 0) && (
                  <p className="text-gray-400 text-sm text-center py-8">No open orders</p>
                )}
              </div>
            </div>

            {/* Stage WIP */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Stage WIP</h3>
              {data.stageWIP?.length > 0 ? (
                <div className="space-y-3">
                  {data.stageWIP.map(s => (
                    <div key={s.stage} className="flex items-center gap-3 text-sm">
                      <Badge status={s.stage}>{s.stage}</Badge>
                      <span className="flex-1 text-gray-600">{s.jobs_in_stage} jobs</span>
                      <span className="font-medium text-gray-800">
                        {Number(s.wip_km || 0).toFixed(1)} KM remaining
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[150px] flex items-center justify-center text-gray-400 text-sm">
                  No active WIP
                </div>
              )}
            </div>
          </div>

          {/* New vs Repeat */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">New vs Repeat Orders</h3>
            <div className="flex gap-8">
              {data.newVsRepeat?.map((row) => (
                <div key={row.order_type} className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full ${row.order_type === 'NEW' ? 'bg-blue-500' : 'bg-purple-500'}`} />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{row.order_type}</p>
                    <p className="text-xs text-gray-500">{row.count} orders • {fmtNum(row.total_qty)} KG</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;

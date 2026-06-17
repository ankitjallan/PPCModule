import React, { useState, useEffect } from 'react';
import { ptdService } from '../services/ptdService';
import { machineService } from '../services/machineService';
import { orderService } from '../services/orderService';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';

const STAGES = ['PRINTING', 'ECL', 'LAM1', 'LAM2', 'SLITTING', 'POUCHING'];

const EMPTY_ENTRY = {
  production_order_id: '',
  stage: '',
  machine_id: '',
  shift_no: '',
  entry_date: new Date().toISOString().split('T')[0],
  actual_output_kg: '',
  actual_output_km: '',
  waste_kg: '',
  operator_name: '',
  remarks: '',
};

const PTDEntry = () => {
  const [entries, setEntries] = useState([EMPTY_ENTRY]);
  const [machines, setMachines] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [toast, setToast] = useState('');
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState('entry');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    Promise.all([
      machineService.getMachines(),
      orderService.getPendingOrders(),
    ]).then(([m, o]) => {
      setMachines(m.data);
      setPendingOrders(o.data);
      setShifts([
        { value: 1, label: 'Shift 1 (Morning 7-15)' },
        { value: 2, label: 'Shift 2 (Afternoon 15-23)' },
        { value: 3, label: 'Shift 3 (Night 23-7)' },
      ]);
    }).catch(() => {});
  }, []);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await ptdService.getEntries({ date: historyDate, limit: 100 });
      setHistoryData(res.data.data);
    } catch {} finally { setHistoryLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
  }, [activeTab, historyDate]);

  const addEntry = () => setEntries(e => [...e, { ...EMPTY_ENTRY }]);
  const removeEntry = (idx) => setEntries(e => e.filter((_, i) => i !== idx));
  const updateEntry = (idx, key, val) => {
    setEntries(e => { const a = [...e]; a[idx] = { ...a[idx], [key]: val }; return a; });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const valid = entries.filter(en => en.production_order_id && en.stage);
    if (valid.length === 0) {
      alert('At least one entry with Production Order and Stage is required.');
      return;
    }
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const res = await ptdService.submitEntries(valid);
      setSubmitResult({ success: true, count: res.data.inserted });
      showToast(`${res.data.inserted} PTD entries saved successfully`);
      setEntries([EMPTY_ENTRY]);
    } catch (err) {
      setSubmitResult({ success: false, error: err.response?.data?.error || 'Failed to submit entries' });
    } finally { setSubmitting(false); }
  };

  const machineOpts = machines.map(m => ({ value: m.id, label: `${m.machine_code} - ${m.name}` }));
  const poOpts = pendingOrders.map(o => ({ value: o.id, label: `${o.wo_number} | ${o.so_number} | ${o.customer_name}` }));

  const historyColumns = [
    { key: 'entry_date', header: 'Date', render: (v) => new Date(v + 'T00:00').toLocaleDateString('en-IN') },
    { key: 'so_number', header: 'SO #', render: (v) => <span className="font-mono text-xs text-blue-700">{v}</span> },
    { key: 'fg_code', header: 'FG Code', render: (v) => <span className="font-mono text-xs">{v}</span> },
    { key: 'customer_name', header: 'Customer' },
    { key: 'stage', header: 'Stage', render: (v) => <Badge status={v}>{v}</Badge> },
    { key: 'machine_name', header: 'Machine' },
    { key: 'shift_no', header: 'Shift', render: (v) => `S${v}` },
    { key: 'actual_output_kg', header: 'Actual KG', render: (v) => <span className="font-semibold">{Number(v || 0).toFixed(2)}</span> },
    { key: 'actual_output_km', header: 'Actual KM', render: (v) => Number(v || 0).toFixed(3) },
    { key: 'waste_kg', header: 'Waste KG', render: (v) => Number(v || 0).toFixed(2) },
    { key: 'operator_name', header: 'Operator' },
    { key: 'entered_by_name', header: 'Entered By' },
  ];

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>
      )}

      <PageHeader
        title="PTD Entry"
        subtitle="Enter daily production data (Production To Date)"
      />

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-6">
        {['entry', 'history'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors capitalize ${
              activeTab === tab ? 'border-blue-800 text-blue-800' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'entry' ? 'Data Entry' : 'Entry History'}
          </button>
        ))}
      </div>

      {activeTab === 'entry' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {submitResult && (
            <div className={`p-4 rounded-lg border text-sm ${submitResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {submitResult.success ? `${submitResult.count} entries saved successfully.` : submitResult.error}
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Production Entries</h3>
              <Button type="button" variant="secondary" size="sm" onClick={addEntry}>+ Add Row</Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium">Date</th>
                    <th className="px-2 py-2 text-left font-medium">Production Order</th>
                    <th className="px-2 py-2 text-left font-medium">Stage</th>
                    <th className="px-2 py-2 text-left font-medium">Machine</th>
                    <th className="px-2 py-2 text-left font-medium">Shift</th>
                    <th className="px-2 py-2 text-left font-medium">Output KG</th>
                    <th className="px-2 py-2 text-left font-medium">Output KM</th>
                    <th className="px-2 py-2 text-left font-medium">Waste KG</th>
                    <th className="px-2 py-2 text-left font-medium">Operator</th>
                    <th className="px-2 py-2 text-left font-medium">Remarks</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entries.map((entry, idx) => (
                    <tr key={idx} className="bg-white hover:bg-blue-50">
                      <td className="px-2 py-1">
                        <input
                          type="date"
                          value={entry.entry_date}
                          onChange={(e) => updateEntry(idx, 'entry_date', e.target.value)}
                          className="w-32 rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <select
                          value={entry.production_order_id}
                          onChange={(e) => updateEntry(idx, 'production_order_id', e.target.value)}
                          className="w-44 rounded border border-gray-300 px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Select PO...</option>
                          {poOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <select
                          value={entry.stage}
                          onChange={(e) => updateEntry(idx, 'stage', e.target.value)}
                          className="w-28 rounded border border-gray-300 px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Stage...</option>
                          {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <select
                          value={entry.machine_id}
                          onChange={(e) => updateEntry(idx, 'machine_id', e.target.value)}
                          className="w-36 rounded border border-gray-300 px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Machine...</option>
                          {machineOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <select
                          value={entry.shift_no}
                          onChange={(e) => updateEntry(idx, 'shift_no', e.target.value)}
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Shift...</option>
                          {[1, 2, 3].map(s => <option key={s} value={s}>S{s}</option>)}
                        </select>
                      </td>
                      {['actual_output_kg', 'actual_output_km', 'waste_kg'].map(field => (
                        <td key={field} className="px-2 py-1">
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            value={entry[field]}
                            onChange={(e) => updateEntry(idx, field, e.target.value)}
                            className="w-20 rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="0.000"
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1">
                        <input
                          value={entry.operator_name}
                          onChange={(e) => updateEntry(idx, 'operator_name', e.target.value)}
                          className="w-28 rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Operator..."
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          value={entry.remarks}
                          onChange={(e) => updateEntry(idx, 'remarks', e.target.value)}
                          className="w-28 rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Remarks..."
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Button
                          type="button"
                          size="xs"
                          variant="danger"
                          onClick={() => removeEntry(idx)}
                          disabled={entries.length === 1}
                        >
                          Del
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setEntries([EMPTY_ENTRY])}>
              Reset
            </Button>
            <Button type="submit" loading={submitting}>
              Submit {entries.length} {entries.length === 1 ? 'Entry' : 'Entries'}
            </Button>
          </div>
        </form>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4 flex gap-4 items-end">
            <Input
              label="Date"
              type="date"
              value={historyDate}
              onChange={(e) => setHistoryDate(e.target.value)}
            />
            <Button onClick={loadHistory}>Load</Button>
          </div>
          <Table
            columns={historyColumns}
            data={historyData}
            loading={historyLoading}
            compact
            emptyMessage="No PTD entries for selected date"
          />
        </div>
      )}
    </div>
  );
};

export default PTDEntry;

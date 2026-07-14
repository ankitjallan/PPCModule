import React, { useState, useEffect } from 'react';
import { machineService } from '../services/machineService';
import { orderService } from '../services/orderService';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import { FullPageSpinner } from '../components/ui/Spinner';

const STAGES = ['PRINTING', 'ECL', 'LAM1', 'LAM2', 'SLITTING', 'POUCHING'];

const MachinePlans = () => {
  const [machines, setMachines] = useState([]);
  const [plans, setPlans] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMachine, setSelectedMachine] = useState('');
  const [generateModal, setGenerateModal] = useState(false);
  const [genJobs, setGenJobs] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState('');
  const [editModal, setEditModal] = useState(false);
  const [editJob, setEditJob] = useState(null);
  const [saving, setSaving] = useState(false);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    machineService.getMachines().then(r => setMachines(r.data)).catch(() => {});
    orderService.getPendingOrders().then(r => setPendingOrders(r.data)).catch(() => {});
  }, []);

  const loadPlans = async () => {
    if (!selectedDate) return;
    setLoading(true);
    try {
      const params = { date: selectedDate };
      if (selectedMachine) params.machineId = selectedMachine;
      const res = await machineService.getMachinePlans(params);
      setPlans(res.data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadPlans(); }, [selectedDate, selectedMachine]);

  const addJobToGen = () => {
    setGenJobs(j => [...j, { productionOrderId: '', stage: '', passNo: 1 }]);
  };

  const updateGenJob = (idx, key, val) => {
    setGenJobs(j => { const a = [...j]; a[idx] = { ...a[idx], [key]: val }; return a; });
  };

  const removeGenJob = (idx) => {
    setGenJobs(j => j.filter((_, i) => i !== idx));
  };

  const handleGenerate = async () => {
    if (!selectedMachine || !selectedDate || genJobs.length === 0) return;
    setGenerating(true);
    try {
      await machineService.generatePlan({
        machineId: parseInt(selectedMachine),
        planDate: selectedDate,
        jobs: genJobs.filter(j => j.productionOrderId && j.stage).map(j => ({
          productionOrderId: parseInt(j.productionOrderId),
          stage: j.stage,
          passNo: parseInt(j.passNo) || 1,
        })),
      });
      showToast('Machine plan generated successfully');
      setGenerateModal(false);
      setGenJobs([]);
      loadPlans();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to generate plan');
    } finally { setGenerating(false); }
  };

  const handleSaveJob = async () => {
    setSaving(true);
    try {
      await machineService.updatePlanJob(editJob.id, {
        from_time: editJob.from_time,
        to_time: editJob.to_time,
        remarks: editJob.remarks,
      });
      showToast('Job updated');
      setEditModal(false);
      loadPlans();
    } catch { showToast('Failed to update job'); } finally { setSaving(false); }
  };

  const handleDeleteJob = async (jobId) => {
    if (!confirm('Remove this job from the plan?')) return;
    try {
      await machineService.deletePlanJob(jobId);
      showToast('Job removed');
      loadPlans();
    } catch { showToast('Failed to remove job'); }
  };

  const fmtTime = (t) => {
    if (!t) return '-';
    return new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const SHIFT_COLORS = { 1: 'bg-blue-100 border-blue-300', 2: 'bg-orange-100 border-orange-300', 3: 'bg-purple-100 border-purple-300' };

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>
      )}

      <PageHeader
        title="Machine Plans"
        subtitle="Schedule and view daily machine production plans"
        actions={
          <Button onClick={() => { setGenJobs([{ productionOrderId: '', stage: '', passNo: 1 }]); setGenerateModal(true); }}>
            Generate Plan
          </Button>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex gap-4 items-end">
        <Input
          label="Plan Date"
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
        <Select
          label="Machine"
          value={selectedMachine}
          onChange={(e) => setSelectedMachine(e.target.value)}
          options={machines.map(m => ({ value: m.id, label: `${m.machine_code} - ${m.name}` }))}
          placeholder="All Machines"
        />
      </div>

      {/* Plans */}
      {loading ? <FullPageSpinner /> : plans.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          No machine plans found for {selectedDate}. Generate a plan to get started.
        </div>
      ) : (
        <div className="space-y-6">
          {plans.map(plan => (
            <div key={plan.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800">{plan.machine_name}</h3>
                  <p className="text-xs text-gray-500">{plan.process_category} • Speed: {plan.speed_mpm} m/min</p>
                </div>
                <p className="text-sm text-gray-500">{plan.plan_date && new Date(plan.plan_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>

              {/* Gantt-style timeline */}
              <div className="p-4 overflow-x-auto">
                <div className="flex gap-2 mb-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-blue-200 border border-blue-300" /> Shift 1 (7-15)</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-orange-200 border border-orange-300" /> Shift 2 (15-23)</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-purple-200 border border-purple-300" /> Shift 3 (23-7)</div>
                </div>

                <table className="w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Seq</th>
                      <th className="px-3 py-2 text-left font-medium">Shift</th>
                      <th className="px-3 py-2 text-left font-medium">From</th>
                      <th className="px-3 py-2 text-left font-medium">To</th>
                      <th className="px-3 py-2 text-left font-medium">Run Hrs</th>
                      <th className="px-3 py-2 text-left font-medium">SO #</th>
                      <th className="px-3 py-2 text-left font-medium">Customer</th>
                      <th className="px-3 py-2 text-left font-medium">FG Code</th>
                      <th className="px-3 py-2 text-left font-medium">Stage</th>
                      <th className="px-3 py-2 text-left font-medium">Target KM</th>
                      <th className="px-3 py-2 text-left font-medium">Remarks</th>
                      <th className="px-3 py-2 text-left font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {plan.jobs?.map((job, i) => (
                      <tr key={job.id} className={`${SHIFT_COLORS[job.shift_no] || ''} ${job.is_manually_edited ? 'ring-inset ring-1 ring-yellow-400' : ''}`}>
                        <td className="px-3 py-2 font-bold">{job.sequence_no}</td>
                        <td className="px-3 py-2">{job.shift_no}</td>
                        <td className="px-3 py-2 font-mono">{fmtTime(job.from_time)}</td>
                        <td className="px-3 py-2 font-mono">{fmtTime(job.to_time)}</td>
                        <td className="px-3 py-2">{Number(job.run_hrs || 0).toFixed(2)}h</td>
                        <td className="px-3 py-2 font-mono text-blue-700">{job.so_number}</td>
                        <td className="px-3 py-2 max-w-[120px] truncate">{job.customer_name}</td>
                        <td className="px-3 py-2 font-mono">{job.fg_code}</td>
                        <td className="px-3 py-2"><Badge status={job.stage}>{job.stage}</Badge></td>
                        <td className="px-3 py-2">{Number(job.target_km || 0).toFixed(2)}</td>
                        <td className="px-3 py-2 text-gray-500">{job.remarks || '-'}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <Button size="xs" variant="secondary" onClick={() => { setEditJob({ ...job }); setEditModal(true); }}>Edit</Button>
                            <Button size="xs" variant="danger" onClick={() => handleDeleteJob(job.id)}>Del</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(!plan.jobs || plan.jobs.length === 0) && (
                      <tr><td colSpan={12} className="px-4 py-6 text-center text-gray-400">No jobs in this plan</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Generate Plan Modal */}
      <Modal
        isOpen={generateModal}
        onClose={() => setGenerateModal(false)}
        title="Generate Machine Plan"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setGenerateModal(false)}>Cancel</Button>
            <Button onClick={handleGenerate} loading={generating}>Generate</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Plan Date" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            <Select
              label="Machine"
              required
              value={selectedMachine}
              onChange={(e) => setSelectedMachine(e.target.value)}
              options={machines.map(m => ({ value: m.id, label: `${m.machine_code} - ${m.name}` }))}
              placeholder="Select machine..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-700 text-sm">Jobs to Schedule</h4>
              <Button size="xs" variant="secondary" onClick={addJobToGen}>+ Add Job</Button>
            </div>
            <div className="space-y-2">
              {genJobs.map((job, idx) => (
                <div key={idx} className="grid grid-cols-4 gap-2 p-3 bg-gray-50 rounded-lg">
                  <Select
                    placeholder="Production Order..."
                    value={job.productionOrderId}
                    onChange={(e) => updateGenJob(idx, 'productionOrderId', e.target.value)}
                    options={pendingOrders.map(o => ({ value: o.id, label: `${o.wo_number} | ${o.so_number} | ${o.customer_name}` }))}
                  />
                  <Select
                    placeholder="Stage..."
                    value={job.stage}
                    onChange={(e) => updateGenJob(idx, 'stage', e.target.value)}
                    options={STAGES.map(s => ({ value: s, label: s }))}
                  />
                  <Input
                    type="number"
                    placeholder="Pass No"
                    value={job.passNo}
                    onChange={(e) => updateGenJob(idx, 'passNo', e.target.value)}
                  />
                  <Button size="sm" variant="danger" onClick={() => removeGenJob(idx)}>Remove</Button>
                </div>
              ))}
              {genJobs.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No jobs added. Click "+ Add Job" to start.</p>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Edit Job Modal */}
      <Modal
        isOpen={editModal}
        onClose={() => setEditModal(false)}
        title="Edit Plan Job"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditModal(false)}>Cancel</Button>
            <Button onClick={handleSaveJob} loading={saving}>Save</Button>
          </>
        }
      >
        {editJob && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="From Time"
                type="datetime-local"
                value={editJob.from_time ? new Date(editJob.from_time).toISOString().slice(0, 16) : ''}
                onChange={(e) => setEditJob(j => ({ ...j, from_time: e.target.value }))}
              />
              <Input
                label="To Time"
                type="datetime-local"
                value={editJob.to_time ? new Date(editJob.to_time).toISOString().slice(0, 16) : ''}
                onChange={(e) => setEditJob(j => ({ ...j, to_time: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Remarks</label>
              <textarea
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                value={editJob.remarks || ''}
                onChange={(e) => setEditJob(j => ({ ...j, remarks: e.target.value }))}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MachinePlans;

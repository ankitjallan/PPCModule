import React, { useState, useEffect, useCallback } from 'react';
import { specSheetService } from '../services/specSheetService';
import { masterService } from '../services/masterService';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';

const STAGES = ['PRINTING', 'ECL', 'LAM1', 'LAM2', 'SLITTING', 'POUCHING'];

const EMPTY_SHEET = {
  fg_code_id: '', total_gsm: '', width_mm: '', job_name: '', no_of_colors: '',
  no_of_ups: 1, reel_width_mm: '', repeat_length_mm: '', notes: '',
  films: [
    { layer_no: 1, item_code: '', item_name: '', gsm: '', width_mm: '', micron: '', std_wastage: 5, raw_material_id: '' },
    { layer_no: 2, item_code: '', item_name: '', gsm: '', width_mm: '', micron: '', std_wastage: 5, raw_material_id: '' },
    { layer_no: 3, item_code: '', item_name: '', gsm: '', width_mm: '', micron: '', std_wastage: 5, raw_material_id: '' },
  ],
  cylinder: { cylinder_type: '', circumference_mm: '', cylinder_code: '', supplier: '', remarks: '' },
  process: {
    has_printing: false, printing_machine_id: '',
    has_ecl: false, ecl_machine_id: '',
    has_lam1: false, lam1_machine_id: '',
    has_lam2: false, lam2_machine_id: '',
    has_slitting: false, slitting_machine_id: '',
    has_pouching: false, pouching_machine_id: '',
    special_instructions: '',
  },
};

const SpecSheets = () => {
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewData, setViewData] = useState(null);
  const [form, setForm] = useState(EMPTY_SHEET);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');
  const [customers, setCustomers] = useState([]);
  const [fgCodes, setFgCodes] = useState([]);
  const [machines, setMachines] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = async () => {
    setLoading(true);
    try {
      const res = await specSheetService.getSpecSheets({});
      setSheets(res.data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    Promise.all([
      masterService.getCustomers(),
      masterService.getFGCodes(),
      masterService.getMachines(),
      masterService.getRawMaterials(),
    ]).then(([c, f, m, rm]) => {
      setCustomers(c.data);
      setFgCodes(f.data);
      setMachines(m.data);
      setRawMaterials(rm.data);
    }).catch(() => {});
  }, []);

  const handleView = async (id) => {
    try {
      const res = await specSheetService.getSpecSheet(id);
      setViewData(res.data);
      setViewModal(true);
    } catch {}
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(JSON.parse(JSON.stringify(EMPTY_SHEET)));
    setFormError('');
    setModal(true);
  };

  const openEdit = async (id) => {
    try {
      const res = await specSheetService.getSpecSheet(id);
      const d = res.data;
      const emptyFilm = (layerNo) => ({ layer_no: layerNo, item_code: '', item_name: '', gsm: '', width_mm: '', micron: '', std_wastage: 5, raw_material_id: '' });
      const films = [1, 2, 3].map(n => d.films?.find(f => f.layer_no === n) || emptyFilm(n));
      setForm({
        fg_code_id: d.fg_code_id, total_gsm: d.total_gsm || '', width_mm: d.width_mm || '',
        job_name: d.job_name || '', no_of_colors: d.no_of_colors || '',
        no_of_ups: d.no_of_ups || 1, reel_width_mm: d.reel_width_mm || '',
        repeat_length_mm: d.repeat_length_mm || '', notes: d.notes || '',
        films,
        cylinder: d.cylinder || EMPTY_SHEET.cylinder,
        process: d.process || EMPTY_SHEET.process,
      });
      setEditingId(id);
      setFormError('');
      setModal(true);
    } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fg_code_id) { setFormError('FG Code is required'); return; }
    setSaving(true);
    try {
      const activeFilms = form.films.filter(f => f.item_code || f.item_name);
      const payload = { ...form, films: activeFilms };
      if (editingId) await specSheetService.updateSpecSheet(editingId, payload);
      else await specSheetService.createSpecSheet(payload);
      showToast(`Spec sheet ${editingId ? 'updated' : 'created'} successfully`);
      setModal(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save spec sheet');
    } finally { setSaving(false); }
  };

  const updateFilm = (idx, key, val) => {
    setForm(f => {
      const films = [...f.films];
      films[idx] = { ...films[idx], [key]: val };
      return { ...f, films };
    });
  };

  const machineOpts = machines.map(m => ({ value: m.id, label: `${m.machine_code} - ${m.name}` }));

  const columns = [
    { key: 'fg_code', header: 'FG Code', render: (v) => <span className="font-mono text-xs font-bold text-blue-800">{v}</span> },
    { key: 'fg_description', header: 'Description', render: (v) => <span className="text-xs">{v || '-'}</span> },
    { key: 'customer_name', header: 'Customer' },
    { key: 'job_name', header: 'Job Name', render: (v) => v || '-' },
    { key: 'version', header: 'Version', render: (v) => `v${v}` },
    { key: 'total_gsm', header: 'Total GSM' },
    { key: 'width_mm', header: 'Width mm' },
    { key: 'is_current', header: 'Current', render: (v) => v ? <Badge variant="green">Current</Badge> : <Badge>Old</Badge> },
    { key: 'created_at', header: 'Created', render: (v) => new Date(v).toLocaleDateString('en-IN') },
    {
      key: 'actions', header: '',
      render: (_, row) => (
        <div className="flex gap-1">
          <Button size="xs" variant="ghost" onClick={() => handleView(row.id)}>View</Button>
          <Button size="xs" variant="secondary" onClick={() => openEdit(row.id)}>Edit</Button>
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
        title="Spec Sheets"
        subtitle="Manage product specification sheets"
        actions={<Button onClick={openCreate}>+ New Spec Sheet</Button>}
      />

      <Table columns={columns} data={sheets} loading={loading} compact />

      {/* View Modal */}
      <Modal isOpen={viewModal} onClose={() => setViewModal(false)} title="Spec Sheet Details" size="lg">
        {viewData && (
          <div className="space-y-6 text-sm">
            <div className="grid grid-cols-3 gap-4">
              <div><p className="text-gray-500">FG Code</p><p className="font-semibold">{viewData.fg_code}</p></div>
              <div><p className="text-gray-500">Version</p><p className="font-semibold">v{viewData.version}</p></div>
              <div><p className="text-gray-500">Total GSM</p><p className="font-semibold">{viewData.total_gsm}</p></div>
              <div><p className="text-gray-500">Width (mm)</p><p className="font-semibold">{viewData.width_mm}</p></div>
              <div><p className="text-gray-500">Job Name</p><p className="font-semibold">{viewData.job_name || '-'}</p></div>
              <div><p className="text-gray-500">Colors</p><p className="font-semibold">{viewData.no_of_colors}</p></div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Film Structure</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      {['Layer', 'Item Code', 'Item Name', 'GSM', 'Width mm', 'Micron', 'Wastage %'].map(h => (
                        <th key={h} className="border border-gray-200 px-2 py-1 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {viewData.films?.map(f => (
                      <tr key={f.id}>
                        <td className="border border-gray-200 px-2 py-1">L{f.layer_no}</td>
                        <td className="border border-gray-200 px-2 py-1 font-mono">{f.item_code}</td>
                        <td className="border border-gray-200 px-2 py-1">{f.item_name}</td>
                        <td className="border border-gray-200 px-2 py-1">{f.gsm}</td>
                        <td className="border border-gray-200 px-2 py-1">{f.width_mm}</td>
                        <td className="border border-gray-200 px-2 py-1">{f.micron}</td>
                        <td className="border border-gray-200 px-2 py-1">{f.std_wastage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {viewData.process && (
              <div>
                <h4 className="font-semibold text-gray-800 mb-2">Process Stages</h4>
                <div className="flex flex-wrap gap-2">
                  {STAGES.map(s => {
                    const key = `has_${s.toLowerCase()}`;
                    return viewData.process[key] ? <Badge key={s} status={s}>{s}</Badge> : null;
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modal}
        onClose={() => setModal(false)}
        title={editingId ? 'Revise Spec Sheet (New Version)' : 'New Spec Sheet'}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button type="submit" form="spec-form" loading={saving}>
              {editingId ? 'Save New Version' : 'Create'}
            </Button>
          </>
        }
      >
        {formError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{formError}</div>}
        <form id="spec-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Header */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-3">
              <Select
                label="FG Code"
                required
                value={form.fg_code_id}
                onChange={(e) => setForm(f => ({ ...f, fg_code_id: e.target.value }))}
                options={fgCodes.map(f => ({ value: f.id, label: `${f.fg_code}${f.description ? ' - ' + f.description : ''}` }))}
                placeholder="Select FG Code..."
              />
            </div>
            <Input label="Job Name" value={form.job_name} onChange={(e) => setForm(f => ({ ...f, job_name: e.target.value }))} />
            <Input label="Total GSM" type="number" step="0.01" value={form.total_gsm} onChange={(e) => setForm(f => ({ ...f, total_gsm: e.target.value }))} />
            <Input label="Width (mm)" type="number" value={form.width_mm} onChange={(e) => setForm(f => ({ ...f, width_mm: e.target.value }))} />
            <Input label="No. of Colors" type="number" value={form.no_of_colors} onChange={(e) => setForm(f => ({ ...f, no_of_colors: e.target.value }))} />
            <Input label="No. of Ups" type="number" value={form.no_of_ups} onChange={(e) => setForm(f => ({ ...f, no_of_ups: e.target.value }))} />
            <Input label="Reel Width (mm)" type="number" value={form.reel_width_mm} onChange={(e) => setForm(f => ({ ...f, reel_width_mm: e.target.value }))} />
            <Input label="Repeat Length (mm)" type="number" step="0.01" value={form.repeat_length_mm} onChange={(e) => setForm(f => ({ ...f, repeat_length_mm: e.target.value }))} />
          </div>

          {/* Films */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-3">Film Structure</h4>
            <div className="space-y-3">
              {form.films.map((film, idx) => (
                <div key={idx} className="grid grid-cols-7 gap-2 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <span className="text-sm font-semibold text-gray-600">L{film.layer_no}</span>
                  </div>
                  <Input placeholder="Item Code" value={film.item_code} onChange={(e) => updateFilm(idx, 'item_code', e.target.value)} />
                  <div className="col-span-2">
                    <Input placeholder="Item Name" value={film.item_name} onChange={(e) => updateFilm(idx, 'item_name', e.target.value)} />
                  </div>
                  <Input placeholder="GSM" type="number" step="0.01" value={film.gsm} onChange={(e) => updateFilm(idx, 'gsm', e.target.value)} />
                  <Input placeholder="Width mm" type="number" value={film.width_mm} onChange={(e) => updateFilm(idx, 'width_mm', e.target.value)} />
                  <Input placeholder="Wastage %" type="number" step="0.1" value={film.std_wastage} onChange={(e) => updateFilm(idx, 'std_wastage', e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          {/* Process */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-3">Process Stages</h4>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['has_printing', 'Printing', 'printing_machine_id'],
                ['has_ecl', 'ECL', 'ecl_machine_id'],
                ['has_lam1', 'Lamination 1', 'lam1_machine_id'],
                ['has_lam2', 'Lamination 2', 'lam2_machine_id'],
                ['has_slitting', 'Slitting', 'slitting_machine_id'],
                ['has_pouching', 'Pouching', 'pouching_machine_id'],
              ].map(([flag, label, machineKey]) => (
                <div key={flag} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    id={flag}
                    checked={form.process[flag] || false}
                    onChange={(e) => setForm(f => ({ ...f, process: { ...f.process, [flag]: e.target.checked } }))}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <label htmlFor={flag} className="text-sm font-medium text-gray-700 flex-1">{label}</label>
                  {form.process[flag] && (
                    <Select
                      value={form.process[machineKey] || ''}
                      onChange={(e) => setForm(f => ({ ...f, process: { ...f.process, [machineKey]: e.target.value } }))}
                      options={machineOpts}
                      placeholder="Select machine..."
                      className="text-xs"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-gray-700">Notes</label>
            <textarea
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SpecSheets;

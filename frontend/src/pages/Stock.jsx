import React, { useState, useEffect, useCallback } from 'react';
import { stockService } from '../services/stockService';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import FileUpload from '../components/ui/FileUpload';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';

const Stock = () => {
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [itemType, setItemType] = useState('');
  const [page, setPage] = useState(1);
  const [importModal, setImportModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await stockService.getStock({ search, item_type: itemType, page, limit: 50 });
      setData(res.data.data);
      setPagination(res.data.pagination);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [search, itemType, page]);

  useEffect(() => { load(); }, [load]);

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await stockService.importStock(importFile);
      setImportResult(res.data);
      if (res.data.success) {
        showToast(`Import successful: ${res.data.count} records processed`);
        load();
      }
    } catch (err) {
      setImportResult({ success: false, error: err.response?.data?.error || 'Import failed' });
    } finally {
      setImporting(false);
    }
  };

  const handleEditSave = async () => {
    setSaving(true);
    try {
      await stockService.updateStock(editRow.raw_material_id, {
        store_stock: parseFloat(editRow.store_stock) || 0,
        qc_hold: parseFloat(editRow.qc_hold) || 0,
        process_stock: parseFloat(editRow.process_stock) || 0,
        pending_movement: parseFloat(editRow.pending_movement) || 0,
        last_30_cons: parseFloat(editRow.last_30_cons) || 0,
        pending_po: parseFloat(editRow.pending_po) || 0,
        qc_pending: parseFloat(editRow.qc_pending) || 0,
      });
      showToast('Stock updated successfully');
      setEditModal(false);
      load();
    } catch {
      showToast('Failed to update stock');
    } finally {
      setSaving(false);
    }
  };

  const getDaysCoverColor = (days) => {
    if (days === null || days === undefined) return 'text-gray-400';
    if (days < 7) return 'text-red-600 font-semibold';
    if (days < 15) return 'text-orange-600 font-semibold';
    return 'text-green-700';
  };

  const columns = [
    { key: 'item_code', header: 'Item Code', render: (v) => <span className="font-mono text-xs font-medium text-blue-800">{v}</span> },
    { key: 'item_name', header: 'Item Name', render: (v) => <span className="max-w-[220px] truncate block text-xs" title={v}>{v}</span> },
    { key: 'item_type', header: 'Type', render: (v) => v ? <Badge>{v}</Badge> : '-' },
    { key: 'item_subtype', header: 'Sub Type', render: (v) => v || '-' },
    { key: 'store_stock', header: 'Store Stock', render: (v) => <span className="font-medium">{Number(v || 0).toFixed(2)}</span> },
    { key: 'qc_hold', header: 'QC Hold', render: (v) => Number(v || 0).toFixed(2) },
    { key: 'process_stock', header: 'Process', render: (v) => Number(v || 0).toFixed(2) },
    { key: 'total_stock', header: 'Total Stock', render: (v) => <span className="font-bold text-gray-900">{Number(v || 0).toFixed(2)}</span> },
    { key: 'last_30_cons', header: 'L30 Cons', render: (v) => Number(v || 0).toFixed(2) },
    { key: 'pending_po', header: 'Pending PO', render: (v) => Number(v || 0).toFixed(2) },
    {
      key: 'days_cover', header: 'Days Cover',
      render: (v, row) => (
        <span className={getDaysCoverColor(v)}>
          {v != null ? `${v}d` : '-'}
        </span>
      )
    },
    {
      key: 'actions', header: '',
      render: (_, row) => (
        <Button size="xs" variant="secondary" onClick={() => { setEditRow({ ...row }); setEditModal(true); }}>
          Edit
        </Button>
      )
    },
  ];

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      <PageHeader
        title="Stock Register"
        subtitle="View and manage raw material inventory"
        actions={
          <Button onClick={() => { setImportModal(true); setImportResult(null); setImportFile(null); }}>
            Import from Excel
          </Button>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap gap-4 items-end">
        <div className="w-64">
          <Input
            label="Search"
            placeholder="Item code or name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="w-48">
          <Select
            label="Item Type"
            value={itemType}
            onChange={(e) => { setItemType(e.target.value); setPage(1); }}
            options={[
              { value: 'FILM', label: 'Film' },
              { value: 'INK', label: 'Ink' },
              { value: 'ADHESIVE', label: 'Adhesive' },
              { value: 'CYLINDER', label: 'Cylinder' },
              { value: 'OTHER', label: 'Other' },
            ]}
            placeholder="All Types"
          />
        </div>
        <Button variant="secondary" onClick={() => { setSearch(''); setItemType(''); setPage(1); }}>
          Clear
        </Button>
      </div>

      <Table
        columns={columns}
        data={data}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        emptyMessage="No stock records found. Import stock data to get started."
        compact
      />

      {/* Import Modal */}
      <Modal
        isOpen={importModal}
        onClose={() => setImportModal(false)}
        title="Import Stock from Excel"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setImportModal(false)}>Cancel</Button>
            <Button onClick={handleImport} loading={importing} disabled={!importFile}>
              Import
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <p className="font-medium mb-1">Excel Format Requirements:</p>
            <ul className="text-xs space-y-1 list-disc pl-4">
              <li>Must have a header row containing <strong>ITEMCODE</strong></li>
              <li>Supported columns: ITEMCODE, ITEMNAME, ITEM_TYPE, STORE_STOCK, QC_HOLD, PROCESS_STOCK, LAST_30_CONS, PENDING_PO</li>
              <li>Existing records will be updated, new items will be created</li>
            </ul>
          </div>
          <FileUpload
            onFileSelect={setImportFile}
            label="Click to upload Excel file (.xlsx)"
            accept=".xlsx,.xls"
          />
          {importResult && (
            <div className={`p-4 rounded-lg border text-sm ${importResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              {importResult.success ? (
                <>
                  <p className="font-semibold text-green-800">Import Complete</p>
                  <p className="text-green-700 mt-1">{importResult.count} records processed successfully</p>
                  {importResult.errors?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-orange-700 font-medium">{importResult.errors.length} rows had errors:</p>
                      {importResult.errors.slice(0, 5).map((e, i) => (
                        <p key={i} className="text-xs text-orange-600">Row {e.row}: {e.error}</p>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-red-700">{importResult.error}</p>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Stock Modal */}
      <Modal
        isOpen={editModal}
        onClose={() => setEditModal(false)}
        title={`Edit Stock: ${editRow?.item_code}`}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditModal(false)}>Cancel</Button>
            <Button onClick={handleEditSave} loading={saving}>Save</Button>
          </>
        }
      >
        {editRow && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{editRow.item_name}</p>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['store_stock', 'Store Stock'],
                ['qc_hold', 'QC Hold'],
                ['process_stock', 'Process Stock'],
                ['pending_movement', 'Pending Movement'],
                ['last_30_cons', 'Last 30 Days Consumption'],
                ['pending_po', 'Pending PO'],
                ['qc_pending', 'QC Pending'],
              ].map(([key, label]) => (
                <Input
                  key={key}
                  label={label}
                  type="number"
                  step="0.001"
                  value={editRow[key] ?? 0}
                  onChange={(e) => setEditRow(r => ({ ...r, [key]: e.target.value }))}
                />
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Stock;

import React, { useState } from 'react';
import { masterService } from '../services/masterService';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import DateRangePicker from '../components/ui/DateRangePicker';

const SHEETS = [
  { key: 'stock', label: 'Stock Register', desc: 'Current stock levels for all raw materials' },
  { key: 'sales_orders', label: 'Sales Orders', desc: 'All sales orders in date range' },
  { key: 'production_orders', label: 'Production Orders', desc: 'Production order details and status' },
  { key: 'ptd_entries', label: 'PTD Entries', desc: 'Daily production entries in date range' },
  { key: 'pending_orders', label: 'Pending Order Tracker', desc: 'Open orders with stage-wise status' },
];

const ExportData = () => {
  const today = new Date().toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  const [selectedSheets, setSelectedSheets] = useState(['stock', 'sales_orders']);
  const [dateFrom, setDateFrom] = useState(monthAgo);
  const [dateTo, setDateTo] = useState(today);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const toggleSheet = (key) => {
    setSelectedSheets(s =>
      s.includes(key) ? s.filter(k => k !== key) : [...s, key]
    );
  };

  const handleExport = async () => {
    if (selectedSheets.length === 0) {
      setError('Please select at least one sheet to export.');
      return;
    }
    setError('');
    setExporting(true);
    try {
      const res = await masterService.exportExcel({ sheets: selectedSheets, dateFrom, dateTo });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `MIPL_PPC_Export_${dateTo}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err.response?.data?.error || 'Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Export Data"
        subtitle="Download production data as Excel spreadsheets"
      />

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Date Range */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Date Range</h3>
        <p className="text-sm text-gray-500 mb-4">
          Applies to Sales Orders, Production Orders, and PTD Entries. Stock always exports current snapshot.
        </p>
        <DateRangePicker
          from={dateFrom}
          to={dateTo}
          onFromChange={setDateFrom}
          onToChange={setDateTo}
        />
      </div>

      {/* Sheet Selection */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Select Sheets to Export</h3>
        <div className="space-y-3">
          {SHEETS.map(sheet => (
            <label
              key={sheet.key}
              className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                selectedSheets.includes(sheet.key)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedSheets.includes(sheet.key)}
                onChange={() => toggleSheet(sheet.key)}
                className="w-4 h-4 text-blue-600 rounded mt-0.5"
              />
              <div>
                <p className="font-medium text-gray-900 text-sm">{sheet.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{sheet.desc}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedSheets(SHEETS.map(s => s.key))}
          >
            Select All
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedSheets([])}>
            Clear All
          </Button>
        </div>
      </div>

      {/* Export Button */}
      <div className="flex items-center gap-4">
        <Button
          size="lg"
          onClick={handleExport}
          loading={exporting}
          disabled={selectedSheets.length === 0}
        >
          {exporting ? 'Generating Excel...' : `Export ${selectedSheets.length} Sheet${selectedSheets.length !== 1 ? 's' : ''} to Excel`}
        </Button>
        {selectedSheets.length > 0 && (
          <p className="text-sm text-gray-500">
            Selected: {selectedSheets.map(k => SHEETS.find(s => s.key === k)?.label).join(', ')}
          </p>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
        <h4 className="font-medium text-blue-900 mb-2 text-sm">Export Details</h4>
        <ul className="text-xs text-blue-800 space-y-1 list-disc pl-4">
          <li>Files are generated in Excel .xlsx format</li>
          <li>Header row is styled in navy blue with white text</li>
          <li>Data rows alternate between white and light gray</li>
          <li>All cells have thin borders for readability</li>
          <li>Column widths are auto-fitted to content</li>
          <li>Large exports may take a few seconds to generate</li>
        </ul>
      </div>
    </div>
  );
};

export default ExportData;

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../services/api';

const statLabels = {
  customers: 'Customers', raw_materials: 'Raw Materials', machines: 'Machines',
  fg_codes: 'FG Codes', spec_sheets: 'Spec Sheets', spec_sheet_films: 'Spec Films',
  spec_sheet_cylinders: 'Spec Cylinders', spec_sheet_process: 'Spec Process',
  stock: 'Stock Records', stock_imports: 'Stock Imports',
  sales_orders: 'Sales Orders', work_orders: 'Work Orders',
  production_orders: 'Production Orders', production_stage_tracking: 'Stage Tracking',
  production_rm_allocation: 'RM Allocations', machine_plans: 'Machine Plans',
  machine_plan_jobs: 'Machine Plan Jobs', ptd_entries: 'PTD Entries', audit_log: 'Audit Log',
};

const ConfirmModal = ({ title, description, confirmText, placeholder, onConfirm, onCancel, danger }) => {
  const [input, setInput] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className={`flex items-center gap-3 mb-4`}>
          <div className={`p-2 rounded-full ${danger === 'extreme' ? 'bg-red-100' : 'bg-orange-100'}`}>
            <svg className={`h-6 w-6 ${danger === 'extreme' ? 'text-red-600' : 'text-orange-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5C2.498 18.333 3.46 20 5 20z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">{description}</p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type <span className="font-mono font-bold text-red-600">{confirmText}</span> to confirm
          </label>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={placeholder}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 font-mono"
            autoFocus
          />
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(input)}
            disabled={input !== confirmText}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed ${
              danger === 'extreme' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'
            }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

const Settings = () => {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null); // 'test' | 'all' | 'seed'

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['data-stats'],
    queryFn: () => api.get('/settings/data-stats').then(r => r.data),
  });

  const seedMutation = useMutation({
    mutationFn: () => api.post('/settings/seed-test-data'),
    onSuccess: (r) => {
      toast.success(r.data.message);
      refetchStats();
      qc.invalidateQueries();
      setModal(null);
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Seed failed'),
  });

  const clearTestMutation = useMutation({
    mutationFn: (confirmText) => api.post('/settings/clear-test-data', { confirm: confirmText }),
    onSuccess: (r) => {
      toast.success(r.data.message);
      refetchStats();
      qc.invalidateQueries();
      setModal(null);
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Clear failed'),
  });

  const clearAllMutation = useMutation({
    mutationFn: (confirmText) => api.post('/settings/clear-all-data', { confirm: confirmText }),
    onSuccess: (r) => {
      toast.success(r.data.message);
      refetchStats();
      qc.invalidateQueries();
      setModal(null);
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Clear failed'),
  });

  const totalRecords = stats ? Object.values(stats).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Data management — admin only</p>
      </div>

      {/* Data Overview */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Current Data Overview</h2>
            <p className="text-sm text-gray-500">{totalRecords.toLocaleString()} total records across all tables</p>
          </div>
          <button onClick={() => refetchStats()} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            Refresh
          </button>
        </div>
        {statsLoading ? (
          <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array(12).fill(0).map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats && Object.entries(stats).map(([table, count]) => (
              <div key={table} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 truncate">{statLabels[table] || table}</p>
                <p className="text-xl font-bold text-gray-900">{count.toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Test Data */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Test Data Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">Seed realistic sample data for testing all modules</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
              <svg className="h-5 w-5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900">Load Test Data</p>
              <p className="text-xs text-blue-700 mt-0.5">
                Populates: 6 customers, 20 raw materials, 9 machines, 8 FG codes, 5 spec sheets,
                14 sales orders, production orders with stage tracking, PTD history, and 5 user accounts.
              </p>
            </div>
            <button
              onClick={() => setModal('seed')}
              disabled={seedMutation.isPending}
              className="flex-shrink-0 px-4 py-2 bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800 disabled:opacity-50"
            >
              {seedMutation.isPending ? 'Seeding...' : 'Load Test Data'}
            </button>
          </div>

          <div className="flex items-start gap-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="p-2 bg-orange-100 rounded-lg flex-shrink-0">
              <svg className="h-5 w-5 text-orange-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-900">Clear Test / Client Data</p>
              <p className="text-xs text-orange-700 mt-0.5">
                Removes all transactional and master data (orders, stock, machines, customers, spec sheets, PTD).
                Preserves system configuration: users, roles, shifts, process categories.
              </p>
            </div>
            <button
              onClick={() => setModal('test')}
              className="flex-shrink-0 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700"
            >
              Clear Data
            </button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-xl border border-red-200 shadow-sm">
        <div className="px-6 py-4 border-b border-red-200">
          <h2 className="text-base font-semibold text-red-700">Danger Zone</h2>
          <p className="text-sm text-red-500 mt-0.5">Irreversible actions — proceed with extreme caution</p>
        </div>
        <div className="p-6">
          <div className="flex items-start gap-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
              <svg className="h-5 w-5 text-red-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5C2.498 18.333 3.46 20 5 20z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-900">Factory Reset — Clear All Data</p>
              <p className="text-xs text-red-700 mt-0.5">
                Wipes <strong>everything</strong> including all users, orders, stock, machines, spec sheets, and history.
                Only your current admin account will be preserved. This cannot be undone.
              </p>
            </div>
            <button
              onClick={() => setModal('all')}
              className="flex-shrink-0 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
            >
              Factory Reset
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal === 'seed' && (
        <ConfirmModal
          title="Load Test Data"
          description="This will insert sample customers, raw materials, machines, spec sheets, sales orders, production orders, and PTD entries. Existing data will not be overwritten (uses ON CONFLICT DO NOTHING)."
          confirmText="LOAD TEST DATA"
          placeholder="Type LOAD TEST DATA"
          danger="info"
          onConfirm={(text) => { if (text === 'LOAD TEST DATA') seedMutation.mutate(); }}
          onCancel={() => setModal(null)}
        />
      )}
      {modal === 'test' && (
        <ConfirmModal
          title="Clear All Test / Client Data"
          description="This will permanently delete all customers, raw materials, machines, FG codes, spec sheets, orders, stock records, and PTD entries. Users, roles, shifts, and process categories will be preserved."
          confirmText="CLEAR TEST DATA"
          placeholder="Type CLEAR TEST DATA"
          danger="warning"
          onConfirm={(text) => clearTestMutation.mutate(text)}
          onCancel={() => setModal(null)}
        />
      )}
      {modal === 'all' && (
        <ConfirmModal
          title="Factory Reset — Clear Everything"
          description="This will permanently delete ALL data including all user accounts (except yours). The system will be returned to a completely blank state. This action is irreversible."
          confirmText="CLEAR ALL DATA"
          placeholder="Type CLEAR ALL DATA"
          danger="extreme"
          onConfirm={(text) => clearAllMutation.mutate(text)}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
};

export default Settings;

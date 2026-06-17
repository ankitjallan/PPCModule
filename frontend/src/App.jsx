import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Stock from './pages/Stock';
import Booking from './pages/Booking';
import OrderBook from './pages/OrderBook';
import SpecSheets from './pages/SpecSheets';
import PendingOrders from './pages/PendingOrders';
import MachinePlans from './pages/MachinePlans';
import PTDEntry from './pages/PTDEntry';
import ExportData from './pages/ExportData';

import Settings from './pages/Settings';

// Admin pages
import Users from './pages/admin/Users';
import Machines from './pages/admin/Machines';
import Customers from './pages/admin/Customers';
import ProcessCategories from './pages/admin/ProcessCategories';

const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="stock" element={
              <ProtectedRoute roles={['admin', 'store_inventory', 'ppc_planner', 'management']}>
                <Stock />
              </ProtectedRoute>
            } />
            <Route path="booking" element={
              <ProtectedRoute roles={['admin', 'sales', 'ppc_planner']}>
                <Booking />
              </ProtectedRoute>
            } />
            <Route path="order-book" element={<OrderBook />} />
            <Route path="spec-sheets" element={
              <ProtectedRoute roles={['admin', 'ppc_planner']}>
                <SpecSheets />
              </ProtectedRoute>
            } />
            <Route path="pending-orders" element={<PendingOrders />} />
            <Route path="machine-plans" element={
              <ProtectedRoute roles={['admin', 'ppc_planner', 'machine_operator']}>
                <MachinePlans />
              </ProtectedRoute>
            } />
            <Route path="ptd-entry" element={
              <ProtectedRoute roles={['admin', 'ppc_planner', 'machine_operator']}>
                <PTDEntry />
              </ProtectedRoute>
            } />
            <Route path="export-data" element={<ExportData />} />
            <Route path="settings" element={
              <ProtectedRoute roles={['admin']}>
                <Settings />
              </ProtectedRoute>
            } />

            {/* Admin routes */}
            <Route path="admin/users" element={
              <ProtectedRoute roles={['admin']}>
                <Users />
              </ProtectedRoute>
            } />
            <Route path="admin/customers" element={
              <ProtectedRoute roles={['admin']}>
                <Customers />
              </ProtectedRoute>
            } />
            <Route path="admin/machines" element={
              <ProtectedRoute roles={['admin']}>
                <Machines />
              </ProtectedRoute>
            } />
            <Route path="admin/process-categories" element={
              <ProtectedRoute roles={['admin']}>
                <ProcessCategories />
              </ProtectedRoute>
            } />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;

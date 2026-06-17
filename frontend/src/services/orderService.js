import api from './api';

export const orderService = {
  // Sales Orders
  getSalesOrders: (params) => api.get('/sales-orders', { params }),
  getSalesOrder: (id) => api.get(`/sales-orders/${id}`),
  createSalesOrder: (data) => api.post('/sales-orders', data),
  updateSalesOrder: (id, data) => api.put(`/sales-orders/${id}`, data),
  updateSalesOrderStatus: (id, status) => api.patch(`/sales-orders/${id}/status`, { status }),

  // Production Orders
  getProductionOrders: (params) => api.get('/production-orders', { params }),
  getPendingOrders: () => api.get('/production-orders/pending'),
  getProductionOrder: (id) => api.get(`/production-orders/${id}`),
  createFromSO: (soId) => api.post(`/production-orders/from-so/${soId}`),
  overrideSpec: (id, specSheetId) =>
    api.put(`/production-orders/${id}/spec-override`, { spec_sheet_id: specSheetId }),
};

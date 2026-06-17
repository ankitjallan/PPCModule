import api from './api';

export const masterService = {
  // Customers
  getCustomers: (params) => api.get('/customers', { params }),
  createCustomer: (data) => api.post('/customers', data),
  updateCustomer: (id, data) => api.put(`/customers/${id}`, data),
  deleteCustomer: (id) => api.delete(`/customers/${id}`),

  // Raw Materials
  getRawMaterials: (params) => api.get('/raw-materials', { params }),
  createRawMaterial: (data) => api.post('/raw-materials', data),
  updateRawMaterial: (id, data) => api.put(`/raw-materials/${id}`, data),

  // Process Categories
  getProcessCategories: () => api.get('/process-categories'),
  createProcessCategory: (data) => api.post('/process-categories', data),
  updateProcessCategory: (id, data) => api.put(`/process-categories/${id}`, data),
  deleteProcessCategory: (id) => api.delete(`/process-categories/${id}`),

  // FG Codes
  getFGCodes: (params) => api.get('/fg-codes', { params }),
  createFGCode: (data) => api.post('/fg-codes', data),
  updateFGCode: (id, data) => api.put(`/fg-codes/${id}`, data),

  // Machines (alias — full service in machineService.js)
  getMachines: (params) => api.get('/machines', { params }),

  // Shifts
  getShifts: () => api.get('/shifts'),

  // Users
  getUsers: (params) => api.get('/users', { params }),
  createUser: (data) => api.post('/users', data),
  updateUser: (id, data) => api.put(`/users/${id}`, data),
  deleteUser: (id) => api.delete(`/users/${id}`),
  resetUserPassword: (id, newPassword) => api.post(`/users/${id}/reset-password`, { newPassword }),
  getRoles: () => api.get('/users/roles'),

  // Exports
  getExportLayout: (sheetName) => api.get(`/exports/layout/${sheetName}`),
  saveExportLayout: (sheetName, column_config) => api.post(`/exports/layout/${sheetName}`, { column_config }),
  exportExcel: (data) => api.post('/exports/excel', data, {
    responseType: 'blob',
    timeout: 60000,
  }),
};

import api from './api';

export const stockService = {
  getStock: (params) => api.get('/stock', { params }),
  updateStock: (rawMaterialId, data) => api.put(`/stock/${rawMaterialId}`, data),
  importStock: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/stock/import', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
  },
  getImports: () => api.get('/stock/imports'),
};

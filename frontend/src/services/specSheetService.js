import api from './api';

export const specSheetService = {
  getSpecSheets: (params) => api.get('/spec-sheets', { params }),
  getSpecSheetByFG: (fgCodeId) => api.get(`/spec-sheets/fg/${fgCodeId}`),
  getSpecSheet: (id) => api.get(`/spec-sheets/${id}`),
  createSpecSheet: (data) => api.post('/spec-sheets', data),
  updateSpecSheet: (id, data) => api.put(`/spec-sheets/${id}`, data),
};

import api from './api';

export const ptdService = {
  submitEntries: (entries) => api.post('/ptd/entries', { entries }),
  getEntries: (params) => api.get('/ptd/entries', { params }),
  getSummary: (productionOrderId) => api.get(`/ptd/summary/${productionOrderId}`),
};

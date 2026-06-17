import api from './api';

export const machineService = {
  getMachines: (params) => api.get('/machines', { params }),
  createMachine: (data) => api.post('/machines', data),
  updateMachine: (id, data) => api.put(`/machines/${id}`, data),

  // Machine Plans
  getMachinePlans: (params) => api.get('/machine-plans', { params }),
  generatePlan: (data) => api.post('/machine-plans/generate', data),
  updatePlanJob: (jobId, data) => api.put(`/machine-plans/jobs/${jobId}`, data),
  deletePlanJob: (jobId) => api.delete(`/machine-plans/jobs/${jobId}`),
};

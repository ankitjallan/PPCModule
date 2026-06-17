import api from './api';

export const dashboardService = {
  getDashboard: (params) => api.get('/dashboard', { params }),
};

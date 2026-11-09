import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('archit_token');
  if (token) {
    config.headers.Authorization = ['Bearer', token].join(' ');
  }
  return config;
});

export default api;

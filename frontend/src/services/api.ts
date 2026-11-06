import axios from 'axios';

// Detect whether we are running on Vite (with /api proxy) or direct backend
const getBaseUrl = () => {
  if (window.location.port === '5174' || window.location.port === '5173' || window.location.port === '1000' || window.location.port === '80' || window.location.port === '') {
    return '/api';
  }
  const host = window.location.hostname || 'localhost';
  return `http://${host}:1000/api`;
};

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('store_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('store_token');
        localStorage.removeItem('store_user');
      }
    }
    return Promise.reject(error);
  }
);

export default api;

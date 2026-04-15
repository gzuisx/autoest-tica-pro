import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/admin`
  : '/api/admin';

export const adminApi = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' } });

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function adminLogin(secret: string): Promise<string> {
  const { data } = await adminApi.post('/login', { secret });
  localStorage.setItem('adminToken', data.token);
  return data.token;
}

export function adminLogout() {
  localStorage.removeItem('adminToken');
}

export function isAdminLoggedIn(): boolean {
  return !!localStorage.getItem('adminToken');
}

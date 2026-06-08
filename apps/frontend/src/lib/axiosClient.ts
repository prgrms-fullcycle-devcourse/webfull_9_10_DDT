// src/lib/axiosClient.ts (새 파일)
import axios from 'axios';
import { getToken } from './getToken';

axios.defaults.baseURL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://ddt-test.ddns.net:8080';

axios.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

axios.interceptors.response.use((response) => {
  if (
    response.data &&
    typeof response.data === 'object' &&
    'data' in response.data
  ) {
    response.data = response.data.data;
  }
  return response;
});

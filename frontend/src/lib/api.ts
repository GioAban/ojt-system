import axios from "axios";

const api = axios.create({
  // Sa production, same-origin "/api" (Caddy ang nagpo-proxy). Sa laptop, localhost.
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8080/api",
});

// Awtomatikong maglalagay ng JWT token sa bawat request, kung meron
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

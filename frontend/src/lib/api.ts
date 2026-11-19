import axios from "axios";
import { API_BASE } from "@/lib/apiBase";
import { installReadCache } from "@/offline/readCache";

const api = axios.create({
  // Sa production, same-origin "/api" (Caddy ang nagpo-proxy). Sa laptop, localhost.
  baseURL: API_BASE,
});

// Awtomatikong maglalagay ng JWT token sa bawat request, kung meron
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Offline mode: itinatabi ang mga nabuksang page (bawat user) at ipinapakita ang mga ito kapag walang koneksyon
installReadCache(api);

export default api;

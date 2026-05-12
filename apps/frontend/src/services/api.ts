import axios from "axios";
import type { Monitor, Check, Incident, MonitorStats } from "@watchdog/shared-types";
import { tokenStore } from "../lib/auth";

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "",
});

http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

export const api = {
  auth: {
    register: (data: { email: string; password: string; name: string }) =>
      http.post<AuthResponse>("/api/auth/register", data).then((r) => r.data),
    login: (data: { email: string; password: string }) =>
      http.post<AuthResponse>("/api/auth/login", data).then((r) => r.data),
    me: () =>
      http.get<{ success: boolean; data: AuthUser }>("/api/users/me").then((r) => r.data.data),
  },
  monitors: {
    list: () =>
      http.get<{ success: boolean; data: Monitor[] }>("/api/monitors").then((r) => r.data.data),
    create: (data: { name: string; url: string; intervalMinutes?: number }) =>
      http.post<{ success: boolean; data: Monitor }>("/api/monitors", data).then((r) => r.data.data),
    delete: (id: string) => http.delete(`/api/monitors/${id}`),
    checks: (id: string, limit = 50) =>
      http.get<{ success: boolean; data: Check[] }>(`/api/monitors/${id}/checks`, { params: { limit } }).then((r) => r.data.data),
    stats: (id: string, days = 7) =>
      http.get<{ success: boolean; data: MonitorStats }>(`/api/monitors/${id}/stats`, { params: { days } }).then((r) => r.data.data),
    incidents: (id: string) =>
      http.get<{ success: boolean; data: Incident[] }>(`/api/monitors/${id}/incidents`).then((r) => r.data.data),
  },
};

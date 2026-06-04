import axios from "axios";
import type { Monitor, Check, Incident, MonitorStats, SslCheckResult, HeadersCheckResult, AlertSettings, Agent, AgentWithKey, StatusPage, PublicStatusPage, ResponseTimeBucket, ResponseTimeRange, MaintenanceWindow, DashboardData, UpdateMonitorInput, AppNotification } from "@watchdog/shared-types";
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
    forgotPassword: (email: string) =>
      http.post<{ ok: boolean }>("/api/auth/forgot-password", { email }).then((r) => r.data),
    resetPassword: (token: string, password: string) =>
      http.post<{ ok: boolean }>("/api/auth/reset-password", { token, password }).then((r) => r.data),
    me: () =>
      http.get<{ success: boolean; data: AuthUser }>("/api/users/me").then((r) => r.data.data),
  },
  monitors: {
    list: () =>
      http.get<{ success: boolean; data: Monitor[] }>("/api/monitors").then((r) => r.data.data),
    create: (data: { name: string; url: string; intervalMinutes?: number }) =>
      http.post<{ success: boolean; data: Monitor }>("/api/monitors", data).then((r) => r.data.data),
    update: (id: string, data: UpdateMonitorInput) =>
      http.patch<{ success: boolean; data: Monitor }>(`/api/monitors/${id}`, data).then((r) => r.data.data),
    delete: (id: string) => http.delete(`/api/monitors/${id}`),
    checks: (id: string, limit = 50) =>
      http.get<{ success: boolean; data: Check[] }>(`/api/monitors/${id}/checks`, { params: { limit } }).then((r) => r.data.data),
    stats: (id: string, days = 7) =>
      http.get<{ success: boolean; data: MonitorStats }>(`/api/monitors/${id}/stats`, { params: { days } }).then((r) => r.data.data),
    incidents: (id: string) =>
      http.get<{ success: boolean; data: Incident[] }>(`/api/monitors/${id}/incidents`).then((r) => r.data.data),
    ssl: (id: string) =>
      http.get<{ success: boolean; data: SslCheckResult | null }>(`/api/monitors/${id}/ssl`).then((r) => r.data.data),
    headers: (id: string) =>
      http.get<{ success: boolean; data: HeadersCheckResult | null }>(`/api/monitors/${id}/headers`).then((r) => r.data.data),
    responseTimes: (id: string, range: ResponseTimeRange) =>
      http.get<{ success: boolean; data: ResponseTimeBucket[] }>(`/api/monitors/${id}/response-times`, { params: { range } }).then((r) => r.data.data),
    maintenance: {
      list: (id: string) =>
        http.get<{ success: boolean; data: MaintenanceWindow[] }>(`/api/monitors/${id}/maintenance`).then((r) => r.data.data),
      create: (id: string, data: { startsAt: string; endsAt: string; description?: string }) =>
        http.post<{ success: boolean; data: MaintenanceWindow }>(`/api/monitors/${id}/maintenance`, data).then((r) => r.data.data),
      delete: (monitorId: string, windowId: string) =>
        http.delete(`/api/monitors/${monitorId}/maintenance/${windowId}`),
    },
  },
  settings: {
    get: () =>
      http.get<{ success: boolean; data: AlertSettings }>("/api/users/me/settings").then((r) => r.data.data),
    update: (data: Partial<AlertSettings>) =>
      http.put<{ success: boolean; data: AlertSettings }>("/api/users/me/settings", data).then((r) => r.data.data),
    testWebhook: () =>
      http.post<{ success: boolean }>("/api/users/me/settings/test-webhook").then((r) => r.data),
  },
  agents: {
    list: () =>
      http.get<{ success: boolean; data: Agent[] }>("/api/agents").then((r) => r.data.data),
    create: (data: { name: string }) =>
      http.post<{ success: boolean; data: AgentWithKey }>("/api/agents", data).then((r) => r.data.data),
    delete: (id: string) => http.delete(`/api/agents/${id}`),
  },
  dashboard: {
    get: () =>
      http.get<{ success: boolean; data: DashboardData }>("/api/dashboard").then((r) => r.data.data),
  },
  notifications: {
    list: () =>
      http.get<{ success: boolean; data: AppNotification[] }>("/api/notifications").then((r) => r.data.data),
  },
  statusPages: {
    list: () =>
      http.get<{ success: boolean; data: (StatusPage & { monitors: { monitorId: string }[] })[] }>("/api/status-pages").then((r) => r.data.data),
    create: (data: { slug: string; title: string }) =>
      http.post<{ success: boolean; data: StatusPage }>("/api/status-pages", data).then((r) => r.data.data),
    delete: (id: string) => http.delete(`/api/status-pages/${id}`),
    setMonitors: (id: string, monitorIds: string[]) =>
      http.put(`/api/status-pages/${id}/monitors`, { monitorIds }),
    getPublic: (slug: string) =>
      http.get<{ success: boolean; data: PublicStatusPage }>(`/api/status/${slug}`).then((r) => r.data.data),
  },
};

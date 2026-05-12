import axios from "axios";
import type { Monitor } from "@watchdog/shared-types";

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "",
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const api = {
  auth: {
    register: (data: { email: string; password: string; name: string }) =>
      http.post<{ token: string; user: { id: string; email: string; name: string } }>("/api/auth/register", data).then((r) => r.data),
    login: (data: { email: string; password: string }) =>
      http.post<{ token: string; user: { id: string; email: string; name: string } }>("/api/auth/login", data).then((r) => r.data),
  },
  monitors: {
    list: () => http.get<{ success: boolean; data: Monitor[] }>("/api/monitors").then((r) => r.data.data),
    create: (data: { name: string; url: string; intervalMinutes?: number }) =>
      http.post<{ success: boolean; data: Monitor }>("/api/monitors", data).then((r) => r.data.data),
    delete: (id: string) => http.delete(`/api/monitors/${id}`),
  },
};

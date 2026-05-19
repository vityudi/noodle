import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8080",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface SetupStatus {
  complete: boolean;
  has_ai: boolean;
}

export const setupApi = {
  status: () => api.get<SetupStatus>("/api/setup/status").then((r) => r.data),
  createAdmin: (email: string, password: string) =>
    api.post<{ token: string }>("/api/setup/admin", { email, password }).then((r) => r.data),
  configureAI: (provider: string, api_key: string, model: string) =>
    api.post("/api/setup/ai", { provider, api_key, model }),
  skipAI: () => api.post("/api/setup/skip-ai"),
};

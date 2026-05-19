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

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

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

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string }>("/api/auth/login", { email, password }).then((r) => r.data),
};

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  description: string;
  created_at: string;
}

export const projectsApi = {
  list: () => api.get<Project[]>("/api/projects").then((r) => r.data),
  create: (data: { name: string; slug: string; description?: string }) =>
    api.post<Project>("/api/projects", data).then((r) => r.data),
  update: (id: string, data: { name?: string; description?: string }) =>
    api.put<Project>(`/api/projects/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/api/projects/${id}`),
};

export interface Flow {
  id: string;
  project_id: string;
  name: string;
  description: string;
  flow_json: object;
  created_at: string;
  updated_at: string;
}

export interface Credential {
  id: string;
  workspace_id: string;
  name: string;
  type: string;
  created_at: string;
}

export const credentialsApi = {
  list: () => api.get<Credential[]>("/api/credentials").then((r) => r.data),
  create: (data: { name: string; type: string; data: Record<string, string> }) =>
    api.post<Credential>("/api/credentials", data).then((r) => r.data),
  delete: (id: string) => api.delete(`/api/credentials/${id}`),
  reveal: (id: string) =>
    api.get<{ data: Record<string, string> }>(`/api/credentials/${id}/reveal`).then((r) => r.data),
};

export const flowsApi = {
  list: (projectId: string) =>
    api.get<Flow[]>(`/api/projects/${projectId}/flows`).then((r) => r.data),
  create: (projectId: string, data: { name: string; description?: string }) =>
    api.post<Flow>(`/api/projects/${projectId}/flows`, data).then((r) => r.data),
  update: (
    projectId: string,
    flowId: string,
    data: { name?: string; description?: string; flow_json?: object }
  ) => api.put<Flow>(`/api/projects/${projectId}/flows/${flowId}`, data).then((r) => r.data),
  delete: (projectId: string, flowId: string) =>
    api.delete(`/api/projects/${projectId}/flows/${flowId}`),
};

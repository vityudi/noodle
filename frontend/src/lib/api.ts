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
  flow_type: "tool" | "resource";
  resource_uri: string;
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

export interface ExecutionLog {
  id: string;
  flow_id: string;
  flow_name: string;
  input: unknown;
  output: unknown;
  error: string | null;
  duration_ms: number | null;
  executed_at: string;
}

export const logsApi = {
  list: (projectId: string) =>
    api.get<ExecutionLog[]>(`/api/projects/${projectId}/logs`).then((r) => r.data),
};

export interface AISettings {
  provider: string;
  model: string;
}

export const settingsApi = {
  getAI: () => api.get<AISettings>("/api/settings/ai").then((r) => r.data),
  updateAI: (data: { provider?: string; model?: string; api_key?: string }) =>
    api.put("/api/settings/ai", data).then((r) => r.data),
};

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  flow: object;
}

export const templatesApi = {
  list: () => api.get<FlowTemplate[]>("/api/templates").then((r) => r.data),
};

export const aiApi = {
  generate: (projectId: string, message: string, currentFlow?: object) =>
    api
      .post<{ flow: object }>(`/api/projects/${projectId}/ai/generate`, {
        message,
        current_flow: currentFlow ?? null,
      })
      .then((r) => r.data.flow),
};

export const credentialsApi = {
  list: (projectId: string) =>
    api.get<Credential[]>(`/api/projects/${projectId}/credentials`).then((r) => r.data),
  create: (projectId: string, data: { name: string; type: string; data: Record<string, string> }) =>
    api.post<Credential>(`/api/projects/${projectId}/credentials`, data).then((r) => r.data),
  delete: (projectId: string, id: string) =>
    api.delete(`/api/projects/${projectId}/credentials/${id}`),
  reveal: (projectId: string, id: string) =>
    api.get<{ data: Record<string, string> }>(`/api/projects/${projectId}/credentials/${id}/reveal`).then((r) => r.data),
};

export const flowsApi = {
  list: (projectId: string) =>
    api.get<Flow[]>(`/api/projects/${projectId}/flows`).then((r) => r.data),
  create: (projectId: string, data: { name: string; description?: string; flow_json?: object; flow_type?: string; resource_uri?: string }) =>
    api.post<Flow>(`/api/projects/${projectId}/flows`, data).then((r) => r.data),
  update: (
    projectId: string,
    flowId: string,
    data: { name?: string; description?: string; flow_json?: object; flow_type?: string; resource_uri?: string }
  ) => api.put<Flow>(`/api/projects/${projectId}/flows/${flowId}`, data).then((r) => r.data),
  delete: (projectId: string, flowId: string) =>
    api.delete(`/api/projects/${projectId}/flows/${flowId}`),
};

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export const mcpApi = {
  listTools: (slug: string) =>
    api.get<{ name: string; version: string; tools: MCPTool[] }>(`/mcp/${slug}`).then((r) => r.data),
  callTool: (slug: string, tool: string, input: Record<string, unknown>) =>
    api.post(`/mcp/${slug}/tools/call`, { tool, input }).then((r) => r.data),
  listResources: (slug: string) =>
    api.get<{ resources: MCPResource[] }>(`/mcp/${slug}/resources`).then((r) => r.data),
  readResource: (slug: string, uri: string) =>
    api.post(`/mcp/${slug}/resources/read`, { uri }).then((r) => r.data),
};

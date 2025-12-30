import { useAuthStore } from '../stores/auth-store';
import { AuthUser, Project } from '../types/api';
import type {
  ComponentBindingReference,
  PageBuilderState,
  PageDocument,
  PageDynamicInput,
  ProjectComponentDocument,
  ProjectGraphSnapshot
} from '../types/api';

interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface ApiFailure {
  success: false;
  error: {
    message: string;
    code?: string;
  };
}

type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

const resolveApiBaseUrl = () => {
  if (typeof window !== 'undefined' && window.__APP_API_BASE_URL__) {
    return window.__APP_API_BASE_URL__;
  }

  if (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) {
    return process.env.VITE_API_BASE_URL;
  }

  return 'http://localhost:3000';
};

const serialize = (body?: unknown) => (body ? JSON.stringify(body) : undefined);

const parseJson = async <T>(response: Response): Promise<ApiResponse<T> | undefined> => {
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return (await response.json()) as ApiResponse<T>;
  }
  return undefined;
};

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const state = useAuthStore.getState();
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (state.token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${state.token}`);
  }

  const response = await fetch(`${resolveApiBaseUrl()}${path}`, { ...init, headers });
  if (response.status === 204) {
    return {} as T;
  }

  const payload = await parseJson<T>(response);
  if (!response.ok) {
    const message = (payload as ApiFailure | undefined)?.error?.message ?? response.statusText;
    throw new Error(message || 'Something went wrong');
  }

  if (!payload) {
    throw new Error('Unexpected server response');
  }

  if (payload.success === false) {
    throw new Error(payload.error.message);
  }

  return payload.data;
}

export const authApi = {
  signup: (body: { email: string; password: string }) =>
    apiFetch<{ token: string; user: AuthUser }>('/auth/signup', {
      method: 'POST',
      body: serialize(body)
    }),
  login: (body: { email: string; password: string }) =>
    apiFetch<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: serialize(body)
    }),
  me: () => apiFetch<{ user: AuthUser }>('/auth/me')
};

export const projectsApi = {
  list: () => apiFetch<{ projects: Project[] }>('/projects'),
  create: (body: { name: string; description?: string }) =>
    apiFetch<{ project: Project }>('/projects', { method: 'POST', body: serialize(body) }),
  update: (projectId: string, body: { name?: string; description?: string }) =>
    apiFetch<{ project: Project }>(`/projects/${projectId}`, { method: 'PATCH', body: serialize(body) }),
  remove: (projectId: string) => apiFetch(`/projects/${projectId}`, { method: 'DELETE' })
};

export const projectGraphApi = {
  get: (projectId: string) => apiFetch<{ graph: ProjectGraphSnapshot }>(`/projects/${projectId}/graph`),
  save: (projectId: string, graph: ProjectGraphSnapshot) =>
    apiFetch<{ graph: ProjectGraphSnapshot }>(`/projects/${projectId}/graph`, {
      method: 'PUT',
      body: serialize(graph)
    })
};

type UpdatePagePayload = {
  name?: string;
  slug?: string;
  builderState?: PageBuilderState;
  dynamicInputs?: PageDynamicInput[];
};

export const projectPagesApi = {
  list: (projectId: string) => apiFetch<{ pages: PageDocument[] }>(`/projects/${projectId}/pages`),
  create: (projectId: string, body: { name: string; slug?: string }) =>
    apiFetch<{ page: PageDocument }>(`/projects/${projectId}/pages`, { method: 'POST', body: serialize(body) }),
  get: (projectId: string, pageId: string) =>
    apiFetch<{ page: PageDocument }>(`/projects/${projectId}/pages/${pageId}`),
  update: (projectId: string, pageId: string, body: UpdatePagePayload) =>
    apiFetch<{ page: PageDocument }>(`/projects/${projectId}/pages/${pageId}`, {
      method: 'PUT',
      body: serialize(body)
    })
};

type CreateComponentPayload = {
  name: string;
  slug?: string;
  definition: Record<string, unknown>;
  bindingReferences?: ComponentBindingReference[];
};

export const projectComponentsApi = {
  list: (projectId: string) =>
    apiFetch<{ components: ProjectComponentDocument[] }>(`/projects/${projectId}/components`),
  create: (projectId: string, body: CreateComponentPayload) =>
    apiFetch<{ component: ProjectComponentDocument }>(`/projects/${projectId}/components`, {
      method: 'POST',
      body: serialize(body)
    }),
  get: (projectId: string, componentId: string) =>
    apiFetch<{ component: ProjectComponentDocument }>(`/projects/${projectId}/components/${componentId}`)
};

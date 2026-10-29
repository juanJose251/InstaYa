import { demoRequest } from "./demoApi";

// Demo pública: sin servidor, los datos viven en el navegador (ver demoApi.ts).
export const DEMO = import.meta.env.VITE_DEMO === "true";

const TOKEN_KEY = "instaya_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  /** Cuerpo completo del error (p. ej. `errores` por fila en la importación) */
  data?: Record<string, unknown>;
  constructor(status: number, message: string, data?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (DEMO) {
    const body = typeof options.body === "string" ? JSON.parse(options.body) : undefined;
    try {
      return (await demoRequest(options.method ?? "GET", path, body)) as T;
    } catch (err) {
      const status = (err as { status?: number }).status ?? 500;
      const data = (err as { data?: Record<string, unknown> }).data;
      throw new ApiError(status, err instanceof Error ? err.message : "Error", data);
    }
  }

  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`/api${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
  }

  if (!res.ok) {
    let message = `Error ${res.status}`;
    let data: Record<string, unknown> | undefined;
    try {
      data = await res.json();
      message = (data?.message as string) ?? (data?.error as string) ?? message;
    } catch {
      // body no era JSON
    }
    throw new ApiError(res.status, message, data);
  }

  // DELETE devuelve 204 sin cuerpo
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
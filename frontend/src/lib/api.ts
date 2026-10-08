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
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (DEMO) {
    const body = typeof options.body === "string" ? JSON.parse(options.body) : undefined;
    try {
      return (await demoRequest(options.method ?? "GET", path, body)) as T;
    } catch (err) {
      const status = (err as { status?: number }).status ?? 500;
      throw new ApiError(status, err instanceof Error ? err.message : "Error");
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
    try {
      const body = await res.json();
      message = body.message ?? body.error ?? message;
    } catch {
      // body no era JSON
    }
    throw new ApiError(res.status, message);
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
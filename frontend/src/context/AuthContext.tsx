import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { api } from "../lib/api";
import { setToken, clearToken, getToken } from "../lib/api";
import type { AuthResponse, LoginInput, RegisterInput, Usuario, Empresa, Suscripcion, MeResponse } from "../types";

interface AuthContextValue {
  usuario: Usuario | null;
  empresa: Empresa | null;
  suscripcion: Suscripcion | null;
  cargando: boolean;
  esAdmin: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  /** Vuelve a leer usuario, empresa y plan (después de editar la empresa o renovar). */
  refrescar: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [suscripcion, setSuscripcion] = useState<Suscripcion | null>(null);
  const [cargando, setCargando] = useState(true);

  const refrescar = useCallback(async () => {
    const res = await api.get<MeResponse>("/usuarios/me");
    setUsuario(res.usuario);
    setEmpresa(res.empresa);
    setSuscripcion(res.suscripcion ?? null);
  }, []);

  useEffect(() => {
    async function restore() {
      if (!getToken()) {
        setCargando(false);
        return;
      }
      try {
        await refrescar();
      } catch {
        clearToken();
      } finally {
        setCargando(false);
      }
    }
    restore();
  }, [refrescar]);

  const aplicar = useCallback((res: AuthResponse) => {
    setToken(res.token);
    setUsuario(res.usuario);
    setEmpresa(res.empresa);
    setSuscripcion(res.suscripcion ?? null);
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    aplicar(await api.post<AuthResponse>("/auth/login", input));
  }, [aplicar]);

  const register = useCallback(async (input: RegisterInput) => {
    aplicar(await api.post<AuthResponse>("/auth/register", input));
  }, [aplicar]);

  const logout = useCallback(() => {
    clearToken();
    setUsuario(null);
    setEmpresa(null);
    setSuscripcion(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ usuario, empresa, suscripcion, cargando, esAdmin: usuario?.rol === "ADMIN", login, register, logout, refrescar }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  }
  return ctx;
}

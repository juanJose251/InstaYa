import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { api } from "../lib/api";
import { setToken, clearToken, getToken } from "../lib/api";
import type { AuthResponse, LoginInput, RegisterInput, Usuario, Empresa } from "../types";

interface AuthContextValue {
  usuario: Usuario | null;
  empresa: Empresa | null;
  cargando: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function restore() {
      if (!getToken()) {
        setCargando(false);
        return;
      }
      try {
        const res = await api.get<{ usuario: Usuario }>("/usuarios/me");
        setUsuario(res.usuario);
      } catch {
        clearToken();
      } finally {
        setCargando(false);
      }
    }
    restore();
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const res = await api.post<AuthResponse>("/auth/login", input);
    setToken(res.token);
    setUsuario(res.usuario);
    setEmpresa(res.empresa);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const res = await api.post<AuthResponse>("/auth/register", input);
    setToken(res.token);
    setUsuario(res.usuario);
    setEmpresa(res.empresa);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUsuario(null);
    setEmpresa(null);
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, empresa, cargando, login, register, logout }}>
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
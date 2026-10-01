import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface FetchState<T> {
  data: T | null;
  cargando: boolean;
  error: string;
  recargar: () => void;
}

export function useData<T>(path: string): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError("");
    api
      .get<T>(path)
      .then((res) => {
        if (activo) setData(res);
      })
      .catch((err) => {
        if (activo) setError(err instanceof Error ? err.message : "Error de conexión");
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [path, reloadKey]);

  return { data, cargando, error, recargar: () => setReloadKey((k) => k + 1) };
}
import { useEffect, useState } from "react";

/**
 * PWA: la app se puede instalar en el celular como si fuera nativa y abre sin conexión
 * (el service worker guarda la interfaz; los datos siguen viniendo del servidor).
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let pendiente: BeforeInstallPromptEvent | null = null;
const oyentes = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // se muestra nuestro botón en vez del aviso automático del navegador
    pendiente = e as BeforeInstallPromptEvent;
    oyentes.forEach((f) => f());
  });
  window.addEventListener("appinstalled", () => {
    pendiente = null;
    oyentes.forEach((f) => f());
  });
}

export function registrarServiceWorker() {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // sin service worker la app funciona igual, solo que no offline
    });
  });
}

export function useInstalarApp() {
  const [disponible, setDisponible] = useState(pendiente !== null);
  const instalada =
    typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches ?? false);

  useEffect(() => {
    const f = () => setDisponible(pendiente !== null);
    oyentes.add(f);
    return () => {
      oyentes.delete(f);
    };
  }, []);

  async function instalar() {
    if (!pendiente) return;
    await pendiente.prompt();
    await pendiente.userChoice;
    pendiente = null;
    setDisponible(false);
  }

  return { disponible, instalada, instalar };
}

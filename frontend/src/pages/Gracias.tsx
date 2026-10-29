import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import { DESCARGA_URL } from "../lib/sitio";

interface EstadoLicencia {
  lic: string;
  negocio: string;
  estado: "pendiente" | "activa" | "vencida";
  vence: string | null;
  clave: string | null;
}

const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-SV", { day: "numeric", month: "long", year: "numeric" });

/** Wompi regresa aquí después del pago. El aviso del pago (webhook) puede tardar unos segundos: se consulta hasta que llegue. */
export default function Gracias() {
  const [params] = useSearchParams();
  const lic = params.get("lic") ?? "";
  const [estado, setEstado] = useState<EstadoLicencia | null>(null);
  const [error, setError] = useState("");
  const [copiada, setCopiada] = useState(false);
  const [esperando, setEsperando] = useState(true);

  useEffect(() => {
    if (!lic) return;
    let intentos = 0;
    let timer: ReturnType<typeof setTimeout>;
    const consultar = async () => {
      try {
        const res = await fetch(`/.netlify/functions/licencia?lic=${encodeURIComponent(lic)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
        setEstado(data);
        if (data.estado === "activa") return setEsperando(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
      if (++intentos < 40) timer = setTimeout(consultar, 3000);
      else setEsperando(false);
    };
    consultar();
    return () => clearTimeout(timer);
  }, [lic]);

  async function copiar() {
    if (!estado?.clave) return;
    await navigator.clipboard.writeText(estado.clave);
    setCopiada(true);
  }

  const activa = estado?.estado === "activa" && estado.clave;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <Link to="/" className="text-sm font-semibold text-brand-700">
          ← Volver al inicio
        </Link>
        <div className="mt-4 rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
          {!lic && <Alert tone="warning">Falta el código de la licencia en el enlace.</Alert>}

          {lic && !activa && (
            <>
              <h1 className="text-xl font-black text-slate-900">{esperando ? "Confirmando tu pago..." : "Tu pago aún no se confirma"}</h1>
              <p className="mt-2 text-sm text-slate-600">
                {esperando
                  ? "Wompi nos avisa en unos segundos. No cierres esta página."
                  : "Si ya pagaste, recarga esta página en unos minutos. Guarda este enlace: aquí aparecerá tu clave."}
              </p>
              <p className="mt-3 text-sm text-slate-500">
                Licencia: <b className="font-mono">{lic}</b>
              </p>
              {error && (
                <div className="mt-3">
                  <Alert tone="warning">{error}</Alert>
                </div>
              )}
            </>
          )}

          {activa && (
            <>
              <h1 className="text-xl font-black text-green-700">¡Pago recibido! Gracias, {estado.negocio}</h1>
              <p className="mt-1 text-sm text-slate-600">Tu licencia está activa hasta el {fecha(estado.vence!)}.</p>

              <h2 className="mt-5 font-bold text-slate-900">1. Descarga e instala InstaYa!</h2>
              <a href={DESCARGA_URL} className="mt-2 block rounded-xl bg-brand-700 py-3 text-center font-bold text-white hover:bg-brand-800">
                Descargar para Windows
              </a>
              <p className="mt-1 text-xs text-slate-500">
                Si Windows muestra "editor desconocido", toca "Más información" → "Ejecutar de todas formas".
              </p>

              <h2 className="mt-5 font-bold text-slate-900">2. Activa tu licencia</h2>
              <p className="mt-1 text-sm text-slate-600">Abre InstaYa!, crea tu cuenta y ve a Más → Plan. Pega esta clave y toca "Activar":</p>
              <textarea
                readOnly
                value={estado.clave!}
                rows={4}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-mono text-xs break-all"
                data-testid="clave-licencia"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button variant="accent" fullWidth onClick={copiar}>
                {copiada ? "¡Copiada!" : "Copiar clave"}
              </Button>
              <p className="mt-4 text-xs text-slate-500">
                Guarda esta clave y el código <b className="font-mono">{estado.lic}</b>. Para renovar, en la app toca "Renovar" en Plan; la clave nueva se
                aplica sola cuando haya internet.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

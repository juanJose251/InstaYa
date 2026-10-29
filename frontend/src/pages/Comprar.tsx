import { FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import { PRECIOS } from "../lib/suscripcion";

/** Compra o renovación de la licencia: crea el enlace de pago de Wompi y lleva al cliente a pagar. */
export default function Comprar() {
  const [params] = useSearchParams();
  const lic = params.get("lic");
  const [negocio, setNegocio] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function pagar(e: FormEvent) {
    e.preventDefault();
    setError("");
    setEnviando(true);
    try {
      const res = await fetch("/.netlify/functions/comprar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lic ? { lic } : { negocio, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || `Error ${res.status}`);
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar el pago");
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md">
        <Link to="/" className="text-sm font-semibold text-brand-700">
          ← Volver al inicio
        </Link>
        <div className="mt-4 rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
          <p className="text-sm font-bold uppercase tracking-wide text-brand-700">{lic ? "Renovar licencia" : "Comprar licencia"}</p>
          <p className="mt-2">
            <span className="text-4xl font-black text-slate-900">${PRECIOS.mensual}</span>
            <span className="text-slate-500"> por un mes del plan Básico</span>
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Pagas con tarjeta de crédito o débito en Wompi. Al aprobarse el pago te mostramos tu <b>clave de licencia</b>; la pegas en
            InstaYa! → Más → Plan. Cada mes que renuevas, la app se actualiza sola.
          </p>

          <form onSubmit={pagar} className="mt-5 space-y-3">
            {lic ? (
              <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200">
                Licencia: <b className="font-mono">{lic}</b>
              </p>
            ) : (
              <>
                <label className="block text-sm font-semibold text-slate-700">
                  Nombre de tu negocio
                  <input
                    required
                    minLength={2}
                    value={negocio}
                    onChange={(e) => setNegocio(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal"
                    placeholder="Tienda Doña Marta"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Correo electrónico
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal"
                    placeholder="tucorreo@negocio.com"
                  />
                </label>
              </>
            )}
            {error && <Alert tone="error">{error}</Alert>}
            <Button type="submit" variant="accent" size="lg" fullWidth disabled={enviando}>
              {enviando ? "Abriendo Wompi..." : `Pagar $${PRECIOS.mensual} con tarjeta`}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-slate-500">Pago seguro procesado por Wompi El Salvador · Sin contratos</p>
        </div>
      </div>
    </div>
  );
}

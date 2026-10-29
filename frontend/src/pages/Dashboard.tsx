import { Link } from "react-router-dom";
import Card from "../components/ui/Card";
import Alert from "../components/ui/Alert";
import { useAuth } from "../context/AuthContext";
import { useData } from "../hooks/useData";
import { textoEstado } from "../lib/suscripcion";

const accesoRapido = [
  { to: "/app/productos", label: "Productos", desc: "Catálogo y stock", emoji: "▤" },
  { to: "/app/movimientos", label: "Movimientos", desc: "Entradas y salidas", emoji: "⇅" },
  { to: "/app/ventas", label: "Ventas", desc: "Registrar venta", emoji: "₵" },
  { to: "/app/catalogo", label: "Catálogo", desc: "Categorías y proveedores", emoji: "❖" },
  { to: "/app/reportes", label: "Reportes", desc: "Inventario y valor", emoji: "≡" },
];

interface Resumen {
  totalProductos: number;
  stockBajo: number;
  valorInventario: number;
  numeroVentas: number;
  totalVentas: number;
}

interface Reposicion {
  resumen: string;
  fuente: "ia" | "reglas";
  sugerencias: { productoId: string; nombre: string; stock: number; cantidadSugerida: number; diasCobertura: number | null }[];
}

export default function Dashboard() {
  const { usuario, empresa, suscripcion } = useAuth();
  const { data: resumen, error } = useData<Resumen>("/reportes/resumen?rango=hoy");
  const { data: repo } = useData<Reposicion>("/asistente/reposicion");
  const { data: bajos } = useData<{ productos: { id: string; nombre: string; stockActual: number; stockMinimo: number }[] }>(
    "/productos?bajoStock=true"
  );

  return (
    <div>
      <div className="mb-5 rounded-2xl bg-gradient-to-r from-brand-700 to-brand-500 p-5 text-white shadow-md">
        <p className="text-sm text-brand-100">Hola,</p>
        <h1 className="text-xl font-bold">{usuario?.nombre}</h1>
        <p className="mt-1 text-sm text-brand-100">
          {empresa?.nombre} · {usuario?.rol === "ADMIN" ? "Administrador" : "Empleado"}
        </p>
        {suscripcion && (
          <Link to="/app/plan" className="mt-2 inline-block rounded-full bg-white/15 px-3 py-1 text-xs hover:bg-white/25">
            {textoEstado(suscripcion)}
          </Link>
        )}
      </div>

      {error && (
        <div className="mb-4">
          <Alert tone="warning">No se pudo cargar el resumen: {error}</Alert>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-2xl font-bold text-brand-700" data-testid="kpi-productos">{resumen?.totalProductos ?? "–"}</p>
          <p className="text-xs text-slate-500">Productos</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-brand-700" data-testid="kpi-stock-bajo">{resumen?.stockBajo ?? "–"}</p>
          <p className="text-xs text-slate-500">Stock bajo</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-brand-700" data-testid="kpi-ventas-hoy">{resumen?.numeroVentas ?? "–"}</p>
          <p className="text-xs text-slate-500">Ventas hoy · ${(resumen?.totalVentas ?? 0).toFixed(2)}</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-accent-600">${(resumen?.valorInventario ?? 0).toFixed(2)}</p>
          <p className="text-xs text-slate-500">Valor inventario</p>
        </Card>
      </div>

      {bajos && bajos.productos.length > 0 && (
        <Card className="mt-4 ring-red-200">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-red-700">⚠ Alertas de stock</h2>
            <Link to="/app/productos" className="text-xs font-semibold text-brand-700">
              Ver todo →
            </Link>
          </div>
          <ul className="mt-2 space-y-1 text-sm" data-testid="alertas-stock">
            {bajos.productos.slice(0, 5).map((p) => (
              <li key={p.id} className="flex justify-between gap-3">
                <span className="truncate">{p.nombre}</span>
                <span className={`shrink-0 font-semibold ${p.stockActual === 0 ? "text-red-700" : "text-accent-700"}`}>
                  {p.stockActual === 0 ? "agotado" : `${p.stockActual} u.`}
                  <span className="ml-1 text-xs font-normal text-slate-500">(mín. {p.stockMinimo})</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {repo && (
        <Card className="mt-4" >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Asistente de reposición</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {repo.fuente === "ia" ? "IA" : "Reglas"}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-800" data-testid="asistente-resumen">{repo.resumen}</p>
          {repo.sugerencias.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {repo.sugerencias.slice(0, 5).map((s) => (
                <li key={s.productoId} className="flex justify-between">
                  <span className="truncate">{s.nombre}</span>
                  <span className="font-semibold text-accent-600">
                    pedir {s.cantidadSugerida}
                    <span className="ml-1 text-xs font-normal text-slate-500">
                      ({s.diasCobertura === null ? "sin ventas" : `alcanza ${s.diasCobertura} d`})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <h2 className="mt-6 mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Acceso rápido</h2>
      <div className="grid grid-cols-2 gap-3">
        {accesoRapido.map((item) => (
          <Link key={item.to} to={item.to}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <div className="text-2xl text-brand-600">{item.emoji}</div>
              <p className="mt-2 font-semibold text-slate-900">{item.label}</p>
              <p className="text-xs text-slate-500">{item.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";
import Card from "../components/ui/Card";
import { useAuth } from "../context/AuthContext";

const accesoRapido = [
  { to: "/app/productos", label: "Productos", desc: "Catálogo y stock", emoji: "▤" },
  { to: "/app/movimientos", label: "Movimientos", desc: "Entradas y salidas", emoji: "⇅" },
  { to: "/app/ventas", label: "Ventas", desc: "Registrar venta", emoji: "₵" },
  { to: "/app/reportes", label: "Reportes", desc: "Inventario y valor", emoji: "≡" },
];

export default function Dashboard() {
  const { usuario, empresa } = useAuth();

  return (
    <div>
      <div className="mb-5 rounded-2xl bg-gradient-to-r from-brand-700 to-brand-500 p-5 text-white shadow-md">
        <p className="text-sm text-brand-100">Hola,</p>
        <h1 className="text-xl font-bold">{usuario?.nombre}</h1>
        <p className="mt-1 text-sm text-brand-100">
          {empresa?.nombre} · {usuario?.rol === "ADMIN" ? "Administrador" : "Empleado"}
        </p>
        {empresa?.trialFin && (
          <p className="mt-2 inline-block rounded-full bg-white/15 px-3 py-1 text-xs">
            Prueba gratuita hasta el {new Date(empresa.trialFin).toLocaleDateString("es-SV")}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-2xl font-bold text-brand-700">0</p>
          <p className="text-xs text-slate-500">Productos</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-brand-700">0</p>
          <p className="text-xs text-slate-500">Stock bajo</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-brand-700">0</p>
          <p className="text-xs text-slate-500">Ventas hoy</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-accent-600">$0.00</p>
          <p className="text-xs text-slate-500">Valor inventario</p>
        </Card>
      </div>

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
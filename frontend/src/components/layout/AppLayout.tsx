import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ReactNode } from "react";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

const navItems: NavItem[] = [
  { to: "/app", label: "Inicio", end: true, icon: <span>⌂</span> },
  { to: "/app/productos", label: "Productos", icon: <span>▤</span> },
  { to: "/app/movimientos", label: "Movimientos", icon: <span>⇅</span> },
  { to: "/app/ventas", label: "Ventas", icon: <span>₵</span> },
  { to: "/app/config", label: "Más", icon: <span>☰</span> },
];

export default function AppLayout() {
  const { usuario, empresa, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 bg-brand-700 text-white shadow-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div>
            <div className="text-base font-bold leading-tight">InstaYa!</div>
            <div className="text-[11px] text-brand-100 truncate max-w-[200px]">
              {empresa?.nombre ?? ""}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold">{usuario?.nombre}</div>
              <div className="text-[11px] text-brand-100">{usuario?.rol === "ADMIN" ? "Administrador" : "Empleado"}</div>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-24 pt-5">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-20 border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                  isActive ? "text-brand-700" : "text-slate-500"
                }`
              }
            >
              <span className="text-xl leading-none">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
import { ReactNode } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Productos from "./pages/Productos";
import Movimientos from "./pages/Movimientos";
import Ventas from "./pages/Ventas";
import Reportes from "./pages/Reportes";
import Configuracion from "./pages/Configuracion";

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-700">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
          <span className="text-2xl font-black text-accent-400">I!</span>
        </div>
        <p className="text-sm text-brand-100">Cargando...</p>
      </div>
    </div>
  );
}

function Protected({ children }: { children: ReactNode }) {
  const { usuario, cargando } = useAuth();
  const location = useLocation();

  if (cargando) return <Splash />;
  if (!usuario) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Register />} />
      <Route
        path="/app"
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="productos" element={<Productos />} />
        <Route path="movimientos" element={<Movimientos />} />
        <Route path="ventas" element={<Ventas />} />
        <Route path="reportes" element={<Reportes />} />
        <Route path="config" element={<Configuracion />} />
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
import { ReactNode, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Landing from "./pages/Landing";
import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Productos from "./pages/Productos";
import Movimientos from "./pages/Movimientos";
import Ventas from "./pages/Ventas";
import Reportes from "./pages/Reportes";
import Configuracion from "./pages/Configuracion";
import Catalogo from "./pages/Catalogo";
import Equipo from "./pages/Equipo";
import Plan from "./pages/Plan";
import Comprar from "./pages/Comprar";
import Gracias from "./pages/Gracias";
import { LOCAL } from "./lib/sitio";

// La importación se usa pocas veces (lector de Excel incluido): se carga aparte para no pesar en el arranque
const Importar = lazy(() => import("./pages/Importar"));

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
      {/* En la app instalada no hay página de venta: se entra directo al panel */}
      <Route path="/" element={LOCAL ? <Navigate to="/app" replace /> : <Landing />} />
      <Route path="/comprar" element={<Comprar />} />
      <Route path="/gracias" element={<Gracias />} />
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
        <Route
          path="importar"
          element={
            <Suspense fallback={<p className="py-8 text-center text-sm text-slate-500">Cargando...</p>}>
              <Importar />
            </Suspense>
          }
        />
        <Route path="movimientos" element={<Movimientos />} />
        <Route path="ventas" element={<Ventas />} />
        <Route path="catalogo" element={<Catalogo />} />
        <Route path="reportes" element={<Reportes />} />
        <Route path="equipo" element={<Equipo />} />
        <Route path="plan" element={<Plan />} />
        <Route path="config" element={<Configuracion />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

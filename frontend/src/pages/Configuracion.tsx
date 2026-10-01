import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";

export default function Configuracion() {
  const { usuario, empresa, logout } = useAuth();

  return (
    <div>
      <PageHeader title="Configuración" subtitle="Tu cuenta y empresa" />

      <div className="space-y-4">
        <Card>
          <h2 className="mb-3 font-bold text-slate-900">Mi cuenta</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Nombre</dt>
              <dd className="font-semibold text-slate-900">{usuario?.nombre}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Correo</dt>
              <dd className="font-semibold text-slate-900">{usuario?.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Rol</dt>
              <dd className="font-semibold text-slate-900">
                {usuario?.rol === "ADMIN" ? "Administrador" : "Empleado"}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 font-bold text-slate-900">Mi empresa</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Nombre</dt>
              <dd className="font-semibold text-slate-900">{empresa?.nombre}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Prueba gratuita</dt>
              <dd className="font-semibold text-slate-900">
                {empresa?.trialFin
                  ? `hasta ${new Date(empresa.trialFin).toLocaleDateString("es-SV")}`
                  : "—"}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 font-bold text-slate-900">Seguridad</h2>
          <p className="mb-4 text-sm text-slate-500">
            Tu información está aislada por empresa (multi-tenant). Cierra sesión al usar un
            dispositivo compartido.
          </p>
          <Button variant="danger" fullWidth onClick={logout}>
            Cerrar sesión
          </Button>
        </Card>
      </div>
    </div>
  );
}
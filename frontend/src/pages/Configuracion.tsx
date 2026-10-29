import { useState, FormEvent, useEffect } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Alert from "../components/ui/Alert";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { textoEstado } from "../lib/suscripcion";
import { useInstalarApp } from "../lib/pwa";

const menu = [
  { to: "/app/plan", label: "Plan y facturación", desc: "Prueba gratuita, precio y pagos", icon: "★", admin: false },
  { to: "/app/equipo", label: "Equipo", desc: "Usuarios, roles y accesos", icon: "☺", admin: true },
  { to: "/app/catalogo", label: "Categorías y proveedores", desc: "Organiza tu catálogo", icon: "❖", admin: false },
  { to: "/app/importar", label: "Importar inventario", desc: "Carga masiva desde Excel", icon: "⇪", admin: true },
  { to: "/app/reportes", label: "Reportes", desc: "Ventas, valor y más vendidos", icon: "≡", admin: false },
];

export default function Configuracion() {
  const { usuario, empresa, suscripcion, esAdmin, logout, refrescar } = useAuth();
  const { disponible, instalada, instalar } = useInstalarApp();
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ nombre: "", giro: "", direccion: "", telefono: "" });
  const [msg, setMsg] = useState<{ tono: "success" | "error"; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (empresa) {
      setForm({ nombre: empresa.nombre, giro: empresa.giro ?? "", direccion: empresa.direccion ?? "", telefono: empresa.telefono ?? "" });
    }
  }, [empresa]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setMsg(null);
    try {
      await api.put("/empresa", form);
      await refrescar();
      setEditando(false);
      setMsg({ tono: "success", texto: "Datos de la empresa actualizados." });
    } catch (err) {
      setMsg({ tono: "error", texto: err instanceof Error ? err.message : "No se pudo guardar" });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <PageHeader title="Más" subtitle="Tu cuenta, tu empresa y tu plan" />

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2">
          {menu
            .filter((m) => !m.admin || esAdmin)
            .map((m) => (
              <Link key={m.to} to={m.to}>
                <Card className="flex items-center gap-3 transition-shadow hover:shadow-md">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg text-brand-700">{m.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{m.label}</p>
                    <p className="truncate text-xs text-slate-500">
                      {m.to === "/app/plan" && suscripcion ? textoEstado(suscripcion) : m.desc}
                    </p>
                  </div>
                  <span className="text-slate-300">›</span>
                </Card>
              </Link>
            ))}
        </div>

        {!instalada && disponible && (
          <Card className="flex items-center justify-between gap-3 bg-brand-50 ring-brand-200">
            <div>
              <p className="font-semibold text-brand-900">Instala InstaYa! en este dispositivo</p>
              <p className="text-xs text-brand-800">Ábrela desde tu pantalla de inicio, como una app.</p>
            </div>
            <Button size="sm" onClick={instalar}>
              Instalar
            </Button>
          </Card>
        )}

        {msg && <Alert tone={msg.tono}>{msg.texto}</Alert>}

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Mi empresa</h2>
            {esAdmin && !editando && !suscripcion?.soloLectura && (
              <button className="text-sm font-semibold text-brand-700" onClick={() => setEditando(true)}>
                Editar
              </button>
            )}
          </div>
          {editando ? (
            <form onSubmit={guardar} className="space-y-3">
              <Input label="Nombre del negocio" required minLength={2} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              <Input label="Giro" value={form.giro} onChange={(e) => setForm({ ...form, giro: e.target.value })} placeholder="abarrotes, ferretería..." />
              <Input label="Dirección" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
              <Input label="Teléfono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="ghost" onClick={() => setEditando(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={guardando}>
                  {guardando ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </form>
          ) : (
            <dl className="space-y-2 text-sm">
              {[
                ["Nombre", empresa?.nombre],
                ["Giro", empresa?.giro],
                ["Dirección", empresa?.direccion],
                ["Teléfono", empresa?.telefono],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="text-right font-semibold text-slate-900">{v || "—"}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>

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
              <dd className="font-semibold text-slate-900">{esAdmin ? "Administrador" : "Empleado"}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 font-bold text-slate-900">Seguridad</h2>
          <p className="mb-4 text-sm text-slate-500">
            Tu información está aislada por empresa (multi-tenant): ningún otro negocio puede verla. Cierra sesión al usar un
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

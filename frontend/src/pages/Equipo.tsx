import { useState, FormEvent } from "react";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Alert from "../components/ui/Alert";
import { useData } from "../hooks/useData";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import type { Role } from "../types";

interface Miembro {
  id: string;
  nombre: string;
  email: string;
  rol: Role;
  activo: boolean;
}

const vacio = { nombre: "", email: "", password: "", rol: "EMPLEADO" as Role };

/** Usuarios del negocio: el plan contempla "múltiples usuarios simultáneos con roles y permisos". */
export default function Equipo() {
  const { usuario, esAdmin, suscripcion } = useAuth();
  const { data, cargando, error, recargar } = useData<{ usuarios: Miembro[] }>("/usuarios");
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState(vacio);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ tono: "success" | "error"; texto: string } | null>(null);
  const [claveDe, setClaveDe] = useState<string | null>(null);
  const [nuevaClave, setNuevaClave] = useState("");

  const puedeEditar = esAdmin && !suscripcion?.soloLectura;

  async function crear(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setMsg(null);
    try {
      await api.post("/usuarios", form);
      setMsg({ tono: "success", texto: `${form.nombre} ya puede entrar con ${form.email}.` });
      setForm(vacio);
      setAbierto(false);
      recargar();
    } catch (err) {
      setMsg({ tono: "error", texto: err instanceof Error ? err.message : "No se pudo crear" });
    } finally {
      setGuardando(false);
    }
  }

  async function actualizar(m: Miembro, cambios: Partial<Miembro> & { password?: string }, texto: string) {
    setMsg(null);
    try {
      await api.put(`/usuarios/${m.id}`, cambios);
      setMsg({ tono: "success", texto });
      recargar();
      return true;
    } catch (err) {
      setMsg({ tono: "error", texto: err instanceof Error ? err.message : "No se pudo actualizar" });
      return false;
    }
  }

  if (!esAdmin) {
    return (
      <div>
        <PageHeader title="Equipo" />
        <Alert tone="info">Solo el administrador del negocio puede gestionar usuarios.</Alert>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Equipo"
        subtitle="Quién usa InstaYa! en tu negocio"
        action={puedeEditar ? <Button onClick={() => setAbierto((v) => !v)}>{abierto ? "Cerrar" : "+ Usuario"}</Button> : undefined}
      />

      <Card className="mb-4 bg-slate-50">
        <p className="text-xs text-slate-600">
          <b>Administrador:</b> todo, incluidos precios, productos, importación y equipo. <b>Empleado:</b> registra ventas y
          movimientos y consulta reportes, pero no cambia el catálogo.
        </p>
      </Card>

      {msg && (
        <div className="mb-4">
          <Alert tone={msg.tono}>{msg.texto}</Alert>
        </div>
      )}

      {abierto && (
        <form onSubmit={crear} className="mb-5">
          <Card>
            <h2 className="mb-4 font-bold text-slate-900">Nuevo usuario</h2>
            <div className="space-y-4">
              <Input label="Nombre" required minLength={2} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Carlos (cajero)" />
              <Input label="Correo" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="cajero@tunegocio.com" />
              <Input
                label="Contraseña inicial"
                type="text"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Mínimo 6 caracteres"
              />
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Rol
                <select
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                  value={form.rol}
                  onChange={(e) => setForm({ ...form, rol: e.target.value as Role })}
                >
                  <option value="EMPLEADO">Empleado</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </label>
              <Button type="submit" fullWidth disabled={guardando}>
                {guardando ? "Creando..." : "Crear usuario"}
              </Button>
            </div>
          </Card>
        </form>
      )}

      {error && <Alert tone="warning">No se pudo cargar el equipo: {error}</Alert>}
      {cargando && <p className="py-6 text-center text-sm text-slate-500">Cargando...</p>}

      <div className="space-y-3">
        {data?.usuarios.map((m) => {
          const soyYo = m.id === usuario?.id;
          return (
            <Card key={m.id} className={m.activo ? "" : "opacity-60"}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">
                    {m.nombre} {soyYo && <span className="text-xs font-normal text-slate-500">(tú)</span>}
                  </p>
                  <p className="truncate text-xs text-slate-500">{m.email}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${m.rol === "ADMIN" ? "bg-brand-100 text-brand-800" : "bg-slate-100 text-slate-700"}`}>
                    {m.rol === "ADMIN" ? "Administrador" : "Empleado"}
                  </span>
                  {!m.activo && <span className="text-[11px] font-semibold text-red-600">Desactivado</span>}
                </div>
              </div>
              {puedeEditar && !soyYo && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => actualizar(m, { rol: m.rol === "ADMIN" ? "EMPLEADO" : "ADMIN" }, `Rol de ${m.nombre} actualizado.`)}
                  >
                    {m.rol === "ADMIN" ? "Hacer empleado" : "Hacer administrador"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => actualizar(m, { activo: !m.activo }, m.activo ? `${m.nombre} ya no puede entrar.` : `${m.nombre} puede volver a entrar.`)}
                  >
                    {m.activo ? "Desactivar" : "Reactivar"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setClaveDe(claveDe === m.id ? null : m.id); setNuevaClave(""); }}>
                    Cambiar contraseña
                  </Button>
                  {claveDe === m.id && (
                    <form
                      className="flex w-full gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (await actualizar(m, { password: nuevaClave }, `Contraseña de ${m.nombre} cambiada.`)) setClaveDe(null);
                      }}
                    >
                      <input
                        aria-label={`Nueva contraseña para ${m.nombre}`}
                        className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        minLength={6}
                        required
                        value={nuevaClave}
                        onChange={(e) => setNuevaClave(e.target.value)}
                        placeholder="Nueva contraseña"
                      />
                      <Button size="sm" type="submit">
                        Guardar
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

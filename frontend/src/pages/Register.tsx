import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Alert from "../components/ui/Alert";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    empresa: "",
    giro: "",
    nombre: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      await register({
        empresa: { nombre: form.empresa, giro: form.giro || undefined },
        admin: { nombre: form.nombre, email: form.email, password: form.password },
      });
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la cuenta");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-brand-700 to-brand-900">
      <div className="flex-1 flex flex-col justify-center px-6 py-12 max-w-md w-full mx-auto">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-white">Crea tu cuenta</h1>
          <p className="text-brand-100 mt-1 text-sm">Prueba gratis 15 días, sin tarjeta</p>
        </div>

        <form onSubmit={onSubmit} className="rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Datos de la empresa</h2>
          {error && (
            <div className="mb-4">
              <Alert tone="error">{error}</Alert>
            </div>
          )}
          <div className="space-y-4">
            <Input
              label="Nombre de la empresa"
              required
              minLength={2}
              placeholder="Abarrotes El Vecino"
              value={form.empresa}
              onChange={(e) => set("empresa", e.target.value)}
            />
            <Input
              label="Giro (opcional)"
              placeholder="abarrotes, ferretería, boutique..."
              value={form.giro}
              onChange={(e) => set("giro", e.target.value)}
            />

            <div className="my-5 h-px bg-slate-200" />
            <h2 className="text-lg font-bold text-slate-900">Tu cuenta de administrador</h2>

            <Input
              label="Tu nombre"
              required
              minLength={2}
              placeholder="Juan Fuentes"
              value={form.nombre}
              onChange={(e) => set("nombre", e.target.value)}
            />
            <Input
              label="Correo electrónico"
              type="email"
              required
              autoComplete="email"
              placeholder="tucorreo@empresa.com"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
            <Input
              label="Contraseña"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Mínimo 6 caracteres"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
            />
            <Button type="submit" fullWidth size="lg" disabled={cargando}>
              {cargando ? "Creando cuenta..." : "Crear cuenta gratis"}
            </Button>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-brand-100">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="font-semibold text-accent-300 underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
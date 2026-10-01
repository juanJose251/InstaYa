import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Alert from "../components/ui/Alert";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      await login({ email, password });
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-brand-700 to-brand-900">
      <div className="flex-1 flex flex-col justify-center px-6 py-12 max-w-md w-full mx-auto">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
            <span className="text-3xl font-black text-accent-400">I!</span>
          </div>
          <h1 className="text-2xl font-bold text-white">InstaYa!</h1>
          <p className="text-brand-100 mt-1 text-sm">Tu inventario al día, desde el celular</p>
        </div>

        <form onSubmit={onSubmit} className="rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Iniciar sesión</h2>
          {error && (
            <div className="mb-4">
              <Alert tone="error">{error}</Alert>
            </div>
          )}
          <div className="space-y-4">
            <Input
              label="Correo electrónico"
              type="email"
              required
              autoComplete="email"
              placeholder="tucorreo@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Contraseña"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" fullWidth size="lg" disabled={cargando}>
              {cargando ? "Entrando..." : "Entrar"}
            </Button>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-brand-100">
          ¿Aún no tienes cuenta?{" "}
          <Link to="/registro" className="font-semibold text-accent-300 underline">
            Crea tu empresa gratis
          </Link>
        </p>
      </div>
    </div>
  );
}
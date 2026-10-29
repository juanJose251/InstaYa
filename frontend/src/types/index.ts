export type Role = "ADMIN" | "EMPLEADO";

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Role;
  empresaId?: string;
}

export interface Empresa {
  id: string;
  nombre: string;
  giro?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  trialFin?: string | null;
  plan?: "PRUEBA" | "BASICO";
  suscripcionFin?: string | null;
}

export interface Suscripcion {
  plan: "PRUEBA" | "BASICO";
  estado: "PRUEBA" | "ACTIVA" | "VENCIDA";
  venceEl: string | null;
  diasRestantes: number | null;
  soloLectura: boolean;
}

export interface AuthResponse {
  token: string;
  usuario: Usuario;
  empresa: Empresa;
  suscripcion?: Suscripcion;
}

export interface MeResponse {
  usuario: Usuario;
  empresa: Empresa | null;
  suscripcion?: Suscripcion;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  empresa: {
    nombre: string;
    giro?: string;
    direccion?: string;
    telefono?: string;
  };
  admin: {
    nombre: string;
    email: string;
    password: string;
  };
}

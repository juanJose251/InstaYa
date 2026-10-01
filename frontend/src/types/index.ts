export type Role = "ADMIN" | "EMPLEADO";

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Role;
}

export interface Empresa {
  id: string;
  nombre: string;
  trialFin?: string;
}

export interface AuthResponse {
  token: string;
  usuario: Usuario;
  empresa: Empresa;
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
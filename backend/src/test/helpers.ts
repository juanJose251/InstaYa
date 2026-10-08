import { vi } from "vitest";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

/**
 * Doble de Prisma para pruebas: sin base de datos.
 * `$transaction` ejecuta el callback con el mismo doble, igual que `tx` en producción.
 */
function model() {
  return {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  };
}

export const prismaMock = {
  usuario: model(),
  empresa: model(),
  producto: model(),
  movimientoStock: model(),
  venta: model(),
  categoria: model(),
  proveedor: model(),
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
};

export function resetPrismaMock() {
  for (const value of Object.values(prismaMock)) {
    if (typeof value === "function") {
      (value as ReturnType<typeof vi.fn>).mockReset();
    } else {
      Object.values(value).forEach((fn) => fn.mockReset());
    }
  }
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prismaMock));
}

export interface TestUser {
  id: string;
  empresaId: string;
  email: string;
  nombre: string;
  rol: "ADMIN" | "EMPLEADO";
}

export const adminA: TestUser = {
  id: "user-a",
  empresaId: "empresa-a",
  email: "admin@a.com",
  nombre: "Admin A",
  rol: "ADMIN",
};

export const empleadoA: TestUser = { ...adminA, id: "user-a2", email: "emp@a.com", nombre: "Empleado A", rol: "EMPLEADO" };

/** Genera un token válido y hace que `authenticate` encuentre al usuario en la "BD". */
export function loginAs(user: TestUser) {
  prismaMock.usuario.findFirst.mockResolvedValueOnce({ ...user, empresa: { activa: true } });
  // Se firma aquí (no con signToken) para que helpers no importe middleware/auth,
  // que a su vez importa el prisma que estamos mockeando (dependencia circular).
  const token = jwt.sign({ sub: user.id, empresaId: user.empresaId, email: user.email, nombre: user.nombre, rol: user.rol }, env.jwtSecret);
  return `Bearer ${token}`;
}

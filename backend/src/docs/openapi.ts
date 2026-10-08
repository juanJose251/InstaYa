import { Router } from "express";
import swaggerUi from "swagger-ui-express";

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const auth = [{ bearerAuth: [] }];
const ok = (schema: object, description = "OK") => ({ description, content: { "application/json": { schema } } });
const idParam = { name: "id", in: "path", required: true, schema: { type: "string" } };
const rangoParam = { name: "rango", in: "query", schema: { type: "string", enum: ["hoy", "semana", "mes"] } };

const crudList = (tag: string, plural: string, schema: string, parameters: object[] = []) => ({
  tags: [tag],
  summary: `Listar ${plural}`,
  security: auth,
  parameters,
  responses: { 200: ok({ type: "object", properties: { [plural]: { type: "array", items: ref(schema) } } }) },
});

const crudCreate = (tag: string, schema: string, adminOnly: boolean) => ({
  tags: [tag],
  summary: adminOnly ? "Crear (solo ADMIN)" : "Crear",
  security: auth,
  requestBody: { required: true, content: { "application/json": { schema: ref(schema) } } },
  responses: {
    201: { description: "Creado" },
    400: { description: "Datos inválidos" },
    403: { description: "Sin permiso" },
    409: { description: "Valor único repetido" },
  },
});

const byId = (tag: string, schema: string) => ({
  put: {
    tags: [tag],
    summary: "Actualizar (solo ADMIN)",
    security: auth,
    parameters: [idParam],
    requestBody: { content: { "application/json": { schema: ref(schema) } } },
    responses: { 200: { description: "Actualizado" }, 404: { description: "No existe en tu empresa" } },
  },
  delete: {
    tags: [tag],
    summary: "Eliminar (solo ADMIN)",
    security: auth,
    parameters: [idParam],
    responses: { 204: { description: "Eliminado" }, 404: { description: "No existe en tu empresa" } },
  },
});

export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "InstaYa! API",
    version: "1.0.0",
    description:
      "API REST multi-tenant de inventarios para PYMES. Todas las rutas (salvo auth y health) exigen JWT y filtran por la empresa del token.",
  },
  servers: [{ url: "/api" }],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    schemas: {
      Producto: {
        type: "object",
        required: ["nombre", "precioCompra", "precioVenta"],
        properties: {
          nombre: { type: "string" },
          sku: { type: "string" },
          descripcion: { type: "string" },
          categoriaId: { type: "string" },
          proveedorId: { type: "string" },
          precioCompra: { type: "number" },
          precioVenta: { type: "number" },
          stockMinimo: { type: "integer" },
        },
      },
      Categoria: { type: "object", required: ["nombre"], properties: { nombre: { type: "string" }, descripcion: { type: "string" } } },
      Proveedor: {
        type: "object",
        required: ["nombre"],
        properties: { nombre: { type: "string" }, telefono: { type: "string" }, email: { type: "string", format: "email" }, direccion: { type: "string" } },
      },
      Movimiento: {
        type: "object",
        required: ["productoId", "tipo", "cantidad"],
        properties: {
          productoId: { type: "string" },
          tipo: { type: "string", enum: ["ENTRADA", "SALIDA", "AJUSTE"] },
          cantidad: { type: "integer" },
          motivo: { type: "string" },
        },
      },
      Venta: {
        type: "object",
        description: "Con `items` descuenta stock y calcula el total en el servidor; sin `items` es una venta rápida con total manual.",
        properties: {
          cliente: { type: "string" },
          total: { type: "number" },
          items: {
            type: "array",
            items: {
              type: "object",
              required: ["productoId", "cantidad"],
              properties: { productoId: { type: "string" }, cantidad: { type: "integer", minimum: 1 } },
            },
          },
        },
      },
      Sugerencia: {
        type: "object",
        properties: {
          productoId: { type: "string" },
          nombre: { type: "string" },
          stock: { type: "integer" },
          minimo: { type: "integer" },
          ventasPorDia: { type: "number" },
          diasCobertura: { type: "number", nullable: true },
          cantidadSugerida: { type: "integer" },
          motivo: { type: "string", enum: ["SIN_STOCK", "BAJO_MINIMO", "SE_ACABA_PRONTO"] },
        },
      },
    },
  },
  paths: {
    "/health": { get: { tags: ["Sistema"], summary: "Health check", responses: { 200: { description: "OK" } } } },
    "/auth/register": {
      post: { tags: ["Auth"], summary: "Registrar empresa + administrador", responses: { 201: { description: "Creado, devuelve token" }, 429: { description: "Demasiados intentos" } } },
    },
    "/auth/login": {
      post: { tags: ["Auth"], summary: "Iniciar sesión", responses: { 200: { description: "Devuelve token" }, 401: { description: "Credenciales inválidas" }, 429: { description: "Demasiados intentos" } } },
    },
    "/usuarios/me": { get: { tags: ["Usuarios"], summary: "Usuario actual", security: auth, responses: { 200: { description: "OK" } } } },
    "/productos": {
      get: crudList("Productos", "productos", "Producto", [
        { name: "q", in: "query", schema: { type: "string" } },
        { name: "bajoStock", in: "query", schema: { type: "boolean" } },
      ]),
      post: crudCreate("Productos", "Producto", true),
    },
    "/productos/{id}": byId("Productos", "Producto"),
    "/categorias": { get: crudList("Categorías", "categorias", "Categoria"), post: crudCreate("Categorías", "Categoria", true) },
    "/categorias/{id}": byId("Categorías", "Categoria"),
    "/proveedores": { get: crudList("Proveedores", "proveedores", "Proveedor"), post: crudCreate("Proveedores", "Proveedor", true) },
    "/proveedores/{id}": byId("Proveedores", "Proveedor"),
    "/movimientos": { get: crudList("Movimientos", "movimientos", "Movimiento"), post: crudCreate("Movimientos", "Movimiento", false) },
    "/ventas": { get: crudList("Ventas", "ventas", "Venta"), post: crudCreate("Ventas", "Venta", false) },
    "/ventas/{id}/anular": {
      post: {
        tags: ["Ventas"],
        summary: "Anular venta y reponer stock",
        security: auth,
        parameters: [idParam],
        responses: { 200: { description: "Anulada" }, 409: { description: "Ya estaba anulada" } },
      },
    },
    "/reportes/resumen": {
      get: { tags: ["Reportes"], summary: "Resumen de ventas e inventario", security: auth, parameters: [rangoParam], responses: { 200: { description: "OK" } } },
    },
    "/reportes/top-productos": {
      get: {
        tags: ["Reportes"],
        summary: "Top 5 productos más vendidos (SQL con JOIN y GROUP BY)",
        security: auth,
        parameters: [rangoParam],
        responses: { 200: { description: "OK" } },
      },
    },
    "/asistente/reposicion": {
      get: {
        tags: ["Asistente IA"],
        summary: "Sugerencias de reposición según el ritmo de ventas de 30 días",
        description:
          "Las cantidades salen de una regla determinista. Si hay ANTHROPIC_API_KEY, un LLM redacta el resumen; si no, se usa un resumen por reglas.",
        security: auth,
        responses: {
          200: ok({
            type: "object",
            properties: {
              resumen: { type: "string" },
              fuente: { type: "string", enum: ["ia", "reglas"] },
              sugerencias: { type: "array", items: ref("Sugerencia") },
            },
          }),
        },
      },
    },
  },
};

export const docsRouter = Router();
// Swagger UI usa un script inline: se relaja el CSP de helmet solo en esta ruta.
docsRouter.use((_req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"
  );
  next();
});
docsRouter.get("/openapi.json", (_req, res) => res.json(openapi));
docsRouter.use("/", swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: "InstaYa! API" }));

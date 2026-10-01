# Preguntas de entrevista — InstaYa!

Respuestas cortas de borrador: reescríbelas con tus palabras después de estudiar `docs/FLUJO.md`.

1. **¿Qué es InstaYa! y qué problema resuelve?**
   Inventario y ventas para PYMES de El Salvador, pensado para usarse desde el celular. Cada negocio ve solo sus datos (SaaS multi-tenant). Es un proyecto de equipo en ITCA-FEPADE y soy el tech lead.

2. **¿Cómo aíslas los datos entre empresas?**
   Base de datos compartida con `empresaId` en cada tabla. El `empresaId` sale del JWT verificado, nunca del cliente, y todo `where` lo incluye. Además `tenantGuard` rechaza cuerpos con otra empresa. Hay tests que lo comprueban.

3. **¿Por qué un producto de otra empresa responde 404 y no 403?**
   Para no revelar que existe. Con el `empresaId` en la consulta, simplemente "no se encuentra".

4. **¿Cómo funciona la autenticación?**
   Login con bcrypt, JWT con `empresaId` y rol. En cada petición se vuelve a consultar la BD para ver si el usuario y la empresa siguen activos.

5. **¿Cómo evitas que el cliente falsee el precio de una venta?**
   El total lo calcula el servidor con el `precioVenta` de la BD (`Prisma.Decimal`). El `total` que mande el cliente se ignora cuando hay `items`.

6. **¿Cómo garantizas que el stock no quede inconsistente?**
   Transacciones de Prisma: descontar stock, crear movimientos y crear la venta pasan juntos. Si hay stock insuficiente se lanza un error y se revierte todo.

7. **¿Por qué separaste `app.ts` de `server.ts`?**
   Para importar la app en los tests con Supertest sin abrir un puerto.

8. **¿Cómo manejas los errores?**
   Los handlers van envueltos en `asyncHandler` y solo lanzan. `errorHandler` traduce `AppError`, `ZodError` y errores de unicidad de Prisma, y esconde los errores inesperados detrás de un 500 genérico.

9. **¿Cómo probaste el backend sin base de datos?**
   Reemplacé Prisma por un doble con `vi.mock`. 31 tests cubren auth, roles, aislamiento entre empresas, ventas y movimientos. Limitación: no prueban SQL real; el siguiente paso sería una BD de pruebas en CI.

10. **¿Por qué la demo no tiene backend?**
    No hay hosting gratis estable para Express + Postgres. La demo usa `demoApi.ts`, que replica los endpoints y reglas en el navegador. El backend real se corre con Docker.

11. **¿Qué mejorarías?**
    Endpoints de categorías y proveedores, captura de productos en la pantalla de ventas, tests de integración con Postgres, rate limiting en login y refresh tokens.

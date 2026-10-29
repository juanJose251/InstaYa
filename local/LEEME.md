# Instalador local de InstaYa! (Windows)

Instala la app completa en una computadora con Windows 10/11 de 64 bits, **sin Docker, sin internet y sin servidores en la nube**: Node.js portátil, PostgreSQL 16 embebido, la API y la web en un solo puerto.

## Armar el instalador

Requisitos: Node.js 20+ y [Inno Setup 6](https://jrsoftware.org/isinfo.php) (`winget install JRSoftware.InnoSetup`), y haber corrido `npm install` en `backend/` y `frontend/`.

```bash
cd local
npm install          # binarios oficiales de PostgreSQL para Windows (@embedded-postgres/windows-x64)
npm run empaquetar   # -> local/salida/InstaYa-Setup-<versión>.exe (~100 MB)
```

## Qué hace al instalar

- Instala en `%LOCALAPPDATA%\Programs\InstaYa` (no pide permisos de administrador).
- Crea los accesos **InstaYa!** y **Detener InstaYa!** en el menú Inicio. Opcionales: acceso en el escritorio y abrir al encender la PC.
- Al abrir InstaYa! la primera vez:
  - crea la base de datos en `%LOCALAPPDATA%\InstaYa\pgdata`, con contraseña y secretos aleatorios en `config.json`
  - aplica las migraciones
  - abre `http://localhost:4100`
- El dueño se registra en **Crear cuenta** y empieza con los 15 días de prueba, igual que en la nube.

## Uso diario

| Acción | Cómo |
|---|---|
| Abrir | acceso **InstaYa!** (si ya está abierta, solo muestra el navegador) |
| Cerrar todo | acceso **Detener InstaYa!** (apaga la API y PostgreSQL) |
| Activar el plan tras el pago | con la app abierta: `activar-plan.cmd 1` (meses) en la carpeta de instalación |
| Ver errores | `%LOCALAPPDATA%\InstaYa\logs\instaya.log` (si falla al abrir, se abre solo en el Bloc de notas) |
| Respaldar | copiar la carpeta `%LOCALAPPDATA%\InstaYa` con la app detenida |

Puertos: 4100 (web y API) y 54329 (PostgreSQL, solo localhost); se cambian en `config.json`.
Al desinstalar o actualizar se detiene la app y **los datos se conservan**.

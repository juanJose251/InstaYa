/**
 * Lanzador de InstaYa! instalado en Windows (sin Docker ni internet).
 *
 *   node instaya.mjs              arranca PostgreSQL, aplica migraciones, levanta la API + web y abre el navegador
 *   node instaya.mjs --detener    detiene la app y la base de datos
 *   node instaya.mjs --activar N  activa el plan Básico N meses (después de confirmar el pago)
 *
 * Programa:  <carpeta de instalación>\{node, pgsql, backend, web}
 * Datos:     %LOCALAPPDATA%\InstaYa\{config.json, pgdata, logs}   (no se borran al desinstalar ni al actualizar)
 *
 * Para probar sin tocar la instalación real: INSTAYA_DATOS=<otra carpeta> e INSTAYA_SIN_NAVEGADOR=1.
 */
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const APP = path.dirname(fileURLToPath(import.meta.url));
const DATOS = process.env.INSTAYA_DATOS || path.join(process.env.LOCALAPPDATA || APP, "InstaYa");
const PGDATA = path.join(DATOS, "pgdata");
const LOGS = path.join(DATOS, "logs");
const PID = path.join(DATOS, "instaya.pid");
const PGBIN = path.join(APP, "pgsql", "bin");
const exe = (n) => path.join(PGBIN, `${n}.exe`);
// Tienda donde se compran y renuevan las licencias (se puede cambiar en config.json → "tienda").
const TIENDA = "https://instaya-app.netlify.app";

fs.mkdirSync(LOGS, { recursive: true });
const LOG = path.join(LOGS, "instaya.log");
const log = (m) => fs.appendFileSync(LOG, `[${new Date().toISOString()}] ${m}\n`);

function config() {
  const archivo = path.join(DATOS, "config.json");
  if (fs.existsSync(archivo)) return JSON.parse(fs.readFileSync(archivo, "utf8"));
  const c = {
    puerto: 4100,
    pgPuerto: 54329,
    pgPassword: randomBytes(18).toString("hex"),
    jwtSecret: randomBytes(32).toString("hex"),
    platformKey: randomBytes(24).toString("hex"),
  };
  fs.writeFileSync(archivo, JSON.stringify(c, null, 2));
  return c;
}

function correr(cmd, args, opciones = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", windowsHide: true, ...opciones });
  if (r.stdout) log(r.stdout.trim());
  if (r.stderr) log(r.stderr.trim());
  return r.status;
}

const vivo = async (url) => {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(1500) })).ok;
  } catch {
    return false;
  }
};

const abrir = (url) => !process.env.INSTAYA_SIN_NAVEGADOR && spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true }).unref();

function fallar(error) {
  log(`ERROR: ${error?.stack || error}`);
  spawn("notepad.exe", [LOG], { detached: true, stdio: "ignore" }).unref();
  process.exit(1);
}

async function iniciarPostgres(c) {
  if (!fs.existsSync(path.join(PGDATA, "PG_VERSION"))) {
    log("Primera vez: creando la base de datos...");
    const pw = path.join(DATOS, "pw.tmp");
    fs.writeFileSync(pw, c.pgPassword);
    const st = correr(exe("initdb"), ["-D", PGDATA, "-U", "postgres", "-A", "scram-sha-256", `--pwfile=${pw}`, "-E", "UTF8", "--locale=C"]);
    fs.rmSync(pw, { force: true });
    if (st !== 0) throw new Error("initdb falló");
  }
  // 0 = ya corre (por ejemplo, quedó encendido de antes); 3 = detenido
  if (correr(exe("pg_ctl"), ["status", "-D", PGDATA]) !== 0) {
    // stdio "ignore": el servidor hereda las tuberías y spawnSync esperaría a que se cierren (nunca). Su log va con -l.
    const st = correr(exe("pg_ctl"), [
      "start", "-D", PGDATA, "-w", "-t", "90", "-l", path.join(LOGS, "postgres.log"),
      "-o", `-p ${c.pgPuerto} -c listen_addresses=localhost`,
    ], { stdio: "ignore" });
    if (st !== 0) throw new Error("PostgreSQL no arrancó (ver logs/postgres.log)");
  }
  // La base "instaya" la crea `prisma migrate deploy` si no existe (el paquete no trae psql ni createdb).
}

async function arrancar() {
  const c = config();
  const url = `http://localhost:${c.puerto}`;
  if (await vivo(`${url}/api/health`)) {
    abrir(url); // ya estaba abierta: solo se muestra
    return;
  }
  log("Iniciando InstaYa!...");
  await iniciarPostgres(c);

  const DATABASE_URL = `postgresql://postgres:${c.pgPassword}@localhost:${c.pgPuerto}/instaya?schema=public`;
  const backend = path.join(APP, "backend");
  const st = correr(process.execPath, [path.join(backend, "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"], {
    cwd: backend,
    env: { ...process.env, DATABASE_URL },
  });
  if (st !== 0) throw new Error("Las migraciones fallaron");

  Object.assign(process.env, {
    NODE_ENV: "production",
    PORT: String(c.puerto),
    DATABASE_URL,
    JWT_SECRET: c.jwtSecret,
    PLATFORM_KEY: c.platformKey,
    CLIENT_URL: url,
    STATIC_DIR: path.join(APP, "web"),
    TIENDA_URL: c.tienda || TIENDA,
  });
  await import(pathToFileURL(path.join(backend, "dist", "server.js")).href);
  fs.writeFileSync(PID, String(process.pid));

  for (let i = 0; i < 40 && !(await vivo(`${url}/api/health`)); i++) await new Promise((r) => setTimeout(r, 250));
  log(`Listo en ${url}`);
  abrir(url);
}

function detener() {
  if (fs.existsSync(PID)) {
    const pid = Number(fs.readFileSync(PID, "utf8"));
    try {
      process.kill(pid);
    } catch {
      // ya no corría
    }
    fs.rmSync(PID, { force: true });
  }
  if (fs.existsSync(path.join(PGDATA, "PG_VERSION"))) correr(exe("pg_ctl"), ["stop", "-D", PGDATA, "-m", "fast"]);
  log("Detenido.");
}

async function activar(meses) {
  const c = config();
  const base = `http://localhost:${c.puerto}/api/plataforma/empresas`;
  const headers = { "x-platform-key": c.platformKey, "Content-Type": "application/json" };
  const { empresas } = await (await fetch(base, { headers })).json();
  if (!empresas?.length) throw new Error("No hay empresas registradas todavía");
  for (const e of empresas) {
    const r = await fetch(`${base}/${e.id}/activar`, { method: "POST", headers, body: JSON.stringify({ meses }) });
    const j = await r.json();
    console.log(`${e.nombre}: plan ${j.empresa?.plan ?? "?"} hasta ${j.empresa?.suscripcionFin ?? j.error ?? r.status}`);
  }
}

const [opcion, valor] = process.argv.slice(2);
if (opcion === "--detener") detener();
else if (opcion === "--activar") activar(Number(valor) || 1).catch((e) => (console.error(e.message), process.exit(1)));
else arrancar().catch(fallar);

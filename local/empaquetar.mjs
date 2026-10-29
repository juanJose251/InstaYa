/**
 * Arma local/salida/InstaYa (todo lo que se instala) y compila local/salida/InstaYa-Setup-<versión>.exe con Inno Setup.
 * Uso (en Windows, desde local/):  npm install && npm run empaquetar
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LOCAL = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(LOCAL, "..");
const SALIDA = path.join(LOCAL, "salida");
const OUT = path.join(SALIDA, "InstaYa");
const VERSION = JSON.parse(fs.readFileSync(path.join(RAIZ, "backend", "package.json"), "utf8")).version;

const sh = (cmd, cwd, env = {}) => {
  console.log(`> ${cmd}  (${path.relative(RAIZ, cwd) || "."})`);
  execSync(cmd, { cwd, stdio: "inherit", env: { ...process.env, ...env } });
};
const copiar = (de, a) => fs.cpSync(de, a, { recursive: true });

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// 1. API: compilar y copiar solo lo que corre en producción
const back = path.join(RAIZ, "backend");
sh("npm run build", back);
const outBack = path.join(OUT, "backend");
for (const f of ["dist", "prisma", "package.json", "package-lock.json"]) copiar(path.join(back, f), path.join(outBack, f));
fs.rmSync(path.join(outBack, "prisma", "seed.ts"), { force: true });
const versionPrisma = JSON.parse(fs.readFileSync(path.join(back, "node_modules", "prisma", "package.json"), "utf8")).version;
sh("npm ci --omit=dev --no-audit --no-fund", outBack);
// prisma (CLI) es devDependency: hace falta para `migrate deploy` al arrancar, como en el Dockerfile
sh(`npm install --no-save --no-audit --no-fund prisma@${versionPrisma}`, outBack);
sh("npx prisma generate", outBack);

// 2. Web: build normal (sin VITE_DEMO y sin VITE_API_URL: la API la sirve en el mismo puerto)
const front = path.join(RAIZ, "frontend");
sh(`npx vite build --outDir "${path.join(OUT, "web")}" --emptyOutDir`, front, { VITE_DEMO: "", VITE_API_URL: "" });

// 3. Node portátil: el mismo node.exe que corre este script
fs.mkdirSync(path.join(OUT, "node"));
fs.copyFileSync(process.execPath, path.join(OUT, "node", "node.exe"));

// 4. PostgreSQL embebido (binarios oficiales para Windows) + runtime de Visual C++ junto a los .exe
const pg = path.join(LOCAL, "node_modules", "@embedded-postgres", "windows-x64", "native");
if (!fs.existsSync(pg)) throw new Error("Falta PostgreSQL: corre `npm install` en local/");
fs.cpSync(pg, path.join(OUT, "pgsql"), {
  recursive: true,
  filter: (f) => !/wx(base|msw)\d+.*\.dll$/i.test(f) && !/pgAdmin/i.test(f), // librerías de pgAdmin, no hacen falta
});
const sys32 = path.join(process.env.SystemRoot || "C:\\Windows", "System32");
for (const dll of ["vcruntime140.dll", "vcruntime140_1.dll", "msvcp140.dll"]) {
  const de = path.join(sys32, dll);
  if (fs.existsSync(de)) fs.copyFileSync(de, path.join(OUT, "pgsql", "bin", dll));
}

// 5. Lanzador e ícono (ICO con PNG dentro, válido desde Windows Vista)
for (const f of ["instaya.mjs", "InstaYa.vbs", "activar-plan.cmd"]) fs.copyFileSync(path.join(LOCAL, f), path.join(OUT, f));
const pngs = [["favicon-32.png", 32], ["icon-192.png", 192]].map(([f, t]) => [fs.readFileSync(path.join(front, "public", f)), t]);
const cab = Buffer.alloc(6 + 16 * pngs.length);
cab.writeUInt16LE(1, 2);
cab.writeUInt16LE(pngs.length, 4);
let offset = cab.length;
pngs.forEach(([png, t], i) => {
  const e = 6 + 16 * i;
  cab.writeUInt8(t, e);
  cab.writeUInt8(t, e + 1);
  cab.writeUInt16LE(1, e + 4);
  cab.writeUInt16LE(32, e + 6);
  cab.writeUInt32LE(png.length, e + 8);
  cab.writeUInt32LE(offset, e + 12);
  offset += png.length;
});
const ico = Buffer.concat([cab, ...pngs.map(([p]) => p)]);
fs.writeFileSync(path.join(LOCAL, "instaya.ico"), ico);
fs.writeFileSync(path.join(OUT, "instaya.ico"), ico);

// 6. Instalador
const iscc = [
  path.join(process.env.LOCALAPPDATA || "", "Programs", "Inno Setup 6", "ISCC.exe"),
  "C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe",
  "C:\\Program Files\\Inno Setup 6\\ISCC.exe",
].find((p) => fs.existsSync(p));
if (!iscc) throw new Error("Falta Inno Setup 6 (winget install JRSoftware.InnoSetup)");
sh(`"${iscc}" /Q /DVersion=${VERSION} instaya.iss`, LOCAL);
console.log(`\nListo: ${path.join(SALIDA, `InstaYa-Setup-${VERSION}.exe`)}`);

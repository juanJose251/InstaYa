import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { DEMO } from "../lib/api";
import { PRECIOS } from "../lib/suscripcion";
import { DESCARGA_URL, TIENDA } from "../lib/sitio";

const funciones = [
  { icon: "▤", titulo: "Inventario en tiempo real", texto: "Cada venta descuenta el stock al instante. Sabes qué tienes sin contar estantes." },
  { icon: "⚠", titulo: "Alertas de stock mínimo", texto: "Te avisamos antes de que se acabe el producto que más vendes." },
  { icon: "₵", titulo: "Ventas desde el celular", texto: "Registra una venta en segundos, con el total calculado y anulación si te equivocas." },
  { icon: "⇪", titulo: "Pasa tu Excel en minutos", texto: "Sube tu hoja o cuaderno digitalizado y cargamos todo tu inventario de una vez." },
  { icon: "≡", titulo: "Reportes claros", texto: "Ventas del día, semana y mes, valor del inventario y lo más vendido. Exporta a Excel." },
  { icon: "☺", titulo: "Tu equipo, con permisos", texto: "Tus cajeros venden; solo tú cambias precios y productos. Cada quien con su usuario." },
];

const pasos = TIENDA
  ? [
      { n: "1", titulo: "Descarga e instala", texto: "Un solo instalador para Windows. 15 días gratis, sin tarjeta." },
      { n: "2", titulo: "Carga tu inventario", texto: "Desde tu Excel en minutos, o te ayudamos con la implementación." },
      { n: "3", titulo: "Compra tu licencia", texto: `$${PRECIOS.mensual} al mes con tarjeta. Pegas tu clave y listo.` },
    ]
  : [
      { n: "1", titulo: "Crea tu cuenta", texto: "Gratis y sin tarjeta. 15 días para probar todo." },
      { n: "2", titulo: "Carga tu inventario", texto: "Desde Excel o con nuestra ayuda en la implementación." },
      { n: "3", titulo: "Vende y controla", texto: "Desde el celular, la tablet o la computadora del mostrador." },
    ];

const preguntasTienda = [
  ["¿Qué necesito?", "Una computadora con Windows 10 u 11. El instalador trae todo: la app y su base de datos."],
  ["¿Necesito internet?", "No. InstaYa! funciona sin internet; solo se conecta cuando hay señal para renovar tu licencia."],
  ["¿Dónde quedan mis datos?", "En tu propia computadora. Para respaldarlos copias una carpeta; te explicamos cómo."],
  ["¿Qué pasa si no renuevo?", "Tu cuenta queda en solo lectura: puedes ver y exportar todo. Nunca se borra tu información."],
  ["¿Cómo pago?", `Con tarjeta de crédito o débito por Wompi: $${PRECIOS.mensual} al mes, sin contratos. Cancelas cuando quieras.`],
];

const preguntasNube = [
  ["¿Necesito computadora?", "No. InstaYa! funciona en cualquier celular con internet y se instala como una app desde el navegador."],
  ["¿Mis datos están seguros?", "Cada negocio tiene sus datos aislados: ningún otro cliente puede verlos. Hacemos respaldos diarios."],
  ["¿Qué pasa si no pago al terminar la prueba?", "Tu cuenta queda en solo lectura: puedes ver y exportar todo. Nunca borramos tu información."],
  ["¿Cómo pago?", "Por transferencia bancaria, Wompi o N1co. Sin contratos: pagas mes a mes."],
];

function Logo({ claro = false }: { claro?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${claro ? "bg-white/10 ring-1 ring-white/20" : "bg-brand-700"}`}>
        <span className="text-lg font-black text-accent-400">I!</span>
      </span>
      <span className={`text-lg font-black ${claro ? "text-white" : "text-brand-800"}`}>InstaYa!</span>
    </span>
  );
}

/** Sitio de venta: prueba gratis (descarga) y plan Básico (licencia mensual con Wompi). */
function PlanesTienda() {
  const lista = (items: string[]) => (
    <ul className="mt-5 space-y-2 text-sm text-slate-700">
      {items.map((t) => (
        <li key={t} className="flex gap-2">
          <span className="text-green-600">✓</span>
          {t}
        </li>
      ))}
    </ul>
  );
  return (
    <>
      <div className="mx-auto mt-8 grid max-w-3xl gap-5 md:grid-cols-2">
        <div className="flex flex-col rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Prueba gratis</p>
          <p className="mt-2">
            <span className="text-5xl font-black text-slate-900">$0</span>
            <span className="text-slate-500"> · {PRECIOS.diasPrueba} días</span>
          </p>
          <p className="mt-1 text-sm text-slate-600">Todas las funciones, sin tarjeta. Al terminar, tus datos se quedan.</p>
          {lista(["La app completa para Windows", "Inventario, ventas, alertas y reportes", "Importa tu Excel el primer día"])}
          <a href={DESCARGA_URL} className="mt-auto block rounded-xl bg-white py-3 text-center font-bold text-brand-700 ring-2 ring-brand-700 hover:bg-brand-50">
            Descargar para Windows
          </a>
          <Link to="/login" className="mt-2 text-center text-xs font-semibold text-slate-500 underline">
            o prueba la demo en línea
          </Link>
        </div>

        <div className="relative flex flex-col rounded-3xl bg-white p-6 shadow-xl ring-2 ring-brand-600">
          <span className="absolute -top-3 right-5 rounded-full bg-accent-500 px-3 py-1 text-xs font-bold text-white">Más elegido</span>
          <p className="text-sm font-bold uppercase tracking-wide text-brand-700">Plan Básico</p>
          <p className="mt-2">
            <span className="text-5xl font-black text-slate-900">${PRECIOS.mensual}</span>
            <span className="text-slate-500"> /mes</span>
          </p>
          <p className="mt-1 text-sm text-slate-600">Pagas con tarjeta, mes a mes. Sin contratos.</p>
          {lista([
            "Usuarios ilimitados con roles",
            "Funciona sin internet, datos en tu computadora",
            "Importación y exportación a Excel",
            "Actualizaciones incluidas",
            "Soporte por WhatsApp y correo",
          ])}
          <Link to="/comprar" className="mt-6 block rounded-xl bg-brand-700 py-3 text-center font-bold text-white hover:bg-brand-800">
            Comprar licencia
          </Link>
        </div>
      </div>
      <p className="mx-auto mt-5 max-w-xl text-center text-sm text-slate-600">
        ¿Prefieres que lo hagamos por ti? <b>Implementación opcional de ${PRECIOS.implementacion}</b>: instalamos, cargamos tu inventario inicial y
        capacitamos a tu personal.
      </p>
    </>
  );
}

export default function Landing() {
  const { usuario } = useAuth();
  const preguntas = TIENDA ? preguntasTienda : preguntasNube;
  const ctaPrincipal = usuario
    ? { to: "/app", label: "Ir a mi panel" }
    : DEMO
      ? { to: "/login", label: "Probar la demo" }
      : { to: "/registro", label: `Prueba gratis ${PRECIOS.diasPrueba} días` };

  return (
    <div className="min-h-screen bg-white text-slate-800">
      {/* Encabezado */}
      <header className="bg-brand-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Logo claro />
          <nav className="flex items-center gap-2 text-sm font-semibold">
            <a href="#precios" className="hidden px-3 py-2 text-brand-100 hover:text-white sm:inline">
              Precios
            </a>
            {usuario ? (
              <Link to="/app" className="rounded-xl bg-white px-3 py-2 text-brand-800">
                Mi panel
              </Link>
            ) : (
              <Link to="/login" className="rounded-xl bg-white/10 px-3 py-2 text-white ring-1 ring-white/20 hover:bg-white/20">
                Entrar
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-800 to-brand-600 pb-16 text-white">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 pt-8 md:grid-cols-2 md:pt-14">
          <div>
            <p className="mb-3 inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-accent-200 ring-1 ring-white/15">
              Hecho para PYMES de El Salvador
            </p>
            <h1 className="text-3xl font-black leading-tight sm:text-4xl md:text-5xl">
              Tu inventario al día, <span className="text-accent-400">desde el celular</span>
            </h1>
            <p className="mt-4 max-w-md text-base text-brand-100">
              Deja el cuaderno y el Excel. InstaYa! controla tu stock, tus ventas y te avisa antes de que se te acabe la mercadería.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {TIENDA ? (
                <a href={DESCARGA_URL} className="rounded-xl bg-accent-500 px-5 py-3 font-bold text-white shadow-lg hover:bg-accent-600">
                  Descargar gratis
                </a>
              ) : (
                <Link to={ctaPrincipal.to} className="rounded-xl bg-accent-500 px-5 py-3 font-bold text-white shadow-lg hover:bg-accent-600">
                  {ctaPrincipal.label}
                </Link>
              )}
              <a href="#precios" className="rounded-xl px-5 py-3 font-semibold text-white ring-1 ring-white/30 hover:bg-white/10">
                Ver precios
              </a>
            </div>
            <p className="mt-3 text-xs text-brand-200">
              {TIENDA ? `${PRECIOS.diasPrueba} días gratis · Windows 10/11 · Funciona sin internet` : "Sin tarjeta · Sin contratos · Funciona en cualquier celular"}
            </p>
          </div>

          {/* Maqueta del teléfono con datos de ejemplo */}
          <div className="mx-auto w-full max-w-xs" aria-hidden="true">
            <div className="rounded-[2rem] bg-slate-900 p-2.5 shadow-2xl">
              <div className="overflow-hidden rounded-[1.6rem] bg-slate-50">
                <div className="bg-brand-700 px-4 py-3 text-white">
                  <p className="text-xs text-brand-100">Hola,</p>
                  <p className="font-bold">Doña Marta</p>
                </div>
                <div className="grid grid-cols-2 gap-2 p-3">
                  {[
                    ["8", "Productos"],
                    ["2", "Stock bajo"],
                    ["$24.85", "Ventas hoy"],
                    ["$431", "Inventario"],
                  ].map(([v, l]) => (
                    <div key={l} className="rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-slate-200">
                      <p className="text-lg font-bold text-brand-700">{v}</p>
                      <p className="text-[10px] text-slate-500">{l}</p>
                    </div>
                  ))}
                </div>
                <div className="mx-3 mb-3 rounded-xl bg-white p-3 text-xs shadow-sm ring-1 ring-red-200">
                  <p className="font-bold text-red-700">⚠ Alertas de stock</p>
                  <p className="mt-1 flex justify-between text-slate-700">
                    <span>Leche 1 L</span>
                    <span className="font-semibold text-accent-700">4 u.</span>
                  </p>
                  <p className="flex justify-between text-slate-700">
                    <span>Aceite 900 ml</span>
                    <span className="font-semibold text-accent-700">8 u.</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problema */}
      <section className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="text-center text-2xl font-black text-slate-900">¿Todavía llevas el inventario en cuaderno?</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-slate-600">
          En nuestro sondeo a 50 dueños de negocios, la mayoría pierde ventas por quedarse sin producto o no sabe cuánto vale lo que tiene en bodega.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["40%", "usa cuaderno para su inventario"],
            ["30%", "usa hojas de Excel básicas"],
            ["91%", "de las PYMES ya empezó a digitalizarse"],
          ].map(([n, t]) => (
            <div key={t} className="rounded-2xl bg-slate-50 p-5 text-center ring-1 ring-slate-200">
              <p className="text-4xl font-black text-brand-700">{n}</p>
              <p className="mt-1 text-sm text-slate-600">{t}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Funciones */}
      <section className="bg-slate-50 py-14">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-2xl font-black text-slate-900">Todo lo que tu negocio necesita, nada que no uses</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {funciones.map((f) => (
              <div key={f.titulo} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-xl text-brand-700">{f.icon}</span>
                <h3 className="mt-3 font-bold text-slate-900">{f.titulo}</h3>
                <p className="mt-1 text-sm text-slate-600">{f.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="text-center text-2xl font-black text-slate-900">Empieza hoy, en tres pasos</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {pasos.map((p) => (
            <div key={p.n} className="rounded-2xl p-5 ring-1 ring-slate-200">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-500 font-black text-white">{p.n}</span>
              <h3 className="mt-3 font-bold text-slate-900">{p.titulo}</h3>
              <p className="mt-1 text-sm text-slate-600">{p.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Precios */}
      <section id="precios" className="bg-gradient-to-b from-brand-50 to-white py-14">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-2xl font-black text-slate-900">Un precio simple, pensado para la micro y pequeña empresa</h2>
          {TIENDA ? <PlanesTienda /> : (
          <div className="mx-auto mt-8 max-w-md rounded-3xl bg-white p-6 shadow-xl ring-2 ring-brand-600">
            <p className="text-sm font-bold uppercase tracking-wide text-brand-700">Plan Básico</p>
            <p className="mt-2">
              <span className="text-5xl font-black text-slate-900">${PRECIOS.mensual}</span>
              <span className="text-slate-500"> /mes</span>
            </p>
            <p className="mt-1 text-sm text-slate-600">
              + ${PRECIOS.implementacion} de implementación, una sola vez: configuración, carga de tu inventario inicial y capacitación.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-700">
              {[
                `${PRECIOS.diasPrueba} días de prueba gratis, sin tarjeta`,
                "Usuarios ilimitados con roles",
                "Inventario, ventas, alertas y reportes",
                "Importación y exportación a Excel",
                "Respaldos diarios y soporte técnico",
                "Sin contratos: cancelas cuando quieras",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="text-green-600">✓</span>
                  {t}
                </li>
              ))}
            </ul>
            <Link to={ctaPrincipal.to} className="mt-6 block rounded-xl bg-brand-700 py-3 text-center font-bold text-white hover:bg-brand-800">
              {ctaPrincipal.label}
            </Link>
          </div>
          )}
          <p className="mx-auto mt-4 max-w-md text-center text-xs text-slate-500">
            Otras soluciones del mercado cuestan entre $19 y $45 al mes y están pensadas para empresas más grandes.
          </p>
        </div>
      </section>

      {/* Preguntas frecuentes */}
      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="text-center text-2xl font-black text-slate-900">Preguntas frecuentes</h2>
        <div className="mt-6 space-y-3">
          {preguntas.map(([q, a]) => (
            <details key={q} className="group rounded-2xl p-4 ring-1 ring-slate-200 open:bg-slate-50">
              <summary className="cursor-pointer list-none font-semibold text-slate-900">
                <span className="mr-2 text-brand-600 group-open:hidden">+</span>
                <span className="mr-2 hidden text-brand-600 group-open:inline">−</span>
                {q}
              </summary>
              <p className="mt-2 text-sm text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="bg-brand-900 py-8 text-sm text-brand-100">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 sm:flex-row">
          <Logo claro />
          <p>© {new Date().getFullYear()} InstaYa! · San Salvador, El Salvador</p>
        </div>
      </footer>
    </div>
  );
}

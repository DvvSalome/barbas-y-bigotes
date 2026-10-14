// Vista previa de los correos del DUEÑO (docs/emails/aviso-dueno.js) sin n8n.
//
//   node scripts/qa/preview-aviso-dueno.mjs <carpeta-de-salida>
//
// Corre el cuerpo EXACTO del nodo Code con datos de ejemplo de cada tipo (cita,
// cierre que cuadra, cierre con faltante, caja abierta, calificación baja,
// prueba de un correo guardado y de uno sin guardar), simulando $input.all() de las dos formas en que n8n entrega la
// respuesta del RPC (un item con el array, o un item por fila), y escribe un
// .html por correo más un index.html para abrir en el navegador. También imprime
// asunto y texto plano, y falla si algún dato con HTML se coló sin escapar.
//
// No toca la base ni manda nada: los datos son inventados.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const salida = process.argv[2];
if (!salida) {
  console.error("Uso: node scripts/qa/preview-aviso-dueno.mjs <carpeta-de-salida>");
  process.exit(1);
}
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const codigo = readFileSync(join(raiz, "docs", "emails", "aviso-dueno.js"), "utf8");

// Igual que el sandbox de n8n: el cuerpo del nodo es el de una función que recibe $input.
const correr = (items) => new Function("$input", codigo)({ all: () => items });

// Fechas fijas (en UTC; Bogotá es UTC-5) para que la vista previa se lea igual
// cualquier día y a cualquier hora.

// Un intento de inyección en los datos: tiene que salir escapado.
const MALICIOSO = '<script>alert("x")</script>';

const filas = [
  {
    aviso_id: 1,
    tipo: "cita",
    email: "dueno@ejemplo-real.com",
    datos: {
      cliente: "Juan Camilo Rodríguez",
      telefono: "300 123 4567",
      servicio: "Corte + barba",
      duracion_min: 45,
      barbero: "Andrés Gómez",
      sede: "Plaza de la Paz",
      sede_id: "plaza-de-la-paz",
      inicio: "2026-10-17T20:30:00Z", // sábado 3:30 p. m.
      fin: "2026-10-17T21:15:00Z",
      nota: "Bebida: Gaseosa",
      visitas: 0,
      cliente_nuevo: true,
    },
  },
  {
    aviso_id: 2,
    tipo: "cierre",
    email: "dueno@ejemplo-real.com",
    datos: {
      sesion_id: "00000000-0000-0000-0000-000000000002",
      sede_id: "plaza-de-la-paz",
      sede: "Plaza de la Paz",
      abierta_en: "2026-10-13T14:10:00Z", // martes 9:10 a. m.
      cerrada_en: "2026-10-14T01:40:00Z", // martes 8:40 p. m.
      monto_apertura: 200000,
      total_efectivo: 58000,
      total_datafono: 0,
      totales: { efectivo: { total: 58000, propina: 0 }, transferencia: { total: 235000, propina: 15000 } },
      medios: [
        { medio: "efectivo", nombre: "Efectivo", total: 58000, propina: 0 },
        { medio: "transferencia", nombre: "Transferencia", total: 235000, propina: 15000 },
      ],
      total_gastos: 17000,
      citas: 10,
      efectivo_contado: 241000,
      diferencia: 0,
      nota: null,
      cerrada_por: "Mostrador Plaza de la Paz",
    },
  },
  {
    aviso_id: 3,
    tipo: "cierre",
    email: "socio@ejemplo-real.com",
    datos: {
      sede_id: "parque-venezuela",
      sede: "Parque Venezuela",
      abierta_en: "2026-10-11T14:00:00Z", // domingo: quedó abierta de un día para otro
      cerrada_en: "2026-10-13T01:30:00Z",
      monto_apertura: 180000,
      totales: { efectivo: { total: 218000, propina: 5000 }, nequi: { total: 148000, propina: 0 } },
      medios: [
        { medio: "efectivo", nombre: "Efectivo", total: 218000, propina: 5000 },
        { medio: "nequi", nombre: "Nequi", total: 148000, propina: 0 },
      ],
      total_gastos: 25000,
      citas: 4,
      efectivo_contado: 366000,
      diferencia: -12000,
      nota: `Faltó registrar un gasto ${MALICIOSO}`,
      cerrada_por: null,
    },
  },
  {
    aviso_id: 4,
    tipo: "caja_abierta",
    email: "dueno@ejemplo-real.com",
    datos: { sede: "Parque Venezuela", sede_id: "parque-venezuela", abierta_en: "2026-09-29T21:22:00Z", dias: 15 },
  },
  {
    aviso_id: 5,
    tipo: "resena_baja",
    email: "dueno@ejemplo-real.com",
    datos: {
      score: 2,
      comentario: "Me hicieron esperar 40 minutos y el corte quedó disparejo.",
      cliente: "Laura Martínez",
      barbero: "Luis Pérez",
      sede: "Parque Venezuela",
      sede_id: "parque-venezuela",
      servicio: "Corte clásico",
      fecha: "2026-10-14T19:05:00Z",
    },
  },
  { aviso_id: 6, tipo: "prueba", email: "dueno@ejemplo-real.com", datos: { pedida_en: "2026-10-14T19:00:00Z", guardado: true } },
  // «Probar» con un correo escrito pero todavía sin «Agregar»: el correo lo tiene que decir.
  { aviso_id: 7, tipo: "prueba", email: "nuevo@ejemplo-real.com", datos: { pedida_en: "2026-10-14T19:02:00Z", guardado: false } },
];

// Forma 1: n8n entrega UN item con el array completo.
const comoArray = correr([{ json: filas }]);
// Forma 2: un item por fila (lo normal con el HTTP Request), y basura que debe ignorarse.
const porFila = correr([...filas.map((f) => ({ json: f })), { json: {} }, { json: { tipo: "otro", email: "x@y.com" } }]);

if (comoArray.length !== filas.length || porFila.length !== filas.length) {
  console.error(`✗ Se esperaban ${filas.length} correos en las dos formas: ${comoArray.length} y ${porFila.length}`);
  process.exit(1);
}

mkdirSync(salida, { recursive: true });
const nombres = ["cita", "cierre-cuadra", "cierre-faltante", "caja-abierta", "resena-baja", "prueba", "prueba-sin-guardar"];
let fallos = 0;
const enlaces = [];
comoArray.forEach((it, i) => {
  const { para, asunto, html, text } = it.json;
  if (html.includes(MALICIOSO) || text === undefined) {
    console.error(`✗ ${nombres[i]}: un dato salió sin escapar`);
    fallos++;
  }
  if (/\{\{|\}\}/.test(html)) {
    console.error(`✗ ${nombres[i]}: quedaron llaves dobles en el HTML`);
    fallos++;
  }
  // Lo que el correo NO puede decir / SÍ tiene que decir (hallazgos de la revisión).
  const debe = (cond, motivo) => {
    if (!cond) {
      console.error(`✗ ${nombres[i]}: ${motivo}`);
      fallos++;
    }
  };
  if (nombres[i] === "cita") debe(!/tambi(é|&eacute;)n les llega/.test(html), "promete que al barbero y al mostrador les llegó");
  if (nombres[i].startsWith("cierre")) {
    // Fondo + cobrado en efectivo + propinas en efectivo − gastos = debería haber.
    const d = filas[i].datos;
    const ef = d.medios.find((m) => m.medio === "efectivo");
    const esperado = d.monto_apertura + ef.total + ef.propina - d.total_gastos;
    debe(esperado === d.efectivo_contado - d.diferencia, "los datos de ejemplo no cuadran");
    debe(text.includes("Cobrado en efectivo"), "falta el cobrado en efectivo: la caja Efectivo no suma");
  }
  if (nombres[i] === "prueba") debe(!/NO est/.test(text) && /tu correo está en Ajustes/.test(text), "la prueba de un correo guardado");
  if (nombres[i] === "prueba-sin-guardar")
    debe(/NO est/.test(text) && !/tu correo está en Ajustes/.test(text) && !/tu correo est&aacute; en/.test(html), "la prueba sin guardar dice que ya está en la lista");
  const archivo = `${String(i + 1).padStart(2, "0")}-${nombres[i]}.html`;
  writeFileSync(join(salida, archivo), html);
  writeFileSync(join(salida, archivo.replace(/\.html$/, ".txt")), `Para: ${para}\nAsunto: ${asunto}\n\n${text}\n`);
  enlaces.push(`<li><a href="${archivo}">${archivo}</a> — ${asunto.replace(/</g, "&lt;")}</li>`);
  console.log(`\n=== ${archivo}\nPara: ${para}\nAsunto: ${asunto}\n---\n${text}`);
});
writeFileSync(
  join(salida, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Avisos del dueño</title><body style="font-family:system-ui;padding:24px;background:#111;color:#eee"><h1>Avisos del dueño (vista previa)</h1><ul>${enlaces.join("")}</ul></body>`,
);

if (fallos) process.exit(1);
console.log(`\nOK — ${comoArray.length} correos en ${resolve(salida)} (abre index.html)`);

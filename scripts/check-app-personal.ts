// Chequeo ejecutable de la app PROPIA de cada barbero (src/lib/app-personal.ts).
//
//   node scripts/check-app-personal.ts
//
// Lo que sale caro si se rompe:
//   · el slug: es la dirección de la app que el barbero YA instaló. Si el código
//     (antes de 0089) y la migración (después) no dieran el mismo, la app
//     instalada el día del deploy dejaría de abrir el día de la migración;
//   · la entrada: abrirle a alguien la agenda de otro en un aparato compartido,
//     o mandar a la lista de todos a quien ya tiene su sesión;
//   · lo que recuerda el aparato: con basura en localStorage, un salto a una
//     ruta que no existe en cada arranque;
//   · el manifiesto: sin `id` propio Android la confunde con la app del equipo.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  slugBase,
  slugLibre,
  asignarSlugs,
  microsDe,
  leerRuta,
  rutaBarbero,
  rutaMostrador,
  rutaManifiesto,
  enlaceAbsoluto,
  entradaPara,
  nombreCorto,
  tituloApp,
  nombreApp,
  manifiestoPersonal,
  rutaRecordada,
  marcaPara,
  sistemaDe,
  pasosInstalar,
  mensajeApp,
  linkWhatsAppTexto,
  SITIO,
  COLOR_APP,
  ICONOS_APP,
} from "../src/lib/app-personal.ts";

// (1) slugBase da EXACTAMENTE lo que dio la expresión SQL de 0089 contra la base
// de producción (consulta de solo lectura, 18-oct). Si alguien toca una de las
// dos reglas y no la otra, esto se rompe.
const DE_SQL: [string | null, string][] = [
  ["Meyer", "meyer"],
  ["Jhon", "jhon"],
  ["Junior", "junior"],
  ["Bryan García", "bryan-garcia"],
  ["Kevin Valencia", "kevin-valencia"],
  ["Abel Barbers", "abel-barbers"],
  ["  Íñigo  Peña ", "inigo-pena"],
  ["ÁLVARO MUÑOZ", "alvaro-munoz"],
  ["Mostrador Uno", "barbero-mostrador-uno"],
  ["---", "barbero"],
  ["", "barbero"],
  ["José-Luis  O'Neill", "jose-luis-o-neill"],
  ["Çedric Ÿves", "cedric-yves"],
  ["Ñandú 2000", "nandu-2000"],
  ["Sebastián Andrés Rodríguez de la Torre Valderrama", "sebastian-andres-rodriguez-de-la-torre-v"],
  ["Zoë Ünal", "zoe-unal"],
  ["Ana_María", "ana-maria"],
  [null, "barbero"],
];
for (const [nombre, esperado] of DE_SQL) {
  assert.equal(slugBase(nombre as string), esperado, `slugBase(${JSON.stringify(nombre)})`);
}
assert.ok(slugBase("x".repeat(80)).length <= 40, "40 letras como mucho");

// La tabla de tildes de la migración: mismo largo de los dos lados, y cada letra
// cae donde la deja slugBase (NFD). Sin esto, una letra agregada en un lado solo
// partiría los slugs de quien la tenga en el nombre.
const sql = readFileSync(new URL("../supabase/migrations/0089_app_barbero.sql", import.meta.url), "utf8");
const tr = /translate\(coalesce\(p_nombre, ''\),\s*'([^']+)',\s*'([^']+)'\)/.exec(sql);
assert.ok(tr, "la migración tiene la tabla de translate()");
const de = [...tr[1]];
const a = [...tr[2]];
assert.equal(de.length, a.length, "translate(): mismo largo de los dos lados");
de.forEach((letra, i) => assert.equal(slugBase(`x${letra}x`), `x${a[i]}x`, `la ${letra} va a ${a[i]} en SQL y en JS`));
assert.ok(
  sql.includes("order by (activo is not false) desc, creado_en asc nulls last, id asc"),
  "el backfill asigna en el mismo orden que asignarSlugs",
);
assert.ok(sql.includes("grant select (slug) on public.barberos to anon, authenticated"), "anon puede leer el slug (0049 abre por columna)");
assert.ok(/set search_path = ''/.test(sql), "funciones con search_path vacío");

// (2) slugLibre y asignarSlugs.
assert.equal(slugLibre("kevin", []), "kevin");
assert.equal(slugLibre("kevin", ["kevin", "kevin-2"]), "kevin-3");

// Los 6 de producción, todos del mismo seed (mismo creado_en): lo de hoy.
const SEED = "2026-05-25T03:44:54.55225+00:00";
const hoy = asignarSlugs([
  { id: "9d3b8b07-0000-0000-0000-000000000000", nombre: "Meyer", activo: true, creadoEn: SEED },
  { id: "6a3d6f17-0000-0000-0000-000000000000", nombre: "Jhon", activo: true, creadoEn: SEED },
  { id: "5d295f78-0000-0000-0000-000000000000", nombre: "Junior", activo: true, creadoEn: SEED },
  { id: "affeca61-0000-0000-0000-000000000000", nombre: "Bryan García", activo: true, creadoEn: SEED },
  { id: "58e9c8bb-0000-0000-0000-000000000000", nombre: "Kevin Valencia", activo: true, creadoEn: SEED },
  { id: "cbbe0ee9-0000-0000-0000-000000000000", nombre: "Abel Barbers", activo: true, creadoEn: SEED },
]);
assert.deepEqual(
  [...hoy.values()].sort(),
  ["abel-barbers", "bryan-garcia", "jhon", "junior", "kevin-valencia", "meyer"],
  "los de hoy: un slug por nombre, sin sufijos",
);

// El guardado manda, aunque el nombre ya no coincida (le cambiaron el nombre).
const conGuardado = asignarSlugs([
  { id: "a", nombre: "Kevin Andrés", activo: true, slug: "kevin" },
  { id: "b", nombre: "Kevin", activo: true, slug: null },
]);
assert.equal(conGuardado.get("a"), "kevin", "el slug guardado no se mueve");
assert.equal(conGuardado.get("b"), "kevin-2", "el nuevo toma el siguiente libre");

// Sin guardados: activos antes que los de baja; después el más antiguo; al empatar, por id.
const orden = asignarSlugs([
  { id: "z", nombre: "Kevin", activo: false, creadoEn: "2026-01-01T00:00:00+00:00" },
  { id: "y", nombre: "Kevin", activo: true, creadoEn: "2026-06-01T00:00:00.000002+00:00" },
  { id: "x", nombre: "Kevin", activo: true, creadoEn: "2026-06-01T00:00:00.000001+00:00" },
  { id: "w", nombre: "Kevin", activo: null, creadoEn: null },
  { id: "c", nombre: "Kevin", activo: true, creadoEn: "2026-07-01T00:00:00+00:00" },
  { id: "b", nombre: "Kevin", activo: true, creadoEn: "2026-07-01T00:00:00+00:00" },
]);
assert.equal(orden.get("x"), "kevin", "activo más antiguo (por microsegundos, como Postgres)");
assert.equal(orden.get("y"), "kevin-2");
assert.equal(orden.get("b"), "kevin-3", "empate de fecha: por id");
assert.equal(orden.get("c"), "kevin-4");
assert.equal(orden.get("w"), "kevin-5", "activo null cuenta como activo; sin fecha, al final de los activos");
assert.equal(orden.get("z"), "kevin-6", "el de baja, al final");
assert.ok(microsDe("2026-06-01T00:00:00.000001+00:00") < microsDe("2026-06-01T00:00:00.000002+00:00"));
assert.ok(microsDe("2026-06-01T00:00:00+00:00") < microsDe("2026-06-01T00:00:00.5+00:00"));
assert.equal(microsDe(null), Number.POSITIVE_INFINITY);

// (3) Rutas.
assert.deepEqual(leerRuta("meyer"), { tipo: "barbero", slug: "meyer" });
assert.deepEqual(leerRuta("Bryan-Garcia"), { tipo: "barbero", slug: "bryan-garcia" }, "mayúsculas en el enlace también abren");
assert.deepEqual(leerRuta("mostrador-plaza-de-la-paz"), { tipo: "sede", sedeId: "plaza-de-la-paz" });
for (const malo of ["", "mostrador-", "-meyer", "meyer-", "me--yer", "meyer/../admin", "meyer%20", "a".repeat(81), null, undefined]) {
  assert.equal(leerRuta(malo as string), null, `no es ruta: ${JSON.stringify(malo)}`);
}
assert.equal(rutaBarbero("meyer"), "/equipo/meyer");
assert.equal(rutaMostrador("parque-venezuela"), "/equipo/mostrador-parque-venezuela");
assert.equal(rutaManifiesto("/equipo/meyer"), "/equipo/meyer/manifest.webmanifest");
assert.equal(enlaceAbsoluto("/equipo/meyer"), "https://barbasybigotes.com/equipo/meyer");
assert.equal(SITIO, "https://barbasybigotes.com", "el enlace va al dominio de verdad, nunca a un preview");
// Ningún barbero puede quedarse con la ruta de un mostrador.
assert.equal(leerRuta(slugBase("Mostrador Plaza"))?.tipo, "barbero");

// (4) Quién entra.
const meyer = { tipo: "barbero" as const, id: "m" };
const plaza = { tipo: "sede" as const, id: "plaza-de-la-paz" };
const anon = { rol: "anon", barberoId: null, sedeId: null };
assert.equal(entradaPara({ rol: "barbero", barberoId: "m", sedeId: null }, meyer), "suya");
assert.equal(entradaPara({ rol: "barbero", barberoId: "k", sedeId: null }, meyer), "otra", "otro barbero en el aparato");
assert.equal(entradaPara({ rol: "admin", barberoId: null, sedeId: null }, meyer), "otra", "el dueño probando el enlace");
assert.equal(entradaPara({ rol: "sede", barberoId: null, sedeId: "plaza-de-la-paz" }, meyer), "otra", "la tablet del local");
assert.equal(entradaPara(anon, meyer), "pin");
assert.equal(entradaPara({ rol: "none", barberoId: null, sedeId: null }, meyer), "pin", "sin perfil (o dado de baja): su PIN");
assert.equal(entradaPara({ rol: "cliente", barberoId: null, sedeId: null }, meyer), "pin");
assert.equal(entradaPara({ rol: "sede", barberoId: null, sedeId: "plaza-de-la-paz" }, plaza), "suya");
assert.equal(entradaPara({ rol: "sede", barberoId: null, sedeId: "parque-venezuela" }, plaza), "otra", "el mostrador de la otra sede");
assert.equal(entradaPara({ rol: "barbero", barberoId: "plaza-de-la-paz", sedeId: null }, plaza), "otra", "un id de barbero no abre una sede");
assert.equal(entradaPara(anon, plaza), "pin");

// (5) Lo que recuerda el aparato.
assert.equal(rutaRecordada("1"), null, "la marca vieja: al login general");
assert.equal(rutaRecordada(null), null);
assert.equal(rutaRecordada("/equipo/meyer"), "/equipo/meyer");
assert.equal(rutaRecordada("/equipo/mostrador-plaza-de-la-paz"), "/equipo/mostrador-plaza-de-la-paz");
for (const malo of ["/equipo", "/equipo/", "/admin", "https://otro.com/equipo/meyer", "/equipo/meyer/manifest.webmanifest", "/equipo/meyer?x=1", "/equipo/../admin", "//equipo/meyer"]) {
  assert.equal(rutaRecordada(malo), null, `no se salta a ${malo}`);
}
assert.equal(marcaPara("/equipo/meyer"), "/equipo/meyer");
assert.equal(marcaPara(null), "1", "el dueño deja la marca general");
assert.equal(marcaPara("/admin"), "1");

// (6) La app instalada.
assert.equal(nombreCorto("Bryan García"), "Bryan");
assert.equal(tituloApp({ tipo: "barbero", nombre: "Bryan García" }), "B&B Bryan");
assert.equal(tituloApp({ tipo: "sede", nombre: "Plaza de la Paz" }), "B&B Mostrador");
assert.equal(nombreApp({ tipo: "barbero", nombre: "Meyer" }), "Barbas & Bigotes · Meyer");
assert.equal(nombreApp({ tipo: "sede", nombre: "Plaza de la Paz" }), "Barbas & Bigotes · Mostrador de Plaza de la Paz");

const m = manifiestoPersonal({ tipo: "barbero", nombre: "Meyer", ruta: "/equipo/meyer" });
assert.equal(m.id, "/equipo/meyer", "id propio: Android la instala aparte de la app del equipo");
assert.equal(m.start_url, "/equipo/meyer", "abre en SU entrada");
assert.equal(m.scope, "/", "su agenda (/barbero) abre dentro de la app");
assert.equal(m.short_name, "B&B Meyer");
assert.equal(m.display, "standalone");
const staff = JSON.parse(readFileSync(new URL("../public/manifest-staff.json", import.meta.url), "utf8"));
assert.notEqual(m.id, staff.id, "no choca con la app general del equipo");
assert.deepEqual(ICONOS_APP, staff.icons, "mismos íconos que la app del equipo");
assert.equal(COLOR_APP, staff.theme_color);
assert.equal(COLOR_APP, staff.background_color);
assert.equal(m.lang, staff.lang);
const ms = manifiestoPersonal({ tipo: "sede", nombre: "Plaza de la Paz", ruta: rutaMostrador("plaza-de-la-paz") });
assert.equal(ms.start_url, "/equipo/mostrador-plaza-de-la-paz");
assert.equal(ms.short_name, "B&B Mostrador");

// (7) Cómo se instala.
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-A145M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
assert.equal(sistemaDe(IPHONE), "ios");
assert.equal(sistemaDe(IPAD, 5), "ios", "el iPad dice Macintosh, pero es táctil");
assert.equal(sistemaDe(IPAD, 0), "otro", "un Mac de verdad");
assert.equal(sistemaDe(ANDROID, 5), "android");
assert.equal(sistemaDe(WINDOWS), "otro");
assert.ok(pasosInstalar("ios").some((p) => p.includes("Agregar a pantalla de inicio")));
assert.ok(pasosInstalar("ios").some((p) => p.includes("Safari")));
assert.ok(pasosInstalar("android").some((p) => p.includes("Instalar app")));
assert.equal(pasosInstalar("otro").length, 1);

// (8) El mensaje de WhatsApp.
const enlace = enlaceAbsoluto("/equipo/meyer");
const txt = mensajeApp({ tipo: "barbero", nombre: "Meyer", enlace });
assert.ok(txt.includes(enlace), "lleva su enlace");
assert.ok(txt.includes("Agregar a pantalla de inicio") && txt.includes("Instalar app"), "lleva los pasos de iPhone y Android");
assert.ok(txt.includes("«B&B Meyer»") && txt.includes("PIN"), "dice el ícono que va a ver y que entra con su PIN");
assert.ok(!/\d{6}/.test(txt), "nunca lleva un PIN");
const txtSede = mensajeApp({ tipo: "sede", nombre: "Plaza de la Paz", enlace: enlaceAbsoluto(rutaMostrador("plaza-de-la-paz")) });
assert.ok(txtSede.includes("PIN del local") && txtSede.includes("mostrador de Plaza de la Paz"));
const wa = linkWhatsAppTexto(txt);
assert.ok(wa.startsWith("https://wa.me/?text="), "wa.me sin número: el dueño elige el chat");
assert.ok(wa.includes("%26") && wa.includes("%0A") && !wa.includes(" "), "el & y los saltos de línea van escapados");
assert.equal(decodeURIComponent(wa.slice("https://wa.me/?text=".length)), txt, "el texto llega entero");

console.log("check-app-personal OK — slug igual en SQL y en JS, entrada sin cruzar sesiones, marca del aparato a prueba de basura, manifiesto propio y mensaje de WhatsApp completo");

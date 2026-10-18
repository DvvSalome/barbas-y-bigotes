// Reglas PURAS de la app PROPIA de cada barbero y de cada mostrador.
//
// Pedido del dueño (17-oct): "que los barberos tengan la aplicación en su
// celular: que si le dan a «agregar al inicio», tengan su ruta dedicada para que
// se abran sus cuentas". Muchos tienen iPhone.
//
// Cada uno tiene su ruta fija, /equipo/<slug> (los mostradores,
// /equipo/mostrador-<sede>), con su propio manifiesto: lo que se instala desde
// ahí es SU app ("B&B Meyer"), abre en SU teclado de PIN y, si ya entró, directo
// en su agenda. La app genérica "B&B Equipo" (/equipo) sigue igual.
//
// Sin I/O: Node las corre directo en scripts/check-app-personal.ts. Las usan la
// página /equipo/[slug], su manifiesto, el layout de /barbero, el alta de un
// barbero (equipo-actions.ts) y su ficha en /admin/equipo.

import { resolverColisionSlug } from "./admin-reglas.ts";

/** El dominio de verdad: el enlace va por WhatsApp, nunca uno de preview. */
export const SITIO = "https://barbasybigotes.com";

const PREFIJO_MOSTRADOR = "mostrador-";
const LARGO_MAX = 40;

// ---------- El slug de cada barbero ----------

/**
 * "Bryan García" → "bryan-garcia". MISMA regla que public.slug_barbero_base
 * (migración 0089): sin tildes, minúsculas, guiones, 40 letras como mucho. Un
 * nombre que empieza por "mostrador" va con prefijo: esa ruta es de las sedes.
 */
export function slugBase(nombre: string): string {
  const sinBordes = (s: string) => s.replace(/^-+|-+$/g, "");
  const s = sinBordes(
    sinBordes(
      (nombre ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-"),
    ).slice(0, LARGO_MAX),
  );
  const v = s || "barbero";
  return v.startsWith("mostrador") ? `barbero-${v}` : v;
}

/** El primero libre: base, base-2, base-3… (lo mismo que hace la base al chocar). */
export function slugLibre(base: string, tomados: Iterable<string>): string {
  return resolverColisionSlug(base, tomados);
}

/**
 * El timestamptz en MICROsegundos, como lo ordena Postgres (Date.parse se queda
 * en milisegundos y dos altas del mismo seed empatarían distinto que en SQL).
 * Sin fecha → al final, como `nulls last`.
 */
export function microsDe(iso: string | null | undefined): number {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  const frac = (/\.(\d+)/.exec(iso ?? "")?.[1] ?? "").padEnd(6, "0");
  return t * 1000 + Number(frac.slice(3, 6));
}

export type FilaSlug = {
  id: string;
  nombre: string;
  /** null = no se sabe: cuenta como activo (igual que `activo is not false` en SQL). */
  activo: boolean | null;
  creadoEn?: string | null;
  slug?: string | null;
};

/**
 * id → slug de TODOS los barberos (activos y de baja). El guardado manda: no
 * cambia aunque le cambien el nombre, porque es el enlace de su app instalada.
 * A los que no tienen (antes de aplicar 0089) se les asigna en el MISMO orden
 * que el backfill de la migración: activos primero, después el más antiguo, y
 * al empatar por id. Así el enlace que se mandó antes de la migración sigue
 * siendo el mismo después.
 */
export function asignarSlugs(filas: FilaSlug[]): Map<string, string> {
  const out = new Map<string, string>();
  const tomados = new Set<string>();
  for (const f of filas) {
    const s = (f.slug ?? "").trim();
    if (s && !tomados.has(s)) {
      out.set(f.id, s);
      tomados.add(s);
    }
  }
  const faltan = filas
    .filter((f) => !out.has(f.id))
    .sort(
      (a, b) =>
        Number(b.activo !== false) - Number(a.activo !== false) ||
        microsDe(a.creadoEn) - microsDe(b.creadoEn) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  for (const f of faltan) {
    const s = slugLibre(slugBase(f.nombre), tomados);
    out.set(f.id, s);
    tomados.add(s);
  }
  return out;
}

// ---------- Rutas ----------

export type RutaPersonal = { tipo: "barbero"; slug: string } | { tipo: "sede"; sedeId: string };

/** El segmento de /equipo/<x>: de un barbero, de un mostrador, o basura (null). */
export function leerRuta(segmento: string | null | undefined): RutaPersonal | null {
  const s = (segmento ?? "").trim().toLowerCase();
  if (!s || s.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) return null;
  if (s.startsWith(PREFIJO_MOSTRADOR)) {
    const sedeId = s.slice(PREFIJO_MOSTRADOR.length);
    return sedeId ? { tipo: "sede", sedeId } : null;
  }
  return { tipo: "barbero", slug: s };
}

export const rutaBarbero = (slug: string) => `/equipo/${slug}`;
export const rutaMostrador = (sedeId: string) => `/equipo/${PREFIJO_MOSTRADOR}${sedeId}`;
export const rutaManifiesto = (ruta: string) => `${ruta}/manifest.webmanifest`;
export const enlaceAbsoluto = (ruta: string) => `${SITIO}${ruta}`;

// ---------- Quién entra ----------

/** De quién es la app: un barbero (su id) o el mostrador de una sede (su id). */
export type DuenoApp = { tipo: "barbero" | "sede"; id: string; nombre: string };

/** Lo que se sabe de la sesión abierta en el aparato (getStaffContext). */
export type SesionEquipo = { rol: string; barberoId: string | null; sedeId: string | null };

/**
 * Qué muestra /equipo/<slug>:
 *  · "suya": la sesión ya es de él → su agenda (en la app instalada, directo).
 *  · "otra": hay OTRA persona del equipo adentro (aparato compartido, o el dueño
 *    probando el enlace) → "Entraste como X", seguir o cambiar.
 *  · "pin": nadie del equipo → su teclado de PIN. Un cliente con Google o una
 *    sesión sin perfil no cuenta como "otra": el PIN abre la sesión de él.
 */
export function entradaPara(s: SesionEquipo, d: Pick<DuenoApp, "tipo" | "id">): "suya" | "otra" | "pin" {
  if (d.tipo === "barbero" && s.rol === "barbero" && s.barberoId === d.id) return "suya";
  if (d.tipo === "sede" && s.rol === "sede" && s.sedeId === d.id) return "suya";
  if (s.rol === "admin" || s.rol === "barbero" || s.rol === "sede") return "otra";
  return "pin";
}

// ---------- La app instalada ----------

/** Primer nombre: "Bryan García" → "Bryan". */
export function nombreCorto(nombre: string): string {
  return (nombre ?? "").trim().split(/\s+/)[0] || "Equipo";
}

/** Lo que dice debajo del ícono (iPhone: apple-mobile-web-app-title; Android: short_name). */
export function tituloApp(d: Pick<DuenoApp, "tipo" | "nombre">): string {
  return d.tipo === "sede" ? "B&B Mostrador" : `B&B ${nombreCorto(d.nombre)}`;
}

/** El nombre largo (Android lo muestra al instalar y en Ajustes). */
export function nombreApp(d: Pick<DuenoApp, "tipo" | "nombre">): string {
  return d.tipo === "sede" ? `Barbas & Bigotes · Mostrador de ${d.nombre}` : `Barbas & Bigotes · ${d.nombre}`;
}

/** Colores e íconos: los MISMOS de public/manifest-staff.json (check-app-personal lo compara). */
export const COLOR_APP = "#0c0b0a";
export const ICONOS_APP = [
  { src: "/brand/icon-192x192.png", sizes: "192x192", type: "image/png" },
  { src: "/brand/icon-512x512.png", sizes: "512x512", type: "image/png" },
  { src: "/brand/icon-512x512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

/**
 * El manifiesto de SU app. `id` propio = Android la trata como otra app que la
 * del equipo o la de clientes (se pueden tener las dos). `scope` "/" para que su
 * agenda (/barbero) abra dentro de la app y no en el navegador.
 */
export function manifiestoPersonal(d: Pick<DuenoApp, "tipo" | "nombre"> & { ruta: string }) {
  return {
    id: d.ruta,
    name: nombreApp(d),
    short_name: tituloApp(d),
    description:
      d.tipo === "sede"
        ? `La app del mostrador de ${d.nombre}: la agenda del local, los cobros y la caja.`
        : `La app de ${nombreCorto(d.nombre)} en Barbas & Bigotes: su agenda, sus turnos y sus cobros.`,
    start_url: d.ruta,
    scope: "/",
    display: "standalone",
    background_color: COLOR_APP,
    theme_color: COLOR_APP,
    orientation: "any",
    lang: "es-CO",
    categories: ["business", "productivity"],
    icons: ICONOS_APP,
  };
}

// ---------- Lo que recuerda el aparato ----------

/** localStorage: "1" (la marca vieja: un aparato del equipo, sin persona) o la ruta del último que entró. */
export const CLAVE_EQUIPO = "bb-equipo";

/** La ruta personal guardada, si es una de verdad. "1", vacío o basura → null (va al login general). */
export function rutaRecordada(valor: string | null | undefined): string | null {
  const m = /^\/equipo\/([^/?#]+)$/.exec(valor ?? "");
  if (!m) return null;
  const r = leerRuta(m[1]);
  if (!r) return null;
  return r.tipo === "sede" ? rutaMostrador(r.sedeId) : rutaBarbero(r.slug);
}

/** Lo que se guarda al entrar: su ruta, o "1" (el dueño no tiene app personal: va a la general). */
export function marcaPara(ruta: string | null | undefined): string {
  return rutaRecordada(ruta) ?? "1";
}

// ---------- Cómo se instala ----------

export type Sistema = "ios" | "android" | "otro";

/** iPhone/iPad (el iPad nuevo dice "Macintosh", pero tiene pantalla táctil), Android o computador. */
export function sistemaDe(ua: string, toques = 0): Sistema {
  const u = ua ?? "";
  if (/iPhone|iPad|iPod/i.test(u) || (/Macintosh/i.test(u) && toques > 1)) return "ios";
  if (/Android/i.test(u)) return "android";
  return "otro";
}

/** Los pasos, en palabras del celular de cada uno. */
export function pasosInstalar(sistema: Sistema): string[] {
  if (sistema === "ios")
    return [
      "Abre este enlace en Safari (si se abrió dentro de otra app, búscale «Abrir en Safari»).",
      "Toca Compartir: el cuadrito con la flecha hacia arriba.",
      "Elige «Agregar a pantalla de inicio» y toca «Agregar».",
    ];
  if (sistema === "android")
    return [
      "Abre este enlace en Chrome (si lo abriste desde WhatsApp, toca ⋮ → «Abrir en Chrome»).",
      "Toca el menú ⋮, arriba a la derecha.",
      "Elige «Instalar app» o «Agregar a pantalla principal».",
    ];
  return ["Abre este enlace en tu celular: desde ahí se agrega a la pantalla de inicio."];
}

// ---------- El mensaje que le manda el dueño ----------

/** El texto de WhatsApp: su enlace, cómo instalarla y que entra con su PIN. */
export function mensajeApp(d: Pick<DuenoApp, "tipo" | "nombre"> & { enlace: string }): string {
  const titulo = tituloApp(d);
  const intro =
    d.tipo === "sede"
      ? `Esta es la app del mostrador de ${d.nombre} (Barbas & Bigotes):`
      : `Hola ${nombreCorto(d.nombre)}, esta es tu app de Barbas & Bigotes:`;
  return [
    intro,
    d.enlace,
    "",
    d.tipo === "sede" ? "Para dejarla en el celular o la tablet del local:" : "Para tenerla en tu celular:",
    "• iPhone: ábrela en Safari → Compartir → «Agregar a pantalla de inicio».",
    "• Android: ábrela en Chrome → menú ⋮ → «Instalar app» (o «Agregar a pantalla principal»).",
    "",
    d.tipo === "sede"
      ? `Después ábrela desde el ícono «${titulo}» y entra con el PIN del local.`
      : `Después ábrela desde el ícono «${titulo}» y entra con tu PIN (el que te di en persona).`,
  ].join("\n");
}

/** wa.me SIN número: el dueño elige a quién (los barberos no tienen teléfono guardado). */
export function linkWhatsAppTexto(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

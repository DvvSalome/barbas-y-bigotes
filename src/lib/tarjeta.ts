// Tarjeta de cortes (fidelización): matemática pura, sin I/O. La usan el cobro
// (completarReserva), el total en vivo del form de cobro, el portal y el admin.
// Mantener libre de imports de Next/Supabase (Node la corre directo en el self-check).
//
// La regla la pone el DUEÑO desde /admin/tarjeta (migración 0064): cuántos cortes
// tiene la tarjeta y qué da cada hito. Antes estaba quemada acá (10 cortes, regalo
// al 5º, 50% al 10º) y cambiarla era un deploy.
//
// Dos cosas que no son obvias y hay que respetar:
//
//   1. El REGALO no es plata: el cliente paga completo y el barbero le entrega
//      algo. Por eso su descuento es 0. Quien consuma esto no puede asumir que
//      "hay beneficio" implique "hay descuento".
//   2. El porcentaje se aplica sobre el SERVICIO QUE SE HIZO (topado a su precio),
//      no sobre un "corte base" de la sede. Antes se calculaba sobre el corte base
//      y a un cliente que se hacía un combo de $60.000 se le descontaba la mitad
//      de $25.000 — el dueño lo pidió al revés.

/** Qué se lleva el cliente en un hito: un regalo, o un % sobre lo que se hizo. */
export type TipoHito = "regalo" | "porcentaje";

export type Hito = {
  /** Posición dentro de la tarjeta (1..tamano). */
  posicion: number;
  tipo: TipoHito;
  /** Porcentaje 1..100 cuando tipo = 'porcentaje'; ignorado en 'regalo'. */
  valor: number;
};

export type ConfigTarjeta = { tamano: number; hitos: Hito[] };

/**
 * Etiqueta del beneficio tal como se guarda en `ventas.beneficio_tarjeta` y como
 * se muestra: "regalo" o "50%". Es un string y no una unión cerrada a propósito —
 * el porcentaje ahora lo elige el dueño, y las ventas viejas ya guardaron "50%".
 */
export type BeneficioTarjeta = string;

/** Lo que había quemado en el código, y lo que se usa si la config no carga. */
export const TARJETA_DEFECTO: ConfigTarjeta = {
  tamano: 10,
  hitos: [
    { posicion: 5, tipo: "regalo", valor: 0 },
    { posicion: 10, tipo: "porcentaje", valor: 50 },
  ],
};

export const TARJETA_MIN = 3;
export const TARJETA_MAX = 20;

/**
 * Valida una config que viene de la base (jsonb: puede tener cualquier forma) o
 * de un formulario. Devuelve null si no sirve, para que el llamador decida —
 * guardar una tarjeta rota significaría premios que no se entregan o descuentos
 * que no existen, y eso se descubre con el cliente adelante.
 */
export function sanearConfigTarjeta(raw: unknown): ConfigTarjeta | null {
  const o = raw as { tamano?: unknown; hitos?: unknown } | null;
  const tamano = Math.round(Number(o?.tamano));
  if (!Number.isFinite(tamano) || tamano < TARJETA_MIN || tamano > TARJETA_MAX) return null;
  if (!Array.isArray(o?.hitos)) return null;

  const hitos: Hito[] = [];
  for (const h of o.hitos as unknown[]) {
    const x = h as { posicion?: unknown; tipo?: unknown; valor?: unknown };
    const posicion = Math.round(Number(x?.posicion));
    if (!Number.isFinite(posicion) || posicion < 1 || posicion > tamano) return null;
    // Dos premios en la misma posición: el cobro tendría que elegir uno y sería
    // el orden del array quien decida. Mejor rechazarlo al guardar.
    if (hitos.some((y) => y.posicion === posicion)) return null;
    if (x?.tipo !== "regalo" && x?.tipo !== "porcentaje") return null;
    const valor = x.tipo === "porcentaje" ? Math.round(Number(x?.valor)) : 0;
    if (x.tipo === "porcentaje" && (!Number.isFinite(valor) || valor < 1 || valor > 100)) return null;
    hitos.push({ posicion, tipo: x.tipo, valor });
  }
  if (hitos.length === 0) return null; // una tarjeta sin premios no es una tarjeta
  hitos.sort((a, b) => a.posicion - b.posicion);
  return { tamano, hitos };
}

/** Etiqueta guardable/mostrable de un hito: "regalo" o "50%". */
export const etiquetaHito = (h: Hito): BeneficioTarjeta => (h.tipo === "regalo" ? "regalo" : `${h.valor}%`);

/**
 * Beneficio del PRÓXIMO corte, dado cuántos lleva el cliente y el precio del
 * servicio que se le está cobrando.
 *
 * `descuento` es el monto a descontar (0 en el regalo). Ya viene topado al precio
 * del servicio: un 100% no puede descontar más de lo que costó.
 */
export function beneficioProximoCorte(
  cortesPrevios: number,
  precioServicio: number,
  cfg: ConfigTarjeta = TARJETA_DEFECTO,
): { tipo: BeneficioTarjeta | null; descuento: number; posicion: number } {
  const posicion = (Math.max(0, Math.floor(cortesPrevios)) % cfg.tamano) + 1; // 1..tamano
  const hito = cfg.hitos.find((h) => h.posicion === posicion);
  if (!hito) return { tipo: null, descuento: 0, posicion };
  if (hito.tipo === "regalo") return { tipo: "regalo", descuento: 0, posicion };
  // Precio inválido (0, ausente, NaN) → descuento 0 explícito, no Math.floor(NaN):
  // el hito igual se anuncia, pero no se inventa plata que descontar.
  const base = Number(precioServicio);
  const descuento = Number.isFinite(base) && base > 0 ? Math.min(Math.floor((base * hito.valor) / 100), base) : 0;
  return { tipo: etiquetaHito(hito), descuento, posicion };
}

/** Estado de la tarjeta para mostrar: sellos llenos y cuál es el próximo premio. */
export function estadoTarjeta(
  cortesTotales: number,
  cfg: ConfigTarjeta = TARJETA_DEFECTO,
): {
  sellos: number;
  cortesTotales: number;
  /** null solo si la tarjeta no tiene ningún hito por delante (config vacía). */
  proximo: { tipo: BeneficioTarjeta; faltan: number; posicion: number } | null;
} {
  const total = Math.max(0, Math.floor(cortesTotales));
  const sellos = total % cfg.tamano; // 0..tamano-1
  // El próximo hito por delante; si ya pasaron todos, el primero del ciclo que viene.
  const siguiente = cfg.hitos.find((h) => h.posicion > sellos) ?? cfg.hitos[0];
  if (!siguiente) return { sellos, cortesTotales: total, proximo: null };
  const faltan =
    siguiente.posicion > sellos
      ? siguiente.posicion - sellos
      : cfg.tamano - sellos + siguiente.posicion;
  return {
    sellos,
    cortesTotales: total,
    proximo: { tipo: etiquetaHito(siguiente), faltan, posicion: siguiente.posicion },
  };
}

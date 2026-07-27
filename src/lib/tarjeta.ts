// Tarjeta de cortes (fidelización): matemática pura, sin I/O. La usan el cobro
// (completarReserva), el total en vivo del form de cobro, el portal y el admin.
// Mantener libre de imports de Next/Supabase (Node la corre directo en el self-check).
//
// Regla (la fija el dueño): tarjeta de 10 cortes. El 5º corte del ciclo se lleva
// un REGALO y el 10º va al 50%. Al completarla se reinicia. 1 sello por venta
// con corte.
//
// OJO — el regalo NO es plata: el cliente paga el corte completo y el barbero le
// entrega algo. Por eso `descuento` es 0 en el 5º. Quien consuma esto no puede
// asumir que "hay beneficio" implique "hay descuento": el único hito que mueve
// el total es el 50% del 10º, topado al precio del corte de la venta.

export const TARJETA_SIZE = 10;
export const HITO_REGALO = 5; // 5º corte: regalo (no descuenta)
export const HITO_50 = 10; // 10º corte: 50% sobre el corte

/** Qué se lleva el cliente en un hito. `regalo` no descuenta plata. */
export type BeneficioTarjeta = "regalo" | "50%";

// Servicios de categoría 'cortes'/'combos' que NO son un corte completo (flequillos).
export const CERQUILLO_EXCLUIDOS = new Set(["cerquillo", "cerquillos", "cerquillo-barba"]);

// Beneficio del PRÓXIMO corte dado cuántos cortes ya hizo el cliente y el precio
// del corte base de la sede. `descuento` es el monto a descontar (topar afuera al
// precio real de la línea de corte de la venta); en el regalo es 0 a propósito.
export function beneficioProximoCorte(
  cortesPrevios: number,
  baseCorte: number,
): { tipo: BeneficioTarjeta | null; descuento: number; posicion: number } {
  const posicion = (cortesPrevios % TARJETA_SIZE) + 1; // 1..10
  if (posicion === HITO_REGALO) return { tipo: "regalo", descuento: 0, posicion };
  if (posicion === HITO_50) return { tipo: "50%", descuento: Math.floor(baseCorte / 2), posicion };
  return { tipo: null, descuento: 0, posicion };
}

// Estado de la tarjeta para mostrar: sellos llenos (0..9) y el próximo premio.
export function estadoTarjeta(cortesTotales: number): {
  sellos: number;
  cortesTotales: number;
  proximo: { tipo: BeneficioTarjeta; faltan: number };
} {
  const sellos = cortesTotales % TARJETA_SIZE; // 0..9
  const proximo =
    sellos < HITO_REGALO
      ? { tipo: "regalo" as const, faltan: HITO_REGALO - sellos }
      : { tipo: "50%" as const, faltan: HITO_50 - sellos };
  return { sellos, cortesTotales, proximo };
}

// Tarjeta de cortes (fidelización): matemática pura, sin I/O. La usan el cobro
// (completarReserva), el total en vivo del form de cobro, el portal y el admin.
// Mantener libre de imports de Next/Supabase (Node la corre directo en el self-check).
//
// Regla: tarjeta de 10 cortes; el 5º corte del ciclo tiene 50% y el 10º es gratis;
// al completarla se reinicia. 1 sello por venta con corte. El beneficio aplica al
// corte, topado al precio del corte base de la sede.

export const TARJETA_SIZE = 10;
export const HITO_50 = 5; // 5º corte: 50%
export const HITO_GRATIS = 10; // 10º corte: gratis

// Servicios de categoría 'cortes'/'combos' que NO son un corte completo (flequillos).
export const CERQUILLO_EXCLUIDOS = new Set(["cerquillo", "cerquillos", "cerquillo-barba"]);

// Beneficio del PRÓXIMO corte dado cuántos cortes ya hizo el cliente y el precio
// del corte base de la sede. `descuento` es el monto a descontar (topar afuera al
// precio real de la línea de corte de la venta).
export function beneficioProximoCorte(
  cortesPrevios: number,
  baseCorte: number,
): { tipo: "50%" | "gratis" | null; descuento: number; posicion: number } {
  const posicion = (cortesPrevios % TARJETA_SIZE) + 1; // 1..10
  if (posicion === HITO_50) return { tipo: "50%", descuento: Math.floor(baseCorte / 2), posicion };
  if (posicion === HITO_GRATIS) return { tipo: "gratis", descuento: baseCorte, posicion };
  return { tipo: null, descuento: 0, posicion };
}

// Estado de la tarjeta para mostrar: sellos llenos (0..9) y el próximo premio.
export function estadoTarjeta(cortesTotales: number): {
  sellos: number;
  cortesTotales: number;
  proximo: { tipo: "50%" | "gratis"; faltan: number };
} {
  const sellos = cortesTotales % TARJETA_SIZE; // 0..9
  const proximo =
    sellos < HITO_50
      ? { tipo: "50%" as const, faltan: HITO_50 - sellos }
      : { tipo: "gratis" as const, faltan: HITO_GRATIS - sellos };
  return { sellos, cortesTotales, proximo };
}

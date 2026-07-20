// Utilidades de agendamiento compartidas (wizard público + reagendar del portal).
// Módulo plano: sin "use client"/"use server"; seguro importar desde ambos lados.

export const OPEN = 9 * 60;   // 09:00
export const CLOSE = 20 * 60; // 20:00
export const STEP = 30;       // minutos entre inicios de slot

// Ventana mínima para cancelar/reagendar online (horas). Regla de negocio única.
export const CANCELACION_MIN_HORAS = 2;

// "Llegó" solo se habilita cuando faltan como mucho estas horas para la cita. En
// el mostrador hay varias tarjetas juntas; sin este tope, un clic en la del turno
// de la tarde cerraba esa cita como venta de ahora. El servidor la re-chequea.
export const MARGEN_LLEGADA_HORAS = 2;

// ¿Todavía es muy temprano para marcar "Llegó"? (mismo criterio en UI y server).
// Devuelve la etiqueta "faltan Xh"/"faltan Xm" para el botón deshabilitado, o null
// si ya se puede marcar.
export function faltaParaLlegar(inicioISO: string, ahoraMs: number): string | null {
  const faltanMs = new Date(inicioISO).getTime() - ahoraMs;
  if (faltanMs <= MARGEN_LLEGADA_HORAS * 3600_000) return null;
  const min = Math.round(faltanMs / 60000);
  return min >= 120 ? `faltan ${Math.round(min / 60)}h` : `faltan ${min}m`;
}

// Disponibilidad guiada por la silla real: una cita EN CURSO (el barbero marcó
// "Llegó") mantiene ocupada la silla hasta que la cierra ("Completar"), aunque se
// pase del fin estimado. Red de olvido: si no la cierra, se libera sola pasado
// estimado + esta gracia (marcar "Completar" es cuando cobra, así que rara vez se
// olvida; esto solo evita congelar la agenda).
export const EN_CURSO_GRACIA_MIN = 60;

// Fin EFECTIVO de una reserva para calcular disponibilidad. Trabaja con instantes
// absolutos (no minutos-del-día), así que es TZ-safe. Puro y testeable.
export function finEfectivo(estado: string, finISO: string, ahoraMs: number): string {
  const fin = new Date(finISO).getTime();
  if (estado === "en_curso" && ahoraMs > fin) {
    // Rueda con el tiempo real mientras la silla sigue ocupada, con tope de gracia.
    return new Date(Math.min(ahoraMs, fin + EN_CURSO_GRACIA_MIN * 60000)).toISOString();
  }
  return finISO;
}

export const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const MON = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function fmtTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ap = h < 12 ? "am" : "pm";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m.toString().padStart(2, "0")} ${ap}`;
}

export function fmtDur(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

// Slots de inicio válidos (min-desde-medianoche) para un servicio de `duracionMin`.
export function buildSlots(duracionMin: number): number[] {
  const out: number[] = [];
  for (let t = OPEN; t + duracionMin <= CLOSE; t += STEP) out.push(t);
  return out;
}

// Slots ocupados: solapan un rango ocupado, o ya pasaron si `day` es hoy.
export function computeTaken(params: {
  slots: number[];
  ocupados: { inicio: string; fin: string }[];
  day: Date;
  duracionMin: number;
}): Set<number> {
  const { slots, ocupados, day, duracionMin } = params;
  const s = new Set<number>();
  for (const o of ocupados) {
    const oi = new Date(o.inicio);
    const of = new Date(o.fin);
    const startMin = oi.getHours() * 60 + oi.getMinutes();
    const endMin = of.getHours() * 60 + of.getMinutes();
    for (const t of slots) {
      if (t < endMin && t + duracionMin > startMin) s.add(t);
    }
  }
  const now = new Date();
  if (day.toDateString() === now.toDateString()) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    for (const t of slots) if (t <= nowMin) s.add(t);
  }
  return s;
}

// ---- Día civil en Bogotá (UTC-5 fijo, Colombia no tiene DST) ----
// Los servers de Vercel corren en UTC: NUNCA usar setHours(0,0,0,0) para
// "hoy" en código server. Estos helpers no dependen del TZ del proceso.

// Fecha civil YYYY-MM-DD en Bogotá del instante `base`.
export function bogotaYmd(base: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(base);
}

// Rango [00:00, 24:00) en Bogotá del día civil que contiene a `base`.
export function bogotaDayRange(base: Date = new Date()): { desde: Date; hasta: Date } {
  return bogotaDayRangeDeFecha(bogotaYmd(base));
}

// Igual, pero para una fecha civil `YYYY-MM-DD` explícita (p.ej. la del wizard).
export function bogotaDayRangeDeFecha(ymd: string): { desde: Date; hasta: Date } {
  const desde = new Date(`${ymd}T00:00:00-05:00`);
  return { desde, hasta: new Date(desde.getTime() + 86_400_000) };
}

export function nextDays(n: number): Date[] {
  const out: Date[] = [];
  const base = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push(d);
  }
  return out;
}

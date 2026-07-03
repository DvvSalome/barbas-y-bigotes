// Utilidades de agendamiento compartidas (wizard público + reagendar del portal).
// Módulo plano: sin "use client"/"use server"; seguro importar desde ambos lados.

export const OPEN = 9 * 60;   // 09:00
export const CLOSE = 20 * 60; // 20:00
export const STEP = 30;       // minutos entre inicios de slot

// Ventana mínima para cancelar/reagendar online (horas). Regla de negocio única.
export const CANCELACION_MIN_HORAS = 2;

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

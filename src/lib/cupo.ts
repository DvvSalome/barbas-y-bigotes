// «Próximo cupo online»: el primer turno reservable de un barbero, calculado con
// EXACTAMENTE las mismas piezas que el wizard (slotsDisponibles sobre la ventana
// del día, solape contra lo ocupado). Módulo puro: lo prueba scripts/check-cupo.ts
// y lo usan la ruta /api/cupo (servidor) y los chips de la home (navegador).
//
// Importa slots con extensión .ts a propósito: así node lo corre sin bundler en
// el chequeo (tsconfig tiene allowImportingTsExtensions).
import {
  slotsDisponibles,
  chocaConOcupados,
  instanteBogota,
  horarioEfectivo,
  bogotaYmd,
  dowDeFecha,
  fmtTime,
  MON,
  type HorarioDia,
  type ExcepcionDia,
  type VentanaDia,
} from "./slots.ts";

export type Ocupado = { inicio: string; fin: string };
export type Cupo = { fecha: string; minuto: number };

/** Lo que responde GET /api/cupo (y leen los chips de la home). */
export type RespuestaCupo = {
  generado: string;
  hoy: string;
  duracionMin: number;
  barberos: { id: string; sede: string; cupo: Cupo | null }[];
  /** El más temprano de cada sede, con quién. */
  sedes: Record<string, { cupo: Cupo; barbero: string } | null>;
  /** El más temprano de todos. */
  mejor: { sede: string; barbero: string; cupo: Cupo } | null;
};

/** Antelación mínima del chip. createReserva solo exige "más tarde que ahora",
 *  pero ofrecer "hoy 2:35 pm" a las 2:31 no le sirve a nadie: un paso de grilla. */
export const MARGEN_CUPO_MIN = 15;
/** Hasta cuántos días adelante se busca (el wizard ofrece 6 días abiertos en 21). */
export const DIAS_CUPO = 14;

/** Primer turno reservable del día `ymd` con esa ventana y esos ocupados; null si
 *  el día está cerrado o lleno. `ahoraMs` decide qué ya pasó (solo pesa hoy). */
export function primerCupoDelDia(
  ymd: string,
  ventana: VentanaDia,
  ocupados: Ocupado[],
  duracionMin: number,
  ahoraMs: number,
): number | null {
  if (!ventana.abierta) return null;
  const limite = ahoraMs + MARGEN_CUPO_MIN * 60_000;
  for (const t of slotsDisponibles(duracionMin, ventana.abreMin, ventana.cierraMin, ocupados)) {
    if (instanteBogota(ymd, t).getTime() < limite) continue;
    if (chocaConOcupados(t, duracionMin, ocupados)) continue;
    return t;
  }
  return null;
}

/** ymd + n días, en calendario de Bogotá. */
export function sumarDias(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00-05:00`);
  d.setUTCDate(d.getUTCDate() + n);
  return bogotaYmd(d);
}

/**
 * El próximo cupo de un barbero: recorre desde hoy hasta DIAS_CUPO días. Para
 * cada día pide los ocupados con `ocupadosDe(ymd)`; si devuelve null el barbero
 * no atiende ese día (ausencia entera) y se salta.
 */
export function proximoCupo(opts: {
  hoy: string;
  ahoraMs: number;
  duracionMin: number;
  semanal: HorarioDia[];
  especiales: ExcepcionDia[];
  ocupadosDe: (ymd: string) => Ocupado[] | null;
  dias?: number;
}): Cupo | null {
  const dias = opts.dias ?? DIAS_CUPO;
  for (let i = 0; i < dias; i++) {
    const ymd = sumarDias(opts.hoy, i);
    const ventana = horarioEfectivo(ymd, opts.semanal, opts.especiales);
    if (!ventana.abierta) continue;
    const ocupados = opts.ocupadosDe(ymd);
    if (ocupados === null) continue;
    const minuto = primerCupoDelDia(ymd, ventana, ocupados, opts.duracionMin, opts.ahoraMs);
    if (minuto !== null) return { fecha: ymd, minuto };
  }
  return null;
}

const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** "hoy 3:30 pm" · "mañana 9:00 am" · "el lunes 9:00 am" · "el 3 oct 9:00 am". */
export function textoCupo(cupo: Cupo, hoy: string): string {
  const hora = fmtTime(cupo.minuto);
  if (cupo.fecha === hoy) return `hoy ${hora}`;
  if (cupo.fecha === sumarDias(hoy, 1)) return `mañana ${hora}`;
  for (let i = 2; i < 7; i++) {
    if (cupo.fecha === sumarDias(hoy, i)) return `el ${DIAS_LARGOS[dowDeFecha(cupo.fecha)]} ${hora}`;
  }
  const [, m, d] = cupo.fecha.split("-").map(Number);
  return `el ${d} ${MON[m - 1]} ${hora}`;
}

/** "15:30": lo que viaja en ?hora= del enlace al wizard. */
export function horaParam(minuto: number): string {
  return `${String(Math.floor(minuto / 60)).padStart(2, "0")}:${String(minuto % 60).padStart(2, "0")}`;
}

/** Lo que el wizard acepta de ?fecha= y ?hora=: una fecha real dentro de la
 *  ventana de reserva y una hora en el grano de la grilla. Todo lo raro → null. */
export function leerFechaHora(fecha: string | undefined, hora: string | undefined, hoy: string): { fecha: string; minuto: number } | null {
  if (!fecha || !hora || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) return null;
  if (fecha < hoy || fecha > sumarDias(hoy, 21)) return null;
  const [h, m] = hora.split(":").map(Number);
  if (h > 23 || m > 59 || m % 5 !== 0) return null;
  return { fecha, minuto: h * 60 + m };
}

/** ?desde= de la landing: minúsculas, dígitos y guiones, corto. */
export function leerOrigenWeb(desde: string | undefined): string | undefined {
  return desde && /^[a-z0-9-]{1,40}$/.test(desde) ? desde : undefined;
}

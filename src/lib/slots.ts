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

// Slots de inicio válidos (min-desde-medianoche) para un servicio de `duracionMin`,
// dentro de la ventana [abreMin, cierraMin]. Por defecto la ventana fija de siempre
// (9-20), para que los llamadores que aún no pasan horas se comporten igual.
export function buildSlots(duracionMin: number, abreMin: number = OPEN, cierraMin: number = CLOSE): number[] {
  const out: number[] = [];
  for (let t = abreMin; t + duracionMin <= cierraMin; t += STEP) out.push(t);
  return out;
}

// ---- Horario efectivo por sede/fecha (fuente de verdad única) ----
// El horario real de un día sale de resolver, en cascada: la excepción de esa
// fecha (sede_dias_especiales) → el horario base de ese día de semana
// (sede_horario_semanal) → el respaldo quemado (9-20, domingo cerrado) por si las
// tablas todavía no existen o no tienen la fila. La MISMA función la usan el
// cliente (para armar los turnos) y el servidor (para validar la reserva), así no
// se pueden desincronizar.

export type HorarioDia = { dow: number; abierta: boolean; abreMin: number; cierraMin: number };
export type ExcepcionDia = { fecha: string; abierta: boolean; abreMin: number | null; cierraMin: number | null };
export type VentanaDia = { abierta: boolean; abreMin: number; cierraMin: number };

// Día de la semana (0=domingo..6=sábado) de un YYYY-MM-DD, anclado a mediodía UTC
// para no cruzar de día por el huso (Bogotá es UTC-5). Mismo criterio que usaba
// createReserva para "¿es domingo?".
export function dowDeFecha(fechaYmd: string): number {
  return new Date(`${fechaYmd}T12:00:00Z`).getUTCDay();
}

export function horarioEfectivo(
  fechaYmd: string,
  semanal: HorarioDia[],
  especiales: ExcepcionDia[],
): VentanaDia {
  const dow = dowDeFecha(fechaYmd);
  const base = semanal.find((h) => h.dow === dow) ?? null;
  const exc = especiales.find((e) => e.fecha === fechaYmd) ?? null;
  if (exc) {
    if (!exc.abierta) return { abierta: false, abreMin: OPEN, cierraMin: CLOSE };
    // Excepción abierta: sus horas propias; si no las trae, cae en las de la
    // semana y, en última instancia, en el respaldo fijo.
    return {
      abierta: true,
      abreMin: exc.abreMin ?? base?.abreMin ?? OPEN,
      cierraMin: exc.cierraMin ?? base?.cierraMin ?? CLOSE,
    };
  }
  if (base) return { abierta: base.abierta, abreMin: base.abreMin, cierraMin: base.cierraMin };
  // Respaldo: el comportamiento de siempre (domingo cerrado, 9-20).
  return { abierta: dow !== 0, abreMin: OPEN, cierraMin: CLOSE };
}

// Resume el horario BASE de la semana en filas legibles para el bloque público
// "Horarios de atención", agrupando días consecutivos con la misma ventana:
// [{dias:"Lun a Sáb", horas:"9:00 am a 8:00 pm"}, {dias:"Dom", horas:"Cerrado"}].
// Solo mira la base semanal (las excepciones de fecha se listan aparte). Puro.
export function resumirSemana(semanal: HorarioDia[]): { dias: string; horas: string }[] {
  const orden = [1, 2, 3, 4, 5, 6, 0]; // lunes primero, como uno lee la semana
  const celda = (dow: number): string => {
    const base = semanal.find((h) => h.dow === dow);
    if (base) return base.abierta ? `${fmtTime(base.abreMin)} a ${fmtTime(base.cierraMin)}` : "Cerrado";
    // Respaldo si la tabla no tiene la fila (migración sin aplicar): 9-20, dom cerrado.
    return dow !== 0 ? `${fmtTime(OPEN)} a ${fmtTime(CLOSE)}` : "Cerrado";
  };
  const filas: { dias: string; horas: string }[] = [];
  let inicio: number | null = null;
  for (let i = 0; i < orden.length; i++) {
    const dow = orden[i];
    if (inicio === null) inicio = dow;
    const horas = celda(dow);
    const siguiente = i + 1 < orden.length ? celda(orden[i + 1]) : null;
    if (horas !== siguiente) {
      filas.push({ dias: inicio === dow ? DOW[dow] : `${DOW[inicio]} a ${DOW[dow]}`, horas });
      inicio = null;
    }
  }
  return filas;
}

// ¿Un inicio (min-del-día) cae en un slot válido de esta ventana? Lo usa el
// servidor para blindar el POST directo con el MISMO criterio que buildSlots
// (alineado a abreMin, no a OPEN, porque la ventana puede empezar a otra hora).
export function slotEnVentana(minInicio: number, duracionMin: number, v: VentanaDia): boolean {
  return (
    v.abierta &&
    minInicio >= v.abreMin &&
    minInicio + duracionMin <= v.cierraMin &&
    (minInicio - v.abreMin) % STEP === 0
  );
}

// Minuto-del-día (0..1439) de un instante EN Bogotá, sin depender del TZ del
// proceso/dispositivo. En Vercel (UTC) o en un teléfono con otra TZ, getHours()
// devolvía la hora local y corría toda la disponibilidad; Intl con timeZone fijo
// lo ancla a Colombia (UTC-5, sin DST). hourCycle 'h23' evita el "24:00".
function minutoBogota(instante: Date): number {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instante);
  const h = Number(p.find((x) => x.type === "hour")?.value);
  const m = Number(p.find((x) => x.type === "minute")?.value);
  return h * 60 + m;
}

// Fecha civil YYYY-MM-DD de un Date tomando sus componentes LOCALES (el mismo
// criterio con que nextDays arma los chips y con que la UI los rotula). Así el
// "¿es hoy?" no corre el DÍA respecto a lo que ve el usuario.
function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// Slots ocupados: solapan un rango ocupado, o ya pasaron si `day` es hoy.
// Toda la matemática de hora se fija a America/Bogota (ver minutoBogota): con la
// TZ del dispositivo la disponibilidad salía corrida y las ausencias/OPEN/CLOSE
// no matcheaban en el server (UTC) ni en teléfonos fuera de Colombia.
export function computeTaken(params: {
  slots: number[];
  ocupados: { inicio: string; fin: string }[];
  day: Date;
  duracionMin: number;
}): Set<number> {
  const { slots, ocupados, day, duracionMin } = params;
  const s = new Set<number>();
  for (const o of ocupados) {
    const startMin = minutoBogota(new Date(o.inicio));
    const endMin = minutoBogota(new Date(o.fin));
    for (const t of slots) {
      if (t < endMin && t + duracionMin > startMin) s.add(t);
    }
  }
  const now = new Date();
  if (ymdLocal(day) === bogotaYmd(now)) {
    const nowMin = minutoBogota(now);
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

// ---------- Rangos de período para los reportes de /admin/metricas ----------
export type Periodo = "mes" | "30d" | "90d";

/**
 * Rango del período + el rango anterior del MISMO largo, para comparar peras con
 * peras. Devuelve [prevDesde, prevHasta) explícitos (no solo prevDesde) porque en
 * "mes" el comparativo NO termina donde arranca el actual. Vive acá con el resto de
 * la matemática de fechas de Bogotá (y no en queries.ts) para que sea verificable
 * sin levantar Supabase — ver check-metricas.
 */
export function rangoPeriodo(p: Periodo, ahora: Date = new Date()): {
  desde: Date;
  hasta: Date;
  prevDesde: Date;
  prevHasta: Date;
} {
  const hasta = new Date(ahora);
  if (p === "mes") {
    // Del 1° a hoy. El comparativo son los MISMOS DÍAS del mes pasado: el 1° del mes
    // anterior + lo transcurrido este mes (ej. 1–12 jun vs 1–12 jul). Comparar contra
    // la COLA del mes anterior (que arrastra la quincena de cierre) sesgaba a "vas
    // peor" toda la primera parte del mes — el bug que este cálculo debía evitar.
    const [y, m] = bogotaYmd(hasta).split("-").map(Number);
    const desde = bogotaDayRangeDeFecha(`${y}-${String(m).padStart(2, "0")}-01`).desde;
    const prevYm = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    const prevDesde = bogotaDayRangeDeFecha(`${prevYm}-01`).desde;
    const prevHasta = new Date(prevDesde.getTime() + (hasta.getTime() - desde.getTime()));
    return { desde, hasta, prevDesde, prevHasta };
  }
  // Ventanas móviles (30d/90d): el comparativo son los N días JUSTO antes; termina
  // donde arranca el actual.
  const desde = new Date(hasta.getTime() - (p === "30d" ? 30 : 90) * 86_400_000);
  const largo = hasta.getTime() - desde.getTime();
  return { desde, hasta, prevDesde: new Date(desde.getTime() - largo), prevHasta: desde };
}

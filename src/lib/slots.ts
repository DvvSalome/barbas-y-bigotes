// Utilidades de agendamiento compartidas (wizard público + reagendar del portal).
// Módulo plano: sin "use client"/"use server"; seguro importar desde ambos lados.

export const OPEN = 9 * 60;   // 09:00
export const CLOSE = 20 * 60; // 20:00

// Minutos entre inicios de la grilla. Estuvo en 30 y le costaba silla al local:
// una barba dura 20 minutos y quemaba media hora, y un corte+barba de 50 no cabía
// donde la grilla decía que cabía. Con 15 la grilla se acerca a las duraciones
// reales; lo que termina de cerrar los huecos es `slotsDisponibles` (abajo), que
// además ofrece el turno pegado al fin de la cita anterior.
export const STEP = 15;

// Granularidad mínima de un inicio: 5 minutos. No es estética — es el contrato
// entre lo que la pantalla ofrece y lo que `slotEnVentana` acepta en el servidor.
// Sin él, encadenar tras una cita que terminó 2:43 ofrecería un turno que el
// servidor rechaza.
export const GRANO_MIN = 5;

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

/**
 * Turnos que se le ofrecen al cliente: la grilla MÁS el instante en que se
 * desocupa la silla.
 *
 * Por qué existe: con grilla sola, una barba que termina 2:40 empuja al
 * siguiente cliente a las 2:45 y esos 5 minutos no los usa nadie. Sumando el fin
 * de cada cita como candidato, los turnos se pegan unos a otros y el día rinde.
 *
 * Los candidatos encadenados se alinean al grano de 5 minutos CONTADO DESDE LA
 * APERTURA, que es exactamente lo que valida `slotEnVentana`: ofrecer un 2:43
 * que el servidor va a rechazar es peor que ofrecer 2:45.
 *
 * `ocupados` son los mismos intervalos que ya maneja `computeTaken` (los que
 * devuelve getDisponibilidad), así que quien tiene una lista tiene la otra. Los
 * candidatos que choquen con la cita siguiente los apaga `computeTaken`: acá solo
 * se PROPONEN inicios, no se decide si están libres.
 */
export function slotsDisponibles(
  duracionMin: number,
  abreMin: number,
  cierraMin: number,
  ocupados: { inicio: string; fin: string }[],
): number[] {
  const encadenados = ocupados
    .map((o) => {
      const fin = minutoBogota(new Date(o.fin));
      // Hacia ARRIBA: redondear hacia abajo metería el turno nuevo dentro del
      // anterior y el solape lo rebotaría la base.
      return abreMin + Math.ceil((fin - abreMin) / GRANO_MIN) * GRANO_MIN;
    })
    .filter((t) => t >= abreMin && t + duracionMin <= cierraMin);
  return [...new Set([...buildSlots(duracionMin, abreMin, cierraMin), ...encadenados])].sort(
    (a, b) => a - b,
  );
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

// ¿Un inicio (min-del-día) es válido en esta ventana? Lo usa el servidor para
// blindar el POST directo.
//
// Antes exigía caer en la grilla (`% STEP`). Ya no puede: los turnos que se
// ofrecen dependen de las citas del día (ver slotsDisponibles) y el mostrador
// agenda a la hora que sea (2:40 porque el cliente llegó 2:40). Re-derivar acá el
// conjunto exacto de inicios ofrecidos costaría una consulta más y volvería a
// desincronizar pantalla y servidor.
// Queda lo que de verdad protege: que el servicio quepa dentro del horario de
// atención y que la hora sea una hora redonda al grano de 5 (nada de 2:43:17
// llegado por POST). Que no pise otra cita lo garantiza el EXCLUDE
// `reservas_no_overlap` de la base, no esta función.
export function slotEnVentana(minInicio: number, duracionMin: number, v: VentanaDia): boolean {
  return (
    v.abierta &&
    minInicio >= v.abreMin &&
    minInicio + duracionMin <= v.cierraMin &&
    (minInicio - v.abreMin) % GRANO_MIN === 0
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

/** ¿Ese día+minuto (en Bogotá) ya quedó atrás? Para el aviso "ya pasó" del form
 *  del mostrador (el React Compiler no deja llamar Date.now() en el render). */
export function instantePasado(ymd: string, minuto: number): boolean {
  return instanteBogota(ymd, minuto).getTime() <= Date.now();
}

/** ¿[minInicio, minInicio+dur) pisa alguno de los rangos ocupados? Es el mismo
 *  solape de computeTaken pero SIN el "ya pasó": el mostrador también registra
 *  cortes ya hechos (la cita de ayer que se olvidó anotar) y necesita separar
 *  "ocupado" (bloquea de verdad) de "pasado" (se permite, solo se avisa). */
export function chocaConOcupados(
  minInicio: number,
  duracionMin: number,
  ocupados: { inicio: string; fin: string }[],
): boolean {
  return ocupados.some((o) => {
    const a = minutoBogota(new Date(o.inicio));
    const b = minutoBogota(new Date(o.fin));
    return minInicio < b && minInicio + duracionMin > a;
  });
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

// Instante UTC de un minuto-del-día EN Bogotá (UTC-5 fijo, sin DST). TZ-SAFE: no
// depende del reloj del dispositivo. El wizard y el reagendar armaban la hora con
// `new Date(day).setHours(min)`, que interpreta en la TZ LOCAL del teléfono: en un
// dispositivo fuera de Colombia el instante enviado se corría (se reservaba otra hora).
export function instanteBogota(fechaYmd: string, minutoDia: number): Date {
  const hh = Math.floor(minutoDia / 60).toString().padStart(2, "0");
  const mm = (minutoDia % 60).toString().padStart(2, "0");
  return new Date(`${fechaYmd}T${hh}:${mm}:00-05:00`);
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
// 7d y 365d se agregaron a pedido del dueño: quería mirar la semana y el año,
// no solo el mes. Son ventanas móviles, así que entran en la misma rama.
//
// La lista vive acá y es UNA sola: el export a Excel tenía su propia copia
// escrita a mano (["mes","30d","90d"]) y al agregar Semana y Año se quedó vieja
// en silencio — mirabas el año, dabas Excel y bajaba el mes.
export const PERIODOS_VALIDOS = ["7d", "mes", "30d", "90d", "365d"] as const;
export type Periodo = (typeof PERIODOS_VALIDOS)[number];
export const esPeriodo = (v: unknown): v is Periodo =>
  typeof v === "string" && (PERIODOS_VALIDOS as readonly string[]).includes(v);

/**
 * La semana (lunes a domingo) que contiene a `ymd`, como fechas civiles de Bogotá.
 * La liquidación del barbero se paga por semana y el dueño la navega hacia atrás;
 * esto vive acá con el resto de la matemática de fechas para que no se re-derive
 * en la pantalla (regla del repo) y se pueda verificar sin levantar Supabase.
 *
 * Lunes primero porque así se paga y así se lee la semana en el local, no domingo
 * como asume getDay().
 */
export function semanaDeFecha(ymd: string): { desdeYmd: string; hastaYmd: string } {
  const dow = dowDeFecha(ymd); // 0=domingo
  const alLunes = dow === 0 ? 6 : dow - 1; // domingo cierra la semana, no la abre
  const base = new Date(`${ymd}T12:00:00Z`);
  const lunes = new Date(base.getTime() - alLunes * 86_400_000);
  const domingo = new Date(lunes.getTime() + 6 * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { desdeYmd: iso(lunes), hastaYmd: iso(domingo) };
}

/**
 * Rango a la medida para el export: [desde 00:00, hasta 24:00) en Bogotá, con
 * `hasta` INCLUSIVE — quien pide "hasta el 31" espera el 31 adentro, y dejarlo
 * afuera le corta el último día del corte sin que se note.
 * Devuelve null si no son fechas o vienen al revés: el llamador corta ahí. Caer
 * en un período por defecto es justo el bug que se acaba de arreglar (mirabas
 * una cosa y bajaba otra).
 */
export function rangoFechas(desdeYmd: string, hastaYmd: string): { desde: Date; hasta: Date } | null {
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  if (!ymd.test(desdeYmd) || !ymd.test(hastaYmd)) return null;
  const { desde } = bogotaDayRangeDeFecha(desdeYmd);
  const { hasta } = bogotaDayRangeDeFecha(hastaYmd);
  // "2026-02-31" pasa el regex pero no es un día: Date lo deja en Invalid Date.
  if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) return null;
  if (hasta <= desde) return null; // al revés (un mismo día sí vale: cubre 24h)
  return { desde, hasta };
}

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
  const DIAS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 };
  const desde = new Date(hasta.getTime() - (DIAS[p] ?? 30) * 86_400_000);
  const largo = hasta.getTime() - desde.getTime();
  return { desde, hasta, prevDesde: new Date(desde.getTime() - largo), prevHasta: desde };
}

"use client";

import { botonClases } from "@/components/ui/Boton";
import { chipFiltroClases } from "@/components/ui/Chip";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AgendarCitaForm } from "@/components/barbero/AgendarCitaForm";
import { MoverCitaForm } from "@/components/admin/MoverCitaForm";
import { BloquearHorasForm } from "@/components/admin/BloquearHorasForm";
import { AvisarWhatsApp } from "@/components/admin/AvisarWhatsApp";
import { mensajeCitaMovida, mensajeCitaCancelada } from "@/lib/whatsapp";
import { SEDE_INFO } from "@/lib/data/sede-info";
import { quitarBloqueo, moverCita, actualizarReserva } from "@/lib/actions";
import { CambiarServicioCita } from "@/components/admin/CambiarServicioCita";
import { instanteBogota } from "@/lib/slots";
import { CaraBarbero } from "@/components/staff/Elegir";
import { DOW, MON, STEP, fmtTime, horarioEfectivo, dowDeFecha, bogotaYmd } from "@/lib/slots";
import type { Barbero, Servicio, SedeId } from "@/lib/data/types";
import type { AgendaDiaItem, BloqueoDia, HorarioSemanal, DiaEspecial } from "@/lib/data/queries";

// Calendario del día (estilo WeiBook): una columna por barbero de la sede, las
// citas como bloques de color por estado, línea de "ahora" y "+ Cita" a mano.
// Todo se dibuja con la MISMA fuente de horario que el wizard (horarioEfectivo):
// si la sede abre 10-18 ese día, la grilla va de 10 a 18.

// Alto de un minuto. 1.1 = jornada de 11h en ~730px (antes 1.7 ≈ 1.120px: el
// dueño la sintió "demasiado alta"). Un bloque de 30 min queda de ~33px: se
// toca bien y el detalle completo vive en el sheet.
const PX_MIN = 1.1;
// Grano del calendario al arrastrar o al tocar un hueco. Estaba en 30 y no dejaba
// dejar una cita a las 2:45; va con la grilla de turnos (STEP) para que lo que se
// arma acá coincida con lo que ve el cliente.
const SNAP_AGENDA = STEP;

// Color por estado — tokens del panel, no colores inventados (DESIGN.md).
// Estilo Google Calendar: banda de color a la IZQUIERDA + fondo suave del
// mismo tono; el estado se lee por la banda aunque el bloque sea chiquito.
const ESTILO_ESTADO: Record<string, { card: string; label: string }> = {
  pendiente: { card: "border-l-[3px] border-y border-r border-l-muted/60 border-line/60 border-dashed bg-elevated text-ink", label: "Pendiente" },
  confirmada: { card: "border-l-[3px] border-y border-r border-l-accent border-accent/25 bg-accent/10 text-ink", label: "Confirmada" },
  en_curso: { card: "border-l-[3px] border-y border-r border-l-ok border-ok/25 bg-ok/10 text-ink", label: "En curso" },
  completada: { card: "border-l-[3px] border-y border-r border-l-ok/50 border-ok/15 bg-ok/[0.04] text-muted", label: "Completada" },
  cancelada: { card: "border-l-[3px] border-y border-r border-l-line border-line/40 bg-transparent text-muted line-through opacity-60", label: "Cancelada" },
  no_show: { card: "border-l-[3px] border-y border-r border-l-warn border-warn/25 bg-warn/10 text-warn", label: "No vino" },
};
const estiloDe = (estado: string) => ESTILO_ESTADO[estado] ?? ESTILO_ESTADO.pendiente;

// Minuto actual del día EN Bogotá (UTC-5 fijo): no depende de la TZ del aparato.
const minutoBogota = () => {
  const d = new Date();
  return (d.getUTCHours() * 60 + d.getUTCMinutes() - 300 + 1440) % 1440;
};

const minutoDeISO = (iso: string) => {
  const d = new Date(iso);
  return (d.getUTCHours() * 60 + d.getUTCMinutes() - 300 + 1440) % 1440;
};

function labelFecha(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DOW[dow]} ${d} ${MON[m - 1]}`;
}

/**
 * Reparte en CARRILES las citas que se pisan dentro de una misma columna. El
 * candado `reservas_no_overlap` de la BD no cubre canceladas ni no-shows, así
 * que un "no vino" de las 9 y el walk-in que entró en su lugar caen en el mismo
 * hueco: antes se dibujaban una ENCIMA de la otra y la de abajo desaparecía.
 * Cada grupo de citas encadenadas se parte en tantas columnas como haga falta
 * (mismo criterio que Google Calendar).
 */
function conCarriles(citas: AgendaDiaItem[]) {
  const ord = [...citas].sort(
    (a, b) => minutoDeISO(a.inicio) - minutoDeISO(b.inicio) || b.duracionMin - a.duracionMin,
  );
  const salida: { c: AgendaDiaItem; carril: number; de: number }[] = [];
  let grupo: typeof salida = [];
  let finGrupo = -1;
  const cerrarGrupo = () => {
    const total = grupo.reduce((m, x) => Math.max(m, x.carril + 1), 1);
    grupo.forEach((x) => (x.de = total));
    grupo = [];
    finGrupo = -1;
  };
  for (const c of ord) {
    const ini = minutoDeISO(c.inicio);
    if (grupo.length && ini >= finGrupo) cerrarGrupo();
    const ocupados = new Set(
      grupo.filter((x) => minutoDeISO(x.c.inicio) + x.c.duracionMin > ini).map((x) => x.carril),
    );
    let carril = 0;
    while (ocupados.has(carril)) carril++;
    const item = { c, carril, de: 1 };
    grupo.push(item);
    salida.push(item);
    finGrupo = Math.max(finGrupo, ini + c.duracionMin);
  }
  if (grupo.length) cerrarGrupo();
  return salida;
}

function ymdMas(ymd: string, dias: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function AgendaDia({
  sede,
  fecha,
  hoy,
  agenda,
  bloqueos = [],
  barberos,
  servicios,
  horarioSemanal,
  diasEspeciales,
  hrefBase,
  vista,
  agendaSemana = [],
}: {
  sede: SedeId;
  fecha: string; // YYYY-MM-DD del día mostrado
  hoy: string; // YYYY-MM-DD de hoy en Bogotá (server)
  agenda: AgendaDiaItem[];
  /** Ausencias/bloqueos del día (0054); se pintan grises en la columna. */
  bloqueos?: BloqueoDia[];
  barberos: Barbero[]; // ya filtrados por la sede
  servicios: Servicio[];
  horarioSemanal: HorarioSemanal[]; // ya filtrados por la sede
  diasEspeciales: DiaEspecial[]; // ya filtrados por la sede
  /** Base de los links de fecha (puede traer query). Default: la agenda del admin. */
  hrefBase?: string;
  /** "semana" = grilla de 7 días (compacta); "dia" = columnas por barbero. */
  vista?: "dia" | "semana";
  /** La agenda de los 7 días de la semana de `fecha` (solo en vista semana). */
  agendaSemana?: AgendaDiaItem[];
}) {
  const router = useRouter();
  const vistaActiva = vista ?? "dia";
  const [sheet, setSheet] = useState<{ barberoId?: string; slot?: number } | null>(null);
  // Detalle de una cita tocada (+ modo mover dentro del mismo sheet).
  const [detalle, setDetalle] = useState<AgendaDiaItem | null>(null);
  const [moviendo, setMoviendo] = useState(false);
  // Cancelar desde el calendario: hasta ahora había que irse al mostrador.
  const [confirmaCancel, setConfirmaCancel] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  // Aviso al cliente después de mover: hasta ahora la cita cambiaba de hora y
  // el cliente se enteraba llegando a la vieja.
  const [avisar, setAvisar] = useState<{ titulo: string; telefono: string | null; mensaje: string } | null>(null);
  // Bloquear horas: sheet de creación y bloqueo tocado (para quitarlo).
  const [bloqueoSheet, setBloqueoSheet] = useState<{ barberoId?: string } | null>(null);
  const [bloqueoSel, setBloqueoSel] = useState<BloqueoDia | null>(null);
  const [quitando, setQuitando] = useState(false);
  const [errBloqueo, setErrBloqueo] = useState<string | null>(null);
  const [ahoraMin, setAhoraMin] = useState(minutoBogota);
  // Arrastre con MOUSE (escritorio): en táctil queda tocar → "Mover" (más
  // fiable que un drag con el pulgar sobre una grilla que scrollea).
  const cuerpoRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{
    cita: AgendaDiaItem;
    col: number; // columna (índice de barbero) de origen
    ini: number; // minuto de inicio original
    dCols: number; // desplazamiento de columnas (snapped)
    dMin: number; // desplazamiento en minutos (snapped a SNAP_AGENDA)
    movio: boolean;
  } | null>(null);
  const [guardandoDrag, setGuardandoDrag] = useState(false);
  const [errDrag, setErrDrag] = useState<string | null>(null);
  // Tras un arrastre real, el navegador dispara igual un click sobre el bloque:
  // se suprime UNA vez para que no se abra el detalle encima del movimiento.
  const suprimirClickRef = useRef(false);

  function empezarDrag(e: React.PointerEvent, cita: AgendaDiaItem, col: number, ini: number) {
    // Solo mouse, solo citas movibles, y nunca en medio de un guardado.
    if (e.pointerType !== "mouse" || e.button !== 0 || guardandoDrag) return;
    if (!["pendiente", "confirmada"].includes(cita.estado)) return;
    const startX = e.clientX;
    const startY = e.clientY;
    // El canal de horas ya no mide siempre 64px (en móvil son 48): se mide la
    // columna real en vez de restar un número a mano.
    const gut = cuerpoRef.current?.firstElementChild?.clientWidth ?? 64;
    const anchoCol = cuerpoRef.current ? (cuerpoRef.current.clientWidth - gut) / barberos.length : 0;
    setErrDrag(null);
    setDrag({ cita, col, ini, dCols: 0, dMin: 0, movio: false });

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const movio = Math.abs(dx) > 6 || Math.abs(dy) > 6;
      const dCols = anchoCol > 0 ? Math.round(dx / anchoCol) : 0;
      const dMin = Math.round(dy / (PX_MIN * SNAP_AGENDA)) * SNAP_AGENDA;
      setDrag((d) => (d ? { ...d, dCols, dMin, movio: d.movio || movio } : d));
      if (movio) ev.preventDefault();
    };
    const onUp = async () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      // setDrag con función para leer el estado final sin carreras.
      setDrag((d) => {
        if (!d) return null;
        if (!d.movio) return null; // click simple: lo abre el onClick nativo
        suprimirClickRef.current = true;
        const nuevaCol = Math.min(barberos.length - 1, Math.max(0, d.col + d.dCols));
        const nuevoMin = Math.min(cierra - d.cita.duracionMin, Math.max(abre, d.ini + d.dMin));
        if (nuevaCol === d.col && nuevoMin === d.ini) return null; // no se movió de verdad
        setGuardandoDrag(true);
        moverCita({
          reservaId: d.cita.id,
          inicioISO: instanteBogota(fecha, nuevoMin).toISOString(),
          barberoId: barberos[nuevaCol].id,
        }).then((res) => {
          setGuardandoDrag(false);
          if (res.ok) {
            prepararAviso(d.cita, fecha, nuevoMin, barberos[nuevaCol].id);
            router.refresh();
          } else setErrDrag(res.error ?? "No se pudo mover la cita.");
        });
        return null;
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Arma el aviso de "movimos tu cita" con los datos que ya tenemos en pantalla.
  function prepararAviso(cita: AgendaDiaItem, ymd: string, min: number, barberoId: string) {
    const b = barberos.find((x) => x.id === barberoId);
    setAvisar({
      titulo: "Cita movida ✓",
      telefono: cita.telefono ?? null,
      mensaje: mensajeCitaMovida({
        cliente: cita.cliente,
        cuando: `${ymd === hoy ? "hoy" : labelFecha(ymd)} a las ${fmtTime(min)}`,
        barbero: b?.nombre ?? "tu barbero",
        sede: SEDE_INFO[sede]?.nombre ?? "la barbería",
      }),
    });
  }

  const esHoy = fecha === hoy;
  const ventana = horarioEfectivo(fecha, horarioSemanal, diasEspeciales);
  const abre = ventana.abreMin;
  const cierra = ventana.cierraMin;
  const altoDia = (cierra - abre) * PX_MIN;
  const horas: number[] = [];
  for (let m = abre; m < cierra; m += 60) horas.push(m);

  // La línea de "ahora" avanza sola (cada minuto), solo si se mira hoy.
  useEffect(() => {
    if (!esHoy) return;
    const t = setInterval(() => setAhoraMin(minutoBogota()), 60_000);
    return () => clearInterval(t);
  }, [esHoy]);

  // Al abrir (o cambiar de día), el scroll interno aterriza donde importa:
  // hoy → un poco antes de "ahora"; otro día → la primera cita (o arriba).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || vistaActiva !== "dia") return;
    const primera = agenda.length ? Math.min(...agenda.map((a) => minutoDeISO(a.inicio))) : abre;
    const objetivo = esHoy ? minutoBogota() : primera;
    el.scrollTop = Math.max(0, (objetivo - abre) * PX_MIN - 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, vistaActiva]);

  const base = hrefBase ?? `/admin/agenda?sede=${sede}`;
  const href = (f: string, v: "dia" | "semana" = vistaActiva) =>
    `${base}${base.includes("?") ? "&" : "?"}fecha=${f}${v === "semana" ? "&vista=semana" : ""}`;
  // En vista semana, ‹ › saltan de a 7 días.
  const paso = vistaActiva === "semana" ? 7 : 1;
  // Lunes de la semana de `fecha` (dow 0=Dom..6=Sáb → lunes primero).
  const lunes = ymdMas(fecha, -((dowDeFecha(fecha) + 6) % 7));
  const btnNav =
    "grid h-11 w-11 place-items-center rounded-full border border-line text-ink transition hover:border-accent/40";

  return (
    <div className="mt-5">
      {/* Navegación de día + leyenda de colores */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={href(ymdMas(fecha, -paso))} aria-label={vistaActiva === "semana" ? "Semana anterior" : "Día anterior"} className={btnNav}>
            ‹
          </Link>
          {/* 96px en el celular: con 130 fijos, "Volver a hoy" no entraba en la
              fila y se llevaba un renglón entero él solo. */}
          <div className="min-w-[96px] text-center sm:min-w-[130px]">
            <div className="font-display text-xl leading-tight">
              {vistaActiva === "semana"
                ? `${labelFecha(lunes)} – ${labelFecha(ymdMas(lunes, 6))}`
                : esHoy
                  ? "Hoy"
                  : labelFecha(fecha)}
            </div>
            {vistaActiva === "dia" && esHoy && <div className="text-[12px] text-muted">{labelFecha(fecha)}</div>}
          </div>
          <Link href={href(ymdMas(fecha, paso))} aria-label={vistaActiva === "semana" ? "Semana siguiente" : "Día siguiente"} className={btnNav}>
            ›
          </Link>
          {!esHoy && (
            <Link href={href(hoy)} className={botonClases("secundario", "md", "ml-1")}>
              Volver a hoy
            </Link>
          )}
        </div>
        {/* Vista y acciones juntas: en 375px el conmutador colgado del navegador
            de fecha empujaba la fila de botones a un tercer renglón, y el
            calendario —lo único que se viene a ver— arrancaba fuera de pantalla. */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-2" role="group" aria-label="Vista">
            {(["dia", "semana"] as const).map((v) => (
              <Link
                key={v}
                href={href(fecha, v)}
                aria-current={vistaActiva === v ? "page" : undefined}
                className={chipFiltroClases(vistaActiva === v)}
              >
                {v === "dia" ? "Día" : "Semana"}
              </Link>
            ))}
          </div>
          <button
            onClick={() => setBloqueoSheet({})}
            className={botonClases("secundario")}
          >
            Bloquear
          </button>
          <button
            onClick={() => setSheet({})}
            className={botonClases("primario")}
          >
            + Cita
          </button>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted">
        {Object.entries(ESTILO_ESTADO).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-[4px] border ${v.card.split(" ").slice(0, 2).join(" ")}`} />
            {v.label}
          </span>
        ))}
        <span className="hidden lg:inline text-muted/70">· con el mouse: arrastra una cita para moverla</span>
      </div>

      {/* Resultado del arrastre (guardando / error del server) */}
      {(errDrag || guardandoDrag) && (
        <div
          className={`mt-2 rounded-xl border px-3.5 py-2 text-sm ${
            errDrag ? "border-accent/40 bg-accent/10 text-accent-soft" : "border-line bg-panel text-muted"
          }`}
        >
          {errDrag ?? "Moviendo la cita…"}
        </div>
      )}

      {vistaActiva === "semana" ? (
        /* SEMANA: panorama compacto de los 7 días; tocar un día (o una cita)
           abre su vista Día. Las citas van con su color de estado. */
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-panel">
          <div className="grid min-w-[700px] grid-cols-7 divide-x divide-line/60">
            {Array.from({ length: 7 }, (_, i) => ymdMas(lunes, i)).map((ymd) => {
              const abiertaDia = horarioEfectivo(ymd, horarioSemanal, diasEspeciales).abierta;
              const citasDia = agendaSemana
                .filter((a) => bogotaYmd(new Date(a.inicio)) === ymd)
                .sort((a, b) => a.inicio.localeCompare(b.inicio));
              const esHoyCol = ymd === hoy;
              return (
                <div key={ymd} className={`min-h-[260px] ${abiertaDia ? "" : "bg-bg/50 opacity-60"}`}>
                  <Link
                    href={href(ymd, "dia")}
                    title="Ver el día completo"
                    className={`block border-b border-line/60 px-2 py-2 text-center transition hover:bg-elevated ${
                      esHoyCol ? "bg-accent/10" : ""
                    }`}
                  >
                    <span
                      className={`block text-[12px] font-bold uppercase tracking-wide ${
                        esHoyCol ? "text-accent-soft" : "text-muted"
                      }`}
                    >
                      {DOW[dowDeFecha(ymd)]}
                    </span>
                    {/* Hoy con su círculo lleno (firma Google Calendar) */}
                    <span
                      className={`mx-auto grid h-7 w-7 place-items-center font-display text-lg leading-none ${
                        esHoyCol ? "rounded-full bg-ink text-bg" : ""
                      }`}
                    >
                      {Number(ymd.slice(8))}
                    </span>
                  </Link>
                  <div className="space-y-1 p-1.5">
                    {!abiertaDia ? (
                      <p className="px-1 py-2 text-center text-[12px] text-muted">Cerrado</p>
                    ) : citasDia.length === 0 ? (
                      <p className="px-1 py-2 text-center text-[12px] text-muted/60">—</p>
                    ) : (
                      citasDia.map((c) => {
                        const est = estiloDe(c.estado);
                        return (
                          <Link
                            key={c.id}
                            href={href(ymd, "dia")}
                            title={`${fmtTime(minutoDeISO(c.inicio))} · ${c.cliente || "Sin nombre"} · ${c.servicio} · ${c.barbero} (${est.label})`}
                            className={`block truncate rounded-md border px-1.5 py-1 text-[12px] leading-tight ${est.card}`}
                          >
                            <span className="font-bold tabular-nums">{fmtTime(minutoDeISO(c.inicio))}</span>{" "}
                            {c.cliente?.split(" ")[0] || "Cliente"}
                          </Link>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : !ventana.abierta ? (
        <div className="mt-6 rounded-2xl border border-line bg-panel px-4 py-10 text-center">
          <p className="text-sm font-semibold text-ink">Ese día la sede está cerrada</p>
          <p className="mt-1 text-xs text-muted">Se cambia en Equipo → Horarios (día especial).</p>
        </div>
      ) : barberos.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-panel px-4 py-10 text-center text-sm text-muted">
          Esta sede no tiene barberos activos.
        </div>
      ) : (
        /* Scroll PROPIO: el calendario ya no estira la página entera; la cabecera
           de barberos y la columna de horas quedan fijas mientras se navega. */
        <div
          ref={scrollRef}
          className="mt-4 max-h-[62dvh] overflow-auto rounded-2xl border border-line bg-panel lg:max-h-[calc(100dvh-15rem)]"
        >
          {/* Ancho de columna por breakpoint: con 148px fijos, una sede de TRES
              barberos mostraba dos y medio en el celular y el tercero se
              descubría solo si se arrastraba de lado. Con 96px entran los tres
              en 375px; de cuatro en adelante vuelve el scroll lateral (con las
              horas y la cabecera fijas). */}
          <div
            className="[--col:96px] [--gut:48px] sm:[--col:148px] sm:[--gut:64px]"
            style={{ minWidth: `calc(var(--gut) + ${barberos.length} * var(--col))` }}
          >
            {/* Cabecera: quién es cada columna (fija arriba al scrollear) */}
            <div className="sticky top-0 z-20 grid border-b border-line bg-panel" style={{ gridTemplateColumns: `var(--gut) repeat(${barberos.length}, minmax(var(--col), 1fr))` }}>
              <div />
              {barberos.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSheet({ barberoId: b.id })}
                  title={`Agendar cita con ${b.nombre}`}
                  className="flex min-h-11 items-center justify-center gap-1.5 border-l border-line/60 px-1 py-2.5 transition hover:bg-elevated sm:gap-2 sm:px-2"
                >
                  <CaraBarbero b={b} size={28} />
                  <span className="truncate text-[12.5px] font-bold text-ink">{b.nombre.split(" ")[0]}</span>
                </button>
              ))}
            </div>

            {/* Cuerpo: horas + columnas con bloques. py-3: sin ese aire, la
                etiqueta de la primera hora quedaba mordida por la cabecera fija
                y la del cierre se cortaba contra el borde de abajo. */}
            <div ref={cuerpoRef} className="grid py-3" style={{ gridTemplateColumns: `var(--gut) repeat(${barberos.length}, minmax(var(--col), 1fr))` }}>
              {/* Columna de horas (fija a la izquierda al scrollear de lado) */}
              <div className="sticky left-0 z-10 bg-panel" style={{ height: altoDia }}>
                {horas.map((m) => (
                  <span
                    key={m}
                    className="absolute right-1.5 -translate-y-1/2 text-[12px] tabular-nums text-muted sm:right-2"
                    style={{ top: (m - abre) * PX_MIN }}
                  >
                    {/* "9 am" en el celular: con el canal de 48px, "9:00 am" se
                        montaba sobre la primera columna. */}
                    <span className="sm:hidden">{fmtTime(m).replace(":00", "")}</span>
                    <span className="hidden sm:inline">{fmtTime(m)}</span>
                  </span>
                ))}
                {/* La hora de CIERRE también se etiqueta (el día no termina en el aire) */}
                <span
                  className="absolute right-1.5 -translate-y-1/2 text-[12px] tabular-nums text-muted sm:right-2"
                  style={{ top: (cierra - abre) * PX_MIN }}
                >
                  <span className="sm:hidden">{fmtTime(cierra).replace(":00", "")}</span>
                  <span className="hidden sm:inline">{fmtTime(cierra)}</span>
                </span>
                {/* El punto del AHORA en el canal de horas (firma Google Calendar) */}
                {esHoy && ahoraMin >= abre && ahoraMin <= cierra && (
                  <span
                    aria-hidden
                    className="absolute right-0 z-10 h-2.5 w-2.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-accent shadow"
                    style={{ top: (ahoraMin - abre) * PX_MIN }}
                  />
                )}
              </div>

              {barberos.map((b, colIdx) => {
                const citas = agenda.filter((a) => a.barberoId === b.id);
                const misBloqueos = bloqueos.filter((x) => x.barberoId === b.id);
                return (
                  <div
                    key={b.id}
                    className="relative cursor-pointer border-b border-l border-line/40 border-l-line/60"
                    style={{ height: altoDia }}
                    onClick={(e) => {
                      // Tocar un hueco → agendar con ese barbero A ESA HORA
                      // (estilo Google Calendar: la hora tocada ya viene elegida).
                      if (e.target !== e.currentTarget) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const min = abre + Math.floor((e.clientY - rect.top) / (PX_MIN * SNAP_AGENDA)) * SNAP_AGENDA;
                      setSheet({ barberoId: b.id, slot: Math.min(cierra - 30, Math.max(abre, min)) });
                    }}
                  >
                    {/* Rayas de hora + medias horas punteadas (guía visual) */}
                    {horas.map((m) => (
                      <span key={m} aria-hidden>
                        <span
                          className="pointer-events-none absolute inset-x-0 border-t border-line/40"
                          style={{ top: (m - abre) * PX_MIN }}
                        />
                        {m + 30 < cierra && (
                          <span
                            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line/20"
                            style={{ top: (m + 30 - abre) * PX_MIN }}
                          />
                        )}
                      </span>
                    ))}

                    {/* Bloqueos (gris): almuerzo/diligencia o el día entero. Tocar → quitar. */}
                    {misBloqueos.map((x) => {
                      const desde = x.desdeMin ?? abre;
                      const hastaB = x.hastaMin ?? cierra;
                      return (
                        <button
                          key={x.id}
                          type="button"
                          onClick={() => {
                            setErrBloqueo(null);
                            setBloqueoSel(x);
                          }}
                          className="absolute inset-x-1 z-[5] overflow-hidden rounded-lg border border-line bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(120,120,120,0.12)_6px,rgba(120,120,120,0.12)_12px)] px-2 py-1 text-left text-[12px] leading-tight text-muted"
                          style={{ top: (Math.max(desde, abre) - abre) * PX_MIN + 1, height: Math.max(26, (Math.min(hastaB, cierra) - Math.max(desde, abre)) * PX_MIN - 3) }}
                          title={`Bloqueado${x.motivo ? ` · ${x.motivo}` : ""} — toca para quitar`}
                        >
                          <span className="font-bold">Bloqueado</span>
                          {x.motivo && <span className="block truncate opacity-80">{x.motivo}</span>}
                        </button>
                      );
                    })}

                    {conCarriles(citas).map(({ c, carril, de }) => {
                      const ini = minutoDeISO(c.inicio);
                      const est = estiloDe(c.estado);
                      const alto = Math.max(30, c.duracionMin * PX_MIN - 3);
                      const arrastrando = drag?.movio && drag.cita.id === c.id;
                      const movible = ["pendiente", "confirmada"].includes(c.estado);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onPointerDown={(e) => empezarDrag(e, c, colIdx, ini)}
                          onClick={() => {
                            if (suprimirClickRef.current) {
                              suprimirClickRef.current = false;
                              return;
                            }
                            setMoviendo(false);
                            setDetalle(c);
                          }}
                          className={`absolute overflow-hidden rounded-lg border px-1.5 py-1 text-left text-[12px] leading-tight shadow-sm sm:px-2 ${
                            arrastrando
                              ? "z-30 cursor-grabbing opacity-90 shadow-xl ring-2 ring-accent"
                              : `transition hover:brightness-110 ${movible ? "lg:cursor-grab" : ""}`
                          } ${est.card}`}
                          style={{
                            top: (ini - abre) * PX_MIN + 1,
                            height: alto,
                            // Carril dentro de la columna (1 solo = ancho completo).
                            left: `calc(${(carril / de) * 100}% + 4px)`,
                            width: `calc(${100 / de}% - 8px)`,
                            // Vista previa del arrastre: un salto de columna son
                            // `de` anchos de bloque (el bloque mide 1/de de la columna).
                            transform: arrastrando
                              ? `translate(${drag!.dCols * de * 100}%, ${drag!.dMin * PX_MIN}px)`
                              : undefined,
                            touchAction: "auto",
                          }}
                          title={`${fmtTime(ini)} · ${c.cliente || "Sin nombre"} · ${c.servicio} (${est.label})${movible ? " — arrastra para mover" : ""}`}
                        >
                          {/* Estilo Google: el NOMBRE manda; hora y servicio debajo
                              cuando el bloque tiene alto (si no, viven en el title). */}
                          <span className="block truncate font-semibold">
                            {arrastrando && (
                              <span className="mr-1 font-bold tabular-nums">
                                {fmtTime(Math.min(cierra - c.duracionMin, Math.max(abre, ini + drag!.dMin)))}
                              </span>
                            )}
                            {/* Primer nombre en el celular: en una columna de 96px el
                                nombre completo se corta en "Cliente De…" y no
                                identifica a nadie. */}
                            <span className="sm:hidden">{c.cliente?.split(" ")[0] || "Sin nombre"}</span>
                            <span className="hidden sm:inline">{c.cliente || "Sin nombre"}</span>
                          </span>
                          {alto >= 40 && (
                            <span className="block truncate text-[12px] tabular-nums opacity-75">
                              {fmtTime(ini)} – {fmtTime(ini + c.duracionMin)} · {c.servicio}
                            </span>
                          )}
                        </button>
                      );
                    })}

                    {/* Línea de AHORA */}
                    {esHoy && ahoraMin >= abre && ahoraMin <= cierra && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-accent"
                        style={{ top: (ahoraMin - abre) * PX_MIN }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Sheet de + Cita (reusa el MISMO form del mostrador) */}
      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={() => setSheet(null)}>
          <div
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-line bg-panel p-5 sm:max-w-lg sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-xl">Agendar cita</h3>
              <button onClick={() => setSheet(null)} aria-label="Cerrar" className="grid h-11 w-11 place-items-center rounded-full border border-line text-muted transition hover:text-ink">
                ×
              </button>
            </div>
            <AgendarCitaForm
              sede={sede}
              barberos={barberos}
              servicios={servicios}
              horarioSemanal={horarioSemanal}
              diasEspeciales={diasEspeciales}
              barberoInicial={sheet.barberoId}
              diaInicial={new Date(`${fecha}T12:00:00-05:00`)}
              slotInicial={sheet.slot}
              onDone={() => {
                setSheet(null);
                router.refresh();
              }}
              onCancel={() => setSheet(null)}
            />
          </div>
        </div>
      )}

      {/* Bloquear horas: sheet de creación */}
      {bloqueoSheet && ventana.abierta && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={() => setBloqueoSheet(null)}>
          <div
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-line bg-panel p-5 sm:max-w-lg sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-xl">Bloquear horas · {esHoy ? "hoy" : labelFecha(fecha)}</h3>
              <button onClick={() => setBloqueoSheet(null)} aria-label="Cerrar" className="grid h-11 w-11 place-items-center rounded-full border border-line text-muted transition hover:text-ink">
                ×
              </button>
            </div>
            <BloquearHorasForm
              fecha={fecha}
              barberos={barberos}
              barberoInicial={bloqueoSheet.barberoId}
              abreMin={abre}
              cierraMin={cierra}
              onDone={() => {
                setBloqueoSheet(null);
                router.refresh();
              }}
              onCancel={() => setBloqueoSheet(null)}
            />
          </div>
        </div>
      )}

      {/* Bloqueo tocado: quitar */}
      {bloqueoSel && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={() => setBloqueoSel(null)}>
          <div
            className="w-full rounded-t-3xl border border-line bg-panel p-5 sm:max-w-md sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl">Quitar el bloqueo</h3>
            <p className="mt-2 text-sm text-muted">
              {bloqueoSel.desdeMin == null
                ? "Todo el día"
                : `${fmtTime(bloqueoSel.desdeMin)} – ${fmtTime(bloqueoSel.hastaMin ?? 0)}`}
              {bloqueoSel.motivo ? ` · ${bloqueoSel.motivo}` : ""} · {barberos.find((b) => b.id === bloqueoSel.barberoId)?.nombre ?? ""}
            </p>
            {errBloqueo && (
              <div className="mt-3 rounded-xl border border-accent/40 bg-accent/10 px-3.5 py-2.5 text-sm text-accent-soft">
                {errBloqueo}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button
                disabled={quitando}
                onClick={async () => {
                  setQuitando(true);
                  setErrBloqueo(null);
                  const res = await quitarBloqueo(bloqueoSel.id);
                  setQuitando(false);
                  if (res.ok) {
                    setBloqueoSel(null);
                    router.refresh();
                  } else setErrBloqueo(res.error ?? "No se pudo quitar.");
                }}
                className="flex-1 rounded-full bg-accent px-5 py-3 text-sm font-bold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-50"
              >
                {quitando ? "Quitando…" : "Quitar bloqueo"}
              </button>
              <button onClick={() => setBloqueoSel(null)} className="rounded-full border border-line px-5 py-3 text-sm text-muted">
                Dejarlo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detalle de la cita tocada: info + mover (solo si aún no pasó por la silla) */}
      {detalle && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={() => setDetalle(null)}>
          <div
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-line bg-panel p-5 sm:max-w-lg sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-xl">{moviendo ? "Mover cita" : "Detalle de la cita"}</h3>
              <button onClick={() => setDetalle(null)} aria-label="Cerrar" className="grid h-11 w-11 place-items-center rounded-full border border-line text-muted transition hover:text-ink">
                ×
              </button>
            </div>

            {!moviendo ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-line bg-elevated p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-2xl tabular-nums">{fmtTime(minutoDeISO(detalle.inicio))}</span>
                    <span className={`rounded-full border px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide ${estiloDe(detalle.estado).card}`}>
                      {estiloDe(detalle.estado).label}
                    </span>
                  </div>
                  <div className="mt-2 text-[15px] font-semibold text-ink">{detalle.cliente || "Sin nombre"}</div>
                  <div className="text-sm text-muted">
                    {detalle.servicio} · {detalle.duracionMin} min · {detalle.barbero}
                  </div>
                  {detalle.nota && <p className="mt-2 rounded-lg bg-bg px-3 py-2 text-xs text-muted">{detalle.nota}</p>}
                </div>

                {detalle.telefono && (
                  <a
                    href={`https://wa.me/57${detalle.telefono.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-11 items-center justify-center rounded-full border border-line text-sm font-semibold text-ink transition hover:border-accent/40"
                  >
                    Escribirle por WhatsApp
                  </a>
                )}

                {["pendiente", "confirmada"].includes(detalle.estado) ? (
                  <>
                    <button
                      onClick={() => setMoviendo(true)}
                      className="w-full rounded-full bg-accent px-5 py-3 text-sm font-bold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft"
                    >
                      Mover de hora o de barbero
                    </button>
                    {/* "Me equivoqué al agendar": el servicio se corrige acá, no solo al cobrar. */}
                    <CambiarServicioCita
                      reservaId={detalle.id}
                      servicioActual={detalle.servicio}
                      servicios={servicios}
                      sede={sede}
                      onDone={(aviso) => {
                        if (aviso) setErrDrag(aviso);
                        setDetalle(null);
                        router.refresh();
                      }}
                    />
                    {/* Cancelar vivía SOLO en el mostrador: desde el calendario había
                        que cambiar de pantalla. Dos toques (mismo patrón que quitar
                        foto o unir fichas) porque no tiene deshacer, y al soltarlo
                        sale el aviso de WhatsApp — el correo ya sale solo (0059). */}
                    <button
                      onClick={async () => {
                        if (!confirmaCancel) {
                          setConfirmaCancel(true);
                          return;
                        }
                        setCancelando(true);
                        const res = await actualizarReserva(detalle.id, { estado: "cancelada" });
                        setCancelando(false);
                        setConfirmaCancel(false);
                        if (!res.ok) {
                          setErrDrag(res.error ?? "No se pudo cancelar.");
                          return;
                        }
                        setAvisar({
                          titulo: "Cita cancelada ✓",
                          telefono: detalle.telefono ?? null,
                          mensaje: mensajeCitaCancelada({
                            cliente: detalle.cliente,
                            cuando: `${esHoy ? "hoy" : labelFecha(fecha)} a las ${fmtTime(minutoDeISO(detalle.inicio))}`,
                            sede: SEDE_INFO[sede]?.nombre ?? "la barbería",
                          }),
                        });
                        setDetalle(null);
                        router.refresh();
                      }}
                      onBlur={() => setConfirmaCancel(false)}
                      disabled={cancelando}
                      className={`w-full rounded-full border px-5 py-3 text-sm font-bold uppercase tracking-wide transition disabled:opacity-50 ${
                        confirmaCancel ? "border-warn bg-warn/10 text-warn" : "border-line text-muted hover:text-ink"
                      }`}
                    >
                      {cancelando ? "Cancelando…" : confirmaCancel ? "¿Seguro? Toca de nuevo" : "Cancelar cita"}
                    </button>
                  </>
                ) : (
                  <p className="text-center text-xs text-muted">
                    Esta cita ya {detalle.estado === "en_curso" ? "está en la silla" : "terminó"}; no se mueve.
                  </p>
                )}
              </div>
            ) : (
              <MoverCitaForm
                cita={detalle}
                barberos={barberos}
                horarioSemanal={horarioSemanal}
                diasEspeciales={diasEspeciales}
                onDone={(destino) => {
                  prepararAviso(detalle, destino.ymd, destino.slot, destino.barberoId);
                  setDetalle(null);
                  setMoviendo(false);
                  // El calendario SALTA a donde quedó la cita: si se movió a otro
                  // día, quedarse mirando el día viejo la hacía "desaparecer".
                  if (destino.ymd !== fecha) router.push(href(destino.ymd, "dia"));
                  else router.refresh();
                }}
                onCancel={() => setMoviendo(false)}
              />
            )}
          </div>
        </div>
      )}

      {/* Avisarle al cliente que le movimos la cita. Sale solo al guardar: si
          esperáramos a que alguien se acuerde, no sale nunca. */}
      {avisar && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-sm">
            <AvisarWhatsApp
              titulo={avisar.titulo}
              telefono={avisar.telefono}
              mensaje={avisar.mensaje}
              onListo={() => setAvisar(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

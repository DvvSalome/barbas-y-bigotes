import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  getStaffContext,
  ventasHoyPorMedio,
  equipoAhora,
  citasSiguientes,
  citasVencidasHoy,
  atendidasSinCobrar,
  paraHacer,
  serie7Dias,
  getPostventaResumen,
  getCierresHoy,
  pulsoDelDia,
} from "@/lib/data/queries";
import { cop, horaBogota, diasDesde } from "@/lib/format";
import { fmtTime, CLOSE } from "@/lib/slots";
import { DesbloquearPinBtn } from "@/components/admin/DesbloquearPinBtn";
import { AlertIcon, ScissorsIcon, CheckIcon, StarIcon, PercentIcon, CashIcon, TicketIcon, GridIcon } from "@/components/icons";
import type { SedeId } from "@/lib/data/types";
import { AvisoCaja } from "@/components/admin/AvisoCaja";
import { Estrellas } from "@/components/ui/Estrellas";

export const metadata: Metadata = { title: "Hoy · Admin" };

const NOMBRE_SEDE: Record<string, string> = {
  "parque-venezuela": "Parque Venezuela",
  "plaza-de-la-paz": "Plaza de la Paz",
};
// Nombre corto LEGIBLE y consistente ("PV" no le decía nada a nadie, y "PV" vs
// "PLAZA" eran dos estilos para el mismo dato).
const TAG_SEDE: Record<string, string> = {
  "parque-venezuela": "P. Venezuela",
  "plaza-de-la-paz": "Plaza Paz",
};
const FOTO_SEDE: Record<string, string> = {
  "parque-venezuela": "/sedes/parque-venezuela-frente.jpg",
  "plaza-de-la-paz": "/sedes/plaza-de-la-paz-frente.jpg",
};

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short" });
}

/**
 * Los 7 días en barras. La polilínea de 1px que había no se leía: con ventas
 * parejas era una raya horizontal y con un solo día de venta, un pico sin
 * contexto. Hoy se distingue por color, no por posición.
 */
function Barras7({ dias, className }: { dias: { ymd: string; total: number }[]; className?: string }) {
  const max = Math.max(1, ...dias.map((d) => d.total));
  const paso = 300 / dias.length;
  return (
    <svg viewBox="0 0 300 56" preserveAspectRatio="none" aria-label="Ingresos de los últimos 7 días" className={className}>
      {dias.map((d, i) => {
        const alto = Math.max(2, (d.total / max) * 46);
        const hoy = i === dias.length - 1;
        return (
          <rect
            key={d.ymd}
            x={i * paso + 3}
            y={52 - alto}
            width={paso - 6}
            height={alto}
            rx="2"
            fill={hoy ? "var(--accent-soft)" : "var(--bar)"}
            opacity={hoy ? 1 : 0.45}
          />
        );
      })}
      <line x1="0" y1="53.5" x2="300" y2="53.5" stroke="var(--line)" strokeWidth="1" />
    </svg>
  );
}

// Cuánto se pasó de su hora, en la unidad más corta que quepa en un chip.
function atraso(desdeIso: string, ahora: number) {
  const min = Math.round((ahora - new Date(desdeIso).getTime()) / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return min % 60 === 0 ? `${h} h` : `${h} h ${min % 60} min`;
}

// "$6,4M" para la semana del sparkline; montos chicos van completos.
function compacto(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
  return cop(n);
}

// Variación de la semana contra la anterior: flecha + % para que el "vs" diga
// si subió o bajó sin restar de cabeza. Con la semana pasada en $0 no hay
// porcentaje honesto que mostrar.
function variacionSemana(actual: number, anterior: number) {
  if (anterior <= 0) return null;
  const pct = Math.round(((actual - anterior) / anterior) * 100);
  const sube = pct >= 0;
  return {
    flecha: sube ? "▲" : "▼",
    clase: sube ? "text-ok" : "text-warn",
    srTexto: sube ? "subió" : "bajó",
    etiqueta: `${Math.abs(pct)}%`,
  };
}

function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Label de sección: 11px 700 uppercase ls .14em, color muted.
const SEC =
  "flex items-baseline justify-between eyebrow " +
  // Marca roja al inicio del título: las secciones se leen como capítulos.
  "[&>span:first-of-type]:relative [&>span:first-of-type]:pl-3 [&>span:first-of-type]:before:absolute " +
  "[&>span:first-of-type]:before:left-0 [&>span:first-of-type]:before:top-1/2 [&>span:first-of-type]:before:h-3 " +
  "[&>span:first-of-type]:before:w-[3px] [&>span:first-of-type]:before:-translate-y-1/2 " +
  "[&>span:first-of-type]:before:rounded-full [&>span:first-of-type]:before:bg-accent [&>span:first-of-type]:before:content-['']";
// Link de acción a la derecha del label (rojo suave, 12px 600). min-h-11 + padding:
// antes era texto de 12px sin área táctil, imposible de acertar en el celular.
const SEC_ACTION = "inline-flex items-center min-h-11 px-2 text-[13px] font-semibold normal-case tracking-normal text-ink/85 underline decoration-line underline-offset-4 transition hover:text-ink";
// Superficie de panel. Un solo vocabulario para todas las listas de la pantalla.
const PANEL = "overflow-hidden rounded-2xl border border-line bg-panel";
// Opacidades del token --bar para distinguir medios de pago sin inventar colores
// (DESIGN.md: paleta Restrained, el rojo es acción/estado, no dato).
const TONO_MEDIO = [1, 0.72, 0.48, 0.3, 0.18];

export default async function AdminHoy({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Gate PROPIO, no solo del layout: Next renderiza layout y pagina en paralelo,
  // asi que el redirect() del layout no frena a tiempo estos fetches con
  // service_role (equipoAhora, getCierresHoy, etc. bypassan RLS). Sin este corte,
  // un no-admin autenticado podria streamear plata/equipo/caja antes de la
  // expulsion. Se re-verifica el rol como defensa en profundidad.
  const staff = await getStaffContext();
  if (staff.rol !== "admin") redirect(staff.rol === "anon" ? "/login" : "/barbero");

  const sp = await searchParams;
  const sedeParam = typeof sp.sede === "string" ? sp.sede : undefined;
  const sede = sedeParam && sedeParam in NOMBRE_SEDE ? (sedeParam as SedeId) : null;

  const [plata, equipo, citas, vencidas, sinCobrar, tareas, serie, postventa, caja, pulso] = await Promise.all([
    ventasHoyPorMedio(sede),
    equipoAhora(sede),
    citasSiguientes(sede),
    citasVencidasHoy(sede),
    atendidasSinCobrar(sede),
    paraHacer(sede),
    serie7Dias(sede),
    getPostventaResumen(sede ?? undefined),
    getCierresHoy(sede),
    pulsoDelDia(sede),
  ]);

  const fecha = new Date().toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const ahora = new Date().getTime();
  // Precio de lista de lo atendido sin cobrar (una reserva sin servicio no suma).
  const montoSinCobrar = sinCobrar.reduce((a, c) => a + (c.precio ?? 0), 0);
  const sinTareas =
    tareas.bajoMinimo.length === 0 && tareas.malasResenas.length === 0 && tareas.cuponesPorVencer.length === 0;

  // El equipo se parte en dos: los que necesitan una mirada (en silla, pasados de
  // hora, PIN bloqueado) van como fila con su detalle; los libres se resumen en
  // una tira de caras. Seis filas diciendo "Libre" no son seis datos, es uno.
  const conAtencion = equipo
    .filter((b) => b.enSilla || b.pinBloqueado)
    .sort((a, b) => {
      const pa = a.enSilla && new Date(a.enSilla.fin).getTime() < ahora ? 0 : a.enSilla ? 1 : 2;
      const pb = b.enSilla && new Date(b.enSilla.fin).getTime() < ahora ? 0 : b.enSilla ? 1 : 2;
      return pa - pb;
    });
  const libres = equipo.filter((b) => !b.enSilla && !b.pinBloqueado);
  const enSillaCount = equipo.filter((b) => b.enSilla).length;

  const variacion = variacionSemana(serie.semana, serie.semanaAnterior);

  const cajasAbiertas = caja.filter((c) => c.estado === "abierta").length;

  return (
    <div>
      <AvisoCaja />
      {/* ── La banda del día ───────────────────────────────────
          Encabezado y plata son la MISMA unidad, no una card flotante encima de
          otra (anti-referencia de PRODUCT.md: la plantilla hero-métrica). Vive
          sobre el fondo de la página y cierra con una línea. */}
      {/* ── La banda del día, con la cara de la barbería ────
          Era un título sobre fondo negro, igual que las otras ocho cajas. Ahora
          entra por la puerta del local: el filo barber pole y la foto de la sede
          tras un velo, el mismo encabezado que ya usan los correos. */}
      <header className="relative -mx-4 -mt-6 mb-5 overflow-hidden border-b border-line sm:-mx-5">
        <div aria-hidden className="bb-poste h-1" />
        <div
          className="bb-velo relative bg-cover bg-center"
          style={{ backgroundImage: `url(${FOTO_SEDE[sede ?? "parque-venezuela"] ?? "/sedes/parque-venezuela-frente.jpg"})` }}
        >
          <div className="relative z-10 px-4 pb-5 pt-5 sm:px-5">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <h1 className="font-display text-[24px] font-extrabold uppercase leading-none text-ink lg:text-[30px]">
              {sede ? `El día en ${NOMBRE_SEDE[sede]}` : "El día en las dos sedes"}
            </h1>
            <p className="mt-1.5 text-[12px] text-muted lg:text-[12.5px]">
              {fecha} · cierre {fmtTime(CLOSE)}
              {cajasAbiertas > 0 && (
                <>
                  {" · "}
                  <span className="inline-flex items-center gap-1.5 align-middle text-warn">
                    {/* Punto sólido + anillo que se expande: señala "pasando ahora"
                        sin que el punto llegue a desaparecer. */}
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="bb-live-ring absolute inline-flex h-full w-full rounded-full bg-warn" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-warn" />
                    </span>
                    {cajasAbiertas === 1 ? "1 caja abierta" : `${cajasAbiertas} cajas abiertas`}
                  </span>
                </>
              )}
            </p>
          </div>

          {/* Tendencia de la semana: contexto del número grande, no una sección
              aparte. En móvil va debajo de la plata. */}
          <div className="hidden shrink-0 items-end gap-3 lg:flex">
            <div className="text-right">
              <div className="flex items-baseline justify-end gap-1.5 font-display text-[15px] font-extrabold leading-none text-ink tabular-nums">
                <span>{compacto(serie.semana)}</span>
                {variacion && (
                  <span className={`text-[12px] ${variacion.clase}`}>
                    <span aria-hidden>{variacion.flecha}</span>
                    <span className="sr-only">{variacion.srTexto}</span> {variacion.etiqueta}
                  </span>
                )}
              </div>
              <div className="mt-1 text-[12px] text-muted tabular-nums">vs {compacto(serie.semanaAnterior)} semana pasada</div>
            </div>
            <Barras7 dias={serie.dias} className="h-9 w-[160px]" />
          </div>
        </div>

        {/* Plata del día */}
        <div className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-2">
          <div className="font-display text-[42px] font-extrabold leading-[0.9] tracking-tight text-ink tabular-nums lg:text-[52px]">
            {cop(plata.total)}
          </div>
          <div className="pb-1 text-[12.5px] text-muted tabular-nums">
            <span className="font-semibold text-ink">
              {plata.atenciones} {plata.atenciones === 1 ? "atención" : "atenciones"}
            </span>{" "}
            cobradas hoy · {cop(plata.propinas)} en propinas
          </div>
        </div>

        {/* Reparto por medio de pago: una sola barra apilada + leyenda. Cuatro
            filas de barras para el mismo dato eran ruido. */}
        {plata.medios.length > 0 ? (
          <div className="mt-3.5">
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-line/50" role="img" aria-label="Reparto por medio de pago">
              {plata.medios.map((m, i) => (
                <span
                  key={m.slug}
                  className="block h-full first:rounded-l-full last:rounded-r-full"
                  style={{
                    width: `${(m.total / Math.max(1, plata.total)) * 100}%`,
                    background: "var(--bar)",
                    opacity: TONO_MEDIO[i] ?? 0.15,
                    // Separador entre segmentos: con 5 opacidades del mismo color,
                    // dos medios parecidos se fundían en uno solo.
                    borderLeft: i > 0 ? "2px solid var(--bg)" : undefined,
                  }}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] tabular-nums">
              {plata.medios.map((m, i) => (
                <span key={m.slug} className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: "var(--bar)", opacity: TONO_MEDIO[i] ?? 0.15 }}
                  />
                  <span className="text-muted">{m.nombre}</span>
                  <span className="font-semibold text-ink">{cop(m.total)}</span>
                  {/* El % hace legible la barra sin depender de distinguir tonos */}
                  <span className="text-[12px] text-muted">
                    {Math.round((m.total / Math.max(1, plata.total)) * 100)}%
                  </span>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-muted">Todavía no se cobró nada hoy. Lo del día va a ir apareciendo acá.</p>
        )}

        {/* Tendencia en móvil */}
        <div className="mt-4 flex items-center gap-3 lg:hidden">
          <Barras7 dias={serie.dias} className="h-8 flex-1" />
          <div className="shrink-0 text-right text-[12px] text-muted tabular-nums">
            <span className="font-display text-[14px] font-extrabold text-ink">{compacto(serie.semana)}</span>{" "}
            {variacion && (
              <span className={`font-bold ${variacion.clase}`}>
                <span aria-hidden>{variacion.flecha}</span>
                <span className="sr-only">{variacion.srTexto}</span> {variacion.etiqueta}
              </span>
            )}{" "}
            esta semana
            <br />
            vs {compacto(serie.semanaAnterior)} la pasada
          </div>
        </div>
          </div>
        </div>
      </header>

      {/* ── El pulso del día ────────────────────────────────
          Seis números que antes no estaban en ninguna pantalla (ticket
          promedio, ocupación, plata parada sin cobrar) o vivían escondidos en
          una línea de texto. En el celular van de a dos; en escritorio, los
          seis en una fila que por fin usa el ancho del monitor. */}
      <section aria-label="Pulso del día" className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          { l: "Entró hoy", v: cop(plata.total), s: plata.medios.length > 0 ? `${plata.medios.length} ${plata.medios.length === 1 ? "medio" : "medios"} de pago` : "todavía sin cobros", tono: "text-ink", Icono: CashIcon, aro: "border-line text-muted" },
          { l: "Atenciones", v: String(plata.atenciones), s: `${pulso.citasHoy} ${pulso.citasHoy === 1 ? "cita agendada" : "citas agendadas"} hoy`, tono: "text-ink", Icono: ScissorsIcon, aro: "border-line text-muted" },
          { l: "Ticket promedio", v: plata.atenciones > 0 ? cop(Math.round(plata.total / plata.atenciones)) : "—", s: "por cliente cobrado", tono: "text-ink", Icono: TicketIcon, aro: "border-line text-muted" },
          { l: "Propinas", v: cop(plata.propinas), s: plata.total > 0 ? `${Math.round((plata.propinas / plata.total) * 100)}% de lo cobrado` : "van aparte del corte", tono: "text-ink", Icono: PercentIcon, aro: "border-line text-muted" },
          { l: "Agenda llena", v: `${Math.round(pulso.ocupacion.ratio * 100)}%`, s: pulso.ocupacion.disponible > 0 ? `${Math.round(pulso.ocupacion.agendado / 60)} h de ${Math.round(pulso.ocupacion.disponible / 60)} h del equipo` : "hoy no se abre", tono: pulso.ocupacion.ratio >= 0.6 ? "text-ok" : "text-ink", Icono: GridIcon, aro: "border-line text-muted", barra: pulso.ocupacion.ratio },
          { l: "Sin cobrar", v: cop(montoSinCobrar), s: sinCobrar.length === 0 ? "todo pasó por caja" : `${sinCobrar.length} ${sinCobrar.length === 1 ? "cita cerrada" : "citas cerradas"} sin cobro`, tono: montoSinCobrar > 0 ? "text-warn" : "text-muted", Icono: AlertIcon, aro: montoSinCobrar > 0 ? "border-warn/40 text-warn" : "border-line text-muted" },
        ].map((k) => (
          <div key={k.l} className={`${PANEL} bb-relieve px-3.5 py-3`}>
            <div className="flex items-start justify-between gap-2">
              <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted">{k.l}</div>
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${k.aro}`}>
                <k.Icono className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className={`mt-1.5 font-display text-[24px] font-extrabold leading-none tabular-nums ${k.tono}`}>{k.v}</div>
            {/* La ocupación además se ve: un número suelto no dice si 40% es mucho. */}
            {k.barra !== undefined && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line/60">
                <span
                  className={`block h-full rounded-full ${k.barra >= 0.6 ? "bg-ok" : "bg-accent-soft"}`}
                  style={{ width: `${Math.min(100, Math.round(k.barra * 100))}%` }}
                />
              </div>
            )}
            <div className="mt-1.5 text-[12px] leading-tight text-muted">{k.s}</div>
          </div>
        ))}
      </section>

      {/* ── Atendidas sin cobrar ───────────────────────────────
          Plata que ya se fue y no aparece en ninguna otra lista. Solo si hay. */}
      {sinCobrar.length > 0 && (
        <section aria-label="Atendidas sin cobrar" className="mt-5 overflow-hidden rounded-2xl border border-accent/45 bg-accent/[0.06]">
          <div className="px-4 pb-3 pt-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="eyebrow">Atendidas sin cobrar</span>
              <Link href="/admin/cuadre" className={SEC_ACTION}>
                Ver cuadre
              </Link>
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <span className="font-display text-[26px] font-extrabold leading-none tracking-tight text-ink tabular-nums lg:text-[30px]">
                {cop(montoSinCobrar)}
              </span>
              <span className="text-[12.5px] text-muted">
                {sinCobrar.length === 1 ? "1 cita se cerró" : `${sinCobrar.length} citas se cerraron`} sin pasar por caja
              </span>
            </div>
          </div>
          <div className="border-t border-accent/25">
            {sinCobrar.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-[56px_1fr_auto] items-center gap-3 border-b border-accent/15 px-4 py-2.5 last:border-b-0 lg:grid-cols-[64px_1fr_auto]"
              >
                <span className="font-display text-[15px] font-extrabold tracking-tight text-ink tabular-nums lg:text-base">
                  {horaBogota(c.inicio)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold text-ink">{c.cliente}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {c.servicio} · {c.barbero} · {TAG_SEDE[c.sede] ?? c.sede}
                  </span>
                </span>
                <span className="text-right font-display text-[15px] font-extrabold text-ink tabular-nums lg:text-base">
                  {c.precio !== null ? cop(c.precio) : "—"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Columna principal (lo que pasa ahora) + lateral (dinero y pendientes). */}
      {/* Móvil: pila por prioridad (qué pasa ahora → qué viene → caja → pendientes
          → lectura de 30 días). Escritorio: operación a la izquierda, plata y
          pendientes en el lateral. */}
      <div className="mt-5 flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-6 lg:gap-y-5">
        <div className="order-1 flex flex-col gap-6 lg:order-none lg:col-span-7 lg:gap-5">
          {/* ── Ahora mismo ─────────────────────────────────── */}
          <section aria-label="Equipo ahora">
            <h2 className={`${SEC} mb-2.5`}>
              <span>Ahora mismo</span>
              <Link href="/admin/equipo" className={SEC_ACTION}>
                Ver equipo
              </Link>
            </h2>

            {equipo.length === 0 ? (
              <div className={`${PANEL} px-4 py-5 text-sm text-muted`}>
                No hay barberos activos{sede ? " en esta sede" : ""}.
              </div>
            ) : (
              <>
                <p className="mb-2.5 text-[12.5px] text-muted">
                  {enSillaCount === 0 ? (
                    "Nadie en silla ahora mismo"
                  ) : (
                    <>
                      <span className="font-semibold text-ink tabular-nums">
                        {enSillaCount} de {equipo.length}
                      </span>{" "}
                      atendiendo
                    </>
                  )}
                  {libres.length > 0 && <span className="text-ok"> · {libres.length} libres</span>}
                </p>

                {/* Una TARJETA por barbero. Antes eran seis caras de 28px en una
                    tira: no se sabía quién produce, quién está libre ni desde
                    cuándo. Ahora cada uno muestra su estado y su plata del día
                    —el número que el dueño quiere de verdad— y el que se pasó de
                    hora se pinta solo. */}
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {[...conAtencion, ...libres].map((b) => {
                    const pasadoDeHora = !!b.enSilla && new Date(b.enSilla.fin).getTime() < ahora;
                    const suyo = pulso.porBarbero[b.id];
                    return (
                      <div
                        key={b.id}
                        className={`rounded-2xl border bg-panel p-3.5 transition ${
                          pasadoDeHora
                            ? "border-accent/50 bg-accent/[0.06]"
                            : b.enSilla
                              ? "border-ok/30"
                              : "border-line"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-elevated text-[13px] font-bold text-ink">
                            {b.fotoUrl ? (
                              <Image src={b.fotoUrl} alt={b.nombre} width={44} height={44} className="h-full w-full object-cover" />
                            ) : (
                              iniciales(b.nombre)
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-bold leading-tight text-ink">{b.nombre}</span>
                            <span className="block truncate text-[12px] text-muted">{NOMBRE_SEDE[b.sede] ?? b.sede}</span>
                          </span>
                          <span
                            className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-[3px] text-[12px] font-bold uppercase tracking-wide ${
                              pasadoDeHora
                                ? "border-ink bg-ink text-bg"
                                : b.enSilla
                                  ? "border-ok/40 text-ok"
                                  : "border-line text-muted"
                            }`}
                          >
                            {pasadoDeHora ? `+${atraso(b.enSilla!.fin, ahora)}` : b.enSilla ? "En silla" : "Libre"}
                          </span>
                        </div>

                        <p className="mt-2.5 truncate text-[12px] text-ink/85">
                          {b.enSilla ? (
                            <>
                              {b.enSilla.cliente} · {b.enSilla.servicio}
                              <span className="text-muted">
                                {pasadoDeHora ? " · debía salir " : " · sale "}
                                {horaBogota(b.enSilla.fin)}
                              </span>
                            </>
                          ) : (
                            <span className="text-muted">Silla libre</span>
                          )}
                        </p>

                        <div className="mt-2.5 flex items-baseline justify-between border-t border-line/60 pt-2.5">
                          <span className="text-[12px] text-muted tabular-nums">
                            {suyo ? `${suyo.cobros} ${suyo.cobros === 1 ? "cobro" : "cobros"} hoy` : "sin cobros hoy"}
                          </span>
                          <span className="font-display text-[15px] font-extrabold text-ink tabular-nums">
                            {cop(suyo?.plata ?? 0)}
                          </span>
                        </div>

                        {b.pinBloqueado && (
                          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-warn/40 bg-warn/[0.08] px-2.5 py-1.5">
                            <span className="text-[12px] font-bold text-warn">PIN bloqueado</span>
                            <DesbloquearPinBtn barberoId={b.id} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          {/* ── Siguientes citas ────────────────────────────── */}
          <section aria-label="Siguientes citas">
            <h2 className={`${SEC} mb-2.5`}>
              <span>Lo que viene</span>
              <Link href="/admin/agenda" className={SEC_ACTION}>
                Ver agenda completa
              </Link>
            </h2>
            <div className={PANEL}>
              {citas.length === 0 && vencidas.length === 0 && (
                <div className="px-4 py-6 text-center">
                  <ScissorsIcon className="mx-auto h-4 w-4 text-muted" />
                  <p className="mt-1 text-[13px] font-semibold text-ink">No quedan citas para hoy</p>
                  <p className="text-[12px] text-muted">Los walk-ins siguen entrando por el mostrador.</p>
                </div>
              )}

              {/* Vencidas primero: pasó su hora y nadie las tocó. */}
              {vencidas.map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-[56px_1fr_auto] items-center gap-3 border-b border-line/60 bg-accent/[0.06] px-4 py-2.5 last:border-b-0 lg:grid-cols-[64px_1fr_auto]"
                >
                  <span className="font-display text-[15px] font-extrabold tracking-tight text-ink tabular-nums lg:text-base">
                    {horaBogota(c.inicio)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-ink">{c.cliente}</span>
                    <span className="block truncate text-[12px] text-muted">
                      {c.servicio} · {c.barbero}
                    </span>
                    <span className="mt-1 inline-block rounded-full border border-accent/45 bg-accent/15 px-2 py-[2px] text-[12px] font-bold text-accent-soft">
                      Debía entrar {horaBogota(c.inicio)} · sin registrar
                    </span>
                  </span>
                  <span className="text-[12px] font-extrabold tracking-[0.06em] text-muted">{TAG_SEDE[c.sede] ?? c.sede}</span>
                </div>
              ))}

              {citas.map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-[56px_1fr_auto] items-center gap-3 border-b border-line/60 px-4 py-2.5 transition last:border-b-0 hover:bg-elevated lg:grid-cols-[64px_1fr_auto]"
                >
                  <span className="font-display text-[15px] font-extrabold tracking-tight text-ink tabular-nums lg:text-base">
                    {horaBogota(c.inicio)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-ink">{c.cliente}</span>
                    <span className="block truncate text-[12px] text-muted">
                      {c.servicio} · {c.barbero}
                    </span>
                  </span>
                  <span className="text-[12px] font-extrabold tracking-[0.06em] text-muted">{TAG_SEDE[c.sede] ?? c.sede}</span>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* ── Lateral ───────────────────────────────────────── */}
        {/* ── Cómo salieron los cortes ───────────────────────
            Lectura del trabajo hecho, no una tarea: en el celular va al final
            (después de caja y pendientes) y en escritorio cierra la columna
            operativa, así las dos columnas terminan parejas. */}
        <section aria-label="Postventa" className="order-3 lg:col-span-7 lg:col-start-1">
            <h2 className={`${SEC} mb-2.5`}>
              <span>Cómo salieron los cortes · 30 días</span>
            </h2>
            <div className={`${PANEL} p-4`}>
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="font-display text-[26px] font-extrabold leading-none tracking-tight text-ink tabular-nums">
                  {postventa.promedio !== null ? postventa.promedio.toLocaleString("es-CO") : "—"}
                </span>
                {postventa.promedio !== null && (
                  <span className="text-[13px] tracking-[1.5px] text-warn">
                    <Estrellas score={postventa.promedio} className="h-4 w-4" />
                  </span>
                )}
                <span className="text-[12px] text-muted">
                  {postventa.total > 0
                    ? `${postventa.total} ${postventa.total === 1 ? "calificación" : "calificaciones"}`
                    : "Sin calificaciones todavía"}
                </span>
              </div>
              {postventa.ultimas.map((c) => (
                <div key={c.id} className="mt-3 border-t border-line/60 pt-3 text-[12.5px]">
                  <p className="text-ink/85">“{c.comentario}”</p>
                  <p className="mt-0.5 text-[12px] text-muted">
                    <Estrellas score={c.score} /> · {c.barbero} · {c.sede} · {fechaCorta(c.fecha)}
                  </p>
                </div>
              ))}
            </div>
          </section>

        {/* ── Lateral ───────────────────────────────────────── */}
        {/* Sticky en escritorio: la caja y los pendientes (lo accionable) se
            quedan a la vista mientras se recorre la columna operativa. */}
        <div className="order-2 flex flex-col gap-6 lg:sticky lg:top-28 lg:order-none lg:col-span-5 lg:max-h-[calc(100dvh-8.5rem)] lg:gap-5 lg:overflow-y-auto">
          {/* Caja */}
          <section aria-label="Caja">
            <h2 className={`${SEC} mb-2.5`}>
              <span>Caja</span>
              <span className="flex items-center gap-3">
                {/* El gasto suelto (la botella de agua) tiene su atajo directo:
                    antes había que saber que vivía dentro del cuadre. */}
                <Link href="/admin/cuadre#registrar" className={SEC_ACTION}>
                  + Gasto
                </Link>
                <Link href="/admin/cuadre" className={SEC_ACTION}>
                  Cuadre manual
                </Link>
              </span>
            </h2>
            <div className={PANEL}>
              {caja.map((c) => (
                <div
                  key={c.sede}
                  className={`grid grid-cols-[42px_1fr_auto] items-center gap-3 border-b border-line/60 px-4 py-3 last:border-b-0 ${
                    c.estado === "abierta" ? "bg-warn/[0.04]" : ""
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={FOTO_SEDE[c.sede] ?? "/sedes/parque-venezuela-frente.jpg"}
                    alt=""
                    width={44}
                    height={44}
                    className="h-[42px] w-[42px] rounded-[10px] object-cover lg:h-11 lg:w-11"
                  />
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-semibold text-ink">{NOMBRE_SEDE[c.sede] ?? c.nombre}</span>
                    <span className="block truncate text-[12px] text-muted">
                      {/* Una caja de días acá decía solo la hora ("Abierta desde 1:41 am") y
                          se leía como si fuera de hoy — el mismo engaño que ya se arregló en
                          el chip del topbar y en el cierre del mostrador. Corto a propósito:
                          en 375px esta línea trunca, y la fecha exacta está en el cuadre. */}
                      {c.estado === "abierta" &&
                        (() => {
                          const d = diasDesde(c.hora as string);
                          if (d === 0) return `Abierta desde ${horaBogota(c.hora as string)}`;
                          return `Abierta hace ${d === 1 ? "1 día" : `${d} días`}`;
                        })()}
                      {c.estado === "cerrada" &&
                        `Cerrada ${horaBogota(c.hora as string)}${c.cerradaPor ? ` · ${c.cerradaPor}` : ""}`}
                      {c.estado === "sin_abrir" && "Sin abrir · se abre sola con la primera venta"}
                    </span>
                  </span>
                  <span className="text-right tabular-nums">
                    <span className="block font-display text-[15px] font-extrabold text-ink">{cop(c.total)}</span>
                    {c.estado === "abierta" && (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-extrabold uppercase tracking-[0.06em] text-warn">
                        <span className="h-1.5 w-1.5 rounded-full bg-warn" />
                        Abierta
                      </span>
                    )}
                    {/* El resultado del cuadre es el dato que el dueño vino a ver:
                        legible sin lupa, y la diferencia (plata faltante) en warn. */}
                    {c.estado === "cerrada" && c.diferencia !== null && (
                      <span
                        className={`mt-0.5 inline-block text-[12px] font-extrabold uppercase tracking-[0.06em] ${
                          c.diferencia === 0 ? "text-ok" : "text-warn"
                        }`}
                      >
                        {c.diferencia === 0 ? "Cuadra" : `Dif ${c.diferencia > 0 ? "+" : ""}${cop(c.diferencia)}`}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Para hacer */}
          <section aria-label="Para hacer">
            <h2 className={`${SEC} mb-2.5`}>
              <span>Para hacer</span>
            </h2>
            {sinTareas ? (
              <div className={`${PANEL} px-4 py-5 text-center`}>
                <CheckIcon className="mx-auto h-4 w-4 text-ok" />
                <p className="mt-1 text-[13px] font-semibold text-ink">Todo al día</p>
                <p className="text-[12px] text-muted">Sin stock bajo, malas calificaciones ni cupones por vencer.</p>
              </div>
            ) : (
              <div className={PANEL}>
                {tareas.bajoMinimo.length > 0 && (
                  <div className="grid grid-cols-[30px_1fr_auto] items-center gap-2.5 border-b border-line/60 px-4 py-3 last:border-b-0">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-elevated text-warn">
                      <AlertIcon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-semibold text-ink">
                        {tareas.bajoMinimo.length === 1
                          ? "1 producto bajo mínimo"
                          : `${tareas.bajoMinimo.length} productos bajo mínimo`}
                      </span>
                      <span className="block truncate text-[12px] text-muted">
                        {tareas.bajoMinimo
                          .slice(0, 3)
                          .map((p) => `${p.nombre} (${TAG_SEDE[p.sede] ?? p.sede})`)
                          .join(" · ")}
                        {tareas.bajoMinimo.length > 3 ? "…" : ""}
                      </span>
                    </span>
                    <Link href="/admin/inventario" className={SEC_ACTION}>
                      Reponer
                    </Link>
                  </div>
                )}

                {tareas.malasResenas.map((r) => (
                  <div
                    key={r.id}
                    className="grid grid-cols-[30px_1fr_auto] items-center gap-2.5 border-b border-line/60 px-4 py-3 last:border-b-0"
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-elevated text-accent-soft">
                      <StarIcon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-semibold text-ink">
                        Calificación {r.score}/5 · {r.barbero}
                      </span>
                      <span className="block truncate text-[12px] text-muted">
                        {r.comentario ? `“${r.comentario}”` : "Sin comentario"} · {TAG_SEDE[r.sede] ?? r.sede} ·{" "}
                        {fechaCorta(r.fecha)}
                      </span>
                    </span>
                    {/* Con ficha → directo a la pestaña "Su opinión" del cliente;
                        sin ficha (walk-in) el label promete exactamente a dónde va. */}
                    <Link
                      href={r.clienteRef ? `/admin/clientes/${r.clienteRef}` : "/admin/clientes"}
                      className={SEC_ACTION}
                    >
                      {r.clienteRef ? "Ver cliente" : "Ver clientes"}
                    </Link>
                  </div>
                ))}

                {tareas.cuponesPorVencer.map((c) => (
                  <div
                    key={c.codigo}
                    className="grid grid-cols-[30px_1fr_auto] items-center gap-2.5 border-b border-line/60 px-4 py-3 last:border-b-0"
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-elevated text-muted">
                      <PercentIcon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-semibold text-ink">
                        Cupón {c.codigo} vence {fechaCorta(`${c.venceEn}T12:00:00-05:00`)}
                      </span>
                      <span className="block text-[12px] text-muted tabular-nums">
                        {c.usosMax != null ? `${c.usos} de ${c.usosMax} usos` : `${c.usos} usos`}
                      </span>
                    </span>
                    <Link href="/admin/cupones" className={SEC_ACTION}>
                      Ver
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}

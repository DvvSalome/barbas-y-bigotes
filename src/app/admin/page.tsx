import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  ventasHoyPorMedio,
  equipoAhora,
  citasSiguientes,
  citasVencidasHoy,
  atendidasSinCobrar,
  paraHacer,
  serie7Dias,
  getPostventaResumen,
  getCierresHoy,
} from "@/lib/data/queries";
import { cop } from "@/lib/format";
import { fmtTime, CLOSE } from "@/lib/slots";
import { DesbloquearPinBtn } from "@/components/admin/DesbloquearPinBtn";
import { AlertIcon } from "@/components/icons";
import type { SedeId } from "@/lib/data/types";

export const metadata: Metadata = { title: "Hoy · Admin" };

const NOMBRE_SEDE: Record<string, string> = {
  "parque-venezuela": "Parque Venezuela",
  "plaza-de-la-paz": "Plaza de la Paz",
};
const TAG_SEDE: Record<string, string> = {
  "parque-venezuela": "PV",
  "plaza-de-la-paz": "PLAZA",
};
const FOTO_SEDE: Record<string, string> = {
  "parque-venezuela": "/sedes/parque-venezuela-frente.jpg",
  "plaza-de-la-paz": "/sedes/plaza-de-la-paz-frente.jpg",
};

function horaBogota(iso: string) {
  const [h, m] = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(iso))
    .split(":")
    .map(Number);
  return `${((h + 11) % 12) + 1}:${m.toString().padStart(2, "0")}${h < 12 ? "a" : "p"}`;
}

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short" });
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

function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Label de sección: 11px 700 uppercase ls .14em, color muted.
const SEC = "flex items-baseline justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-muted";
// Link de acción a la derecha del label (rojo suave, 12px 600).
const SEC_ACTION = "text-xs font-semibold normal-case tracking-normal text-accent-soft transition hover:text-ink";
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
  const sp = await searchParams;
  const sedeParam = typeof sp.sede === "string" ? sp.sede : undefined;
  const sede = sedeParam && sedeParam in NOMBRE_SEDE ? (sedeParam as SedeId) : null;

  const [plata, equipo, citas, vencidas, sinCobrar, tareas, serie, postventa, caja] = await Promise.all([
    ventasHoyPorMedio(sede),
    equipoAhora(sede),
    citasSiguientes(sede),
    citasVencidasHoy(sede),
    atendidasSinCobrar(sede),
    paraHacer(sede),
    serie7Dias(sede),
    getPostventaResumen(sede ?? undefined),
    getCierresHoy(sede),
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

  // Sparkline: mismo mapeo del mockup (300x56, margen 8).
  const valores = serie.dias.map((d) => d.total);
  const mx = Math.max(...valores);
  const mn = Math.min(...valores);
  const rango = mx - mn || 1;
  const puntos = valores.map((v, i) => [8 + i * (284 / (valores.length - 1)), 48 - ((v - mn) / rango) * 38] as const);
  const ultimo = puntos[puntos.length - 1];

  const cajasAbiertas = caja.filter((c) => c.estado === "abierta").length;

  return (
    <div>
      {/* ── La banda del día ───────────────────────────────────
          Encabezado y plata son la MISMA unidad, no una card flotante encima de
          otra (anti-referencia de PRODUCT.md: la plantilla hero-métrica). Vive
          sobre el fondo de la página y cierra con una línea. */}
      <header className="pb-4">
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
              <div className="font-display text-[15px] font-extrabold leading-none text-ink tabular-nums">
                {compacto(serie.semana)}
              </div>
              <div className="mt-1 text-[11px] text-muted tabular-nums">vs {compacto(serie.semanaAnterior)} semana pasada</div>
            </div>
            <svg viewBox="0 0 300 56" preserveAspectRatio="none" aria-label="Ingresos de los últimos 7 días" className="h-9 w-[150px]">
              <polyline
                fill="none"
                stroke="var(--bar)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={puntos.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")}
              />
              <circle cx={ultimo[0].toFixed(1)} cy={ultimo[1].toFixed(1)} r="4" fill="var(--accent-soft)" />
            </svg>
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
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-muted">Todavía no se cobró nada hoy. Lo del día va a ir apareciendo acá.</p>
        )}

        {/* Tendencia en móvil */}
        <div className="mt-4 flex items-center gap-3 lg:hidden">
          <svg viewBox="0 0 300 56" preserveAspectRatio="none" aria-hidden className="h-8 flex-1">
            <polyline
              fill="none"
              stroke="var(--bar)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={puntos.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")}
            />
            <circle cx={ultimo[0].toFixed(1)} cy={ultimo[1].toFixed(1)} r="4" fill="var(--accent-soft)" />
          </svg>
          <div className="shrink-0 text-right text-[11px] text-muted tabular-nums">
            <span className="font-display text-[14px] font-extrabold text-ink">{compacto(serie.semana)}</span> esta semana
            <br />
            vs {compacto(serie.semanaAnterior)} la pasada
          </div>
        </div>
      </header>

      <div className="border-t border-line" />

      {/* ── Atendidas sin cobrar ───────────────────────────────
          Plata que ya se fue y no aparece en ninguna otra lista. Solo si hay. */}
      {sinCobrar.length > 0 && (
        <section aria-label="Atendidas sin cobrar" className="mt-5 overflow-hidden rounded-2xl border border-accent/45 bg-accent/[0.06]">
          <div className="px-4 pb-3 pt-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent-soft">Atendidas sin cobrar</span>
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
                  <span className="block truncate text-[11.5px] text-muted">
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
      <div className="mt-5 flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-4 lg:gap-y-5">
        <div className="order-1 flex flex-col gap-6 lg:order-none lg:col-span-7 lg:gap-5">
          {/* ── Ahora mismo ─────────────────────────────────── */}
          <section aria-label="Equipo ahora">
            <h2 className={`${SEC} mb-2.5`}>
              <span>Ahora mismo</span>
              <Link href="/admin/equipo" className={SEC_ACTION}>
                Gestionar PINes
              </Link>
            </h2>

            {equipo.length === 0 ? (
              <div className={`${PANEL} px-4 py-5 text-sm text-muted`}>
                No hay barberos activos{sede ? " en esta sede" : ""}.
              </div>
            ) : (
              <div className={PANEL}>
                {/* Resumen: la única línea que hace falta cuando no pasa nada. */}
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 px-4 py-3">
                  <span className="text-[13px] text-muted">
                    {enSillaCount === 0 ? (
                      "Nadie en silla ahora mismo"
                    ) : (
                      <>
                        <span className="font-semibold text-ink tabular-nums">
                          {enSillaCount} de {equipo.length}
                        </span>{" "}
                        {enSillaCount === 1 ? "atendiendo" : "atendiendo"}
                      </>
                    )}
                  </span>
                  {libres.length > 0 && (
                    <div className="flex items-center gap-2.5">
                      <div className="flex -space-x-1.5">
                        {libres.slice(0, 6).map((b) => (
                          <span
                            key={b.id}
                            title={`${b.nombre} · libre`}
                            className="relative grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-elevated text-[9.5px] font-bold text-muted ring-2 ring-panel"
                          >
                            {b.fotoUrl ? (
                              <Image src={b.fotoUrl} alt={b.nombre} width={28} height={28} className="h-full w-full object-cover" />
                            ) : (
                              iniciales(b.nombre)
                            )}
                          </span>
                        ))}
                      </div>
                      <span className="text-[12px] text-ok">{libres.length} libres</span>
                    </div>
                  )}
                </div>

                {/* Filas solo para lo que pide una mirada. */}
                {conAtencion.map((b) => {
                  const pasadoDeHora = !!b.enSilla && new Date(b.enSilla.fin).getTime() < ahora;
                  return (
                    <div
                      key={b.id}
                      className={`grid grid-cols-[36px_1fr_auto] items-center gap-3 border-t border-line/60 px-4 py-2.5 ${
                        pasadoDeHora ? "bg-accent/[0.06]" : ""
                      }`}
                    >
                      <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-elevated text-xs font-bold text-ink">
                        {b.fotoUrl ? (
                          <Image src={b.fotoUrl} alt={b.nombre} width={36} height={36} className="h-full w-full object-cover" />
                        ) : (
                          iniciales(b.nombre)
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-semibold text-ink">{b.nombre}</span>
                        <span className="block truncate text-[11.5px] text-muted">
                          {b.enSilla ? `${b.enSilla.servicio} · ${b.enSilla.cliente}` : NOMBRE_SEDE[b.sede] ?? b.sede}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        {b.pinBloqueado && (
                          <>
                            <span className="whitespace-nowrap rounded-full border border-warn/40 px-2.5 py-[3px] text-[10.5px] font-bold text-warn">
                              PIN bloqueado
                            </span>
                            <DesbloquearPinBtn barberoId={b.id} />
                          </>
                        )}
                        {b.enSilla && (
                          <span
                            className={`whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[10.5px] font-bold ${
                              pasadoDeHora ? "border-accent bg-accent/15 text-accent-soft" : "border-accent/40 text-accent-soft"
                            }`}
                          >
                            {pasadoDeHora ? `Sin cerrar · +${atraso(b.enSilla.fin, ahora)}` : `Sale ${horaBogota(b.enSilla.fin)}`}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Siguientes citas ────────────────────────────── */}
          <section aria-label="Siguientes citas">
            <h2 className={`${SEC} mb-2.5`}>
              <span>Lo que viene</span>
              <Link href="/barbero" className={SEC_ACTION}>
                Ver agenda completa
              </Link>
            </h2>
            <div className={PANEL}>
              {citas.length === 0 && vencidas.length === 0 && (
                <div className="px-4 py-6 text-center">
                  <div className="text-[15px]">✂</div>
                  <p className="mt-1 text-[13px] font-semibold text-ink">No quedan citas para hoy</p>
                  <p className="text-[11.5px] text-muted">Los walk-ins siguen entrando por el mostrador.</p>
                </div>
              )}

              {/* Vencidas primero: pasó su hora y nadie las tocó. */}
              {vencidas.map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-[56px_1fr_auto] items-center gap-3 border-b border-line/60 bg-accent/[0.06] px-4 py-2.5 last:border-b-0 lg:grid-cols-[64px_1fr_auto]"
                >
                  <span className="font-display text-[15px] font-extrabold tracking-tight text-accent-soft tabular-nums lg:text-base">
                    {horaBogota(c.inicio)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-ink">{c.cliente}</span>
                    <span className="block truncate text-[11.5px] text-muted">
                      {c.servicio} · {c.barbero}
                    </span>
                    <span className="mt-1 inline-block rounded-full border border-accent/45 bg-accent/15 px-2 py-[2px] text-[10.5px] font-bold text-accent-soft">
                      Debía entrar {horaBogota(c.inicio)} · sin registrar
                    </span>
                  </span>
                  <span className="text-[10px] font-extrabold tracking-[0.06em] text-muted">{TAG_SEDE[c.sede] ?? c.sede}</span>
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
                    <span className="block truncate text-[11.5px] text-muted">
                      {c.servicio} · {c.barbero}
                    </span>
                  </span>
                  <span className="text-[10px] font-extrabold tracking-[0.06em] text-muted">{TAG_SEDE[c.sede] ?? c.sede}</span>
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
                    {"★".repeat(Math.round(postventa.promedio))}
                    <span className="text-line">{"★".repeat(5 - Math.round(postventa.promedio))}</span>
                  </span>
                )}
                <span className="text-[11.5px] text-muted">
                  {postventa.total > 0
                    ? `${postventa.total} ${postventa.total === 1 ? "calificación" : "calificaciones"}`
                    : "Sin calificaciones todavía"}
                </span>
              </div>
              {postventa.ultimas.map((c) => (
                <div key={c.id} className="mt-3 border-t border-line/60 pt-3 text-[12.5px]">
                  <p className="text-ink/85">“{c.comentario}”</p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {"★".repeat(c.score)}
                    {"☆".repeat(5 - c.score)} · {c.barbero} · {c.sede} · {fechaCorta(c.fecha)}
                  </p>
                </div>
              ))}
            </div>
          </section>

        {/* ── Lateral ───────────────────────────────────────── */}
        <div className="order-2 flex flex-col gap-6 lg:order-none lg:col-span-5 lg:gap-5">
          {/* Caja */}
          <section aria-label="Caja">
            <h2 className={`${SEC} mb-2.5`}>
              <span>Caja</span>
              <Link href="/admin/cuadre" className={SEC_ACTION}>
                Cuadre manual
              </Link>
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
                      {c.estado === "abierta" && `Abierta desde ${horaBogota(c.hora as string)}`}
                      {c.estado === "cerrada" &&
                        `Cerrada ${horaBogota(c.hora as string)}${c.cerradaPor ? ` · ${c.cerradaPor}` : ""}`}
                      {c.estado === "sin_abrir" && "Sin abrir · se abre sola con la primera venta"}
                    </span>
                  </span>
                  <span className="text-right tabular-nums">
                    <span className="block font-display text-[15px] font-extrabold text-ink">{cop(c.total)}</span>
                    {c.estado === "abierta" && (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-warn">
                        <span className="h-1.5 w-1.5 rounded-full bg-warn" />
                        Abierta
                      </span>
                    )}
                    {c.estado === "cerrada" && c.diferencia !== null && (
                      <span
                        className={`mt-0.5 inline-block text-[10px] font-extrabold uppercase tracking-[0.06em] ${
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
                <div className="text-[15px]">✓</div>
                <p className="mt-1 text-[13px] font-semibold text-ink">Todo al día</p>
                <p className="text-[11.5px] text-muted">Sin stock bajo, malas calificaciones ni cupones por vencer.</p>
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
                      <span className="block truncate text-[11px] text-muted">
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
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-elevated text-[13px] text-accent-soft">★</span>
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-semibold text-ink">
                        Calificación de {r.score}★ · {r.barbero}
                      </span>
                      <span className="block truncate text-[11px] text-muted">
                        {r.comentario ? `“${r.comentario}”` : "Sin comentario"} · {TAG_SEDE[r.sede] ?? r.sede} ·{" "}
                        {fechaCorta(r.fecha)}
                      </span>
                    </span>
                    <Link href="/admin/clientes" className={SEC_ACTION}>
                      Leer
                    </Link>
                  </div>
                ))}

                {tareas.cuponesPorVencer.map((c) => (
                  <div
                    key={c.codigo}
                    className="grid grid-cols-[30px_1fr_auto] items-center gap-2.5 border-b border-line/60 px-4 py-3 last:border-b-0"
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-elevated text-[13px] text-muted">%</span>
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-semibold text-ink">
                        Cupón {c.codigo} vence {fechaCorta(`${c.venceEn}T12:00:00-05:00`)}
                      </span>
                      <span className="block text-[11px] text-muted tabular-nums">
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

import type { Metadata } from "next";
import Link from "next/link";
import {
  ventasHoyPorMedio,
  equipoAhora,
  citasSiguientes,
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

// Un solo tono neutro cálido para magnitudes (DESIGN.md: el rojo es acción, no
// decoración). Token en globals.css: cambia con el tema claro/oscuro del staff.
const BAR = "var(--bar)";

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

// "$6,4M" para la semana del sparkline; montos chicos van completos.
function compacto(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
  return cop(n);
}

const SEC = "flex items-baseline justify-between text-[11px] font-bold uppercase tracking-[0.16em] text-muted";
const SEC_ACTION = "text-xs font-semibold normal-case tracking-normal text-accent-soft transition hover:text-ink";

export default async function AdminHoy({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const sedeParam = typeof sp.sede === "string" ? sp.sede : undefined;
  const sede = sedeParam && sedeParam in NOMBRE_SEDE ? (sedeParam as SedeId) : null;

  const [plata, equipo, citas, tareas, serie, postventa, caja] = await Promise.all([
    ventasHoyPorMedio(sede),
    equipoAhora(sede),
    citasSiguientes(sede),
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
  const maxMedio = Math.max(1, ...plata.medios.map((m) => m.total));
  const sinTareas =
    tareas.bajoMinimo.length === 0 && tareas.malasResenas.length === 0 && tareas.cuponesPorVencer.length === 0;

  // Sparkline server-render: mismo mapeo del mockup (300x56, margen 8).
  const valores = serie.dias.map((d) => d.total);
  const mx = Math.max(...valores);
  const mn = Math.min(...valores);
  const rango = mx - mn || 1;
  const puntos = valores.map((v, i) => [8 + i * (284 / (valores.length - 1)), 48 - ((v - mn) / rango) * 38] as const);
  const ultimo = puntos[puntos.length - 1];

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-[26px]">
          {sede ? `El día en ${NOMBRE_SEDE[sede]}` : "El día en las dos sedes"}
        </h1>
        <span className="text-[13px] text-muted">
          {fecha} · cierre {fmtTime(CLOSE)}
        </span>
      </div>

      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
        {/* ── Columna principal ─────────────────────────────── */}
        <div>
          {/* La plata */}
          <section
            aria-label="Plata del día"
            className="grid gap-x-9 gap-y-3 rounded-[14px] border border-line bg-panel px-5 py-5 sm:grid-cols-[auto_1fr] sm:px-6"
          >
            <div>
              <div className="text-xs text-muted">Cobrado hoy</div>
              <div className="font-display text-[44px] font-bold leading-[1.1] tracking-tight text-ink tabular-nums">
                {cop(plata.total)}
              </div>
              <div className="mt-1 text-[12.5px] text-muted tabular-nums">
                <span className="font-semibold text-ink/80">
                  {plata.atenciones} {plata.atenciones === 1 ? "atención" : "atenciones"}
                </span>{" "}
                · {cop(plata.propinas)} en propinas
              </div>
            </div>
            <div className="flex min-w-0 flex-col justify-center gap-2">
              {plata.medios.length === 0 ? (
                <p className="text-sm text-muted">Todavía no se cobró nada hoy. Lo del día va a ir apareciendo acá.</p>
              ) : (
                plata.medios.map((m) => (
                  <div
                    key={m.slug}
                    className="group grid grid-cols-[86px_1fr_84px] items-center gap-2.5 text-[12.5px] tabular-nums"
                    title={`${m.nombre}: ${cop(m.total)}${m.propina > 0 ? ` (+${cop(m.propina)} propina)` : ""}`}
                  >
                    <span className="truncate text-muted">{m.nombre}</span>
                    <span className="h-3.5 overflow-hidden rounded bg-line/60">
                      <span
                        className="block h-full rounded transition-colors group-hover:bg-accent-soft"
                        style={{ width: `${(m.total / maxMedio) * 100}%`, background: BAR }}
                      />
                    </span>
                    <span className="text-right font-semibold text-ink">{cop(m.total)}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Caja (read-only): la abre sola la 1ra venta, la cierra el barbero. */}
          <h2 className={`${SEC} mt-7 mb-2.5`}>
            <span>Caja</span>
            <Link href="/admin/cuadre" className={SEC_ACTION}>
              Cuadre manual
            </Link>
          </h2>
          <section className="overflow-hidden rounded-[14px] border border-line bg-panel">
            {caja.map((c) => (
              <div
                key={c.sede}
                className={`grid grid-cols-[1fr_auto] items-center gap-3 border-b border-line/60 px-4 py-3 transition last:border-b-0 ${
                  c.estado === "abierta" ? "bg-warn/[0.06]" : ""
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-ink">
                    {NOMBRE_SEDE[c.sede] ?? c.nombre}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {c.estado === "abierta" && `Abierta desde ${horaBogota(c.hora as string)}`}
                    {c.estado === "cerrada" &&
                      `Cerrada ${horaBogota(c.hora as string)}${c.cerradaPor ? ` · ${c.cerradaPor}` : ""}`}
                    {c.estado === "sin_abrir" && "Sin abrir · se abre sola con la primera venta"}
                  </span>
                </span>
                <span className="text-right tabular-nums">
                  <span className="block font-display text-[15px] font-bold text-ink">{cop(c.total)}</span>
                  {c.estado === "abierta" && (
                    <span className="block text-[11.5px] font-semibold text-warn">abierta</span>
                  )}
                  {c.estado === "cerrada" && c.diferencia !== null && (
                    <span
                      className={`block text-[11.5px] font-semibold ${
                        c.diferencia === 0 ? "text-ok" : "text-warn"
                      }`}
                    >
                      {c.diferencia === 0
                        ? "cuadra"
                        : `dif ${c.diferencia > 0 ? "+" : ""}${cop(c.diferencia)}`}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </section>

          {/* Equipo ahora */}
          <h2 className={`${SEC} mt-7 mb-2.5`}>
            <span>Equipo ahora</span>
            <Link href="/admin/equipo" className={SEC_ACTION}>
              Gestionar PINes
            </Link>
          </h2>
          <section className="overflow-hidden rounded-[14px] border border-line bg-panel">
            {equipo.length === 0 ? (
              <p className="px-4 py-5 text-sm text-muted">No hay barberos activos{sede ? " en esta sede" : ""}.</p>
            ) : (
              equipo.map((b) => (
                <div
                  key={b.id}
                  className="grid grid-cols-[38px_1fr_auto] items-center gap-3 border-b border-line/60 px-4 py-2.5 transition last:border-b-0 hover:bg-elevated"
                >
                  <span className="relative grid h-[34px] w-[34px] place-items-center rounded-full border border-line bg-elevated text-xs font-bold text-ink">
                    {b.nombre
                      .split(" ")
                      .map((x) => x[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                    <span
                      className={`absolute -bottom-px -right-px h-[9px] w-[9px] rounded-full border-2 border-panel ${
                        b.enSilla ? "bg-accent-soft" : "bg-ok"
                      }`}
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-ink">{b.nombre}</span>
                    <span className="block truncate text-xs text-muted">
                      {b.enSilla ? `${b.enSilla.servicio} · ${b.enSilla.cliente}` : NOMBRE_SEDE[b.sede] ?? b.sede}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {b.pinBloqueado && (
                      <>
                        <span className="whitespace-nowrap rounded-full border border-warn/40 px-2.5 py-1 text-[11.5px] font-semibold text-warn">
                          PIN bloqueado
                        </span>
                        <DesbloquearPinBtn barberoId={b.id} />
                      </>
                    )}
                    <span
                      className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${
                        b.enSilla
                          ? "border-accent/40 text-accent-soft"
                          : "border-ok/35 text-ok"
                      }`}
                    >
                      {b.enSilla ? `En silla · sale ${horaBogota(b.enSilla.fin)}` : "Libre"}
                    </span>
                  </span>
                </div>
              ))
            )}
          </section>

          {/* Siguientes citas */}
          <h2 className={`${SEC} mt-7 mb-2.5`}>
            <span>Siguientes citas</span>
            <Link href="/barbero" className={SEC_ACTION}>
              Ver agenda completa
            </Link>
          </h2>
          <section className="overflow-hidden rounded-[14px] border border-line bg-panel">
            {citas.length === 0 ? (
              <p className="px-4 py-5 text-sm text-muted">No quedan citas agendadas para hoy.</p>
            ) : (
              citas.map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-[64px_1fr_auto] items-center gap-3 border-b border-line/60 px-4 py-2.5 transition last:border-b-0 hover:bg-elevated"
                >
                  <span className="font-display text-[15px] font-bold tracking-tight text-ink tabular-nums">
                    {horaBogota(c.inicio)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-ink">{c.cliente}</span>
                    <span className="block truncate text-xs text-muted">
                      {c.servicio} · {c.barbero}
                    </span>
                  </span>
                  <span className="text-[10.5px] font-bold tracking-[0.06em] text-muted">
                    {TAG_SEDE[c.sede] ?? c.sede}
                  </span>
                </div>
              ))
            )}
          </section>
        </div>

        {/* ── Rail derecho ──────────────────────────────────── */}
        <aside>
          <h2 className={`${SEC} mb-2.5`}>
            <span>Para hacer</span>
          </h2>
          <div className="flex flex-col gap-2">
            {sinTareas && (
              <div className="rounded-[11px] border border-line bg-panel px-4 py-5 text-center">
                <div className="text-lg">✂</div>
                <div className="mt-1 text-sm font-semibold text-ink">Todo al día</div>
                <div className="text-xs text-muted">Sin stock bajo, malas calificaciones ni cupones por vencer.</div>
              </div>
            )}

            {tareas.bajoMinimo.length > 0 && (
              <div className="grid grid-cols-[30px_1fr_auto] items-center gap-2.5 rounded-[11px] border border-line bg-panel px-3 py-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-elevated text-warn">
                  <AlertIcon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-ink">
                    {tareas.bajoMinimo.length === 1
                      ? "1 producto bajo mínimo"
                      : `${tareas.bajoMinimo.length} productos bajo mínimo`}
                  </span>
                  <span className="block truncate text-[11.5px] text-muted">
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
                className="grid grid-cols-[30px_1fr_auto] items-center gap-2.5 rounded-[11px] border border-line bg-panel px-3 py-2.5"
              >
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-elevated text-[13px] text-accent-soft">★</span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-ink">
                    Calificación de {r.score}★ · {r.barbero}
                  </span>
                  <span className="block truncate text-[11.5px] text-muted">
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
                className="grid grid-cols-[30px_1fr_auto] items-center gap-2.5 rounded-[11px] border border-line bg-panel px-3 py-2.5"
              >
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-elevated text-[13px] text-muted">%</span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-ink">
                    Cupón {c.codigo} vence {fechaCorta(`${c.venceEn}T12:00:00-05:00`)}
                  </span>
                  <span className="block text-[11.5px] text-muted tabular-nums">
                    {c.usosMax != null ? `${c.usos} de ${c.usosMax} usos` : `${c.usos} usos`}
                  </span>
                </span>
                <Link href="/admin/cupones" className={SEC_ACTION}>
                  Ver
                </Link>
              </div>
            ))}
          </div>

          {/* Postventa (30 días) */}
          <h2 className={`${SEC} mt-7 mb-2.5`}>
            <span>Postventa · 30 días</span>
          </h2>
          <div className="rounded-[14px] border border-line bg-panel p-4">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="font-display text-3xl font-bold tracking-tight text-ink tabular-nums">
                {postventa.promedio !== null ? postventa.promedio.toLocaleString("es-CO") : "—"}
              </span>
              {postventa.promedio !== null && (
                <span className="text-[13px] tracking-[1.5px] text-warn">
                  {"★".repeat(Math.round(postventa.promedio))}
                  <span className="text-line">{"★".repeat(5 - Math.round(postventa.promedio))}</span>
                </span>
              )}
              <span className="text-xs text-muted">
                {postventa.total > 0
                  ? `${postventa.total} ${postventa.total === 1 ? "calificación" : "calificaciones"}`
                  : "Sin calificaciones todavía"}
              </span>
            </div>
            {postventa.ultimas.map((c) => (
              <div key={c.id} className="mt-3 border-t border-line/60 pt-3 text-[12.5px]">
                <p className="text-ink/85">“{c.comentario}”</p>
                <p className="mt-0.5 text-[11.5px] text-muted">
                  {"★".repeat(c.score)}
                  {"☆".repeat(5 - c.score)} · {c.barbero} · {c.sede} · {fechaCorta(c.fecha)}
                </p>
              </div>
            ))}
          </div>

          {/* Últimos 7 días */}
          <h2 className={`${SEC} mt-7 mb-2.5`}>
            <span>Últimos 7 días</span>
          </h2>
          <div className="rounded-[14px] border border-line bg-panel px-4 pb-2.5 pt-3.5">
            <div className="flex items-baseline justify-between text-xs text-muted tabular-nums">
              <span className="font-display text-base font-bold text-ink">{compacto(serie.semana)}</span>
              <span>vs {compacto(serie.semanaAnterior)} semana pasada</span>
            </div>
            <svg
              viewBox="0 0 300 56"
              preserveAspectRatio="none"
              aria-label="Ingresos de los últimos 7 días"
              className="mt-1.5 block h-14 w-full"
            >
              <polyline
                fill="none"
                stroke={BAR}
                strokeWidth="2"
                strokeLinecap="round"
                points={puntos.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")}
              />
              <circle cx={ultimo[0].toFixed(1)} cy={ultimo[1].toFixed(1)} r="3.5" fill="var(--accent-soft)" />
            </svg>
          </div>
        </aside>
      </div>
    </div>
  );
}

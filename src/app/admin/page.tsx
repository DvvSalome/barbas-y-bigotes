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

// "$6,4M" para la semana del sparkline; montos chicos van completos.
function compacto(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
  return cop(n);
}

// Label de sección (proto §0/§2): 11px 700 uppercase ls .14em, color muted.
const SEC = "flex items-baseline justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-muted";
// Link de acción a la derecha del label (rojo suave, 12px 600 — proto §2.4).
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
      {/* ── Encabezado ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-display text-[24px] font-extrabold uppercase leading-none text-ink lg:text-[32px]">
          {sede ? `El día en ${NOMBRE_SEDE[sede]}` : "El día en las dos sedes"}
        </h1>
        <span className="text-[12px] text-muted lg:text-[12.5px]">
          {fecha} · cierre {fmtTime(CLOSE)}
        </span>
      </div>

      {/* Móvil: pila única. Desktop (§2): grid 2 columnas con 4 cards; "Para
          hacer", "Postventa" y el sparkline quedan solo en móvil. */}
      <div className="mt-5 flex flex-col gap-7 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3.5">
        {/* ── Cobrado hoy (con desglose por medio en barras) ── */}
        <section
          aria-label="Plata del día"
          className="min-w-0 rounded-2xl border border-line bg-panel p-4 lg:px-5 lg:py-[18px]"
        >
          <div className="text-[11.5px] text-muted lg:uppercase lg:tracking-[0.14em]">Cobrado hoy</div>
          <div className="font-display text-[38px] font-extrabold leading-[1.05] tracking-tight text-ink tabular-nums lg:text-[44px]">
            {cop(plata.total)}
          </div>
          <div className="mt-1 text-[12.5px] text-muted tabular-nums">
            <span className="font-semibold text-ink">
              {plata.atenciones} {plata.atenciones === 1 ? "atención" : "atenciones"}
            </span>{" "}
            · {cop(plata.propinas)} en propinas
          </div>

          <div className="mt-4 flex min-w-0 flex-col gap-2">
            {plata.medios.length === 0 ? (
              <p className="text-sm text-muted">Todavía no se cobró nada hoy. Lo del día va a ir apareciendo acá.</p>
            ) : (
              plata.medios.map((m) => (
                <div
                  key={m.slug}
                  className="grid grid-cols-[70px_1fr_76px] items-center gap-2.5 text-[12.5px] tabular-nums lg:grid-cols-[76px_1fr_84px]"
                  title={`${m.nombre}: ${cop(m.total)}${m.propina > 0 ? ` (+${cop(m.propina)} propina)` : ""}`}
                >
                  <span className="truncate text-[12px] text-muted">{m.nombre}</span>
                  <span className="h-[13px] overflow-hidden rounded bg-line/60 lg:h-[9px] lg:rounded-full">
                    <span
                      className="block h-full rounded bg-[var(--bar)] lg:rounded-full"
                      style={{ width: `${(m.total / maxMedio) * 100}%` }}
                    />
                  </span>
                  <span className="text-right font-bold text-ink">{cop(m.total)}</span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ── Caja (read-only) ──────────────────────────────── */}
        <div className="min-w-0">
          <h2 className={`${SEC} mb-2.5`}>
            <span>Caja</span>
            <Link href="/admin/cuadre" className={SEC_ACTION}>
              Cuadre manual
            </Link>
          </h2>
          <section className="overflow-hidden rounded-2xl border border-line bg-panel">
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
                  <span className="block text-[13.5px] font-semibold text-ink">
                    {NOMBRE_SEDE[c.sede] ?? c.nombre}
                  </span>
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
                    <span className="mt-1 inline-block rounded-full bg-warn/[0.13] px-[9px] py-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.06em] text-warn lg:mt-0.5 lg:bg-transparent lg:px-0 lg:text-[10px]">
                      Abierta
                    </span>
                  )}
                  {c.estado === "cerrada" && c.diferencia !== null && (
                    <span
                      className={`mt-1 inline-block rounded-full px-[9px] py-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.06em] lg:mt-0.5 lg:bg-transparent lg:px-0 lg:text-[10px] ${
                        c.diferencia === 0 ? "bg-ok/[0.12] text-ok" : "bg-warn/[0.13] text-warn"
                      }`}
                    >
                      {c.diferencia === 0
                        ? "Cuadra"
                        : `Dif ${c.diferencia > 0 ? "+" : ""}${cop(c.diferencia)}`}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </section>
        </div>

        {/* ── Equipo ahora ──────────────────────────────────── */}
        <div className="min-w-0">
          <h2 className={`${SEC} mb-2.5`}>
            <span>Equipo ahora</span>
            <Link href="/admin/equipo" className={SEC_ACTION}>
              Gestionar PINes
            </Link>
          </h2>
          <section className="overflow-hidden rounded-2xl border border-line bg-panel">
            {equipo.length === 0 ? (
              <p className="px-4 py-5 text-sm text-muted">No hay barberos activos{sede ? " en esta sede" : ""}.</p>
            ) : (
              equipo.map((b) => (
                <div
                  key={b.id}
                  className="grid grid-cols-[38px_1fr_auto] items-center gap-3 border-b border-line/60 px-4 py-2.5 transition last:border-b-0 hover:bg-elevated"
                >
                  <span className="relative grid h-[34px] w-[34px] place-items-center rounded-full border border-line bg-elevated text-xs font-bold text-ink lg:h-9 lg:w-9">
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
                    <span
                      className={`whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[10.5px] font-bold ${
                        b.enSilla ? "border-accent/40 text-accent-soft" : "border-ok/35 text-ok"
                      }`}
                    >
                      {b.enSilla ? `En silla · sale ${horaBogota(b.enSilla.fin)}` : "Libre"}
                    </span>
                  </span>
                </div>
              ))
            )}
          </section>
        </div>

        {/* ── Siguientes citas ──────────────────────────────── */}
        <div className="min-w-0">
          <h2 className={`${SEC} mb-2.5`}>
            <span>Siguientes citas</span>
            <Link href="/barbero" className={SEC_ACTION}>
              Ver agenda completa
            </Link>
          </h2>
          <section className="overflow-hidden rounded-2xl border border-line bg-panel">
            {citas.length === 0 ? (
              <p className="px-4 py-5 text-sm text-muted">No quedan citas agendadas para hoy.</p>
            ) : (
              citas.map((c) => (
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
                  <span className="text-[10px] font-extrabold tracking-[0.06em] text-muted">
                    {TAG_SEDE[c.sede] ?? c.sede}
                  </span>
                </div>
              ))
            )}
          </section>
        </div>

        {/* ── Para hacer (solo móvil, §2) ───────────────────── */}
        <div className="min-w-0 lg:hidden">
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
                className="grid grid-cols-[30px_1fr_auto] items-center gap-2.5 rounded-[11px] border border-line bg-panel px-3 py-2.5"
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
                className="grid grid-cols-[30px_1fr_auto] items-center gap-2.5 rounded-[11px] border border-line bg-panel px-3 py-2.5"
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
        </div>

        {/* ── Postventa · 30 días (solo móvil, §2) ──────────── */}
        <div className="min-w-0 lg:hidden">
          <h2 className={`${SEC} mb-2.5`}>
            <span>Postventa · 30 días</span>
          </h2>
          <div className="rounded-2xl border border-line bg-panel p-4">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="font-display text-3xl font-extrabold tracking-tight text-ink tabular-nums">
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
        </div>

        {/* ── Últimos 7 días (solo móvil, §2) ───────────────── */}
        <div className="min-w-0 lg:hidden">
          <h2 className={`${SEC} mb-2.5`}>
            <span>Últimos 7 días</span>
          </h2>
          <div className="rounded-2xl border border-line bg-panel px-4 pb-2.5 pt-3.5">
            <div className="flex items-baseline justify-between text-[11.5px] text-muted tabular-nums">
              <span className="font-display text-base font-extrabold text-ink">{compacto(serie.semana)}</span>
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
                stroke="var(--bar)"
                strokeWidth="2"
                strokeLinecap="round"
                points={puntos.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")}
              />
              <circle cx={ultimo[0].toFixed(1)} cy={ultimo[1].toFixed(1)} r="3.5" fill="var(--accent-soft)" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AgendarCitaForm } from "@/components/barbero/AgendarCitaForm";
import { MoverCitaForm } from "@/components/admin/MoverCitaForm";
import { BloquearHorasForm } from "@/components/admin/BloquearHorasForm";
import { quitarBloqueo } from "@/lib/actions";
import { CaraBarbero } from "@/components/staff/Elegir";
import { DOW, MON, fmtTime, horarioEfectivo, dowDeFecha, bogotaYmd } from "@/lib/slots";
import type { Barbero, Servicio, SedeId } from "@/lib/data/types";
import type { AgendaDiaItem, BloqueoDia, HorarioSemanal, DiaEspecial } from "@/lib/data/queries";

// Calendario del día (estilo WeiBook): una columna por barbero de la sede, las
// citas como bloques de color por estado, línea de "ahora" y "+ Cita" a mano.
// Todo se dibuja con la MISMA fuente de horario que el wizard (horarioEfectivo):
// si la sede abre 10-18 ese día, la grilla va de 10 a 18.

const PX_MIN = 1.7; // alto en px de un minuto (30 min ≈ 51px, bloque tocable)

// Color por estado — tokens del panel, no colores inventados (DESIGN.md).
const ESTILO_ESTADO: Record<string, { card: string; label: string }> = {
  pendiente: { card: "border-dashed border-line bg-elevated text-ink", label: "Pendiente" },
  confirmada: { card: "border-accent/55 bg-accent/10 text-ink", label: "Confirmada" },
  en_curso: { card: "border-ok/60 bg-ok/10 text-ink", label: "En curso" },
  completada: { card: "border-ok/30 bg-ok/[0.04] text-muted", label: "Completada" },
  cancelada: { card: "border-line/50 bg-transparent text-muted line-through opacity-60", label: "Cancelada" },
  no_show: { card: "border-warn/55 bg-warn/10 text-warn", label: "No vino" },
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
  const [sheet, setSheet] = useState<{ barberoId?: string } | null>(null);
  // Detalle de una cita tocada (+ modo mover dentro del mismo sheet).
  const [detalle, setDetalle] = useState<AgendaDiaItem | null>(null);
  const [moviendo, setMoviendo] = useState(false);
  // Bloquear horas: sheet de creación y bloqueo tocado (para quitarlo).
  const [bloqueoSheet, setBloqueoSheet] = useState<{ barberoId?: string } | null>(null);
  const [bloqueoSel, setBloqueoSel] = useState<BloqueoDia | null>(null);
  const [quitando, setQuitando] = useState(false);
  const [errBloqueo, setErrBloqueo] = useState<string | null>(null);
  const [ahoraMin, setAhoraMin] = useState(minutoBogota);

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
          <div className="min-w-[130px] text-center">
            <div className="font-display text-xl leading-tight">
              {vistaActiva === "semana"
                ? `${labelFecha(lunes)} – ${labelFecha(ymdMas(lunes, 6))}`
                : esHoy
                  ? "Hoy"
                  : labelFecha(fecha)}
            </div>
            {vistaActiva === "dia" && esHoy && <div className="text-[11px] text-muted">{labelFecha(fecha)}</div>}
          </div>
          <Link href={href(ymdMas(fecha, paso))} aria-label={vistaActiva === "semana" ? "Semana siguiente" : "Día siguiente"} className={btnNav}>
            ›
          </Link>
          {!esHoy && (
            <Link href={href(hoy)} className="ml-1 rounded-full border border-accent/40 px-3.5 py-2 text-xs font-bold text-accent-soft transition hover:bg-accent/10">
              Volver a hoy
            </Link>
          )}
          {/* Conmutador Día / Semana (como WeiBook) */}
          <div className="ml-1 flex gap-0.5 rounded-[9px] border border-line bg-panel p-[3px]" role="group" aria-label="Vista">
            {(["dia", "semana"] as const).map((v) => (
              <Link
                key={v}
                href={href(fecha, v)}
                aria-current={vistaActiva === v ? "page" : undefined}
                className={`flex min-h-9 items-center rounded-md px-3 text-xs font-semibold transition ${
                  vistaActiva === v ? "bg-elevated text-ink shadow-[inset_0_0_0_1px_var(--line)]" : "text-muted hover:text-ink"
                }`}
              >
                {v === "dia" ? "Día" : "Semana"}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setBloqueoSheet({})}
            className="rounded-full border border-line px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-muted transition hover:text-ink"
          >
            Bloquear
          </button>
          <button
            onClick={() => setSheet({})}
            className="rounded-full bg-accent px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft"
          >
            + Cita
          </button>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-muted">
        {Object.entries(ESTILO_ESTADO).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-[4px] border ${v.card.split(" ").slice(0, 2).join(" ")}`} />
            {v.label}
          </span>
        ))}
      </div>

      {vistaActiva === "semana" ? (
        /* SEMANA: panorama compacto de los 7 días; tocar un día (o una cita)
           abre su vista Día. Las citas van con su color de estado. */
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-panel">
          <div className="grid min-w-[840px] grid-cols-7 divide-x divide-line/60">
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
                      className={`block text-[10.5px] font-bold uppercase tracking-wide ${
                        esHoyCol ? "text-accent-soft" : "text-muted"
                      }`}
                    >
                      {DOW[dowDeFecha(ymd)]}
                    </span>
                    <span className="block font-display text-lg leading-tight">{Number(ymd.slice(8))}</span>
                  </Link>
                  <div className="space-y-1 p-1.5">
                    {!abiertaDia ? (
                      <p className="px-1 py-2 text-center text-[10.5px] text-muted">Cerrado</p>
                    ) : citasDia.length === 0 ? (
                      <p className="px-1 py-2 text-center text-[10.5px] text-muted/60">—</p>
                    ) : (
                      citasDia.map((c) => {
                        const est = estiloDe(c.estado);
                        return (
                          <Link
                            key={c.id}
                            href={href(ymd, "dia")}
                            title={`${fmtTime(minutoDeISO(c.inicio))} · ${c.cliente || "Sin nombre"} · ${c.servicio} · ${c.barbero} (${est.label})`}
                            className={`block truncate rounded-md border px-1.5 py-1 text-[10.5px] leading-tight ${est.card}`}
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
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-panel">
          <div style={{ minWidth: 64 + barberos.length * 168 }}>
            {/* Cabecera: quién es cada columna */}
            <div className="grid border-b border-line" style={{ gridTemplateColumns: `64px repeat(${barberos.length}, 1fr)` }}>
              <div />
              {barberos.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSheet({ barberoId: b.id })}
                  title={`Agendar cita con ${b.nombre}`}
                  className="flex min-h-11 items-center justify-center gap-2 border-l border-line/60 px-2 py-2.5 transition hover:bg-elevated"
                >
                  <CaraBarbero b={b} size={28} />
                  <span className="truncate text-[12.5px] font-bold text-ink">{b.nombre.split(" ")[0]}</span>
                </button>
              ))}
            </div>

            {/* Cuerpo: horas + columnas con bloques */}
            <div className="grid" style={{ gridTemplateColumns: `64px repeat(${barberos.length}, 1fr)` }}>
              {/* Columna de horas */}
              <div className="relative" style={{ height: altoDia }}>
                {horas.map((m) => (
                  <span
                    key={m}
                    className="absolute right-2 -translate-y-1/2 text-[10.5px] tabular-nums text-muted"
                    style={{ top: (m - abre) * PX_MIN }}
                  >
                    {fmtTime(m)}
                  </span>
                ))}
              </div>

              {barberos.map((b) => {
                const citas = agenda.filter((a) => a.barberoId === b.id);
                const misBloqueos = bloqueos.filter((x) => x.barberoId === b.id);
                return (
                  <div
                    key={b.id}
                    className="relative border-l border-line/60"
                    style={{ height: altoDia }}
                    onClick={(e) => {
                      // Tocar un hueco vacío de la columna → agendar con ese barbero.
                      if (e.target === e.currentTarget) setSheet({ barberoId: b.id });
                    }}
                  >
                    {/* Rayas de hora (guía visual) */}
                    {horas.map((m) => (
                      <span
                        key={m}
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 border-t border-line/40"
                        style={{ top: (m - abre) * PX_MIN }}
                      />
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
                          className="absolute inset-x-1 z-[5] overflow-hidden rounded-lg border border-line bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(120,120,120,0.12)_6px,rgba(120,120,120,0.12)_12px)] px-2 py-1 text-left text-[11px] leading-tight text-muted"
                          style={{ top: (Math.max(desde, abre) - abre) * PX_MIN + 1, height: Math.max(26, (Math.min(hastaB, cierra) - Math.max(desde, abre)) * PX_MIN - 3) }}
                          title={`Bloqueado${x.motivo ? ` · ${x.motivo}` : ""} — tocá para quitar`}
                        >
                          <span className="font-bold">Bloqueado</span>
                          {x.motivo && <span className="block truncate opacity-80">{x.motivo}</span>}
                        </button>
                      );
                    })}

                    {citas.map((c) => {
                      const ini = minutoDeISO(c.inicio);
                      const est = estiloDe(c.estado);
                      const alto = Math.max(30, c.duracionMin * PX_MIN - 3);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setMoviendo(false);
                            setDetalle(c);
                          }}
                          className={`absolute inset-x-1 overflow-hidden rounded-lg border px-2 py-1 text-left text-[11px] leading-tight shadow-sm transition hover:brightness-110 ${est.card}`}
                          style={{ top: (ini - abre) * PX_MIN + 1, height: alto }}
                          title={`${fmtTime(ini)} · ${c.cliente || "Sin nombre"} · ${c.servicio} (${est.label})`}
                        >
                          <span className="font-bold tabular-nums">{fmtTime(ini)}</span>{" "}
                          <span className="font-semibold">{c.cliente || "Sin nombre"}</span>
                          <span className="block truncate opacity-80">{c.servicio}</span>
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
                    <span className={`rounded-full border px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide ${estiloDe(detalle.estado).card}`}>
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
                  <button
                    onClick={() => setMoviendo(true)}
                    className="w-full rounded-full bg-accent px-5 py-3 text-sm font-bold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft"
                  >
                    Mover de hora o de barbero
                  </button>
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
                onDone={() => {
                  setDetalle(null);
                  setMoviendo(false);
                  router.refresh();
                }}
                onCancel={() => setMoviendo(false)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

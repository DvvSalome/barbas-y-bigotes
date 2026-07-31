"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cerrarCajaSede } from "@/lib/actions";
import { sanearCop } from "@/lib/admin-reglas";
import { cop } from "@/lib/format";
import type { CajaSedeEstado, CajaDesglose } from "@/lib/data/queries";

// Hora civil en Bogotá sin depender del TZ del proceso (server/cliente en UTC).
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
  return `${((h + 11) % 12) + 1}:${m.toString().padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

// Fecha civil (YYYY-MM-DD) en Bogotá, para comparar días sin depender del TZ del proceso.
function fechaBogota(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// "lun 20 jul" — fecha corta en español para el rótulo de apertura.
function fechaCortaBogota(iso: string) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

// Días civiles (Bogotá) entre la apertura y hoy: 0 = se abrió hoy.
function diasDesde(iso: string) {
  const ms = Date.parse(fechaBogota(new Date())) - Date.parse(fechaBogota(new Date(iso)));
  return Math.max(0, Math.round(ms / 86400000));
}

// Avatar del barbero en el desglose: foto de la ficha si existe; si no, iniciales
// sobre un tono cálido derivado del nombre (mismos tonos del prototipo que la
// agenda). Son decorativos y estables por nombre; no hay token para ellos, por
// eso van en crudo.
const AVI_TONOS = ["#a3907c", "#e8675c", "#c9b18a", "#8f7a60", "#d9a066"];
const aviTono = (n: string) => AVI_TONOS[(n?.trim().length ?? 0) % AVI_TONOS.length];
const iniciales = (n: string) => {
  const parts = (n || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("");
};

// El cierre se hace de pie, en el aparato compartido del mostrador: nada tocable
// por debajo de 44px (el botón de cerrar caja medía 32).
const fld =
  "w-full min-h-11 rounded-lg border border-line bg-bg px-3 py-2 text-ink placeholder:text-muted focus:border-accent focus:outline-none";
const btn =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] px-5 text-xs font-semibold uppercase tracking-wide text-on-accent shadow-[0_10px_24px_-10px_rgba(210,63,52,0.7)] transition hover:brightness-105 disabled:opacity-50 disabled:shadow-none";

export function CierreCaja({
  caja,
  desglose,
  miBarberoId,
}: {
  caja: CajaSedeEstado;
  desglose: CajaDesglose;
  miBarberoId: string | null;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [contado, setContado] = useState("");
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<{ total: number; diferencia: number } | null>(null);

  // Cierre confirmado: pantalla de resumen.
  if (hecho) {
    const cuadra = hecho.diferencia === 0;
    return (
      <section className="rounded-2xl border border-line bg-panel p-5">
        <h3 className="font-display text-xl text-ink">Caja cerrada ✓</h3>
        <p className="mt-2 text-sm text-muted">
          Total del día <span className="font-semibold text-ink">{cop(hecho.total)}</span> ·{" "}
          {cuadra ? (
            <span className="font-semibold text-ok">cuadra exacto</span>
          ) : (
            <span className="font-semibold text-warn">
              diferencia {hecho.diferencia > 0 ? "+" : ""}
              {cop(hecho.diferencia)}
            </span>
          )}
        </p>
      </section>
    );
  }

  // Sin caja abierta: mensaje sutil (la caja se abre sola con la primera venta).
  if (!caja) {
    return (
      <p className="text-xs text-muted">La caja se abre sola con la primera venta del día.</p>
    );
  }

  const esperado = caja.esperadoEfectivo;
  // OJO: `Number("")` es 0, no NaN. Con el parseo anterior, confirmar el cierre
  // con el campo VACÍO grababa "conté $0" y dejaba asentado un faltante por
  // todo lo esperado, sin aviso y sin forma de deshacerlo. sanearCop distingue
  // "no escribió nada" (null) de "contó cero" (0).
  const contadoNum = sanearCop(contado);
  const sinContar = contadoNum === null;
  const diferencia = sinContar ? 0 : contadoNum - esperado;
  const nBarberos = desglose?.barberos.length ?? 0;
  // La caja se abre sola con la 1ra venta y nada la cierra de noche: puede llevar
  // días abierta y el "efectivo esperado" acumula todo ese tiempo, no solo hoy.
  const dias = diasDesde(caja.abiertaEn);
  const aperturaHoy = dias === 0;

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (contadoNum === null) {
      setError("Contá el efectivo antes de cerrar. Si la caja quedó en cero, escribí 0.");
      return;
    }
    // Un cierre descuadrado queda asentado en la contabilidad y no se deshace:
    // se pregunta una vez, con el número delante.
    if (
      diferencia !== 0 &&
      !window.confirm(
        `La caja no cuadra: ${diferencia > 0 ? "sobran" : "faltan"} ${cop(Math.abs(diferencia))}.

` +
          `Esperado ${cop(esperado)} · contaste ${cop(contadoNum)}.
¿Cerrar así igual?`,
      )
    )
      return;
    setError(null);
    setSaving(true);
    const res = await cerrarCajaSede({ efectivoContado: contadoNum, nota });
    setSaving(false);
    if (res.ok) {
      setHecho({ total: res.total ?? 0, diferencia: res.diferencia ?? 0 });
      router.refresh();
    } else {
      setError(res.error ?? "No se pudo cerrar la caja.");
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-xl font-bold uppercase text-ink">Caja de la sede</h3>
        <span className="rounded-full bg-ok/10 px-2.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-wide text-ok">
          {aperturaHoy
            ? `Abierta desde ${horaBogota(caja.abiertaEn)}`
            : `Abierta el ${fechaCortaBogota(caja.abiertaEn)}, ${horaBogota(caja.abiertaEn)}`}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        La caja es de la sede: suma lo de {nBarberos === 1 ? "el barbero" : `los ${nBarberos} barberos`}{" "}
        desde que se abrió (sola, con la primera venta).
      </p>
      {!aperturaHoy && (
        <p className="mt-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs font-semibold leading-relaxed text-warn">
          Ojo: esta caja lleva {dias} {dias === 1 ? "día" : "días"} sin cerrar (abierta el{" "}
          {fechaCortaBogota(caja.abiertaEn)}). Los totales de abajo suman TODO desde esa fecha, no
          solo lo de hoy.
        </p>
      )}

      {/* Desglose por barbero (con foto/iniciales, badge "vos" y "Mi comisión" en el logueado). */}
      {desglose && desglose.barberos.length > 0 && (
        <>
          <div className="mt-4 font-display text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            Por barbero
          </div>
          <div className="mt-2 overflow-hidden rounded-2xl border border-line bg-elevated">
            {desglose.barberos.map((b) => {
              const esMi = b.barberoId === miBarberoId;
              return (
                <div key={b.barberoId} className="border-b border-line/60 last:border-b-0">
                  <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                    {b.fotoUrl ? (
                      <span
                        className="h-[30px] w-[30px] shrink-0 rounded-full border border-line bg-elevated bg-cover bg-top"
                        style={{ backgroundImage: `url(${b.fotoUrl})` }}
                      />
                    ) : (
                      <span
                        className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full border border-line font-display text-[11px] font-bold text-[#0c0b0a]"
                        style={{ background: aviTono(b.nombre) }}
                      >
                        {iniciales(b.nombre)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{b.nombre}</span>
                    {esMi && (
                      <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-accent-soft">
                        vos
                      </span>
                    )}
                    <span className="shrink-0 text-sm font-bold tabular-nums text-ink">{cop(b.ventas)}</span>
                  </div>
                  {/* "Mi comisión (50%)" resaltada SOLO en la fila del barbero logueado. */}
                  {esMi && (
                    <div className="flex items-center justify-between gap-2 border-t border-line/60 bg-ok/5 px-3.5 py-2">
                      <span className="min-w-0 text-xs font-semibold text-ok">
                        Mi comisión (50% de mis ventas)
                      </span>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-ok">
                        {cop(b.comision)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Totales de la sede: efectivo esperado + digital. */}
      {desglose && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-elevated">
          <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm">
            <span className="min-w-0 text-muted">Efectivo esperado</span>
            <span className="shrink-0 font-bold tabular-nums text-ink">{cop(desglose.efectivo)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-line/60 px-3.5 py-2.5 text-sm">
            <span className="min-w-0 text-muted">No efectivo (Nequi, datáfono, transf.)</span>
            <span className="shrink-0 font-bold tabular-nums text-ink">{cop(desglose.digital)}</span>
          </div>
        </div>
      )}

      {!abierto ? (
        <button className={`${btn} mt-4`} onClick={() => setAbierto(true)}>
          Cerrar caja de la sede
        </button>
      ) : (
        <form onSubmit={confirmar} className="mt-4 space-y-3">
          <label className="block text-sm text-muted">
            ¿Cuánto contaste en efectivo?
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={contado}
              onChange={(e) => setContado(e.target.value)}
              required
              placeholder="Efectivo contado (COP)"
              className={`${fld} mt-1`}
              autoFocus
            />
          </label>
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Nota del cierre (opcional)"
            className={fld}
          />
          <p className="text-sm tabular-nums">
            Diferencia:{" "}
            {sinContar ? (
              <span className="text-muted">contá el efectivo para verla</span>
            ) : (
              <>
                <span className={diferencia === 0 ? "font-semibold text-ok" : "font-semibold text-warn"}>
                  {diferencia > 0 ? "+" : ""}
                  {cop(diferencia)}
                </span>
                {diferencia !== 0 && (
                  <span className="text-muted"> ({diferencia > 0 ? "sobra" : "falta"})</span>
                )}
              </>
            )}
          </p>
          {error && <p className="text-sm text-warn">{error}</p>}
          <div className="flex items-center gap-3">
            <button disabled={saving || sinContar} className={btn}>
              {saving ? "Cerrando…" : "Confirmar cierre"}
            </button>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="inline-flex min-h-11 items-center px-2 text-xs font-semibold uppercase tracking-wide text-muted transition hover:text-ink"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

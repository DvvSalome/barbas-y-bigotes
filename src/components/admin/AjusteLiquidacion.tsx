"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ajustarLiquidacion, quitarAjusteLiquidacion } from "@/lib/actions";
import { botonClases } from "@/components/ui/Boton";
import { cop, plataEnCampo, digitosDePlata } from "@/lib/format";

/*
  Sumar o restar plata en la liquidación de la semana de un barbero (0075).

  Lo pidió el administrador: "por si le sumo o le resto algo que me deje
  cambiarlo acá". Hasta ahora eso se arreglaba de palabra y el número de la
  pantalla decía otra cosa que el que se pagaba.

  Dos decisiones que importan:

  1. SUMAR y RESTAR son DOS BOTONES, no un campo con signo. El dueño escribe el
     número en el teclado del celular —donde el "−" está en la segunda pantalla—
     y ya eligió en la cabeza si suma o resta antes de escribirlo. Un campo que
     acepta "-20000" se equivoca solo.

  2. EL MOTIVO ES OBLIGATORIO. El barbero ve este ajuste en lo suyo, y "te
     restaron $30.000" sin explicación es exactamente lo que hace que desconfíe
     de toda la liquidación. La tabla también lo exige, por si acaso.
*/
export function AjusteLiquidacion({
  barberoId,
  nombre,
  ajustes,
  detalle,
}: {
  barberoId: string;
  nombre: string;
  /** Suma de los ajustes del período, con signo. */
  ajustes: number;
  detalle: { id: string; monto: number; nota: string; fecha: string }[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [signo, setSigno] = useState<1 | -1>(1);
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [quitando, setQuitando] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setErr(null);
    const res = await ajustarLiquidacion({
      barberoId,
      monto: signo * Number(monto || 0),
      nota,
    }).catch(() => null);
    setGuardando(false);
    if (!res || !res.ok) {
      setErr(res && !res.ok ? res.error ?? "No se pudo guardar." : "No se pudo guardar.");
      return;
    }
    setMonto("");
    setNota("");
    setAbierto(false);
    router.refresh();
  }

  async function quitar(id: string) {
    setQuitando(id);
    setErr(null);
    const res = await quitarAjusteLiquidacion(id).catch(() => null);
    setQuitando(null);
    if (!res || !res.ok) {
      setErr(res && !res.ok ? res.error ?? "No se pudo quitar." : "No se pudo quitar.");
      return;
    }
    router.refresh();
  }

  const campo =
    "w-full min-h-11 rounded-xl border border-line bg-bg px-3 text-[14px] text-ink placeholder:text-muted focus:border-ink/60 focus:outline-none";

  return (
    <div className="border-t border-line/60 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] font-bold uppercase tracking-wide text-muted">
          Ajustes a mano
          {ajustes !== 0 && (
            <span className={`ml-2 tabular-nums ${ajustes < 0 ? "text-warn" : "text-ok"}`}>
              {ajustes > 0 ? "+" : "−"}
              {cop(Math.abs(ajustes))}
            </span>
          )}
        </span>
        {!abierto && (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className={botonClases("secundario", "sm")}
          >
            Sumar o restar
          </button>
        )}
      </div>

      {detalle.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {detalle.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 text-[12.5px]">
              <span className="min-w-0 flex-1 text-muted">
                <span className={`font-bold tabular-nums ${a.monto < 0 ? "text-warn" : "text-ok"}`}>
                  {a.monto > 0 ? "+" : "−"}
                  {cop(Math.abs(a.monto))}
                </span>{" "}
                {a.nota}
              </span>
              <button
                type="button"
                onClick={() => quitar(a.id)}
                disabled={quitando === a.id}
                className="inline-flex min-h-11 shrink-0 items-center px-2 text-[12px] text-muted underline decoration-line underline-offset-4 transition hover:text-ink disabled:opacity-50"
              >
                {quitando === a.id ? "Quitando…" : "Quitar"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {abierto && (
        <div className="mt-3 space-y-2.5 rounded-xl border border-line bg-elevated p-3">
          <div className="flex gap-2">
            {(
              [
                { v: 1 as const, t: `Sumarle a ${nombre.split(" ")[0]}` },
                { v: -1 as const, t: "Restarle" },
              ]
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setSigno(o.v)}
                aria-pressed={signo === o.v}
                className={`min-h-11 flex-1 rounded-full border px-3 text-[13px] font-semibold transition ${
                  signo === o.v
                    ? o.v === 1
                      ? "border-ok bg-ok/12 text-ok"
                      : "border-warn bg-warn/12 text-warn"
                    : "border-line text-muted hover:text-ink"
                }`}
              >
                {o.t}
              </button>
            ))}
          </div>
          <input
            type="text"
            inputMode="numeric"
            value={plataEnCampo(monto)}
            onChange={(e) => setMonto(digitosDePlata(e.target.value))}
            placeholder="Cuánto (en pesos)"
            className={campo}
          />
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={200}
            placeholder="Por qué — lo va a leer él"
            className={campo}
          />
          {err && <p className="text-[12.5px] text-warn">{err}</p>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={guardar}
              disabled={guardando || !monto || !nota.trim()}
              className={botonClases("primario", "md", "flex-1")}
            >
              {guardando
                ? "Guardando…"
                : signo === 1
                  ? `Sumar ${cop(Number(monto || 0))}`
                  : `Restar ${cop(Number(monto || 0))}`}
            </button>
            <button
              type="button"
              onClick={() => {
                setAbierto(false);
                setErr(null);
              }}
              className="inline-flex min-h-11 items-center px-3 text-[13px] text-muted transition hover:text-ink"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!abierto && err && <p className="mt-2 text-[12.5px] text-warn">{err}</p>}
    </div>
  );
}

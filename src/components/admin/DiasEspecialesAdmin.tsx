"use client";

import { botonClases } from "@/components/ui/Boton";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { marcarDiaEspecial, quitarDiaEspecial } from "@/lib/actions";
import { bogotaYmd } from "@/lib/slots";
import type { Sede } from "@/lib/data/types";
import type { DiaEspecial } from "@/lib/data/queries";

const input =
  "min-h-11 rounded-lg border border-line bg-bg px-3 py-2 text-ink placeholder:text-muted focus:border-accent focus:outline-none";

// YYYY-MM-DD a "dom 20 jul" sin líos de huso (la fecha ya es civil, no instante).
function fechaLabel(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
const esDomingo = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).getDay() === 0;
};

const minToTime = (m: number) =>
  `${Math.floor(m / 60).toString().padStart(2, "0")}:${(m % 60).toString().padStart(2, "0")}`;
const timeToMin = (t: string) => {
  const [h, mm] = t.split(":").map(Number);
  return (h || 0) * 60 + (mm || 0);
};
const horaCorta = (m: number) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const ap = h < 12 ? "am" : "pm";
  return `${((h + 11) % 12) + 1}:${mm.toString().padStart(2, "0")} ${ap}`;
};

export function DiasEspecialesAdmin({
  sedes,
  dias,
}: {
  sedes: Sede[];
  dias: DiaEspecial[];
}) {
  const router = useRouter();
  const hoy = bogotaYmd();
  const [sede, setSede] = useState(sedes[0]?.id ?? "");
  const [fecha, setFecha] = useState(hoy);
  const [abierta, setAbierta] = useState(true);
  const [motivo, setMotivo] = useState("");
  // Horario propio del día: apagado = usa el de la semana; prendido = franja
  // especial (el caso "este sábado 1:00-4:30").
  const [horarioPropio, setHorarioPropio] = useState(false);
  const [abreMin, setAbreMin] = useState(540);
  const [cierraMin, setCierraMin] = useState(1200);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (abierta && horarioPropio && abreMin >= cierraMin) {
      setErr("La hora de apertura debe ser antes de la de cierre.");
      return;
    }
    setSaving(true);
    const res = await marcarDiaEspecial({
      sede,
      fecha,
      abierta,
      motivo,
      // Solo cuando abre con horario propio; si no, null = el de la semana.
      abreMin: abierta && horarioPropio ? abreMin : null,
      cierraMin: abierta && horarioPropio ? cierraMin : null,
    });
    setSaving(false);
    if (res.ok) {
      setMotivo("");
      setHorarioPropio(false);
      router.refresh();
    } else setErr(res.error ?? "No se pudo guardar.");
  }

  async function quitar(id: string) {
    // Mismo motivo que en AusenciasAdmin: tragarse el error hace creer que la
    // sede volvió a abrir ese día cuando el booking la sigue dando por cerrada.
    const res = await quitarDiaEspecial(id);
    if (!res.ok) {
      setErr(res.error ?? "No se pudo quitar la excepción.");
      return;
    }
    setErr(null);
    router.refresh();
  }

  const nombreSede = (id: string) => sedes.find((s) => s.id === id)?.nombre ?? id;

  return (
    <div>
      <form onSubmit={guardar} className="grid gap-3 rounded-2xl border border-line bg-panel p-5 sm:grid-cols-4">
        <h3 className="font-display text-lg sm:col-span-4">Abrir o cerrar un día</h3>

        {/* La sede se elige IGUAL que en "Horario de la semana" de arriba
            (pestañas): dos controles distintos para la misma decisión, uno
            encima del otro, hacían dudar si eran cosas diferentes. Con una
            sola sede no se pregunta. */}
        {sedes.length > 1 && (
          <div className="flex gap-1.5 sm:col-span-4" role="tablist" aria-label="Sede">
            {sedes.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={s.id === sede}
                onClick={() => setSede(s.id as typeof sede)}
                className={`min-h-11 rounded-lg px-3.5 text-[12.5px] font-semibold transition ${
                  s.id === sede ? "bg-accent/15 text-accent-soft" : "text-muted hover:text-ink"
                }`}
              >
                {s.nombre}
              </button>
            ))}
          </div>
        )}
        <input type="date" min={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} className={input} />

        {/* Abrir / Cerrar como par de botones: más claro que un checkbox suelto. */}
        <div className="flex gap-1 rounded-lg border border-line bg-bg p-1 sm:col-span-2">
          {(
            [
              { v: true, label: "Abrimos" },
              { v: false, label: "Cerramos" },
            ] as const
          ).map((o) => (
            <button
              key={String(o.v)}
              type="button"
              onClick={() => setAbierta(o.v)}
              className={`flex-1 rounded-md px-3 py-1.5 text-[13px] font-semibold transition ${
                abierta === o.v
                  ? o.v
                    ? "bg-ok/15 text-ok shadow-[inset_0_0_0_1px_rgba(52,211,153,.35)]"
                    : "bg-accent/15 text-accent-soft shadow-[inset_0_0_0_1px_rgba(210,63,52,.35)]"
                  : "text-muted hover:text-ink"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Horario propio del día: solo tiene sentido si ese día se abre. */}
        {abierta && (
          <div className="rounded-lg border border-line bg-bg px-3 py-2.5 sm:col-span-4">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink">
              <input
                type="checkbox"
                checked={horarioPropio}
                onChange={(e) => setHorarioPropio(e.target.checked)}
                className="accent-accent"
              />
              Ese día con un horario distinto al de siempre
            </label>
            {horarioPropio && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[13px] text-muted">
                <span>de</span>
                <input
                  type="time"
                  step={1800}
                  value={minToTime(abreMin)}
                  onChange={(e) => setAbreMin(timeToMin(e.target.value))}
                  className={input}
                />
                <span>a</span>
                <input
                  type="time"
                  step={1800}
                  value={minToTime(cierraMin)}
                  onChange={(e) => setCierraMin(timeToMin(e.target.value))}
                  className={input}
                />
              </div>
            )}
          </div>
        )}

        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder={abierta ? "Motivo (ej. domingo de feria)" : "Motivo (ej. festivo, cierre)"}
          className={`${input} sm:col-span-4`}
        />

        <p className="text-[12px] leading-relaxed text-muted sm:col-span-4">
          Estas son EXCEPCIONES a un día puntual. El horario de siempre se cambia arriba. Si un
          barbero no va ese día, márcalo como ausente en Equipo.
        </p>

        {err && (
          <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft sm:col-span-4">
            {err}
          </div>
        )}
        <div className="sm:col-span-4">
          <button
            disabled={saving}
            className={botonClases("primario")}
          >
            {saving ? "Guardando…" : "Guardar día"}
          </button>
        </div>
      </form>

      <div className="mt-5">
        <h3 className="mb-2 eyebrow">Días marcados</h3>
        {dias.length === 0 ? (
          <p className="rounded-xl border border-line bg-panel px-4 py-4 text-sm text-muted">
            Sin excepciones. Se atiende de lunes a sábado y los domingos está cerrado.
          </p>
        ) : (
          <div className="space-y-2">
            {dias.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-panel px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{fechaLabel(d.fecha)}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide ${
                        d.abierta ? "bg-ok/15 text-ok" : "bg-accent/15 text-accent-soft"
                      }`}
                    >
                      {d.abierta ? "Abrimos" : "Cerramos"}
                    </span>
                    {d.abierta && d.abreMin != null && d.cierraMin != null && (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[12px] font-semibold text-accent-soft">
                        {horaCorta(d.abreMin)} – {horaCorta(d.cierraMin)}
                      </span>
                    )}
                    {d.abierta && esDomingo(d.fecha) && (
                      <span className="rounded-full border border-line px-2 py-0.5 text-[12px] text-muted">
                        domingo
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {nombreSede(d.sede)}
                    {d.motivo ? ` · ${d.motivo}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => quitar(d.id)}
                  className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:border-accent/40 hover:text-ink"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

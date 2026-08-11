"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { marcarAusencia, quitarAusencia } from "@/lib/actions";
import { bogotaYmd } from "@/lib/slots";
import { ElegirBarbero, CaraBarbero } from "@/components/staff/Elegir";
import { fmtTime } from "@/lib/slots";
import type { Barbero, Sede } from "@/lib/data/types";
import type { AusenciaAdmin } from "@/lib/data/queries";

const input =
  "rounded-lg border border-line bg-bg px-3 py-2 text-ink placeholder:text-muted focus:border-accent focus:outline-none";

// Formatea YYYY-MM-DD a "vie 18 jul" sin líos de timezone (la fecha ya es local).
function fechaLabel(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });
}

export function AusenciasAdmin({
  barberos,
  sedes,
  ausencias,
}: {
  barberos: Barbero[];
  sedes: Sede[];
  ausencias: AusenciaAdmin[];
}) {
  const router = useRouter();
  const hoy = bogotaYmd();
  const [barberoId, setBarberoId] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const nombreBarbero = (id: string) => barberos.find((b) => b.id === id)?.nombre ?? "Barbero";
  const sedeDeBarbero = (id: string) => {
    const s = barberos.find((b) => b.id === id)?.sede;
    return sedes.find((x) => x.id === s)?.nombre ?? "";
  };

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!barberoId) {
      setErr("Elige el barbero.");
      return;
    }
    setSaving(true);
    const res = await marcarAusencia({ barberoId, fecha, motivo });
    setSaving(false);
    if (res.ok) {
      setMotivo("");
      router.refresh();
    } else {
      setErr(res.error ?? "No se pudo guardar.");
    }
  }

  async function quitar(id: string) {
    // Si esto falla en silencio, el admin ve desaparecer la fila tras el refresh
    // y cree que el barbero volvió a estar disponible, cuando el booking lo
    // sigue bloqueando. Un error acá cuesta turnos que nadie puede reservar.
    const res = await quitarAusencia(id);
    if (!res.ok) {
      setErr(res.error ?? "No se pudo quitar la ausencia.");
      return;
    }
    setErr(null);
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={agregar} className="grid gap-3 rounded-2xl border border-line bg-panel p-5 sm:grid-cols-4">
        <h3 className="font-display text-lg sm:col-span-4">Marcar ausencia</h3>
        <ElegirBarbero
          barberos={barberos.map((b) => ({ id: b.id, nombre: b.nombre, fotoUrl: b.fotoUrl }))}
          value={barberoId}
          onChange={setBarberoId}
          placeholder="¿Quién no viene?"
        />
        <input type="date" min={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} className={input} />
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo (opcional)"
          className={`${input} sm:col-span-2`}
        />
        {err && (
          <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft sm:col-span-4">
            {err}
          </div>
        )}
        <div className="sm:col-span-4">
          <button
            disabled={saving}
            className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Marcar ausente"}
          </button>
        </div>
      </form>

      <div className="mt-5">
        <h3 className="mb-2 text-xs uppercase tracking-[0.3em] text-accent">Ausencias próximas</h3>
        {ausencias.length === 0 ? (
          <p className="rounded-xl border border-line bg-panel px-4 py-4 text-sm text-muted">
            No hay ausencias marcadas. Cuando un barbero no vaya, marcalo acá y deja de aparecer para reservar ese día.
          </p>
        ) : (
          <div className="space-y-2">
            {ausencias.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-panel px-4 py-3"
              >
                <CaraBarbero b={{ id: a.barberoId, nombre: nombreBarbero(a.barberoId), fotoUrl: barberos.find((x) => x.id === a.barberoId)?.fotoUrl }} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">
                    {nombreBarbero(a.barberoId)} <span className="font-normal text-muted">· {fechaLabel(a.fecha)}</span>
                  </div>
                  {/* Un bloqueo por horas (0054, creado desde el calendario) no es lo
                      mismo que faltar el día: acá se distinguen con su rango. */}
                  <div className="truncate text-xs text-muted">
                    {a.desdeMin != null ? (
                      <span className="text-warn">
                        {fmtTime(a.desdeMin)}–{fmtTime(a.hastaMin ?? 0)}
                        {a.motivo ? ` · ${a.motivo}` : ""}
                      </span>
                    ) : (
                      <>Todo el día{a.motivo ? ` · ${a.motivo}` : ""} · </>
                    )}
                    {a.desdeMin != null ? " · " : ""}
                    {sedeDeBarbero(a.barberoId)}
                  </div>
                </div>
                <button
                  onClick={() => quitar(a.id)}
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

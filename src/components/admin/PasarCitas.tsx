"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pasarCitas } from "@/lib/pasar-citas";
import { fechaCortaBogota, horaBogota } from "@/lib/format";
import { Boton } from "@/components/ui/Boton";
import type { CitaFutura } from "@/lib/data/queries";

/*
  Las citas que un barbero tiene por delante, para pasárselas a otro de su sede
  a la MISMA hora: todas de un toque o una por una. Lo usan la baja (paso 1) y el
  cambio de sede de la ficha.

  No decide nada por su cuenta: cada cita va por moverCita (src/lib/pasar-citas.ts,
  el mismo camino que "Equipo de hoy" del mostrador). La que choca —el otro ya
  tiene a alguien a esa hora, está ausente, la sede ya no abre a esa hora— se
  dice con su motivo y se queda donde estaba. Al cliente que dejó correo le llega
  el de "te movimos la cita" con el barbero nuevo; al que no, no le llega nada.
*/

const select =
  "min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 text-[14px] text-ink focus:border-ink/60 focus:outline-none";

const cuando = (iso: string) => `${fechaCortaBogota(iso)} · ${horaBogota(iso)}`;

export function PasarCitas({
  citas,
  destinos,
  sedeNombre,
  onCambio,
  salida = "Pásala a otro barbero o cámbiale la hora en la Agenda.",
}: {
  citas: CitaFutura[];
  destinos: { id: string; nombre: string }[];
  sedeNombre: string;
  /** Después de pasar: volver a leer sus citas. */
  onCambio: () => void;
  /** Qué puede hacer el dueño con la que no se movió (acá no se elige hora). */
  salida?: string;
}) {
  const router = useRouter();
  const [destino, setDestino] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);

  async function pasar(lista: CitaFutura[], a: string, llave: string) {
    if (!a) return setMsg({ ok: false, txt: "Elige a quién se las pasas." });
    setBusy(llave);
    setMsg(null);
    const quien = destinos.find((d) => d.id === a)?.nombre.split(" ")[0] ?? "";
    const { pasadas, fallas } = await pasarCitas(lista, a, (c) => `${cuando(c.inicio)} (${c.cliente || "cliente"})`, quien);
    setBusy(null);
    // Solo al que dejó correo le llega el aviso del cambio (0059).
    const sinCorreo = lista.filter((c) => !c.conCorreo && !fallas.some((f) => f.id === c.id));
    const aviso = sinCorreo.length
      ? ` ${sinCorreo.length === 1 ? `${sinCorreo[0].cliente || "Un cliente"} no dejó correo: llámalo` : `${sinCorreo.length} no dejaron correo: llámalos`} para contarle${sinCorreo.length === 1 ? "" : "s"} del cambio.`
      : " Al cliente le llega el correo con su barbero nuevo.";
    setMsg(
      fallas.length
        ? {
            ok: false,
            txt: `${pasadas ? `${pasadas === 1 ? "1 pasó" : `${pasadas} pasaron`} a ${quien}.${aviso} ` : ""}No se movió: ${fallas.map((f) => f.texto).join(" · ")}. ${salida}`,
          }
        : { ok: true, txt: `${pasadas === 1 ? "La cita pasó" : `Las ${pasadas} citas pasaron`} a ${quien}.${aviso}` },
    );
    onCambio();
    router.refresh();
  }

  if (!citas.length) return null;

  if (!destinos.length) {
    return (
      <p className="rounded-xl border border-warn/40 bg-warn/[0.08] px-3 py-2.5 text-[12.5px] text-warn">
        No hay otro barbero activo en {sedeNombre} para pasárselas. Puedes cancelarlas avisándole a cada cliente.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {msg && (
        <p
          className={`rounded-xl border px-3 py-2 text-[12.5px] ${
            msg.ok ? "border-ok/40 bg-ok/10 text-ok" : "border-warn/40 bg-warn/[0.08] font-semibold text-warn"
          }`}
        >
          {msg.txt}
        </p>
      )}

      {citas.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2.5">
          <span className="basis-full text-[13px] font-semibold text-ink sm:basis-auto">Pasar todas a</span>
          <select
            aria-label="Pasar todas las citas a"
            value={destino.todas ?? ""}
            onChange={(e) => setDestino((d) => ({ ...d, todas: e.target.value }))}
            className={select}
          >
            <option value="">Elige…</option>
            {destinos.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </select>
          <Boton tam="sm" variante="primario" disabled={busy !== null} onClick={() => pasar(citas, destino.todas ?? "", "todas")}>
            {busy === "todas" ? "Pasando…" : "Pasar todas"}
          </Boton>
        </div>
      )}

      <ul className="grid gap-2">
        {citas.map((c) => {
          const llave = `cita:${c.id}`;
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-panel px-3 py-2">
              {/* A 360 px la cita va arriba y el "pasar a" abajo, a lo ancho: lado a
                  lado, el selector quedaba en una flecha sin texto. */}
              <span className="min-w-0 basis-full sm:flex-1 sm:basis-[170px]">
                <span className="block text-[13.5px] font-bold tabular-nums text-accent-soft">{cuando(c.inicio)}</span>
                <span className="block truncate text-[13px] text-ink">
                  {c.cliente || "Cliente"} · {c.servicio || "Servicio"}
                </span>
                {!c.conCorreo && (
                  <span className="block text-[12px] text-muted">
                    Sin correo: no le llega ningún aviso{c.telefono ? ` · ${c.telefono}` : ""}
                  </span>
                )}
              </span>
              <select
                aria-label={`Pasar la cita del ${cuando(c.inicio)} a`}
                value={destino[llave] ?? ""}
                onChange={(e) => setDestino((d) => ({ ...d, [llave]: e.target.value }))}
                className={select}
              >
                <option value="">Pasar a…</option>
                {destinos.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                  </option>
                ))}
              </select>
              <Boton tam="sm" disabled={busy !== null} onClick={() => pasar([c], destino[llave] ?? "", llave)}>
                {busy === llave ? "…" : "Pasar"}
              </Boton>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

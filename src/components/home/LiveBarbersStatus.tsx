"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import Link from "next/link";
import { CardTilt } from "@/components/ui/CardTilt";
import { getLiveBarberStatuses } from "@/lib/actions";
import { recargarSiDeployViejo } from "@/lib/skew";

type BarberStatus = {
  id: string;
  nombre: string;
  sede: string;
  sedeId: string;
  fotoUrl: string | null;
  status: "disponible" | "ocupado" | "no_activo";
  servicioActual?: string;
  terminaA?: string;
};

export function LiveBarbersStatus() {
  const [barbers, setBarbers] = useState<BarberStatus[]>([]);
  const [loading, setLoading] = useState(true);
  // Aparición suave al resolverse el fetch. No usa el sistema `data-reveal` del
  // layout a propósito: ese observer solo mira los nodos que ya existían al
  // cargar, y este contenido se monta DESPUÉS de hidratar; con data-reveal
  // quedaría oculto para siempre (opacity:0 sin `reveal-visible`).
  const [visible, setVisible] = useState(false);

  async function fetchStatus() {
    try {
      const data = await getLiveBarberStatuses();
      setBarbers(data);
    } catch (err) {
      // Una action que revienta desde la home es casi siempre una pestaña con el
      // bundle viejo tras un deploy (21 errores en 6 s en Sentry, 4-sep): se
      // recarga una vez y listo; si no era eso, se deja quieto (nada de tormentas).
      if (!recargarSiDeployViejo()) console.error("Error fetching live status:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Carga inicial encadenada en .then: el setState queda en un callback
    // asíncrono, no sincrónico en el cuerpo del effect.
    let vivo = true;
    getLiveBarberStatuses()
      .then((data) => {
        if (vivo) setBarbers(data);
      })
      .catch((err) => {
        if (!recargarSiDeployViejo()) console.error("Error fetching live status:", err);
      })
      .finally(() => {
        if (vivo) setLoading(false);
      });

    const sb = supabaseBrowser();
    const sub = sb
      .channel("live-barber-status")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservas" },
        () => {
          fetchStatus();
        }
      )
      .subscribe();

    const interval = setInterval(fetchStatus, 60000);

    return () => {
      vivo = false;
      sb.removeChannel(sub);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    // rAF: difiere el setState un frame (no sincrónico en el effect) para que la
    // transición de opacidad alcance a correr, y de paso respeta la regla de
    // no-setState-en-effect.
    if (loading) return;
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [loading]);

  // Cuántos están atendiendo AHORA. Si no hay nadie en_curso degradamos con
  // gracia a un mensaje de "equipo libre" en vez de una grilla vacía o repetida.
  const atendiendo = barbers.filter((b) => b.status === "ocupado");

  return (
    <section className="mx-auto max-w-6xl px-6 pt-16 sm:pt-24">
      <div className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.3em] text-accent">Monitoreo en vivo</p>
        <h2 className="font-display text-[28px] font-bold uppercase sm:text-4xl">Barbería en tiempo real</h2>
        <p className="mt-2 text-sm text-muted">Mira quién está atendiendo ahora mismo antes de reservar tu turno.</p>
      </div>

      {loading ? (
        <div className="flex h-36 items-center justify-center rounded-2xl border border-line bg-panel text-sm text-muted">
          Cargando estado en vivo…
        </div>
      ) : (
        <div
          className={`transition-opacity duration-700 ease-out ${visible ? "opacity-100" : "opacity-0"}`}
        >
          {atendiendo.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-panel px-6 py-12 text-center">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Todo el equipo libre
              </span>
              <p className="max-w-sm text-sm text-muted">
                El equipo está libre ahora — sin fila ni espera. Es buen momento para agendar tu cita.
              </p>
              <Link
                href="/reservar"
                className="rounded-full bg-accent px-8 py-3.5 text-center text-[13px] font-bold uppercase tracking-[0.1em] text-on-accent transition hover:bg-accent-soft"
              >
                Agenda tu cita
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {barbers.map((b) => (
                <CardTilt key={b.id} maxTilt={4} scale={1.02}>
                  <Link
                    href={`/reservar?barbero=${b.id}&sede=${b.sedeId}`}
                    className="group relative flex items-center gap-4 rounded-2xl border border-line bg-panel p-4 transition-all duration-300 hover:border-accent/40 hover:bg-accent/[0.02] h-full w-full cursor-pointer"
                  >
                    <div className="absolute right-4 top-4 flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${b.status === "ocupado" ? "bg-accent animate-pulse" : "bg-emerald-500"}`} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                        {b.status === "ocupado" ? "Atendiendo" : "Libre"}
                      </span>
                    </div>

                    <div className="bb-foto-skeleton relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-line">
                      <img
                        src={b.fotoUrl || "/cortes/corte-3.jpg"}
                        alt={b.nombre}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>

                    <div className="min-w-0 pr-16">
                      <h3 className="font-display text-base font-bold text-white leading-tight">{b.nombre}</h3>
                      <p className="text-[11px] text-muted mt-0.5">{b.sede}</p>
                      {b.status === "ocupado" ? (
                        <p className="text-xs text-accent-soft mt-1.5 leading-tight truncate">
                          {b.servicioActual} <span className="text-[10px] text-muted">· libre {b.terminaA}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-emerald-400 mt-1.5 leading-tight">
                          ¡Listo para atenderte!
                        </p>
                      )}
                    </div>
                  </Link>
                </CardTilt>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

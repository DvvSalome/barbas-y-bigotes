"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import Link from "next/link";
import { CardTilt } from "@/components/ui/CardTilt";
import { getLiveBarberStatuses } from "@/lib/actions";

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

  async function fetchStatus() {
    try {
      const data = await getLiveBarberStatuses();
      setBarbers(data);
    } catch (err) {
      console.error("Error fetching live status:", err);
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
      .catch((err) => console.error("Error fetching live status:", err))
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

  if (loading) {
    return (
      <div className="flex h-36 items-center justify-center text-sm text-muted">
        Cargando estado en vivo...
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-6 pt-16 sm:pt-24">
      <div className="mb-8 text-center sm:text-left">
        <p className="text-xs uppercase tracking-[0.3em] text-accent">Monitoreo en vivo</p>
        <h2 className="font-display text-4xl font-semibold uppercase">Barbería en tiempo real</h2>
        <p className="mt-2 text-sm text-muted">Mirá el estado actual de nuestros barberos antes de reservar tu turno.</p>
      </div>

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

              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-ink/40 border border-line">
                <img
                  src={b.fotoUrl || "/cortes/corte-3.jpg"}
                  alt={b.nombre}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>

              <div className="min-w-0 pr-16">
                <h3 className="font-display text-base font-bold text-white leading-tight">{b.nombre}</h3>
                <p className="text-[11px] text-muted-soft mt-0.5">{b.sede}</p>
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
    </section>
  );
}

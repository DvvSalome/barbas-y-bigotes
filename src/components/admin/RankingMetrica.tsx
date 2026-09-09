"use client";

import { useState } from "react";
import { CaraBarbero } from "@/components/staff/Elegir";

// Ranking de métricas con top-6 + "Ver todos": una barbería con 40 servicios
// convertía "Qué piden" en un scroll interminable de barras casi iguales; lo
// importante (los que mandan) se perdía. `orden` dice explícitamente por qué
// está ordenada la lista (plata vs veces), porque las tres tarjetas se ven
// iguales pero no miden lo mismo.

const TOP = 6;

export function RankingMetrica({
  titulo,
  orden,
  vacio,
  filas,
}: {
  titulo: string;
  orden: string;
  vacio: string;
  filas: { nombre: string; valor: string; sub: string; peso: number; fotoUrl?: string | null }[];
}) {
  const [todas, setTodas] = useState(false);
  const max = Math.max(...filas.map((f) => f.peso), 1);
  const visibles = todas ? filas : filas.slice(0, TOP);

  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="font-display text-lg">{titulo}</h3>
        <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">{orden}</span>
      </div>
      {filas.length === 0 ? (
        <p className="text-[12.5px] text-muted">{vacio}</p>
      ) : (
        <>
          <ul className="space-y-3">
            {visibles.map((f) => (
              <li key={f.nombre}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    {/* Solo el ranking de barberos trae cara; en servicios y
                        productos no hay a quién ponerle. */}
                    {f.fotoUrl !== undefined && (
                      <CaraBarbero b={{ id: f.nombre, nombre: f.nombre, fotoUrl: f.fotoUrl }} size={24} />
                    )}
                    <span className="truncate text-[13.5px] font-semibold text-ink">{f.nombre}</span>
                  </span>
                  <span className="shrink-0 text-[13px] text-ink">{f.valor}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated">
                  <div className="h-full rounded-full bg-accent/70" style={{ width: `${(f.peso / max) * 100}%` }} />
                </div>
                <div className="mt-0.5 text-[12px] text-muted">{f.sub}</div>
              </li>
            ))}
          </ul>
          {filas.length > TOP && (
            <button
              type="button"
              onClick={() => setTodas((v) => !v)}
              className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl border border-line text-[12.5px] font-semibold text-muted transition hover:text-ink"
            >
              {todas ? "Ver menos" : `Ver todos (${filas.length})`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

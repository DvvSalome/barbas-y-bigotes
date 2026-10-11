"use client";

import { useState, type CSSProperties } from "react";
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
  plano = false,
}: {
  titulo?: string;
  orden?: string;
  vacio?: string;
  filas: { nombre: string; valor: string; sub: string; peso: number; fotoUrl?: string | null }[];
  /** Sin tarjeta ni cabecera: para ir DENTRO de otro panel (el desglose de la
   *  tarjeta "Entró en caja"), donde una tarjeta más sería una caja en una caja. */
  plano?: boolean;
}) {
  const [todas, setTodas] = useState(false);
  const max = Math.max(...filas.map((f) => f.peso), 1);
  const visibles = todas ? filas : filas.slice(0, TOP);

  return (
    <section className={plano ? undefined : "rounded-2xl border border-line bg-panel p-5"}>
      {!plano && (
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h3 className="font-display text-lg">{titulo}</h3>
          <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">{orden}</span>
        </div>
      )}
      {filas.length === 0 ? (
        <p className="text-[12.5px] text-muted">{vacio}</p>
      ) : (
        <>
          <ul className="space-y-3">
            {visibles.map((f, i) => (
              // bb-fila / bb-medida / --i: solo se mueven dentro de un panel que se
              // acaba de abrir (globals.css); en la tarjeta normal no hacen nada.
              <li key={`${f.nombre}|${i}`} className="bb-fila" style={{ "--i": i } as CSSProperties}>
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
                <div className={`mt-1 h-1.5 overflow-hidden rounded-full ${plano ? "bg-ink/10" : "bg-elevated"}`}>
                  <div className="bb-medida h-full rounded-full bg-bar" style={{ width: `${(f.peso / max) * 100}%` }} />
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

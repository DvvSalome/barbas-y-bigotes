"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import Image from "next/image";
import { cop } from "@/lib/format";

// Selectores del staff. Un <select> nativo no busca ni muestra fotos: con 45
// servicios el barbero tenía que scrollear la lista entera de pie y con el
// cliente enfrente, y al elegir barbero solo veía nombres sueltos.
// Estos dos abren un panel con buscador y cierran al elegir, con teclado
// (Escape cierra) y clic afuera.

const iniciales = (n: string) =>
  (n || "?").trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("");

/** Cierra el panel al hacer clic afuera o con Escape. */
function useCerrarAfuera(abierto: boolean, cerrar: () => void) {
  const caja = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) cerrar();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto, cerrar]);
  return caja;
}

const BOTON =
  "flex min-h-11 w-full items-center gap-2.5 rounded-lg border border-line bg-bg px-3 py-2 text-left text-ink transition hover:border-accent/50";
const PANEL =
  "absolute z-30 mt-1 max-h-[300px] w-full overflow-y-auto rounded-xl border border-accent/40 bg-panel shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)]";

export type OpcionBarbero = { id: string; nombre: string; fotoUrl?: string | null };

/** Cara del barbero (foto o iniciales). Fuera del componente: definirla adentro
 *  la recrea en cada render y React la remonta. */
function Cara({ b, size = 26 }: { b: OpcionBarbero; size?: number }) {
  return b.fotoUrl ? (
    <Image
      src={b.fotoUrl}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover object-top"
      style={{ height: size, width: size }}
    />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-elevated text-[10px] font-bold text-ink"
      style={{ height: size, width: size }}
    >
      {iniciales(b.nombre)}
    </span>
  );
}

/** Barbero con su foto. El nombre suelto no se reconoce tan rápido como la cara. */
export function ElegirBarbero({
  barberos,
  value,
  onChange,
  placeholder = "¿Quién atiende?",
  permitirVacio,
  etiquetaVacio = "El primero que se desocupe",
}: {
  barberos: OpcionBarbero[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  permitirVacio?: boolean;
  etiquetaVacio?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useCerrarAfuera(abierto, () => setAbierto(false));
  const sel = barberos.find((b) => b.id === value) ?? null;

  return (
    <div ref={caja} className="relative">
      <button type="button" onClick={() => setAbierto((v) => !v)} className={BOTON} aria-expanded={abierto}>
        {sel ? (
          <>
            <Cara b={sel} />
            <span className="flex-1 truncate text-[13.5px] font-semibold">{sel.nombre}</span>
          </>
        ) : (
          <span className="flex-1 truncate text-[13.5px] text-muted">{placeholder}</span>
        )}
        <span aria-hidden className="text-[10px] text-muted">▾</span>
      </button>

      {abierto && (
        <div className={PANEL} role="listbox">
          {permitirVacio && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setAbierto(false);
              }}
              className="flex w-full items-center gap-2.5 border-b border-line/60 px-3 py-2.5 text-left text-[13px] text-muted transition hover:bg-elevated"
            >
              {etiquetaVacio}
            </button>
          )}
          {barberos.map((b) => (
            <button
              key={b.id}
              type="button"
              role="option"
              aria-selected={b.id === value}
              onClick={() => {
                onChange(b.id);
                setAbierto(false);
              }}
              className={`flex w-full items-center gap-2.5 border-b border-line/60 px-3 py-2.5 text-left transition last:border-b-0 hover:bg-elevated ${
                b.id === value ? "bg-accent/10" : ""
              }`}
            >
              <Cara b={b} size={30} />
              <span className="flex-1 truncate text-[13.5px] font-semibold text-ink">{b.nombre}</span>
              {b.id === value && <span className="text-[12px] text-accent-soft">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export type OpcionServicio = { id: string; nombre: string; precio?: number | null; duracionMin?: number };

/** Servicio con BUSCADOR: 45 servicios no se recorren a mano. */
export function ElegirServicio({
  servicios,
  value,
  onChange,
  placeholder = "Buscar servicio…",
  etiquetaVacio,
}: {
  servicios: OpcionServicio[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  /** Si viene, se ofrece una opción para dejarlo sin elegir. */
  etiquetaVacio?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const caja = useCerrarAfuera(abierto, () => setAbierto(false));
  const sel = servicios.find((s) => s.id === value) ?? null;

  // Sin acentos ni mayúsculas: "depilacion" tiene que encontrar "Depilación".
  const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const lista = useMemo(() => {
    const t = norm(q.trim());
    return t ? servicios.filter((s) => norm(s.nombre).includes(t)) : servicios;
  }, [q, servicios]);

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={() => {
          setAbierto((v) => !v);
          setQ("");
        }}
        className={BOTON}
        aria-expanded={abierto}
      >
        <span className={`flex-1 truncate text-[13.5px] ${sel ? "font-semibold" : "text-muted"}`}>
          {sel ? sel.nombre : (etiquetaVacio ?? placeholder)}
        </span>
        {sel?.precio != null && (
          <span className="shrink-0 text-[12.5px] font-bold tabular-nums text-accent-soft">{cop(sel.precio)}</span>
        )}
        <span aria-hidden className="text-[10px] text-muted">▾</span>
      </button>

      {abierto && (
        <div className={PANEL}>
          <div className="sticky top-0 border-b border-line bg-panel p-2">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg border border-line bg-bg px-2.5 py-1.5 text-[13px] text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>

          {etiquetaVacio && !q && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setAbierto(false);
              }}
              className="flex w-full border-b border-line/60 px-3 py-2.5 text-left text-[13px] text-muted transition hover:bg-elevated"
            >
              {etiquetaVacio}
            </button>
          )}

          {lista.length === 0 && (
            <p className="px-3 py-4 text-center text-[12.5px] text-muted">Nada con “{q}”.</p>
          )}

          {lista.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onChange(s.id);
                setAbierto(false);
              }}
              className={`flex w-full items-center gap-2 border-b border-line/60 px-3 py-2.5 text-left transition last:border-b-0 hover:bg-elevated ${
                s.id === value ? "bg-accent/10" : ""
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] text-ink">{s.nombre}</span>
                {s.duracionMin != null && <span className="block text-[11px] text-muted">{s.duracionMin} min</span>}
              </span>
              {s.precio != null && (
                <span className="shrink-0 text-[12.5px] font-bold tabular-nums text-ink">{cop(s.precio)}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

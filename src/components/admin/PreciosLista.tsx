"use client";

import { useMemo, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { PrecioSedeEditable } from "@/components/admin/PrecioSedeEditable";
import { ServicioActivoToggle } from "@/components/admin/ServicioActivoToggle";
import { FotoServicio } from "@/components/admin/FotoServicio";
import { DescripcionServicio } from "@/components/admin/DescripcionServicio";
import type { Categoria, Sede, SedeId } from "@/lib/data/types";

// Catálogo de servicios y precios.
// Antes eran SIETE tablas apiladas (una por categoría) escritas dos veces
// —tarjetas para móvil y tabla para escritorio—: 4.238 px de scroll, 299
// botones, sin forma de buscar entre 45 servicios, y la tabla de Combos se
// cortaba a la derecha (los precios de la segunda sede quedaban fuera de la
// pantalla sin ninguna señal de que se podía desplazar).
// Ahora: buscador + filtro por categoría y UNA lista responsive donde el precio
// es una ficha tocable, no una celda.

export type ServicioPrecios = {
  id: string;
  nombre: string;
  categoria: Categoria;
  duracionMin: number;
  desde?: boolean;
  activo?: boolean;
  /** Foto y descripción que ve el cliente al reservar (0055). */
  fotoUrl?: string | null;
  descripcion?: string | null;
  precios: Partial<Record<SedeId, number>>;
};

// Sin acentos ni mayúsculas: "depilacion" tiene que encontrar "Depilación".
const norm = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function PreciosLista({
  servicios,
  sedes,
  etiquetas,
}: {
  servicios: ServicioPrecios[];
  sedes: Sede[];
  /** categoria → nombre legible (viene del seed). */
  etiquetas: Record<string, string>;
}) {
  const [q, setQ] = useState("");

  // Categorías que existen de verdad, en el orden del catálogo (no en el que
  // vengan las filas), con su conteo para saber dónde buscar.
  const cats = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of servicios) m.set(s.categoria, (m.get(s.categoria) ?? 0) + 1);
    return Object.keys(etiquetas)
      .filter((c) => m.has(c))
      .map((c) => [c, m.get(c) as number] as const);
  }, [servicios, etiquetas]);

  // Arranca en la PRIMERA categoría, no en "Todos": los 45 servicios juntos son
  // 5.000 px de scroll y el dueño entra a tocar un precio puntual. Los chips de
  // arriba (con su conteo) y el buscador son el camino al resto.
  const [cat, setCat] = useState<string>(() => cats[0]?.[0] ?? "todas");

  // Al buscar se ignora la categoría activa y se busca en TODO el catálogo: si
  // el buscador solo mirara la pestaña abierta, escribir "depilación" estando en
  // Cortes daría "sin resultados" y parecería que el servicio no existe.
  const lista = useMemo(() => {
    const t = norm(q.trim());
    if (t) return servicios.filter((s) => norm(s.nombre).includes(t));
    return servicios.filter((s) => cat === "todas" || s.categoria === cat);
  }, [servicios, q, cat]);

  // Se agrupa cuando la lista puede mezclar categorías (todo el catálogo o un
  // resultado de búsqueda); con una sola categoría el encabezado sobra.
  const agrupar = !!q.trim() || cat === "todas";

  return (
    <div>
      <div className="flex flex-col gap-3">
        <div className="relative max-w-md">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar servicio…"
            aria-label="Buscar servicio"
            className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 pl-10 text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip activo={cat === "todas"} onClick={() => setCat("todas")}>
            Todos <b className="ml-1 font-semibold text-muted">{servicios.length}</b>
          </Chip>
          {cats.map(([c, n]) => (
            <Chip key={c} activo={cat === c} onClick={() => setCat(c)}>
              {etiquetas[c] ?? c} <b className="ml-1 font-semibold text-muted">{n}</b>
            </Chip>
          ))}
        </div>
      </div>

      {lista.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-line bg-panel px-4 py-8 text-center text-sm text-muted">
          Nada con “{q}”.
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          {(agrupar ? cats.map(([c]) => c) : [null]).map((grupo) => {
            const filas = grupo ? lista.filter((s) => s.categoria === grupo) : lista;
            if (!filas.length) return null;
            return (
              <section key={grupo ?? "resultado"}>
                {grupo && (
                  <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-accent-soft">
                    {etiquetas[grupo] ?? grupo}
                  </h2>
                )}
                <ul className="divide-y divide-line/60 overflow-hidden rounded-2xl border border-line bg-panel">
                  {filas.map((s) => {
                    const inactivo = s.activo === false;
                    return (
                      <li
                        key={s.id}
                        className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3 ${
                          inactivo ? "opacity-55" : ""
                        }`}
                      >
                        {/* Foto + descripción: es LO QUE VE EL CLIENTE al reservar,
                            y se administra acá, junto al precio. */}
                        <span className="shrink-0">
                          <FotoServicio servicioId={s.id} nombre={s.nombre} fotoUrl={s.fotoUrl} />
                        </span>
                        <span className="min-w-[45%] flex-1 text-[13.5px] font-semibold text-ink">
                          {s.nombre}
                          {s.desde && <span className="text-[11px] font-normal text-muted"> (desde)</span>}
                          <span className="ml-2 text-[11.5px] font-normal text-muted">
                            {s.duracionMin} min
                          </span>
                          {inactivo && (
                            <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                              Fuera del catálogo
                            </span>
                          )}
                          <DescripcionServicio servicioId={s.id} descripcion={s.descripcion} />
                        </span>

                        {/* El precio como ficha con el nombre de la sede encima:
                            en la tabla, la columna de la 2ª sede se salía de la
                            pantalla en los combos y no se veía. */}
                        <span className="flex flex-wrap gap-2">
                          {sedes.map((sd) => (
                            <span
                              key={sd.id}
                              className="rounded-lg border border-line bg-elevated px-2.5 py-1 text-right"
                            >
                              <span className="block text-[9.5px] uppercase tracking-wide text-muted">
                                {sd.nombre.split(" ")[0]}
                              </span>
                              <PrecioSedeEditable
                                servicioId={s.id}
                                sedeId={sd.id}
                                precio={s.precios[sd.id] ?? null}
                                etiqueta={sd.nombre}
                              />
                            </span>
                          ))}
                        </span>

                        <span className="shrink-0">
                          <ServicioActivoToggle id={s.id} activo={!inactivo} />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`min-h-9 rounded-full border px-3.5 text-[12px] font-semibold transition ${
        activo
          ? "border-accent bg-accent/15 text-accent-soft"
          : "border-line text-muted hover:border-accent/40 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

"use client";

import { useMemo, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { PrecioSedeEditable } from "@/components/admin/PrecioSedeEditable";
import { ServicioActivoToggle } from "@/components/admin/ServicioActivoToggle";
import { SelloToggle } from "@/components/admin/SelloToggle";
import { FotoServicio } from "@/components/admin/FotoServicio";
import { DuracionEditable } from "@/components/admin/DuracionEditable";
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
  /** ¿Suma sello en la tarjeta de cortes? null/true = sí (0064). */
  cuentaCorte?: boolean | null;
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

        {/* Una fila que scrollea, no cuatro apiladas: en 375px estos chips se
            comían media pantalla antes del primer servicio. */}
        <div className="flex w-full min-w-0 gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                {/* Tarjetas, no filas de planilla: cada servicio es un cuadro con
                    su foto, su descripción y sus precios — respira y se toca bien. */}
                <ul className="grid gap-2.5 2xl:grid-cols-2">
                  {filas.map((s) => {
                    const inactivo = s.activo === false;
                    return (
                      <li
                        key={s.id}
                        className={`rounded-2xl border bg-panel p-3.5 transition hover:border-accent/30 ${
                          inactivo ? "border-line/60 opacity-60" : "border-line"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Foto + descripción: es LO QUE VE EL CLIENTE al reservar,
                              y se administra acá, junto al precio. */}
                          <span className="shrink-0">
                            <FotoServicio servicioId={s.id} nombre={s.nombre} fotoUrl={s.fotoUrl} size={52} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                              <span className="text-[14px] font-semibold leading-tight text-ink">{s.nombre}</span>
                              {s.desde && <span className="text-[11px] text-muted">(desde)</span>}
                              <DuracionEditable servicioId={s.id} min={s.duracionMin} />
                              {inactivo && (
                                <span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                                  Fuera del catálogo
                                </span>
                              )}
                            </span>
                            <DescripcionServicio servicioId={s.id} descripcion={s.descripcion} />
                          </span>
                          <span className="shrink-0">
                            {/* Solo cortes y combos entran al conteo de la
                                tarjeta; en el resto el interruptor mentiría. */}
                            {(s.categoria === "cortes" || s.categoria === "combos") && (
                              <SelloToggle id={s.id} suma={s.cuentaCorte !== false} />
                            )}
                            <ServicioActivoToggle id={s.id} activo={!inactivo} />
                          </span>
                        </div>

                        {/* Precios por sede como fichas, al pie del cuadro */}
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-line/50 pt-2.5">
                          {sedes.map((sd) => (
                            <span
                              key={sd.id}
                              className="flex-1 rounded-lg border border-line bg-elevated px-2.5 py-1.5 text-right"
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
                        </div>
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
      className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-[12px] font-semibold transition ${
        activo
          ? "border-accent bg-accent/15 text-accent-soft"
          : "border-line text-muted hover:border-accent/40 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

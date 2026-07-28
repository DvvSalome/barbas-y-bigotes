"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cop } from "@/lib/format";
import { SearchIcon } from "@/components/icons";
import type { ClienteRow } from "@/lib/data/queries";

const DIAS_DORMIDO = 60;

type Filtro = "todos" | "gastan" | "dormidos";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "gastan", label: "Los que más gastan" },
  { id: "dormidos", label: `No vuelven hace ${DIAS_DORMIDO} días` },
];

const VACIO: Record<Filtro, string> = {
  todos: "Todavía no hay clientes registrados.",
  gastan: "Todavía nadie tiene compras registradas.",
  dormidos: `Nadie lleva más de ${DIAS_DORMIDO} días sin volver.`,
};

function fechaCorta(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

// La lista llega ya ordenada por última visita (lo más reciente arriba). El
// buscador y los filtros corren acá, sobre la lista completa, para que filtren
// mientras se escribe: con un submit por letra el dueño abandona la búsqueda.
export function ClientesLista({ clientes }: { clientes: ClienteRow[] }) {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const lista = useMemo(() => {
    const s = q.trim().toLowerCase();
    let r = s
      ? clientes.filter((c) => `${c.nombre} ${c.telefono} ${c.email}`.toLowerCase().includes(s))
      : clientes;
    if (filtro === "gastan") {
      r = r.filter((c) => c.facturado > 0).sort((a, b) => b.facturado - a.facturado);
    }
    if (filtro === "dormidos") {
      // Los que nunca compraron no "dejaron de volver": no son recuperables por acá.
      const corte = new Date().getTime() - DIAS_DORMIDO * 86_400_000;
      r = r.filter((c) => c.ultima !== null && new Date(c.ultima).getTime() < corte);
    }
    return r;
  }, [clientes, q, filtro]);

  return (
    <>
      <div className="mt-6 flex flex-col gap-3">
        <div className="relative max-w-md">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, teléfono o correo…"
            aria-label="Buscar cliente"
            className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 pl-10 text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              aria-pressed={filtro === f.id}
              className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                filtro === f.id
                  ? "border-accent bg-accent/15 text-accent-soft"
                  : "border-line text-muted hover:border-accent/40 hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {lista.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-line bg-panel px-4 py-8 text-center text-sm text-muted">
          {q ? "Sin resultados para esa búsqueda." : VACIO[filtro]}
        </p>
      ) : (
        <>
          <p className="mt-4 text-xs text-muted">
            {lista.length === 1 ? "1 cliente" : `${lista.length} clientes`}
            {filtro === "gastan" ? " · de mayor a menor facturado" : " · de la visita más reciente a la más vieja"}
          </p>

          {/* Mobile: cards */}
          <div className="mt-3 space-y-2 sm:hidden">
            {lista.map((c) => (
              <Link
                key={c.id}
                href={`/admin/clientes/${c.id}`}
                className="block rounded-xl border border-line bg-panel p-4 transition active:border-accent/40"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent-soft">
                    {c.nombre.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="font-display text-lg leading-tight">{c.nombre}</div>
                    <div className="truncate text-xs text-muted">{c.telefono || c.email || "Sin contacto"}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line/60 pt-3 text-center">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted">Visitas</div>
                    <div className="text-sm">{c.visitas}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted">Facturado</div>
                    <div className="text-sm text-accent-soft">{cop(c.facturado)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted">Última</div>
                    <div className="text-sm text-muted">{fechaCorta(c.ultima)}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* sm+: tabla */}
          <div className="mt-3 hidden overflow-x-auto rounded-2xl border border-line sm:block">
            <table className="w-full text-sm">
              <thead className="bg-elevated text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium">Contacto</th>
                  <th className="px-4 py-3 text-right font-medium">Visitas</th>
                  <th className="px-4 py-3 text-right font-medium">Facturado</th>
                  <th className="px-4 py-3 text-right font-medium">Última</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((c, i) => (
                  <tr key={c.id} className={`transition hover:bg-elevated ${i % 2 ? "bg-panel" : "bg-panel/40"}`}>
                    <td className="px-4 py-3">
                      <Link href={`/admin/clientes/${c.id}`} className="group flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent-soft">
                          {c.nombre.charAt(0).toUpperCase()}
                        </span>
                        <span className="font-display text-lg transition group-hover:text-accent-soft">{c.nombre}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {c.telefono || "—"}
                      {c.email ? <span className="block text-xs text-muted/70">{c.email}</span> : null}
                    </td>
                    <td className="px-4 py-3 text-right text-muted">{c.visitas}</td>
                    <td className="px-4 py-3 text-right text-accent-soft">{cop(c.facturado)}</td>
                    <td className="px-4 py-3 text-right text-muted">{fechaCorta(c.ultima)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

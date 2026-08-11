"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cop } from "@/lib/format";
import { unirClientes } from "@/lib/actions";
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
// Tono del avatar, estable por nombre (decorativo, sin token propio; mismos
// tonos que la agenda del barbero).
const TONOS = ["#a3907c", "#e8675c", "#c9b18a", "#8f7a60", "#d9a066"];
const tono = (n: string) => TONOS[(n?.trim().length ?? 0) % TONOS.length];

export function ClientesLista({ clientes }: { clientes: ClienteRow[] }) {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  // Grupo de fichas repetidas abierto para unir (email en minúsculas), o null.
  const [unirGrupo, setUnirGrupo] = useState<string | null>(null);

  // Fichas repetidas del mismo correo. El fix de reservas evita que se creen
  // nuevas, pero las viejas siguen ahí y el dueño no tenía forma de verlas:
  // aparecían como cuatro clientes distintos con el mismo mail.
  const duplicados = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of clientes) {
      const e = c.email?.trim().toLowerCase();
      if (e) m.set(e, (m.get(e) ?? 0) + 1);
    }
    return m;
  }, [clientes]);

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

          {/* UNA lista para todos los anchos. Antes convivían tarjetas para
              móvil y una tabla para escritorio: el mismo contenido escrito dos
              veces, y en escritorio se leía como una hoja de cálculo (columnas
              en mayúscula, "$ 0" en rojo repetido para cada ficha sin visitas).
              Un cliente sin compras no tiene números que mostrar; lo que
              necesita el dueño es distinguirlo de un habitual. */}
          <ul className="mt-3 divide-y divide-line/60 overflow-hidden rounded-2xl border border-line bg-panel">
            {lista.map((c) => {
              const dup = c.email ? duplicados.get(c.email.toLowerCase()) ?? 0 : 0;
              return (
                <li key={c.id}>
                  <Link
                    href={`/admin/clientes/${c.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-elevated"
                  >
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-[15px] font-bold text-[#0c0b0a]"
                      style={{ background: tono(c.nombre) }}
                    >
                      {c.nombre.charAt(0).toUpperCase()}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate font-display text-[17px] leading-tight">{c.nombre}</span>
                        {dup > 1 && (
                          // Botón, no etiqueta: señalar el problema sin dejar
                          // resolverlo era un callejón sin salida.
                          <button
                            type="button"
                            title={`Hay ${dup} fichas con este mismo correo — tocá para unirlas`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setUnirGrupo(c.email!.trim().toLowerCase());
                            }}
                            className="shrink-0 rounded-full bg-warn/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-warn transition hover:bg-warn/25"
                          >
                            Repetida ×{dup} · Unir
                          </button>
                        )}
                      </span>
                      {/* Si la ficha está repetida se muestra el CORREO, que es
                          lo que la repite: con el teléfono delante, el aviso
                          hablaba de un dato que no estaba a la vista. */}
                      <span className="block truncate text-[12px] text-muted">
                        {(dup > 1 ? c.email : c.telefono || c.email) || "Sin contacto"}
                      </span>
                    </span>

                    <span className="shrink-0 text-right">
                      {c.visitas > 0 ? (
                        <>
                          <span className="block font-display text-[15px] font-bold tabular-nums text-accent-soft">
                            {cop(c.facturado)}
                          </span>
                          <span className="block text-[11.5px] text-muted">
                            {c.visitas === 1 ? "1 visita" : `${c.visitas} visitas`} · {fechaCorta(c.ultima)}
                          </span>
                        </>
                      ) : (
                        <span className="text-[12px] text-muted">Sin visitas todavía</span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {unirGrupo && (
        <UnirFichasSheet
          fichas={clientes.filter((c) => c.email?.trim().toLowerCase() === unirGrupo)}
          onClose={() => setUnirGrupo(null)}
        />
      )}
    </>
  );
}

/**
 * Unir el grupo de fichas repetidas: el admin elige CUÁL se conserva y las
 * demás le pasan todo (visitas, wallet, puntos, notas). Confirmación de dos
 * toques porque no tiene deshacer.
 */
function UnirFichasSheet({ fichas, onClose }: { fichas: ClienteRow[]; onClose: () => void }) {
  const router = useRouter();
  // Por defecto se conserva la que más historia tiene (visitas, luego facturado).
  const sugerida = [...fichas].sort((a, b) => b.visitas - a.visitas || b.facturado - a.facturado)[0];
  const [conservar, setConservar] = useState(sugerida?.id ?? "");
  const [confirmando, setConfirmando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const otras = fichas.filter((f) => f.id !== conservar);

  async function unir() {
    if (!confirmando) {
      setConfirmando(true);
      return;
    }
    setBusy(true);
    setErr(null);
    // Secuencial a propósito: cada merge es su propia transacción en la DB y un
    // fallo a mitad deja el resto del grupo intacto (se reintenta con el botón).
    for (const f of otras) {
      const res = await unirClientes({ origenId: f.id, destinoId: conservar });
      if (!res.ok) {
        setBusy(false);
        setConfirmando(false);
        setErr(res.error ?? "No se pudo unir. Refrescá e intentá de nuevo.");
        return;
      }
    }
    setBusy(false);
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-line bg-panel p-5 sm:max-w-lg sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-display text-xl">Unir fichas repetidas</h3>
          <button onClick={onClose} aria-label="Cerrar" className="grid h-11 w-11 place-items-center rounded-full border border-line text-muted transition hover:text-ink">
            ×
          </button>
        </div>
        <p className="text-xs text-muted">
          Son la misma persona con {fichas.length} fichas. Elegí cuál se CONSERVA: las otras le pasan sus visitas,
          wallet, puntos y notas, y desaparecen. No se puede deshacer.
        </p>

        <div className="mt-4 space-y-2">
          {fichas.map((f) => {
            const activa = conservar === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setConservar(f.id);
                  setConfirmando(false);
                }}
                aria-pressed={activa}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  activa ? "border-accent bg-accent/10" : "border-line hover:border-accent/40"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {f.nombre}
                    {f.id === sugerida?.id && <span className="ml-2 text-[10px] font-bold uppercase text-accent-soft">Sugerida</span>}
                  </span>
                  <span className="block text-[11.5px] text-muted">
                    {f.telefono || "sin teléfono"} · {f.visitas} {f.visitas === 1 ? "visita" : "visitas"} · {cop(f.facturado)}
                  </span>
                </span>
                <span className={`shrink-0 text-[11px] font-bold ${activa ? "text-accent-soft" : "text-muted"}`}>
                  {activa ? "Se conserva ✓" : "Conservar esta"}
                </span>
              </button>
            );
          })}
        </div>

        {err && (
          <div className="mt-3 rounded-xl border border-accent/40 bg-accent/10 px-3.5 py-2.5 text-sm text-accent-soft">{err}</div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={unir}
            disabled={busy || !conservar || otras.length === 0}
            className={`flex-1 rounded-full px-5 py-3 text-sm font-bold uppercase tracking-wide transition disabled:opacity-50 ${
              confirmando ? "bg-warn text-[#0c0b0a] hover:brightness-105" : "bg-accent text-on-accent hover:bg-accent-soft"
            }`}
          >
            {busy
              ? "Uniendo…"
              : confirmando
                ? `¿Seguro? Unir ${otras.length === 1 ? "1 ficha" : `${otras.length} fichas`} (sin deshacer)`
                : `Unir en la de ${fichas.find((f) => f.id === conservar)?.nombre.split(" ")[0] ?? "…"}`}
          </button>
          <button onClick={onClose} className="rounded-full border border-line px-5 py-3 text-sm text-muted">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

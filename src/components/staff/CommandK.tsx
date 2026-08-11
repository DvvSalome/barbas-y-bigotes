"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buscarGlobal, type BusquedaGlobal } from "@/lib/actions";
import { adminNav } from "@/components/admin/AdminNav";
import { PlusIcon, CashIcon, BoxIcon, ScissorsIcon, ArrowRightIcon, UsersIcon } from "@/components/icons";

// Paleta de comandos del admin (Ctrl/Cmd-K): acciones rápidas, navegación y
// búsqueda en vivo de clientes/productos. Se abre también con el evento
// "bb:cmdk" (el botón del topbar lo dispara).

// icono: SVG del set (los glifos de texto ＋ $ ▣ ✂ se veían toscos y algunos
// renderizaban como cuadro-tofu en ciertos Android).
type Item = { key: string; grupo: string; icono: React.ReactNode; label: string; detalle?: string; href: string };

const ACCIONES: Item[] = [
  { key: "a-reserva", grupo: "Acciones rápidas", icono: <PlusIcon className="h-3.5 w-3.5" />, label: "Nueva reserva", href: "/reservar" },
  { key: "a-venta", grupo: "Acciones rápidas", icono: <CashIcon className="h-3.5 w-3.5" />, label: "Venta rápida (sin cita)", href: "/barbero" },
  { key: "a-caja", grupo: "Acciones rápidas", icono: <BoxIcon className="h-3.5 w-3.5" />, label: "Cerrar caja de hoy", href: "/admin/cuadre" },
  { key: "a-pines", grupo: "Acciones rápidas", icono: <ScissorsIcon className="h-3.5 w-3.5" />, label: "Equipo y PINes", href: "/admin/equipo" },
];

// Sin destinos duplicados: si una acción rápida ya lleva al mismo lugar
// (p. ej. "Equipo y PINes" → /admin/equipo), se omite el ítem gemelo de "Ir a".
const HREFS_DE_ACCION = new Set(ACCIONES.map((a) => a.href));

const IR_A: Item[] = adminNav
  .filter((n) => !HREFS_DE_ACCION.has(n.href))
  .map((n) => ({
    key: `n-${n.href}`,
    grupo: "Ir a",
    icono: <ArrowRightIcon className="h-3.5 w-3.5" />,
    label: n.label,
    href: n.href,
  }));

const SIN_RESULTADOS: BusquedaGlobal = { clientes: [], productos: [] };

const NOMBRE_SEDE: Record<string, string> = {
  "parque-venezuela": "Parque Venezuela",
  "plaza-de-la-paz": "Plaza de la Paz",
};

export function CommandK() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<BusquedaGlobal>(SIN_RESULTADOS);

  // Para devolverle el foco a quien abrió la paleta (botón del topbar, etc.).
  const focoPrevio = useRef<HTMLElement | null>(null);

  const abrir = useCallback(() => {
    // Invalida búsquedas pendientes de una apertura anterior.
    reqId.current++;
    if (timer.current) clearTimeout(timer.current);
    focoPrevio.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQ("");
    setSel(0);
    setResultados(SIN_RESULTADOS);
    setBuscando(false);
    setOpen(true);
    // El input existe recién tras pintar el overlay.
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // Cierre puro de estado: una búsqueda pendiente que llegue tarde no molesta
  // (abrir() resetea todo y reqId descarta respuestas de rondas viejas). El foco
  // se restaura en un efecto (leer el ref acá lo tracea el compiler como
  // lectura-en-render vía los onClick).
  const cerrar = useCallback(() => setOpen(false), []);

  // Ctrl/Cmd-K global + Escape (a nivel window: cierra aunque el input haya
  // perdido el foco) + evento del botón del topbar.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) cerrar();
        else abrir();
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        cerrar();
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("bb:cmdk", abrir);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("bb:cmdk", abrir);
    };
  }, [open, abrir, cerrar]);

  // Scroll-lock del fondo mientras la paleta está abierta.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Al cerrarse, devolver el foco a quien abrió (leer el ref en efecto es válido).
  useEffect(() => {
    if (open) return;
    focoPrevio.current?.focus();
  }, [open]);

  // Limpieza del debounce al desmontar.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Búsqueda en vivo (debounce 250ms) disparada desde el onChange del input;
  // reqId descarta respuestas viejas que lleguen fuera de orden.
  function cambiarQ(value: string) {
    setQ(value);
    setSel(0);
    if (timer.current) clearTimeout(timer.current);
    const s = value.trim();
    if (s.length < 2) {
      reqId.current++;
      setResultados(SIN_RESULTADOS);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    const id = ++reqId.current;
    timer.current = setTimeout(async () => {
      const res = await buscarGlobal(s);
      if (reqId.current === id) {
        setResultados(res);
        setBuscando(false);
      }
    }, 250);
  }

  const items = useMemo<Item[]>(() => {
    const s = q.trim().toLowerCase();
    const fijos = [...ACCIONES, ...IR_A].filter((i) => !s || i.label.toLowerCase().includes(s));
    const clientes: Item[] = resultados.clientes.map((c) => ({
      key: `c-${c.id}`,
      grupo: "Clientes",
      icono: <UsersIcon className="h-3.5 w-3.5" />,
      label: c.nombre,
      detalle: c.telefono || undefined,
      href: `/admin/clientes/${c.id}`,
    }));
    const productos: Item[] = resultados.productos.map((p) => ({
      key: `p-${p.id}`,
      grupo: "Productos",
      icono: <BoxIcon className="h-3.5 w-3.5" />,
      label: p.nombre,
      detalle: `stock ${p.stock} · ${NOMBRE_SEDE[p.sede] ?? p.sede}`,
      href: "/admin/inventario",
    }));
    return [...fijos, ...clientes, ...productos];
  }, [q, resultados]);

  // Índice activo acotado en render (la lista cambia con cada búsqueda).
  const selActivo = items.length === 0 ? 0 : Math.min(sel, items.length - 1);

  const ejecutar = useCallback(
    (item: Item | undefined) => {
      if (!item) return;
      cerrar();
      router.push(item.href);
    },
    [cerrar, router],
  );

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel(Math.min(selActivo + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel(Math.max(selActivo - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      ejecutar(items[selActivo]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cerrar();
    } else if (e.key === "Tab") {
      // Focus trap básico: el único control tabulable del diálogo es el input.
      e.preventDefault();
    }
  }

  if (!open) return null;

  // Agrupar preservando el orden global (el índice de selección es sobre items).
  const grupos: { nombre: string; desde: number; items: Item[] }[] = [];
  items.forEach((it, i) => {
    const g = grupos[grupos.length - 1];
    if (!g || g.nombre !== it.grupo) grupos.push({ nombre: it.grupo, desde: i, items: [it] });
    else g.items.push(it);
  });

  return (
    <div
      className="fixed inset-0 z-100 flex items-start justify-center bg-black/60 px-4 pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cerrar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar cliente, producto o sección"
        className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-line bg-elevated shadow-[var(--shadow-pop)]"
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => cambiarQ(e.target.value)}
          onKeyDown={onInputKey}
          placeholder="Buscar cliente, producto o sección…"
          autoComplete="off"
          role="combobox"
          aria-label="Buscar cliente, producto o sección"
          aria-expanded={items.length > 0}
          aria-controls="cmdk-listbox"
          aria-autocomplete="list"
          aria-activedescendant={items.length > 0 ? `cmdk-opcion-${selActivo}` : undefined}
          className="w-full border-b border-line bg-transparent px-4.5 py-4 text-[15px] text-ink placeholder:text-muted focus:outline-none"
        />
        <div id="cmdk-listbox" role="listbox" aria-label="Resultados" className="max-h-[46vh] overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">
              {buscando ? "Buscando…" : `Nada para “${q.trim()}”.`}
            </p>
          ) : (
            grupos.map((g) => (
              <div key={g.nombre} role="group" aria-label={g.nombre} className="pb-1">
                <div aria-hidden="true" className="px-2.5 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">
                  {g.nombre}
                </div>
                {g.items.map((it, j) => {
                  const i = g.desde + j;
                  const activo = i === selActivo;
                  return (
                    <button
                      key={it.key}
                      type="button"
                      tabIndex={-1}
                      id={`cmdk-opcion-${i}`}
                      role="option"
                      aria-selected={activo}
                      onClick={() => ejecutar(it)}
                      onMouseMove={() => setSel(i)}
                      className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition ${
                        activo ? "bg-accent/15 text-ink" : "text-ink/80"
                      }`}
                    >
                      <span className="grid h-6.5 w-6.5 shrink-0 place-items-center rounded-md border border-line bg-panel text-xs">
                        {it.icono}
                      </span>
                      <span className="min-w-0 truncate">
                        {it.label}
                        {it.detalle && <span className="ml-2 text-xs text-muted">{it.detalle}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
          {buscando && items.length > 0 && (
            <p className="px-2.5 py-1.5 text-[11px] text-muted">Buscando clientes y productos…</p>
          )}
        </div>
        {/* Atajos de teclado: en táctil no aplican, se ocultan. */}
        <div className="hidden gap-4 border-t border-line px-4 py-2.5 text-[11px] text-muted sm:flex">
          <span>↑↓ navegar</span>
          <span>↵ ir</span>
          <span>esc cerrar</span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { aplicarTema, temaActual, type TemaStaff } from "@/lib/tema";
import { LogoutIcon } from "@/components/icons";

// Rueda de perfil del staff (admin y barbero): el avatar abre un menú con la
// identidad, el toggle de tema Oscuro/Claro (cookie bb-tema, sin recargar) y
// Cerrar sesión. Sin librerías: click afuera + Esc cierran, roles de menú básicos.

export function PerfilMenu({
  nombre,
  detalle,
  salidaHref = "/login",
}: {
  /** Nombre a mostrar (define la inicial del avatar). */
  nombre: string;
  /** Línea de identidad arriba del menú (ej. email). Sin detalle se usa el nombre. */
  detalle?: string;
  /** A dónde ir tras cerrar sesión (staff: /login, el gateway unificado). */
  salidaHref?: string;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  // El server ya pintó data-theme en el wrapper: se lee de ahí como valor
  // inicial (lazy, con guard para SSR; el menú solo se pinta tras hidratar,
  // así que no hay riesgo de mismatch). Evita duplicar la fuente de verdad.
  const [tema, setTema] = useState<TemaStaff>(() =>
    typeof document === "undefined" ? "dark" : temaActual(),
  );

  // Click afuera + Esc (Esc devuelve el foco al avatar).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function cambiarTema(t: TemaStaff) {
    aplicarTema(t); // atributo en vivo en [data-staff] + cookie (T2)
    setTema(t);
  }

  async function cerrarSesion() {
    setSaliendo(true);
    await supabaseBrowser().auth.signOut();
    router.push(salidaHref);
    router.refresh();
  }

  const inicial = (nombre.trim().charAt(0) || "S").toUpperCase();
  const foco =
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menú de ${nombre}`}
        title={detalle ?? nombre}
        onClick={() => setOpen((v) => !v)}
        className={`grid h-[30px] w-[30px] place-items-center rounded-full border text-[11px] font-bold transition ${foco} ${
          open ? "border-accent/60 bg-elevated text-ink" : "border-line bg-elevated text-ink hover:border-accent/40"
        }`}
      >
        {inicial}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Perfil"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 overflow-hidden rounded-xl border border-line bg-elevated shadow-[var(--shadow-pop)]"
        >
          <div className="px-3.5 py-3">
            <div className="truncate text-[13px] font-semibold text-ink">{nombre}</div>
            {detalle && <div className="truncate text-xs text-muted">{detalle}</div>}
          </div>

          <div className="border-t border-line" role="separator" />

          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
            <span className="text-[13px] text-ink/85">Tema</span>
            <div className="flex gap-0.5 rounded-[9px] border border-line bg-panel p-[3px]">
              {(
                [
                  { id: "dark", label: "Oscuro" },
                  { id: "light", label: "Claro" },
                ] as const
              ).map((o) => {
                const activo = tema === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={activo}
                    onClick={() => cambiarTema(o.id)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${foco} ${
                      activo ? "bg-elevated text-ink shadow-[inset_0_0_0_1px_var(--line)]" : "text-muted hover:text-ink"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-line" role="separator" />

          <button
            type="button"
            role="menuitem"
            onClick={cerrarSesion}
            disabled={saliendo}
            className={`flex w-full items-center gap-2.5 px-3.5 py-3 text-left text-[13px] text-muted transition hover:bg-panel hover:text-ink disabled:opacity-50 ${foco}`}
          >
            <LogoutIcon className="h-3.5 w-3.5 shrink-0" />
            {saliendo ? "Cerrando sesión…" : "Cerrar sesión"}
          </button>
        </div>
      )}
    </div>
  );
}

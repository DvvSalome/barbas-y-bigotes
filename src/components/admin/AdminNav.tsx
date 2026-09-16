"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { GearIcon } from "@/components/icons";
import { DESTINOS, GRUPOS_HUB, HERMANAS, HOJAS, destinoDe, esRuta } from "@/components/admin/nav-mapa";

// Los COMPONENTES de la navegación. El mapa (qué ruta es qué destino) vive en
// nav-mapa.ts porque este archivo es de cliente y un server component no puede
// leer datos de acá — ver el comentario de allá.

/**
 * Pestañas de ESCRITORIO con los mismos 5 destinos. En el celular no se dibujan:
 * ahí manda la barra inferior, que sí entra entera.
 */
export function AdminTabs() {
  const path = usePathname();
  const search = useSearchParams();
  const sede = search.get("sede");
  const activo = destinoDe(path);

  return (
    <nav aria-label="Secciones" className="mx-auto hidden w-full max-w-[1400px] items-end gap-1 px-4 sm:px-5 lg:flex">
      {/* Ajustes NO va como enlace acá: en escritorio es el desplegable de tres
          columnas del final, para no gastar un viaje de ida y vuelta a una
          pantalla que solo contiene una lista de enlaces. */}
      {DESTINOS.filter((d) => d.clave !== "ajustes").map((d) => {
        const act = activo === d.clave;
        const Icono = d.icono;
        return (
          <Link
            key={d.clave}
            href={sede ? `${d.href}?sede=${sede}` : d.href}
            aria-current={act ? "page" : undefined}
            className={`-mb-px inline-flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-[13px] font-semibold transition ${
              act ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink/80"
            }`}
          >
            <Icono className="h-4 w-4" />
            {d.etiqueta}
          </Link>
        );
      })}
      <MenuAjustes />
    </nav>
  );
}

/**
 * Segunda fila con las pantallas hermanas. Hoy solo la usa Catálogo (servicios
 * y productos); Equipo y Marketing pasaron a ser grupos del hub de Ajustes.
 */
export function AdminSubTabs() {
  const path = usePathname();
  const search = useSearchParams();
  const sede = search.get("sede");
  const grupo = HERMANAS.find((g) => g.hijos.some((h) => esRuta(path, h.href)));
  if (!grupo) return null;

  return (
    <nav
      aria-label="Pantallas de esta sección"
      className="mb-4 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {grupo.hijos.map((h) => {
        const act = esRuta(path, h.href);
        return (
          <Link
            key={h.href}
            href={sede ? `${h.href}?sede=${sede}` : h.href}
            aria-current={act ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-[13px] font-semibold transition ${
              act ? "border-ink bg-ink text-bg" : "border-line text-muted hover:border-ink/40 hover:text-ink"
            }`}
          >
            {h.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * "Ajustes" en escritorio: un desplegable de tres columnas con las mismas filas
 * del hub. En el celular no existe — ahí Ajustes es una pantalla de verdad.
 */
export function MenuAjustes() {
  const path = usePathname();
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const activo = destinoDe(path) === "ajustes";

  const cerrar = useCallback(() => setAbierto(false), []);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) cerrar();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto, cerrar]);

  return (
    <div ref={caja} className="relative hidden lg:block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className={`-mb-px inline-flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-[13px] font-semibold transition ${
          activo ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink/80"
        }`}
      >
        <GearIcon className="h-4 w-4" />
        Ajustes
      </button>
      {abierto && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-50 grid w-[680px] grid-cols-3 gap-x-5 gap-y-3 rounded-2xl border border-line bg-panel p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,.8)]"
        >
          {GRUPOS_HUB.map((g) => {
            const filas = HOJAS.filter((h) => h.grupo === g);
            if (!filas.length) return null;
            return (
              <div key={g}>
                <p className="eyebrow mb-1">{g}</p>
                {filas.map((h) => (
                  <Link
                    key={h.href}
                    href={h.href}
                    role="menuitem"
                    onClick={cerrar}
                    className="flex min-h-11 items-center rounded-lg px-2 text-[13px] text-ink transition hover:bg-elevated"
                  >
                    {h.label}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

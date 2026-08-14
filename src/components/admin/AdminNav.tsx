"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

// Navegación del panel en 7 TEMAS, no en 10 tablas. Antes cada pantalla era su
// propia pestaña y en el celular no cabían: nada decía que "Equipo" y
// "Comisiones" hablan de lo mismo, ni por qué "Precios" e "Inventario" se veían
// iguales (son servicios vs productos físicos, cosas distintas).
// Las RUTAS no cambian —enlaces y marcadores viejos siguen sirviendo—: cambia
// cómo se agrupan. Un tema con varias pantallas muestra una segunda fila con sus
// hermanas (AdminSubTabs).
type Hoja = { href: string; label: string };
type Grupo = Hoja & { hijos?: readonly Hoja[] };

const GRUPOS: readonly Grupo[] = [
  { href: "/admin", label: "Hoy" },
  { href: "/admin/agenda", label: "Agenda" },
  { href: "/admin/metricas", label: "Métricas" },
  { href: "/admin/cuadre", label: "Caja" },
  { href: "/admin/clientes", label: "Clientes" },
  {
    href: "/admin/precios",
    label: "Catálogo",
    hijos: [
      { href: "/admin/precios", label: "Servicios y precios" },
      { href: "/admin/inventario", label: "Productos y stock" },
    ],
  },
  {
    href: "/admin/equipo",
    label: "Equipo",
    hijos: [
      { href: "/admin/equipo", label: "Barberos y PINes" },
      { href: "/admin/comisiones", label: "Comisiones y contratos" },
      { href: "/admin/horarios", label: "Horarios" },
    ],
  },
  {
    href: "/admin/cupones",
    label: "Marketing",
    hijos: [
      { href: "/admin/cupones", label: "Cupones" },
      { href: "/admin/avisos", label: "Avisos al cliente" },
    ],
  },
] as const;

const SECUNDARIAS: readonly Hoja[] = [{ href: "/barbero", label: "App del barbero" }] as const;

// adminNav PLANO: lo consume la paleta Ctrl-K ("Ir a"). Se aplanan los hijos con
// su nombre largo para que buscar "inventario" o "comisiones" siga encontrando.
export const adminNav: readonly Hoja[] = [
  ...GRUPOS.flatMap((g) =>
    g.hijos ? g.hijos.map((h) => ({ href: h.href, label: h.label })) : [{ href: g.href, label: g.label }],
  ),
  ...SECUNDARIAS,
];

// Únicas secciones que leen el ?sede= del selector del topbar: Hoy, Agenda y
// Métricas filtran sus datos, y Precios lo usa para la sede del combo.
const SECCIONES_CON_SEDE = ["/admin", "/admin/agenda", "/admin/metricas", "/admin/precios"] as const;

const esRuta = (path: string, href: string) => (href === "/admin" ? path === href : path.startsWith(href));

export function seccionFiltraPorSede(path: string) {
  return SECCIONES_CON_SEDE.some((href) => esRuta(path, href));
}

// La agenda es SIEMPRE de una sede (una columna por barbero de esa sede): sin
// ?sede= cae en la primera, así que ofrecer "Ambas" marcaba una opción que la
// pantalla no puede cumplir (decía "Ambas" mostrando Parque Venezuela).
export const seccionExigeSede = (path: string) => esRuta(path, "/admin/agenda");

/** El grupo al que pertenece la ruta actual (marca la pestaña y da los hijos). */
function grupoDe(path: string): Grupo | undefined {
  return GRUPOS.find((g) => (g.hijos ? g.hijos.some((h) => esRuta(path, h.href)) : esRuta(path, g.href)));
}

// Tabs con scroll horizontal en mobile; activa con borde inferior accent.
// Conservan el ?sede= elegido al cambiar de sección.
export function AdminTabs() {
  const path = usePathname();
  const search = useSearchParams();
  const sede = search.get("sede");
  const barra = useRef<HTMLElement | null>(null);
  const activa = useRef<HTMLAnchorElement | null>(null);
  const [sobra, setSobra] = useState({ izq: false, der: false });
  const activo = grupoDe(path);

  const medirSobra = useCallback(() => {
    const cont = barra.current;
    if (!cont) return;
    const max = cont.scrollWidth - cont.clientWidth;
    // 4px de tolerancia: el scroll fraccionado de Android nunca cae justo en el borde.
    setSobra({ izq: cont.scrollLeft > 4, der: cont.scrollLeft < max - 4 });
  }, []);

  // Al entrar a una sección su pestaña podía quedar fuera de pantalla. Se centra
  // moviendo SOLO el scroll de la barra: scrollIntoView arrastraría la página.
  useEffect(() => {
    const cont = barra.current;
    const tab = activa.current;
    if (!cont || !tab) return;
    const c = cont.getBoundingClientRect();
    const t = tab.getBoundingClientRect();
    const destino = cont.scrollLeft + (t.left - c.left) - (c.width - t.width) / 2;
    cont.scrollLeft = Math.max(0, Math.min(destino, cont.scrollWidth - cont.clientWidth));
    medirSobra();
  }, [path, medirSobra]);

  useEffect(() => {
    medirSobra();
    window.addEventListener("resize", medirSobra);
    return () => window.removeEventListener("resize", medirSobra);
  }, [medirSobra]);

  // Degradado en los bordes con máscara (no pinta encima: desvanece la propia
  // barra, así sirve en tema claro y oscuro y no le roba ancho a las pestañas).
  const desvanecido = `linear-gradient(to right, ${
    sobra.izq ? "transparent 0px, #000 20px" : "#000 0px"
  }, ${sobra.der ? "#000 calc(100% - 28px), transparent 100%" : "#000 100%"})`;

  return (
    <nav
      ref={barra}
      aria-label="Secciones"
      onScroll={medirSobra}
      style={{ maskImage: desvanecido, WebkitMaskImage: desvanecido }}
      className="mx-auto flex w-full max-w-[1180px] gap-0.5 overflow-x-auto px-4 sm:px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {[...GRUPOS, ...SECUNDARIAS].map((n) => {
        const act = activo?.href === n.href;
        return (
          <Link
            key={n.href}
            ref={act ? activa : undefined}
            href={sede ? `${n.href}?sede=${sede}` : n.href}
            aria-current={act ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-semibold transition ${
              act ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink/80"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Segunda fila: las pantallas del tema actual. Solo aparece cuando el tema tiene
 * más de una, así que Hoy/Métricas/Caja/Clientes no ganan una barra vacía.
 */
export function AdminSubTabs() {
  const path = usePathname();
  const search = useSearchParams();
  const sede = search.get("sede");
  const grupo = grupoDe(path);
  if (!grupo?.hijos) return null;

  return (
    <div className="border-b border-line/60 bg-panel/40">
      <nav
        aria-label={`Secciones de ${grupo.label}`}
        className="mx-auto flex w-full max-w-[1180px] gap-1.5 overflow-x-auto px-4 py-2 sm:px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {grupo.hijos.map((h) => {
          const act = esRuta(path, h.href);
          return (
            <Link
              key={h.href}
              href={sede ? `${h.href}?sede=${sede}` : h.href}
              aria-current={act ? "page" : undefined}
              className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-full border px-3.5 text-[12.5px] font-semibold transition ${
                act
                  ? "border-accent/45 bg-accent/10 text-accent-soft"
                  : "border-line text-muted hover:border-accent/30 hover:text-ink"
              }`}
            >
              {h.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

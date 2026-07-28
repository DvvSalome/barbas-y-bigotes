"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

// Secciones del panel (tabs horizontales bajo el topbar, según el mockup).
const ADMIN_SECTIONS = [
  { href: "/admin", label: "Hoy" },
  { href: "/admin/metricas", label: "Métricas" },
  { href: "/admin/cuadre", label: "Caja" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/inventario", label: "Inventario" },
  { href: "/admin/precios", label: "Precios" },
  { href: "/admin/equipo", label: "Equipo" },
  { href: "/admin/comisiones", label: "Comisiones" },
  { href: "/admin/cupones", label: "Cupones" },
  { href: "/admin/avisos", label: "Avisos" },
] as const;

const SECONDARY_SECTIONS = [{ href: "/barbero", label: "App del barbero" }] as const;

// adminNav combinado: lo usan las tabs y la paleta Ctrl-K ("Ir a").
export const adminNav = [...ADMIN_SECTIONS, ...SECONDARY_SECTIONS] as const;

// Únicas secciones que hoy leen el ?sede= del selector del topbar: Hoy y Métricas
// filtran todos sus datos, y Precios lo usa para saber en qué sede se arma el combo.
// El resto muestra las dos sedes siempre, así que el selector se apaga allí (ver
// AdminTopbar): tener "Plaza de la Paz" marcado leyendo la caja de ambas es caro.
const SECCIONES_CON_SEDE = ["/admin", "/admin/metricas", "/admin/precios"] as const;

const esSeccion = (path: string, href: string) => (href === "/admin" ? path === href : path.startsWith(href));

export function seccionFiltraPorSede(path: string) {
  return SECCIONES_CON_SEDE.some((href) => esSeccion(path, href));
}

// Tabs con scroll horizontal en mobile; activa con borde inferior accent.
// Conservan el ?sede= elegido al cambiar de sección (bonus del selector).
export function AdminTabs() {
  const path = usePathname();
  const search = useSearchParams();
  const sede = search.get("sede");
  const barra = useRef<HTMLElement | null>(null);
  const activa = useRef<HTMLAnchorElement | null>(null);
  // Con 11 secciones en 390px se ven ~5: hay que avisar hacia qué lado sigue la barra.
  const [sobra, setSobra] = useState({ izq: false, der: false });

  const medirSobra = useCallback(() => {
    const cont = barra.current;
    if (!cont) return;
    const max = cont.scrollWidth - cont.clientWidth;
    // 4px de tolerancia: el scroll fraccionado de Android nunca cae justo en el borde.
    setSobra({ izq: cont.scrollLeft > 4, der: cont.scrollLeft < max - 4 });
  }, []);

  // Al entrar a una sección su pestaña podía quedar fuera de pantalla (pasaba en
  // Precios y Avisos) y el dueño no sabía dónde estaba parado. Se centra moviendo
  // SOLO el scroll de la barra: scrollIntoView arrastraría también la página.
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

  // Degradado en los bordes con máscara (no pinta encima: desvanece la propia barra,
  // así sirve igual en tema claro y oscuro y no le roba ancho a las pestañas).
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
      {adminNav.map((n) => {
        const activo = esSeccion(path, n.href);
        return (
          <Link
            key={n.href}
            ref={activo ? activa : undefined}
            href={sede ? `${n.href}?sede=${sede}` : n.href}
            aria-current={activo ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-semibold transition ${
              activo ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink/80"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

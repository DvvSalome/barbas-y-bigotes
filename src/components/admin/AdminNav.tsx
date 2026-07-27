"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

// Secciones del panel (tabs horizontales bajo el topbar, según el mockup).
const ADMIN_SECTIONS = [
  { href: "/admin", label: "Hoy" },
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

// Tabs con scroll horizontal en mobile; activa con borde inferior accent.
// Conservan el ?sede= elegido al cambiar de sección (bonus del selector).
export function AdminTabs() {
  const path = usePathname();
  const search = useSearchParams();
  const sede = search.get("sede");
  const isActive = (href: string) => (href === "/admin" ? path === href : path.startsWith(href));

  return (
    <nav
      aria-label="Secciones"
      className="mx-auto flex w-full max-w-[1180px] gap-0.5 overflow-x-auto px-4 sm:px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {adminNav.map((n) => {
        const activo = isActive(n.href);
        return (
          <Link
            key={n.href}
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

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/cuadre", label: "Cuadre de caja" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/precios", label: "Precios por sede" },
  { href: "/admin/inventario", label: "Inventario" },
  { href: "/admin/comisiones", label: "Comisiones" },
  { href: "/admin/cupones", label: "Cupones" },
  { href: "/barbero", label: "App del barbero" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {nav.map((n) => {
        const active = n.href === "/admin" ? path === n.href : path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`rounded-lg px-3 py-2 text-sm transition ${
              active
                ? "bg-elevated text-ink"
                : "text-muted hover:bg-elevated hover:text-ink"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

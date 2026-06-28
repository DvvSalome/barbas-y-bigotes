"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  GridIcon,
  CashIcon,
  UsersIcon,
  TagIcon,
  BoxIcon,
  PercentIcon,
  TicketIcon,
  ScissorsIcon,
} from "@/components/icons";

const ADMIN_SECTIONS = [
  { href: "/admin", label: "Resumen", Icon: GridIcon },
  { href: "/admin/cuadre", label: "Cuadre de caja", Icon: CashIcon },
  { href: "/admin/clientes", label: "Clientes", Icon: UsersIcon },
  { href: "/admin/precios", label: "Precios por sede", Icon: TagIcon },
  { href: "/admin/inventario", label: "Inventario", Icon: BoxIcon },
  { href: "/admin/comisiones", label: "Comisiones", Icon: PercentIcon },
  { href: "/admin/cupones", label: "Cupones", Icon: TicketIcon },
] as const;

const SECONDARY_SECTIONS = [{ href: "/barbero", label: "App del barbero", Icon: ScissorsIcon }] as const;

// adminNav combinado: lo usa AdminTopbar para resolver el título de la sección
// actual sin importarle si es un link "principal" o "secundario".
export const adminNav = [...ADMIN_SECTIONS, ...SECONDARY_SECTIONS] as const;

const stagger = {
  show: { transition: { staggerChildren: 0.035 } },
};
const item = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0 },
};

function NavItem({ n, active, onNavigate }: { n: (typeof adminNav)[number]; active: boolean; onNavigate?: () => void }) {
  return (
    <motion.div variants={item}>
      <Link
        href={n.href}
        onClick={onNavigate}
        className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
          active ? "bg-elevated text-ink" : "text-muted hover:bg-elevated/60 hover:text-ink"
        }`}
      >
        <span
          className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent transition-opacity ${
            active ? "opacity-100" : "opacity-0"
          }`}
        />
        <n.Icon
          className={`h-4 w-4 shrink-0 transition ${
            active ? "text-accent-soft" : "text-muted group-hover:text-accent-soft"
          }`}
        />
        {n.label}
      </Link>
    </motion.div>
  );
}

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const isActive = (href: string) => (href === "/admin" ? path === href : path.startsWith(href));

  return (
    <motion.nav className="flex flex-col gap-1" initial="hidden" animate="show" variants={stagger}>
      {ADMIN_SECTIONS.map((n) => (
        <NavItem key={n.href} n={n} active={isActive(n.href)} onNavigate={onNavigate} />
      ))}
      <div className="my-2 border-t border-line" />
      {SECONDARY_SECTIONS.map((n) => (
        <NavItem key={n.href} n={n} active={isActive(n.href)} onNavigate={onNavigate} />
      ))}
    </motion.nav>
  );
}

export function AdminNav() {
  return <NavLinks />;
}

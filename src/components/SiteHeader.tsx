"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { HeaderCuenta } from "@/components/HeaderCuenta";

/*
  Header público del prototipo (spec §1.1 móvil, §2.1 desktop):
  - Móvil: logo lockup 44px + botón de cuenta inteligente (Entrar / avatar+menú).
  - Desktop: nav sticky con blur, links Barberos / Nosotros + "Reservar" y el mismo
    botón de cuenta. "Mi cuenta" y "Cerrar sesión" viven ahora en ese botón (HeaderCuenta),
    no como items sueltos.
*/
export function SiteHeader() {
  const pathname = usePathname();

  const links = [
    { href: "/barberos", label: "Barberos" },
    { href: "/nosotros", label: "Nosotros" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[rgba(242,237,228,0.1)] bg-bg pt-[env(safe-area-inset-top)] md:border-white/[0.04] md:bg-[rgba(12,11,10,0.55)] md:backdrop-blur-[12px]">
      <div className="flex items-center justify-between px-[18px] py-2.5 md:px-12 md:py-3">
        <Link href="/" aria-label="Barbas & Bigotes Barbershop" className="transition hover:opacity-95">
          <Image
            src="/brand/logo-lockup.png"
            alt="Barbas & Bigotes Barbershop"
            width={1024}
            height={348}
            priority
            className="h-[52px] w-auto md:h-[68px]"
          />
        </Link>

        <div className="flex items-center gap-4 md:gap-[26px]">
          {/* Desktop: nav + Reservar (Barberos / Nosotros; "Mi cuenta" pasó al botón). */}
          <nav className="hidden items-center gap-[26px] md:flex">
            {links.map((link) => {
              const activa = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-[11.5px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                    activa ? "text-accent-soft" : "text-muted hover:text-accent-soft"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link
              href="/reservar"
              className="rounded-full bg-accent px-[22px] py-[11px] text-[11px] font-bold uppercase tracking-[0.14em] text-on-accent transition hover:bg-accent-soft"
            >
              Reservar
            </Link>
          </nav>

          {/* Botón de cuenta inteligente (móvil y escritorio): Entrar / avatar + menú. */}
          <HeaderCuenta />
        </div>
      </div>
    </header>
  );
}

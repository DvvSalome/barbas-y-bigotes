"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

/*
  Header público del prototipo (spec §1.1 móvil, §2.1 desktop):
  - Móvil: logo lockup 44px + pill "Entrar" (va a Mi cuenta).
  - Desktop: nav sticky con blur, links Barberos / Nosotros / Mi cuenta
    (activa en rojo suave) + botón "Reservar".
*/
export function SiteHeader() {
  const pathname = usePathname();

  const links = [
    { href: "/barberos", label: "Barberos" },
    { href: "/nosotros", label: "Nosotros" },
    { href: "/cuenta", label: "Mi cuenta" },
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
            className="h-11 w-auto md:h-[68px]"
          />
        </Link>

        {/* Móvil: solo "Entrar" */}
        <Link
          href="/cuenta"
          className="rounded-full border border-[rgba(242,237,228,0.16)] px-3.5 py-[7px] text-xs text-ink md:hidden"
        >
          Entrar
        </Link>

        {/* Desktop: nav + Reservar */}
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
      </div>
    </header>
  );
}

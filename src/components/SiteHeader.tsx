"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const pathname = usePathname();

  const links = [
    { href: "/barberos", label: "Barberos" },
    { href: "/nosotros", label: "Nosotros" },
    { href: "/cuenta", label: "Mi cuenta" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.04] bg-bg/40 backdrop-blur-md transition-all duration-300">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Barbas & Bigotes Barbershop" className="transition hover:opacity-95">
          <Image
            src="/brand/logo-lockup.png"
            alt="Barbas & Bigotes Barbershop"
            width={1024}
            height={348}
            priority
            className="h-12 w-auto sm:h-14"
          />
        </Link>
        <nav className="flex items-center gap-4 text-[11px] font-semibold uppercase tracking-wider sm:gap-6 sm:text-xs">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative py-1.5 transition-colors duration-300 hover:text-accent-soft ${
                  isActive ? "text-accent-soft" : "text-muted hover:text-white"
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 h-0.5 w-full bg-accent rounded-full animate-fade-in" />
                )}
              </Link>
            );
          })}
          <Link
            href="/reservar"
            className="rounded-full bg-accent px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-on-accent transition-all duration-300 hover:bg-accent-soft hover:shadow-[0_0_20px_rgba(210,63,52,0.35)] hover:scale-103 sm:px-5 sm:py-2.5 sm:text-[11px]"
          >
            Reservar
          </Link>
        </nav>
      </div>
    </header>
  );
}

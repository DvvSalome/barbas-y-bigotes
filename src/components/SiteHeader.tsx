"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { HeaderCuenta } from "@/components/HeaderCuenta";

/*
  Cabecera del sitio público (rediseño aprobado por el dueño, 26-sep, punto 4:
  "que los botones de la navbar estén mil veces mejor"). Vidrio fijo arriba;
  en la home (`transparente`) arranca transparente sobre la pared de fotos y se
  vuelve vidrio al bajar (CSS ligado al scroll en globals.css, sin JS).

  - Escritorio: píldora con las secciones. En la home son anclas de la misma
    página; en las demás llevan a la home o a su página.
  - Siempre: "Entrar" (el botón de cuenta inteligente, en grande) y "Reservar".
    En /reservar el botón sobra: ya estás ahí.
*/
export function SiteHeader({ transparente = false }: { transparente?: boolean }) {
  const pathname = usePathname() ?? "/";
  const enInicio = pathname === "/" || pathname === "/propuesta";
  const enReservar = pathname.startsWith("/reservar");
  const links = enInicio
    ? [
        { href: "#precios", label: "Precios" },
        { href: "#barberos", label: "Barberos" },
        { href: "#la-app", label: "Cómo funciona" },
      ]
    : [
        { href: "/#precios", label: "Precios" },
        { href: "/barberos", label: "Barberos" },
        { href: "/nosotros", label: "Nosotros" },
      ];

  return (
    <header className={`bb-cabecera${transparente ? " bb-cabecera-transparente" : ""}`}>
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-3 px-5">
        <Link href="/" aria-label="Barbas & Bigotes Barbershop, inicio" className="shrink-0">
          <Image src="/brand/logo-lockup.png" alt="" width={1024} height={348} preload className="h-11 w-auto lg:h-[54px]" />
        </Link>

        <nav aria-label="Secciones del sitio" className="bb-nav">
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={pathname === l.href ? "page" : undefined} className="bb-nav-link">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <HeaderCuenta grande />
          {!enReservar && (
            <Link href="/reservar?desde=cabecera" className="bb-btn bb-btn-primario bb-btn-chico">
              Reservar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

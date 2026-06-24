import Link from "next/link";
import Image from "next/image";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-6">
        <Link href="/" aria-label="Barbas & Bigotes Barbershop">
          <Image
            src="/brand/logo-lockup.png"
            alt="Barbas & Bigotes Barbershop"
            width={1024}
            height={348}
            priority
            className="h-11 w-auto sm:h-12"
          />
        </Link>
        <nav className="flex items-center gap-5 text-sm sm:gap-7">
          <Link
            href="/barberos"
            className="hidden text-muted transition hover:text-ink sm:inline"
          >
            Barberos
          </Link>
          <Link
            href="/cuenta"
            className="text-muted transition hover:text-ink"
          >
            Mi cuenta
          </Link>
          <Link
            href="/reservar"
            className="rounded-full bg-accent px-5 py-2.5 font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft"
          >
            Reservar
          </Link>
        </nav>
      </div>
    </header>
  );
}

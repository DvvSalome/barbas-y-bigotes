import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

// 404 con marca (server component): sin esto Next muestra su pantalla default en inglés.
//
// El título propio importa: sin él, la pestaña y el historial dicen "Barbas &
// Bigotes Barbershop | Barbería en Barranquilla", o sea que una página rota se
// ve igual que la portada en la lista de pestañas y en lo que comparte alguien.
export const metadata: Metadata = {
  title: "Esta página no existe",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-[60dvh] max-w-3xl flex-col items-center justify-center px-6 py-24 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-accent">Error 404</p>
        <h1 className="mt-3 font-display text-5xl font-semibold uppercase">Esta página no existe</h1>
        <p className="mt-4 max-w-md text-muted">
          Puede que el enlace esté vencido o mal escrito. Tu próximo corte, eso sí, sigue disponible.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-accent px-7 py-3 text-sm font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft"
          >
            Volver al inicio
          </Link>
          <Link
            href="/reservar"
            className="rounded-full border border-line px-7 py-3 text-sm text-accent-soft transition hover:border-accent/50"
          >
            Reservar cita →
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

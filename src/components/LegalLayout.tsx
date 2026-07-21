import type { ReactNode } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

// Shell de las páginas legales (privacidad y términos): mismo header/footer del
// sitio, columna de lectura angosta y tipografía sobria. Los <h2>/<p>/<ul> del
// contenido se estilan acá para no repetir clases en cada párrafo.
export function LegalLayout({
  titulo,
  actualizado,
  intro,
  children,
}: {
  titulo: string;
  /** Fecha de última actualización, legible (ej. "19 de julio de 2026"). */
  actualizado: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[720px] px-6 pb-20 pt-12 md:pt-16">
        <p className="font-display text-[11px] font-bold uppercase tracking-[0.34em] text-accent-soft">
          Legal
        </p>
        <h1 className="mt-3 font-display text-[40px] font-extrabold uppercase leading-[0.95] md:text-[52px]">
          {titulo}
        </h1>
        <p className="mt-3 text-[12.5px] text-muted">Última actualización: {actualizado}</p>
        <p className="mt-6 text-[15px] leading-[1.7] text-ink/85">{intro}</p>

        <div
          className="mt-10 space-y-7 text-[14.5px] leading-[1.75] text-ink/80
            [&_a]:text-accent-soft [&_a]:underline [&_a]:decoration-line [&_a]:underline-offset-4 hover:[&_a]:text-accent
            [&_h2]:font-display [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:uppercase [&_h2]:leading-tight [&_h2]:text-ink
            [&_h2]:mb-2.5 [&_h2]:mt-1
            [&_li]:mb-1.5 [&_strong]:font-semibold [&_strong]:text-ink
            [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5"
        >
          {children}
        </div>

        <div className="mt-12 rounded-2xl border border-line bg-panel px-5 py-5">
          <div className="font-display text-[13px] font-bold uppercase tracking-[0.14em] text-accent-soft">
            ¿Dudas sobre esto?
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-ink/80">
            Escribinos a{" "}
            <a href="mailto:hola@barbasybigotes.com" className="text-accent-soft underline decoration-line underline-offset-4">
              hola@barbasybigotes.com
            </a>{" "}
            o por{" "}
            <a
              href="https://wa.me/573006734799"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-soft underline decoration-line underline-offset-4"
            >
              WhatsApp
            </a>
            . Te respondemos nosotros, no un robot.
          </p>
          <Link
            href="/"
            className="relative mt-4 inline-block text-[13px] font-semibold text-accent-soft transition hover:text-accent before:absolute before:-inset-y-3 before:inset-x-0 before:content-['']"
          >
            ← Volver al inicio
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

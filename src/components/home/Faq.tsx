import { Reveal } from "@/components/motion/Reveal";
import { faqItems, faqPage, jsonLd } from "@/lib/schema-org";

/*
  FAQ citable de la landing (sitio publico, tokens de marca).
  Server component: las respuestas quedan en el HTML SSR (los crawlers de IA
  no ejecutan JS) y el FAQPage JSON-LD se deriva de los mismos textos.
  details/summary: acordeon accesible nativo, sin estado de cliente.
*/
export function Faq() {
  return (
    <section className="mx-auto max-w-4xl px-6 pt-14 sm:pt-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(faqPage) }}
      />
      <Reveal>
        <p className="text-xs uppercase tracking-[0.3em] text-accent">FAQ</p>
        <h2 className="font-display text-4xl font-semibold uppercase">
          Preguntas frecuentes
        </h2>
      </Reveal>
      <div className="mt-7 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
        {faqItems.map((f) => (
          <details key={f.pregunta} className="group px-6 py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-display text-lg font-semibold uppercase tracking-wide transition hover:text-accent-soft [&::-webkit-details-marker]:hidden">
              {f.pregunta}
              <span
                aria-hidden
                className="shrink-0 text-xl text-accent transition-transform duration-200 group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/85">
              {f.respuesta}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

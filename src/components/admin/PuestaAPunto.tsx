import Link from "next/link";
import type { PendientePuesta } from "@/lib/puesta";
import { AlertIcon, ChevronDownIcon } from "@/components/icons";

/*
  "Para dejar listo": la puesta a punto en el Inicio, arriba de "Para hacer".

  Componente de SERVIDOR sin estado: la página le pasa lo que armó
  saludConfiguracion() (src/lib/data/queries.ts → src/lib/puesta.ts), porque la
  misma lista decide si "Para hacer" puede decir «Todo al día». Si no hay nada,
  no dibuja nada.

  Lo que no le llega a nadie ('falta') va destacado en ámbar, con su paso y su
  botón. Las sugerencias van plegadas en una sola fila: están para el que quiera
  aprovechar más, no para tapar lo urgente.
*/

// El mismo rótulo de sección que el resto del Inicio (marca roja al inicio).
const SEC =
  "flex items-baseline justify-between eyebrow " +
  "[&>span:first-of-type]:relative [&>span:first-of-type]:pl-3 [&>span:first-of-type]:before:absolute " +
  "[&>span:first-of-type]:before:left-0 [&>span:first-of-type]:before:top-1/2 [&>span:first-of-type]:before:h-3 " +
  "[&>span:first-of-type]:before:w-[3px] [&>span:first-of-type]:before:-translate-y-1/2 " +
  "[&>span:first-of-type]:before:rounded-full [&>span:first-of-type]:before:bg-accent [&>span:first-of-type]:before:content-['']";

const ENLACE =
  "inline-flex min-h-11 items-center text-[13px] font-semibold text-ink/85 underline decoration-line underline-offset-4 transition hover:text-ink";

export function PuestaAPunto({ pendientes, className = "" }: { pendientes: PendientePuesta[]; className?: string }) {
  if (!pendientes.length) return null;
  const faltas = pendientes.filter((p) => p.tono === "falta");
  const sugerencias = pendientes.filter((p) => p.tono === "sugerencia");

  return (
    <section aria-label="Para dejar listo" className={className}>
      <h2 className={`${SEC} mb-2.5`}>
        <span>Para dejar listo</span>
        {faltas.length > 0 && (
          <span className="text-[12px] font-bold normal-case tracking-normal text-warn">
            {faltas.length === 1 ? "1 cosa no está llegando" : `${faltas.length} cosas no están llegando`}
          </span>
        )}
      </h2>

      {faltas.length > 0 && (
        <ul className="overflow-hidden rounded-2xl border border-warn/40 bg-warn/[0.06]">
          {faltas.map((p) => (
            <li key={p.clave} className="border-b border-warn/20 px-4 pb-1.5 pt-3 last:border-b-0">
              <p className="flex items-start gap-2 text-[13px] font-semibold leading-snug text-ink">
                <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
                <span>{p.titulo}</span>
              </p>
              <p className="mt-1 pl-[22px] text-[12px] leading-relaxed text-muted">{p.detalle}</p>
              <div className="pl-[22px]">
                <Link href={p.href} className={ENLACE}>
                  {p.boton} →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {sugerencias.length > 0 && (
        <details className={`group rounded-2xl border border-line bg-panel ${faltas.length ? "mt-2.5" : ""}`}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0">
              <span className="block text-[12.5px] font-semibold text-ink">
                {sugerencias.length === 1 ? "1 sugerencia" : `${sugerencias.length} sugerencias`}
              </span>
              <span className="block truncate text-[12px] text-muted">{sugerencias.map((p) => p.titulo).join(" · ")}</span>
            </span>
            <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted transition group-open:rotate-180" />
          </summary>
          <ul className="border-t border-line/60">
            {sugerencias.map((p) => (
              <li key={p.clave} className="border-b border-line/60 px-4 pb-1.5 pt-3 last:border-b-0">
                <p className="text-[12.5px] font-semibold leading-snug text-ink">{p.titulo}</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{p.detalle}</p>
                <Link href={p.href} className={ENLACE}>
                  {p.boton} →
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

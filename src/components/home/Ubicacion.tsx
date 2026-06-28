"use client";

import Link from "next/link";
import { PhotoLightbox } from "@/components/ui/PhotoLightbox";
import { CamIcon } from "@/components/icons";

const locales = [
  {
    nombre: "Parque Venezuela",
    query: "Barbas y Bigotes Parque Venezuela Barranquilla",
    foto: "/sedes/parque-venezuela-interior.jpg",
  },
  {
    nombre: "Plaza de la Paz",
    query: "Barbas y Bigotes Plaza de la Paz Barranquilla",
    foto: "/sedes/plaza-de-la-paz-interior.jpg",
  },
];

export function Ubicacion() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-14 sm:pt-24">
      <p className="text-xs uppercase tracking-[0.3em] text-accent">Visitanos</p>
      <h2 className="font-display text-4xl font-semibold uppercase">Dónde y cuándo</h2>
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {locales.map((l) => (
          <PhotoLightbox key={l.nombre} src={l.foto} alt={`Interior sede ${l.nombre}`} title={l.nombre}>
            {(open) => (
              <div className="rounded-2xl border border-line bg-panel p-7">
                <button
                  type="button"
                  onClick={open}
                  className="group flex w-full items-center justify-between gap-3 text-left"
                >
                  <h3 className="font-display text-2xl font-semibold uppercase transition group-hover:text-accent-soft">
                    {l.nombre}
                  </h3>
                  <span className="flex items-center gap-1.5 whitespace-nowrap text-[11px] uppercase tracking-wide text-accent-soft transition group-hover:text-accent">
                    <CamIcon className="h-3.5 w-3.5" /> Ver el local
                  </span>
                </button>
                <p className="mt-3 text-sm text-muted">
                  Lun – Sáb · 9:00 am – 8:00 pm
                  <br />
                  Domingo · cerrado
                </p>
                <p className="mt-1 text-xs text-muted/70">Horario referencial — confirmar con el cliente.</p>
                <Link
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.query)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-block rounded-full border border-accent/50 px-6 py-2.5 text-sm text-accent-soft transition hover:bg-accent/10"
                >
                  Cómo llegar →
                </Link>
              </div>
            )}
          </PhotoLightbox>
        ))}
      </div>
    </section>
  );
}

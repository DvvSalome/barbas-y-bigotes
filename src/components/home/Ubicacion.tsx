"use client";

import { useState } from "react";

type Local = {
  id: "parque-venezuela" | "plaza-de-la-paz";
  nombre: string;
  direccion: string;
  telefono: string;
  query: string;
  foto: string;
  lat: string;
  lng: string;
  streetViewEmbed?: string;
};

const locales: Local[] = [
  {
    id: "parque-venezuela",
    nombre: "Parque Venezuela",
    direccion: "Calle 88 #44 - 10, Local 4, Barranquilla",
    telefono: "+57 300 409 7624",
    query: "Calle 88 #44 - 10, Local 4, Barranquilla", // Usar dirección para que cargue en el mapa
    foto: "/sedes/parque-venezuela-interior.jpg",
    lat: "11.002041",
    lng: "-74.823953",
  },
  {
    id: "plaza-de-la-paz",
    nombre: "Plaza de la Paz",
    direccion: "Cra. 45 #50-168, Frente a la Plaza de la Paz, Barranquilla",
    telefono: "+57 300 673 4799",
    query: "BARBAS Y BIGOTES BARBERCLUB FRENTE A LA PLAZA DE LA PAZ",
    foto: "/sedes/plaza-de-la-paz-interior.jpg",
    lat: "10.986608",
    lng: "-74.790934",
    streetViewEmbed: "https://www.google.com/maps/embed?pb=!4v1782789057569!6m8!1m7!1sxvHbHMym5ue7N9aFT0dW2w!2m2!1d10.98756016276552!2d-74.78914906416058!3f203.76871040234138!4f-0.9862926928934712!5f0.7820865974627469"
  },
];

// Ruta hacia la sede en la app de Maps. En móvil reemplaza al mapa embebido.
function comoLlegar(l: Local) {
  return `https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lng}`;
}

export function Ubicacion() {
  const [activeLoc, setActiveLoc] = useState<"parque-venezuela" | "plaza-de-la-paz">("parque-venezuela");
  const [viewType, setViewType] = useState<"map" | "satellite" | "streetview">("map");

  const currentSede = locales.find((l) => l.id === activeLoc)!;

  // Standard roadmap view with query marker
  const roadmapSrc = `https://www.google.com/maps?q=${encodeURIComponent(currentSede.query)}&z=17&ie=UTF8&output=embed`;
  
  // Satellite Hybrid view
  const satelliteSrc = `https://www.google.com/maps?q=${encodeURIComponent(currentSede.query)}&t=h&z=17&ie=UTF8&output=embed`;

  // Embedded Street View
  const streetViewSrc = currentSede.streetViewEmbed || `https://www.google.com/maps?q=${encodeURIComponent(currentSede.query)}&layer=c&cbll=${currentSede.lat},${currentSede.lng}&cbp=11,0,0,0,0&output=svembed`;

  const currentSrc =
    viewType === "map"
      ? roadmapSrc
      : viewType === "satellite"
      ? satelliteSrc
      : streetViewSrc;

  return (
    <section className="mx-auto max-w-6xl px-6 pt-14 sm:pt-24">
      <p className="text-xs uppercase tracking-[0.3em] text-accent">Visítanos</p>
      <h2 className="font-display text-4xl font-semibold uppercase">Dónde y cuándo</h2>

      {/* Cards de sedes */}
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {locales.map((l) => (
          <div
            key={l.id}
            onClick={() => {
              setActiveLoc(l.id);
              setViewType("map"); // Reset to standard map when switching location
            }}
            className={`cursor-pointer rounded-2xl border p-7 transition duration-300 ${
              activeLoc === l.id
                ? "border-accent bg-accent/[0.02]"
                : "border-line bg-panel hover:border-accent/40"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-2xl font-semibold uppercase text-white">
                {l.nombre}
              </h3>
            </div>
            
            <p className="mt-3 text-sm text-ink/80 leading-relaxed">
              <strong>Dirección:</strong> {l.direccion}
              <br />
              {/* Enlace tel:, no texto suelto: desde el celular se llama de un toque. */}
              <strong>Teléfono:</strong>{" "}
              <a
                href={`tel:${l.telefono.replace(/\s/g, "")}`}
                onClick={(e) => e.stopPropagation()}
                className="transition hover:text-accent-soft"
              >
                {l.telefono}
              </a>
            </p>
            <p className="mt-3 text-xs text-muted">
              Lun – Sáb · 9:00 am – 8:00 pm
              <br />
              Domingo · cerrado
            </p>

            <div className="mt-5 flex items-center justify-between">
              {/* Móvil: sin iframe. Dos mapas de Google embebidos son mucho peso en
                  un Android de gama media, y el que llega desde el celular lo que
                  quiere es que se le abra la app de Maps ya con la ruta. */}
              <a
                href={comoLlegar(l)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/[0.06] px-4 text-[12.5px] font-bold uppercase tracking-[0.1em] text-accent-soft md:hidden"
              >
                Cómo llegar ↗
              </a>
              <span className="hidden text-[11.5px] font-bold uppercase tracking-[0.1em] text-accent-soft md:inline">
                {activeLoc === l.id
                  ? "Seleccionada · mira el mapa abajo"
                  : "Seleccionar para ver el mapa"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Mapa interactivo — solo desktop (en móvil manda el botón "Cómo llegar") */}
      <div className="mt-8 hidden rounded-2xl border border-line bg-panel overflow-hidden md:block">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-line bg-bg/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold uppercase text-white">
              {currentSede.nombre}
            </h3>
            <p className="text-xs text-muted">{currentSede.direccion}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setViewType("map")}
              className={`rounded-[9px] px-3.5 py-[7px] text-[11px] font-bold uppercase tracking-[0.08em] transition ${
                viewType === "map"
                  ? "bg-accent text-on-accent"
                  : "bg-elevated text-muted hover:text-white"
              }`}
            >
              Mapa
            </button>
            <button
              onClick={() => setViewType("satellite")}
              className={`rounded-[9px] px-3.5 py-[7px] text-[11px] font-bold uppercase tracking-[0.08em] transition ${
                viewType === "satellite"
                  ? "bg-accent text-on-accent"
                  : "bg-elevated text-muted hover:text-white"
              }`}
            >
              Satélite
            </button>
            <button
              onClick={() => setViewType("streetview")}
              className={`rounded-[9px] px-3.5 py-[7px] text-[11px] font-bold uppercase tracking-[0.08em] transition ${
                viewType === "streetview"
                  ? "bg-accent text-on-accent"
                  : "bg-elevated text-muted hover:text-white"
              }`}
            >
              Tour 360°
            </button>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${currentSede.lat},${currentSede.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-elevated border border-line px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent-soft hover:text-accent transition"
            >
              Abrir en Maps ↗
            </a>
          </div>
        </div>

        {/* Mapa Embed Frame */}
        <div className="relative h-[250px] sm:h-[340px] w-full bg-ink/5">
          <iframe
            key={`${activeLoc}-${viewType}`}
            src={currentSrc}
            className="absolute inset-0 h-full w-full border-none"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  );
}

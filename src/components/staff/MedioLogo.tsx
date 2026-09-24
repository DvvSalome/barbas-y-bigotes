"use client";

import { useState } from "react";

// Tile 30px con el logo del medio de pago (checkout del barbero, dashboard).
// Medios conocidos: logo oficial (nequi/daviplata) o ícono monocromo sobre
// fondo de marca. Medios que el admin cree después: tile neutro con la inicial.
const MARCAS: Record<string, { bg: string; src: string; pad?: boolean; ancho?: number }> = {
  // Sobre BLANCO: el logo oficial trae las letras en #200020 y el cuadrito era
  // #1b0b2e — casi negro sobre casi negro, solo se veía el punto rosado. Blanco
  // es el fondo con el que Nequi usa su logo. Y más ancho: es una palabra
  // (104×33), metida en un cuadrado al 66 % quedaba de 18 px.
  nequi: { bg: "#ffffff", src: "/brand/pagos/nequi.svg", ancho: 0.86 },
  daviplata: { bg: "rgba(225, 10, 23, 0.18)", src: "/brand/pagos/daviplata.png", pad: true },
  efectivo: { bg: "#1e3527", src: "/brand/pagos/efectivo.svg" },
  datafono: { bg: "#26282d", src: "/brand/pagos/datafono.svg" },
  transferencia: { bg: "#1c2a3f", src: "/brand/pagos/transferencia.svg" },
};

export function MedioLogo({ slug, nombre, size = 30 }: { slug: string; nombre: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const marca = MARCAS[slug];
  const box: React.CSSProperties = { width: size, height: size };

  if (!marca || broken) {
    // Fallback: inicial sobre tile neutro (también si el asset no carga).
    return (
      <span
        aria-hidden
        style={box}
        className="grid shrink-0 place-items-center rounded-lg border border-line bg-elevated text-[13px] font-bold text-muted"
      >
        {(nombre || slug).charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <span
      aria-hidden
      style={{ ...box, background: marca.bg }}
      className="grid shrink-0 place-items-center rounded-lg"
    >
      {/* img plano (no next/image): assets locales chicos, tamaño fijo. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={marca.src}
        alt=""
        width={Math.round(size * (marca.ancho ?? (marca.pad ? 0.66 : 0.6)))}
        height={Math.round(size * (marca.ancho ?? (marca.pad ? 0.66 : 0.6)))}
        className="object-contain"
        onError={() => setBroken(true)}
      />
    </span>
  );
}

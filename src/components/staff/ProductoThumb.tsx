"use client";

import { useState } from "react";

// Tintas cálidas para el fallback (sin foto): estable por nombre, así el mismo
// producto siempre "se ve igual" en inventario y checkout.
const TINTAS = ["#33261a", "#1e3527", "#1c2a3f", "#3a2330", "#332f1c", "#26282d"];

function tintaDe(nombre: string) {
  let h = 0;
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TINTAS[h % TINTAS.length];
}

// Miniatura de producto (inventario + checkout del barbero): la foto real que
// subió el admin, o tinta cálida con la inicial mientras no haya foto.
export function ProductoThumb({
  nombre,
  fotoUrl,
  size = 42,
}: {
  nombre: string;
  fotoUrl?: string | null;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  const box: React.CSSProperties = { width: size, height: size };

  if (!fotoUrl || broken) {
    // La inicial va en hueso fijo (no text-ink): las tintas son oscuras
    // en ambos temas del staff.
    return (
      <span
        aria-hidden
        style={{ ...box, background: tintaDe(nombre) }}
        className="grid shrink-0 place-items-center rounded-[10px] border border-line font-display text-base font-semibold text-[#f2ede4]/85"
      >
        {(nombre || "?").charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    // img plano (no next/image): URL pública de Supabase Storage, tamaño fijo chico.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={fotoUrl}
      alt={nombre}
      style={box}
      className="shrink-0 rounded-[10px] border border-line object-cover"
      onError={() => setBroken(true)}
    />
  );
}

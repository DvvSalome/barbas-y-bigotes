// Los chips de la reseña del cliente, del lado del staff (Inicio del admin y la
// ficha del cliente). Solo lectura: los marca el cliente en /calificar o /cuenta.
// Sin "use client": es presentación pura y sirve en server y client components.

/** Lo que marcó UN cliente en su calificación. */
export function ChipsMarcados({ etiquetas, className = "" }: { etiquetas: string[]; className?: string }) {
  if (etiquetas.length === 0) return null;
  return (
    <ul className={`mt-1.5 flex flex-wrap gap-1.5 ${className}`} aria-label="Lo que marcó">
      {etiquetas.map((e) => (
        <li key={e} className="rounded-full border border-line bg-elevated px-2.5 py-0.5 text-[12px] text-ink/85">
          {e}
        </li>
      ))}
    </ul>
  );
}

/** Lo que más marcan (30 días), con cuántas veces. `malo` = lo que falló. */
export function ResumenChips({
  titulo,
  chips,
  malo = false,
}: {
  titulo: string;
  chips: { label: string; veces: number }[];
  malo?: boolean;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="mt-3 border-t border-line/60 pt-3">
      <p className="text-[12px] font-semibold text-muted">{titulo}</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <li
            key={c.label}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] text-ink ${
              malo ? "border-warn/40 bg-warn/[0.06]" : "border-line bg-elevated"
            }`}
          >
            {c.label}
            <span className="tabular-nums text-muted" aria-label={`${c.veces} ${c.veces === 1 ? "vez" : "veces"}`}>
              {c.veces}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

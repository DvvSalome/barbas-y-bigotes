import type { ReactNode } from "react";

// Par label/valor pequeño para las vistas de tarjeta en mobile (reemplazan
// columnas de tabla que no entran en una pantalla angosta).
export function Stat({ label, value, className = "" }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-0.5 text-sm ${className}`}>{value}</div>
    </div>
  );
}

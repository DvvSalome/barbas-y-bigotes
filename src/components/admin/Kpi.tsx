import type { ComponentType } from "react";

type IconType = ComponentType<{ className?: string }>;

// Card de KPI compartida del panel admin — mismo lenguaje visual que el resto
// del sitio (border-line/bg-panel + icon chip), sin animación de conteo: el
// admin se refresca seguido (acciones, realtime) y un count-up en cada render
// se vuelve molesto para uso repetido, no premium.
export function Kpi({
  label,
  value,
  hint,
  accent = true,
  Icon,
  size = "md",
}: {
  label: string;
  value: string;
  /** Nodo libre: permite anclar el "▲ 12% vs período anterior" a SU tarjeta. */
  hint?: React.ReactNode;
  accent?: boolean;
  Icon?: IconType;
  size?: "md" | "sm";
}) {
  const pad = size === "sm" ? "p-4" : "p-5 sm:p-6";
  const valueSize = size === "sm" ? "text-2xl" : "text-3xl sm:text-4xl";

  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-line bg-panel ${pad} transition hover:border-accent/30`}>
      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-accent/10 blur-2xl transition group-hover:bg-accent/15" />
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
        {Icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/40 text-accent">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className={`mt-2 font-display ${valueSize} ${accent ? "text-accent-soft" : "text-ink"}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

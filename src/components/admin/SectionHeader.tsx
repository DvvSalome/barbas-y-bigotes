import type { ReactNode } from "react";

// Encabezado de sección reutilizable del panel admin — mismo patrón eyebrow +
// heading display que usa el resto del sitio (WhyUs, Historia, etc.), sin
// forzar uppercase en el título: en una tabla densa de uso diario el title
// case escanea más rápido que el mayúscula-sostenida de marketing.
export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="text-xs uppercase tracking-[0.3em] text-accent">{eyebrow}</p>}
        <h1 className="mt-1 font-display text-3xl font-semibold sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

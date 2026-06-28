import { PinIcon } from "@/components/icons";

type IconProps = { className?: string };

function Scissors({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  );
}

function Calendar({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="m9 16 2 2 4-4" />
    </svg>
  );
}

function Sparkle({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
    </svg>
  );
}

const items = [
  { t: "Barberos expertos", d: "6 especialistas en degradados, barba, color y diseño.", Icon: Scissors },
  { t: "Dos sedes", d: "Parque Venezuela y Plaza de la Paz, en Barranquilla.", Icon: PinIcon },
  { t: "Reserva sin filas", d: "Agendá online y, si te atrasás, le avisamos al siguiente de la lista.", Icon: Calendar },
  { t: "Experiencia premium", d: "Espacio moderno, productos de primera y bebida de cortesía.", Icon: Sparkle },
];

export function WhyUs() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-12 sm:pt-20">
      <p className="text-xs uppercase tracking-[0.3em] text-accent">Por qué nosotros</p>
      <h2 className="font-display text-4xl font-semibold uppercase">La diferencia</h2>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ t, d, Icon }) => (
          <div key={t} className="rounded-2xl border border-line bg-panel p-6">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-accent/40 text-accent">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="font-display text-xl font-semibold uppercase">{t}</h3>
            <p className="mt-2 text-sm text-muted">{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

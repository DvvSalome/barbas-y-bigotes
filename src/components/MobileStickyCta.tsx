import Link from "next/link";

/*
  CTA sticky inferior de la home móvil (spec §1.8): botón "Reservar ahora"
  siempre visible sobre un degradado que funde con el fondo. Solo mobile.
*/
export function MobileStickyCta() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-[linear-gradient(180deg,rgba(12,11,10,0),rgba(12,11,10,0.92)_40%)] px-4 pb-[max(26px,env(safe-area-inset-bottom))] pt-3 md:hidden">
      <Link
        href="/reservar"
        className="pointer-events-auto block rounded-full bg-[linear-gradient(180deg,var(--accent-soft),var(--accent))] py-[15px] text-center font-display text-[17px] font-bold uppercase tracking-[0.08em] text-on-accent shadow-[0_12px_26px_-10px_rgba(210,63,52,0.7)]"
      >
        Reservar ahora
      </Link>
    </div>
  );
}

import { RACIMO } from "@/components/propuesta/racimo";
import css from "./propuesta.module.css";

/**
 * El techo de luces en tubos. Sin nada más, se dibuja encendido (así lo ven los
 * buscadores, quien no tiene JS y quien pide menos movimiento). Con `apagable`,
 * arranca apagado y se prende cuando alguien le pone `data-encendido` (el
 * observador del cierre) o cuando GSAP lo toma en escritorio.
 */
export function Panal({ apagable = false, className = "", id }: { apagable?: boolean; className?: string; id?: string }) {
  return (
    <svg
      id={id}
      viewBox={RACIMO.viewBox}
      className={`${css.panal} ${className}`}
      data-apagable={apagable ? "" : undefined}
      aria-hidden
      focusable="false"
    >
      <defs>
        <filter id="bb-halo" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      {RACIMO.tubos.map((t, i) => (
        <g
          key={i}
          className={css.tubo}
          data-tubo=""
          data-parpadea={i % 3 === 1 ? "" : undefined}
          style={{ "--i": i } as React.CSSProperties}
        >
          <line className={css.halo} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} filter="url(#bb-halo)" />
          <line className={css.nucleo} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
        </g>
      ))}
    </svg>
  );
}

"use client";

import Image from "next/image";
import { useState } from "react";

/*
  Widget de contacto flotante del prototipo (spec §1.9 móvil, §2.11 desktop):
  botón negro redondo con la cara del logo + anillo de pulso rojo (bbping) y
  tooltip "¿Alguna duda, bro? Escríbenos." que cae desde arriba (bbdrop) con ✕.
  Solo se monta en la home y en /cuenta — nunca en staff ni en el wizard.
*/

// Link LITERAL del prototipo (texto prellenado incluido).
const WA_URL =
  "https://wa.me/573006734799?text=Hola%20Barbas%20%26%20Bigotes%2C%20quisiera%20saber%20m%C3%A1s%20informaci%C3%B3n%20sobre%20sus%20servicios%20y%20reservas.";

export function ContactoWidget({
  /** En la home móvil el widget vive arriba del CTA sticky "Reservar ahora". */
  sobreCtaMovil = false,
}: {
  sobreCtaMovil?: boolean;
}) {
  // Visible por defecto; al cerrarlo no reaparece (igual que el proto).
  const [tooltip, setTooltip] = useState(true);

  return (
    <div
      className={`fixed right-4 z-40 flex flex-col items-end gap-2.5 md:bottom-[26px] md:right-[26px] ${
        sobreCtaMovil ? "bottom-[88px]" : "bottom-6"
      }`}
    >
      {tooltip && (
        <div className="relative rounded-[14px] border border-[rgba(242,237,228,0.14)] bg-[rgba(21,19,17,0.96)] py-2.5 pl-3.5 pr-[34px] text-left shadow-[0_18px_40px_-16px_rgba(0,0,0,0.8)] [animation:bbdrop_.35s_ease_both] md:backdrop-blur-[6px]">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">Contacto</p>
          <p className="mt-0.5 text-[12.5px] font-medium text-white/90">
            ¿Alguna duda, bro? Escríbenos.
          </p>
          <button
            type="button"
            aria-label="Cerrar mensaje de contacto"
            onClick={() => setTooltip(false)}
            className="absolute right-1.5 top-1.5 grid h-[22px] w-[22px] place-items-center rounded-full bg-[rgba(242,237,228,0.08)] text-xs text-muted"
          >
            ✕
          </button>
          {/* Flechita hacia el botón */}
          <span
            aria-hidden
            className="absolute bottom-[-6px] right-5 h-3 w-3 rotate-45 border-b border-r border-[rgba(242,237,228,0.14)] bg-[rgba(21,19,17,0.96)]"
          />
        </div>
      )}

      <a
        href={WA_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Escríbenos por WhatsApp"
        className="relative grid h-[58px] w-[58px] place-items-center rounded-full border border-[rgba(242,237,228,0.14)] bg-[#050403] shadow-[0_8px_30px_rgba(0,0,0,0.55)] md:h-[60px] md:w-[60px] md:border-[rgba(242,237,228,0.2)]"
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-accent opacity-20 [animation:bbping_2.4s_ease-out_infinite]"
        />
        <Image
          src="/brand/logo-face-transparent.png"
          alt=""
          width={80}
          height={80}
          className="relative h-[38px] w-[38px] object-contain md:h-10 md:w-10"
        />
      </a>
    </div>
  );
}

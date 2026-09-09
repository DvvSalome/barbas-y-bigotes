"use client";

import { linkWhatsApp } from "@/lib/whatsapp";

/**
 * El paso que faltaba después de mover o cancelar una cita: avisarle al cliente.
 * Aparece SOLO, apenas se guarda el cambio, con el mensaje ya escrito — porque
 * "acordate de avisarle" no es un recordatorio, es una tarea que se olvida.
 *
 * No manda nada por su cuenta (eso sería la API de WhatsApp Business, que se
 * paga): abre el chat con el texto cargado y el mostrador toca enviar.
 */
export function AvisarWhatsApp({
  titulo,
  telefono,
  mensaje,
  onListo,
}: {
  titulo: string;
  telefono: string | null;
  mensaje: string;
  onListo: () => void;
}) {
  const url = linkWhatsApp(telefono, mensaje);

  return (
    <div className="rounded-2xl border border-ok/35 bg-ok/[0.06] p-4">
      <p className="font-display text-lg text-ink">{titulo}</p>
      {url ? (
        <>
          <p className="mt-1 text-[12.5px] leading-snug text-muted">
            Falta que el cliente se entere. El mensaje ya va escrito; solo tocá enviar.
          </p>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            onClick={onListo}
            className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-full bg-ok px-5 text-sm font-bold uppercase tracking-wide text-bg transition hover:brightness-110"
          >
            Avisarle por WhatsApp
          </a>
          {/* Copia textual del mensaje: el dueño quiere saber qué se manda en su
              nombre antes de tocar el botón. */}
          <p className="mt-2.5 whitespace-pre-line rounded-lg bg-bg/60 px-3 py-2 text-[12px] leading-relaxed text-muted">
            {mensaje}
          </p>
        </>
      ) : (
        <p className="mt-1 text-[12.5px] leading-snug text-warn">
          Este cliente no tiene un teléfono con el que se pueda escribir. Avisale como puedas —
          quedó sin enterarse del cambio.
        </p>
      )}
      <button
        type="button"
        onClick={onListo}
        className="mt-2 min-h-11 w-full text-[12.5px] font-semibold text-muted transition hover:text-ink"
      >
        Listo, ya le avisé
      </button>
    </div>
  );
}

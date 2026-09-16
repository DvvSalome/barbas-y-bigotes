"use client";

import { Hoja, PieHoja, primarioDeHoja } from "@/components/ui/Hoja";
import { linkWhatsApp } from "@/lib/whatsapp";

/**
 * El paso que faltaba después de mover o cancelar una cita: avisarle al cliente.
 * Aparece SOLO, apenas se guarda el cambio, con el mensaje ya escrito — porque
 * "acuérdate de avisarle" no es un recordatorio, es una tarea que se olvida.
 *
 * No manda nada por su cuenta (eso sería la API de WhatsApp Business, que se
 * paga): abre el chat con el texto cargado y el mostrador toca enviar.
 *
 * Es LA hoja del staff (paso 5 de la tanda 2), no una tarjeta flotando: antes
 * era el quinto overlay copiado a mano dentro de AgendaDia. Con el pie pegado,
 * "Avisarle" queda siempre a la vista aunque el mensaje sea largo.
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
    <Hoja
      titulo={titulo}
      onCerrar={onListo}
      ancho="max-w-md"
      pie={
        <PieHoja onCancelar={onListo} textoCancelar="Listo, ya le avisé">
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" onClick={onListo} className={primarioDeHoja}>
              Avisarle por WhatsApp
            </a>
          ) : null}
        </PieHoja>
      }
    >
      {url ? (
        <>
          <p className="text-[13px] leading-snug text-muted">
            Falta que el cliente se entere. El mensaje ya va escrito; solo toca enviar.
          </p>
          {/* Copia textual del mensaje: el dueño quiere saber qué se manda en su
              nombre antes de tocar el botón. */}
          <p className="mt-3 whitespace-pre-line rounded-xl border border-line bg-elevated px-3.5 py-3 text-[12.5px] leading-relaxed text-muted">
            {mensaje}
          </p>
        </>
      ) : (
        <p className="text-[13px] leading-snug text-warn">
          Este cliente no tiene un teléfono con el que se pueda escribir. Avísale como puedas —
          quedó sin enterarse del cambio.
        </p>
      )}
    </Hoja>
  );
}

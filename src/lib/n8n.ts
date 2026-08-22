// Aviso a n8n de que hay algo nuevo que mandar.
//
// El correo de confirmación lo arma y lo envía n8n leyendo una cola en Postgres
// (v_confirmaciones_pendientes) con un cron de un minuto. Eso significa que el
// cliente que acaba de reservar espera hasta 60 segundos su confirmación, mirando
// la pantalla del "¡Listo!".
//
// Este ping le dice a n8n "mirá la cola AHORA". No manda datos ni dispara un
// correo por su cuenta: solo adelanta la vuelta, así que no hay forma de que
// alguien lo use para mandarle correo a nadie. Y el cron sigue estando ahí: si
// esto falla —n8n caído, red, lo que sea— el correo sale igual en la vuelta
// siguiente. Por eso NUNCA revienta la reserva.

/** Milisegundos que se le dan a n8n antes de soltarlo. La reserva no espera. */
const TIMEOUT_MS = 2500;

/**
 * Le pide a n8n que procese la cola de confirmaciones ya mismo.
 *
 * Best-effort a propósito: devuelve void, traga cualquier error y solo deja
 * rastro en el log. La cita YA está guardada cuando esto corre; que el correo
 * salga 40 segundos después no es una falla que valga tumbar una reserva.
 */
export async function avisarConfirmacionPendiente(): Promise<void> {
  const url = process.env.N8N_WEBHOOK_CONFIRMACION;
  if (!url) return; // sin configurar: se queda con el cron de siempre
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origen: "reserva" }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // No cachear: es un disparo, no una lectura.
      cache: "no-store",
    });
  } catch (e) {
    // Se registra y se sigue. El cron es la red: el correo sale igual.
    console.error("avisarConfirmacionPendiente:", (e as Error)?.message ?? e);
  }
}

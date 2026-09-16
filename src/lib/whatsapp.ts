// Avisos por WhatsApp: el canal que la gente SÍ lee. La barbería puede mover o
// cancelar una cita desde el calendario y el cliente no se enteraba (el correo
// llega tarde y el push solo existe si instaló la app). Esto no manda nada solo:
// arma el mensaje y abre WhatsApp con todo escrito — un toque del mostrador,
// sin API, sin costo. Si algún día se paga la API de WhatsApp Business, el texto
// ya vive acá y se reusa.

/** Indicativo de Colombia: los teléfonos se guardan como los escribe la gente. */
const PAIS = "57";

/**
 * Teléfono → formato que espera wa.me (solo dígitos, con indicativo).
 * Devuelve null si no parece un número marcable: mejor no ofrecer el botón que
 * abrir un chat vacío con un número inventado.
 */
export function telefonoWhatsApp(telefono: string | null | undefined): string | null {
  const d = (telefono ?? "").replace(/\D/g, "");
  if (!d) return null;
  // Ya viene con indicativo (57 + 10 dígitos) o con el 00/+ delante.
  if (d.length === 12 && d.startsWith(PAIS)) return d;
  if (d.length === 14 && d.startsWith(`00${PAIS}`)) return d.slice(2);
  // Celular colombiano suelto: 10 dígitos empezando en 3.
  if (d.length === 10 && d.startsWith("3")) return PAIS + d;
  // Fijo de Barranquilla con indicativo local (605 + 7): igual es marcable.
  if (d.length === 10) return PAIS + d;
  return null;
}

/** URL de wa.me con el texto ya cargado. null si el teléfono no sirve. */
export function linkWhatsApp(telefono: string | null | undefined, texto: string): string | null {
  const num = telefonoWhatsApp(telefono);
  return num ? `https://wa.me/${num}?text=${encodeURIComponent(texto)}` : null;
}

/** Primer nombre, para que el mensaje no salude "Juan Carlos Pérez Gómez". */
const pila = (nombre: string | null | undefined) => (nombre ?? "").trim().split(/\s+/)[0] || "";

/**
 * "Movimos tu cita". Sin disculpas larguísimas ni promesas: qué pasó, cuándo
 * quedó y la puerta abierta a responder. Lo lee alguien en la calle, en 3 s.
 */
export function mensajeCitaMovida(datos: {
  cliente: string | null;
  cuando: string; // "sáb 16 de ago a las 3:30 pm"
  barbero: string;
  sede: string;
}): string {
  const hola = pila(datos.cliente) ? `Hola ${pila(datos.cliente)}!` : "¡Hola!";
  return [
    `${hola} Te escribimos de Barbas & Bigotes ✂️`,
    "",
    `Tuvimos que mover tu cita: quedó para el ${datos.cuando} con ${datos.barbero} en ${datos.sede}.`,
    "",
    "Si esa hora no te sirve, responde este mensaje y la acomodamos.",
  ].join("\n");
}

/** "Cancelamos tu cita". Cierra con la invitación a reservar de nuevo. */
export function mensajeCitaCancelada(datos: {
  cliente: string | null;
  cuando: string;
  sede: string;
}): string {
  const hola = pila(datos.cliente) ? `Hola ${pila(datos.cliente)}!` : "¡Hola!";
  return [
    `${hola} Te escribimos de Barbas & Bigotes ✂️`,
    "",
    `Tuvimos que cancelar tu cita del ${datos.cuando} en ${datos.sede}. Perdona el inconveniente.`,
    "",
    "Cuando quieras la volvemos a agendar: barbasybigotes.com/reservar o responde por acá.",
  ].join("\n");
}

/**
 * "Te confirmamos tu cita". Es el correo de confirmación, pero por el canal que la
 * gente sí lee — y el que sigue funcionando cuando el buzón está caído.
 *
 * Nació de una caída real: con el correo suspendido, el cliente reservaba por la
 * web y no recibía NADA, y el mostrador no tenía forma de enterarse ni de avisarle.
 */
export function mensajeCitaConfirmada(datos: {
  cliente: string | null;
  cuando: string; // "hoy a las 3:30 pm"
  barbero: string;
  sede: string;
}): string {
  const hola = pila(datos.cliente) ? `Hola ${pila(datos.cliente)}!` : "¡Hola!";
  return [
    `${hola} Te confirmamos tu cita en Barbas & Bigotes ✂️`,
    "",
    `Te esperamos ${datos.cuando}${datos.barbero ? ` con ${datos.barbero}` : ""} en ${datos.sede}.`,
    "",
    "Si te surge algo, responde este mensaje y la movemos.",
  ].join("\n");
}

// Qué dirección se puede guardar para mandarle correo. Puro, sin I/O.
//
// Por qué existe, con nombre y apellido: el 22-ago-2026 Hostinger suspendió el
// buzón `reservas@` por tercera vez. La causa no fue spam — fue "[ESA] Extensive
// Sender Abuse", que su relay (MailChannels) le pone al remitente que acumula
// REBOTES DUROS. Y esos rebotes los generamos nosotros mandando confirmaciones a
// direcciones que no existen:
//
//   · demo-agenda@qa.local        (13-ago) — dato de demo con un dominio inventado
//   · jhon@barbasybigotes.com     (21-jul) — "User doesn't exist"
//   · admin@barbasybigotes.com    (21-ago) — el único buzón del dominio es reservas@
//
// Un puñado de esos y el relay bloquea al remitente; a partir de ahí rebota HASTA
// EL CORREO BUENO, y cada rebote dispara una suspensión nueva. Salió carísimo en
// días de correo caído, así que la dirección se valida ANTES de guardarla.

/**
 * Dominios que no existen ni van a existir: reservados por la RFC 2606 / 6761
 * para pruebas y documentación. Mandar ahí es un rebote duro garantizado.
 */
const DOMINIOS_MUERTOS = ["local", "localhost", "test", "invalid", "example", "internal"];

/** Dominios de ejemplo (sí resuelven, pero nunca aceptan correo real). */
const EJEMPLOS = ["example.com", "example.net", "example.org", "email.com"];

/**
 * Nuestro propio dominio. Un CLIENTE no tiene correo acá: si aparece uno, es un
 * dato de prueba o un tecleo, y rebota porque el buzón no existe.
 */
const DOMINIO_PROPIO = "barbasybigotes.com";

/**
 * Los buzones que SÍ existen en el dominio (los vi en la cuenta de Hostinger).
 * Si el dueño crea otro, sumarlo acá — mandarle a uno que no existe es
 * exactamente lo que originó el bloqueo.
 */
const BUZONES_PROPIOS = ["reservas"];

// Forma mínima de un correo: algo@algo.tld. No pretende ser la RFC 5322 completa
// —eso es una regex ilegible y llena de falsos negativos—; con esto alcanza para
// atajar lo que de verdad rebota.
const FORMA = /^[^@\s,;]+@[^@\s,;]+\.[a-zA-Z]{2,}$/;

/**
 * ¿Se le puede mandar correo a esta dirección sin arriesgar un rebote duro?
 *
 * Rechaza en silencio no es una opción: quien llama decide qué hacer (guardar la
 * ficha sin correo, o avisarle a quien la escribió).
 */
export function esEmailEnviable(email: string | null | undefined): boolean {
  const dir = (email ?? "").trim().toLowerCase();
  if (!FORMA.test(dir)) return false;

  const dominio = dir.slice(dir.lastIndexOf("@") + 1);
  const tld = dominio.slice(dominio.lastIndexOf(".") + 1);
  if (DOMINIOS_MUERTOS.includes(tld)) return false;
  if (EJEMPLOS.includes(dominio)) return false;

  // En el dominio propio, solo los buzones que existen de verdad.
  if (dominio === DOMINIO_PROPIO) {
    return BUZONES_PROPIOS.includes(dir.slice(0, dir.lastIndexOf("@")));
  }
  return true;
}

/** El correo si sirve para mandar, o "" si no. Para guardar sin pensarlo dos veces. */
export const emailGuardable = (email: string | null | undefined): string =>
  esEmailEnviable(email) ? (email ?? "").trim() : "";

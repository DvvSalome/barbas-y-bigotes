// Reglas PURAS de los avisos del dueño y del push con varios dueños (0084/0085).
// Sin I/O: Node las corre directo en scripts/check-avisos.ts. Las usan push.ts,
// avisos-dueno.ts, las server actions y la tarjeta de avisos del celular.

import { esEmailEnviable } from "./email.ts";

/**
 * ¿El error es porque 0085 todavía no está aplicada? Sin la columna `dueno` o sin
 * su índice único, el upsert por (endpoint, dueno) no tiene llave: 42P10 (no hay
 * índice para el ON CONFLICT), 42703 (columna inexistente) o PGRST204 (columna
 * fuera del caché de PostgREST). Cualquier otro rechazo que nombre la columna
 * también, MENOS las violaciones de datos (23xxx): el CHECK push_sub_dueno_unico
 * también dice "dueno" y ese es un error de verdad, no una migración pendiente.
 */
export function sinVariosDuenos(
  error: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  const code = error?.code ?? "";
  if (code === "42P10" || code === "42703" || code === "PGRST204") return true;
  return /\bdueno\b/.test(error?.message ?? "") && !code.startsWith("23");
}

/** La tabla todavía no existe (deploy antes de aplicar la migración): seguir sin ruido. */
export function faltaTabla(error: { code?: string | null } | null | undefined): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

/**
 * El `count` de una consulta HEAD (`{ count: "exact", head: true }`), o null si no
 * se pudo saber. OJO: con la tabla sin crear, el HEAD NO trae error — PostgREST
 * responde 404 sin cuerpo y postgrest-js lo devuelve como `{ error: null, count:
 * null }` (medido contra producción con 0084 sin aplicar). Tomar ese null por 0
 * hacía que el Inicio pidiera «Poner mi correo» antes de que existiera dónde.
 */
export function conteo(res: { error?: unknown; count?: number | null }): number | null {
  return res.error || typeof res.count !== "number" ? null : res.count;
}

/**
 * Tecleos frecuentes en el dominio. Pasan esEmailEnviable (tienen forma de correo)
 * pero rebotan: y el correo del dueño recibe cada cita web, cada cierre y cada
 * alerta, así que un dominio mal escrito son varios rebotes duros AL DÍA desde
 * reservas@, que ya fue suspendido tres veces por rebotes.
 */
const TIPEOS: Record<string, string> = {
  // Gmail
  "gmial.com": "gmail.com", "gmal.com": "gmail.com", "gamil.com": "gmail.com", "gmaill.com": "gmail.com",
  "gmali.com": "gmail.com", "gnail.com": "gmail.com", "gmai.com": "gmail.com", "gmil.com": "gmail.com",
  "gmeil.com": "gmail.com", "gmaik.com": "gmail.com", "gmail.co": "gmail.com", "gmail.cm": "gmail.com",
  "gmail.om": "gmail.com",
  // Hotmail / Outlook / Live
  "hotmial.com": "hotmail.com", "hotmal.com": "hotmail.com", "hotmai.com": "hotmail.com", "hotmil.com": "hotmail.com",
  "hotmaill.com": "hotmail.com", "homail.com": "hotmail.com", "hormail.com": "hotmail.com", "hotamil.com": "hotmail.com",
  "hitmail.com": "hotmail.com", "hotmail.co": "hotmail.com", "hotmail.cm": "hotmail.com", "hotmail.om": "hotmail.com",
  "outlok.com": "outlook.com", "outllok.com": "outlook.com", "otlook.com": "outlook.com", "oulook.com": "outlook.com",
  "outloo.com": "outlook.com", "outlook.co": "outlook.com", "outlook.cm": "outlook.com",
  // Yahoo / iCloud
  "yaho.com": "yahoo.com", "yahooo.com": "yahoo.com", "yhoo.com": "yahoo.com", "yaoo.com": "yahoo.com",
  "yahoo.co": "yahoo.com", "yahoo.cm": "yahoo.com",
  "iclod.com": "icloud.com", "iclud.com": "icloud.com", "icloud.co": "icloud.com",
};

/** Terminaciones que no existen y son ".com" mal tecleado. */
const TLD_MAL = /\.(con|cmo|cpm|vom|xom|comm|coom|ocm|cim)$/;

/**
 * Si el dominio es un tecleo conocido, el correo como seguramente quiso escribirlo;
 * si no, null. "carlos@gmail.con" → "carlos@gmail.com".
 */
export function correoCorregido(email: string): string | null {
  const dir = email.trim().toLowerCase();
  const at = dir.lastIndexOf("@");
  if (at < 1) return null;
  const usuario = dir.slice(0, at);
  let dominio = dir.slice(at + 1);
  let cambio = false;
  if (TLD_MAL.test(dominio)) {
    dominio = dominio.replace(TLD_MAL, ".com");
    cambio = true;
  }
  if (TIPEOS[dominio]) {
    dominio = TIPEOS[dominio];
    cambio = true;
  }
  return cambio ? `${usuario}@${dominio}` : null;
}

/**
 * El correo que escribe el dueño para sus avisos, limpio, o el motivo por el que
 * no sirve (en sus palabras). Misma barrera que el resto (esEmailEnviable) y,
 * además, los tecleos frecuentes del dominio: los rebotes ya suspendieron el
 * buzón de reservas@ tres veces.
 */
export function correoDelDueno(email: string | null | undefined): { ok: true; email: string } | { ok: false; error: string } {
  const limpio = (email ?? "").trim().toLowerCase().slice(0, 120);
  if (!limpio) return { ok: false, error: "Escribe el correo." };
  // El dominio propio solo tiene el buzón de reservas: dueno@ o admin@ rebotan.
  if (limpio.endsWith("@barbasybigotes.com") && !esEmailEnviable(limpio))
    return { ok: false, error: "Ese buzón no existe en barbasybigotes.com. Usa tu correo personal (Gmail, Outlook…)." };
  if (!esEmailEnviable(limpio)) return { ok: false, error: "Ese correo no parece real. Revisa cómo está escrito." };
  const sugerido = correoCorregido(limpio);
  if (sugerido) return { ok: false, error: `¿Quisiste decir ${sugerido}? Revisa cómo está escrito y vuelve a intentarlo.` };
  return { ok: true, email: limpio };
}

/**
 * A quién más le avisa un aparato, en castellano corrido:
 * ["el mostrador de Plaza de la Paz", "Carlos"] → "al mostrador de Plaza de la Paz y a Carlos".
 */
export function aQuien(nombres: string[]): string {
  const con = nombres.filter(Boolean).map((n) => (n.startsWith("el ") ? `al ${n.slice(3)}` : `a ${n}`));
  if (con.length <= 1) return con[0] ?? "";
  return `${con.slice(0, -1).join(", ")} y ${con[con.length - 1]}`;
}

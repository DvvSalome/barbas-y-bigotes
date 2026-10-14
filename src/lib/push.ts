// Emisor de web push (SOLO SERVIDOR: usa la VAPID key privada y service role).
// Módulo plano (sin "use server"): lo importan server actions y route handlers.
//
// Contrato: pushACliente es fire-and-forget pero los callers deben hacerle
// `await` (en serverless, una promesa suelta la mata Vercel al responder).
// El try/catch vive acá adentro — JAMÁS lanza: una notificación fallida no
// puede tumbar una reserva.

import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/server";
import { errorPublico } from "@/lib/errors";
import { sinVariosDuenos } from "@/lib/avisos-reglas";

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

// Resumen honesto de un intento de envío. Sirve para que /api/push (y el cron
// de n8n detrás) sepan si REALMENTE se mandó algo y no den por hecho un 200:
//   · configurado — había llaves VAPID válidas (si no, el push está apagado).
//   · enviadas / fallidas — cuántas suscripciones aceptaron/rechazaron el push.
//   · muertas — suscripciones 404/410 que se borraron (subconjunto de fallidas).
export type PushResumen = {
  configurado: boolean;
  enviadas: number;
  fallidas: number;
  muertas: number;
};

// null = todavía no se intentó configurar; true = listo; false = sin llaves (no-op).
let vapidListo: boolean | null = null;

// Configura web-push desde el env la primera vez. Si falta alguna llave, avisa
// UNA vez y deja el push apagado (dev safety: nunca romper el flujo que llama).
function configurarVapid(): boolean {
  if (vapidListo !== null) return vapidListo;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    console.warn(
      "[push] VAPID sin configurar (VAPID_SUBJECT / NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY): push deshabilitado",
    );
    vapidListo = false;
    return false;
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidListo = true;
  } catch (e) {
    console.warn("[push] llaves VAPID inválidas: push deshabilitado", e);
    vapidListo = false;
  }
  return vapidListo;
}

// Notifica a TODAS las suscripciones del cliente (un cliente puede tener el
// celular y el compu suscritos). Las suscripciones muertas (404/410: el
// navegador las revocó) se borran de la tabla como housekeeping.
export async function pushACliente(clienteRef: string, payload: PushPayload): Promise<PushResumen> {
  return enviar({ columna: "cliente_ref", id: clienteRef }, payload);
}

/**
 * Al BARBERO (migración 0047), mientras existan los logins por barbero. Cuando
 * se retiren en favor del perfil por sede, esta función queda sin llamadas.
 */
export async function pushABarbero(barberoId: string, payload: PushPayload): Promise<PushResumen> {
  return enviar({ columna: "barbero_id", id: barberoId }, payload);
}

/**
 * A la SEDE: el aparato del mostrador. Es el destinatario que importa —el modelo
 * del producto es un perfil por sede operando una pantalla compartida—, así que
 * el aviso suena en el local sin depender de quién esté parado enfrente.
 */
export async function pushASede(sedeId: string, payload: PushPayload): Promise<PushResumen> {
  return enviar({ columna: "sede_id", id: sedeId }, payload);
}

/**
 * Al DUEÑO: todos los aparatos de los admins (0083). No tienen sede ni ficha de
 * barbero, así que su suscripción va atada a su usuario y les llega todo.
 */
export async function pushAAdmins(payload: PushPayload): Promise<PushResumen> {
  return enviar({ columna: "admin_auth", id: null }, payload);
}

/**
 * Los usuarios de Auth que hoy tienen rol admin (null si no se pudo leer). Lo usan
 * pushAAdmins y la puesta a punto del Inicio: un aparato de alguien que dejó de
 * ser admin no cuenta como "aparato del dueño".
 */
export async function authIdsDeAdmins(): Promise<string[] | null> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("profiles")
      .select("auth_id")
      .eq("rol", "admin")
      .not("auth_id", "is", null);
    if (error) {
      errorPublico("authIdsDeAdmins", error);
      return null;
    }
    return ((data ?? []) as { auth_id: string }[]).map((p) => p.auth_id);
  } catch (e) {
    console.error("[authIdsDeAdmins]", e);
    return null;
  }
}

async function enviar(
  // id null = todas las suscripciones de esa columna (los admins).
  destino: { columna: "cliente_ref" | "barbero_id" | "sede_id" | "admin_auth"; id: string | null },
  payload: PushPayload,
): Promise<PushResumen> {
  const configurado = configurarVapid();
  // Estado base: nada enviado. Se devuelve tal cual si el push está apagado,
  // no hay destinatario o no hay suscripciones — así el caller distingue "no se
  // mandó" de "se mandó bien" en vez de asumir un 200.
  const resumen: PushResumen = { configurado, enviadas: 0, fallidas: 0, muertas: 0 };
  try {
    if ((!destino.id && destino.columna !== "admin_auth") || !configurado) return resumen;

    const sb = supabaseAdmin();
    let consulta = sb
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth")
      .filter(destino.columna, destino.id ? "eq" : "not.is", destino.id ?? "null");
    // A los admins: solo a los que HOY son admin. La fila queda atada al usuario
    // de Auth, y bajarle el rol en profiles no la borra: sin este filtro, al que
    // ya no es admin le seguirían llegando los cierres con faltante y las
    // calificaciones bajas con el comentario del cliente.
    if (destino.columna === "admin_auth" && !destino.id) {
      const ids = await authIdsDeAdmins();
      if (!ids?.length) return resumen;
      consulta = consulta.in("admin_auth", ids);
    }
    const { data, error } = await consulta;
    if (error) {
      errorPublico("pushACliente select", error);
      return resumen;
    }
    // Desde 0085 un aparato puede estar suscrito para varios dueños a la vez (la
    // tableta del mostrador = la sede + el dueño). Dentro de UN envío cada
    // aparato recibe un solo push aunque tenga varias filas; entre envíos a
    // distintos dueños (sede, barbero, admins) lo junta el `tag`: la
    // notificación con el mismo tag reemplaza a la anterior (worker/index.js).
    const vistos = new Set<string>();
    const subs = ((data ?? []) as { endpoint: string; p256dh: string; auth: string }[]).filter((s) => {
      if (vistos.has(s.endpoint)) return false;
      vistos.add(s.endpoint);
      return true;
    });
    if (!subs.length) return resumen;

    const cuerpo = JSON.stringify(payload);
    const resultados = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          cuerpo,
        ),
      ),
    );

    const muertas: string[] = [];
    resultados.forEach((r, i) => {
      if (r.status !== "rejected") {
        resumen.enviadas++;
        return;
      }
      resumen.fallidas++;
      const status = (r.reason as { statusCode?: number } | null)?.statusCode;
      if (status === 404 || status === 410) muertas.push(subs[i].endpoint);
      else console.error(`[pushACliente] fallo enviando a ${subs[i].endpoint}:`, r.reason);
    });
    resumen.muertas = muertas.length;
    if (muertas.length) {
      const { error: delErr } = await sb
        .from("push_subscriptions")
        .delete()
        .in("endpoint", muertas);
      if (delErr) errorPublico("pushACliente delete", delErr);
    }
  } catch (e) {
    // Red de seguridad final: acá no se lanza nada, pase lo que pase.
    console.error("[pushACliente]", e);
  }
  return resumen;
}

// ---------- Guardar una suscripción (0085: varios dueños por aparato) ----------

/** El dueño de una suscripción: exactamente uno (CHECK push_sub_dueno_unico). */
export type DuenoPush =
  | { tipo: "cliente"; id: string }
  | { tipo: "barbero"; id: string }
  | { tipo: "sede"; id: string }
  | { tipo: "admin"; id: string };

const COLUMNA_DUENO = {
  cliente: "cliente_ref",
  barbero: "barbero_id",
  sede: "sede_id",
  admin: "admin_auth",
} as const;

/** Un endpoint de push real: https y de largo razonable (los de FCM/Mozilla/Apple rondan 200). */
export const endpointValido = (e: unknown): e is string =>
  typeof e === "string" && e.startsWith("https://") && e.length <= 1000;

/** Las llaves del aparato: base64url cortas (p256dh ~87, auth ~22). */
const llaveValida = (k: unknown): k is string => typeof k === "string" && k.length > 0 && k.length <= 200;

/**
 * Guarda la suscripción de ESTE dueño sin quitarle el aparato a los demás.
 *
 *   1. Un aparato es de UN solo cliente: se borra la fila de cualquier OTRO
 *      cliente en ese endpoint (equipo compartido: si no, el anterior seguiría
 *      recibiendo sus avisos acá). Si quien guarda es del equipo, se borra
 *      también la de cualquier cliente: los avisos personales de un cliente no se
 *      quedan sonando en un aparato del local.
 *   2. Upsert por (endpoint, dueno): agrega o refresca la fila de este dueño y
 *      deja intactas las de la sede, el barbero o el admin que ya estaban.
 *      Sin 0085 vuelve al upsert por endpoint de siempre (una fila por aparato).
 *
 * Las llaves (p256dh/auth) se escriben SOLO en la fila de este dueño. Un mismo
 * endpoint no cambia de llaves (re-suscribirse da otro endpoint), así que no hay
 * nada que sincronizar en las filas ajenas; escribirlas le permitía a cualquiera
 * que conociera el endpoint dañarle los avisos al mostrador o al dueño.
 */
export async function guardarSuscripcion(
  dueno: DuenoPush,
  sub: { endpoint: string; p256dh: string; auth: string },
): Promise<{ ok: true } | { ok: false; error: { code?: string; message?: string } }> {
  if (!endpointValido(sub?.endpoint) || !llaveValida(sub?.p256dh) || !llaveValida(sub?.auth)) {
    return { ok: false, error: { code: "suscripcion_invalida", message: "Suscripción inválida" } };
  }
  try {
    const sb = supabaseAdmin();
    const fila: Record<string, string | null> = {
      cliente_ref: null,
      barbero_id: null,
      sede_id: null,
      admin_auth: null,
      [COLUMNA_DUENO[dueno.tipo]]: dueno.id,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
    };

    let borrar = sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint).not("cliente_ref", "is", null);
    if (dueno.tipo === "cliente") borrar = borrar.neq("cliente_ref", dueno.id);
    const { error: errBorrar } = await borrar;
    if (errBorrar) return { ok: false, error: errBorrar };

    let { error } = await sb.from("push_subscriptions").upsert(fila, { onConflict: "endpoint,dueno" });
    // Sin 0085 (sin columna `dueno` o sin su índice): el upsert de siempre.
    if (error && sinVariosDuenos(error)) {
      ({ error } = await sb.from("push_subscriptions").upsert(fila, { onConflict: "endpoint" }));
    }
    if (error) return { ok: false, error };
    return { ok: true };
  } catch (e) {
    console.error("[guardarSuscripcion]", e);
    return { ok: false, error: { message: String(e) } };
  }
}

/**
 * Quita a ESTE dueño de un aparato, sin tocar a los demás que lo comparten.
 * Lo usan «Desactivar en este aparato» y el cierre de sesión del equipo: desde
 * 0085 nadie re-vincula la fila al activar, así que sin esto un aparato prestado
 * (la tableta del local, el celular de un barbero que se fue) se quedaba para
 * siempre con los avisos de otro. Nunca lanza.
 */
export async function soltarAparato(dueno: DuenoPush, endpoint: string): Promise<boolean> {
  if (!endpointValido(endpoint)) return false;
  try {
    const { error } = await supabaseAdmin()
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint)
      .eq(COLUMNA_DUENO[dueno.tipo], dueno.id);
    if (error) {
      errorPublico("soltarAparato", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[soltarAparato]", e);
    return false;
  }
}

export type FilaAparato = {
  cliente_ref: string | null;
  barbero_id: string | null;
  sede_id: string | null;
  admin_auth: string | null;
};

/**
 * Las filas de un aparato: a quién le avisa hoy (sin llaves, solo los dueños).
 * `varios` = 0085 está aplicada: activar AGREGA una fila. Sin ella, activar
 * re-vincula la única fila del aparato y se la QUITA al que la tenía.
 */
export async function duenosDelAparato(endpoint: string): Promise<{ filas: FilaAparato[]; varios: boolean } | null> {
  try {
    const sb = supabaseAdmin();
    let varios = true;
    // Pedir `dueno` es la forma de saber si 0085 está: sin la columna, 42703.
    let res: { data: unknown[] | null; error: { code?: string; message?: string } | null } = await sb
      .from("push_subscriptions")
      .select("cliente_ref,barbero_id,sede_id,admin_auth,dueno")
      .eq("endpoint", endpoint);
    if (res.error && sinVariosDuenos(res.error)) {
      varios = false;
      res = await sb
        .from("push_subscriptions")
        .select("cliente_ref,barbero_id,sede_id,admin_auth")
        .eq("endpoint", endpoint);
    }
    if (res.error) {
      errorPublico("duenosDelAparato", res.error);
      return null;
    }
    const filas = ((res.data ?? []) as FilaAparato[]).map((f) => ({
      cliente_ref: f.cliente_ref,
      barbero_id: f.barbero_id,
      sede_id: f.sede_id,
      admin_auth: f.admin_auth,
    }));
    return { filas, varios };
  } catch (e) {
    console.error("[duenosDelAparato]", e);
    return null;
  }
}

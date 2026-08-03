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

async function enviar(
  destino: { columna: "cliente_ref" | "barbero_id" | "sede_id"; id: string },
  payload: PushPayload,
): Promise<PushResumen> {
  const configurado = configurarVapid();
  // Estado base: nada enviado. Se devuelve tal cual si el push está apagado,
  // no hay destinatario o no hay suscripciones — así el caller distingue "no se
  // mandó" de "se mandó bien" en vez de asumir un 200.
  const resumen: PushResumen = { configurado, enviadas: 0, fallidas: 0, muertas: 0 };
  try {
    if (!destino.id || !configurado) return resumen;

    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth")
      .eq(destino.columna, destino.id);
    if (error) {
      errorPublico("pushACliente select", error);
      return resumen;
    }
    const subs = (data ?? []) as { endpoint: string; p256dh: string; auth: string }[];
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

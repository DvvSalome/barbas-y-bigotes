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
export async function pushACliente(clienteRef: string, payload: PushPayload): Promise<void> {
  try {
    if (!clienteRef || !configurarVapid()) return;

    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth")
      .eq("cliente_ref", clienteRef);
    if (error) {
      errorPublico("pushACliente select", error);
      return;
    }
    const subs = (data ?? []) as { endpoint: string; p256dh: string; auth: string }[];
    if (!subs.length) return;

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
      if (r.status !== "rejected") return;
      const status = (r.reason as { statusCode?: number } | null)?.statusCode;
      if (status === 404 || status === 410) muertas.push(subs[i].endpoint);
      else console.error(`[pushACliente] fallo enviando a ${subs[i].endpoint}:`, r.reason);
    });
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
}

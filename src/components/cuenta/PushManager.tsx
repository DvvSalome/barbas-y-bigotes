"use client";

import { useEffect, useState } from "react";
import { savePushSubscription } from "@/lib/cliente-actions";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ¿La suscripción existente fue creada con la VAPID key vigente? Si la key
// rotó (2026-07-05), la suscripción vieja firma contra otra llave y el push
// jamás llega: hay que tirarla y re-suscribir.
function conKeyVigente(sub: PushSubscription, keyActual: Uint8Array): boolean {
  const k = sub.options?.applicationServerKey;
  if (!k) return false;
  const bytes = new Uint8Array(k);
  if (bytes.length !== keyActual.length) return false;
  for (let i = 0; i < bytes.length; i++) if (bytes[i] !== keyActual[i]) return false;
  return true;
}

// Registro del SW sin colgarse: getRegistration() responde al instante; si el
// SW todavía se está instalando (primer load) se espera .ready pero con techo
// de ~5s, porque en dev next-pwa está deshabilitado y .ready no resuelve jamás.
async function obtenerSW(ms = 5000): Promise<ServiceWorkerRegistration | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  if (reg?.active) return reg;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

// Estados del card: cargando (nada aún), sin soporte (se oculta), iOS sin
// instalar (instrucciones), sin SW (hint de producción) o listo (botón).
type Estado = "cargando" | "sin-soporte" | "ios-instalar" | "sin-sw" | "listo";

export function PushManager() {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      // iOS solo entrega push a la PWA instalada (16.4+): si abrieron el
      // portal en Safari a pelo, en vez de ocultar el card se explica cómo.
      // iPadOS 13+ se reporta como "Macintosh": lo delata el touch.
      const ua = window.navigator.userAgent;
      const esIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
      const standalone = (window.navigator as { standalone?: boolean }).standalone === true;
      if (esIOS && !standalone) {
        if (vivo) setEstado("ios-instalar");
        return;
      }
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (vivo) setEstado("sin-soporte");
        return;
      }
      try {
        const registration = await obtenerSW();
        if (!vivo) return;
        if (!registration) {
          setEstado("sin-sw");
          return;
        }
        const subscription = await registration.pushManager.getSubscription();
        if (!vivo) return;
        // Una suscripción con la key rotada cuenta como NO suscrito: así el
        // card reaparece y el botón la reemplaza por una válida.
        const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        const vigente =
          !!subscription && !!publicVapidKey &&
          conKeyVigente(subscription, urlBase64ToUint8Array(publicVapidKey));
        setIsSubscribed(vigente);
        setEstado("listo");
      } catch (e) {
        console.error(e);
        if (vivo) setEstado("sin-sw");
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  async function subscribeToPush() {
    setErr(null);
    try {
      setLoading(true);
      const registration = await obtenerSW();
      if (!registration) {
        setEstado("sin-sw");
        return;
      }

      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicVapidKey) {
        throw new Error("Missing VAPID public key");
      }
      const keyActual = urlBase64ToUint8Array(publicVapidKey);

      // Rotación de key: si hay una suscripción vieja con otra
      // applicationServerKey, se elimina y se re-suscribe con la vigente.
      let subscription = await registration.pushManager.getSubscription();
      if (subscription && !conKeyVigente(subscription, keyActual)) {
        await subscription.unsubscribe();
        subscription = null;
      }
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyActual,
        });
      }

      const subJSON = subscription.toJSON();
      if (!subJSON.endpoint || !subJSON.keys) {
        throw new Error("Invalid subscription object");
      }

      const res = await savePushSubscription({
        endpoint: subJSON.endpoint,
        keys: {
          p256dh: subJSON.keys.p256dh!,
          auth: subJSON.keys.auth!,
        }
      });

      if (res.ok) {
        setIsSubscribed(true);
      } else {
        console.error(res.error);
        setErr(res.error || "No se pudo activar. Intenta de nuevo.");
      }
    } catch (error) {
      console.error("Error subscribing to push:", error);
      setErr("Hubo un error al activar las notificaciones. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  // "sin-sw" = no hay service worker (desarrollo, o el navegador lo bloqueó).
  // Antes se dibujaba igual y le decía al CLIENTE "Disponible en la versión
  // instalada/producción", que es una frase de programador sobre algo que el
  // cliente no puede hacer. Si no se puede activar, no se anuncia.
  if (estado === "cargando" || estado === "sin-soporte" || estado === "sin-sw" || isSubscribed) return null;

  return (
    // Borde de línea y no rojo: en esta app el rojo es acción o alerta, y esto
    // no es ninguna de las dos. Es una oferta, y además ya no va arriba de todo.
    <div className="rounded-2xl border border-line bg-panel p-4 text-center">
      <h3 className="font-display text-base font-bold uppercase tracking-wide">Avisos al celular</h3>
      {estado === "ios-instalar" ? (
        <p className="mt-2 text-sm text-muted">
          Para recibir avisos en tu iPhone: toca Compartir → Agregar a pantalla de inicio y
          abre la app desde ahí.
        </p>
      ) : (
        <>
          <p className="mt-2 text-[13px] leading-snug text-muted">
            Te avisamos cuando sea tu turno o cuando se confirme tu cita.
          </p>
          <button
            onClick={subscribeToPush}
            disabled={loading}
            className="mt-3.5 inline-flex min-h-11 items-center rounded-full bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] px-6 text-sm font-semibold uppercase tracking-wide text-on-accent transition hover:brightness-105 disabled:opacity-50"
          >
            {loading ? "Activando..." : "Activar notificaciones"}
          </button>
          {/* El fallo se dice ACÁ, debajo del botón que se acaba de tocar. Antes
              era un alert() del navegador: tapaba la página, no se podía copiar y
              al cerrarlo no quedaba rastro de qué había pasado. */}
          {err && <p className="mt-3 text-sm text-warn">{err}</p>}
        </>
      )}
    </div>
  );
}

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

export function PushManager() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      checkSubscription();
    }
  }, []);

  async function checkSubscription() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (e) {
      console.error(e);
    }
  }

  async function subscribeToPush() {
    try {
      setLoading(true);
      const registration = await navigator.serviceWorker.ready;

      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicVapidKey) {
        throw new Error("Missing VAPID public key");
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
      });

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
        alert(res.error || "No se pudo suscribir.");
      }
    } catch (error) {
      console.error("Error subscribing to push:", error);
      alert("Hubo un error al activar las notificaciones. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (!isSupported || isSubscribed) return null;

  return (
    <div className="mb-8 rounded-2xl border border-accent/40 bg-accent/5 p-5 text-center">
      <h3 className="font-display text-xl uppercase">Notificaciones</h3>
      <p className="mt-2 text-sm text-muted">
        Activa las notificaciones para avisarte cuando sea tu turno o tu cita se confirme.
      </p>
      <button
        onClick={subscribeToPush}
        disabled={loading}
        className="mt-4 rounded-full bg-accent px-6 py-2 text-sm font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-50"
      >
        {loading ? "Activando..." : "Activar notificaciones"}
      </button>
    </div>
  );
}

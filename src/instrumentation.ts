import type { Instrumentation } from "next";

// Red de seguridad de timezone: Vercel corre en UTC y `TZ` es una env reservada
// que no se puede setear desde el dashboard, así que fijamos el timezone del
// proceso por código. El negocio vive en Bogotá (UTC-5, sin DST). Los cálculos
// críticos igual usan bogotaDayRange() (src/lib/slots.ts) y no dependen de esto.
export async function register() {
  process.env.TZ = "America/Bogota";

  // Sentry solo del lado del servidor. Sin DSN no arranca: así el proyecto corre
  // igual en local y en cualquier deploy que no tenga la variable, sin ramas.
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.VERCEL_ENV ?? "development",
      // Solo errores. El tracing de performance multiplica los eventos y acá la
      // pregunta es "¿se le rompió a alguien?", no "¿cuántos ms tardó?".
      tracesSampleRate: 0,
      // Datos del cliente (nombre, teléfono, email) no salen del servidor propio.
      sendDefaultPii: false,
    });
  }
}

// Errores de server components, server actions y route handlers.
export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};

import * as Sentry from "@sentry/nextjs";

// Errores en el celular del cliente: lo que el CI no puede ver (navegador viejo,
// red que se corta a mitad de la reserva, un dato inesperado de la API).
//
// El público es Android de gama media en Barranquilla, así que acá lo que se
// deja AFUERA importa tanto como lo que entra:
//   · Session Replay  — graba la pantalla, ~35 kB y sube video. No.
//   · Performance/tracing — otra tanda de kB para responder algo que no se preguntó.
// Queda el capturador de errores pelado, que es el 100% del valor a este volumen.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    tracesSampleRate: 0,
    // Nombre, teléfono y correo del cliente NO se mandan a un tercero.
    sendDefaultPii: false,
    // Ruido que no es de la app y que en móvil de gama baja abunda: extensiones
    // del navegador, scripts de terceros y el "error" de red de un túnel que se
    // cae. Si esto llega a Sentry, el aviso que sí importa queda enterrado.
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection captured",
      /^Failed to fetch$/,
      /^NetworkError/,
      /^Load failed$/,
      /chrome-extension:/,
      /moz-extension:/,
    ],
    beforeSend(evento) {
      // El service worker de la PWA reintenta solo; sus fallos de red no son bugs.
      if (evento.exception?.values?.some((v) => v.value?.includes("workbox"))) return null;
      return evento;
    },
  });
}

// Necesario para que Sentry ate un error a la navegación que lo produjo.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

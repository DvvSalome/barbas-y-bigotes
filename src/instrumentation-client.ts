import * as Sentry from "@sentry/nextjs";
import { esRuidoDeExtension } from "@/lib/sentry-filtro";

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
    // del navegador y scripts de terceros. Si esto llega a Sentry, el aviso que
    // sí importa queda enterrado.
    // OJO: los errores de red ("Failed to fetch" / "NetworkError" / "Load
    // failed") NO se filtran acá por mensaje — un ignoreErrors global se tragaría
    // también un OUTAGE de NUESTRA API visto desde el navegador, que es
    // justamente lo que queremos ver. Ese caso se afina en beforeSend según de
    // dónde salió la petición (ver `esErrorDeRed` + `tocaNuestroCodigo`).
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection captured",
      /chrome-extension:/,
      /moz-extension:/,
    ],
    beforeSend(evento) {
      // El service worker de la PWA reintenta solo; sus fallos de red no son bugs.
      if (evento.exception?.values?.some((v) => v.value?.includes("workbox"))) return null;

      // Errores de EXTENSIONES del navegador. ignoreErrors solo mira el mensaje,
      // y estos suelen traer uno perfectamente normal ("Cannot read properties
      // of undefined") con la extensión escondida en el stack. Caso real
      // (2026-07-27): un `ext:core/01_core.js` reventó leyendo
      // `registration.waiting` en la home; se verificó en un navegador limpio
      // que el sitio NO lanza ese error por su cuenta.
      // Si hay una extensión en la pila, no hay nada que podamos arreglar, y
      // dejarlo pasar entierra los avisos que sí importan.
      const frames = (evento.exception?.values ?? []).flatMap((v) => v.stacktrace?.frames ?? []);
      if (esRuidoDeExtension(frames.map((f) => f.filename ?? f.abs_path))) return null;

      // Errores de RED. En vez de tragárselos todos por mensaje (lo que ocultaba
      // un outage propio de la API), se descarta solo el ruido de terceros: un
      // fetch que falló SIN pasar por nuestro bundle no es algo que podamos
      // arreglar. Si la pila toca nuestro código (`/_next/` o nuestro origen),
      // puede ser la API caída vista desde el celular → tiene que llegar.
      const RED_RE = /^(Failed to fetch|NetworkError|Load failed)/;
      const esErrorDeRed = (evento.exception?.values ?? []).some((v) => RED_RE.test(v.value ?? ""));
      if (esErrorDeRed) {
        const origen = typeof location !== "undefined" ? location.origin : "";
        const tocaNuestroCodigo = frames.some((f) => {
          const fn = f.filename ?? f.abs_path ?? "";
          return fn.includes("/_next/") || (origen !== "" && fn.startsWith(origen));
        });
        if (!tocaNuestroCodigo) return null;
      }

      return evento;
    },
  });
}

// Necesario para que Sentry ate un error a la navegación que lo produjo.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

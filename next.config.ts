import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Por defecto Next corta el body de un server action en 1MB y devuelve un
      // 500 CRUDO antes de que corra ninguna validación nuestra: la foto moría
      // sin llegar al mensaje de "máximo 2MB". El cliente ya achica la imagen
      // antes de subir (imagen-cliente.ts), así que esto es solo la red por si
      // esa compresión no corre (navegador viejo, formato que canvas no decodifica).
      bodySizeLimit: "3mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "wvmdsxznujklgfezqtfy.supabase.co" },
    ],
    // Next 16 solo permite las calidades listadas (antes, cualquiera). El 70
    // es para fotos que van con degradado oscuro encima (tarjetas de Sedes).
    qualities: [70, 75],
  },
  // El .xlsx de marca lee `public/brand/logo-lockup.jpg` en tiempo de ejecución
  // y el trazador de Next no ve un `path.join` armado en código: sin esto el
  // archivo no viaja al bundle de la función en Vercel y el reporte sale sin
  // logo (el módulo lo tolera, pero la gracia era el logo).
  outputFileTracingIncludes: {
    "/admin/*/xlsx": ["public/brand/logo-lockup.jpg"],
  },
  // Permite probar el dev server desde el celular u otro dispositivo en la
  // misma red Wi-Fi (sin esto, Next bloquea el HMR por origen cruzado).
  allowedDevOrigins: ["192.168.40.12"],
  // Hardening basico (hallazgo de la auditoria GEO: solo HSTS presente).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // CSP. NO es la estricta con nonce: App Router mete scripts inline
          // (hidratación, streaming) y firmarlos exige middleware en TODAS las
          // rutas — hoy `proxy.ts` solo corre en las privadas y ampliarlo mete
          // latencia en cada visita pública. Lo que sí cierra esta versión es lo
          // que un XSS necesita para hacer daño de verdad:
          //  · connect-src — a dónde puede MANDAR datos (robar una sesión pasa
          //    por acá). El propio sitio, Supabase y Sentry… y el CDN
          //    de fotos de Google, que NO está acá por gusto: el service
          //    worker de la PWA intercepta TODO lo cross-origin y lo vuelve a
          //    pedir con fetch(), y un fetch() dentro del worker se rige por
          //    connect-src, no por img-src. Sin esta entrada el avatar de quien
          //    entra con Google carga en la primera visita y se rompe en todas
          //    las siguientes (medido en producción: sin SW 96x96, con SW onerror).
          //  · form-action — a dónde puede enviarse un formulario.
          //  · base-uri — evita que inyecten <base> y reescriban todas las URL.
          //  · object-src — nada de Flash/embed heredado.
          //  · frame-ancestors — anti clickjacking (reemplaza a X-Frame-Options
          //    en navegadores modernos; se deja el viejo por compatibilidad).
          // Al subir a nonce, quitar 'unsafe-inline' de script-src.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://wvmdsxznujklgfezqtfy.supabase.co https://lh3.googleusercontent.com",
              "font-src 'self' data:",
              "media-src 'self' blob:",
              "connect-src 'self' https://wvmdsxznujklgfezqtfy.supabase.co wss://wvmdsxznujklgfezqtfy.supabase.co https://lh3.googleusercontent.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io",
              "worker-src 'self' blob:",
              "manifest-src 'self'",
              // El mapa de la sección Ubicación es un embed de Google Maps.
              "frame-src 'self' https://www.google.com https://maps.google.com",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  // No precachear la media pesada del hero/scroll 3D: son ~10MB (hero.mp4 +
  // ~180 frames webp + scene.js) que ninguna página viva referencia, y sin
  // esto @ducanh2912/next-pwa se los traga en la PRIMERA visita — medio disco
  // de datos móviles a un Android de gama media que nunca los ve. Cada patrón
  // lleva "!" (exclusión); se conserva el noprecache/ por defecto del plugin.
  publicExcludes: ["!noprecache/**/*", "!video/**", "!scroll/**", "!scene.js"],
  // Sin conexión y ruta no cacheada → página offline con marca.
  fallbacks: {
    document: "/~offline",
  },
  // El service worker deja de meterse con lo CROSS-ORIGIN. La regla que trae
  // next-pwa por defecto engancha TODO lo de otro dominio y lo vuelve a pedir con
  // fetch() desde dentro del worker — y un fetch() ahí se rige por `connect-src`,
  // no por `img-src`. Resultado: la foto de perfil de Google (único recurso
  // cross-origin de la app) salía rota, porque su dominio estaba en img-src y no
  // en connect-src. Se puede tapar listando el dominio en connect-src —y se hizo—
  // pero eso deja la trampa armada para el próximo dominio que alguien agregue a
  // img-src, y encima la CSP con la que el worker hace fetch queda GRABADA cuando
  // se instala: un navegador que ya tenía el worker viejo sigue roto aunque la
  // cabecera del servidor ya esté corregida. Sin regla que enganche, la imagen la
  // pide el navegador y manda img-src, como con cualquier <img> normal.
  // Se pierde tener la foto en caché una hora para uso sin conexión: nada.
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        // Nunca engancha a propósito. Está solo para DESPLAZAR la regla
        // "cross-origin" de fábrica: al mezclar, next-pwa descarta la suya
        // cuando el cacheName coincide con uno propio.
        urlPattern: () => false,
        handler: "NetworkOnly",
        options: { cacheName: "cross-origin" },
      },
    ],
  },
});

// Sentry va por FUERA del wrapper de PWA: necesita ver el bundle final para
// subir los source maps. Sin eso, un error en producción llega como
// "a.b is not a function" en un chunk minificado, o sea inservible.
export default withSentryConfig(withPWA(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Sin token no se suben los source maps, pero el build NO falla: el CI de
  // GitHub y cualquier clon del repo compilan igual sin tener el secreto.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Se suben y se borran del bundle público: el código fuente de la app no
  // queda servido en el sitio para cualquiera que abra devtools.
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  // Túnel propio para que los bloqueadores de anuncios no se coman los reportes
  // (en móvil son comunes, y un error que no llega es un error que no existe).
  tunnelRoute: "/monitoring",
  // Poner tracesSampleRate en 0 APAGA el tracing pero deja todo su código en el
  // bundle: medido, el SDK entero costaba +137 kB gzip y con esto baja a +66.
  // El público es Android de gama media en Barranquilla; 137 kB de JS que no se
  // usa es medio segundo de pantalla en blanco.
  // (Reemplaza a bundleSizeOptimizations/disableLogger, deprecados en v10.)
  webpack: {
    treeshake: {
      removeDebugLogging: true,
      removeTracing: true,
      excludeReplayIframe: true,
      excludeReplayShadowDOM: true,
      excludeReplayCompressionWorker: true,
    },
  },
});

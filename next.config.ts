import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "wvmdsxznujklgfezqtfy.supabase.co" },
    ],
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
  // Sin conexión y ruta no cacheada → página offline con marca.
  fallbacks: {
    document: "/~offline",
  },
  workboxOptions: {
    disableDevLogs: true,
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

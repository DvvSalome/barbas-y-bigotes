// Fallback offline de la PWA (next-pwa fallbacks.document): se muestra al
// navegar sin conexión a una ruta que no está en caché.
export const metadata = { title: "Sin conexión" };

export default function Offline() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-center">
      <div className="font-display text-5xl text-accent">Sin conexión</div>
      <p className="mt-4 max-w-sm text-sm text-muted">
        Parece que estás sin internet. Revisa tu conexión y vuelve a intentar:
        tu cita te espera.
      </p>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- offline:
          el <a> fuerza recarga completa, que es justo lo que queremos al volver la red. */}
      <a
        href="/"
        className="mt-8 rounded-full bg-accent px-8 py-3 text-xs font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft"
      >
        Reintentar
      </a>
    </main>
  );
}

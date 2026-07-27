"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Pantalla de error con marca (client component: los error boundaries lo exigen).
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // El detalle queda en consola/logs; al usuario nunca se le muestra el error crudo.
    console.error(error);
    // Y se reporta: este boundary es justo donde muere una reserva a medio hacer,
    // y el cliente se va sin avisar. Sin DSN, captureException es un no-op.
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-3xl flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-xs uppercase tracking-[0.4em] text-accent">Error</p>
      <h1 className="mt-3 font-display text-5xl font-semibold uppercase">Algo salió mal</h1>
      <p className="mt-4 max-w-md text-muted">
        Tuvimos un problema cargando esta página. Probá de nuevo y, si sigue fallando, escribinos.
      </p>
      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => reset()}
          className="rounded-full bg-accent px-7 py-3 text-sm font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft"
        >
          Reintentar
        </button>
        <a
          href="https://wa.me/573006734799?text=Hola%20Barbas%20%26%20Bigotes%2C%20la%20p%C3%A1gina%20me%20mostr%C3%B3%20un%20error%20y%20necesito%20ayuda."
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-line px-7 py-3 text-sm text-accent-soft transition hover:border-accent/50"
        >
          Escribinos por WhatsApp
        </a>
      </div>
    </main>
  );
}

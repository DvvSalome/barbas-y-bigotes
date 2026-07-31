"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import "./globals.css";

/**
 * Último recinto: se usa solo si revienta el propio layout raíz, así que
 * reemplaza al layout entero y tiene que traer su <html> y <body>.
 *
 * Las fuentes de next/font viven en el layout que acá no corre, por eso el
 * markup no las asume. Es la pantalla que el cliente ve cuando TODO falló: lo
 * único que tiene que lograr es no parecer una pantalla rota y dejar a mano el
 * WhatsApp, que es la salida real cuando la app no responde.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body className="bg-bg text-ink antialiased">
        <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center px-6 py-24 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-accent">Error</p>
          <h1 className="mt-3 font-display text-4xl font-semibold uppercase sm:text-5xl">
            Se nos cayó la página
          </h1>
          <p className="mt-4 max-w-md text-muted">
            Ya nos llegó el aviso y lo estamos revisando. Puedes recargar o escribirnos y te
            agendamos la cita por WhatsApp.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="min-h-11 rounded-full bg-accent px-7 py-3 text-sm font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft"
            >
              Recargar
            </button>
            <a
              href="https://wa.me/573006734799?text=Hola%20Barbas%20%26%20Bigotes%2C%20la%20p%C3%A1gina%20no%20me%20carga%20y%20quiero%20agendar%20una%20cita."
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-11 rounded-full border border-line px-7 py-3 text-sm text-accent-soft transition hover:border-accent/50"
            >
              Escribinos por WhatsApp
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}

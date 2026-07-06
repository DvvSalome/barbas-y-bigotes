"use client";

// Card de calificación post-servicio del portal. Recibe la visita pendiente
// (o null) y se renderiza SIEMPRE desde el server component: así la instancia
// sobrevive al re-render que dispara revalidatePath("/cuenta") en la action y
// la pantalla de gracias no desaparece al enviar.
//
// Rating gate: si la action devuelve googleReviewUrl (score alto + URL de la
// sede configurada) se muestra el botón dorado a Google; si no, gracias a secas.

import { useState } from "react";
import { calificarServicio } from "@/lib/cliente-actions";

export type VisitaPendiente = {
  reservaId: string;
  servicio: string;
  barbero: string;
  fecha: string; // ya formateada en el server (TZ Bogotá)
};

export function CalificarServicio({ pendiente }: { pendiente: VisitaPendiente | null }) {
  const [score, setScore] = useState(0);
  const [comentario, setComentario] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [googleUrl, setGoogleUrl] = useState<string | null>(null);

  // Pantalla de gracias: persiste aunque el server ya no mande visita pendiente.
  if (enviado) {
    return (
      <section className="mb-8 rounded-2xl border border-accent/40 bg-accent/5 p-5 text-center">
        {googleUrl ? (
          <>
            <h3 className="font-display text-xl uppercase">¡Gracias por calificarnos!</h3>
            <p className="mt-2 text-sm text-muted">
              ¿Nos regalás 30 segundos más? Tu reseña en Google ayuda muchísimo a la barbería.
            </p>
            <a
              href={googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block rounded-full bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft"
            >
              ⭐ Dejanos tu reseña en Google
            </a>
          </>
        ) : (
          <>
            <h3 className="font-display text-xl uppercase">¡Gracias!</h3>
            <p className="mt-2 text-sm text-muted">Tu comentario nos ayuda a mejorar.</p>
          </>
        )}
      </section>
    );
  }

  if (!pendiente) return null;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!pendiente || score < 1) return;
    setBusy(true);
    setErr(null);
    const res = await calificarServicio({
      reservaId: pendiente.reservaId,
      score,
      comentario: comentario.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error ?? "No se pudo enviar. Intentá de nuevo.");
      return;
    }
    setGoogleUrl(res.googleReviewUrl ?? null);
    setEnviado(true);
  }

  return (
    <section className="mb-8 rounded-2xl border border-line bg-panel p-5">
      <div className="text-xs uppercase tracking-[0.18em] text-accent-soft">Tu última visita</div>
      <h3 className="mt-1 font-display text-2xl uppercase">¿Cómo estuvo tu última visita?</h3>
      <p className="mt-1 text-sm text-muted">
        {pendiente.servicio} · {pendiente.barbero} · {pendiente.fecha}
      </p>

      <form onSubmit={enviar} className="mt-4 space-y-3">
        <div className="flex gap-2" role="radiogroup" aria-label="Calificación de 1 a 5 estrellas">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => setScore(n)}
              aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
              aria-pressed={score === n}
              className={`text-4xl leading-none transition ${n <= score ? "text-accent" : "text-line hover:text-accent/50"}`}
            >
              ★
            </button>
          ))}
        </div>

        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Contanos cómo te fue (opcional)"
          rows={2}
          maxLength={500}
          className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />

        {err && (
          <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">
            {err}
          </div>
        )}

        <button
          disabled={busy || score < 1}
          className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-50"
        >
          {busy ? "Enviando…" : "Enviar calificación"}
        </button>
      </form>
    </section>
  );
}

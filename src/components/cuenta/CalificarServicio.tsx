"use client";

// Card de calificación post-servicio. Vive en dos lados:
//  · /cuenta: la visita pendiente (o null). Se renderiza SIEMPRE desde el server
//    component: así la instancia sobrevive al re-render que dispara
//    revalidatePath("/cuenta") en la action y la pantalla de gracias no desaparece.
//  · /calificar/[token]: el enlace del correo de postventa, sin login. `inicial`
//    trae la estrella que tocó en el correo.
//
// Google se ofrece a TODOS después de calificar, con el mismo texto sea cual sea
// la nota. Mandar a Google solo a los contentos es "review gating": lo prohíbe la
// política de Google (ver 0035) y puede costar las reseñas de la ficha.

import { useState } from "react";
import { calificarServicio, calificarPorToken } from "@/lib/cliente-actions";
import { StarIcon } from "@/components/icons";

export type VisitaPendiente = {
  /** /cuenta: la cita a calificar. */
  reservaId?: string;
  /** /calificar/[token]: el enlace del correo. */
  token?: string;
  servicio: string;
  barbero: string;
  fecha: string; // ya formateada en el server (TZ Bogotá)
};

const CTA =
  "rounded-full bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] px-6 py-3 text-sm font-semibold uppercase tracking-wide text-on-accent shadow-[0_12px_26px_-10px_rgba(210,63,52,0.7)] transition hover:brightness-105";

/** Pantalla de gracias. También la usa /calificar cuando la visita ya estaba calificada. */
export function GraciasCalificacion({ googleUrl, ya = false }: { googleUrl: string | null; ya?: boolean }) {
  return (
    <section className="mb-8 rounded-2xl border border-accent/40 bg-accent/5 p-5 text-center">
      <h3 className="font-display text-xl font-bold uppercase">
        {ya ? "Ya calificaste esta visita" : "¡Gracias por contarnos!"}
      </h3>
      <p className="mt-2 text-sm text-muted">Tu calificación ya le llegó a la barbería.</p>
      {googleUrl && (
        <>
          <p className="mt-4 text-sm text-muted">¿Lo cuentas también en Google? Ayuda a que más gente nos encuentre.</p>
          <a href={googleUrl} target="_blank" rel="noopener noreferrer" className={`${CTA} mt-4 inline-block`}>
            Escribir mi reseña en Google
          </a>
        </>
      )}
    </section>
  );
}

export function CalificarServicio({ pendiente, inicial = 0 }: { pendiente: VisitaPendiente | null; inicial?: number }) {
  const [score, setScore] = useState(inicial >= 1 && inicial <= 5 ? Math.round(inicial) : 0);
  const [comentario, setComentario] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [googleUrl, setGoogleUrl] = useState<string | null>(null);

  // Pantalla de gracias: persiste aunque el server ya no mande visita pendiente.
  if (enviado) return <GraciasCalificacion googleUrl={googleUrl} />;

  if (!pendiente) return null;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!pendiente || score < 1) return;
    setBusy(true);
    setErr(null);
    try {
      const datos = { score, comentario: comentario.trim() || undefined };
      const res = pendiente.token
        ? await calificarPorToken({ token: pendiente.token, ...datos })
        : await calificarServicio({ reservaId: pendiente.reservaId ?? "", ...datos });
      if (!res.ok) {
        setErr(res.error ?? "No se pudo enviar. Intenta de nuevo.");
        return;
      }
      setGoogleUrl(res.googleReviewUrl ?? null);
      setEnviado(true);
    } catch {
      // Falla de red: no dejar el botón colgado en "Enviando…".
      setErr("No se pudo enviar. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-8 rounded-2xl border border-line bg-panel p-5">
      <div className="font-display text-[11px] font-bold uppercase tracking-[0.3em] text-accent-soft">Tu opinión</div>
      <h3 className="mt-1 font-display text-2xl font-bold uppercase">¿Cómo estuvo tu visita?</h3>
      <p className="mt-1 text-sm text-muted">
        {pendiente.servicio} · {pendiente.barbero} · {pendiente.fecha}
      </p>

      <form onSubmit={enviar} className="mt-4 space-y-3">
        <div className="flex gap-1" role="group" aria-label="Calificación de 1 a 5 estrellas">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => setScore(n)}
              aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
              aria-pressed={score === n}
              className="rounded-lg p-1 transition hover:scale-110"
            >
              <StarIcon className={`h-10 w-10 ${n <= score ? "fill-current text-accent" : "text-line"}`} />
            </button>
          ))}
        </div>

        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Cuéntanos cómo te fue (opcional)"
          rows={2}
          maxLength={500}
          className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />

        {err && (
          <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">
            {err}
          </div>
        )}

        <button disabled={busy || score < 1} className={`${CTA} disabled:opacity-50 disabled:shadow-none`}>
          {busy ? "Enviando…" : "Enviar calificación"}
        </button>
      </form>
    </section>
  );
}

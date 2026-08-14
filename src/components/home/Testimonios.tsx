import { getTestimoniosPublicos } from "@/lib/data/queries";

// Lo que dicen los clientes — DE VERDAD. Hasta acá esta sección mostraba tres
// testimonios inventados (nombres y frases escritos a mano, con un comentario en
// el código que decía "reemplazar por reseñas reales"). Eso es publicidad falsa
// en un sitio comercial, y además había reseñas auténticas sin usar en la base.
//
// Regla: si no hay ninguna reseña real, la sección NO se dibuja. Una página con
// una sección menos es mejor que una página que miente; y el correo postventa
// que ya corre las va llenando solo.

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CO", { timeZone: "America/Bogota", month: "long", year: "numeric" });

export async function Testimonios() {
  const reviews = await getTestimoniosPublicos(3);
  if (reviews.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-6 pt-14 sm:pt-24">
      <p className="text-xs uppercase tracking-[0.3em] text-accent">Lo que dicen</p>
      <h2 className="font-display text-4xl font-semibold uppercase">Clientes felices</h2>
      <p className="mt-2 text-sm text-muted">
        Opiniones de clientes que ya pasaron por la silla, tal como las dejaron después de su corte.
      </p>
      <div
        className={`mt-8 grid gap-5 ${
          reviews.length === 1 ? "max-w-xl" : reviews.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"
        }`}
      >
        {reviews.map((r) => (
          <figure key={r.id} className="rounded-2xl border border-line bg-panel p-7">
            <div className="tracking-[2px] text-accent" aria-label={`${r.score} de 5 estrellas`}>
              <span aria-hidden>
                {"★".repeat(r.score)}
                <span className="text-line">{"★".repeat(5 - r.score)}</span>
              </span>
            </div>
            <blockquote className="mt-4 text-ink/90">“{r.comentario}”</blockquote>
            <figcaption className="mt-5 text-sm text-muted">
              {/* Sin nombre de cliente: la reseña se recogió como opinión del
                  servicio, no para publicarla con su firma. */}
              {r.barbero && <>Corte con {r.barbero} · </>}
              {r.sede}
              {r.fecha && <> · {fechaCorta(r.fecha)}</>}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

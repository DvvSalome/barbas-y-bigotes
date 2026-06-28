// Testimonios de muestra — reemplazar por reseñas reales (Google / Instagram).
const reviews = [
  { q: "El mejor degradado que me han hecho en Barranquilla. Ambiente de otro nivel.", n: "Carlos M." },
  { q: "Reservé por la web y me atendieron sin esperar nada. Súper recomendados.", n: "Andrés R." },
  { q: "Mi barbero de confianza. La barba siempre me queda perfecta.", n: "Julián P." },
];

export function Testimonios() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-14 sm:pt-24">
      <p className="text-xs uppercase tracking-[0.3em] text-accent">Lo que dicen</p>
      <h2 className="font-display text-4xl font-semibold uppercase">Clientes felices</h2>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {reviews.map(({ q, n }) => (
          <figure key={n} className="rounded-2xl border border-line bg-panel p-7">
            <div className="tracking-[2px] text-accent">★★★★★</div>
            <blockquote className="mt-4 text-ink/90">“{q}”</blockquote>
            <figcaption className="mt-5 text-sm text-muted">— {n}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

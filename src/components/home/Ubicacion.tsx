import Link from "next/link";

const locales = [
  { nombre: "Parque Venezuela", query: "Barbas y Bigotes Parque Venezuela Barranquilla" },
  { nombre: "Plaza de la Paz", query: "Barbas y Bigotes Plaza de la Paz Barranquilla" },
];

export function Ubicacion() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-24">
      <p className="text-xs uppercase tracking-[0.3em] text-accent">Visitanos</p>
      <h2 className="font-display text-4xl font-semibold uppercase">Dónde y cuándo</h2>
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {locales.map((l) => (
          <div key={l.nombre} className="rounded-2xl border border-line bg-panel p-7">
            <h3 className="font-display text-2xl font-semibold uppercase">{l.nombre}</h3>
            <p className="mt-3 text-sm text-muted">
              Lun – Sáb · 9:00 am – 8:00 pm
              <br />
              Domingo · cerrado
            </p>
            <p className="mt-1 text-xs text-muted/70">Horario referencial — confirmar con el cliente.</p>
            <Link
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.query)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-block rounded-full border border-accent/50 px-6 py-2.5 text-sm text-accent-soft transition hover:bg-accent/10"
            >
              Cómo llegar →
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

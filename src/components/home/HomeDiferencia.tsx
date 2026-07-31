/*
  "La diferencia" (spec §2.4) — solo desktop en el prototipo. Copy y glyphs
  LITERALES (L4286-4291). Server component.
*/
const ITEMS = [
  {
    glyph: "✂",
    titulo: "Barberos expertos",
    texto: "6 especialistas en degradados, barba, color y diseño.",
  },
  {
    glyph: "◆",
    titulo: "Dos sedes",
    texto: "Parque Venezuela y Plaza de la Paz, en Barranquilla.",
  },
  {
    glyph: "✓",
    titulo: "Reserva sin filas",
    texto: "Agenda online y, si te atrasas, le avisamos al siguiente de la lista.",
  },
  {
    glyph: "★",
    titulo: "Experiencia premium",
    texto: "Espacio moderno, productos de primera y bebida de cortesía.",
  },
];

export function HomeDiferencia() {
  return (
    <section className="mx-auto hidden max-w-[1180px] px-16 pt-[52px] md:block">
      <div data-reveal>
        <p className="text-[11px] uppercase tracking-[0.3em] text-accent">Por qué nosotros</p>
        <h2 className="font-display text-[38px] font-bold uppercase">La diferencia</h2>
      </div>
      <div className="mt-8 grid grid-cols-4 gap-3">
        {ITEMS.map((it, i) => (
          <div
            data-reveal
            style={{ "--reveal-delay": `${i * 80}ms` } as React.CSSProperties}
            key={it.titulo}
            className="rounded-2xl border border-[rgba(242,237,228,0.1)] bg-panel p-[22px]"
          >
            <div className="grid h-11 w-11 place-items-center rounded-full border border-accent/40 font-display text-[19px] font-extrabold text-accent">
              {it.glyph}
            </div>
            <h3 className="mt-4 font-display text-xl font-bold uppercase">{it.titulo}</h3>
            <p className="mt-2 text-[13px] leading-[1.5] text-muted">{it.texto}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getSedes, getBarberos } from "@/lib/data/queries";
import { barberosItemList, jsonLd } from "@/lib/schema-org";
import type { Barbero } from "@/lib/data/types";

export const metadata: Metadata = {
  title: "Nuestros barberos",
  description:
    "Conoce a los 6 barberos de Barbas & Bigotes en Barranquilla: especialistas en degradados, barba, color y diseño en las sedes Parque Venezuela y Plaza de la Paz.",
};

// Precios/estado no dependen del build, pero el roster sí sale de la DB.
export const revalidate = 600;

/*
  Card de barbero (spec §3). Server component: la foto pasa de B/N a color al
  hover con la regla global `.bb-card:hover .bb-foto` (globals.css) — sin JS.
*/
function BarberoCard({ barbero: b, sedeNombre }: { barbero: Barbero; sedeNombre: string }) {
  const foto = b.fotoUrl || "/barberos/generico.jpg";
  const nombreCorto = b.nombre.split(" ")[0];

  return (
    <div className="bb-card overflow-hidden rounded-[18px] border border-[rgba(242,237,228,0.1)] bg-panel transition duration-200 hover:-translate-y-1.5 hover:border-accent/40">
      {/* Foto B/N → color al hover de la card */}
      <div className="bb-foto-skeleton relative aspect-[4/4.4]">
        <span
          className="bb-foto absolute inset-0 grayscale transition-[filter] duration-700 ease-out"
          style={{
            backgroundImage: `url(${foto})`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(0,0,0,0.85))]" />

        {b.destacado && (
          <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-[10px] font-extrabold uppercase text-on-accent">
            ★ Top
          </span>
        )}

        <div className="absolute inset-x-4 bottom-4">
          <div className="font-display text-[28px] font-bold uppercase leading-none text-white">
            {b.nombre}
          </div>
          <div className="mt-1 text-xs text-[rgba(242,237,228,0.85)]">{sedeNombre}</div>
        </div>
      </div>

      {/* Barra divisoria */}
      <div className="h-0.5 w-full bg-accent/70" />

      {/* Cuerpo */}
      <div className="px-[18px] py-4">
        <div className="flex items-center gap-1.5 text-[13px]">
          <span className="tracking-[1px] text-accent">★★★★★</span>
          {b.rating != null && <b className="text-ink">{b.rating.toFixed(1)}</b>}
          {b.resenas != null && <span className="text-muted">· {b.resenas} reseñas</span>}
        </div>

        {b.especialidades.length > 0 && (
          <>
            <div className="mb-2 mt-3.5 text-[10px] uppercase tracking-[0.18em] text-muted">
              Especialista en
            </div>
            <div className="flex flex-wrap gap-1.5">
              {b.especialidades.slice(0, 4).map((e) => (
                <span
                  key={e}
                  className="rounded-full border border-[rgba(242,237,228,0.14)] bg-white/[0.04] px-2.5 py-1 text-[11px]"
                >
                  {e}
                </span>
              ))}
            </div>
          </>
        )}

        <Link
          href={`/reservar?barbero=${b.id}`}
          className="mt-4 block rounded-xl bg-accent py-3 text-center text-[11.5px] font-bold uppercase tracking-[0.12em] text-on-accent transition hover:bg-accent-soft"
        >
          Reservar con {nombreCorto}
        </Link>
      </div>
    </div>
  );
}

export default async function BarberosPage() {
  const [sedes, barberos] = await Promise.all([getSedes(), getBarberos()]);

  return (
    <>
      {/* ItemList de Person (equipo real de la DB), server-rendered para IA. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(barberosItemList(barberos)) }}
      />
      <SiteHeader />
      <main className="mx-auto max-w-[1180px] px-6 pb-16 md:px-16">
        {/* Hero */}
        <div className="pt-14 text-center md:pt-[60px]">
          <p className="text-xs uppercase tracking-[0.4em] text-accent">Nuestro equipo</p>
          <h1 className="mt-3 font-display text-[44px] font-extrabold uppercase leading-[0.95] md:text-[58px]">
            Los barberos
          </h1>
          <p className="mx-auto mt-4 max-w-[52ch] text-[15px] leading-[1.6] text-muted">
            Seis especialistas entre las dos sedes. Pásale el cursor a una carta para
            conocerlo y reserva directo con él.
          </p>
        </div>

        {sedes.map((s) => {
          const list = barberos.filter((b) => b.sede === s.id);
          if (!list.length) return null;
          return (
            <section key={s.id} className="mt-12">
              {/* Separador de sede: pill + nombre + línea */}
              <div data-reveal className="mb-6 flex items-center gap-4">
                <span className="rounded-full border border-accent/40 px-3.5 py-[5px] text-[11px] font-bold uppercase tracking-[0.3em] text-accent-soft">
                  Sede
                </span>
                <h2 className="font-display text-[26px] font-bold uppercase leading-none">
                  {s.nombre}
                </h2>
                <span
                  aria-hidden
                  className="h-px flex-1 bg-[linear-gradient(90deg,rgba(242,237,228,0.16),transparent)]"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((b, i) => (
                  <div
                    key={b.id}
                    data-reveal
                    style={{ "--reveal-delay": `${i * 90}ms` } as React.CSSProperties}
                  >
                    <BarberoCard barbero={b} sedeNombre={s.nombre} />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </main>
      <SiteFooter />
    </>
  );
}

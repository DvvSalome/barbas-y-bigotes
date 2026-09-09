import type { Metadata } from "next";

import { getServiciosCatalogoAdmin, getSedes } from "@/lib/data/queries";
import { categorias } from "@/lib/data/seed";
import type { SedeId } from "@/lib/data/types";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { ComboBuilder } from "@/components/admin/ComboBuilder";
import { PreciosLista } from "@/components/admin/PreciosLista";

export const metadata: Metadata = { title: "Servicios y precios · Admin" };

export default async function PreciosPage({
  searchParams,
}: {
  searchParams: Promise<{ sede?: string }>;
}) {
  const [servicios, sedes] = await Promise.all([getServiciosCatalogoAdmin(), getSedes()]);

  // Sede activa desde el selector existente (?sede=). Sin param = "Ambas sedes":
  // el armador de combos necesita UNA sede (el combo se crea en la sede activa).
  const sp = await searchParams;
  const sedeParam = typeof sp.sede === "string" ? sp.sede : undefined;
  const sedeActiva = (sedes.find((s) => s.id === sedeParam)?.id ?? null) as SedeId | null;
  const sedeNombre = sedes.find((s) => s.id === sedeActiva)?.nombre ?? "";

  // Partes elegibles: servicios NO combo, activos y priceados en la sede activa.
  const partesDisponibles = sedeActiva
    ? servicios.filter((s) => !s.esCombo && s.activo !== false && s.precios[sedeActiva] != null)
    : [];

  // Pulso del catálogo para el encabezado: qué hay y qué falta por vestir.
  const activos = servicios.filter((s) => s.activo !== false);
  const combos = activos.filter((s) => s.esCombo).length;
  const sinFoto = activos.filter((s) => !s.fotoUrl).length;

  return (
    <div className="max-w-7xl">
      <SectionHeader
        eyebrow="Catálogo"
        title="Servicios y precios"
        description="Lo que hace el barbero: cuánto dura, cuánto cuesta y cómo se ve al reservar. A la derecha se arman los combos."
      />

      {/* Pulso del catálogo en cuadros, no en un parrafito */}
      <div className="mt-5 grid grid-cols-3 gap-3 sm:max-w-md">
        {[
          { n: activos.length, l: "servicios activos" },
          { n: combos, l: "combos" },
          { n: sinFoto, l: "sin foto aún", alerta: sinFoto > 0 },
        ].map((k) => (
          <div key={k.l} className="rounded-2xl border border-line bg-panel px-3.5 py-3">
            <div className={`font-display text-2xl font-bold tabular-nums ${k.alerta ? "text-warn" : "text-accent-soft"}`}>
              {k.n}
            </div>
            <div className="text-[12px] leading-tight text-muted">{k.l}</div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[13px] text-muted">
        Toca cualquier precio para cambiarlo; la foto y la descripción son las que ve el cliente al reservar.
      </p>

      {/* DOS PANELES en escritorio: la lista a la izquierda y el armador FIJO a
          la derecha (sticky con su propio scroll) — se arma el combo viendo el
          catálogo, sin peregrinar hasta el fondo de la página. En móvil se apilan. */}
      {/* minmax(0,1fr) también en móvil: sin él la columna es `auto` y CUALQUIER
          hijo ancho (una fila de chips que scrollea) estira la página entera. */}
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <section>
          <PreciosLista servicios={servicios} sedes={sedes} etiquetas={categorias} />
        </section>

        <aside className="lg:sticky lg:top-28 lg:max-h-[calc(100dvh-8.5rem)] lg:overflow-y-auto">
          <h2 className="mb-3 inline-flex items-center rounded-full border border-accent/30 bg-accent/5 px-4 py-1.5 font-display text-lg">
            Armador de combos
          </h2>
          {sedeActiva ? (
            <ComboBuilder
              partesDisponibles={partesDisponibles}
              sedeActiva={sedeActiva}
              sedeNombre={sedeNombre}
              etiquetas={categorias}
            />
          ) : (
            <div className="rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
              Elige una sede arriba (Parque Venezuela o Plaza de la Paz) para armar un combo. El combo queda
              disponible solo en esa sede.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

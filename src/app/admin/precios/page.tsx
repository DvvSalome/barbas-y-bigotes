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

  return (
    <div className="max-w-5xl">
      <SectionHeader
        eyebrow="Catálogo"
        title="Servicios y precios"
        description="Lo que hace el barbero: cuánto dura y cuánto cuesta en cada sede. Desde acá se arman combos y se saca un servicio del catálogo."
      />

      <p className="mt-4 text-[13px] text-muted">
        Toca cualquier precio para cambiarlo. Se guarda al instante y queda vigente en el sitio, en la
        reserva y en el cobro del mostrador.
      </p>

      <section className="mt-6">
        <PreciosLista servicios={servicios} sedes={sedes} etiquetas={categorias} />
      </section>

      {/* Armador de combos — atado a la sede activa del selector. Va al final:
          se usa de vez en cuando, y arriba empujaba la lista de precios (que es
          a lo que se entra todos los días) fuera de la primera pantalla. */}
      <section className="mt-10">
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
            Elige una sede arriba (Parque Venezuela o Plaza de la Paz) para armar un combo. El combo queda disponible
            solo en esa sede.
          </div>
        )}
      </section>
    </div>
  );
}

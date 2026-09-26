import type { Metadata } from "next";
import { getProductos, getSedes, getCostosProductos } from "@/lib/data/queries";
import { InventarioPanel } from "@/components/admin/InventarioPanel";
import { SectionHeader } from "@/components/admin/SectionHeader";

export const metadata: Metadata = { title: "Productos y stock · Admin" };

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const [productos, retirados, sedes, costos] = await Promise.all([
    getProductos(),
    getProductos(false),
    getSedes(),
    getCostosProductos(),
  ]);
  // El ?sede= del selector del topbar, validado contra las sedes reales (mismo
  // patrón que Clientes). Sin sede = las dos, agrupadas.
  const sedeActiva = sedes.find((s) => s.id === (typeof sp.sede === "string" ? sp.sede : undefined))?.id ?? null;
  const nombreSede = sedes.find((s) => s.id === sedeActiva)?.nombre;

  return (
    <div className="max-w-6xl">
      <SectionHeader
        eyebrow="Catálogo"
        title="Productos y stock"
        description={
          sedeActiva
            ? `Lo que se vende en ${nombreSede}: cuánto queda, cuánto cuesta y qué se está acabando.`
            : "Lo que se vende en las dos sedes: cuánto queda, cuánto cuesta y qué se está acabando. Elige una sede arriba para ver solo esa."
        }
      />
      <InventarioPanel productos={productos} retirados={retirados} sedes={sedes} sedeActiva={sedeActiva} costos={costos} />
    </div>
  );
}

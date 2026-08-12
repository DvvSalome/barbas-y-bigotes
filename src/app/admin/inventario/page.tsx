import type { Metadata } from "next";
import { getProductos, getSedes } from "@/lib/data/queries";
import { InventarioPanel } from "@/components/admin/InventarioPanel";
import { SectionHeader } from "@/components/admin/SectionHeader";

export const metadata: Metadata = { title: "Productos y stock · Admin" };

export default async function InventarioPage() {
  const [productos, sedes] = await Promise.all([getProductos(), getSedes()]);

  return (
    <div className="max-w-6xl">
      <SectionHeader
        eyebrow="Catálogo"
        title="Productos y stock"
        description="Lo que se vende en el mostrador: cuánto queda, cuánto cuesta y qué se está acabando."
      />
      {/* Una sola pantalla: sede en pestañas (no secciones apiladas) y el alta
          se abre en su sitio, para no mandar al dueño a hacer scroll. */}
      <InventarioPanel productos={productos} sedes={sedes} />
    </div>
  );
}

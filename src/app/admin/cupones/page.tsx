import type { Metadata } from "next";
import { getCupones } from "@/lib/data/queries";
import { CuponesAdmin } from "@/components/admin/CuponesAdmin";
import { SectionHeader } from "@/components/admin/SectionHeader";

export const metadata: Metadata = { title: "Cupones · Admin" };

export default async function CuponesPage() {
  const cupones = await getCupones();
  return (
    <div className="max-w-4xl">
      <SectionHeader
        eyebrow="Promociones"
        title="Cupones"
        description="Códigos de descuento que se aplican al cobrar en la app del barbero."
      />
      <div className="mt-8">
        <CuponesAdmin cupones={cupones} />
      </div>
    </div>
  );
}

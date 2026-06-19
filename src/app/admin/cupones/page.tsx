import type { Metadata } from "next";
import { getCupones } from "@/lib/data/queries";
import { CuponesAdmin } from "@/components/admin/CuponesAdmin";

export const metadata: Metadata = { title: "Cupones · Admin" };

export default async function CuponesPage() {
  const cupones = await getCupones();
  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-4xl font-semibold">Cupones</h1>
      <p className="mt-2 text-sm text-muted">Códigos de descuento que se aplican al cobrar en la app del barbero.</p>
      <div className="mt-8">
        <CuponesAdmin cupones={cupones} />
      </div>
    </div>
  );
}

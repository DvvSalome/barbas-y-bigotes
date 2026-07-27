import type { Metadata } from "next";
import { getAjustesAvisos } from "@/lib/data/queries";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { AvisosAdmin } from "@/components/admin/AvisosAdmin";

export const metadata: Metadata = { title: "Avisos · Admin" };

export default async function AvisosPage() {
  const ajustes = await getAjustesAvisos();
  return (
    <div className="max-w-3xl">
      <SectionHeader
        eyebrow="Automático"
        title="Avisos al cliente"
        description="Los correos que salen solos. Acá se ajusta con cuánto tiempo se le avisa al cliente que su cita es en un rato."
      />
      <div className="mt-5">
        <AvisosAdmin ajustes={ajustes} />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { getAjustesAvisos, getResumenTocaCorte } from "@/lib/data/queries";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { AvisosAdmin } from "@/components/admin/AvisosAdmin";

export const metadata: Metadata = { title: "Avisos · Admin" };

export default async function AvisosPage() {
  const [ajustes, resumen] = await Promise.all([getAjustesAvisos(), getResumenTocaCorte()]);
  return (
    <div className="max-w-3xl">
      <SectionHeader
        eyebrow="Automático"
        title="Avisos al cliente"
        description="Los correos que salen solos: el aviso antes de la cita y el 'te toca corte' a quien lleva días sin venir."
      />
      <div className="mt-5">
        <AvisosAdmin ajustes={ajustes} resumen={resumen} />
      </div>
    </div>
  );
}

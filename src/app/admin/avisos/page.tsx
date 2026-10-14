import type { Metadata } from "next";
import { getAjustesAvisos, getResumenTocaCorte, getCorreosDueno } from "@/lib/data/queries";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { AvisosAdmin } from "@/components/admin/AvisosAdmin";
import { AvisosDueno } from "@/components/admin/AvisosDueno";

export const metadata: Metadata = { title: "Avisos · Admin" };

// Primero lo del DUEÑO (0084): era lo que faltaba y es lo que él viene a tocar.
// Después lo que le llega al cliente y al equipo.
export default async function AvisosPage() {
  const [ajustes, resumen, correosDueno] = await Promise.all([
    getAjustesAvisos(),
    getResumenTocaCorte(),
    getCorreosDueno(),
  ]);
  return (
    <div className="max-w-3xl">
      <SectionHeader
        eyebrow="Marketing"
        title="Avisos"
        description="A quién le avisamos qué: a ti (citas nuevas, cierres de caja, alertas), al cliente y al equipo."
      />
      <div className="mt-5">
        <AvisosDueno disponible={correosDueno.disponible} correos={correosDueno.correos} />
      </div>
      <div className="mt-10">
        <h2 className="mb-1 font-display text-xl">Al cliente y al equipo</h2>
        <p className="mb-4 max-w-[56ch] text-[12.5px] leading-relaxed text-muted">
          Lo que sale solo para tus clientes (si dejaron su correo) y para tu equipo, y de qué depende cada aviso.
        </p>
        <AvisosAdmin ajustes={ajustes} resumen={resumen} />
      </div>
    </div>
  );
}

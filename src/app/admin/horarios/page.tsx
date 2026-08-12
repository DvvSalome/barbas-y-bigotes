import type { Metadata } from "next";
import { getSedes, getHorarioSemanal, getDiasEspeciales } from "@/lib/data/queries";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { HorarioSemanalAdmin } from "@/components/admin/HorarioSemanalAdmin";
import { DiasEspecialesAdmin } from "@/components/admin/DiasEspecialesAdmin";
import { FotoSede } from "@/components/admin/FotoSede";

export const metadata: Metadata = { title: "Horarios · Admin" };

export default async function HorariosPage() {
  const [sedes, horario, dias] = await Promise.all([
    getSedes(),
    getHorarioSemanal(),
    getDiasEspeciales(),
  ]);

  return (
    <div className="max-w-3xl">
      <SectionHeader
        eyebrow="Local"
        title="Horarios"
        description="Cuándo abre la barbería. El horario de la semana es el de siempre; los días especiales son las excepciones de una fecha puntual."
      />

      {/* La cara del local: la fachada que ve el cliente al elegir sede en la
          reserva. Vive acá porque esta es la página del LOCAL (0058). */}
      <div className="mt-5">
        <h2 className="mb-3 text-xs uppercase tracking-[0.3em] text-accent">La foto de cada sede</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {sedes.map((s) => (
            <FotoSede key={s.id} sedeId={s.id} nombre={s.nombre} direccion={s.direccion} fotoUrl={s.fotoUrl} />
          ))}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-xs uppercase tracking-[0.3em] text-accent">Horario de la semana</h2>
        <HorarioSemanalAdmin sedes={sedes} horario={horario} />
      </div>

      <div className="mt-10">
        <SectionHeader
          eyebrow="Excepciones"
          title="Días especiales"
          description="Un festivo cerrado, un domingo que sí abre, o un día con otro horario (ej. un sábado de 1:00 a 4:30). Vale para una fecha puntual."
        />
        <div className="mt-5">
          <DiasEspecialesAdmin sedes={sedes} dias={dias} />
        </div>
      </div>
    </div>
  );
}

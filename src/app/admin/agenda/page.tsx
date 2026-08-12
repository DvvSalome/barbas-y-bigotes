import type { Metadata } from "next";

import {
  getSedes,
  getBarberos,
  getServicios,
  getHorarioSemanal,
  getDiasEspeciales,
  getAgendaSedeDia,
  getAgendaSedeRango,
  getBloqueosDia,
} from "@/lib/data/queries";
import { bogotaYmd, dowDeFecha } from "@/lib/slots";
import type { SedeId } from "@/lib/data/types";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { AgendaDia } from "@/components/admin/AgendaDia";

export const metadata: Metadata = { title: "Agenda · Admin" };

// La agenda es del día que se mira, no cacheable.
export const dynamic = "force-dynamic";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ sede?: string; fecha?: string; vista?: string }>;
}) {
  const sp = await searchParams;
  const [sedes, barberos, servicios, horarioSemanal, diasEspeciales] = await Promise.all([
    getSedes(),
    getBarberos(),
    getServicios(),
    getHorarioSemanal(),
    getDiasEspeciales(),
  ]);

  // Sede del selector del topbar; sin elegir, la primera (el calendario es por sede).
  const sede = (sedes.find((s) => s.id === sp.sede)?.id ?? sedes[0]?.id) as SedeId;
  const sedeNombre = sedes.find((s) => s.id === sede)?.nombre ?? "";

  const hoy = bogotaYmd();
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha ?? "") ? sp.fecha! : hoy;
  const vista = sp.vista === "semana" ? ("semana" as const) : ("dia" as const);
  const barberosSede = barberos.filter((b) => b.sede === sede);
  // Lunes de la semana de `fecha` para la vista semanal (un solo viaje de 7 días).
  const lunes = (() => {
    const d = new Date(`${fecha}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((dowDeFecha(fecha) + 6) % 7));
    return d.toISOString().slice(0, 10);
  })();
  const [agenda, bloqueos, agendaSemana] = await Promise.all([
    getAgendaSedeDia(sede, fecha),
    getBloqueosDia(barberosSede.map((b) => b.id), fecha),
    vista === "semana" ? getAgendaSedeRango(sede, lunes, 7) : Promise.resolve([]),
  ]);

  return (
    <div className="max-w-6xl">
      <SectionHeader
        eyebrow="Agenda"
        title={`Agenda de ${sedeNombre}`}
        description="El día completo de la sede: cada columna es un barbero, cada bloque una cita. Toca un barbero (o un hueco) para agendar."
      />
      <AgendaDia
        sede={sede}
        fecha={fecha}
        hoy={hoy}
        agenda={agenda}
        bloqueos={bloqueos}
        vista={vista}
        agendaSemana={agendaSemana}
        barberos={barberosSede}
        servicios={servicios}
        horarioSemanal={horarioSemanal.filter((h) => h.sede === sede)}
        diasEspeciales={diasEspeciales.filter((d) => d.sede === sede)}
      />
    </div>
  );
}

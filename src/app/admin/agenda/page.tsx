import type { Metadata } from "next";
import Link from "next/link";

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
    <div>
      <SectionHeader
        eyebrow="Agenda"
        title="Agenda"
        // La sede ya la dicen las pastillas de acá abajo (antes el título era el
        // único lugar donde figuraba). El instructivo es de leer una vez: en el
        // celular se comía tres renglones sobre el calendario, que es lo que se
        // viene a ver.
        description={
          <span className="hidden sm:inline">
            El día completo de {sedeNombre}: cada columna es un barbero, cada bloque una cita. Toca un
            barbero (o un hueco) para agendar.
          </span>
        }
      />
      {/* Cambiar de sede acá se hacía SOLO desde el selector del topbar, que en
          el celular vive dentro del menú (dos toques y a ciegas). La agenda es
          por sede: la elección va a la vista, al lado del título. */}
      {sedes.length > 1 && (
        <div
          role="group"
          aria-label="Sede de la agenda"
          className="mt-3 flex gap-0.5 rounded-[9px] border border-line bg-panel p-[3px] sm:w-fit"
        >
          {sedes.map((s) => {
            const activa = s.id === sede;
            return (
              <Link
                key={s.id}
                href={`/admin/agenda?sede=${s.id}&fecha=${fecha}${vista === "semana" ? "&vista=semana" : ""}`}
                aria-current={activa ? "page" : undefined}
                // En el celular las dos se reparten el ancho; en PC medían 1140px entre ambas.
                className={`flex min-h-10 flex-1 items-center justify-center whitespace-nowrap rounded-md px-3 text-xs font-semibold transition sm:flex-none sm:px-7 ${
                  activa
                    ? "bg-elevated text-ink shadow-[inset_0_0_0_1px_var(--line)]"
                    : "text-muted hover:text-ink"
                }`}
              >
                {s.nombre}
              </Link>
            );
          })}
        </div>
      )}
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

import type { Metadata } from "next";
import { BookingWizard } from "@/components/BookingWizard";
import {
  getSedes,
  getBarberos,
  getServicios,
  getBebidasUpsell,
  getAusencias,
  getDiasEspeciales,
  getHorarioSemanal,
} from "@/lib/data/queries";

export const metadata: Metadata = {
  title: "Reservar",
};

// El wizard es una sola pantalla (app-shell propio: header + progreso + footer
// sticky), tal cual el prototipo §6 — sin el header/footer de marketing. El
// widget de contacto NO se monta acá (regla del proto). searchParams (Next 16)
// llega como Promise: preselecciona sede (?sede=) o barbero (?barbero=).
export default async function ReservarPage({
  searchParams,
}: {
  searchParams: Promise<{ barbero?: string; sede?: string; servicio?: string }>;
}) {
  // ?servicio= lo manda el correo "te toca corte" (reservar igual que la última vez).
  const { barbero, sede, servicio } = await searchParams;
  const [sedes, barberos, servicios, bebidas, ausencias, diasEspeciales, horarioSemanal] = await Promise.all([
    getSedes(),
    getBarberos(),
    getServicios(),
    getBebidasUpsell(),
    getAusencias(),
    getDiasEspeciales(),
    getHorarioSemanal(),
  ]);
  const initialSedeId = sedes.find((s) => s.id === sede)?.id;
  return (
    <>
      <BookingWizard
        sedes={sedes}
        barberos={barberos}
        servicios={servicios}
        bebidas={bebidas}
        ausencias={ausencias}
        diasEspeciales={diasEspeciales}
        horarioSemanal={horarioSemanal}
        initialBarberoId={barbero}
        initialSedeId={initialSedeId}
        initialServicioId={servicios.find((s) => s.id === servicio)?.id}
      />
      {/* Política de cancelación server-rendered (crawlable para IAs/buscadores),
          fuera del app-shell del wizard para no romper el layout mobile. */}
      <p className="sr-only">
        Puedes cancelar o reagendar tu cita online hasta 2 horas antes desde Mi
        cuenta (/cuenta). Con menos tiempo, escríbenos por WhatsApp al +57 300
        673 4799.
      </p>
    </>
  );
}

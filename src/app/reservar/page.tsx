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
import { bogotaYmd } from "@/lib/slots";
import { leerFechaHora, leerOrigenWeb } from "@/lib/cupo";

export const metadata: Metadata = {
  title: "Reservar",
};

// El wizard es una sola pantalla (app-shell propio: header + progreso + footer
// sticky), tal cual el prototipo §6 — sin el header/footer de marketing. El
// widget de contacto NO se monta acá (regla del proto). searchParams (Next 16)
// llega como Promise: preselecciona sede (?sede=), barbero (?barbero=), servicio
// (?servicio=) y, desde los chips de "próximo cupo" de la home, día y hora
// (?fecha=&hora=). ?desde= dice de qué parte de la web vino (se guarda en la
// reserva para medir qué vende).
export default async function ReservarPage({
  searchParams,
}: {
  searchParams: Promise<{ barbero?: string; sede?: string; servicio?: string; fecha?: string; hora?: string; desde?: string }>;
}) {
  // ?servicio= lo manda el correo "te toca corte" (reservar igual que la última vez).
  const { barbero, sede, servicio, fecha, hora, desde } = await searchParams;
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
  const fechaHora = leerFechaHora(fecha, hora, bogotaYmd());
  // El chip de cupo se calcula con el corte: si llega día y hora sin servicio, el
  // wizard arranca con el corte elegido para poder aterrizar en "Día y hora".
  const servicioId = servicios.find((s) => s.id === (servicio ?? (fechaHora ? "corte" : undefined)))?.id;
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
        initialServicioId={servicioId}
        initialFecha={fechaHora?.fecha}
        initialMinuto={fechaHora?.minuto}
        origenWeb={leerOrigenWeb(desde)}
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

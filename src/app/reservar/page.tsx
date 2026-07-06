import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BookingWizard } from "@/components/BookingWizard";
import { Reveal } from "@/components/motion/Reveal";
import { getSedes, getBarberos, getServicios } from "@/lib/data/queries";

export const metadata: Metadata = {
  title: "Reservar",
};

export default async function ReservarPage({
  searchParams,
}: {
  searchParams: Promise<{ barbero?: string; sede?: string }>;
}) {
  const { barbero, sede } = await searchParams;
  const [sedes, barberos, servicios] = await Promise.all([
    getSedes(),
    getBarberos(),
    getServicios(),
  ]);
  const initialSedeId = sedes.find((s) => s.id === sede)?.id;
  return (
    <>
      <SiteHeader />
      <Reveal y={20}>
        <BookingWizard
          sedes={sedes}
          barberos={barberos}
          servicios={servicios}
          initialBarberoId={barbero}
          initialSedeId={initialSedeId}
        />
      </Reveal>
      <SiteFooter />
    </>
  );
}

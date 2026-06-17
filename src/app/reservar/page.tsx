import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BookingWizard } from "@/components/BookingWizard";
import { getSedes, getBarberos, getServicios } from "@/lib/data/queries";

export const metadata: Metadata = {
  title: "Reservar · Barbas & Bigotes",
};

export default async function ReservarPage({
  searchParams,
}: {
  searchParams: Promise<{ barbero?: string }>;
}) {
  const { barbero } = await searchParams;
  const [sedes, barberos, servicios] = await Promise.all([
    getSedes(),
    getBarberos(),
    getServicios(),
  ]);
  return (
    <>
      <SiteHeader />
      <BookingWizard
        sedes={sedes}
        barberos={barberos}
        servicios={servicios}
        initialBarberoId={barbero}
      />
      <SiteFooter />
    </>
  );
}

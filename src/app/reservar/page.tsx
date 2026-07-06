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
      {/* Politica de cancelacion server-rendered (visible para crawlers e IAs). */}
      <p className="mx-auto max-w-3xl px-6 pb-10 text-center text-xs leading-relaxed text-muted">
        Podés cancelar o reagendar tu cita online hasta 2 horas antes desde{" "}
        <a href="/cuenta" className="text-accent-soft transition hover:text-accent">
          Mi cuenta
        </a>
        . Con menos tiempo, escribinos por WhatsApp al +57 300 673 4799.
      </p>
      <SiteFooter />
    </>
  );
}

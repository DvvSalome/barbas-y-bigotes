import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { HeaderPropuesta } from "@/components/propuesta/HeaderPropuesta";
import { Ubicacion } from "@/components/home/Ubicacion";
import { Faq } from "@/components/home/Faq";
import { Hero, LaCarta, Elenco, TiraCortes, ComoFunciona, Cierre, WHATSAPP } from "@/components/propuesta/Secciones";
import { BarraReserva } from "@/components/propuesta/Islas";
import { getSedes, getBarberos, getServicios } from "@/lib/data/queries";

// La propuesta de landing «La pared del local» (26-sep, segunda vuelta), para
// que el dueño la vea en su celular ANTES de reemplazar la home: la actual sale
// del prototipo de Claude Design y cambiarla es decisión suya. Fuera de
// buscadores y del sitemap. (El layout ya agrega « · Barbas & Bigotes».)
export const metadata: Metadata = {
  title: "Propuesta de inicio",
  robots: { index: false, follow: false },
};

export const revalidate = 600;

export default async function Propuesta() {
  const [sedes, barberos, servicios] = await Promise.all([getSedes(), getBarberos(), getServicios()]);
  return (
    <>
      <HeaderPropuesta />
      <BarraReserva whatsapp={WHATSAPP} />
      <main>
        <Hero barberos={barberos} servicios={servicios} />
        <LaCarta servicios={servicios} sedes={sedes} />
        <Elenco barberos={barberos} sedes={sedes} />
        <TiraCortes />
        <ComoFunciona />
        <Ubicacion />
        <div className="pt-[52px]">
          <Faq />
        </div>
        <Cierre />
      </main>
      <SiteFooter conCtaMovil sinCtaFinal />
    </>
  );
}

import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileStickyCta } from "@/components/MobileStickyCta";
import { Ubicacion } from "@/components/home/Ubicacion";
import { Faq } from "@/components/home/Faq";
import { Hero, LaCarta, Elenco, TiraCortes, ComoFunciona, Cierre } from "@/components/propuesta/Secciones";
import { PanalHero } from "@/components/propuesta/Encendido";
import { getSedes, getBarberos, getServicios } from "@/lib/data/queries";

// La propuesta de landing «Se prende el local» (26-sep), para que el dueño la
// vea en su celular ANTES de reemplazar la home: la actual sale del prototipo de
// Claude Design y cambiarla es decisión suya. Fuera de buscadores y del sitemap.
export const metadata: Metadata = {
  title: "Propuesta de inicio · Barbas & Bigotes",
  robots: { index: false, follow: false },
};

export const revalidate = 600;

export default async function Propuesta() {
  const [sedes, barberos, servicios] = await Promise.all([getSedes(), getBarberos(), getServicios()]);
  return (
    <>
      <SiteHeader />
      <MobileStickyCta />
      <main>
        <div className="relative">
          <Hero barberos={barberos} />
          {/* En escritorio el techo de tubos flota a la derecha del texto. */}
          <div className="pointer-events-none absolute right-[4vw] top-1/2 hidden w-[min(40vw,560px)] -translate-y-1/2 lg:block">
            <PanalHero />
          </div>
        </div>
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

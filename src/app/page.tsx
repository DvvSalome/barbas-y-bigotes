import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Ubicacion } from "@/components/home/Ubicacion";
import { Faq } from "@/components/home/Faq";
import { Hero, LaCarta, Elenco, TiraCortes, ComoFunciona, Cierre, WHATSAPP } from "@/components/propuesta/Secciones";
import { BarraReserva } from "@/components/propuesta/Islas";
import { getSedes, getBarberos, getServicios } from "@/lib/data/queries";

/*
  La home: la landing «La pared del local» (26-sep), aprobada por el dueño tras
  tres vueltas en /propuesta (que ahora redirige acá). Los precios, los barberos
  y los servicios salen de la base: ISR cada 10 min la mantiene honesta. Los
  metadatos (título, descripción, OG) son los del layout.

  Sin ContactoWidget: la página ya tiene WhatsApp en el hero, en el cierre y en
  la barra del celular; un globo flotante encima competía con el botón de
  reservar.
*/
export const revalidate = 600;

export default async function Home() {
  const [sedes, barberos, servicios] = await Promise.all([getSedes(), getBarberos(), getServicios()]);
  return (
    <>
      <SiteHeader transparente />
      <main>
        <Hero barberos={barberos} servicios={servicios} sedes={sedes} />
        <LaCarta servicios={servicios} sedes={sedes} />
        <Elenco barberos={barberos} sedes={sedes} />
        <TiraCortes />
        {/* Propósito de la app: el verificador de la pantalla de consentimiento
            OAuth de Google busca el nombre y el propósito de la app en la home. */}
        <ComoFunciona />
        <Ubicacion />
        <div className="pt-[52px]">
          <Faq />
        </div>
        <Cierre sedes={sedes} />
      </main>
      {/* Después del contenido: así el lector de pantalla no se la encuentra
          antes que el hero. Es fija, la posición en pantalla no cambia. */}
      <BarraReserva whatsapp={WHATSAPP} />
      <SiteFooter conCtaMovil sinCtaFinal />
    </>
  );
}

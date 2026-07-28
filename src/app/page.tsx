import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileStickyCta } from "@/components/MobileStickyCta";
import { ContactoWidget } from "@/components/ContactoWidget";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeStats } from "@/components/home/HomeStats";
import { HomeDiferencia } from "@/components/home/HomeDiferencia";
import { HomeServicios } from "@/components/home/HomeServicios";
import { HomeGaleria } from "@/components/home/HomeGaleria";
import { HomeSedes } from "@/components/home/HomeSedes";
import { HomeApp } from "@/components/home/HomeApp";
import { Testimonios } from "@/components/home/Testimonios";
import { Ubicacion } from "@/components/home/Ubicacion";
import { Faq } from "@/components/home/Faq";
import { getSedes, getBarberos, getServicios } from "@/lib/data/queries";
import type { Servicio } from "@/lib/data/types";

// Los stats y los precios de "Lo que más piden" salen de la DB: sin revalidate
// la home quedaría con los datos del build. ISR cada 10 min la mantiene honesta.
export const revalidate = 600;

// "Lo que más piden" (spec §1.4/§2.5): los 5 servicios del prototipo, con su
// precio real de Parque Venezuela (pv) desde la DB.
const DESTACADOS_IDS = ["corte", "corte-barba", "corte-cejas", "corte-barba-cejas", "cerquillos"];

export default async function Home() {
  const [sedes, barberos, servicios] = await Promise.all([
    getSedes(),
    getBarberos(),
    getServicios(),
  ]);

  const destacados = DESTACADOS_IDS.map((id) => servicios.find((s) => s.id === id)).filter(
    (s): s is Servicio => Boolean(s),
  );

  return (
    <>
      <ContactoWidget sobreCtaMovil />
      <SiteHeader />
      <MobileStickyCta />
      <main>
        <HomeHero />
        <HomeStats
          sedesCount={sedes.length}
          barberosCount={barberos.length}
          serviciosCount={servicios.length}
        />
        {/* Propósito de la app ARRIBA, justo tras el hero: el verificador de la
            pantalla de consentimiento OAuth de Google busca el nombre y el
            propósito de la app en la parte alta de la home. */}
        <HomeApp />
        <HomeDiferencia />
        <HomeServicios servicios={destacados} />
        <HomeGaleria />
        <HomeSedes />

        {/* Los testimonios siguen siendo solo-desktop (spec §2.8): alargan la home
            en móvil sin ayudar a reservar. El contenido queda en el HTML para los
            crawlers de IA aunque se oculte. */}
        <div className="hidden md:block">
          <Testimonios />
        </div>

        {/* Ubicación y FAQ SÍ van en móvil: la mayoría entra desde el celular y
            "¿dónde queda?", "¿puedo cancelar?" y "¿atienden sin reserva?" son las
            preguntas que hoy terminan en WhatsApp mientras alguien corta. */}
        <Ubicacion />
        <div className="pt-[52px]">
          <Faq />
        </div>
      </main>
      <SiteFooter conCtaMovil />
    </>
  );
}

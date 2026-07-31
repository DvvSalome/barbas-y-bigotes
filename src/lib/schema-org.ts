import type { Barbero } from "@/lib/data/types";

/**
 * JSON-LD (schema.org) del sitio publico. Se renderiza en Server Components
 * con <script type="application/ld+json"> para que quede en el HTML inicial:
 * los crawlers de IA (GPTBot, ClaudeBot, PerplexityBot) no ejecutan JS.
 *
 * Fuente de datos duros: fichas de Google Business Profile de cada sede
 * (auditoria GEO, ver docs/GEO-AUDIT-REPORT.md).
 */

const BASE = "https://barbasybigotes.com";

const ORG_ID = `${BASE}/#org`;
export const SEDE_IDS: Record<string, string> = {
  "parque-venezuela": `${BASE}/#sede-parque-venezuela`,
  "plaza-de-la-paz": `${BASE}/#sede-plaza-de-la-paz`,
};

const MAPS_PARQUE_VENEZUELA =
  "https://maps.google.com/?place_id=ChIJeQo0-QMt9I4R-X3dE0wvF6I";
const MAPS_PLAZA_DE_LA_PAZ =
  "https://maps.google.com/?place_id=ChIJvbUwJZYt9I4R8KamOLTW3-g";

const HORARIO = [
  {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    opens: "09:00",
    closes: "20:00",
  },
];

const RESERVAR_ACTION = {
  "@type": "ReserveAction",
  target: {
    "@type": "EntryPoint",
    urlTemplate: `${BASE}/reservar`,
    actionPlatform: [
      "https://schema.org/DesktopWebPlatform",
      "https://schema.org/MobileWebPlatform",
    ],
  },
  result: { "@type": "Reservation", name: "Reserva de cita de barbería" },
};

/**
 * Grafo maestro: Organization + WebSite + las 2 sedes BarberShop + catalogo.
 * Va en el layout raiz para salir en todas las paginas.
 */
export const siteGraph = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": ORG_ID,
      name: "Barbas & Bigotes Barbershop",
      // "Barbas & Bigotes" exacto: es el App name de la pantalla de consentimiento
      // OAuth y Google verifica que coincida con el nombre publicado en la home.
      alternateName: ["Barbas & Bigotes", "Barbas y Bigotes", "Barbas y Bigotes Barranquilla"],
      url: `${BASE}/`,
      logo: {
        "@type": "ImageObject",
        url: `${BASE}/brand/logo-lockup.png`,
      },
      description:
        "Barbería en Barranquilla, Colombia, con dos sedes (Parque Venezuela y Plaza de la Paz): cortes clásicos y degradados, ritual de barba, faciales, keratina y color, con reserva de cita online.",
      disambiguatingDescription:
        "Barbería física en Barranquilla, Colombia. No es la tienda de productos barbasybigotes.co ni la marca española barbasybigotes.es.",
      telephone: "+573006734799",
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "reservas y atención al cliente",
        telephone: "+573006734799",
        url: "https://wa.me/573006734799",
        availableLanguage: "es",
      },
      areaServed: { "@type": "City", name: "Barranquilla" },
      sameAs: [
        "https://instagram.com/barbasybigotes.baq",
        "https://wa.me/573006734799",
        MAPS_PARQUE_VENEZUELA,
        MAPS_PLAZA_DE_LA_PAZ,
      ],
      location: [
        { "@id": SEDE_IDS["parque-venezuela"] },
        { "@id": SEDE_IDS["plaza-de-la-paz"] },
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${BASE}/#website`,
      url: `${BASE}/`,
      name: "Barbas & Bigotes Barbershop",
      inLanguage: "es-CO",
      publisher: { "@id": ORG_ID },
    },
    {
      "@type": "BarberShop",
      "@id": SEDE_IDS["parque-venezuela"],
      name: "Barbas y Bigotes Barbershop - Sede Parque Venezuela",
      parentOrganization: { "@id": ORG_ID },
      url: `${BASE}/`,
      image: `${BASE}/sedes/parque-venezuela-frente.jpg`,
      telephone: "+573004097624",
      priceRange: "$30.000 - $90.000 COP",
      currenciesAccepted: "COP",
      paymentAccepted: "Efectivo, Nequi, Daviplata, datáfono, transferencia",
      address: {
        "@type": "PostalAddress",
        // Direccion literal de la ficha de Google (coincide con el sitio).
        streetAddress: "Cl. 88 #44-10 Loc 4",
        addressLocality: "Barranquilla",
        addressRegion: "Atlántico",
        addressCountry: "CO",
      },
      geo: { "@type": "GeoCoordinates", latitude: 11.002038, longitude: -74.8239875 },
      hasMap: MAPS_PARQUE_VENEZUELA,
      openingHoursSpecification: HORARIO,
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "5.0",
        reviewCount: "5",
        bestRating: "5",
      },
      hasOfferCatalog: { "@id": `${BASE}/#servicios` },
      potentialAction: RESERVAR_ACTION,
    },
    {
      "@type": "BarberShop",
      "@id": SEDE_IDS["plaza-de-la-paz"],
      name: "Barbas y Bigotes Barberclub - Sede Plaza de la Paz",
      parentOrganization: { "@id": ORG_ID },
      url: `${BASE}/`,
      image: `${BASE}/sedes/plaza-de-la-paz-frente.jpg`,
      telephone: "+573006734799",
      priceRange: "$30.000 - $90.000 COP",
      currenciesAccepted: "COP",
      paymentAccepted: "Efectivo, Nequi, Daviplata, datáfono, transferencia",
      address: {
        "@type": "PostalAddress",
        // NAP confirmado por el dueno (jul 2026): la direccion real es la que
        // muestra el sitio. Mantener identica en sitio + ficha Google + llms.txt.
        streetAddress: "Cra. 45 #50-168",
        addressLocality: "Barranquilla",
        addressRegion: "Atlántico",
        addressCountry: "CO",
      },
      geo: { "@type": "GeoCoordinates", latitude: 10.9873701, longitude: -74.7892852 },
      hasMap: MAPS_PLAZA_DE_LA_PAZ,
      openingHoursSpecification: HORARIO,
      // aggregateRating omitido a proposito: la ficha de PPZ esta en 3.7/5 y el
      // audit (docs/GEO-AUDIT-REPORT.md) recomienda no publicar esa senal
      // negativa en el sitio propio hasta que supere ~4.5.
      hasOfferCatalog: { "@id": `${BASE}/#servicios` },
      potentialAction: RESERVAR_ACTION,
    },
    {
      "@type": "OfferCatalog",
      "@id": `${BASE}/#servicios`,
      name: "Servicios y combos",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: "Corte (clasico, degradado, tijera o nino)" },
          priceSpecification: { "@type": "PriceSpecification", minPrice: 30000, priceCurrency: "COP" },
        },
        {
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: "Corte y barba" },
          priceSpecification: { "@type": "PriceSpecification", minPrice: 40000, priceCurrency: "COP" },
        },
        {
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: "Ritual de barba" },
          priceSpecification: { "@type": "PriceSpecification", minPrice: 30000, priceCurrency: "COP" },
        },
        {
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: "Limpieza facial gold" },
          priceSpecification: { "@type": "PriceSpecification", minPrice: 35000, priceCurrency: "COP" },
        },
        {
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: "Keratina" },
          priceSpecification: { "@type": "PriceSpecification", minPrice: 90000, priceCurrency: "COP" },
        },
        {
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: "Corte + limpieza facial gold + bebida" },
          price: 75000,
          priceCurrency: "COP",
        },
      ],
    },
  ],
};

/**
 * ItemList de Person para /barberos, construido con los barberos reales de la
 * DB (nombre, sede y especialidades) para que el schema nunca quede desfasado.
 */
export function barberosItemList(
  barberos: Pick<Barbero, "nombre" | "sede" | "especialidades">[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Barberos de Barbas & Bigotes",
    itemListElement: barberos.map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Person",
        name: b.nombre,
        jobTitle: "Barbero",
        worksFor: { "@id": ORG_ID },
        ...(SEDE_IDS[b.sede] ? { workLocation: { "@id": SEDE_IDS[b.sede] } } : {}),
        ...(b.especialidades.length ? { knowsAbout: b.especialidades } : {}),
      },
    })),
  };
}

/**
 * Preguntas frecuentes de la landing. Fuente unica: el componente Faq renderiza
 * estos textos y el FAQPage JSON-LD se deriva de aca, asi el schema coincide
 * EXACTAMENTE con el contenido visible (regla dura de Google).
 */
export const faqItems = [
  {
    pregunta: "¿Cómo reservo una cita?",
    respuesta:
      "Online en menos de un minuto: eliges sede, servicio, barbero y hora. Te llega la confirmación al correo y el recordatorio antes de la cita.",
  },
  {
    pregunta: "¿Puedo cancelar o reagendar?",
    respuesta:
      "Sí, desde Mi cuenta hasta 2 horas antes de la cita. Si se libera un turno, le avisamos automáticamente a la lista de espera.",
  },
  {
    pregunta: "¿Atienden sin reserva?",
    respuesta:
      "Sí, los walk-ins son bienvenidos. Si el barbero está ocupado, entras a la lista de espera y te avisamos cuando sea tu turno.",
  },
  {
    pregunta: "¿Los precios cambian por sede?",
    respuesta:
      "Algunos servicios tienen precio distinto entre Parque Venezuela y Plaza de la Paz. El precio exacto lo ves al reservar, sin sorpresas.",
  },
];

/** FAQPage JSON-LD derivado de faqItems (mismos textos que el FAQ visible). */
export const faqPage = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((f) => ({
    "@type": "Question",
    name: f.pregunta,
    acceptedAnswer: { "@type": "Answer", text: f.respuesta },
  })),
};

/**
 * Serializa JSON-LD para dangerouslySetInnerHTML escapando "<" (previene
 * inyeccion de </script> en el HTML).
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import "./globals.css";
import { siteGraph, jsonLd } from "@/lib/schema-org";

// El prototipo usa Barlow Condensed 500-800 como display; el 800 carga porque
// los títulos grandes (hero, H1) son font-extrabold.
const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-barlow",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const viewport: Viewport = {
  // Fondo base del prototipo (§0): la status bar acompaña al carbón del sitio.
  themeColor: "#0c0b0a",
  // PWA iOS con status bar translúcida: el contenido se dibuja hasta el notch
  // y el header compensa con env(safe-area-inset-top).
  viewportFit: "cover",
};

const DESCRIPTION =
  "Barbería en Barranquilla con dos sedes: Parque Venezuela y Plaza de la Paz. Cortes, barba, faciales, keratina y combos. Reservá tu cita online.";

export const metadata: Metadata = {
  metadataBase: new URL("https://barbasybigotes.com"),
  title: {
    default: "Barbas & Bigotes Barbershop | Barbería en Barranquilla",
    template: "%s · Barbas & Bigotes",
  },
  description: DESCRIPTION,
  // "./" se resuelve contra el pathname de cada página (canonical self-referencing).
  alternates: { canonical: "./" },
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: "./",
    siteName: "Barbas & Bigotes Barbershop",
    title: "Barbas & Bigotes Barbershop | Barbería en Barranquilla",
    description: DESCRIPTION,
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "Barbas & Bigotes Barbershop, barbería en Barranquilla",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og.jpg"],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Barbas & Bigotes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${barlow.variable} ${inter.variable} antialiased`}
    >
      <body>
        {/* Grafo de entidad (Organization + WebSite + 2 sedes BarberShop):
            server-rendered para que los crawlers de IA lo vean sin ejecutar JS. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(siteGraph) }}
        />
        {children}
      </body>
    </html>
  );
}

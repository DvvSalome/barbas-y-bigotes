import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import "./globals.css";
import { WhatsAppFloatingButton } from "@/components/WhatsAppFloatingButton";

const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-barlow",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const viewport: Viewport = {
  themeColor: "#D4AF37",
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
        {children}
        <WhatsAppFloatingButton />
      </body>
    </html>
  );
}

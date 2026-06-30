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
};

export const metadata: Metadata = {
  title: "Barbas & Bigotes Barbershop",
  description:
    "Reserva tu cita en Barbas & Bigotes — sedes Parque Venezuela y Plaza de la Paz. Cortes, barba, faciales y más.",
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

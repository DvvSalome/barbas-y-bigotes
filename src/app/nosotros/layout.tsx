import type { Metadata } from "next";

// La página es un client component, así que el metadata vive en este layout.
export const metadata: Metadata = {
  title: "Nosotros",
  description:
    "La historia y la filosofía de Barbas & Bigotes: tradición, estilo y el ritual clásico de la barbería en Barranquilla.",
};

export default function NosotrosLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

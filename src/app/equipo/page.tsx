import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/data/queries";

export const metadata: Metadata = { title: "Equipo", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Arranque de la app del equipo (start_url de manifest-staff.json y destino de
// AbrirComoEquipo): cada uno a su pantalla. El dueño al panel, barberos y
// mostrador a /barbero, y sin sesión al login del staff.
export default async function Equipo() {
  const { rol } = await getStaffContext();
  if (rol === "admin") redirect("/admin");
  if (rol === "barbero" || rol === "sede") redirect("/barbero");
  redirect("/login");
}

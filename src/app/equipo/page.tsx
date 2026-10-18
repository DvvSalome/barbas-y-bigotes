import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/data/queries";
import { IrAMiApp } from "@/components/staff/AppEquipo";
import { APP_EQUIPO_META } from "@/lib/app-equipo";

// Es el start_url de la app general del equipo: enlaza SU manifiesto (no el de
// clientes), ahora que sin sesión se queda un instante en pantalla.
export const metadata: Metadata = { ...APP_EQUIPO_META, title: "Equipo", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Arranque de la app del equipo (start_url de manifest-staff.json y destino de
// AbrirComoEquipo): cada uno a su pantalla. El dueño al panel, barberos y
// mostrador a /barbero. Sin sesión, al teclado de PIN del último que entró en
// este aparato (lo recuerda el navegador, por eso lo decide el cliente) o, si no
// hay nadie recordado, al login general del staff.
export default async function Equipo() {
  const { rol } = await getStaffContext();
  if (rol === "admin") redirect("/admin");
  if (rol === "barbero" || rol === "sede") redirect("/barbero");
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10 text-center">
      <IrAMiApp />
      <div>
        <p className="text-sm text-muted">Abriendo…</p>
        <Link href="/login" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4">
          Entrar al equipo
        </Link>
      </div>
    </main>
  );
}

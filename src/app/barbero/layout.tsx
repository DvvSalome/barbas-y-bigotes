import { cache } from "react";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getRutaApp, getStaffContext } from "@/lib/data/queries";
import { TEMA_COOKIE, temaDesdeCookie } from "@/lib/tema";
import { PerfilMenu } from "@/components/staff/PerfilMenu";
import { TemaBoton } from "@/components/staff/TemaBoton";
import { RecordarEquipo } from "@/components/staff/AppEquipo";
import { APP_EQUIPO_META, metaAppPersonal } from "@/lib/app-equipo";
import type { Metadata } from "next";

// La sesión y su app propia se leen una vez por render (layout + metadata).
const sesion = cache(getStaffContext);
const rutaDeLaSesion = cache(async () => getRutaApp(await sesion()));

// Manifiesto PROPIO del staff (ver src/lib/app-equipo.ts). Un barbero o el
// mostrador que hace "Agregar a inicio" desde su agenda se lleva SU app
// (/equipo/<slug>, la misma que le manda el dueño por WhatsApp); el dueño, la
// general del equipo, que abre en /equipo. El que la instala desde el sitio
// público sigue con la de siempre, que abre en la portada.
export async function generateMetadata(): Promise<Metadata> {
  const staff = await sesion();
  const ruta = await rutaDeLaSesion();
  if (!ruta || (staff.rol !== "barbero" && staff.rol !== "sede")) return APP_EQUIPO_META;
  return metaAppPersonal({ tipo: staff.rol, nombre: staff.nombre, ruta });
}

export default async function BarberoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Deny-by-default: solo staff entra. Un cliente Google NO tiene fila en
  // profiles, así que un guard que solo expulsa rol === 'cliente' lo dejaba pasar.
  const staff = await sesion();
  if (staff.rol === "anon") redirect("/login");
  // `sede` es el perfil del mostrador (0044): entra acá, NO al back-office.
  if (!["admin", "barbero", "sede"].includes(staff.rol)) redirect("/cuenta");

  // Tema del staff desde la cookie (SSR sin flash). cookies() vuelve dinámico
  // el layout, pero /barbero ya lo es (getStaffContext lee la sesión).
  const tema = temaDesdeCookie((await cookies()).get(TEMA_COOKIE)?.value);
  // El aparato recuerda la app de quien entró: si mañana abre sin sesión, cae
  // en SU teclado de PIN y no en la lista de todos.
  const ruta = await rutaDeLaSesion();

  return (
    <div data-staff data-theme={tema} className="min-h-dvh">
      <RecordarEquipo ruta={ruta} />
      {/* pt safe-area: en la app instalada del iPhone (status bar translúcida) la
          cabecera queda debajo de la hora y la isla, no encima. */}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/70 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <Link href="/" aria-label="Barbas & Bigotes">
            <Image src="/brand/logo-lockup.png" alt="Barbas & Bigotes" width={1024} height={348} className="logo-staff h-10 w-auto" />
          </Link>
          <div className="flex items-center gap-2.5">
            {staff.nombre && (
              <span className="text-sm font-semibold text-ink">{staff.nombre.split(" ")[0]}</span>
            )}
            {/* Claro/oscuro a un toque: la tablet del local pasa del sol de la
                mañana a la luz artificial de la noche en la misma jornada. */}
            <TemaBoton />
            <PerfilMenu nombre={staff.nombre || "Barbero"} fotoUrl={staff.fotoUrl} salidaHref="/login" />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getStaffContext } from "@/lib/data/queries";
import { TEMA_COOKIE, temaDesdeCookie } from "@/lib/tema";
import { PerfilMenu } from "@/components/staff/PerfilMenu";

export default async function BarberoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Deny-by-default: solo staff entra. Un cliente Google NO tiene fila en
  // profiles, así que un guard que solo expulsa rol === 'cliente' lo dejaba pasar.
  const staff = await getStaffContext();
  if (staff.rol === "anon") redirect("/entrar");
  if (staff.rol !== "admin" && staff.rol !== "barbero") redirect("/cuenta");

  // Tema del staff desde la cookie (SSR sin flash). cookies() vuelve dinámico
  // el layout, pero /barbero ya lo es (getStaffContext lee la sesión).
  const tema = temaDesdeCookie((await cookies()).get(TEMA_COOKIE)?.value);

  return (
    <div data-staff data-theme={tema} className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <Link href="/" aria-label="Barbas & Bigotes">
            <Image src="/brand/logo-lockup.png" alt="Barbas & Bigotes" width={1024} height={348} className="h-10 w-auto" />
          </Link>
          <div className="flex items-center gap-3.5">
            <span className="text-xs uppercase tracking-[0.3em] text-accent">App del barbero</span>
            <PerfilMenu nombre={staff.nombre || "Barbero"} salidaHref="/entrar" />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

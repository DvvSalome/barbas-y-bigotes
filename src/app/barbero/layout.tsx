import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/data/queries";

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

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <Link href="/" aria-label="Barbas & Bigotes">
            <Image src="/brand/logo-lockup.png" alt="Barbas & Bigotes" width={1024} height={348} className="h-10 w-auto" />
          </Link>
          <span className="text-xs uppercase tracking-[0.3em] text-accent">App del barbero</span>
        </div>
      </header>
      {children}
    </>
  );
}

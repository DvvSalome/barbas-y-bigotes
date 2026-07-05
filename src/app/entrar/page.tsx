import type { Metadata } from "next";
import { getBarberos, getSedes } from "@/lib/data/queries";
import { BarberoPinLogin } from "@/components/barbero/BarberoPinLogin";

export const metadata: Metadata = { title: "Entrar · Barbas & Bigotes" };

// Gateway de login del staff: no cachear la lista de barberos (un barbero nuevo
// debe poder entrar sin esperar un rebuild).
export const dynamic = "force-dynamic";

export default async function EntrarPage() {
  const [barberos, sedes] = await Promise.all([getBarberos(), getSedes()]);
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-10">
      <BarberoPinLogin barberos={barberos} sedes={sedes} />
    </main>
  );
}

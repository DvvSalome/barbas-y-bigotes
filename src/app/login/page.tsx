import type { Metadata } from "next";
import { getBarberos, getSedes } from "@/lib/data/queries";
import { StaffLogin } from "@/components/staff/StaffLogin";

export const metadata: Metadata = { title: "Entrar" };

// Gateway único del staff: se elige perfil (barbero/admin) y va el login que
// toca. No cachear la lista de barberos (un barbero nuevo debe poder entrar sin
// esperar un rebuild).
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const [barberos, sedes] = await Promise.all([getBarberos(), getSedes()]);
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-10">
      <StaffLogin barberos={barberos} sedes={sedes} />
    </main>
  );
}

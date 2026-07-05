import type { Metadata } from "next";
import { getBarberos, getSedes } from "@/lib/data/queries";
import { getBarberosPinEstado } from "@/lib/barbero-auth";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { EquipoPinAdmin } from "@/components/admin/EquipoPinAdmin";

export const metadata: Metadata = { title: "Equipo · Admin" };

export default async function EquipoPage() {
  const [barberos, sedes, estado] = await Promise.all([getBarberos(), getSedes(), getBarberosPinEstado()]);
  return (
    <div className="max-w-3xl">
      <SectionHeader
        eyebrow="Acceso"
        title="Equipo"
        description="Asigná el PIN de 6 dígitos con el que cada barbero entra a su app desde /entrar."
      />
      <div className="mt-5">
        <EquipoPinAdmin barberos={barberos} sedes={sedes} estado={estado} />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { getBarberos, getSedes, getAusencias, getDiasEspeciales } from "@/lib/data/queries";
import { getBarberosPinEstado } from "@/lib/barbero-auth";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { EquipoPinAdmin } from "@/components/admin/EquipoPinAdmin";
import { AusenciasAdmin } from "@/components/admin/AusenciasAdmin";
import { DiasEspecialesAdmin } from "@/components/admin/DiasEspecialesAdmin";

export const metadata: Metadata = { title: "Equipo · Admin" };

export default async function EquipoPage() {
  const [barberos, sedes, estado, ausencias, diasEspeciales] = await Promise.all([
    getBarberos(),
    getSedes(),
    getBarberosPinEstado(),
    getAusencias(),
    getDiasEspeciales(),
  ]);
  return (
    <div className="max-w-3xl">
      <SectionHeader
        eyebrow="Acceso"
        title="Equipo"
        description="Asigná el PIN de 6 dígitos con el que cada barbero entra a su app desde /login."
      />
      <div className="mt-5">
        <EquipoPinAdmin barberos={barberos} sedes={sedes} estado={estado} />
      </div>

      <div className="mt-10">
        <SectionHeader
          eyebrow="Disponibilidad"
          title="Ausencias"
          description="Si un barbero no va un día, marcalo acá: deja de aparecer para reservar esa fecha y no se le pueden agendar citas nuevas."
        />
        <div className="mt-5">
          <AusenciasAdmin barberos={barberos} sedes={sedes} ausencias={ausencias} />
        </div>
      </div>

      <div className="mt-10">
        <SectionHeader
          eyebrow="Calendario"
          title="Días especiales"
          description="Abre un domingo o un festivo, o cierra un día hábil. Por defecto se atiende de lunes a sábado."
        />
        <div className="mt-5">
          <DiasEspecialesAdmin sedes={sedes} dias={diasEspeciales} />
        </div>
      </div>
    </div>
  );
}

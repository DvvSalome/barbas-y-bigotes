import type { Metadata } from "next";
import { getBarberos, getSedes, getAusencias, getDiasEspeciales } from "@/lib/data/queries";
import { bogotaYmd } from "@/lib/slots";
import { getBarberosPinEstado, getSedesPinEstado } from "@/lib/barbero-auth";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { EquipoPinAdmin } from "@/components/admin/EquipoPinAdmin";
import { SedePinAdmin } from "@/components/admin/SedePinAdmin";
import { AusenciasAdmin } from "@/components/admin/AusenciasAdmin";
import { DiasEspecialesAdmin } from "@/components/admin/DiasEspecialesAdmin";

export const metadata: Metadata = { title: "Equipo · Admin" };

export default async function EquipoPage() {
  const [barberos, sedes, estado, estadoSedes, ausencias, diasEspeciales] = await Promise.all([
    getBarberos(),
    getSedes(),
    getBarberosPinEstado(),
    getSedesPinEstado(),
    getAusencias(),
    getDiasEspeciales(),
  ]);
  return (
    <div className="max-w-3xl">
      <SectionHeader
        eyebrow="Acceso"
        title="Quién entra a la app"
        description="El PIN del mostrador lo usa todo el equipo del local; el de cada barbero es personal. Los dos entran desde /login."
      />

      {/* Primero el mostrador: es la forma normal de entrar en el local. */}
      <div className="mt-5">
        <h2 className="mb-3 text-xs uppercase tracking-[0.3em] text-accent">PIN del mostrador</h2>
        <SedePinAdmin sedes={sedes} estado={estadoSedes} />
      </div>

      <h2 className="mb-3 mt-8 text-xs uppercase tracking-[0.3em] text-accent">PIN de cada barbero</h2>
      <div>
        <EquipoPinAdmin
          barberos={barberos}
          sedes={sedes}
          estado={estado}
          ausentesHoy={ausencias.filter((a) => a.fecha === bogotaYmd()).map((a) => a.barberoId)}
        />
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

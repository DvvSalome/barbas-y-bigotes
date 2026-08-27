import type { Metadata } from "next";
import Link from "next/link";
import { getBarberos, getSedes, getAusenciasAdmin, getEmailsBarberos } from "@/lib/data/queries";
import { bogotaYmd } from "@/lib/slots";
import { getBarberosPinEstado, getSedesPinEstado } from "@/lib/barbero-auth";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { EquipoPinAdmin } from "@/components/admin/EquipoPinAdmin";
import { SedePinAdmin } from "@/components/admin/SedePinAdmin";
import { AusenciasAdmin } from "@/components/admin/AusenciasAdmin";
import { CorreosBarberos } from "@/components/admin/CorreosBarberos";

export const metadata: Metadata = { title: "Equipo · Admin" };

export default async function EquipoPage() {
  const [barberos, sedes, estado, estadoSedes, ausencias, emails] = await Promise.all([
    getBarberos(),
    getSedes(),
    getBarberosPinEstado(),
    getSedesPinEstado(),
    getAusenciasAdmin(),
    getEmailsBarberos(),
  ]);
  return (
    <div className="max-w-6xl">
      <SectionHeader
        eyebrow="Acceso"
        title="Quién entra a la app"
        description="El PIN del mostrador lo usa todo el equipo del local; el de cada barbero es personal. Los dos entran desde /login."
      />

      {/* DOS PANELES en escritorio (patrón del panel): a la izquierda el ACCESO
          (PIN del mostrador + PIN de cada barbero); a la derecha, FIJAS, las
          ausencias — se marca quién falta viendo al equipo, sin bajar una
          columna eterna. En móvil se apila en el mismo orden de siempre. */}
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <section className="min-w-0">
          <h2 className="mb-3 text-xs uppercase tracking-[0.3em] text-accent">PIN del mostrador</h2>
          <SedePinAdmin sedes={sedes} estado={estadoSedes} />

          <h2 className="mb-3 mt-8 text-xs uppercase tracking-[0.3em] text-accent">PIN de cada barbero</h2>
          <EquipoPinAdmin
            barberos={barberos}
            sedes={sedes}
            estado={estado}
            ausentesHoy={ausencias.filter((a) => a.fecha === bogotaYmd()).map((a) => a.barberoId)}
          />

          <h2 className="mb-3 mt-8 text-xs uppercase tracking-[0.3em] text-accent">Correo de avisos</h2>
          <p className="mb-3 text-[12.5px] text-muted">
            Cuando un cliente reserva, al barbero le llega un correo con la cita al instante. Poné acá el correo de
            cada uno; vacío = sin aviso (le queda solo la notificación push, si la tiene activa).
          </p>
          <CorreosBarberos barberos={barberos} emails={emails} />
        </section>

        <aside className="lg:sticky lg:top-28 lg:max-h-[calc(100dvh-8.5rem)] lg:overflow-y-auto">
          <h2 className="mb-3 text-xs uppercase tracking-[0.3em] text-accent">Ausencias</h2>
          <p className="mb-4 text-[12.5px] text-muted">
            Si un barbero no va un día, marcalo acá: deja de aparecer para reservar esa fecha. Los bloqueos por horas
            (almuerzo) se crean desde el calendario y también se listan abajo.
          </p>
          <AusenciasAdmin barberos={barberos} sedes={sedes} ausencias={ausencias} />
        </aside>
      </div>

      {/* El horario de la sede (semana + días especiales) se movió a su propia
          sección "Horarios": acá viven las cosas del EQUIPO (personas), allá las
          del LOCAL (cuándo abre). */}
      <div className="mt-10 rounded-2xl border border-line bg-panel px-4 py-4">
        <p className="text-[13px] text-muted">
          ¿Buscas los horarios de la barbería (abrir un festivo, cambiar un sábado)? Ahora están en{" "}
          <Link href="/admin/horarios" className="font-semibold text-accent-soft hover:underline">
            Equipo → Horarios
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

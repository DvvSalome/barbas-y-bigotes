import type { Metadata } from "next";
import Link from "next/link";
import { getSedes, getAusenciasAdmin, getEmailsBarberos, getCalendarEstado, getAjustesEquipo, getFichasEquipo } from "@/lib/data/queries";
import { bogotaYmd } from "@/lib/slots";
import { getBarberosPinEstado, getSedesPinEstado } from "@/lib/barbero-auth";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { EquipoFichas } from "@/components/admin/EquipoFichas";
import { EquipoLocal } from "@/components/admin/EquipoLocal";

export const metadata: Metadata = { title: "Equipo · Admin" };

/*
  El equipo, en fichas (paso 20 de la tanda 2).

  Antes esta pantalla apilaba seis secciones y el mismo barbero aparecía en tres
  de ellas (PIN, correo, agenda de Google). Medía 5.269 px a 390 px: la más larga
  del panel. Ahora son dos grupos de filas —lo del LOCAL y las PERSONAS— y todo
  lo demás vive detrás de la fila que lo nombra.

  Desde el 14-oct las personas se dan de alta, se editan y se dan de baja desde
  acá (src/lib/equipo-actions.ts): el dueño ya no depende de soporte para que
  entre o salga alguien.
*/
export default async function EquipoPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const ficha = typeof sp.ficha === "string" && /^[0-9a-f-]{36}$/i.test(sp.ficha) ? sp.ficha : null;

  const [fichas, sedes, estado, estadoSedes, ausencias, emails, calendar, ajustesEquipo] = await Promise.all([
    getFichasEquipo(),
    getSedes(),
    getBarberosPinEstado(),
    getSedesPinEstado(),
    getAusenciasAdmin(),
    getEmailsBarberos(),
    getCalendarEstado(),
    getAjustesEquipo(),
  ]);
  const barberos = fichas.filter((f) => f.activo);
  const inactivos = fichas.filter((f) => !f.activo);

  const sinCorreo = barberos.filter((b) => !emails[b.id]).length;

  return (
    <div className="max-w-3xl">
      <SectionHeader
        eyebrow="Equipo"
        title="Quién trabaja acá"
        description="Cada barbero tiene su ficha: lo que le falta para trabajar con la app, su PIN, el correo al que le avisamos las citas, su agenda de Google, su foto y su contrato. Desde aquí también se agrega uno nuevo o se da de baja al que se va."
      />

      {sinCorreo > 0 && (
        <p className="mt-4 rounded-xl border border-warn/40 bg-warn/[0.08] px-3.5 py-2.5 text-[12.5px] text-warn">
          <b>
            {sinCorreo} de {barberos.length} barberos sin correo
          </b>
          : a ellos no les llega ningún aviso cuando les reservan.
        </p>
      )}

      <EquipoLocal
        sedes={sedes}
        estadoSedes={estadoSedes}
        barberoVeSemana={ajustesEquipo.barberoVeSemana}
        calendar={calendar}
        barberos={barberos}
        emails={emails}
        ausencias={ausencias}
      />

      <EquipoFichas
        // Con ?ficha= distinto (un enlace del Inicio) se vuelve a montar y abre esa.
        key={ficha ?? "-"}
        barberos={barberos}
        inactivos={inactivos}
        sedes={sedes}
        estado={estado}
        emails={emails}
        calendar={calendar}
        ausentesHoy={ausencias.filter((a) => a.fecha === bogotaYmd()).map((a) => a.barberoId)}
        fichaInicial={ficha}
      />

      {/* El horario de la sede (semana + días especiales) se movió a su propia
          sección "Horarios": acá viven las cosas del EQUIPO (personas), allá las
          del LOCAL (cuándo abre). */}
      <p className="mt-8 rounded-2xl border border-line bg-panel px-4 py-4 text-[13px] text-muted">
        ¿Buscas los horarios de la barbería (abrir un festivo, cambiar un sábado)? Están en{" "}
        <Link
          href="/admin/horarios"
          className="inline-flex min-h-11 items-center font-semibold text-ink/85 underline decoration-line underline-offset-4 transition hover:text-ink"
        >
          Equipo → Horarios
        </Link>
        .
      </p>
    </div>
  );
}

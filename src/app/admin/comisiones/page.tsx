import type { Metadata } from "next";
import { cop } from "@/lib/format";
import { getBarberosContrato, getSedes } from "@/lib/data/queries";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { ContratoEditable } from "@/components/admin/ContratoEditable";
import { CaraBarbero } from "@/components/staff/Elegir";

export const metadata: Metadata = { title: "Comisiones · Admin" };

export default async function ComisionesPage() {
  const [barberos, sedes] = await Promise.all([getBarberosContrato(), getSedes()]);
  const sedeNombre = (id: string) => sedes.find((s) => s.id === id)?.nombre ?? id;

  // Un vistazo al reparto antes del detalle: cuántos van por comisión y cuántos
  // pagan silla, y cuánto arriendo entra fijo al mes.
  const porComision = barberos.filter((b) => b.tipoContrato !== "arriendo");
  const porArriendo = barberos.filter((b) => b.tipoContrato === "arriendo");
  const arriendoTotal = porArriendo.reduce((a, b) => a + (b.arriendoMensual ?? 0), 0);

  return (
    <div className="max-w-4xl">
      <SectionHeader
        eyebrow="Equipo"
        title="Comisiones y contratos"
        description={
          <>
            Con qué trabaja cada barbero: <span className="text-ink">porcentaje</span> de lo que cobra o{" "}
            <span className="text-ink">arriendo de silla</span>. Es lo que usa el cobro para repartir.
          </>
        }
      />

      <p className="mt-5 text-[13px] text-muted">
        Toca el contrato de un barbero para cambiarlo. Aplica desde el próximo cobro; lo ya cobrado no se
        recalcula.
      </p>

      {/* Resumen del reparto */}
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 rounded-2xl border border-line bg-panel px-4 py-3 text-[13px]">
        <span className="text-muted">
          <span className="font-semibold text-ink tabular-nums">{porComision.length}</span> por comisión
        </span>
        <span className="text-muted">
          <span className="font-semibold text-ink tabular-nums">{porArriendo.length}</span> por arriendo
        </span>
        {arriendoTotal > 0 && (
          <span className="text-muted">
            <span className="font-semibold text-ink tabular-nums">{cop(arriendoTotal)}</span> de arriendo al mes
          </span>
        )}
      </div>

      {/* Una sola lista para móvil y escritorio: la fila ya es legible en 390px,
          no hacía falta duplicar el marcado en cards + tabla. */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-panel">
        {barberos.map((b) => (
          <div
            key={b.id}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-line/60 px-4 py-3 last:border-b-0"
          >
            <div className="flex min-w-0 items-center gap-3">
              {/* La MISMA cara que Equipo/Ausencias (CaraBarbero): el armado a
                  mano encuadraba la foto distinto entre secciones. */}
              <CaraBarbero b={{ id: b.id, nombre: b.nombre, fotoUrl: b.fotoUrl }} size={36} />
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-semibold text-ink">{b.nombre}</span>
                <span className="block truncate text-[11.5px] text-muted">{sedeNombre(b.sede)}</span>
              </span>
            </div>
            <ContratoEditable
              barberoId={b.id}
              nombre={b.nombre}
              tipo={b.tipoContrato}
              comisionPct={b.comisionPct}
              arriendoMensual={b.arriendoMensual}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

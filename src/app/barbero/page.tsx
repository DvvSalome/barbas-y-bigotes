import type { Metadata } from "next";
import {
  getSedes,
  getBarberos,
  getServicios,
  getPreciosServiciosStaff,
  getProductos,
  getAgendaHoy,
  getListaEspera,
  getStaffContext,
  getMedios,
  getCajaSede,
} from "@/lib/data/queries";
import { AgendaList } from "@/components/barbero/AgendaList";
import { EsperaPanel } from "@/components/barbero/EsperaPanel";
import { CierreCaja } from "@/components/barbero/CierreCaja";
import { RealtimeRefresh } from "@/components/motion/RealtimeRefresh";

export const metadata: Metadata = { title: "App del barbero" };

export default async function BarberoPage() {
  const staff = await getStaffContext();
  const filtro = staff.rol === "barbero" ? staff.barberoId : null;
  const [sedes, barberos, servicios, preciosServicios, productos, medios, agenda, espera] =
    await Promise.all([
      getSedes(),
      getBarberos(),
      getServicios(),
      getPreciosServiciosStaff(),
      getProductos(),
      getMedios(),
      getAgendaHoy(filtro),
      getListaEspera(filtro),
    ]);

  // Cierre de caja: sólo para el barbero, sobre SU sede (el admin cierra en
  // /admin/cuadre). La caja se abre sola con la primera venta del día.
  const sedeBarbero =
    staff.rol === "barbero" ? barberos.find((b) => b.id === staff.barberoId)?.sede ?? null : null;
  const caja = sedeBarbero ? await getCajaSede(sedeBarbero) : null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <RealtimeRefresh
        subscriptions={[
          { table: "reservas", filter: filtro ? `barbero_id=eq.${filtro}` : undefined },
          { table: "lista_espera", filter: filtro ? `barbero_id=eq.${filtro}` : undefined },
        ]}
      />
      <h1 className="font-display text-4xl font-semibold uppercase">Agenda de hoy</h1>
      <p className="mt-2 text-sm text-muted">
        Clientes programados y walk-ins. Marcá la llegada, completá la atención y cobrá. El
        historial de cada cliente está a un clic.
      </p>
      <div className="mt-8">
        <AgendaList
          agenda={agenda}
          sedes={sedes}
          barberos={barberos}
          servicios={servicios}
          preciosServicios={preciosServicios}
          productos={productos}
          medios={medios}
          esAdmin={staff.rol === "admin"}
        />
      </div>

      <div className="mt-14 border-t border-line pt-10">
        <EsperaPanel espera={espera} sedes={sedes} barberos={barberos} servicios={servicios} />
      </div>

      {sedeBarbero && (
        <div className="mt-14 border-t border-line pt-10">
          <CierreCaja caja={caja} />
        </div>
      )}
    </main>
  );
}

import type { Metadata } from "next";
import {
  getSedes,
  getBarberos,
  getServicios,
  getPreciosServiciosStaff,
  getProductos,
  getListaEspera,
  getStaffContext,
  getMedios,
  getCajaSede,
  getCajaDesglose,
  getAgendaSedeHoy,
  getCobradoSedeHoy,
} from "@/lib/data/queries";
import { AgendaList } from "@/components/barbero/AgendaList";
import { EsperaPanel } from "@/components/barbero/EsperaPanel";
import { CierreCaja } from "@/components/barbero/CierreCaja";
import { RealtimeRefresh } from "@/components/motion/RealtimeRefresh";

export const metadata: Metadata = { title: "Mostrador" };

export default async function BarberoPage() {
  const staff = await getStaffContext();
  const filtro = staff.rol === "barbero" ? staff.barberoId : null;
  const [sedes, barberos, servicios, preciosServicios, productos, medios, espera] = await Promise.all([
    getSedes(),
    getBarberos(),
    getServicios(),
    getPreciosServiciosStaff(),
    getProductos(),
    getMedios(),
    getListaEspera(filtro),
  ]);

  // Cierre de caja: sólo para el barbero, sobre SU sede (el admin cierra en
  // /admin/cuadre). La caja se abre sola con la primera venta del día.
  const sedeBarbero =
    staff.rol === "barbero" ? barberos.find((b) => b.id === staff.barberoId)?.sede ?? null : null;
  const [caja, cajaDesglose] = sedeBarbero
    ? await Promise.all([getCajaSede(sedeBarbero), getCajaDesglose(sedeBarbero)])
    : [null, null];

  // MOSTRADOR: la única vista. El equipo comparte un aparato en el local y opera
  // la sede entera desde acá; la comisión igual cae en el barbero de la cita
  // (el server la fija desde reservas.barbero_id, no desde quién está logueado).
  // Lectura con service role ya autorizada acá: el barbero pertenece a esa sede
  // por definición, y el dueño ve las dos.
  const [agendaSede, cobradoSede] = await Promise.all([
    getAgendaSedeHoy(sedeBarbero),
    getCobradoSedeHoy(sedeBarbero),
  ]);
  const mostrador = {
    sedeNombre: sedeBarbero
      ? sedes.find((s) => s.id === sedeBarbero)?.nombre ?? "Mi sede"
      : "Todas las sedes",
    agendaSede,
    // El dueño ve a todo el equipo; el barbero, solo a los de su sede.
    barberosSede: sedeBarbero ? barberos.filter((b) => b.sede === sedeBarbero) : barberos,
    cobradoSede: cobradoSede.total,
    porBarbero: cobradoSede.porBarbero,
  };


  return (
    <main className={`mx-auto px-4 py-6 sm:px-6 ${mostrador ? "max-w-6xl" : "max-w-2xl"}`}>
      <RealtimeRefresh
        subscriptions={[
          // Sin filtro por barbero cuando hay mostrador: la pantalla compartida
          // debe reaccionar a las citas de todo el equipo, no solo a las propias.
          { table: "reservas", filter: mostrador || !filtro ? undefined : `barbero_id=eq.${filtro}` },
          { table: "lista_espera", filter: filtro ? `barbero_id=eq.${filtro}` : undefined },
        ]}
        dingOnInsertTable="reservas"
      />
      <AgendaList
        agenda={agendaSede}
        sedes={sedes}
        barberos={barberos}
        servicios={servicios}
        preciosServicios={preciosServicios}
        productos={productos}
        medios={medios}
        esAdmin={staff.rol === "admin"}
        mostrador={mostrador}
      />

      <div className="mx-auto mt-12 w-full max-w-2xl border-t border-line pt-8">
        <EsperaPanel espera={espera} sedes={sedes} barberos={barberos} servicios={servicios} />
      </div>

      {sedeBarbero && (
        <div className="mx-auto mt-12 w-full max-w-2xl border-t border-line pt-8">
          <CierreCaja caja={caja} desglose={cajaDesglose} miBarberoId={staff.barberoId} />
        </div>
      )}
    </main>
  );
}

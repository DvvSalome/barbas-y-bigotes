import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
  getAgendaSedeDia,
  getBloqueosDia,
  getVentasSedeHoy,
  getHorarioSemanal,
  getDiasEspeciales,
} from "@/lib/data/queries";
import { bogotaYmd } from "@/lib/slots";
import type { SedeId } from "@/lib/data/types";
import { AgendaList } from "@/components/barbero/AgendaList";
import { AgendaDia } from "@/components/admin/AgendaDia";
import { CobradosHoy } from "@/components/barbero/CobradosHoy";
import { AvisosBarbero } from "@/components/barbero/AvisosBarbero";
import { EsperaPanel } from "@/components/barbero/EsperaPanel";
import { CierreCaja } from "@/components/barbero/CierreCaja";
import { RealtimeRefresh } from "@/components/motion/RealtimeRefresh";

export const metadata: Metadata = { title: "Mostrador" };

export default async function BarberoPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; tab?: string }>;
}) {
  const sp = await searchParams;
  const staff = await getStaffContext();
  // Gate PROPIO de la pagina, no solo del layout: Next renderiza layout y pagina
  // en paralelo, asi que el redirect() del layout NO frena los fetches de aca a
  // tiempo. Esta pagina lee con service_role (getAgendaSedeHoy/getVentasSedeHoy),
  // que bypassa RLS; sin este corte, el RSC de un cliente autenticado podria
  // transmitir la agenda de las DOS sedes antes de que el layout lo expulse.
  if (!["admin", "barbero", "sede"].includes(staff.rol)) redirect("/cuenta");
  const filtro = staff.rol === "barbero" ? staff.barberoId : null;
  const [sedes, barberos, servicios, preciosServicios, productos, medios, espera, horarioSemanal, diasEspeciales] =
    await Promise.all([
      getSedes(),
      getBarberos(),
      getServicios(),
      getPreciosServiciosStaff(),
      getProductos(),
      getMedios(),
      // El perfil por sede ve la espera de SU sede; el barbero, la suya propia.
      getListaEspera(filtro, staff.sedeId),
      getHorarioSemanal(),
      getDiasEspeciales(),
    ]);

  // La sede que se opera. Un perfil por sede (0044) trae la suya en el perfil;
  // un barbero, la de su ficha. El dueño (admin) no tiene → null = las dos.
  // Sin esta rama, el mostrador de sede caía en la vista del dueño ("Todas las
  // sedes") y se quedaba sin cierre de caja.
  const sedeBarbero =
    staff.rol === "barbero"
      ? barberos.find((b) => b.id === staff.barberoId)?.sede ?? null
      : staff.sedeId ?? null;
  const [caja, cajaDesglose] = sedeBarbero
    ? await Promise.all([getCajaSede(sedeBarbero), getCajaDesglose(sedeBarbero)])
    : [null, null];

  // MOSTRADOR: la única vista. El equipo comparte un aparato en el local y opera
  // la sede entera desde acá; la comisión igual cae en el barbero de la cita
  // (el server la fija desde reservas.barbero_id, no desde quién está logueado).
  // Lectura con service role ya autorizada acá: el barbero pertenece a esa sede
  // por definición, y el dueño ve las dos.
  // Calendario (pestaña Agenda): el día pedido por ?fecha=, hoy por defecto.
  const hoy = bogotaYmd();
  const fechaCal = /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha ?? "") ? sp.fecha! : hoy;
  const idsSede = sedeBarbero ? barberos.filter((b) => b.sede === sedeBarbero).map((b) => b.id) : [];
  const [agendaSede, ventasSede, agendaCal, bloqueosCal] = await Promise.all([
    getAgendaSedeHoy(sedeBarbero),
    getVentasSedeHoy(sedeBarbero),
    sedeBarbero ? getAgendaSedeDia(sedeBarbero, fechaCal) : Promise.resolve(null),
    sedeBarbero ? getBloqueosDia(idsSede, fechaCal) : Promise.resolve([]),
  ]);
  // El "cobrado hoy" sale de las mismas ventas que la lista de abajo: un solo
  // viaje, y el número del encabezado siempre cuadra con lo que se ve detallado.
  const porBarbero: Record<string, number> = {};
  let cobradoTotal = 0;
  for (const v of ventasSede) {
    cobradoTotal += v.total;
    if (v.barberoId) porBarbero[v.barberoId] = (porBarbero[v.barberoId] ?? 0) + v.total;
  }
  const mostrador = {
    sedeId: sedeBarbero,
    sedeNombre: sedeBarbero
      ? sedes.find((s) => s.id === sedeBarbero)?.nombre ?? "Mi sede"
      : "Todas las sedes",
    agendaSede,
    // El dueño ve a todo el equipo; el barbero, solo a los de su sede.
    barberosSede: sedeBarbero ? barberos.filter((b) => b.sede === sedeBarbero) : barberos,
    cobradoSede: cobradoTotal,
    porBarbero,
  };


  return (
    // pb-28: aire para la barra fija de pestañas del mostrador.
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6">
      <RealtimeRefresh
        subscriptions={[
          // Sin filtro por barbero cuando hay mostrador: la pantalla compartida
          // debe reaccionar a las citas de todo el equipo, no solo a las propias.
          { table: "reservas", filter: mostrador || !filtro ? undefined : `barbero_id=eq.${filtro}` },
          { table: "lista_espera", filter: filtro ? `barbero_id=eq.${filtro}` : undefined },
        ]}
        dingOnInsertTable="reservas"
      />
      {/* AgendaList es el cascarón del mostrador: pestañas fijas abajo (Turnos /
          Espera / Cierre) + hojas para los formularios. La espera y el cierre
          son server components y entran como slots a su pestaña.
          elegirBarbero: admin y perfil SEDE no tienen barbero propio; en venta
          rápida y al servir una espera "cualquiera" se pregunta qué barbero la
          hace, o la comisión se pierde. El login de barbero cae en él mismo. */}
      <AgendaList
        agenda={agendaSede}
        sedes={sedes}
        barberos={barberos}
        servicios={servicios}
        preciosServicios={preciosServicios}
        productos={productos}
        medios={medios}
        elegirBarbero={staff.rol !== "barbero"}
        mostrador={mostrador}
        horarioSemanal={sedeBarbero ? horarioSemanal.filter((h) => h.sede === sedeBarbero) : []}
        diasEspeciales={sedeBarbero ? diasEspeciales.filter((d) => d.sede === sedeBarbero) : []}
        esperaCount={espera.length}
        calendarioSlot={
          // Solo con sede definida (el dueño tiene su calendario en /admin/agenda).
          sedeBarbero && agendaCal ? (
            <AgendaDia
              sede={sedeBarbero as SedeId}
              fecha={fechaCal}
              hoy={hoy}
              agenda={agendaCal}
              bloqueos={bloqueosCal}
              barberos={mostrador.barberosSede}
              servicios={servicios}
              horarioSemanal={horarioSemanal.filter((h) => h.sede === sedeBarbero)}
              diasEspeciales={diasEspeciales.filter((d) => d.sede === sedeBarbero)}
              hrefBase="/barbero?tab=calendario"
            />
          ) : undefined
        }
        esperaSlot={
          <EsperaPanel
            espera={espera}
            sedes={sedes}
            barberos={barberos}
            servicios={servicios}
            sedeFija={sedeBarbero}
            elegirBarbero={staff.rol !== "barbero"}
          />
        }
        cierreSlot={
          <div className="space-y-8">
            {/* Qué se llevó cada cliente (ítems reales de la venta). */}
            <CobradosHoy agenda={agendaSede} ventas={ventasSede} barberos={mostrador.barberosSede} />
            {sedeBarbero && (
              <div className="mx-auto w-full max-w-2xl">
                <CierreCaja caja={caja} desglose={cajaDesglose} miBarberoId={staff.barberoId} />
              </div>
            )}
            {/* El aviso se ata a la sede o al barbero del perfil; el dueño no
                tiene ninguno de los dos, así que para él no se dibuja. */}
            {(staff.sedeId || staff.barberoId) && <AvisosBarbero />}
          </div>
        }
      />
    </main>
  );
}

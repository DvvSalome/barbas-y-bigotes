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
  getCajaDesglose,
  getCobradoHoy,
} from "@/lib/data/queries";
import { AgendaList } from "@/components/barbero/AgendaList";
import { EsperaPanel } from "@/components/barbero/EsperaPanel";
import { CierreCaja } from "@/components/barbero/CierreCaja";
import { RealtimeRefresh } from "@/components/motion/RealtimeRefresh";

export const metadata: Metadata = { title: "App del barbero" };

export default async function BarberoPage() {
  const staff = await getStaffContext();
  const filtro = staff.rol === "barbero" ? staff.barberoId : null;
  const [sedes, barberos, servicios, preciosServicios, productos, medios, agenda, espera, cobradoHoy] =
    await Promise.all([
      getSedes(),
      getBarberos(),
      getServicios(),
      getPreciosServiciosStaff(),
      getProductos(),
      getMedios(),
      getAgendaHoy(filtro),
      getListaEspera(filtro),
      getCobradoHoy(filtro),
    ]);

  // Cierre de caja: sólo para el barbero, sobre SU sede (el admin cierra en
  // /admin/cuadre). La caja se abre sola con la primera venta del día.
  const sedeBarbero =
    staff.rol === "barbero" ? barberos.find((b) => b.id === staff.barberoId)?.sede ?? null : null;
  const [caja, cajaDesglose] = sedeBarbero
    ? await Promise.all([getCajaSede(sedeBarbero), getCajaDesglose(sedeBarbero)])
    : [null, null];

  // Encabezado HERO del día: "Hoy, vie 10 jul" en el día civil de Bogotá (el
  // server corre en UTC) + "{barbero} · {sede}" (o "Todas las sedes" para admin).
  const partes = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(new Date());
  const parte = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  const hoyLabel = `${parte("weekday")} ${parte("day")} ${parte("month")}`.replace(/\./g, "");
  const sedeNombre = sedeBarbero ? sedes.find((s) => s.id === sedeBarbero)?.nombre ?? null : null;
  const subtitulo =
    staff.rol === "barbero"
      ? [staff.nombre || barberos.find((b) => b.id === staff.barberoId)?.nombre || "Barbero", sedeNombre]
          .filter(Boolean)
          .join(" · ")
      : "Todas las sedes";

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <RealtimeRefresh
        subscriptions={[
          { table: "reservas", filter: filtro ? `barbero_id=eq.${filtro}` : undefined },
          { table: "lista_espera", filter: filtro ? `barbero_id=eq.${filtro}` : undefined },
        ]}
        dingOnInsertTable="reservas"
      />
      <AgendaList
        agenda={agenda}
        sedes={sedes}
        barberos={barberos}
        servicios={servicios}
        preciosServicios={preciosServicios}
        productos={productos}
        medios={medios}
        esAdmin={staff.rol === "admin"}
        hoyLabel={hoyLabel}
        subtitulo={subtitulo}
        cobradoHoy={cobradoHoy}
      />

      <div className="mt-12 border-t border-line pt-8">
        <EsperaPanel espera={espera} sedes={sedes} barberos={barberos} servicios={servicios} />
      </div>

      {sedeBarbero && (
        <div className="mt-12 border-t border-line pt-8">
          <CierreCaja caja={caja} desglose={cajaDesglose} miBarberoId={staff.barberoId} />
        </div>
      )}
    </main>
  );
}

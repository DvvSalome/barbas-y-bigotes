import type { Metadata } from "next";
import Link from "next/link";
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
  getAgendaSedeRango,
  getBloqueosDia,
  getVentasSedeHoy,
  getHorarioSemanal,
  getDiasEspeciales,
  getReservasPendientesCobro,
  getAjustesEquipo,
  getMiSemana,
} from "@/lib/data/queries";
import { bogotaYmd, dowDeFecha, proximaCitaDe } from "@/lib/slots";
import { horaBogota } from "@/lib/format";
import { MiDia } from "@/components/barbero/MiDia";
import type { SedeId } from "@/lib/data/types";
import { AgendaList } from "@/components/barbero/AgendaList";
import { AgendaDia } from "@/components/admin/AgendaDia";
import { CobradosHoy } from "@/components/barbero/CobradosHoy";
import { AvisosBarbero } from "@/components/barbero/AvisosBarbero";
import { EsperaPanel } from "@/components/barbero/EsperaPanel";
import { CierreCaja } from "@/components/barbero/CierreCaja";
import { ConsumoBarbero } from "@/components/barbero/ConsumoBarbero";
import { GastoRapido } from "@/components/barbero/GastoRapido";
import { PendientesCobrar } from "@/components/staff/PendientesCobrar";
import { RealtimeRefresh } from "@/components/motion/RealtimeRefresh";

export const metadata: Metadata = { title: "Mostrador" };

export default async function BarberoPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; tab?: string; sede?: string; vista?: string }>;
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
  const [sedes, barberos, servicios, preciosServicios, productos, medios, espera, horarioSemanal, diasEspeciales, pendientesCobro] =
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
      // Cobro exprés del Cierre (corre con la sesión: la RLS ya lo deja en su alcance).
      getReservasPendientesCobro(),
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
  // El DUEÑO (sin sede propia) también lo ve: elige la sede con ?sede= (pills
  // arriba del calendario); por defecto la primera. El calendario es POR sede.
  const hoy = bogotaYmd();
  const fechaCal = /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha ?? "") ? sp.fecha! : hoy;
  const sedeCal = sedeBarbero ?? ((sedes.find((s) => s.id === sp.sede)?.id ?? sedes[0]?.id ?? null) as string | null);
  const vistaCal = sp.vista === "semana" ? ("semana" as const) : ("dia" as const);
  const lunesCal = (() => {
    const d = new Date(`${fechaCal}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((dowDeFecha(fechaCal) + 6) % 7));
    return d.toISOString().slice(0, 10);
  })();
  const idsSedeCal = sedeCal ? barberos.filter((b) => b.sede === sedeCal).map((b) => b.id) : [];
  const [agendaSede, ventasSede, agendaCal, bloqueosCal, agendaSemanaCal] = await Promise.all([
    getAgendaSedeHoy(sedeBarbero),
    getVentasSedeHoy(sedeBarbero),
    sedeCal ? getAgendaSedeDia(sedeCal, fechaCal) : Promise.resolve(null),
    sedeCal ? getBloqueosDia(idsSedeCal, fechaCal) : Promise.resolve([]),
    sedeCal && vistaCal === "semana" ? getAgendaSedeRango(sedeCal, lunesCal, 7) : Promise.resolve([]),
  ]);
  // El "cobrado hoy" sale de las mismas ventas que la lista de abajo: un solo
  // viaje, y el número del encabezado siempre cuadra con lo que se ve detallado.
  const porBarbero: Record<string, number> = {};
  let cobradoTotal = 0;
  for (const v of ventasSede) {
    cobradoTotal += v.total;
    if (v.barberoId) porBarbero[v.barberoId] = (porBarbero[v.barberoId] ?? 0) + v.total;
  }
  // "Tu día" (0074): el bloque propio del barbero. Solo se arma cuando el que
  // entró ES un barbero; el mostrador de la sede y el dueño ven el local.
  // Lo de HOY sale de las MISMAS ventas y la MISMA agenda que ya se pidieron
  // arriba: cero viajes extra. Lo de la SEMANA es opcional y lo prende el dueño.
  const esBarbero = staff.rol === "barbero" && !!staff.barberoId;
  const miId = staff.barberoId ?? "";
  const misVentas = esBarbero ? ventasSede.filter((v) => v.barberoId === miId) : [];
  const miProxima = esBarbero ? proximaCitaDe(agendaSede, miId) : null;
  const veSemana = esBarbero ? (await getAjustesEquipo()).barberoVeSemana : false;
  const miSemana = veSemana ? await getMiSemana(miId) : null;

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
    // La barra de abajo ahora son DOS pisos (acciones 52 + pastilla 58 + aires):
    // sin este despeje, la última fila de cualquier lista queda debajo y no se
    // puede tocar. Se suma el área segura del aparato.
    <main className="mx-auto max-w-6xl px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+152px)] sm:px-6">
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
        miDiaSlot={
          esBarbero ? (
            <MiDia
              nombre={(barberos.find((b) => b.id === miId)?.nombre ?? "").split(" ")[0]}
              cobradoHoy={misVentas.reduce((a, v) => a + v.total, 0)}
              atenciones={misVentas.length}
              proxima={
                miProxima
                  ? {
                      // horaBogota: el MISMO formateador que el resto del
                      // staff, para que no diga 3:40 pm en un lado y 15:40 en otro.
                      hora: horaBogota(miProxima.inicio),
                      cliente: miProxima.cliente || "Sin nombre",
                      servicio: miProxima.servicio || "Servicio",
                    }
                  : null
              }
              semana={miSemana}
            />
          ) : null
        }
        horarioSemanal={sedeBarbero ? horarioSemanal.filter((h) => h.sede === sedeBarbero) : []}
        diasEspeciales={sedeBarbero ? diasEspeciales.filter((d) => d.sede === sedeBarbero) : []}
        esperaCount={espera.length}
        calendarioSlot={
          // Para TODOS los perfiles del mostrador: sede/barbero ven su sede; el
          // DUEÑO (sin sede propia) elige con las pills de arriba (?sede=).
          sedeCal && agendaCal ? (
            <div>
              {!sedeBarbero && sedes.length > 1 && (
                <div className="mb-3 flex gap-1.5" role="tablist" aria-label="Sede del calendario">
                  {sedes.map((s) => (
                    <Link
                      key={s.id}
                      href={`/barbero?tab=calendario&sede=${s.id}&fecha=${fechaCal}`}
                      aria-current={s.id === sedeCal ? "page" : undefined}
                      className={`flex min-h-11 items-center rounded-lg px-3.5 text-[12.5px] font-semibold transition ${
                        s.id === sedeCal ? "bg-accent/15 text-accent-soft" : "text-muted hover:text-ink"
                      }`}
                    >
                      {s.nombre}
                    </Link>
                  ))}
                </div>
              )}
              <AgendaDia
                sede={sedeCal as SedeId}
                fecha={fechaCal}
                hoy={hoy}
                agenda={agendaCal}
                bloqueos={bloqueosCal}
                vista={vistaCal}
                agendaSemana={agendaSemanaCal}
                barberos={barberos.filter((b) => b.sede === sedeCal)}
                servicios={servicios}
                horarioSemanal={horarioSemanal.filter((h) => h.sede === sedeCal)}
                diasEspeciales={diasEspeciales.filter((d) => d.sede === sedeCal)}
                hrefBase={`/barbero?tab=calendario&sede=${sedeCal}`}
              />
            </div>
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
            {/* Cobro exprés: la cita que el barbero no alcanzó a registrar en el
                momento se cobra acá mismo (medio + propina), sin ir a Turnos. */}
            {sedeBarbero && (
              <div className="mx-auto w-full max-w-2xl">
                <PendientesCobrar
                  pendientes={pendientesCobro.filter((p) => p.sede === sedeBarbero)}
                  medios={medios.map((m) => ({ slug: m.slug, nombre: m.nombre }))}
                />
              </div>
            )}
            {/* Qué se llevó cada cliente (ítems reales de la venta). */}
            <CobradosHoy agenda={agendaSede} ventas={ventasSede} barberos={mostrador.barberosSede} />
            {sedeBarbero && (
              <div className="mx-auto w-full max-w-2xl space-y-3">
                <CierreCaja caja={caja} desglose={cajaDesglose} miBarberoId={staff.barberoId} />
                {/* Lo que se toma el equipo: acá, junto al cierre, porque es el
                    momento del día en que se hacen las cuentas. */}
                <ConsumoBarbero
                  productos={productos
                    .filter((p) => p.sede === sedeBarbero)
                    .map((p) => ({ id: p.id, nombre: p.nombre, precio: p.precio, stock: p.stock }))}
                  barberos={mostrador.barberosSede.map((b) => ({ id: b.id, nombre: b.nombre }))}
                  miBarberoId={staff.barberoId}
                />
                {/* El gasto del local ("compré agua") se anota acá mismo, no
                    cuando el admin se acuerde en el cuadre. */}
                <GastoRapido sede={sedeBarbero} medios={medios.map((m) => ({ slug: m.slug, nombre: m.nombre }))} />
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

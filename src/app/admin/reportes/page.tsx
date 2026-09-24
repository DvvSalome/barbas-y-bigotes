import type { Metadata } from "next";
import Link from "next/link";
import { getReporteMes, getSedes } from "@/lib/data/queries";
import type { SedeId } from "@/lib/data/types";
import { nombreMes, type FilaInventario } from "@/lib/reporte";
import { DOW, dowDeFecha } from "@/lib/slots";
import { cop } from "@/lib/format";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { EstadoVacio } from "@/components/ui/EstadoVacio";
import { IconTile } from "@/components/ui/IconTile";
import { botonClases } from "@/components/ui/Boton";
import { ProductoThumb } from "@/components/staff/ProductoThumb";
import { iconoDeGasto } from "@/components/admin/iconos-gasto";
import { AlertIcon, BoxIcon, ChevronRightIcon, DownloadIcon, ReceiptIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Reporte del mes · Admin" };

// El reporte del mes: lo que el dueño lleva a mano en su Excel ("…PZ 2026", una
// pestaña por mes), armado con lo que registra la app. La pantalla es para
// MIRARLO; el Excel (↓) trae las mismas dos hojas del suyo, con todos los días.

const diaCorto = (ymd: string) => `${DOW[dowDeFecha(ymd)]} ${Number(ymd.slice(8))}`;

function Cifra({ etiqueta, valor, pie, alerta }: { etiqueta: string; valor: number; pie: string; alerta?: boolean }) {
  return (
    <div className="min-w-0 bg-panel px-4 py-3">
      <div className="eyebrow">{etiqueta}</div>
      <div className={`bb-monto mt-1 font-display text-2xl font-semibold tabular-nums leading-tight ${alerta ? "text-warn" : "text-ink"}`}>
        {cop(valor)}
      </div>
      <div className="mt-0.5 text-[12px] text-muted">{pie}</div>
    </div>
  );
}

function FilaProducto({ f }: { f: FilaInventario }) {
  const detalle = [`empezó con ${f.inicial}`, f.entro ? `entraron ${f.entro}` : null, `quedan ${f.quedan}`]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <ProductoThumb nombre={f.nombre} fotoUrl={f.fotoUrl} size={40} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14.5px] font-semibold text-ink">{f.nombre}</div>
        <div className="text-[12.5px] text-muted">
          {detalle}
          {f.otras !== 0 && ` · ${f.otras > 0 ? `${f.otras} en consumo, merma o ajuste` : `${-f.otras} de más por ajuste`}`}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[14px] font-bold tabular-nums text-ink">
          {f.vendidas} {f.vendidas === 1 ? "vendida" : "vendidas"}
        </div>
        {f.ganancia === null ? (
          <div className="text-[12.5px] text-muted">sin costo</div>
        ) : (
          <div className="bb-monto text-[12.5px] tabular-nums text-ok">+{cop(f.ganancia)}</div>
        )}
      </div>
    </li>
  );
}

export default async function ReportePage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const sedes = await getSedes();
  const sede = (sedes.find((s) => s.id === sp.sede)?.id as SedeId | undefined) ?? null;
  const nombreSede = sedes.find((s) => s.id === sede)?.nombre;
  const datos = await getReporteMes(typeof sp.mes === "string" ? sp.mes : null, sede);
  // El layout del panel ya sacó a quien no es admin; esto es por si algún día no.
  if (!datos) return null;
  const { mes, reporte: r } = datos;
  const qs = (m: string) => `?mes=${m}${sede ? `&sede=${sede}` : ""}`;

  const conMovimiento = r.dias.filter((d) => d.cobros || d.gastos || d.pedido);
  const vacio = !conMovimiento.length && !r.inventario.some((f) => f.vendidas || f.entro || f.otras);
  // Menos de 6 de cada 10 días con cobros: el mes está a medias en la app, y el
  // dueño lo va a comparar con su Excel. Se dice ANTES de que saque la conclusión
  // equivocada ("la app pierde plata").
  const aMedias = mes.dias.length > 0 && r.diasConCobros / mes.dias.length < 0.6;
  const gastosVeces = r.gastosPorConcepto.reduce((a, g) => a + g.veces, 0);
  // En pantalla, lo que más se vendió arriba; el Excel va por nombre, como un catálogo.
  const porSede = sedes
    .map((s) => ({
      ...s,
      filas: r.inventario
        .filter((f) => f.sedeId === s.id)
        .sort((a, b) => b.vendidas - a.vendidas || a.nombre.localeCompare(b.nombre, "es")),
    }))
    .filter((s) => s.filas.length);
  // Sin NINGÚN costo cargado, "Ganancia $ 0" diría que no se ganó nada: es que no se sabe.
  const sinNingunCosto = r.inventario.length > 0 && r.sinCosto === r.inventario.length;

  return (
    <div className="max-w-5xl">
      <SectionHeader
        eyebrow="Negocio"
        title="Reporte del mes"
        subtitulo={nombreSede ?? "Ambas sedes"}
        description="El mes como en el Excel: día por día lo que entró, lo que queda para el local después de las comisiones y los gastos, y el inventario con su ganancia. Sale de lo que se registra en la app: los cobros del mostrador, los gastos de la caja y la mercancía que entra."
        action={
          <a href={`/admin/reportes/xlsx${qs(mes.mes)}`} className={botonClases("secundario", "md")}>
            <DownloadIcon className="h-4 w-4" /> Excel del mes
          </a>
        }
      />

      {/* El mes: flechas a los lados, como pasar la pestaña del Excel. */}
      <div className="mt-5 flex items-center gap-2 rounded-2xl border border-line bg-panel p-1.5">
        <Link
          href={qs(mes.anterior)}
          aria-label={`Ver ${nombreMes(mes.anterior)}`}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-elevated hover:text-ink"
        >
          <ChevronRightIcon className="h-5 w-5 rotate-180" />
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <div className="font-display text-[20px] font-bold uppercase leading-none text-ink">{nombreMes(mes.mes)}</div>
          <div className="mt-1 text-[12px] text-muted">
            {mes.enCurso ? `del 1 al ${Number(mes.hastaYmd.slice(8))} · va en curso` : "mes cerrado"}
          </div>
        </div>
        {mes.siguiente ? (
          <Link
            href={qs(mes.siguiente)}
            aria-label={`Ver ${nombreMes(mes.siguiente)}`}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-elevated hover:text-ink"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </Link>
        ) : (
          <span aria-hidden className="h-11 w-11 shrink-0" />
        )}
      </div>

      {aMedias && !vacio && (
        <div className="mt-4 flex gap-3 rounded-2xl border border-warn/40 bg-warn/[0.07] px-4 py-3">
          <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
          <p className="text-[13px] leading-relaxed text-ink">
            La app tiene cobros en <b>{r.diasConCobros}</b> de los <b>{mes.dias.length}</b> días{" "}
            {mes.enCurso ? "que van del mes" : "del mes"}. Lo que se cobre por fuera de la app —en el cuaderno o en el
            Excel— no sale aquí.
          </p>
        </div>
      )}

      {vacio ? (
        <div className="mt-6 rounded-2xl border border-line bg-panel">
          <EstadoVacio
            icono={<ReceiptIcon />}
            tinte="plata"
            titulo="Este mes no tiene nada registrado"
            texto="Aparece solo a medida que el mostrador cobra, la caja anota gastos y entra mercancía."
          />
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
            <Cifra etiqueta="Ingresos" valor={r.totales.ingresos} pie={`${r.totales.cobros} ${r.totales.cobros === 1 ? "cobro" : "cobros"}`} />
            <Cifra etiqueta="Para el local" valor={r.totales.local} pie="después de comisiones" />
            <Cifra etiqueta="Gastos" valor={r.totales.gastos} pie={`${gastosVeces} ${gastosVeces === 1 ? "gasto" : "gastos"}`} />
            <Cifra etiqueta="Queda" valor={r.totales.queda} pie="para el local − gastos" alerta={r.totales.queda < 0} />
          </div>

          <section className="mt-7">
            <p className="eyebrow mb-2">Día por día</p>
            {conMovimiento.length ? (
              <div className="overflow-hidden rounded-2xl border border-line bg-panel">
                <table className="w-full text-[13px] tabular-nums">
                  <thead>
                    <tr className="border-b border-line text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
                      <th className="px-3 py-2.5 font-semibold">Día</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Ingresos</th>
                      <th className="px-2 py-2.5 text-right font-semibold">Local</th>
                      <th className="px-3 py-2.5 text-right font-semibold sm:px-2">Gastos</th>
                      <th className="hidden px-2 py-2.5 text-right font-semibold sm:table-cell">Pedido</th>
                      <th className="hidden px-3 py-2.5 text-right font-semibold sm:table-cell">Queda</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {conMovimiento.map((d) => (
                      <tr key={d.ymd}>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-ink">{diaCorto(d.ymd)}</div>
                          <div className="text-[12px] text-muted">
                            {d.cobros ? `${d.cobros} ${d.cobros === 1 ? "cobro" : "cobros"}` : "sin cobros"}
                          </div>
                        </td>
                        <td className="bb-monto px-2 py-2.5 text-right text-ink">{d.ingresos ? cop(d.ingresos) : "—"}</td>
                        <td className="bb-monto px-2 py-2.5 text-right text-ink">{d.local ? cop(d.local) : "—"}</td>
                        <td className="bb-monto px-3 py-2.5 text-right text-muted sm:px-2" title={d.conceptos.map((c) => c.categoria).join(", ")}>
                          {d.gastos ? cop(d.gastos) : "—"}
                        </td>
                        <td className="bb-monto hidden px-2 py-2.5 text-right text-muted sm:table-cell">{d.pedido ? cop(d.pedido) : "—"}</td>
                        <td className={`bb-monto hidden px-3 py-2.5 text-right font-semibold sm:table-cell ${d.queda < 0 ? "text-warn" : "text-ink"}`}>
                          {cop(d.queda)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-accent/50 font-bold text-ink">
                      <td className="px-3 py-3">Total</td>
                      <td className="bb-monto px-2 py-3 text-right">{cop(r.totales.ingresos)}</td>
                      <td className="bb-monto px-2 py-3 text-right">{cop(r.totales.local)}</td>
                      <td className="bb-monto px-3 py-3 text-right sm:px-2">{cop(r.totales.gastos)}</td>
                      <td className="bb-monto hidden px-2 py-3 text-right sm:table-cell">{cop(r.totales.pedido)}</td>
                      <td className={`bb-monto hidden px-3 py-3 text-right sm:table-cell ${r.totales.queda < 0 ? "text-warn" : ""}`}>
                        {cop(r.totales.queda)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="rounded-2xl border border-line bg-panel px-4 py-5 text-center text-[13px] text-muted">
                Ningún día con cobros, gastos ni pedidos registrados.
              </p>
            )}
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              Local = lo que entró menos la comisión de cada barbero, la misma cuenta de la liquidación. Aquí salen solo
              los días con movimiento; el Excel trae todos.
            </p>
          </section>

          {r.gastosPorConcepto.length > 0 && (
            <section className="mt-7">
              <p className="eyebrow mb-2">En qué se fue la plata</p>
              <ul className="divide-y divide-line/60 overflow-hidden rounded-2xl border border-line bg-panel">
                {r.gastosPorConcepto.map((g) => {
                  const Icono = iconoDeGasto(g.categoria);
                  return (
                    <li key={g.categoria} className="flex items-center gap-3 px-4 py-2.5">
                      <IconTile tinte="plata">
                        <Icono />
                      </IconTile>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14.5px] font-semibold text-ink">{g.categoria}</div>
                        <div className="text-[12.5px] text-muted">
                          {g.veces} {g.veces === 1 ? "vez" : "veces"}
                        </div>
                      </div>
                      <span className="bb-monto shrink-0 text-[15px] font-bold tabular-nums text-ink">{cop(g.total)}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="mt-7">
            <p className="eyebrow mb-2">Inventario</p>
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line">
              <div className="min-w-0 bg-panel px-3 py-3 sm:px-4">
                <div className="eyebrow truncate">Vendido</div>
                <div className="bb-monto mt-1 font-display text-xl font-semibold tabular-nums text-ink sm:text-2xl">
                  {cop(r.inventarioTotales.vendido)}
                </div>
                <div className="mt-0.5 text-[12px] text-muted">{r.inventarioTotales.vendidas} unidades</div>
              </div>
              <div className="min-w-0 bg-panel px-3 py-3 sm:px-4">
                <div className="eyebrow truncate">Ganancia</div>
                <div className="bb-monto mt-1 font-display text-xl font-semibold tabular-nums text-ok sm:text-2xl">
                  {sinNingunCosto ? "—" : cop(r.inventarioTotales.ganancia)}
                </div>
                <div className="mt-0.5 text-[12px] text-muted">
                  {sinNingunCosto ? "falta el costo" : r.sinCosto ? "de los que tienen costo" : "vendido − costo"}
                </div>
              </div>
              <div className="min-w-0 bg-panel px-3 py-3 sm:px-4">
                <div className="eyebrow truncate">Invertido</div>
                <div className="bb-monto mt-1 font-display text-xl font-semibold tabular-nums text-ink sm:text-2xl">
                  {sinNingunCosto ? "—" : cop(r.inventarioTotales.invertida)}
                </div>
                <div className="mt-0.5 text-[12px] text-muted">{sinNingunCosto ? "falta el costo" : "en la estantería"}</div>
              </div>
            </div>

            {r.sinCosto > 0 && (
              <Link
                href="/admin/inventario"
                className="mt-3 flex items-center gap-3 rounded-2xl border border-warn/40 bg-warn/[0.07] px-4 py-3 transition hover:bg-warn/[0.12]"
              >
                <AlertIcon className="h-5 w-5 shrink-0 text-warn" />
                <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink">
                  <b>
                    {r.sinCosto} de {r.inventario.length}
                  </b>{" "}
                  productos no tienen costo: sin eso no hay ganancia ni plata invertida. Se carga en Productos y stock →
                  el producto → «Le cuesta».
                </span>
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
              </Link>
            )}

            {porSede.length ? (
              // En escritorio, las dos sedes lado a lado: una debajo de la otra medía el doble.
              <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
                {porSede.map((s) => (
                  <div key={s.id} className="mt-3 min-w-0">
                    {!sede && <p className="mb-1.5 text-[13px] font-semibold text-muted">{s.nombre}</p>}
                    <ul className="divide-y divide-line/60 overflow-hidden rounded-2xl border border-line bg-panel">
                      {s.filas.map((f) => (
                        <FilaProducto key={f.productoId} f={f} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-line bg-panel">
                <EstadoVacio icono={<BoxIcon />} tinte="local" titulo="Sin productos" texto="Se cargan en Productos y stock." />
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

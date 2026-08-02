import Image from "next/image";
import { cop, horaBogota } from "@/lib/format";
import { MedioLogo } from "@/components/staff/MedioLogo";
import type { Barbero } from "@/lib/data/types";
import type { AgendaItem, VentaHoy } from "@/lib/data/queries";

// Cierre del día en el MOSTRADOR: qué se llevó cada cliente.
// Antes acá había una lista de "Terminadas hoy" que mostraba el precio de
// CATÁLOGO del servicio: si se sumó un producto, una propina o un descuento, el
// número no era el que se cobró. Ahora cada línea sale de la venta real y de sus
// ítems, así el barbero comprueba de un vistazo si a alguien se le agregó algo
// de más antes de cuadrar la caja.
// Server component a propósito: es lectura, y `<details>` da el plegado sin JS.
// Por eso la hora va con horaBogota (el server de Vercel corre en UTC).

const CERRADAS = ["completada", "no_show", "cancelada"];

const SIN_VENTA: Record<string, { txt: string; cls: string }> = {
  no_show: { txt: "No llegó", cls: "bg-warn/15 text-warn" },
  cancelada: { txt: "Cancelada", cls: "bg-ink/10 text-muted" },
};

const iniciales = (n: string) =>
  (n || "?").trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("");

type Fila = {
  key: string;
  /** Para ordenar: la venta manda; sin venta, la hora de la cita. */
  cuando: string;
  cliente: string;
  barbero: Barbero | undefined;
  estado: string;
  venta: VentaHoy | null;
};

export function CobradosHoy({
  agenda,
  ventas,
  barberos,
}: {
  /** Agenda de hoy de la sede (de acá salen las cerradas sin venta). */
  agenda: AgendaItem[];
  ventas: VentaHoy[];
  barberos: Barbero[];
}) {
  const quien = (id: string | null) => barberos.find((b) => b.id === id);
  const ventaDeReserva = new Map(
    ventas.filter((v) => v.reservaId).map((v) => [v.reservaId as string, v]),
  );

  const filas: Fila[] = [
    ...agenda
      .filter((r) => CERRADAS.includes(r.estado))
      .map((r) => {
        const venta = ventaDeReserva.get(r.id) ?? null;
        return {
          key: r.id,
          cuando: venta?.creadoEn ?? r.inicio,
          cliente: r.cliente || "Walk-in",
          barbero: quien(r.barberoId),
          estado: r.estado,
          venta,
        };
      }),
    // Ventas rápidas: no están en la agenda pero SÍ en el "cobrado hoy" del
    // encabezado. Sin ellas la lista nunca cuadra con ese número.
    ...ventas
      .filter((v) => !v.reservaId)
      .map((v) => ({
        key: v.id,
        cuando: v.creadoEn,
        cliente: v.cliente || "Venta rápida",
        barbero: quien(v.barberoId),
        estado: "rapida",
        venta: v,
      })),
    // Lo último cobrado arriba: es lo que se está revisando. Se compara en
    // milisegundos y no como texto — la agenda y las ventas llegan del mismo
    // PostgREST, pero un cambio de formato ISO ordenaría mal en silencio.
  ].sort((a, b) => new Date(b.cuando).getTime() - new Date(a.cuando).getTime());

  if (filas.length === 0) return null;

  const cobradas = filas.filter((f) => f.venta);
  const total = cobradas.reduce((a, f) => a + (f.venta?.total ?? 0), 0);

  return (
    <details open className="group overflow-hidden rounded-[18px] border border-line bg-panel">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition hover:bg-ink/[0.02] [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[15px] font-bold uppercase tracking-wide">
            Qué se llevó cada cliente
          </span>
          <span className="block text-[11.5px] text-muted">
            {cobradas.length} {cobradas.length === 1 ? "cobro" : "cobros"} · {cop(total)}
            {filas.length > cobradas.length && ` · ${filas.length - cobradas.length} sin cobrar`}
          </span>
        </span>
        <span
          aria-hidden
          className="shrink-0 text-[13px] text-muted transition-transform duration-200 group-open:rotate-180"
        >
          ▾
        </span>
      </summary>

      <ul className="divide-y divide-line/60 border-t border-line">
        {filas.map((f) => {
          const chip = SIN_VENTA[f.estado];
          return (
            <li key={f.key} className="flex items-start gap-3 px-4 py-3">
              <span className="w-[62px] shrink-0 pt-0.5 font-display text-[12.5px] tabular-nums text-muted">
                {horaBogota(f.cuando)}
              </span>

              {f.barbero?.fotoUrl ? (
                <Image
                  src={f.barbero.fotoUrl}
                  alt=""
                  width={30}
                  height={30}
                  className="h-[30px] w-[30px] shrink-0 rounded-full object-cover object-top"
                />
              ) : (
                <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-elevated text-[10px] font-bold text-muted">
                  {iniciales(f.barbero?.nombre ?? "")}
                </span>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold">{f.cliente}</span>
                  {f.venta ? (
                    <span className="shrink-0 font-display text-[15px] font-bold tabular-nums text-ok">
                      {cop(f.venta.total)}
                    </span>
                  ) : (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                        chip?.cls ?? "bg-ink/10 text-muted"
                      }`}
                    >
                      {chip?.txt ?? "Sin cobro"}
                    </span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {/* Producto en tinta de acento: es justo lo que hay que poder
                      cazar de un vistazo ("¿este cliente sí se llevó eso?"). */}
                  {f.venta?.items.map((it, i) => (
                    <span
                      key={i}
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        it.tipo === "producto"
                          ? "bg-accent/12 text-accent-soft ring-1 ring-accent/25"
                          : "bg-ink/[0.06] text-muted"
                      }`}
                    >
                      {it.descripcion}
                      {it.cantidad > 1 && ` ×${it.cantidad}`}
                      <b className="ml-1 font-semibold tabular-nums">
                        {cop(it.precioUnitario * it.cantidad)}
                      </b>
                    </span>
                  ))}
                  {f.venta && f.venta.descuento > 0 && (
                    <span className="rounded-full bg-warn/12 px-2 py-0.5 text-[11px] text-warn">
                      − descuento {cop(f.venta.descuento)}
                    </span>
                  )}
                  {/* La propina va aparte del total (no entra en ventas.total),
                      pero el cliente sí la pagó: sin ella no cuadra el cajón. */}
                  {f.venta && f.venta.propina > 0 && (
                    <span className="rounded-full bg-ok/12 px-2 py-0.5 text-[11px] text-ok">
                      + propina {cop(f.venta.propina)}
                    </span>
                  )}
                  {f.estado === "rapida" && (
                    <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
                      Sin cita
                    </span>
                  )}
                  {f.venta?.items.length === 0 && f.estado !== "rapida" && (
                    <span className="text-[11.5px] text-muted">Sin ítems registrados</span>
                  )}
                </div>
              </div>

              {f.venta && (
                <span className="shrink-0 pt-0.5" title={f.venta.medio}>
                  <MedioLogo slug={f.venta.medio} nombre={f.venta.medio} size={22} />
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

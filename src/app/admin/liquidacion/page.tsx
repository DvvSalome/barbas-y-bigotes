import type { Metadata } from "next";
import Link from "next/link";
import { getLiquidacion, getSedes } from "@/lib/data/queries";
import type { SedeId } from "@/lib/data/types";
import { cop } from "@/lib/format";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { AjusteLiquidacion } from "@/components/admin/AjusteLiquidacion";
import { bogotaYmd, bogotaDayRangeDeFecha, semanaDeFecha, MON } from "@/lib/slots";

export const metadata: Metadata = { title: "Liquidación · Admin" };

// La cuenta con la que se le paga a cada barbero el fin de semana. Antes había que
// sacarla a mano de tres pantallas (métricas para lo facturado, caja para los
// adelantos, y la memoria del dueño para las bebidas que se tomaron).

const fechaCorta = (ymd: string) => {
  const [, m, d] = ymd.split("-").map(Number);
  return `${d} ${MON[m - 1] ?? ""}`;
};

/** Suma o resta días a una fecha civil sin pasar por la TZ del proceso. */
const masDias = (ymd: string, dias: number) =>
  new Date(new Date(`${ymd}T12:00:00Z`).getTime() + dias * 86_400_000).toISOString().slice(0, 10);

export default async function LiquidacionPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const sedes = await getSedes();
  const sede = (sedes.find((s) => s.id === (typeof sp.sede === "string" ? sp.sede : undefined))?.id as SedeId | undefined) ?? null;

  // ?semana= es CUALQUIER día dentro de la semana; el lunes lo resuelve slots.ts.
  const pedido = typeof sp.semana === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.semana) ? sp.semana : bogotaYmd();
  const { desdeYmd, hastaYmd } = semanaDeFecha(pedido);
  const desde = bogotaDayRangeDeFecha(desdeYmd).desde;
  const hasta = bogotaDayRangeDeFecha(hastaYmd).hasta; // domingo incluido
  const esSemanaActual = semanaDeFecha(bogotaYmd()).desdeYmd === desdeYmd;

  const filas = await getLiquidacion(desde, hasta, sede);
  const qs = (semana: string) => `?semana=${semana}${sede ? `&sede=${sede}` : ""}`;

  const totales = filas.reduce(
    (a, f) => ({
      facturado: a.facturado + f.facturado,
      comision: a.comision + f.comision,
      adelantos: a.adelantos + f.adelantos,
      consumos: a.consumos + f.consumos,
      neto: a.neto + f.neto,
    }),
    { facturado: 0, comision: 0, adelantos: 0, consumos: 0, neto: 0 },
  );

  return (
    <div className="max-w-5xl">
      <SectionHeader
        eyebrow="Equipo"
        title="Liquidación semanal"
        description="Lo que se le paga a cada barbero: lo que facturó, su parte, lo que ya se llevó en adelantos y lo que se consumió del local."
      />

      {/* Navegación por semana. El lunes manda: así se paga y así se lee. */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link
          href={qs(masDias(desdeYmd, -7))}
          className="flex min-h-11 items-center rounded-xl border border-line px-4 text-[13px] font-semibold text-muted transition hover:border-ink/25 hover:text-ink"
        >
          ← Anterior
        </Link>
        <span className="rounded-xl border border-accent/45 bg-accent/[0.07] px-4 py-2.5 font-display text-[15px] font-bold text-ink">
          {fechaCorta(desdeYmd)} – {fechaCorta(hastaYmd)}
          {esSemanaActual && <span className="ml-2 text-[12px] font-bold uppercase text-accent-soft">en curso</span>}
        </span>
        <Link
          href={qs(masDias(desdeYmd, 7))}
          aria-disabled={esSemanaActual}
          className={`flex min-h-11 items-center rounded-xl border px-4 text-[13px] font-semibold transition ${
            esSemanaActual
              ? "pointer-events-none border-line/50 text-muted/40"
              : "border-line text-muted hover:border-ink/25 hover:text-ink"
          }`}
        >
          Siguiente →
        </Link>
        {filas.length > 0 && (
          // Descarga: <a> y no <Link> porque es un route handler con
          // Content-Disposition (mismo patrón que Métricas y Clientes).
          <a
            href={`/admin/liquidacion/csv${qs(desdeYmd)}`}
            className="ml-auto flex min-h-11 items-center rounded-xl border border-line px-4 text-[13px] font-semibold text-muted transition hover:border-ink/25 hover:text-ink"
          >
            ↓ Excel
          </a>
        )}
      </div>

      {esSemanaActual && (
        <p className="mt-2 text-[12px] text-muted">
          La semana todavía corre: estos números siguen subiendo hasta el domingo.
        </p>
      )}

      {filas.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-panel p-6 text-[13px] text-muted">
          No hay barberos activos{sede ? " en esta sede" : ""} para liquidar.
        </div>
      ) : (
        <>
          <div className="mt-5 space-y-3">
            {filas.map((f) => {
              const arriendo = f.tipoContrato === "arriendo";
              return (
                <div key={f.barberoId} className="overflow-hidden rounded-2xl border border-line bg-panel">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line/60 px-4 py-3">
                    <span className="font-display text-[19px] font-bold uppercase leading-tight text-ink">{f.nombre}</span>
                    <span className="text-[12px] text-muted">
                      {sedes.find((s) => s.id === f.sedeId)?.nombre ?? f.sedeId} ·{" "}
                      {arriendo ? "paga arriendo de silla" : "por comisión"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-px bg-line/40 sm:grid-cols-4">
                    {[
                      { l: "Facturó", v: cop(f.facturado), sub: `${f.cobros} ${f.cobros === 1 ? "cobro" : "cobros"}` },
                      arriendo
                        ? { l: "Arriendo", v: cop(f.arriendo), sub: "al mes, no semanal" }
                        : { l: "Su parte", v: cop(f.comision), sub: "comisión de la semana" },
                      { l: "Adelantos", v: f.adelantos ? `−${cop(f.adelantos)}` : "—", sub: "ya se los llevó" },
                      { l: "Consumos", v: f.consumos ? `−${cop(f.consumos)}` : "—", sub: "bebidas y mecatos" },
                    ].map((k) => (
                      <div key={k.l} className="bg-panel px-4 py-3">
                        <div className="text-[12px] font-bold uppercase tracking-wide text-muted">{k.l}</div>
                        <div className="font-display text-[19px] font-bold tabular-nums text-ink">{k.v}</div>
                        <div className="text-[12px] leading-tight text-muted">{k.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* El detalle de lo consumido: descontar un número a ciegas es lo
                      que hace que el barbero desconfíe del descuento. */}
                  {f.detalleConsumos.length > 0 && (
                    <div className="border-t border-line/60 px-4 py-2.5 text-[12px] text-muted">
                      {f.detalleConsumos
                        .map((c) => `${fechaCorta(c.fecha)}: ${c.cantidad > 1 ? `${c.cantidad}× ` : ""}${c.producto} ${cop(c.total)}`)
                        .join(" · ")}
                    </div>
                  )}

                  {/* Sumar o restar a mano (0075). Va antes del total porque es
                      parte de la cuenta, no una nota al pie. Solo el dueño puede
                      tocarlo —lo pidió así— pero el barbero SÍ lo ve en lo suyo:
                      si le cambia lo que cobra y no lo ve, no le cuadra. */}
                  {!arriendo && (
                    <AjusteLiquidacion
                      barberoId={f.barberoId}
                      nombre={f.nombre}
                      ajustes={f.ajustes}
                      detalle={f.detalleAjustes}
                    />
                  )}

                  <div className="flex items-baseline justify-between gap-3 border-t border-line bg-elevated/40 px-4 py-3">
                    <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted">
                      {arriendo ? "Le queda a él" : "A pagar"}
                    </span>
                    <span
                      className={`font-display text-[26px] font-extrabold leading-none tabular-nums ${
                        f.neto < 0 ? "text-warn" : "text-accent-soft"
                      }`}
                    >
                      {arriendo ? cop(f.facturado) : cop(f.neto)}
                    </span>
                  </div>
                  {!arriendo && f.neto < 0 && (
                    <p className="px-4 pb-3 text-[12px] text-warn">
                      Se llevó más de lo que produjo esta semana: queda debiendo {cop(-f.neto)}.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 rounded-2xl border border-line bg-panel px-4 py-3.5 text-[13px]">
            <span className="text-muted">
              Facturado del equipo <b className="ml-1 tabular-nums text-ink">{cop(totales.facturado)}</b>
            </span>
            <span className="text-muted">
              Comisiones <b className="ml-1 tabular-nums text-ink">{cop(totales.comision)}</b>
            </span>
            <span className="text-muted">
              Descontado <b className="ml-1 tabular-nums text-ink">{cop(totales.adelantos + totales.consumos)}</b>
            </span>
            <span className="font-semibold text-ink">
              Total a pagar <b className="ml-1 tabular-nums text-ink">{cop(totales.neto)}</b>
            </span>
          </div>
        </>
      )}
    </div>
  );
}

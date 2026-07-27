import type { Metadata } from "next";
import Link from "next/link";
import { getMetricas, getSedes, type Periodo } from "@/lib/data/queries";
import type { SedeId } from "@/lib/data/types";
import { cop } from "@/lib/format";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { Kpi } from "@/components/admin/Kpi";

export const metadata: Metadata = { title: "Métricas · Admin" };

const PERIODOS: { id: Periodo; label: string }[] = [
  { id: "mes", label: "Este mes" },
  { id: "30d", label: "30 días" },
  { id: "90d", label: "90 días" },
];

/** Variación vs el período anterior. Sin base no hay porcentaje que valga. */
function Delta({ hoy, antes }: { hoy: number; antes: number }) {
  if (!antes) return <span className="text-muted">sin comparación</span>;
  const pct = Math.round(((hoy - antes) / antes) * 100);
  if (pct === 0) return <span className="text-muted">igual que antes</span>;
  return (
    <span className={pct > 0 ? "text-ok" : "text-accent-soft"}>
      {pct > 0 ? "▲" : "▼"} {Math.abs(pct)}% vs período anterior
    </span>
  );
}

/** Barras con divs: no vale traer una librería de gráficos para esto. */
function Barras({ serie }: { serie: { ymd: string; total: number }[] }) {
  const max = Math.max(...serie.map((d) => d.total), 1);
  // Con 90 días no entran 90 etiquetas: se muestran las barras y solo los extremos.
  return (
    <div>
      <div className="flex h-28 items-end gap-[3px]">
        {serie.map((d) => (
          <div
            key={d.ymd}
            title={`${d.ymd}: ${cop(d.total)}`}
            className="flex-1 rounded-t bg-accent/70 transition hover:bg-accent"
            style={{ height: `${Math.max((d.total / max) * 100, d.total > 0 ? 4 : 1.5)}%` }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10.5px] text-muted">
        <span>{serie[0]?.ymd.slice(5)}</span>
        <span>pico {cop(max)}</span>
        <span>{serie.at(-1)?.ymd.slice(5)}</span>
      </div>
    </div>
  );
}

function Ranking({
  titulo,
  vacio,
  filas,
}: {
  titulo: string;
  vacio: string;
  filas: { nombre: string; valor: string; sub: string; peso: number }[];
}) {
  const max = Math.max(...filas.map((f) => f.peso), 1);
  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h3 className="mb-3 font-display text-lg">{titulo}</h3>
      {filas.length === 0 ? (
        <p className="text-[12.5px] text-muted">{vacio}</p>
      ) : (
        <ul className="space-y-3">
          {filas.map((f) => (
            <li key={f.nombre}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[13.5px] font-semibold text-ink">{f.nombre}</span>
                <span className="shrink-0 text-[13px] text-ink">{f.valor}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated">
                <div className="h-full rounded-full bg-accent/70" style={{ width: `${(f.peso / max) * 100}%` }} />
              </div>
              <div className="mt-0.5 text-[11.5px] text-muted">{f.sub}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function MetricasPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const sedeParam = typeof sp.sede === "string" ? sp.sede : undefined;
  // Se valida contra las sedes reales en vez de un mapa hardcodeado: si mañana
  // abren una tercera, esta pantalla la toma sola.
  const sedes = await getSedes();
  const sede = (sedes.find((s) => s.id === sedeParam)?.id as SedeId | undefined) ?? null;
  const nombreSede = sedes.find((s) => s.id === sede)?.nombre;
  const p = (typeof sp.p === "string" && PERIODOS.some((x) => x.id === sp.p) ? sp.p : "mes") as Periodo;

  const m = await getMetricas(p, sede);
  const qs = (periodo: Periodo) => `?p=${periodo}${sede ? `&sede=${sede}` : ""}`;
  const nuevos = m.clientes.total - m.clientes.repiten;

  return (
    <div>
      <SectionHeader
        eyebrow="Negocio"
        title="Métricas"
        description="Cómo viene el negocio, no cómo viene el día. Para el día está la pantalla de inicio."
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {PERIODOS.map((x) => (
          <Link
            key={x.id}
            href={qs(x.id)}
            className={`flex min-h-11 items-center rounded-xl border px-4 text-[13px] font-semibold transition ${
              x.id === p ? "border-accent bg-accent/15 text-ink" : "border-line text-muted hover:border-ink/25 hover:text-ink"
            }`}
          >
            {x.label}
          </Link>
        ))}
      </div>

      {m.servicios === 0 ? (
        <p className="mt-6 rounded-2xl border border-line bg-panel p-6 text-[13px] text-muted">
          Todavía no hay cobros en este período{sede ? ` en ${nombreSede}` : ""}. Los números aparecen
          solos a medida que los barberos van cobrando en el mostrador.
        </p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Entró" value={cop(m.plata)} hint={undefined} />
            <Kpi label="Cobros" value={String(m.servicios)} accent={false} />
            <Kpi label="Ticket promedio" value={cop(m.ticket)} accent={false} />
            <Kpi label="Propinas" value={cop(m.propinas)} accent={false} />
          </div>

          <p className="mt-2.5 text-[12.5px]">
            <Delta hoy={m.plata} antes={m.antes.plata} />
          </p>

          <section className="mt-6 rounded-2xl border border-line bg-panel p-5">
            <h3 className="mb-3 font-display text-lg">Día por día</h3>
            <Barras serie={m.serie} />
          </section>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Ranking
              titulo="Quién produce"
              vacio="Sin cobros asignados a un barbero."
              filas={m.porBarbero.map((b) => ({
                nombre: b.nombre,
                valor: cop(b.plata),
                sub: `${b.cortes} ${b.cortes === 1 ? "cobro" : "cobros"}`,
                peso: b.plata,
              }))}
            />
            <Ranking
              titulo="Qué piden"
              vacio="Los cobros de este período no tienen servicios detallados."
              filas={m.porServicio.map((s) => ({
                nombre: s.nombre,
                valor: `${s.veces}×`,
                sub: cop(s.plata),
                peso: s.veces,
              }))}
            />
            <Ranking
              titulo="Qué se vende"
              vacio="Este período no se vendió ningún producto en el mostrador."
              filas={m.porProducto.map((x) => ({
                nombre: x.nombre,
                valor: cop(x.plata),
                sub: `${x.veces} ${x.veces === 1 ? "unidad" : "unidades"}`,
                peso: x.plata,
              }))}
            />
          </div>

          <section className="mt-4 rounded-2xl border border-line bg-panel p-5">
            <h3 className="font-display text-lg">Clientes</h3>
            <p className="mt-1 text-[12.5px] text-muted">
              De {m.clientes.total} {m.clientes.total === 1 ? "cliente atendido" : "clientes atendidos"} con ficha,{" "}
              <b className="text-ink">{m.clientes.repiten}</b> ya habían venido antes y{" "}
              <b className="text-ink">{nuevos}</b> {nuevos === 1 ? "es nuevo" : "son nuevos"}.
              {m.clientes.total > 0 && (
                <> Que vuelvan es lo que sostiene la barbería; los nuevos son lo que la hace crecer.</>
              )}
            </p>
          </section>
        </>
      )}
    </div>
  );
}

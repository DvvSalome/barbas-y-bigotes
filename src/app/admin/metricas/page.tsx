import type { Metadata } from "next";
import Link from "next/link";
import { getMetricas, getSedes, type Periodo } from "@/lib/data/queries";
import type { SedeId } from "@/lib/data/types";
import { cop } from "@/lib/format";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { Kpi } from "@/components/admin/Kpi";
import { RankingMetrica } from "@/components/admin/RankingMetrica";
import { CashIcon, ScissorsIcon, UsersIcon, TagIcon } from "@/components/icons";
import { MON } from "@/lib/slots";

export const metadata: Metadata = { title: "Métricas · Admin" };

const PERIODOS: { id: Periodo; label: string }[] = [
  { id: "mes", label: "Este mes" },
  { id: "30d", label: "30 días" },
  { id: "90d", label: "90 días" },
];

// "2026-08-01" → "1 ago": acá se lee día-primero; "08-01" se entendía 8 de enero.
const fechaCo = (ymd: string) => {
  const [, m, d] = ymd.split("-").map(Number);
  return `${d} ${MON[m - 1] ?? ""}`;
};

/** Variación vs el período anterior. Sin base no hay porcentaje que valga. */
function Delta({ hoy, antes }: { hoy: number; antes: number }) {
  if (!antes) return <span className="text-muted">sin comparación</span>;
  const pct = Math.round(((hoy - antes) / antes) * 100);
  if (pct === 0) return <span className="text-muted">igual que antes</span>;
  // La baja va en el token de ALERTA (warn), no en el coral de marca: pintada
  // igual que los números buenos, un mes en caída no saltaba a la vista.
  return (
    <span className={pct > 0 ? "font-semibold text-ok" : "font-semibold text-warn"}>
      {pct > 0 ? "▲" : "▼"} {Math.abs(pct)}% vs período anterior
    </span>
  );
}

/** Barras con divs: no vale traer una librería de gráficos para esto. */
function Barras({ serie }: { serie: { ymd: string; total: number }[] }) {
  // Más de un mes se agrega POR SEMANA: 90 barras de <1px en un celular eran un
  // hilo decorativo; 13 barras semanales sí se leen (y el title da el detalle).
  const porSemana = serie.length > 31;
  const buckets = porSemana
    ? Array.from({ length: Math.ceil(serie.length / 7) }, (_, i) => {
        const grupo = serie.slice(i * 7, i * 7 + 7);
        return { ymd: grupo[0].ymd, total: grupo.reduce((a, d) => a + d.total, 0), semana: true };
      })
    : serie.map((d) => ({ ...d, semana: false }));
  const max = Math.max(...buckets.map((d) => d.total), 1);

  return (
    <div>
      {/* El pico va como leyenda propia: centrado entre las dos fechas parecía
          la etiqueta de una fecha del medio. */}
      <div className="mb-1.5 text-right text-xs text-muted">
        {porSemana ? "por semana · " : ""}pico <b className="tabular-nums text-ink">{cop(max)}</b>
      </div>
      <div className="flex h-36 items-end gap-[3px]">
        {buckets.map((d) => (
          <div
            key={d.ymd}
            title={`${d.semana ? "Semana del " : ""}${fechaCo(d.ymd)}: ${cop(d.total)}`}
            className="flex-1 rounded-t bg-accent/70 transition hover:bg-accent"
            style={{ height: `${Math.max((d.total / max) * 100, d.total > 0 ? 4 : 1.5)}%` }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-muted">
        <span>{serie[0] ? fechaCo(serie[0].ymd) : ""}</span>
        <span>{serie.at(-1) ? fechaCo(serie.at(-1)!.ymd) : ""}</span>
      </div>
    </div>
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
  // Segunda consulta SOLO cuando el período elegido salió vacío: sirve para
  // ofrecer el atajo, no se paga en el camino normal.
  const hayEn90 = m.servicios === 0 && p !== "90d" && (await getMetricas("90d", sede)).servicios > 0;
  const nuevos = m.clientes.total - m.clientes.repiten;

  return (
    <div className="max-w-6xl">
      <SectionHeader
        eyebrow="Negocio"
        title="Métricas"
        description="Cómo viene el negocio, no cómo viene el día. Para el día está la pantalla de inicio."
      />

      <div className="mt-5 flex flex-wrap items-center gap-2">
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
        {m.servicios > 0 && (
          <a
            href={`/admin/metricas/csv${qs(p)}`}
            className="ml-auto flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-[13px] font-semibold text-muted transition hover:border-ink/25 hover:text-ink"
          >
            ↓ Excel
          </a>
        )}
      </div>

      {m.servicios === 0 ? (
        // Una pantalla en blanco no dice si el negocio está parado o si el
        // período elegido simplemente no alcanza: si en 90 días SÍ hubo cobros,
        // se ofrece ir para allá en vez de dejar al dueño adivinando.
        <div className="mt-6 rounded-2xl border border-line bg-panel p-6">
          <p className="text-[13px] text-muted">
            No hubo cobros en este período{sede ? ` en ${nombreSede}` : ""}. Los números aparecen solos
            a medida que los barberos van cobrando en el mostrador.
          </p>
          {hayEn90 && (
            <Link
              href={qs("90d")}
              className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-accent/45 bg-accent/[0.07] px-4 text-[13px] font-semibold text-accent-soft transition hover:bg-accent/15"
            >
              Ver los últimos 90 días →
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {/* El delta vive DENTRO de "Entró en caja": suelto bajo la grilla
                parecía aplicar a las cuatro tarjetas y solo compara la plata. */}
            <Kpi label="Entró en caja" value={cop(m.plata)} Icon={CashIcon} hint={<Delta hoy={m.plata} antes={m.antes.plata} />} />
            <Kpi label="Cobros" value={String(m.servicios)} Icon={ScissorsIcon} accent={false} />
            <Kpi label="Promedio por cliente" value={cop(m.ticket)} Icon={UsersIcon} accent={false} />
            <Kpi label="Propinas" value={cop(m.propinas)} Icon={TagIcon} accent={false} />
          </div>

          <section className="mt-6 rounded-2xl border border-line bg-panel p-5">
            <h3 className="mb-3 font-display text-lg">Día por día</h3>
            <Barras serie={m.serie} />
          </section>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <RankingMetrica
              titulo="Quién produce"
              orden="por plata"
              vacio="Sin cobros asignados a un barbero."
              filas={m.porBarbero.map((b) => ({
                nombre: b.nombre,
                fotoUrl: b.fotoUrl,
                valor: cop(b.plata),
                sub: `${b.cortes} ${b.cortes === 1 ? "cobro" : "cobros"}`,
                peso: b.plata,
              }))}
            />
            <RankingMetrica
              titulo="Qué piden"
              orden="por veces pedidas"
              vacio="Los cobros de este período no tienen servicios detallados."
              filas={m.porServicio.map((s) => ({
                nombre: s.nombre,
                valor: `${s.veces}×`,
                sub: `deja ${cop(s.plata)}`,
                peso: s.veces,
              }))}
            />
            <RankingMetrica
              titulo="Qué se vende"
              orden="por plata"
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
            {/* Mini-cuadros, no un párrafo: los tres números se leen de un golpe. */}
            <div className="mt-3 grid grid-cols-3 gap-3">
              {[
                { n: m.clientes.total, l: "atendidos con ficha", tono: "text-ink" },
                { n: m.clientes.repiten, l: "ya habían venido", tono: "text-accent-soft" },
                { n: nuevos, l: nuevos === 1 ? "es nuevo" : "son nuevos", tono: "text-ok" },
              ].map((k) => (
                <div key={k.l} className="rounded-xl border border-line bg-elevated px-3 py-2.5">
                  <div className={`font-display text-2xl font-bold tabular-nums ${k.tono}`}>{k.n}</div>
                  <div className="text-[11px] leading-tight text-muted">{k.l}</div>
                </div>
              ))}
            </div>
            {m.clientes.total > 0 && (
              <p className="mt-2.5 text-[12px] text-muted">
                Que vuelvan es lo que sostiene la barbería; los nuevos son lo que la hace crecer.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

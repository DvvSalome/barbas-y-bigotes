import { getSedes, getHorarioSemanal, getDiasEspeciales } from "@/lib/data/queries";
import { resumirSemana, horarioEfectivo, fmtTime, DOW, MON, dowDeFecha } from "@/lib/slots";

// Bloque público "Horarios de atención": la semana de cada sede (resumida) más las
// próximas excepciones (un sábado distinto, un festivo cerrado). Sale del MISMO
// horarioEfectivo que arma los turnos, así que nunca contradice lo que el cliente
// ve al reservar. Server component: lee anon (getHorarioSemanal/getDiasEspeciales),
// y si la migración 0048 aún no se aplicó cae al respaldo 9-20 sin romperse.

// "sáb 15 nov" a partir de un YYYY-MM-DD, sin líos de huso.
function fechaCorta(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number);
  return `${DOW[dowDeFecha(ymd)]} ${d} ${MON[m - 1]}`;
}

export async function HorariosAtencion({ sinTitulo = false }: { sinTitulo?: boolean } = {}) {
  const [sedes, semanal, especiales] = await Promise.all([
    getSedes(),
    getHorarioSemanal(),
    getDiasEspeciales(),
  ]);

  return (
    <div className={`text-left ${sinTitulo ? "mt-4" : "mt-8"}`}>
      {/* Sin título cuando ya lo pone quien lo envuelve (el pie compacto lo abre
          desde un <details> que se llama igual, y repetirlo sobraba). */}
      {!sinTitulo && (
        <div className="mb-4 flex items-center gap-3">
          <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-transparent to-[rgba(242,237,228,0.16)]" />
          <span className="font-display text-[13px] font-extrabold uppercase tracking-[0.24em] text-accent">
            Horarios de atención
          </span>
          <span aria-hidden className="h-px flex-1 bg-gradient-to-l from-transparent to-[rgba(242,237,228,0.16)]" />
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 md:gap-3.5">
        {sedes.map((s) => {
          const semanalSede = semanal.filter((h) => h.sede === s.id);
          const especialesSede = especiales.filter((e) => e.sede === s.id);
          const filas = resumirSemana(semanalSede);
          const proximas = especialesSede.slice(0, 3);
          return (
            <div
              key={s.id}
              className="rounded-[14px] border border-[rgba(242,237,228,0.08)] bg-[rgba(21,19,17,0.5)] px-4 py-3.5"
            >
              <div className="font-display text-sm font-bold uppercase">{s.nombre}</div>
              <dl className="mt-2 space-y-1">
                {filas.map((f) => (
                  <div key={f.dias} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                    <dt className="text-muted">{f.dias}</dt>
                    <dd className={`tabular-nums ${f.horas === "Cerrado" ? "text-accent-soft font-semibold" : "font-semibold"}`}>
                      {f.horas}
                    </dd>
                  </div>
                ))}
              </dl>

              {proximas.length > 0 && (
                <div className="mt-3 border-t border-[rgba(242,237,228,0.07)] pt-2.5">
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted">Días especiales</div>
                  <ul className="mt-1 space-y-1">
                    {proximas.map((e) => {
                      const v = horarioEfectivo(e.fecha, semanalSede, especialesSede);
                      const horas = v.abierta ? `${fmtTime(v.abreMin)} a ${fmtTime(v.cierraMin)}` : "Cerrado";
                      return (
                        <li key={e.fecha} className="flex items-baseline justify-between gap-3 text-[12px]">
                          <span className="text-muted">{fechaCorta(e.fecha)}</span>
                          <span className={`font-semibold tabular-nums ${v.abierta ? "text-ink" : "text-accent-soft"}`}>
                            {horas}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

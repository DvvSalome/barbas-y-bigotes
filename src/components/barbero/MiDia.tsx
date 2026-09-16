import { cop } from "@/lib/format";
import type { MiSemana } from "@/lib/data/queries";

/*
  "Tu día", el bloque que le faltaba al barbero (16-sep).

  Hasta ahora el mostrador mostraba SIEMPRE el local: el número grande era lo
  cobrado por la sede, la lista de libres eran los tres, y los cobros del día los
  de todos. Eso está bien en la tablet del mostrador, que es compartida. Pero
  desde que cada barbero lo abre en su propio celular, la primera pregunta al
  desbloquear la pantalla es "¿cuánto llevo y qué me falta?", y ese dato estaba a
  tres toques, dentro de la pestaña Cierre y mezclado con el de los demás.

  Va SOLO cuando entra un barbero con su PIN. El mostrador de la sede y el dueño
  siguen viendo el local, que es lo que les sirve.

  Lo de la SEMANA es opcional (0074): lo prende el dueño en Admin → Equipo. Lo de
  HOY no se configura, es lo que el barbero acaba de hacer con sus manos.
*/
export function MiDia({
  nombre,
  cobradoHoy,
  atenciones,
  proxima,
  semana,
}: {
  nombre: string;
  cobradoHoy: number;
  atenciones: number;
  /** La próxima cita suya que todavía no pasó, si hay. */
  proxima: { hora: string; cliente: string; servicio: string } | null;
  /** Solo si el dueño lo habilitó; si no, null y el bloque no se dibuja. */
  semana: MiSemana | null;
}) {
  return (
    <section
      aria-label="Tu día"
      className="bb-relieve mb-5 overflow-hidden rounded-2xl border border-line bg-panel"
    >
      <span aria-hidden className="bb-poste block h-1 w-full" />

      <div className="px-4 py-4 sm:px-5">
        <p className="eyebrow">Tu día, {nombre}</p>

        <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <div className="bb-monto font-display text-[34px] font-extrabold leading-none tabular-nums text-ok">
              {cop(cobradoHoy)}
            </div>
            <p className="mt-1 text-[12.5px] text-muted">lo que cobraste hoy</p>
          </div>
          <div>
            <div className="font-display text-[26px] font-bold leading-none tabular-nums text-ink">{atenciones}</div>
            <p className="mt-1 text-[12.5px] text-muted">
              {atenciones === 1 ? "atención cerrada" : "atenciones cerradas"}
            </p>
          </div>
        </div>

        {/* Qué viene. Sin esto había que leer la agenda entera y buscarse. */}
        <div className="mt-3.5 flex min-h-11 items-center gap-2.5 rounded-xl bg-elevated px-3.5 py-2.5">
          {proxima ? (
            <>
              <span className="shrink-0 font-display text-[15px] font-bold tabular-nums text-accent-soft">
                {proxima.hora}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
                {proxima.cliente}
                <span className="text-muted"> · {proxima.servicio}</span>
              </span>
              <span className="shrink-0 text-[11.5px] uppercase tracking-[0.1em] text-muted">tu próxima</span>
            </>
          ) : (
            <span className="text-[13.5px] text-muted">No te queda ninguna cita por delante hoy.</span>
          )}
        </div>

        {semana && (
          <div className="mt-3 border-t border-line pt-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-[12.5px] text-muted">
                Esta semana llevás <span className="bb-monto font-semibold text-ink">{cop(semana.facturado)}</span> en{" "}
                {semana.cobros} {semana.cobros === 1 ? "cobro" : "cobros"}.
              </p>
              <p className="text-[13px]">
                <span className="text-muted">Te queda por cobrar </span>
                <span className="bb-monto font-display text-[18px] font-bold tabular-nums text-ink">
                  {cop(semana.neto)}
                </span>
              </p>
            </div>
            {(semana.adelantos > 0 || semana.consumos > 0) && (
              <p className="mt-1 text-[12px] text-muted">
                Ya descontados {cop(semana.adelantos)} de adelantos y {cop(semana.consumos)} de consumos.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

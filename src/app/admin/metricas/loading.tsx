// Esqueleto de Métricas: lo que se ve al ENTRAR a la pantalla mientras el
// servidor hace las cuentas. Cambiar de período no pasa por acá (Next deja la
// pantalla anterior puesta): esa señal la da PeriodoChips, marcando el botón y
// atenuando lo de abajo. Mismos bloques y proporciones que la pantalla real.

const pulso = "animate-pulse rounded-2xl border border-line bg-panel";

export default function CargandoMetricas() {
  return (
    <div aria-busy="true" aria-label="Cargando métricas">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-panel" />
      <div className="mt-5 flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-11 w-24 shrink-0 animate-pulse rounded-full border border-line bg-panel" />
        ))}
      </div>
      <div className={`mt-4 h-52 ${pulso}`} />
      <div className={`mt-4 h-80 ${pulso}`} />
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className={`h-64 ${pulso}`} />
        ))}
      </div>
    </div>
  );
}

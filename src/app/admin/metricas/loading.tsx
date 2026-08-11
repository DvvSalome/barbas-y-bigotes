// Skeleton de Métricas: cambiar de período recalcula todo en el server y sin
// esto el toque en "90 días" no daba NINGUNA señal (el dueño lo repetía o
// creía que se colgó). Mismos bloques y proporciones que la pantalla real.

const pulso = "animate-pulse rounded-2xl border border-line bg-panel";

export default function CargandoMetricas() {
  return (
    <div aria-busy="true" aria-label="Cargando métricas">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-panel" />
      <div className="mt-4 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-11 w-24 animate-pulse rounded-xl border border-line bg-panel" />
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-28 ${pulso}`} />
        ))}
      </div>
      <div className={`mt-6 h-48 ${pulso}`} />
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-64 ${pulso}`} />
        ))}
      </div>
    </div>
  );
}

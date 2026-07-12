/*
  Fila de stats (spec §1.3 móvil / §2.3 desktop). Los números salen de la DB
  (conteo real de sedes/barberos/servicios), no hardcodeados: si el catálogo
  cambia, la home no miente. Server component (queda en el HTML SSR para IA).
*/
export function HomeStats({
  sedesCount,
  barberosCount,
  serviciosCount,
}: {
  sedesCount: number;
  barberosCount: number;
  serviciosCount: number;
}) {
  const stats: [number, string][] = [
    [sedesCount, "Sedes en Barranquilla"],
    [barberosCount, "Barberos expertos"],
    [serviciosCount, "Servicios y combos"],
  ];

  return (
    <div className="grid grid-cols-3 border-b border-[rgba(242,237,228,0.1)] md:mx-auto md:max-w-[1180px] md:border-t">
      {stats.map(([n, label]) => (
        <div
          key={label}
          className="border-r border-[rgba(242,237,228,0.08)] px-1.5 py-4 text-center md:py-[22px]"
        >
          <div className="font-display text-[26px] font-extrabold tabular-nums text-ink md:text-[34px]">
            {n}
          </div>
          <div className="mt-0.5 text-[10.5px] uppercase tracking-[0.14em] text-muted md:text-[11px] md:tracking-[0.16em]">
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}

// "Cubre hoy en la otra sede" (0081, 9-oct): por un día, un barbero cuenta como
// de la sede que cubre. Módulo puro: lo usan el mostrador (página /barbero) y la
// ruta de cupos, y lo prueba scripts/check-cobertura.ts.

export type Cobertura = { barberoId: string; fecha: string; sede: string };

/**
 * Los barberos con la sede en la que trabajan ESE día: el que cubre en la otra
 * sede aparece con la sede que cubre. Así todo lo que ya filtra "los de mi sede"
 * (columnas del mostrador, walk-in, venta rápida, calendario) lo incluye sin
 * tocar cada pantalla, y deja de listarlo en su sede de siempre.
 */
export function equipoDelDia<B extends { id: string; sede: string }>(barberos: B[], coberturas: Cobertura[], fecha: string): B[] {
  return barberos.map((b) => {
    const c = coberturas.find((x) => x.barberoId === b.id && x.fecha === fecha);
    return c && c.sede !== b.sede ? { ...b, sede: c.sede } : b;
  });
}

/** Los que ese día cubren lejos de su sede: id → su sede de siempre. */
export function visitasDelDia<B extends { id: string; sede: string }>(
  barberos: B[],
  coberturas: Cobertura[],
  fecha: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const b of barberos) {
    const c = coberturas.find((x) => x.barberoId === b.id && x.fecha === fecha);
    if (c && c.sede !== b.sede) out[b.id] = b.sede;
  }
  return out;
}

// El racimo de hexágonos del techo de luces (el de las dos sedes, el que sale en
// todas las fotos del local). Geometría pura: el SVG del hero y el del cierre
// salen de acá, así los dos techos son el mismo.
//
// Hexágonos de lado plano arriba (así están colgados en el local), en
// coordenadas axiales (q, r). Cada tubo es una ARISTA: las compartidas entre dos
// hexágonos se dibujan una sola vez, como en el techo real.

export type Tubo = { x1: number; y1: number; x2: number; y2: number; /** distancia al centro: orden de encendido */ d: number };

const R = 50; // radio (= largo del tubo)
const S3 = Math.sqrt(3);

/** Las celdas, copiadas a ojo del techo de Plaza de la Paz: una franja diagonal. */
export const CELDAS: readonly [number, number][] = [
  [0, 0],
  [1, 0],
  [1, -1],
  [2, -1],
  [2, -2],
  [3, -2],
  [0, 1],
  [-1, 1],
  [3, -1],
  [-1, 2],
];

function vertices(q: number, r: number): [number, number][] {
  const cx = R * 1.5 * q;
  const cy = R * S3 * (r + q / 2);
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return [Math.round((cx + R * Math.cos(a)) * 10) / 10, Math.round((cy + R * Math.sin(a)) * 10) / 10];
  });
}

function armar(celdas: readonly [number, number][]) {
  const vistos = new Map<string, Omit<Tubo, "d">>();
  for (const [q, r] of celdas) {
    const v = vertices(q, r);
    for (let i = 0; i < 6; i++) {
      const [a, b] = [v[i], v[(i + 1) % 6]];
      const clave = [a, b]
        .map((p) => p.join(","))
        .sort()
        .join("|");
      if (!vistos.has(clave)) vistos.set(clave, { x1: a[0], y1: a[1], x2: b[0], y2: b[1] });
    }
  }
  const tubos = [...vistos.values()];
  const xs = tubos.flatMap((t) => [t.x1, t.x2]);
  const ys = tubos.flatMap((t) => [t.y1, t.y2]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const [cx, cy] = [(minX + maxX) / 2, (minY + maxY) / 2];
  const pad = 14; // margen para el halo
  return {
    viewBox: `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`,
    // Ordenados del centro hacia afuera: el techo se prende en ola, como cuando
    // abren el local.
    tubos: tubos
      .map((t) => ({ ...t, d: Math.hypot((t.x1 + t.x2) / 2 - cx, (t.y1 + t.y2) / 2 - cy) }))
      .sort((a, b) => a.d - b.d),
  };
}

export const RACIMO = armar(CELDAS);

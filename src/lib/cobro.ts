// Matemática pura del cobro (sin I/O): la usan completarReserva, el total en
// vivo del form de cobro y el chequeo ejecutable scripts/check-cobro.ts.
// Mantener libre de imports de Next/Supabase para que Node lo corra directo.

// Fidelidad: el cliente gana 1 punto por cada $1.000 cobrados (neto, sin propina).
export const PUNTOS_POR_COP = 1000;

export type ItemCobro = {
  /** Precio unitario en COP. */
  precio: number;
  cantidad: number;
};

export type CuponCobro = { tipo: "porcentaje" | "monto"; valor: number };

export type Cobro = {
  /** Servicios + adicionales + productos, sin descuento. */
  bruto: number;
  /** Descuento del cupón, nunca más que el bruto. */
  descuento: number;
  /** Neto que queda en ventas.total — la propina NO entra acá. */
  total: number;
  /** Propina saneada: entero COP ≥ 0, va aparte en su columna. */
  propina: number;
  /** total + propina: lo que el cliente paga en la mano. */
  aCobrar: number;
  /** Puntos de fidelidad sobre el neto SIN propina. */
  puntos: number;
};

// Total / descuento / propina / puntos del cierre. Reglas:
//   * el descuento (cupón) aplica sobre servicios + productos, con tope el bruto;
//   * la propina nunca entra al total ni suma puntos;
//   * los puntos son floor(neto / $1.000).
export function calcularCobro(input: {
  items: ItemCobro[];
  cupon?: CuponCobro | null;
  propina?: number;
}): Cobro {
  const bruto = input.items.reduce((a, it) => a + it.precio * it.cantidad, 0);
  let descuento = 0;
  if (input.cupon) {
    descuento =
      input.cupon.tipo === "porcentaje"
        ? Math.round((bruto * input.cupon.valor) / 100)
        : input.cupon.valor;
    descuento = Math.max(0, Math.min(descuento, bruto)); // nunca más que el bruto
  }
  const total = Math.max(0, bruto - descuento);
  const propina = Number.isFinite(input.propina)
    ? Math.max(0, Math.floor(input.propina as number))
    : 0;
  return {
    bruto,
    descuento,
    total,
    propina,
    aCobrar: total + propina,
    puntos: Math.floor(total / PUNTOS_POR_COP),
  };
}

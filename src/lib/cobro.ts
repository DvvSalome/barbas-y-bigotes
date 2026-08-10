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
  /** Beneficio de la tarjeta de cortes (monto): se suma al descuento del cupón. */
  descuentoExtra?: number;
}): Cobro {
  const bruto = input.items.reduce((a, it) => a + it.precio * it.cantidad, 0);
  let descuentoCupon = 0;
  if (input.cupon) {
    descuentoCupon =
      input.cupon.tipo === "porcentaje"
        ? Math.round((bruto * input.cupon.valor) / 100)
        : input.cupon.valor;
  }
  const descuentoExtra = Number.isFinite(input.descuentoExtra)
    ? Math.max(0, input.descuentoExtra as number)
    : 0;
  // Cupón + beneficio de tarjeta; nunca más que el bruto (total jamás negativo).
  const descuento = Math.max(0, Math.min(descuentoCupon + descuentoExtra, bruto));
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

export type TotalesPorMedio = Record<string, { total: number; propina: number }>;

export type SnapshotDinero = {
  /** Desglose por medio (slug → total + propina). */
  totales: TotalesPorMedio;
  /** Total cobrado en efectivo (sin propina). */
  efectivo: number;
  /** Total cobrado por datáfono. */
  datafono: number;
  /** Ingresos de TODOS los medios (sin propina). */
  ingresos: number;
  /** Esperado en el cajón = fondo de apertura + efectivo + propina en efectivo − gastos. */
  esperadoEfectivo: number;
};

// Snapshot de dinero de una caja (PURO, sin I/O): agrupa ventas por medio y
// calcula el efectivo esperado en el cajón. Lo usan el cierre de caja (admin
// cerrarCaja y barbero cerrarCajaSede) y los paneles de estado. Testeado en
// scripts/check-caja.ts. La regla del cajón: el efectivo esperado parte del
// FONDO DE APERTURA (lo que ya estaba en el cajón), le suma el efectivo cobrado
// y las propinas cobradas EN EFECTIVO (esas sí van al cajón, no las de otros
// medios) y le RESTA los gastos pagados en efectivo desde la apertura.
export function snapshotDinero(
  ventas: { medio: string; total: number; propina?: number | null; propinaMedio?: string | null }[],
  opts?: { montoApertura?: number; totalGastos?: number },
): SnapshotDinero {
  const totales = totalesPorMedio(ventas);
  const efectivo = totales.efectivo?.total ?? 0;
  const datafono = totales.datafono?.total ?? 0;
  const ingresos = Object.values(totales).reduce((a, t) => a + t.total, 0);
  const montoApertura = opts?.montoApertura ?? 0;
  const totalGastos = opts?.totalGastos ?? 0;
  const esperadoEfectivo =
    montoApertura + efectivo + (totales.efectivo?.propina ?? 0) - totalGastos;
  return { totales, efectivo, datafono, ingresos, esperadoEfectivo };
}

// Diferencia de caja al cierre: contado − esperado. Positiva = sobra en el cajón;
// negativa = falta. Es lo que el barbero/admin ve y lo que va al email del dueño.
export function diferenciaCaja(efectivoContado: number, esperadoEfectivo: number): number {
  return efectivoContado - esperadoEfectivo;
}

// Agrupa ventas por medio de pago: el snapshot que queda en caja_sesiones.totales
// y el desglose que muestran las cards de caja. La propina va aparte del total
// (la propina en efectivo sí entra al cajón para el cuadre).
export function totalesPorMedio(
  ventas: { medio: string; total: number; propina?: number | null; propinaMedio?: string | null }[],
): TotalesPorMedio {
  const out: TotalesPorMedio = {};
  const bucket = (medio: string) => (out[medio] ??= { total: 0, propina: 0 });
  for (const v of ventas) {
    bucket(v.medio).total += v.total;
    // La propina se atribuye a SU medio (propina_medio, 0053); si no se registró, al
    // de la venta (compat). Así una propina en efectivo sobre una venta por Nequi
    // suma al bucket de efectivo (entra al cajón), no al de Nequi.
    bucket(v.propinaMedio ?? v.medio).propina += v.propina ?? 0;
  }
  return out;
}

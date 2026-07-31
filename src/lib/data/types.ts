export type SedeId = "parque-venezuela" | "plaza-de-la-paz";

export interface Sede {
  id: SedeId;
  nombre: string;
  direccion?: string;
}

export type Categoria =
  | "cortes"
  | "barba"
  | "cejas-disenos"
  | "faciales"
  | "capilar"
  | "depilacion"
  | "combos";

export interface Servicio {
  id: string;
  nombre: string;
  categoria: Categoria;
  duracionMin: number;
  /** Precio por sede en COP. Parcial a propósito: un servicio puede no tener
   *  fila en servicio_sede para todas las sedes, así que la sede ausente es
   *  `undefined` (no 0). Los consumidores deben guardar con `!= null` o `?? 0`. */
  precios: Partial<Record<SedeId, number>>;
  /** Precio "desde $X". */
  desde?: boolean;
  esCombo?: boolean;
  /** Solo lo llena el catálogo admin (getServiciosCatalogoAdmin): un servicio
   *  desactivado (activo=false) no aparece en la reserva. La lectura pública
   *  (getServicios) ya filtra activo=true, así que ahí queda undefined. */
  activo?: boolean;
}

export type TipoContrato = "porcentaje" | "arriendo";

export interface Barbero {
  id: string;
  nombre: string;
  sede: SedeId;
  especialidades: string[];
  tipoContrato: TipoContrato;
  /** Si tipoContrato = "porcentaje". */
  comisionPct?: number;
  /** Si tipoContrato = "arriendo" (COP/mes). */
  arriendoMensual?: number;
  fotoUrl?: string | null;
  destacado?: boolean;
  rating?: number;
  resenas?: number;
  bio?: string | null;
}

export interface Producto {
  id: string;
  nombre: string;
  sede: SedeId;
  precio: number;
  stock: number;
  stockMinimo: number;
  comisionPct: number;
  /** Aparece en el paso "¿le sumas una bebida?" del wizard (config por sede). */
  enUpsell: boolean;
  /** Foto subida por el admin (Supabase Storage); null mientras no haya. */
  fotoUrl?: string | null;
}

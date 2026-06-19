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
  /** Precio por sede en COP. */
  precios: Record<SedeId, number>;
  /** Precio "desde $X". */
  desde?: boolean;
  esCombo?: boolean;
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
}

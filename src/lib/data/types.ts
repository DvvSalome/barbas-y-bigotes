export type SedeId = "parque-venezuela" | "plaza-de-la-paz";

export interface Sede {
  id: SedeId;
  nombre: string;
  direccion?: string;
  /** Fachada subida por el admin (bucket 'sedes'); la ve el cliente al reservar (0058). */
  fotoUrl?: string | null;
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
  /** Foto real subida por el admin (bucket 'servicios'); null = sin foto (0055). */
  fotoUrl?: string | null;
  /** Una frase de qué incluye; la ve el cliente al reservar (0055). */
  descripcion?: string | null;
  /** ¿Suma sello en la tarjeta de fidelidad? false = no (la barba, los
   *  cerquillos). undefined en lecturas que no lo piden; el criterio real es
   *  `!== false`, igual que en getCorteIds. */
  cuentaCorte?: boolean | null;
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
  /** Contrato: dato CONFIDENCIAL. Solo viene en getBarberosContrato (admin); el
   *  catálogo público (getBarberos) lo omite, por eso es opcional. Ver migración 0049. */
  tipoContrato?: TipoContrato;
  /** Si tipoContrato = "porcentaje". Confidencial (ver arriba). */
  comisionPct?: number;
  /** Si tipoContrato = "arriendo" (COP/mes). Confidencial (ver arriba). */
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

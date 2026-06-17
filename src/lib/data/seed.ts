import type { Sede, SedeId, Servicio, Barbero, Producto, Categoria } from "./types";

// Fuente de verdad temporal de los datos del cliente mientras conectamos Supabase.
// Espeja supabase/migrations/0001_init.sql + el seed que poblará la base.

export const sedes: Sede[] = [
  { id: "parque-venezuela", nombre: "Parque Venezuela" },
  { id: "plaza-de-la-paz", nombre: "Plaza de la Paz" },
];

export const categorias: Record<Categoria, string> = {
  cortes: "Cortes",
  barba: "Barba",
  "cejas-disenos": "Cejas y diseños",
  faciales: "Faciales",
  capilar: "Capilar y color",
  depilacion: "Depilación",
  combos: "Combos",
};

/** precio por sede: (Parque Venezuela, Plaza de la Paz) */
const p = (pv: number, pdp: number): Record<SedeId, number> => ({
  "parque-venezuela": pv,
  "plaza-de-la-paz": pdp,
});

export const servicios: Servicio[] = [
  // --- Cortes ---
  { id: "corte", nombre: "Corte clásico / degradado / tijera / niño", categoria: "cortes", duracionMin: 30, precios: p(35000, 30000) },
  { id: "corte-barba", nombre: "Corte y barba", categoria: "cortes", duracionMin: 60, precios: p(45000, 40000) },
  { id: "cerquillos", nombre: "Cerquillos", categoria: "cortes", duracionMin: 10, precios: p(15000, 10000) },
  // --- Barba ---
  { id: "perfilamiento-barba", nombre: "Perfilamiento de barba", categoria: "barba", duracionMin: 20, precios: p(25000, 20000) },
  { id: "ritual-barba", nombre: "Ritual de barba", categoria: "barba", duracionMin: 30, precios: p(35000, 30000) },
  // --- Cejas y diseños ---
  { id: "disenos", nombre: "Diseños", categoria: "cejas-disenos", duracionMin: 10, precios: p(7000, 7000), desde: true },
  { id: "perfilamiento-cejas", nombre: "Perfilamiento de cejas", categoria: "cejas-disenos", duracionMin: 10, precios: p(5000, 5000) },
  // --- Faciales ---
  { id: "mascarilla-puntos-negros", nombre: "Mascarilla puntos negros", categoria: "faciales", duracionMin: 15, precios: p(10000, 10000) },
  { id: "mascarilla-hidratante", nombre: "Mascarilla hidratante", categoria: "faciales", duracionMin: 15, precios: p(10000, 10000) },
  { id: "parches-colageno", nombre: "Parches de colágeno", categoria: "faciales", duracionMin: 10, precios: p(7000, 7000) },
  { id: "limpieza-silver", nombre: "Limpieza facial silver", categoria: "faciales", duracionMin: 20, precios: p(20000, 20000) },
  { id: "limpieza-gold", nombre: "Limpieza facial gold", categoria: "faciales", duracionMin: 35, precios: p(35000, 40000) },
  // --- Capilar y color ---
  { id: "peinados", nombre: "Peinados", categoria: "capilar", duracionMin: 20, precios: p(15000, 15000), desde: true },
  { id: "hidratacion-capilar", nombre: "Hidratación capilar", categoria: "capilar", duracionMin: 30, precios: p(20000, 20000) },
  { id: "relajante-ondas", nombre: "Relajante de ondas", categoria: "capilar", duracionMin: 20, precios: p(30000, 30000), desde: true },
  { id: "keratina", nombre: "Keratina", categoria: "capilar", duracionMin: 60, precios: p(90000, 90000), desde: true },
  { id: "rayitos", nombre: "Rayitos", categoria: "capilar", duracionMin: 180, precios: p(150000, 150000) },
  { id: "tintura-barba", nombre: "Tintura de barba", categoria: "capilar", duracionMin: 20, precios: p(20000, 20000) },
  { id: "tintura-canas", nombre: "Tintura de canas", categoria: "capilar", duracionMin: 20, precios: p(30000, 30000) },
  { id: "tintura-color", nombre: "Tintura de cabello color", categoria: "capilar", duracionMin: 180, precios: p(150000, 150000) },
  { id: "tintura-pigmento", nombre: "Tintura de barba o cabello con pigmento", categoria: "capilar", duracionMin: 10, precios: p(15000, 15000) },
  // --- Depilación con cera ---
  { id: "depil-nariz-orejas", nombre: "Depilación cera nariz/orejas", categoria: "depilacion", duracionMin: 10, precios: p(10000, 10000) },
  { id: "depil-nariz-y-orejas", nombre: "Depilación cera nariz y orejas", categoria: "depilacion", duracionMin: 15, precios: p(16000, 16000) },
  { id: "depil-bozo", nombre: "Depilación cera bozo", categoria: "depilacion", duracionMin: 10, precios: p(10000, 10000) },
  { id: "depil-barba", nombre: "Depilación cera barba", categoria: "depilacion", duracionMin: 10, precios: p(15000, 15000) },
  { id: "depil-bozo-barba", nombre: "Depilación cera bozo y barba", categoria: "depilacion", duracionMin: 20, precios: p(20000, 20000) },

  // --- Combos Premium (precio único ambas sedes) ---
  { id: "combo-silver", nombre: "Corte + limpieza facial silver + bebida", categoria: "combos", duracionMin: 60, precios: p(55000, 55000), esCombo: true },
  { id: "combo-gold", nombre: "Corte + limpieza facial gold + bebida", categoria: "combos", duracionMin: 75, precios: p(75000, 75000), esCombo: true },
  { id: "combo-barba-silver", nombre: "Corte + barba + limpieza silver + bebida", categoria: "combos", duracionMin: 70, precios: p(65000, 65000), esCombo: true },
  { id: "combo-barba-gold", nombre: "Corte + barba + limpieza gold + bebida", categoria: "combos", duracionMin: 90, precios: p(85000, 85000), esCombo: true },
  { id: "combo-cera", nombre: "Corte + cera orejas o nariz + bebida", categoria: "combos", duracionMin: 45, precios: p(45000, 45000), esCombo: true },
  { id: "combo-barba-cera", nombre: "Corte + barba + cera orejas o nariz + bebida", categoria: "combos", duracionMin: 60, precios: p(55000, 55000), esCombo: true },
  { id: "combo-hidratacion", nombre: "Corte + hidratación", categoria: "combos", duracionMin: 60, precios: p(55000, 55000), esCombo: true },
  { id: "combo-barba-hidratacion", nombre: "Corte + barba + hidratación", categoria: "combos", duracionMin: 70, precios: p(65000, 65000), esCombo: true },
  { id: "combo-keratina", nombre: "Corte + keratina", categoria: "combos", duracionMin: 90, precios: p(140000, 140000), esCombo: true },
  { id: "combo-keratina-hidratacion", nombre: "Corte + keratina + hidratación capilar + bebida", categoria: "combos", duracionMin: 120, precios: p(160000, 160000), esCombo: true },
  { id: "combo-relajante", nombre: "Corte + relajante de ondas", categoria: "combos", duracionMin: 60, precios: p(70000, 70000), esCombo: true },
  { id: "combo-relajante-hidratacion", nombre: "Corte + relajante de ondas + hidratación + bebida", categoria: "combos", duracionMin: 90, precios: p(90000, 90000), esCombo: true },
  { id: "combo-tintura", nombre: "Corte + tintura de barba o tapacanas", categoria: "combos", duracionMin: 60, precios: p(50000, 50000), esCombo: true },
  { id: "combo-diseno", nombre: "Corte + diseño", categoria: "combos", duracionMin: 45, precios: p(40000, 40000), esCombo: true },
  { id: "combo-peinado", nombre: "Corte + peinado", categoria: "combos", duracionMin: 60, precios: p(45000, 45000), esCombo: true },

  // --- Combos Deluxe ---
  { id: "deluxe-1", nombre: "Deluxe: corte + limpieza gold + depilación nariz + cejas + hidratación + masaje + bebida", categoria: "combos", duracionMin: 120, precios: p(115000, 115000), esCombo: true },
  { id: "deluxe-2", nombre: "Deluxe full: corte + limpieza gold + depilación nariz/oreja + bozo y barba + cejas + pigmento + hidratación + masaje + bebida", categoria: "combos", duracionMin: 150, precios: p(150000, 150000), esCombo: true },
];

export const barberos: Barbero[] = [
  {
    id: "meyer", nombre: "Meyer", sede: "parque-venezuela",
    especialidades: ["Degradados", "Tijera", "Niños", "Barbas", "Relajante de ondas", "Diseños", "Limpieza facial"],
    tipoContrato: "porcentaje", comisionPct: 50, fotoUrl: null, destacado: true, rating: 4.9, resenas: 212,
  },
  {
    id: "jhon", nombre: "Jhon", sede: "parque-venezuela",
    especialidades: ["Cortes clásicos", "Niños", "Tijera", "Barba", "Keratinas", "Peinados", "Degradados", "Tintes planos"],
    tipoContrato: "porcentaje", comisionPct: 50, fotoUrl: null, destacado: true, rating: 4.8, resenas: 176,
  },
  {
    id: "junior", nombre: "Junior", sede: "parque-venezuela",
    especialidades: ["Degradados", "Clásicos", "Barbas", "Colorimetría", "Limpieza facial"],
    tipoContrato: "porcentaje", comisionPct: 50, fotoUrl: null, destacado: false, rating: 4.8, resenas: 143,
  },
  {
    id: "brayan", nombre: "Brayan", sede: "plaza-de-la-paz",
    especialidades: ["Degradados", "Clásicos", "Barbas", "Limpieza facial", "Tijera", "Depilación con cera"],
    tipoContrato: "porcentaje", comisionPct: 50, fotoUrl: null, destacado: false, rating: 4.9, resenas: 198,
  },
  {
    id: "kevin", nombre: "Kevin", sede: "plaza-de-la-paz",
    especialidades: ["Degradados", "Clásicos", "Barbas", "Tijera", "Niños", "Alisado", "Hidratación capilar", "Depilación con cera"],
    tipoContrato: "porcentaje", comisionPct: 50, fotoUrl: null, destacado: false, rating: 4.7, resenas: 121,
  },
  {
    id: "abel", nombre: "Abel", sede: "plaza-de-la-paz",
    especialidades: ["Degradados", "Clásicos", "Barbas", "Diseños", "Colorimetría", "Peinados", "Niños", "Tijera"],
    tipoContrato: "porcentaje", comisionPct: 50, fotoUrl: null, destacado: true, rating: 4.9, resenas: 167,
  },
];

// Productos de muestra (retail / consumos). Reemplazar por el inventario real del cliente.
export const productos: Producto[] = [
  { id: "cera-mate", nombre: "Cera mate fijación fuerte", sede: "parque-venezuela", precio: 28000, stock: 14, stockMinimo: 5, comisionPct: 10 },
  { id: "aceite-barba", nombre: "Aceite para barba", sede: "parque-venezuela", precio: 32000, stock: 9, stockMinimo: 4, comisionPct: 10 },
  { id: "shampoo-anticaspa", nombre: "Shampoo anticaspa", sede: "parque-venezuela", precio: 25000, stock: 3, stockMinimo: 5, comisionPct: 10 },
  { id: "bebida", nombre: "Bebida (gaseosa / energizante)", sede: "parque-venezuela", precio: 5000, stock: 40, stockMinimo: 12, comisionPct: 0 },
  { id: "cera-mate-pp", nombre: "Cera mate fijación fuerte", sede: "plaza-de-la-paz", precio: 28000, stock: 7, stockMinimo: 5, comisionPct: 10 },
  { id: "gel-fijador-pp", nombre: "Gel fijador", sede: "plaza-de-la-paz", precio: 18000, stock: 2, stockMinimo: 6, comisionPct: 10 },
  { id: "bebida-pp", nombre: "Bebida (gaseosa / energizante)", sede: "plaza-de-la-paz", precio: 5000, stock: 33, stockMinimo: 12, comisionPct: 0 },
];

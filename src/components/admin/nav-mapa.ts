import type { ComponentType } from "react";
import {
  BellIcon,
  BookIcon,
  BoxIcon,
  CalendarIcon,
  CashIcon,
  ChartIcon,
  ClockIcon,
  GearIcon,
  HomeIcon,
  PercentIcon,
  ReceiptIcon,
  ScissorsIcon,
  StarIcon,
  TagIcon,
  TicketIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/icons";

/*
  EL MAPA de la navegación del panel (tanda 2, paso 3). De acá salen los 5
  destinos de la barra inferior, el destino activo, la lista plana de Ctrl-K y
  las filas del hub de Ajustes. Antes eran tres estructuras que había que
  acordarse de tocar juntas.

  VIVE APARTE DE AdminNav.tsx a propósito: aquel lleva "use client", y un módulo
  de cliente NO le entrega valores reales a un Server Component, le entrega
  referencias. La pantalla de Ajustes es un server component y al importar el
  mapa desde allá reventaba con "GRUPOS_HUB.map is not a function". Esto es dato
  y funciones puras; allá quedan solo los componentes.

  LAS RUTAS NO CAMBIAN: los enlaces viejos, los marcadores del dueño, los de los
  correos y el push de caja siguen funcionando. Cambia cómo se llega, no a dónde.

  Por qué 5 destinos abajo y no 8 pestañas arriba: medido en el celular, las
  pestañas nunca se ven enteras —en Hoy se lee "Hoy Agenda Métricas Caja
  Clientes Ca…"— y la cabecera come entre 146 y 206 px antes del contenido. Lo
  que se mira todos los días son cinco cosas; lo demás se configura de vez en
  cuando y vive en Ajustes.
*/

export type ClaveDestino = "inicio" | "agenda" | "caja" | "clientes" | "ajustes";
export type TinteHoja = "marca" | "equipo" | "plata" | "local" | "neutro";
type Icono = ComponentType<{ className?: string }>;

export const DESTINOS: readonly {
  clave: ClaveDestino;
  etiqueta: string;
  href: string;
  icono: Icono;
}[] = [
  { clave: "inicio", etiqueta: "Inicio", href: "/admin", icono: HomeIcon },
  // "Agenda" y no "Reservas": es la palabra del equipo, de la guía de uso y de
  // la propia URL. Decisión del dueño, 16-sep.
  { clave: "agenda", etiqueta: "Agenda", href: "/admin/agenda", icono: CalendarIcon },
  { clave: "caja", etiqueta: "Caja", href: "/admin/cuadre", icono: CashIcon },
  { clave: "clientes", etiqueta: "Clientes", href: "/admin/clientes", icono: UsersIcon },
  { clave: "ajustes", etiqueta: "Ajustes", href: "/admin/ajustes", icono: GearIcon },
] as const;

/** Todo lo que dejó de tener pestaña propia y ahora se entra desde Ajustes. */
export const HOJAS: readonly {
  href: string;
  label: string;
  sub: string;
  grupo: string;
  icono: Icono;
  tinte: TinteHoja;
}[] = [
  { href: "/admin/precios", label: "Servicios y precios", sub: "Precios, combos, fotos y duración", grupo: "Catálogo", icono: ScissorsIcon, tinte: "marca" },
  { href: "/admin/inventario", label: "Productos y stock", sub: "Qué hay, qué falta y a cuánto se vende", grupo: "Catálogo", icono: BoxIcon, tinte: "local" },
  { href: "/admin/equipo", label: "Barberos y PINes", sub: "Quién entra al mostrador y con qué clave", grupo: "Equipo", icono: UsersIcon, tinte: "equipo" },
  { href: "/admin/comisiones", label: "Comisiones y contratos", sub: "Cuánto se lleva cada uno", grupo: "Equipo", icono: PercentIcon, tinte: "equipo" },
  { href: "/admin/liquidacion", label: "Liquidación semanal", sub: "Lo que hay que pagarle al equipo", grupo: "Equipo", icono: WalletIcon, tinte: "plata" },
  { href: "/admin/horarios", label: "Horario del negocio", sub: "Horas de atención, feriados y ausencias", grupo: "El local", icono: ClockIcon, tinte: "local" },
  { href: "/admin/metricas", label: "Métricas del negocio", sub: "Ventas, clientes y tendencia", grupo: "Informes", icono: ChartIcon, tinte: "plata" },
  { href: "/admin/reportes", label: "Reporte del mes", sub: "Como el Excel: día por día e inventario", grupo: "Informes", icono: ReceiptIcon, tinte: "plata" },
  { href: "/admin/cupones", label: "Cupones", sub: "Descuentos con código", grupo: "Marketing", icono: TicketIcon, tinte: "marca" },
  { href: "/admin/tarjeta", label: "Tarjeta de cortes", sub: "Cada cuántos cortes va uno gratis", grupo: "Marketing", icono: StarIcon, tinte: "marca" },
  { href: "/admin/avisos", label: "Avisos al cliente", sub: "Recordatorios y «te toca corte»", grupo: "Marketing", icono: BellIcon, tinte: "marca" },
  { href: "/barbero", label: "App del barbero", sub: "El mostrador, como lo ve el equipo", grupo: "Otros", icono: TagIcon, tinte: "neutro" },
  { href: "/admin/ayuda", label: "Cómo se usa", sub: "La guía, por si alguien se pierde", grupo: "Otros", icono: BookIcon, tinte: "neutro" },
] as const;

/** Orden de los grupos en el hub. */
export const GRUPOS_HUB: readonly string[] = ["Catálogo", "Equipo", "El local", "Informes", "Marketing", "Otros"];

// Ctrl-K sigue viendo TODO por su nombre largo: el buscador no tiene por qué
// saber que "Liquidación" ahora cuelga de Ajustes.
export const adminNav: readonly { href: string; label: string }[] = [
  ...DESTINOS.map((d) => ({ href: d.href, label: d.clave === "inicio" ? "Hoy" : d.etiqueta })),
  ...HOJAS.map((h) => ({ href: h.href, label: h.label })),
];

// Rutas → destino, de la más específica a la menos, para que /admin no se coma
// a /admin/agenda. Una ruta desconocida devuelve undefined y la barra no marca
// ninguno: nunca revienta por una pantalla nueva.
const RUTAS: { href: string; destino: ClaveDestino }[] = [
  ...HOJAS.map((h) => ({ href: h.href, destino: "ajustes" as ClaveDestino })),
  ...DESTINOS.map((d) => ({ href: d.href, destino: d.clave })),
]
  .filter((r) => r.href.startsWith("/admin") && r.href !== "/admin")
  .sort((a, b) => b.href.length - a.href.length);

export function destinoDe(path: string): ClaveDestino | undefined {
  if (path === "/admin") return "inicio";
  return RUTAS.find((r) => path.startsWith(r.href))?.destino;
}

// Únicas secciones que leen el ?sede= del selector de la cabecera.
const SECCIONES_CON_SEDE = [
  "/admin",
  "/admin/agenda",
  "/admin/metricas",
  "/admin/reportes",
  "/admin/precios",
  "/admin/clientes",
  "/admin/liquidacion",
  "/admin/inventario",
] as const;

const esRuta = (path: string, href: string) => (href === "/admin" ? path === href : path.startsWith(href));

export function seccionFiltraPorSede(path: string) {
  // La FICHA de un cliente ya es una persona: ahí el selector no filtra nada.
  if (path.startsWith("/admin/clientes/")) return false;
  return SECCIONES_CON_SEDE.some((href) => esRuta(path, href));
}

// La agenda es SIEMPRE de una sede (una columna por barbero de esa sede).
export const seccionExigeSede = (path: string) => esRuta(path, "/admin/agenda");

/** Pantallas hermanas que siguen mereciendo una segunda fila dentro del contenido. */
export const HERMANAS: readonly { hijos: readonly { href: string; label: string }[] }[] = [
  {
    hijos: [
      { href: "/admin/precios", label: "Servicios y precios" },
      { href: "/admin/inventario", label: "Productos y stock" },
    ],
  },
  {
    hijos: [
      { href: "/admin/metricas", label: "Métricas" },
      { href: "/admin/reportes", label: "Reporte del mes" },
    ],
  },
];

export { esRuta };

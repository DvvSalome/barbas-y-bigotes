// Las cuentas de /admin/metricas: de una lista de cobros a baldes por día, semana
// o mes, el acumulado y la comparación con el período anterior. Módulo puro (lo
// prueba scripts/check-metricas.ts): queries.ts solo lee filas y se las pasa.
//
// Importa slots con extensión .ts a propósito: así node lo corre sin bundler en
// el chequeo (tsconfig tiene allowImportingTsExtensions).
import { bogotaYmd, semanaDeFecha } from "./slots.ts";

/** Un cobro, ya reducido a lo que importa acá. `ms` = Date.parse(creado_en). */
export type Cobro = { ms: number; total: number };

/**
 * Un tramo del eje del tiempo: un día, una semana (lunes a domingo) o un mes.
 * `parcial` = el tramo no está completo: le faltan días (el rango arranca o
 * termina a mitad de semana o de mes) o incluye el día de hoy, que sigue abierto.
 * Un tramo parcial se ve bajito sin que el negocio haya vendido menos.
 */
export type Balde = {
  desdeYmd: string;
  hastaYmd: string;
  total: number;
  cobros: number;
  /** En cuántos de sus días hubo al menos un cobro (0 o 1 en un balde diario). */
  diasConCobros: number;
  parcial: boolean;
};
export type Grano = "dia" | "semana" | "mes";

const DIA = 86_400_000;
// Colombia va fija en UTC-5, sin horario de verano (slots.ts lo da por hecho en
// instanteBogota): el día civil de un instante sale restando cinco horas. Es lo
// mismo que bogotaYmd() pero sin armar un Intl por cada cobro (un año son miles).
const ymdDeMs = (ms: number) => new Date(ms - 5 * 3_600_000).toISOString().slice(0, 10);
const masDias = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T12:00:00Z`) + n * DIA).toISOString().slice(0, 10);
const diasDelMes = (ym: string) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();

/** Cada día civil de Bogotá de [desde, hasta], los dos inclusive. */
export function diasDelRango(desde: Date, hasta: Date): string[] {
  const dias: string[] = [];
  const fin = bogotaYmd(hasta);
  // El tope es un seguro contra un rango al revés o disparatado, no una regla.
  for (let ymd = bogotaYmd(desde); ymd <= fin && dias.length < 800; ymd = masDias(ymd, 1)) dias.push(ymd);
  return dias;
}

/**
 * Un balde por cada día de `dias`, también los que no tuvieron cobros (un cero
 * de verdad, no un hueco). Lo que caiga fuera de esos días no cuenta. `hoyYmd`
 * marca el día que todavía no cierra.
 */
export function porDia(cobros: Cobro[], dias: string[], hoyYmd?: string): Balde[] {
  const lugar = new Map(dias.map((d, i) => [d, i]));
  const baldes: Balde[] = dias.map((d) => ({ desdeYmd: d, hastaYmd: d, total: 0, cobros: 0, diasConCobros: 0, parcial: d === hoyYmd }));
  for (const c of cobros) {
    const i = lugar.get(ymdDeMs(c.ms));
    if (i === undefined) continue;
    baldes[i].total += c.total;
    baldes[i].cobros += 1;
    baldes[i].diasConCobros = 1;
  }
  return baldes;
}

/**
 * Junta baldes DIARIOS y consecutivos en semanas de calendario (lunes a domingo,
 * como la liquidación) o en meses. Antes la pantalla cortaba de a 7 días desde
 * donde arrancara el rango: "semanas" que empezaban un jueves.
 */
export function agrupar(dias: Balde[], grano: Grano): Balde[] {
  if (grano === "dia") return dias;
  const llave = (ymd: string) => (grano === "mes" ? ymd.slice(0, 7) : semanaDeFecha(ymd).desdeYmd);
  const grupos: { llave: string; n: number; balde: Balde }[] = [];
  for (const d of dias) {
    const k = llave(d.desdeYmd);
    const g = grupos.at(-1);
    if (g?.llave === k) {
      g.n += 1;
      g.balde.hastaYmd = d.hastaYmd;
      g.balde.total += d.total;
      g.balde.cobros += d.cobros;
      g.balde.diasConCobros += d.diasConCobros;
      g.balde.parcial ||= d.parcial;
    } else grupos.push({ llave: k, n: 1, balde: { ...d } });
  }
  return grupos.map((g) => ({ ...g.balde, parcial: g.balde.parcial || g.n < (grano === "mes" ? diasDelMes(g.llave) : 7) }));
}

/** Suma corrida: [3, 0, 2] → [3, 3, 5]. */
export function acumular(valores: number[]): number[] {
  let suma = 0;
  return valores.map((v) => (suma += v));
}

/**
 * Cuánto cambió contra el período anterior, en % redondeado. null cuando no hay
 * contra qué comparar: sin base no hay porcentaje que valga (de $0 a $50.000 no
 * es "infinito por ciento", es que antes no se registraba).
 */
export function variacion(hoy: number, antes: number): number | null {
  return antes > 0 ? Math.round(((hoy - antes) / antes) * 100) : null;
}

/**
 * Las marcas del eje de plata: de 0 hasta un tope redondo que cubre `max`, en 2
 * a 4 pasos iguales (0 · 400.000 · 800.000 · 1.200.000). Un eje con marcas tipo
 * 335.667 no lo lee nadie.
 */
export function ejeRedondo(max: number): number[] {
  if (!(max > 0)) return [0];
  const crudo = max / 3;
  const potencia = 10 ** Math.floor(Math.log10(crudo));
  // Pesos enteros: el paso se redondea hacia arriba (2,5 → 3) y nunca baja de $ 1.
  const paso = Math.max(1, Math.ceil(([1, 2, 2.5, 4, 5, 10].find((m) => m * potencia >= crudo) ?? 10) * potencia));
  return Array.from({ length: Math.ceil(max / paso) + 1 }, (_, i) => i * paso);
}

/**
 * ¿Hay con qué decir "vas mejor" o "vas peor"? Solo si en CADA lado (este período
 * y el anterior) hubo cobros en suficientes días: 7, o la mitad del período si es
 * más corto. Con cobros en 5 días de 30 un porcentaje es ruido con cara de
 * tendencia, y el dueño decide con él. El día 3 de un mes movido sí compara
 * (2 de 3 días); septiembre con 4 días de 30, no.
 */
export function hayParaComparar(diasConCobros: number, diasConCobrosAntes: number, dias: number): boolean {
  const minimo = Math.min(7, Math.ceil(dias / 2));
  return dias > 0 && diasConCobros >= minimo && diasConCobrosAntes >= minimo;
}

/**
 * Plata corta para las marcas de un eje: "1,2 M", "400 mil", "900". Sin "$": el
 * título de la gráfica ya dice que es plata y el canal del eje es angosto. La
 * cifra exacta va siempre con cop().
 */
export function plataCorta(n: number): string {
  const corto = (v: number) => (Math.round(v * 10) / 10).toString().replace(".", ",");
  if (n >= 1_000_000) return `${corto(n / 1_000_000)} M`;
  if (n >= 1_000) return `${corto(n / 1_000)} mil`;
  return String(n);
}

/**
 * El ritmo del mes: lo acumulado día a día este mes (hasta hoy) y el mes pasado
 * (completo), a partir de baldes DIARIOS que cubran los dos meses. Posición 0 =
 * día 1. Con eso se ve si a esta altura del mes se va por delante o por detrás.
 */
export function ritmoDelMes(dias: Balde[], hoyYmd: string): { mes: string; mesAntes: string; actual: number[]; antes: number[] } {
  const mes = hoyYmd.slice(0, 7);
  const mesAntes = masDias(`${mes}-01`, -1).slice(0, 7);
  const de = (ym: string) => dias.filter((d) => d.desdeYmd.startsWith(ym) && d.desdeYmd <= hoyYmd).map((d) => d.total);
  return { mes, mesAntes, actual: acumular(de(mes)), antes: acumular(de(mesAntes)) };
}

/**
 * El trazo SVG de un acumulado, en ESCALERA (solo tramos horizontales y
 * verticales): la plata entra el día que se cobra y el día sin cobros queda
 * plano. Una diagonal entre dos días insinuaría que "iba subiendo".
 *
 * Para un viewBox "0 0 n 100": cada día ocupa una unidad de ancho y el valor se
 * lee en el CENTRO de su día (x = i + 0,5), que es donde cae la guía al tocar.
 * `completo` estira el último tramo hasta el borde derecho de su día (un mes ya
 * cerrado); sin eso termina en el centro (hoy, que sigue abierto).
 */
export function escalera(acumulado: number[], tope: number, completo = false, cierre?: number): string {
  if (!acumulado.length) return "";
  const y = (v: number) => (tope > 0 ? Math.round((100 - (v / tope) * 100) * 100) / 100 : 100);
  let d = `M0,${y(acumulado[0])}H0.5`;
  for (let i = 1; i < acumulado.length; i++) d += `H${i}V${y(acumulado[i])}H${i + 0.5}`;
  if (!completo) return d;
  d += `H${acumulado.length}`;
  // `cierre`: en cuánto cerró de verdad, cuando el último valor dibujado es un
  // corte parcial (el mes pasado "a esta misma hora" el último día del mes).
  return cierre !== undefined && cierre !== acumulado.at(-1) ? `${d}V${y(cierre)}` : d;
}

import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { getHistorico, getMediosTodos, getMetricas, getSedes, type Periodo } from "@/lib/data/queries";
import type { SedeId } from "@/lib/data/types";
import { cop, horaBogota } from "@/lib/format";
import { agrupar, ejeRedondo, escalera, hayParaComparar, plataCorta, variacion, type Balde, type Grano } from "@/lib/metricas";
import { nombreMes } from "@/lib/reporte";
import { DOW, MON, bogotaYmd, dowDeFecha, semanaDeFecha } from "@/lib/slots";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { RankingMetrica } from "@/components/admin/RankingMetrica";
import { LecturaGrafica } from "@/components/admin/LecturaGrafica";
import { PeriodoChips } from "@/components/admin/PeriodoChips";
import { Desglose } from "@/components/admin/Desglose";
import { CaraBarbero } from "@/components/staff/Elegir";
import { Plegable } from "@/components/ui/Plegable";
import { chipFiltroClases } from "@/components/ui/Chip";
import { ArrowRightIcon, ChevronRightIcon, DownloadIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Métricas · Admin" };

// Record<Periodo,…>: agregar un período sin etiqueta rompe el build, no la pantalla.
const ETIQUETAS: Record<Periodo, string> = {
  "7d": "Semana",
  mes: "Este mes",
  "30d": "30 días",
  "90d": "90 días",
  "365d": "Año",
};
const PERIODOS = (Object.keys(ETIQUETAS) as Periodo[]).map((id) => ({ id, label: ETIQUETAS[id] }));
// De qué tamaño es cada columna: 90 barras diarias en un celular eran un hilo.
const GRANO: Record<Periodo, Grano> = { "7d": "dia", mes: "dia", "30d": "dia", "90d": "semana", "365d": "mes" };
// Cómo se nombran el período y el anterior DENTRO de una frase.
const ESTOS: Record<Periodo, string> = {
  "7d": "los últimos 7 días",
  mes: "este mes",
  "30d": "los últimos 30 días",
  "90d": "los últimos 90 días",
  "365d": "el último año",
};
const ANTERIORES: Record<Periodo, string> = {
  "7d": "los 7 días anteriores",
  mes: "el mes pasado",
  "30d": "los 30 días anteriores",
  "90d": "los 90 días anteriores",
  "365d": "el año anterior",
};

const PANEL = "rounded-2xl border border-line bg-panel p-5";

// "2026-08-01" → "1 ago": acá se lee día-primero; "08-01" se entendía 8 de enero.
const diaMes = (ymd: string) => `${Number(ymd.slice(8))} ${MON[Number(ymd.slice(5, 7)) - 1]}`;
const diaSemana = (ymd: string) => `${DOW[dowDeFecha(ymd)].toLowerCase()} ${diaMes(ymd)}`;
/** "2026-09-…" → "septiembre" */
const mesDe = (ymd: string) => nombreMes(ymd.slice(0, 7)).split(" ")[0];
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const miles = (n: number) => n.toLocaleString("es-CO");
const cuantos = (n: number, uno: string, varios: string) => `${miles(n)} ${n === 1 ? uno : varios}`;
const diasEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1;

type Lectura = { fuerte: string; resto: string };
type Rotulo = { i: number; texto: string; hoy?: boolean };

/** Cómo se llama un tramo cuando se lee: "sáb 3 oct", "semana del 5 al 11 oct", "septiembre 2026". */
function nombreTramo(b: Balde, grano: Grano): string {
  if (grano === "mes") return nombreMes(b.desdeYmd.slice(0, 7));
  if (grano === "dia") return diaSemana(b.desdeYmd);
  // Por su semana de calendario (lunes a domingo) aunque el rango la corte:
  // "semana del 12 al 12 jul" no decía nada. Lo que falta lo dice la lectura.
  const s = semanaDeFecha(b.desdeYmd);
  const mismoMes = s.desdeYmd.slice(0, 7) === s.hastaYmd.slice(0, 7);
  return `semana del ${mismoMes ? Number(s.desdeYmd.slice(8)) : diaMes(s.desdeYmd)} al ${diaMes(s.hastaYmd)}`;
}

/**
 * Qué le falta a un tramo para estar completo ("" si no le falta nada). Lo dicen
 * la lectura al tocar Y la tabla: una semana de un solo día con el nombre de la
 * semana entera y sin aviso se lee como "se vendió poquísimo".
 */
function loQueFalta(b: Balde, i: number, hoyIdx: number, grano: Grano): string {
  if (i === hoyIdx) return grano === "dia" ? "va hasta ahora" : "va hasta hoy";
  if (!b.parcial) return "";
  // Dos formas de estar a medias: faltan días, o falta un pedazo del primer día
  // (las ventanas móviles arrancan a esta misma hora de hace N días).
  const dias = diasEntre(b.desdeYmd, b.hastaYmd);
  const desdeEl = Number(b.desdeYmd.slice(8));
  if (grano === "semana") return dias < 7 ? `incompleta, ${dias} de 7 días` : "el primer día no entra completo";
  if (grano === "mes") return desdeEl > 1 ? `desde el ${desdeEl}` : "el primer día no entra completo";
  return "ese día no entra completo";
}

/** La frase que se lee al tocar un tramo. Va armada desde el servidor: la isla solo la muestra. */
function lecturaTramo(b: Balde, i: number, hoyIdx: number, grano: Grano, esPico: boolean): Lectura {
  const nombre = nombreTramo(b, grano);
  if (i > hoyIdx) return { fuerte: "Todavía no llega", resto: nombre };
  const partes = [i === hoyIdx && grano === "dia" ? `hoy, ${nombre}` : nombre];
  if (!b.cobros) partes.push("sin cobros");
  else if (grano === "dia") partes.push(cuantos(b.cobros, "cobro", "cobros"));
  else partes.push(`${cuantos(b.cobros, "cobro", "cobros")} en ${cuantos(b.diasConCobros, "día", "días")}`);
  // Un tramo a medias se dice: si no, se lee como "se vendió menos".
  const falta = loQueFalta(b, i, hoyIdx, grano);
  if (falta) partes.push(falta);
  if (esPico) partes.push(grano === "dia" ? "el día más fuerte" : grano === "semana" ? "la semana más fuerte" : "el mes más fuerte");
  return { fuerte: cop(b.total), resto: partes.join(" · ") };
}

/** Pocas fechas, repartidas, y la del tramo de hoy siempre (un vecino que la pise, se va). */
function rotulosDe(baldes: Balde[], hoyIdx: number, grano: Grano): Rotulo[] {
  const n = baldes.length;
  const elegidos = new Set<number>();
  if (grano === "mes") {
    // Los meses, de dos en dos contando desde el actual: quedan parejos y el de hoy nunca falta.
    for (let i = hoyIdx; i >= 0; i -= n > 6 ? 2 : 1) elegidos.add(i);
  } else {
    const tope = Math.min(n, 4);
    for (let k = 0; k < tope; k++) elegidos.add(Math.round((k * (n - 1)) / Math.max(tope - 1, 1)));
    // "esta semana" es un rótulo largo: necesita más aire que "hoy".
    const aire = grano === "semana" ? n * 0.4 : n / 6;
    for (const i of elegidos) if (i !== hoyIdx && Math.abs(i - hoyIdx) < aire) elegidos.delete(i);
    elegidos.add(hoyIdx);
  }
  let mesVisto = "";
  return [...elegidos]
    .sort((a, b) => a - b)
    .map((i) => {
      const ymd = baldes[i].desdeYmd;
      // El mes se escribe una vez: "1 oct · 8 · 15", no "1 oct · 8 oct · 15 oct".
      const repetido = grano !== "mes" && ymd.slice(0, 7) === mesVisto;
      // El rótulo "hoy" / "esta semana" no escribe el mes: no lo da por visto, o
      // los primeros días del mes el eje quedaba "hoy · 11 · 21 · 31", sin mes.
      if (grano === "mes" || i !== hoyIdx) mesVisto = ymd.slice(0, 7);
      const fecha = grano === "mes" ? MON[Number(ymd.slice(5, 7)) - 1] : repetido ? String(Number(ymd.slice(8))) : diaMes(ymd);
      const hoy = i === hoyIdx;
      // El mes en curso se rotula con su nombre (en tinta, como "hoy"): "este mes" pisaba al vecino.
      return { i, hoy, texto: hoy && grano === "dia" ? "hoy" : hoy && grano === "semana" ? "esta semana" : fecha };
    });
}

/** La rejilla con sus marcas redondas en el canal de la izquierda. */
function Rejilla({ marcas }: { marcas: number[] }) {
  const tope = marcas.at(-1) || 1;
  return marcas.slice(1).map((v) => (
    <div key={v} className="bb-marca" style={{ bottom: `${(v / tope) * 100}%` }}>
      <span>{plataCorta(v)}</span>
    </div>
  ));
}

function EjeX({ n, rotulos }: { n: number; rotulos: Rotulo[] }) {
  return (
    <div className="bb-eje-x" aria-hidden>
      {rotulos.map((r) => {
        const borde = r.i === 0 ? "izq" : r.i === n - 1 ? "der" : undefined;
        const left = borde === "izq" ? 0 : borde === "der" ? 100 : ((r.i + 0.5) / n) * 100;
        return (
          <span key={r.i} data-borde={borde} data-hoy={r.hoy || undefined} style={{ left: `${left}%` }}>
            {r.texto}
          </span>
        );
      })}
    </div>
  );
}

/** La tabla gemela de cada gráfica: el mismo dato sin depender de tocar ni de ver colores. */
function Tabla({ cabecera, filas, abierta = false }: { cabecera: string[]; filas: string[][]; abierta?: boolean }) {
  return (
    <details open={abierta} className="group mt-2">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold text-muted transition hover:text-ink [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
        Ver en tabla
      </summary>
      <table className="w-full text-[13px] tabular-nums">
        <thead>
          <tr className="border-b border-line text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
            {cabecera.map((c, k) => (
              <th key={c} className={`py-2 font-semibold ${k ? "pl-3 text-right" : ""}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {filas.map((f) => (
            <tr key={f[0]}>
              {f.map((celda, k) => (
                <td key={k} className={`py-2 ${k ? "bb-monto pl-3 text-right text-ink" : "text-muted"}`}>
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/**
 * Columnas: un tramo por casilla. El dato va en neutro y el rojo queda para el
 * tramo que sigue abierto (hoy, esta semana, este mes). Los tramos después de
 * `hoyIdx` son días que todavía no llegan: casilla vacía, sin cero.
 */
function Columnas({
  baldes,
  hoyIdx,
  grano,
  etiqueta,
  alVer,
}: {
  baldes: Balde[];
  hoyIdx: number;
  grano: Grano;
  etiqueta: string;
  alVer?: boolean;
}) {
  const n = baldes.length;
  const max = Math.max(...baldes.map((b) => b.total), 0);
  const marcas = ejeRedondo(max);
  const tope = marcas.at(-1) || 1;
  const pico = max > 0 ? baldes.findIndex((b) => b.total === max) : -1;
  // "El más fuerte" solo se dice si hay con qué compararlo.
  const hayPico = pico >= 0 && baldes.filter((b) => b.cobros > 0).length > 1;
  const lecturas = baldes.map((b, i) => lecturaTramo(b, i, hoyIdx, grano, hayPico && i === pico));
  const lado = pico / n < 0.15 ? "izq" : (pico + 1) / n > 0.85 ? "der" : undefined;
  const xPico = lado === "izq" ? pico / n : lado === "der" ? (pico + 1) / n : (pico + 0.5) / n;

  return (
    <>
      <LecturaGrafica lecturas={lecturas} inicial={pico >= 0 ? pico : hoyIdx} etiqueta={etiqueta} alVer={alVer}>
        <div className="bb-plot">
          <Rejilla marcas={marcas} />
          <div className="bb-cols">
            {baldes.map((b, i) => (
              <div key={b.desdeYmd} className="bb-cupo">
                {b.total > 0 && (
                  <div
                    className="bb-col"
                    data-ahora={i === hoyIdx || undefined}
                    data-hueca={(b.parcial && i !== hoyIdx) || undefined}
                    style={{ "--v": b.total / tope, "--i": i } as CSSProperties}
                  />
                )}
              </div>
            ))}
          </div>
          {pico >= 0 && (
            <span
              className="bb-pico bb-monto"
              data-lado={lado}
              style={{ left: `${xPico * 100}%`, bottom: `calc(${(max / tope) * 100}% + 6px)` }}
              aria-hidden
            >
              {cop(max)}
            </span>
          )}
        </div>
        <EjeX n={n} rotulos={rotulosDe(baldes, hoyIdx, grano)} />
      </LecturaGrafica>
      <Tabla
        cabecera={[grano === "dia" ? "Día" : grano === "semana" ? "Semana" : "Mes", "Entró", "Cobros"]}
        filas={baldes.slice(0, hoyIdx + 1).map((b, i) => {
          const falta = loQueFalta(b, i, hoyIdx, grano);
          return [mayuscula(nombreTramo(b, grano)) + (falta ? ` (${falta})` : ""), cop(b.total), miles(b.cobros)];
        })}
      />
    </>
  );
}

export default async function MetricasPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const sedeParam = typeof sp.sede === "string" ? sp.sede : undefined;
  // Se valida contra las sedes reales en vez de un mapa hardcodeado: si mañana
  // abren una tercera, esta pantalla la toma sola.
  const sedes = await getSedes();
  const sede = (sedes.find((s) => s.id === sedeParam)?.id as SedeId | undefined) ?? null;
  const nombreSede = sedes.find((s) => s.id === sede)?.nombre;
  const enSede = nombreSede ? ` en ${nombreSede}` : "";
  const p = (typeof sp.p === "string" && PERIODOS.some((x) => x.id === sp.p) ? sp.p : "mes") as Periodo;

  // El histórico tiene rango propio (12 meses): no depende del período, pero sí de la sede.
  const [m, h, medios] = await Promise.all([getMetricas(p, sede), getHistorico(sede), getMediosTodos()]);
  // El medio se guarda como slug ("nequi"); se lee con el nombre del mostrador
  // ("Nequi"). Uno que ya no exista cae con mayúscula inicial.
  const nombreMedio = (slug: string) => medios.find((x) => x.slug === slug)?.nombre ?? (slug ? mayuscula(slug) : "Sin medio");
  const qs = (periodo: Periodo) => `?p=${periodo}${sede ? `&sede=${sede}` : ""}`;
  // En Bogotá, no en la hora del servidor: a las 20:00 de acá en Vercel ya es otro día.
  const hoyYmd = bogotaYmd();
  const mesYmd = `${hoyYmd.slice(0, 8)}01`;
  const esMes = p === "mes";
  const grano = GRANO[p];

  // ── Las columnas del período ──────────────────────────────────────────────
  // En las ventanas móviles el primer día entra a medias (arrancan a esta misma
  // hora de hace N días): se marca para que no se lea como un día flojo.
  const diario = m.serie.map((b, i) => (i === 0 && !esMes ? { ...b, parcial: true } : b));
  // Las semanas y los meses de ANTES del primer cobro no son "$ 0 · sin cobros":
  // es que todavía no había registro. Se quitan, y el tramo donde arranca queda
  // marcado a medias con su día real ("desde el 18").
  const desdePrimerCobro = (baldes: Balde[]) => {
    const primero = h.primerCobroYmd;
    if (!primero) return baldes;
    return baldes
      .filter((b) => b.hastaYmd >= primero)
      .map((b, i) => (i === 0 && primero > b.desdeYmd ? { ...b, desdeYmd: primero, parcial: true } : b));
  };
  const todos = agrupar(diario, grano);
  const tramos = grano === "dia" ? todos : desdePrimerCobro(todos);
  const hoyIdx = tramos.length - 1;
  // "Este mes" muestra el mes entero: los días que faltan son casillas vacías, y
  // con eso se ve de un vistazo que el mes va a medias.
  const diasDelMes = new Date(Date.UTC(Number(hoyYmd.slice(0, 4)), Number(hoyYmd.slice(5, 7)), 0)).getUTCDate();
  const porVenir: Balde[] = esMes
    ? Array.from({ length: diasDelMes - tramos.length }, (_, k) => {
        const ymd = `${hoyYmd.slice(0, 8)}${String(tramos.length + k + 1).padStart(2, "0")}`;
        return { desdeYmd: ymd, hastaYmd: ymd, total: 0, cobros: 0, diasConCobros: 0, parcial: false };
      })
    : [];

  // ── ¿Se puede decir "vas mejor" o "vas peor"? ─────────────────────────────
  const anteriorIncompleto = !!h.primerCobroYmd && h.primerCobroYmd > m.antes.desdeYmd;
  const comparable = hayParaComparar(m.diasConCobros, m.antes.diasConCobros, m.dias) && !anteriorIncompleto;
  const dif = m.plata - m.antes.plata;
  const pct = variacion(m.plata, m.antes.plata);
  const mesPasado = mesDe(m.antes.desdeYmd);
  // Los días 29 a 31 contra un mes más corto ya no hay "misma fecha" del otro
  // lado: se compara contra el mes pasado ENTERO, y se dice.
  const diasAntes = Number(m.antes.hastaYmd.slice(8));
  const mesEntero = esMes && m.dias > diasAntes;
  const elAnterior = !esMes ? ANTERIORES[p] : mesEntero ? `todo ${mesPasado}` : `${mesPasado} a esta fecha`;
  // ¿Este período, por sí solo, tiene días suficientes? (el mismo umbral de la comparación)
  const esteAlcanza = hayParaComparar(m.diasConCobros, m.diasConCobros, m.dias);
  const arranca = m.serie[0]?.desdeYmd ?? hoyYmd;
  // Con el año cuando el rango cruza de uno a otro: "10 oct al 10 oct" no decía nada.
  const conAnio = (ymd: string) => (arranca.slice(0, 4) === hoyYmd.slice(0, 4) ? diaMes(ymd) : `${diaMes(ymd)} ${ymd.slice(0, 4)}`);
  const corte = esMes
    ? `${mesDe(hoyYmd)}, ${m.dias === 1 ? "día 1" : `del 1 al ${m.dias}`}`
    : `${ESTOS[p]}, ${conAnio(arranca)} al ${conAnio(hoyYmd)}`;

  let frase: ReactNode;
  let apoyo: string | null = null;
  if (m.servicios === 0) {
    frase = esMes
      ? `En ${mesDe(hoyYmd)} todavía no hay cobros registrados${enSede}.`
      : `En ${ESTOS[p]} no hay cobros registrados${enSede}.`;
    if (m.antes.plata > 0) apoyo = esMes ? `${mayuscula(elAnterior)}: ${cop(m.antes.plata)}.` : `En ${ANTERIORES[p]}: ${cop(m.antes.plata)}.`;
  } else if (comparable && pct !== null) {
    const contra = !esMes ? ANTERIORES[p] : mesEntero ? `todo ${mesPasado} (${diasAntes} días)` : `${mesPasado} a esta misma fecha`;
    if (dif === 0) frase = esMes ? `Vas igual que ${contra}.` : `Entró lo mismo que en ${contra}.`;
    else {
      const sube = dif > 0;
      // El color va solo en la flecha y el monto (con su palabra al lado): la
      // baja en el token de alerta, no en el rojo de marca.
      frase = (
        <>
          <span className={`font-semibold ${sube ? "text-ok" : "text-warn"}`}>
            {sube ? "▲" : "▼"} {esMes ? "Vas" : "Entraron"} <span className="bb-monto">{cop(Math.abs(dif))}</span>
          </span>{" "}
          {/* Una diferencia chica redondea a 0: "+0 %" al lado de "$ 4.000 por delante" se contradecía. */}
          {esMes ? (sube ? "por delante de" : "por detrás de") : sube ? "más que en" : "menos que en"} {contra} (
          {pct === 0 ? "menos de 1 %" : `${sube ? "+" : "−"}${Math.abs(pct)} %`}).
        </>
      );
    }
    apoyo = esMes ? `${mayuscula(elAnterior)}: ${cop(m.antes.plata)}.` : `Antes: ${cop(m.antes.plata)}.`;
  } else if (m.antes.plata === 0) {
    frase = `En ${elAnterior} no hay cobros registrados: no hay con qué comparar.`;
  } else if (anteriorIncompleto) {
    frase = `La app registra cobros${enSede} desde el ${diaMes(h.primerCobroYmd!)} ${h.primerCobroYmd!.slice(0, 4)}: el período anterior no está completo y no se compara.`;
  } else if (esteAlcanza) {
    // Este período va bien de días: el flaco es el anterior, y eso es lo que se dice.
    frase = `En ${elAnterior} solo hay cobros en ${cuantos(m.antes.diasConCobros, "día", "días")} (${cop(m.antes.plata)}): no alcanza para decir si vas mejor o peor.`;
  } else {
    // Fuera de "Este mes" se nombra el período: una ventana de 7×24 h pisa 8 días
    // civiles, y "1 de estos 8 días" bajo "los últimos 7 días" se contradecía.
    frase = `${esMes ? `Hay cobros en ${m.diasConCobros} de estos ${cuantos(m.dias, "día", "días")}` : `En ${ESTOS[p]} hay cobros en ${cuantos(m.diasConCobros, "día", "días")}`}. Con tan pocos días todavía no se puede decir si vas mejor o peor.`;
    apoyo = `En ${elAnterior} se registraron ${cop(m.antes.plata)}.`;
  }

  // ── Histórico ─────────────────────────────────────────────────────────────
  const { ritmo } = h;
  const nRitmo = Math.max(ritmo.antes.length, diasDelMes);
  const hoyDia = ritmo.actual.length - 1;
  const vaEn = ritmo.actual.at(-1) ?? 0;
  const cerroEn = ritmo.antes.at(-1) ?? 0;
  const marcasRitmo = ejeRedondo(Math.max(vaEn, cerroEn));
  const topeRitmo = marcasRitmo.at(-1) || 1;
  const esteMes = mesDe(`${ritmo.mes}-01`);
  const elPasado = mesDe(`${ritmo.mesAntes}-01`);
  const lecturasRitmo: Lectura[] = Array.from({ length: nRitmo }, (_, i) => {
    const antes = ritmo.antes[i];
    const delPasado = antes === undefined ? `${elPasado} no tiene día ${i + 1}` : `${elPasado} ${cop(antes)}`;
    // Un mes de 30 después de uno de 31: la casilla 31 no es "todavía no llega".
    if (i >= diasDelMes) return { fuerte: "No existe", resto: `${esteMes} no tiene día ${i + 1} · ${delPasado}` };
    if (i > hoyDia) return { fuerte: "Todavía no llega", resto: `día ${i + 1} · ${delPasado}` };
    if (i === hoyDia) {
      const elOtro = antes === undefined ? `${elPasado} cerró en ${cop(cerroEn)}` : `${elPasado} a esta hora iba en ${cop(h.antesAhora)}`;
      return { fuerte: cop(vaEn), resto: `hoy, día ${i + 1} · ${elOtro}` };
    }
    return { fuerte: cop(ritmo.actual[i]), resto: `al cierre del día ${i + 1} · ${delPasado}` };
  });
  const rotulosRitmo: Rotulo[] = [0, 9, 19, nRitmo - 1]
    .filter((i) => Math.abs(i - hoyDia) > 3)
    .map((i) => ({ i, texto: String(i + 1) }))
    .concat({ i: hoyDia, texto: "hoy", hoy: true } as Rotulo)
    .sort((a, b) => a.i - b.i);

  // Desde el mes del primer cobro: los de antes no son "$ 0", son "no había registro".
  const meses = desdePrimerCobro(h.meses);
  const arranqueReciente = !!h.primerCobroYmd && h.primerCobroYmd > (h.meses[0]?.desdeYmd ?? "");

  const filasSede = sedes
    .map((s) => ({ s, d: m.porSede.find((x) => x.sede === s.id) }))
    .map(({ s, d }) => ({
      nombre: s.nombre,
      valor: cop(d?.total ?? 0),
      sub: `${cuantos(d?.cobros ?? 0, "cobro", "cobros")} · ${m.plata ? Math.round(((d?.total ?? 0) / m.plata) * 100) : 0} % de lo que entró`,
      peso: d?.total ?? 0,
    }));
  const conSedes = !sede && sedes.length > 1;

  // ── El desglose de los tres números de la tarjeta ─────────────────────────
  const SUB = "eyebrow";
  const sedeCorta = (id: string) => sedes.find((s) => s.id === id)?.nombre.split(" ")[0] ?? "";
  const panelCobros = (
    <>
      <h4 className={SUB}>Cómo pagaron</h4>
      <div className="mt-2 max-w-xl">
        <RankingMetrica
          plano
          filas={m.porMedio.map((x) => ({
            nombre: nombreMedio(x.medio),
            valor: cop(x.total),
            sub: `${cuantos(x.cobros, "cobro", "cobros")} · ${m.plata ? Math.round((x.total / m.plata) * 100) : 0} % de lo que entró`,
            peso: x.total,
          }))}
        />
      </div>
      <h4 className={`${SUB} mt-5`}>{m.servicios > m.cobros.length ? `Los últimos ${m.cobros.length} cobros` : "Cobro por cobro"}</h4>
      <ul className="mt-1 divide-y divide-line">
        {m.cobros.map((c, i) => (
          <li key={c.id} className="bb-fila flex items-start gap-3 py-2.5" style={{ "--i": i } as CSSProperties}>
            <CaraBarbero b={{ id: c.barbero ?? "local", nombre: c.barbero ?? "El local", fotoUrl: c.fotoUrl }} size={28} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-1.5 text-[13.5px] font-semibold leading-snug text-ink">
                {c.barbero ?? "El local"}
                <ArrowRightIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
                {/* Sin cliente asociado se dice, en apagado: no es un nombre. */}
                <span className={c.cliente ? "" : "font-normal text-muted"}>{c.cliente ?? "cliente sin ficha"}</span>
              </div>
              <div className="text-[12px] leading-snug text-muted">
                {diaSemana(bogotaYmd(new Date(c.cuando)))} · {horaBogota(c.cuando)}
                {conSedes ? ` · ${sedeCorta(c.sede)}` : ""}
                {c.que ? ` · ${c.que}` : ""}
              </div>
            </div>
            {/* Tope de ancho: un cobro partido en dos medios se llevaba todo el renglón
                en el celular y dejaba el nombre en una columna de una palabra. */}
            <div className="max-w-[46%] shrink-0 text-right">
              <div className="bb-monto text-[13.5px] font-bold tabular-nums text-ink">{cop(c.total)}</div>
              {c.partes.length > 1 ? (
                c.partes.map((x) => (
                  <div key={x.medio} className="bb-monto text-[12px] leading-snug text-muted">
                    {nombreMedio(x.medio)} {cop(x.monto)}
                  </div>
                ))
              ) : (
                <div className="text-[12px] leading-snug text-muted">{nombreMedio(c.partes[0]?.medio ?? "")}</div>
              )}
              {c.propina > 0 && <div className="bb-monto text-[12px] leading-snug text-muted">propina {cop(c.propina)}</div>}
            </div>
          </li>
        ))}
      </ul>
      {m.servicios > m.cobros.length && (
        <p className="mt-3 text-[12.5px] text-muted">
          Son los {m.cobros.length} más recientes de {miles(m.servicios)}.{" "}
          <a href={`/admin/metricas/xlsx${qs(p)}`} className="font-semibold text-ink underline underline-offset-4">
            Bajar todos en Excel
          </a>
        </p>
      )}
    </>
  );
  const panelTicket = (
    <>
      <h4 className={SUB}>Lo que cobra cada barbero por cliente</h4>
      <div className="mt-2 max-w-xl">
        <RankingMetrica
          plano
          filas={m.porBarbero
            .filter((b) => b.cortes > 0)
            .map((b) => ({
              nombre: b.nombre,
              fotoUrl: b.fotoUrl,
              valor: cop(Math.round(b.plata / b.cortes)),
              sub: `${cuantos(b.cortes, "cobro", "cobros")} · ${cop(b.plata)} en total`,
              peso: b.plata / b.cortes,
            }))
            .sort((a, b) => b.peso - a.peso)}
        />
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
        Es lo que entró dividido entre los cobros. Sube con servicios más caros o cuando el cliente lleva un producto en el mismo cobro.
      </p>
    </>
  );
  const conPropina = m.porBarbero.filter((b) => b.propina > 0).sort((a, b) => b.propina - a.propina);
  const panelPropinas =
    m.propinas > 0 ? (
      <>
        <h4 className={SUB}>De quién fueron</h4>
        <div className="mt-2 max-w-xl">
          <RankingMetrica
            plano
            filas={conPropina.map((b) => ({
              nombre: b.nombre,
              fotoUrl: b.fotoUrl,
              valor: cop(b.propina),
              sub: b.cortes === 1 ? "en su único cobro" : `en ${b.conPropina} de sus ${miles(b.cortes)} cobros`,
              peso: b.propina,
            }))}
          />
        </div>
        <h4 className={`${SUB} mt-5`}>Por dónde entraron</h4>
        <p className="mt-2 flex flex-wrap gap-2">
          {m.propinasPorMedio.map((x) => (
            <span key={x.medio} className="rounded-full border border-line px-3 py-1 text-[12.5px] text-muted">
              <b className="bb-monto font-semibold text-ink">{cop(x.total)}</b> {nombreMedio(x.medio).toLowerCase()}
            </span>
          ))}
        </p>
      </>
    ) : (
      <p className="text-[13px] text-muted">En este período no se registraron propinas.</p>
    );
  const nuevos = m.clientes.total - m.clientes.repiten;

  return (
    <div className="max-w-6xl">
      <SectionHeader
        eyebrow="Negocio"
        title="Métricas"
        description="Cómo viene el negocio, no cómo viene el día. Para el día está la pantalla de inicio."
        // Mientras la app se use poco, se dice arriba: sin esto el dueño leería
        // "septiembre = $ 1,1 M" como todo lo que entró al local.
        subtitulo={
          h.primerCobroYmd && h.diasConCobros13s < 21
            ? `En las últimas 13 semanas la app tiene cobros en ${cuantos(h.diasConCobros13s, "día", "días")}. Esto es lo registrado acá, no todo lo que entró al local.`
            : undefined
        }
      />

      {!h.primerCobroYmd ? (
        <div className={`mt-6 ${PANEL}`}>
          <p className="text-[13px] leading-relaxed text-muted">
            Todavía no hay cobros registrados{enSede}. Los números aparecen solos a medida que los barberos van cobrando en
            el mostrador.
          </p>
        </div>
      ) : (
        <>
          <PeriodoChips
            opciones={PERIODOS.map((x) => ({ href: `/admin/metricas${qs(x.id)}`, label: x.label, activo: x.id === p }))}
            extra={
              m.servicios > 0 && (
                <a href={`/admin/metricas/xlsx${qs(p)}`} className={chipFiltroClases(false, "gap-2 sm:ml-auto")}>
                  <DownloadIcon className="h-4 w-4" /> Excel
                </a>
              )
            }
          >
            {/* La respuesta primero: una sola cifra grande y, si hay con qué, cómo va contra antes. */}
            <section className={`mt-4 ${PANEL} sm:p-6`}>
              <p className="eyebrow">
                Entró en caja · {corte}
                {nombreSede ? ` · ${nombreSede}` : ""}
              </p>
              <p className="bb-monto mt-2 font-display text-5xl font-semibold leading-none text-ink sm:text-6xl">{cop(m.plata)}</p>
              <p className="mt-3 max-w-[60ch] text-[15px] leading-snug text-ink">{frase}</p>
              {apoyo && <p className="bb-monto mt-1 text-[13px] text-muted">{apoyo}</p>}
              {m.servicios === 0 && h.diasConCobros13s > 0 && p !== "90d" && p !== "365d" && (
                <Link
                  href={qs("90d")}
                  className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line px-4 text-[13px] font-semibold text-ink transition hover:border-ink/40"
                >
                  Ver los últimos 90 días <ChevronRightIcon className="h-4 w-4" />
                </Link>
              )}
              {m.servicios > 0 && (
                // Cada número se abre con su detalle. key: al cambiar de período o de
                // sede arranca cerrado (el detalle abierto era de otros datos).
                <Desglose
                  key={`${p}|${sede ?? ""}`}
                  items={[
                    { clave: "cobros", numero: miles(m.servicios), etiqueta: m.servicios === 1 ? "cobro" : "cobros", panel: panelCobros },
                    { clave: "ticket", numero: cop(m.ticket), etiqueta: "por cobro", panel: panelTicket },
                    { clave: "propinas", numero: cop(m.propinas), etiqueta: "propinas", panel: panelPropinas },
                  ]}
                />
              )}
            </section>

            {m.servicios > 0 && (
              <>
                {/* key: al cambiar de período o de sede la gráfica se vuelve a montar y
                    las columnas suben de nuevo; un cobro que llega en vivo NO la remonta. */}
                <section key={`${p}|${sede ?? ""}`} className={`mt-4 ${PANEL}`}>
                  <h3 className="mb-1 font-display text-lg">
                    Lo que entró cada {grano === "dia" ? "día" : grano === "semana" ? "semana" : "mes"}
                  </h3>
                  <Columnas
                    baldes={[...tramos, ...porVenir]}
                    hoyIdx={hoyIdx}
                    grano={grano}
                    etiqueta={`Lo que entró cada ${grano === "dia" ? "día" : grano}`}
                  />
                  {/* El mismo umbral de la tarjeta (no un 7 fijo: los primeros 6 días del
                      mes decía "días sueltos" con cobros todos los días). */}
                  {!esteAlcanza && (
                    <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                      {esMes
                        ? `Hay cobros en ${m.diasConCobros} de ${cuantos(m.dias, "día", "días")}.`
                        : `En ${ESTOS[p]} hay cobros en ${cuantos(m.diasConCobros, "día", "días")}.`}{" "}
                      Son días sueltos: todavía no dicen para dónde va el negocio.
                    </p>
                  )}
                  {tramos.length < todos.length && (
                    <p className="mt-1 text-[12.5px] text-muted">
                      La app registra cobros{enSede} desde el {diaMes(h.primerCobroYmd!)} {h.primerCobroYmd!.slice(0, 4)}.
                    </p>
                  )}
                </section>

                <div className={`mt-4 grid gap-4 md:grid-cols-2 ${conSedes ? "" : "xl:grid-cols-3"}`}>
                  {conSedes && <RankingMetrica titulo="Cada sede" orden="de lo que entró" vacio="" filas={filasSede} />}
                  <RankingMetrica
                    titulo="Quién produce"
                    orden="por plata"
                    vacio="Sin cobros asignados a un barbero."
                    filas={m.porBarbero.map((b) => ({
                      nombre: b.nombre,
                      fotoUrl: b.fotoUrl,
                      valor: cop(b.plata),
                      sub: `${b.cortes} ${b.cortes === 1 ? "cobro" : "cobros"}`,
                      peso: b.plata,
                    }))}
                  />
                  <RankingMetrica
                    titulo="Qué piden"
                    orden="por veces pedidas"
                    vacio="Los cobros de este período no tienen servicios detallados."
                    filas={m.porServicio.map((s) => ({
                      nombre: s.nombre,
                      valor: `${s.veces}×`,
                      sub: `deja ${cop(s.plata)}`,
                      peso: s.veces,
                    }))}
                  />
                  <RankingMetrica
                    titulo="Qué se vende"
                    orden="por plata"
                    vacio="Este período no se vendió ningún producto en el mostrador."
                    filas={m.porProducto.map((x) => ({
                      nombre: x.nombre,
                      valor: cop(x.plata),
                      sub: `${x.veces} ${x.veces === 1 ? "unidad" : "unidades"}`,
                      peso: x.plata,
                    }))}
                  />
                </div>

                <section className={`mt-4 ${PANEL}`}>
                  <h3 className="font-display text-lg">Clientes</h3>
                  {/* Mini-cuadros, no un párrafo: los tres números se leen de un golpe.
                      Todos en tinta: ni "ya habían venido" es alarma ni "nuevos" es estado. */}
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {[
                      { n: m.clientes.total, l: "atendidos con ficha" },
                      { n: m.clientes.repiten, l: "ya habían venido" },
                      { n: nuevos, l: nuevos === 1 ? "es nuevo" : "son nuevos" },
                    ].map((k) => (
                      <div key={k.l} className="rounded-xl border border-line bg-elevated px-3 py-2.5">
                        <div className="font-display text-2xl font-bold tabular-nums text-ink">{k.n}</div>
                        <div className="text-[12px] leading-tight text-muted">{k.l}</div>
                      </div>
                    ))}
                  </div>
                  {m.clientes.total > 0 && (
                    <p className="mt-2.5 text-[12px] text-muted">
                      Que vuelvan es lo que sostiene la barbería; los nuevos son lo que la hace crecer.
                    </p>
                  )}
                </section>
              </>
            )}
          </PeriodoChips>

          {/* Rango propio (el mes y los 12 meses): por eso va aparte y lo dice. */}
          <section className="mt-10">
            <p className="eyebrow">
              Histórico · no cambia con los botones de arriba
              {nombreSede ? ` · ${nombreSede}` : ""}
            </p>
            <div className="mt-3 grid gap-4 lg:grid-cols-2 lg:items-start">
              {(vaEn > 0 || cerroEn > 0) && (
                <article key={`ritmo|${sede ?? ""}`} className={PANEL}>
                  <h3 className="font-display text-lg">
                    {mayuscula(esteMes)} contra {elPasado}
                  </h3>
                  {cerroEn > 0 ? (
                    <p className="mb-1 mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
                      <span>
                        <i className="bb-trazo-clave bg-accent" />
                        {esteMes}, hasta hoy
                      </span>
                      <span>
                        <i className="bb-trazo-clave bg-ink opacity-60" />
                        {elPasado}
                        {vaEn > cerroEn && (
                          <>
                            , cerró en <b className="bb-monto font-semibold text-ink">{cop(cerroEn)}</b>
                          </>
                        )}
                      </span>
                    </p>
                  ) : (
                    <p className="mb-1 mt-1 text-[12.5px] text-muted">{mayuscula(elPasado)} no tiene cobros registrados.</p>
                  )}
                  <LecturaGrafica lecturas={lecturasRitmo} inicial={hoyDia} etiqueta={`${esteMes} contra ${elPasado}, acumulado por día`} guia="linea" alVer>
                    <div className="bb-plot">
                      <Rejilla marcas={marcasRitmo} />
                      {cerroEn > 0 && (
                        <svg className="bb-lienzo" viewBox={`0 0 ${nRitmo} 100`} preserveAspectRatio="none" aria-hidden>
                          {/* En la casilla de hoy el mes pasado va "a esta misma hora" (no su día
                              entero): es la cifra de la tarjeta, de la lectura y de la tabla. */}
                          <path
                            className="bb-antes"
                            d={escalera(
                              ritmo.antes.map((v, i) => (i === hoyDia ? h.antesAhora : v)),
                              topeRitmo,
                              true,
                              cerroEn,
                            )}
                          />
                        </svg>
                      )}
                      <svg className="bb-lienzo bb-barrido" viewBox={`0 0 ${nRitmo} 100`} preserveAspectRatio="none" aria-hidden>
                        <path className="bb-ahora" d={escalera(ritmo.actual, topeRitmo)} />
                      </svg>
                      <span
                        className="bb-punto"
                        aria-hidden
                        style={
                          {
                            left: `${((hoyDia + 0.5) / nRitmo) * 100}%`,
                            bottom: `${(vaEn / topeRitmo) * 100}%`,
                            "--avance": (hoyDia + 0.5) / nRitmo,
                          } as CSSProperties
                        }
                      />
                      {/* Solo mientras este mes va por debajo: si ya pasó el cierre anterior,
                          la línea roja cruza esa franja y el fondo del rótulo la tapaba. Ahí el
                          cierre se dice en la leyenda. */}
                      {cerroEn > 0 && vaEn <= cerroEn && (
                        <span className="bb-rotulo bb-monto" aria-hidden style={{ bottom: `calc(${(cerroEn / topeRitmo) * 100}% + 6px)` }}>
                          {MON[Number(ritmo.mesAntes.slice(5)) - 1]} · <b>{cop(cerroEn)}</b>
                        </span>
                      )}
                    </div>
                    <EjeX n={nRitmo} rotulos={rotulosRitmo} />
                  </LecturaGrafica>
                  <Tabla
                    cabecera={["Acumulado al día", mayuscula(esteMes), mayuscula(elPasado)]}
                    filas={Array.from({ length: nRitmo }, (_, i) => [
                      i === hoyDia ? `${i + 1} (hoy, hasta ahora)` : String(i + 1),
                      i <= hoyDia ? cop(ritmo.actual[i]) : "",
                      // Hoy, el mes pasado va a esta misma hora: la cifra de la tarjeta y de la lectura.
                      ritmo.antes[i] === undefined ? "" : cop(i === hoyDia ? h.antesAhora : ritmo.antes[i]),
                    ]).filter((f) => f[1] || f[2])}
                  />
                </article>
              )}

              {/* En "Año" la gráfica de arriba ya es mes por mes. */}
              {p !== "365d" && (
                <article key={`meses|${sede ?? ""}`} className={PANEL}>
                  <h3 className="mb-1 font-display text-lg">Mes por mes</h3>
                  {meses.length >= 3 ? (
                    <Columnas baldes={meses} hoyIdx={meses.length - 1} grano="mes" etiqueta="Lo que entró cada mes" alVer />
                  ) : (
                    // Con uno o dos meses una gráfica no dice nada que la tabla no diga mejor.
                    <Tabla
                      abierta
                      cabecera={["Mes", "Entró", "Cobros", "Días con cobros"]}
                      filas={meses.map((b) => [mayuscula(nombreMes(b.desdeYmd.slice(0, 7))), cop(b.total), miles(b.cobros), String(b.diasConCobros)])}
                    />
                  )}
                  {arranqueReciente && (
                    <p className="mt-1 text-[12.5px] text-muted">
                      La app registra cobros{enSede} desde el {diaMes(h.primerCobroYmd!)} {h.primerCobroYmd!.slice(0, 4)}.
                    </p>
                  )}
                </article>
              )}
            </div>
          </section>

          {/* Export a la medida, al pie y plegado: es para el contador, no para leer
              el negocio. Es un <form> GET al mismo route handler: dos <input
              type="date"> nativos —el celular abre su propio calendario— y nada de JS. */}
          <Plegable titulo="Excel de un rango exacto" subtitulo={`Para el contador o el cierre de mes${nombreSede ? ` · ${nombreSede}` : ""}`} className="mt-8">
            <form action="/admin/metricas/xlsx" className="flex flex-wrap items-end gap-2">
              {sede && <input type="hidden" name="sede" value={sede} />}
              {[
                { name: "desde", label: "Desde", valor: mesYmd },
                { name: "hasta", label: "Hasta", valor: hoyYmd },
              ].map((f) => (
                <label key={f.name} className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                  {f.label}
                  <input
                    type="date"
                    name={f.name}
                    required
                    max={hoyYmd}
                    defaultValue={f.valor}
                    className="mt-1 block min-h-11 rounded-xl border border-line bg-bg px-3 text-[13px] text-ink focus:border-accent focus:outline-none"
                  />
                </label>
              ))}
              <button
                type="submit"
                className="flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-[13px] font-semibold text-ink transition hover:border-ink/40"
              >
                <DownloadIcon className="h-4 w-4" /> Descargar
              </button>
            </form>
          </Plegable>
        </>
      )}
    </div>
  );
}

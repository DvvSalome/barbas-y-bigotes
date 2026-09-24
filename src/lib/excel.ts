import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";
import path from "node:path";

/*
  El Excel de la casa.

  ANTES los tres botones "↓ Excel" (liquidación, cobros, clientes) bajaban un
  CSV con punto y coma. Funcionaba —Excel lo abría— pero lo que le llegaba al
  contador, o al dueño por WhatsApp, era una cuadrícula gris sin nombre, sin
  fecha, sin formato de plata y sin decir de quién era. Este módulo lo cambia por
  un .xlsx de verdad: logo, cabecera de marca, montos en pesos, fila de totales,
  filtros, encabezados congelados y hoja lista para imprimir.

  ESCALABLE A PROPÓSITO: una ruta nueva no toca nada de esto. Declara sus
  columnas (título, ancho, tipo) y pasa las filas; el formato, la marca, los
  totales y la impresión salen solos. Agregar una segunda hoja al mismo libro es
  un elemento más en el arreglo.

  Server-only: `exceljs` y `node:fs` no existen en el navegador. Estos módulos
  se importan desde route handlers (`export const runtime` por defecto = Node).
*/

/** Paleta de marca en ARGB, que es como ExcelJS pide los colores. */
const C = {
  banda: "FF000000", // el lockup .jpg trae fondo negro: la banda lo continúa sin costura
  tinta: "FFF2EDE4",
  apagado: "FF9C958A",
  acento: "FFC93A2E", // --cta-1
  acentoSuave: "FFE8675C",
  linea: "FFD8D2C8",
  cebra: "FFF7F5F2", // gris de banda alterna, casi blanco: se imprime bien
  aviso: "FFB4791F",
};

export type TipoCelda = "texto" | "plata" | "entero" | "fecha" | "pct";

export type Columna = {
  /** Clave dentro de cada fila. */
  k: string;
  /** Lo que se lee en la cabecera. */
  t: string;
  /** Ancho en caracteres de Excel. Por defecto sale del tipo. */
  ancho?: number;
  tipo?: TipoCelda;
  /** Suma esta columna en la fila TOTAL. Solo tiene sentido en números. */
  total?: boolean;
  /** Envolver el texto en vez de cortarlo. Excel RECORTA una celda de texto
   *  cuando la de al lado tiene algo: "Agua + Bebida (gaseosa / energiz". */
  envolver?: boolean;
};

export type Hoja = {
  nombre: string;
  titulo: string;
  subtitulo?: string;
  /** Línea chica bajo el subtítulo: período, sede, filtros aplicados. */
  meta?: string;
  columnas: Columna[];
  filas: Record<string, string | number | null | undefined>[];
  /** Nota al pie de la hoja (por ejemplo, qué NO entra en los totales). */
  nota?: string;
};

// Formatos de número. El separador de miles lo pone Excel según el idioma de la
// máquina, así que `#,##0` sale con punto en una Windows en español.
const FORMATO: Record<TipoCelda, string | undefined> = {
  texto: undefined,
  plata: '"$"\\ #,##0;[Red]-"$"\\ #,##0',
  entero: "#,##0",
  fecha: "dd/mm/yyyy",
  pct: '0"%"',
};

// El ancho por defecto de cada tipo. `plata` en 16 y no 15: con "$ 140.000" en
// negrita, 15 deja el número pegado al de la columna siguiente.
const ANCHO: Record<TipoCelda, number> = { texto: 22, plata: 16, entero: 11, fecha: 12, pct: 9 };

const letra = (n: number) => {
  // 1 -> A, 27 -> AA. Excel no usa base 26 pura.
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

/** Excel rechaza / \ ? * [ ] : en el nombre de una hoja, y el tope son 31 caracteres. */
const nombreDeHoja = (s: string) => s.replace(/[/\\?*[\]:]/g, "-").slice(0, 31) || "Hoja";

let logoCache: Buffer | null = null;
async function logo(): Promise<Buffer | null> {
  if (logoCache) return logoCache;
  try {
    // El .jpg y no el .png: el png es blanco sobre transparente y en una hoja de
    // Excel (fondo blanco) se vería un rectángulo vacío. El jpg trae su fondo
    // negro. Va declarado en `outputFileTracingIncludes` de next.config para que
    // el archivo viaje al bundle de la función en Vercel.
    logoCache = await readFile(path.join(process.cwd(), "public", "brand", "logo-lockup.jpg"));
    return logoCache;
  } catch {
    // Sin logo el reporte sale igual: la marca es un adorno, los números no.
    return null;
  }
}

const FILA_CABECERA = 6;

export async function libroBarbas(hojas: Hoja[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Barbas y Bigotes";
  wb.lastModifiedBy = "Barbas y Bigotes";
  wb.company = "Barbas y Bigotes Barbershop";

  const img = await logo();
  // base64 y no el Buffer: los tipos de exceljs traen su propio `Buffer` y
  // chocan con los de @types/node de este proyecto. Son 18 KB, da igual.
  const idLogo = img
    ? wb.addImage({ base64: `data:image/jpeg;base64,${img.toString("base64")}`, extension: "jpeg" })
    : null;

  for (const h of hojas) {
    const ws = wb.addWorksheet(nombreDeHoja(h.nombre), {
      views: [{ state: "frozen", ySplit: FILA_CABECERA }],
      pageSetup: {
        orientation: h.columnas.length > 6 ? "landscape" : "portrait",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
        printTitlesRow: `${FILA_CABECERA}:${FILA_CABECERA}`,
      },
    });
    const ultima = h.columnas.length;

    // ── Banda de marca ────────────────────────────────────────────────────
    for (let r = 1; r <= 4; r++) {
      ws.getRow(r).height = 20;
      for (let c = 1; c <= ultima; c++) {
        ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.banda } };
      }
    }
    if (idLogo !== null) {
      // 1024×348 escalado a 208×71: entra en las cuatro filas de la banda.
      ws.addImage(idLogo, { tl: { col: 0.25, row: 0.45 }, ext: { width: 208, height: 71 } });
    }
    // El texto arranca donde ya no está el logo. Con pocas columnas anchas basta
    // la segunda; con muchas (y estrechas) hay que correrse más a la derecha.
    const colTexto = Math.min(ultima, ultima > 6 ? 4 : 2);
    const escribir = (fila: number, texto: string, estilo: Partial<ExcelJS.Font>) => {
      if (!texto) return;
      if (colTexto < ultima) ws.mergeCells(fila, colTexto, fila, ultima);
      const cel = ws.getCell(fila, colTexto);
      cel.value = texto;
      cel.font = { name: "Calibri", color: { argb: C.tinta }, ...estilo };
      // Sangría: sin ella, impreso, el texto queda pegado al filo de la hoja
      // (se comprobó exportando a PDF con Excel: "Generado el…" salía cortado).
      cel.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
    };
    escribir(2, h.titulo, { size: 15, bold: true });
    escribir(3, h.subtitulo ?? "", { size: 10, color: { argb: C.apagado } });
    escribir(4, h.meta ?? "", { size: 9, color: { argb: C.apagado } });

    ws.getRow(5).height = 6; // respiro entre la banda y la tabla

    // ── Cabecera de la tabla ──────────────────────────────────────────────
    const cab = ws.getRow(FILA_CABECERA);
    cab.height = 26;
    h.columnas.forEach((col, i) => {
      const cel = cab.getCell(i + 1);
      cel.value = col.t;
      cel.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.tinta } };
      cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.acento } };
      cel.alignment = { vertical: "middle", horizontal: numerica(col) ? "right" : "left", indent: numerica(col) ? 1 : 0, wrapText: true };
      ws.getColumn(i + 1).width = col.ancho ?? ANCHO[col.tipo ?? "texto"];
    });

    // ── Datos ─────────────────────────────────────────────────────────────
    h.filas.forEach((f, n) => {
      const row = ws.getRow(FILA_CABECERA + 1 + n);
      // Alto fijo solo si ninguna columna envuelve: si no, Excel no la agranda
      // y la segunda línea del texto queda escondida.
      if (!h.columnas.some((c) => c.envolver)) row.height = 19;
      h.columnas.forEach((col, i) => {
        const cel = row.getCell(i + 1);
        const v = f[col.k];
        cel.value = v === undefined || v === null || v === "" ? null : v;
        cel.font = { name: "Calibri", size: 10 };
        const fmt = FORMATO[col.tipo ?? "texto"];
        if (fmt) cel.numFmt = fmt;
        cel.alignment = {
          vertical: "middle",
          horizontal: numerica(col) ? "right" : "left",
          indent: numerica(col) ? 1 : 0,
          // Solo la última columna (los detalles largos) envuelve: si envolvieran
          // todas, una fila con un nombre largo estiraría la tabla entera.
          wrapText: !!col.envolver || (i === h.columnas.length - 1 && (col.tipo ?? "texto") === "texto"),
        };
        if (n % 2 === 1) cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.cebra } };
        cel.border = { bottom: { style: "hair", color: { argb: C.linea } } };
      });
    });

    // ── Fila de TOTAL: lo primero que busca quien abre esto ───────────────
    const columnasQueSuman = h.columnas.filter((c) => c.total);
    if (h.filas.length > 0 && columnasQueSuman.length > 0) {
      const row = ws.getRow(FILA_CABECERA + 1 + h.filas.length);
      row.height = 24;
      h.columnas.forEach((col, i) => {
        const cel = row.getCell(i + 1);
        if (i === 0) cel.value = "TOTAL";
        else if (col.total) {
          // Fórmula, no un número precalculado: si alguien filtra o edita una
          // fila en Excel, el total deja de mentir. `SUBTOTAL(109;…)` ignora las
          // filas ocultas por el filtro, que es lo que uno espera al filtrar.
          const col1 = letra(i + 1);
          cel.value = {
            formula: `SUBTOTAL(109,${col1}${FILA_CABECERA + 1}:${col1}${FILA_CABECERA + h.filas.length})`,
            date1904: false,
          };
          cel.numFmt = FORMATO[col.tipo ?? "entero"] ?? "#,##0";
        }
        cel.font = { name: "Calibri", size: 11, bold: true };
        cel.alignment = { vertical: "middle", horizontal: numerica(col) ? "right" : "left", indent: numerica(col) ? 1 : 0 };
        cel.border = { top: { style: "double", color: { argb: C.acento } } };
      });
    }

    // Filtros sobre la cabecera, sin incluir la fila de totales.
    if (h.filas.length > 0) {
      ws.autoFilter = {
        from: { row: FILA_CABECERA, column: 1 },
        to: { row: FILA_CABECERA + h.filas.length, column: ultima },
      };
    } else {
      const cel = ws.getCell(FILA_CABECERA + 1, 1);
      cel.value = "No hay datos para este período.";
      cel.font = { name: "Calibri", size: 10, italic: true, color: { argb: C.apagado } };
      ws.mergeCells(FILA_CABECERA + 1, 1, FILA_CABECERA + 1, ultima);
    }

    if (h.nota) {
      const r = FILA_CABECERA + h.filas.length + 3;
      ws.mergeCells(r, 1, r, ultima);
      const cel = ws.getCell(r, 1);
      cel.value = h.nota;
      cel.font = { name: "Calibri", size: 9, italic: true, color: { argb: C.aviso } };
      cel.alignment = { wrapText: true, vertical: "top" };
      // Excel NO agranda solo una fila de celdas combinadas: una nota de dos
      // renglones salía cortada en el primero (se vio al imprimir el reporte del
      // mes). Se calcula el alto: ~1,1 caracteres de 9 pt por unidad de ancho.
      const anchoTotal = h.columnas.reduce(
        (a, c, i) => a + (i === 0 ? Math.max(c.ancho ?? ANCHO[c.tipo ?? "texto"], 26) : (c.ancho ?? ANCHO[c.tipo ?? "texto"])),
        0,
      );
      ws.getRow(r).height = Math.ceil(h.nota.length / (anchoTotal * 1.1)) * 12 + 4;
    }

    ws.headerFooter.oddFooter = `&L&9Barbas y Bigotes · ${h.titulo}&R&9Página &P de &N`;
    ws.getColumn(1).width = Math.max(ws.getColumn(1).width ?? 0, 26);
  }

  // ExcelJS devuelve ArrayBuffer aunque el tipo diga Buffer.
  const salida = await wb.xlsx.writeBuffer();
  return Buffer.from(salida as ArrayBuffer);
}

function numerica(col: Columna) {
  const t = col.tipo ?? "texto";
  return t === "plata" || t === "entero" || t === "pct";
}

/** Cabeceras de descarga de un .xlsx. Un sitio, para que los tres botones no discrepen. */
export function cabecerasXlsx(archivo: string) {
  return {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${archivo}"`,
    "Cache-Control": "no-store",
  };
}

export const cop = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);

/**
 * Solo la hora ("6:42 am"), SIEMPRE en Bogotá. Para lo que se pinta en el
 * server (Vercel corre en UTC: `new Date(iso).getHours()` ahí da 5 horas de
 * más). El "a. m." de es-CO se normaliza a "am" para igualar el resto del
 * staff, que escribe la hora a mano.
 */
export const horaBogota = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "numeric",
    minute: "2-digit",
  })
    .format(new Date(iso))
    .replace(/\s*a\.\s*m\./i, " am")
    .replace(/\s*p\.\s*m\./i, " pm");

// Fecha y hora legibles para el cliente, SIEMPRE en Bogotá (los servers de
// Vercel corren en UTC; nunca formatear con el TZ del proceso).
// Ej.: "viernes, 10 de julio, 3:30 p. m."
export const fechaHoraBogota = (d: Date) =>
  new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);

/**
 * Escapa un valor para CSV. Separador `;` porque Excel en español trata la coma
 * como separador decimal: con `,` el archivo se abre todo apilado en una columna.
 * Un nombre con `;`, comillas o un salto de línea rompe el archivo si no se cita.
 *
 * Además neutraliza la INYECCIÓN DE FÓRMULAS: una celda que arranca con `=`, `+`,
 * `-`, `@` (o un tab/retorno que se cuele adelante) la ejecuta Excel/Sheets al
 * abrir el archivo. Como el nombre del cliente es texto libre anónimo del booking
 * público y este CSV lo abre el dueño/contador, se prefija con un apóstrofo para
 * forzar TEXTO y se cita para que ese apóstrofo viaje literal sin correr columnas.
 */
export const celdaCsv = (v: unknown): string => {
  const s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) return `"'${s.replace(/"/g, '""')}"`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

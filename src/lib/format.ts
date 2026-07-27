export const cop = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);

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
 */
export const celdaCsv = (v: unknown): string => {
  const s = String(v ?? "");
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

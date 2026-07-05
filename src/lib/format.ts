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

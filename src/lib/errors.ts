// Módulo plano (sin "use server"): lo importan las server actions.

// Loguea el error real server-side y devuelve un mensaje seguro para la UI.
// Nunca devolver error.message de Postgres al cliente: filtra constraints,
// nombres de tablas y detalles internos en inglés.
export function errorPublico(
  contexto: string,
  error: { message?: string } | null | undefined,
  publico = "No se pudo completar la operación. Intentá de nuevo.",
): string {
  console.error(`[${contexto}]`, error?.message ?? error);
  return publico;
}

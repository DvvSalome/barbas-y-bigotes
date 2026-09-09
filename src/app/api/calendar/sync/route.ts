// POST /api/calendar/sync — vacía la cola de Google Calendar (0073). Lo dispara
// n8n con el header x-push-secret: al instante cuando entra una reserva (el mismo
// webhook de la confirmación) y cada 5 minutos como red para cambios y
// cancelaciones. Idempotente: si no hay nada en la cola, no hace nada.

import { sincronizarCalendar } from "@/lib/calendar-sync";
import { secretoCronValido } from "@/lib/cron-secret";

export const dynamic = "force-dynamic";
// Cada evento son 1-2 llamadas a Google (~300 ms); 25 por vuelta caben holgados.
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!secretoCronValido(request.headers.get("x-push-secret"))) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const resumen = await sincronizarCalendar(25);
  return Response.json({ ok: resumen.errores === 0, ...resumen });
}

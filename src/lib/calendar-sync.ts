import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  calendarConfigurado,
  crearCalendario,
  compartirCalendario,
  guardarEvento,
  borrarEvento,
  type EventoCalendar,
  type RolCalendario,
} from "@/lib/google-calendar";

// Procesador de la cola de Google Calendar (0073). Lo llaman /api/calendar/sync
// (n8n: al reservar y cada 5 min) y el botón "Sincronizar ahora" del admin.
// Regla: la base decide QUÉ cambió (trigger → calendar_cola); acá solo se traduce
// cada reserva a su evento en la agenda del barbero.

const TZ = "America/Bogota";
const ICONO: Record<string, string> = { pendiente: "🕓 ", confirmada: "", en_curso: "✂️ ", completada: "✅ ", no_show: "❌ " };
// Colores de Google Calendar: 5 amarillo (pendiente), 10 verde (completada), 11 rojo (no vino).
const COLOR: Record<string, string> = { pendiente: "5", completada: "10", no_show: "11" };

export type FilaCola = {
  cola_id: number;
  reserva_id: string;
  existe: boolean;
  inicio: string | null;
  fin: string | null;
  estado: string | null;
  barbero_id: string | null;
  barbero: string | null;
  sede_id: string | null;
  sede: string | null;
  direccion: string | null;
  cliente: string | null;
  telefono: string | null;
  servicio: string | null;
  nota: string | null;
  canal: string | null;
  calendar_id: string | null;
  event_id: string | null;
};

export type ResumenSync = { procesados: number; errores: number; omitidos: number; detalle: string[] };

/** El calendario del barbero; si no existe lo crea y lo comparte con los correos extra (dueño). */
export async function calendarioDeBarbero(admin: SupabaseClient, barberoId: string, nombre: string): Promise<string> {
  const { data } = await admin.from("barbero_calendar").select("calendar_id").eq("barbero_id", barberoId).maybeSingle();
  if ((data as { calendar_id?: string } | null)?.calendar_id) return (data as { calendar_id: string }).calendar_id;

  const id = await crearCalendario(
    `✂️ ${nombre} · Barbas & Bigotes`,
    `Citas de ${nombre}. Las escribe la app de Barbas & Bigotes: los cambios se hacen allá, no acá.`,
  );
  // ponytail: si dos vueltas crean a la vez, gana la primera fila y el segundo
  // calendario queda huérfano (vacío) en la cuenta de servicio. Poco probable: hay
  // un solo cron y el webhook; si molesta, un lock por barbero.
  const { error } = await admin.from("barbero_calendar").insert({ barbero_id: barberoId, calendar_id: id });
  if (error) {
    const { data: otra } = await admin.from("barbero_calendar").select("calendar_id").eq("barbero_id", barberoId).maybeSingle();
    if ((otra as { calendar_id?: string } | null)?.calendar_id) return (otra as { calendar_id: string }).calendar_id;
    throw error;
  }
  const { data: extra } = await admin.from("calendar_compartidos").select("email,rol");
  for (const e of (extra ?? []) as { email: string; rol: RolCalendario }[]) {
    await compartirCalendario(id, e.email, e.rol).catch(() => null);
  }
  return id;
}

function eventoDe(f: FilaCola): EventoCalendar {
  const estado = f.estado ?? "confirmada";
  const inicio = f.inicio ?? new Date().toISOString();
  const fecha = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(inicio));
  const digitos = (f.telefono ?? "").replace(/\D/g, "");
  const wa = digitos ? `https://wa.me/${digitos.length === 10 ? "57" + digitos : digitos}` : "";
  const lineas = [
    f.telefono ? `Tel: ${f.telefono}${wa ? ` · ${wa}` : ""}` : null,
    f.nota ? `Nota: ${f.nota}` : null,
    `Estado: ${estado}${f.canal ? ` · canal ${f.canal}` : ""}`,
    `Agenda: https://barbasybigotes.com/barbero?tab=calendario&fecha=${fecha}`,
  ].filter((l): l is string => !!l);
  return {
    summary: `${ICONO[estado] ?? ""}${f.cliente ?? "Cliente"} · ${f.servicio ?? "Servicio"}`,
    description: lineas.join("\n"),
    location: [f.sede, f.direccion].filter(Boolean).join(" · "),
    start: { dateTime: inicio, timeZone: TZ },
    end: { dateTime: f.fin ?? inicio, timeZone: TZ },
    extendedProperties: { private: { reservaId: f.reserva_id } },
    ...(COLOR[estado] ? { colorId: COLOR[estado] } : {}),
    reminders: { useDefault: true },
  };
}

export async function sincronizarCalendar(limite = 20): Promise<ResumenSync> {
  const resumen: ResumenSync = { procesados: 0, errores: 0, omitidos: 0, detalle: [] };
  if (!calendarConfigurado()) {
    resumen.detalle.push("Falta GOOGLE_CALENDAR_SA_JSON");
    return resumen;
  }
  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc("tomar_calendar_cola", { p_limite: limite });
  if (error) {
    resumen.detalle.push(error.message);
    return resumen;
  }
  for (const f of (data ?? []) as FilaCola[]) {
    try {
      if (!f.existe || f.estado === "cancelada") {
        // Reserva borrada o cancelada: el evento se va.
        if (f.calendar_id && f.event_id) await borrarEvento(f.calendar_id, f.event_id);
        await admin.from("reserva_calendar").delete().eq("reserva_id", f.reserva_id);
      } else if (!f.barbero_id) {
        // "Cualquier barbero": no hay agenda hasta que se asigne (volverá a encolarse al asignar).
        resumen.omitidos++;
      } else {
        const cal = await calendarioDeBarbero(admin, f.barbero_id, f.barbero ?? "Barbero");
        let eventId = f.event_id;
        if (eventId && f.calendar_id && f.calendar_id !== cal) {
          // Cambió de barbero: el evento se muda de agenda.
          await borrarEvento(f.calendar_id, eventId);
          eventId = null;
        }
        const nuevo = await guardarEvento(cal, eventId, eventoDe(f));
        await admin.from("reserva_calendar").upsert({
          reserva_id: f.reserva_id,
          calendar_id: cal,
          event_id: nuevo,
          actualizado_en: new Date().toISOString(),
        });
      }
      await admin.from("calendar_cola").update({ procesado_en: new Date().toISOString(), error: null }).eq("id", f.cola_id);
      resumen.procesados++;
    } catch (e) {
      const msg = ((e as Error).message ?? String(e)).slice(0, 300);
      resumen.errores++;
      resumen.detalle.push(`${f.reserva_id.slice(0, 8)}: ${msg}`);
      // Se suelta para la próxima vuelta; el RPC deja de ofrecerla tras 6 intentos.
      await admin.from("calendar_cola").update({ tomado_en: null, error: msg }).eq("id", f.cola_id);
    }
  }
  return resumen;
}

/** Encola las citas futuras que aún no tienen evento (arranque y "sincronizar ahora"). */
export async function encolarFuturas(admin: SupabaseClient): Promise<number> {
  const { data: reservas } = await admin
    .from("reservas")
    .select("id")
    .in("estado", ["pendiente", "confirmada"])
    .gt("inicio", new Date().toISOString())
    .not("barbero_id", "is", null);
  const ids = ((reservas ?? []) as { id: string }[]).map((r) => r.id);
  if (!ids.length) return 0;
  const { data: conEvento } = await admin.from("reserva_calendar").select("reserva_id").in("reserva_id", ids);
  const { data: enCola } = await admin.from("calendar_cola").select("reserva_id").in("reserva_id", ids).is("procesado_en", null);
  const ya = new Set([
    ...((conEvento ?? []) as { reserva_id: string }[]).map((r) => r.reserva_id),
    ...((enCola ?? []) as { reserva_id: string }[]).map((r) => r.reserva_id),
  ]);
  const faltan = ids.filter((id) => !ya.has(id));
  if (faltan.length) await admin.from("calendar_cola").insert(faltan.map((reserva_id) => ({ reserva_id })));
  return faltan.length;
}

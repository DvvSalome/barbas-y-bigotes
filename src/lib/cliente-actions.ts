"use server";

import { type SupabaseClient } from "@supabase/supabase-js";
import { supabaseServerAuth, supabaseAdmin } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { CANCELACION_MIN_HORAS } from "@/lib/slots";

export type CuentaContext = { estado: "anon" | "staff" | "cliente"; clienteId?: string };

// Devuelve el cliente_id de un usuario logueado NO-staff, creando su ficha si no existe.
// CLAVE DE SEGURIDAD: el enlace es por auth_id (identidad VERIFICADA de Google), nunca por
// email. clientes.email no es verificado (lo tipea cualquiera en el booking público), así que
// adoptar una ficha por email permitiría apropiarse de la ficha/PII de otra persona.
// Devuelve null si el usuario es staff. Corre con service role (admin), de confianza.
export async function clienteIdForUser(
  admin: SupabaseClient,
  userId: string,
  email: string,
  nombre: string,
): Promise<string | null> {
  const { data: prof } = await admin.from("profiles").select("id").eq("auth_id", userId).maybeSingle();
  if (prof) return null; // es staff, no cliente
  const { data: byAuth } = await admin.from("clientes").select("id").eq("auth_id", userId).maybeSingle();
  if (byAuth) return (byAuth as { id: string }).id;
  const { data: created } = await admin
    .from("clientes")
    .insert({ nombre: nombre || "Cliente", email: email || null, auth_id: userId, origen: "app" })
    .select("id")
    .single();
  return (created as { id: string } | null)?.id ?? null;
}

// Resuelve el estado del usuario para el portal y asegura su ficha de cliente.
export async function ensureCliente(): Promise<CuentaContext> {
  const sb = await supabaseServerAuth();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { estado: "anon" };

  const admin = supabaseAdmin();
  const { data: prof } = await admin.from("profiles").select("id").eq("auth_id", user.id).maybeSingle();
  if (prof) return { estado: "staff" };

  const email = (user.email ?? "").trim().toLowerCase();
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const nombre = (meta.full_name as string) || (meta.name as string) || (email ? email.split("@")[0] : "Cliente");
  const id = await clienteIdForUser(admin, user.id, email, nombre);
  return { estado: "cliente", clienteId: id ?? undefined };
}

export async function responderPropuestaAdelanto(
  reservaId: string,
  respuesta: "aceptar" | "rechazar",
): Promise<{ ok: boolean; error?: string }> {
  const sb = await supabaseServerAuth();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "No autorizado" };

  const admin = supabaseAdmin();
  const { data: res, error: getErr } = await admin
    .from("reservas")
    .select("id, cliente_id, nota, sede_id, barbero_id")
    .eq("id", reservaId)
    .maybeSingle();

  if (getErr || !res) return { ok: false, error: "Reserva no encontrada" };

  let notaObj: any = {};
  try {
    notaObj = JSON.parse(res.nota || "{}");
  } catch {
    notaObj = { text: res.nota || "" };
  }

  const prop = notaObj.propuesta_adelanto;
  if (!prop || prop.estado !== "pendiente") {
    return { ok: false, error: "No hay ninguna propuesta de adelanto pendiente." };
  }

  if (respuesta === "aceptar") {
    const start = new Date(prop.inicio);
    const end = new Date(prop.fin);
    
    // Check if the slot is still free (avoid double bookings)
    const { data: clash } = await admin
      .from("reservas")
      .select("id")
      .eq("barbero_id", res.barbero_id)
      .not("estado", "in", "(cancelada,no_show)")
      .not("id", "eq", reservaId)
      .lt("inicio", end.toISOString())
      .gt("fin", start.toISOString())
      .limit(1);

    if (clash && clash.length > 0) {
      notaObj.propuesta_adelanto.estado = "vencido";
      await admin.from("reservas").update({ nota: JSON.stringify(notaObj) }).eq("id", reservaId);
      return { ok: false, error: "Lo sentimos, ese espacio ya fue tomado por otro cliente." };
    }

    notaObj.propuesta_adelanto.estado = "aceptada";
    const userNote = notaObj.text || "";
    
    const { error: updErr } = await admin
      .from("reservas")
      .update({
        inicio: start.toISOString(),
        fin: end.toISOString(),
        nota: userNote.trim() ? userNote.trim() : JSON.stringify(notaObj),
      })
      .eq("id", reservaId);

    if (updErr) return { ok: false, error: updErr.message };

  } else {
    // Rejected
    notaObj.propuesta_adelanto.estado = "rechazada";
    await admin
      .from("reservas")
      .update({
        nota: JSON.stringify(notaObj),
      })
      .eq("id", reservaId);
  }

  return { ok: true };
}

export async function savePushSubscription(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await ensureCliente();
  if (ctx.estado !== "cliente" || !ctx.clienteId) {
    return { ok: false, error: "No autorizado" };
  }

  const admin = supabaseAdmin();

  // Check if subscription already exists based on endpoint
  const { data: existing } = await admin
    .from("push_subscriptions")
    .select("id")
    .eq("endpoint", subscription.endpoint)
    .maybeSingle();

  if (existing) {
    return { ok: true }; // Already saved
  }

  const { error } = await admin.from("push_subscriptions").insert({
    cliente_ref: ctx.clienteId,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
  });

  if (error) {
    console.error("Error saving push subscription", error);
    return { ok: false, error: "Error al guardar suscripción" };
  }

  return { ok: true };
}

// Cancelar la propia cita (portal cliente). Verifica propiedad y ventana de 2h.
// El trigger trg_notificar_cola promueve al siguiente de la lista de espera al cancelar.
export async function cancelarReservaCliente(
  reservaId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await ensureCliente();
  if (ctx.estado !== "cliente" || !ctx.clienteId) return { ok: false, error: "No autorizado" };

  const admin = supabaseAdmin();
  const { data: res } = await admin
    .from("reservas")
    .select("id, cliente_ref, estado, inicio")
    .eq("id", reservaId)
    .maybeSingle();
  if (!res) return { ok: false, error: "Reserva no encontrada" };
  const r = res as { cliente_ref: string | null; estado: string; inicio: string };

  if (r.cliente_ref !== ctx.clienteId) return { ok: false, error: "Reserva no encontrada" };
  if (!["pendiente", "confirmada"].includes(r.estado))
    return { ok: false, error: "Esta cita ya no se puede cancelar." };

  const limite = Date.now() + CANCELACION_MIN_HORAS * 3600_000;
  if (new Date(r.inicio).getTime() <= limite)
    return {
      ok: false,
      error: `Las citas solo se cancelan hasta ${CANCELACION_MIN_HORAS} horas antes. Escribinos por WhatsApp para cancelar sobre la hora.`,
    };

  const { error } = await admin.from("reservas").update({ estado: "cancelada" }).eq("id", reservaId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/cuenta");
  return { ok: true };
}

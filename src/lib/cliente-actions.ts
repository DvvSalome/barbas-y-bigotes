"use server";

import { type SupabaseClient } from "@supabase/supabase-js";
import { supabaseServerAuth, supabaseAdmin } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { CANCELACION_MIN_HORAS } from "@/lib/slots";
import { errorPublico } from "@/lib/errors";
import { pushACliente } from "@/lib/push";
import { fechaHoraBogota } from "@/lib/format";

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
  // Ownership primero: esta action usa supabaseAdmin (bypassa RLS), así que sin
  // este check cualquier autenticado con un reservaId ajeno aceptaba/rechazaba.
  const ctx = await ensureCliente();
  if (ctx.estado !== "cliente" || !ctx.clienteId) return { ok: false, error: "No autorizado" };

  const admin = supabaseAdmin();
  const { data: res, error: getErr } = await admin
    .from("reservas")
    .select("id, cliente_ref, nota, sede_id, barbero_id")
    .eq("id", reservaId)
    .maybeSingle();

  if (getErr || !res) return { ok: false, error: "Reserva no encontrada" };
  if (res.cliente_ref !== ctx.clienteId) return { ok: false, error: "No autorizado" };

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

    if (updErr) return { ok: false, error: errorPublico("responderPropuestaAdelanto", updErr) };

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

  const { data: upd, error } = await admin
    .from("reservas")
    .update({ estado: "cancelada" })
    .eq("id", reservaId)
    .in("estado", ["pendiente", "confirmada"])
    .select("id");
  if (error) return { ok: false, error: errorPublico("cancelarReservaCliente", error) };
  if (!upd || upd.length === 0) return { ok: false, error: "Esta cita ya no se puede cancelar." };
  // Confirmación DESPUÉS del éxito, nunca bloqueante: pushACliente jamás lanza.
  await pushACliente(ctx.clienteId, {
    title: "Cita cancelada",
    body: `Tu cita fue cancelada (era el ${fechaHoraBogota(new Date(r.inicio))}).`,
    url: "/cuenta",
  });
  revalidatePath("/cuenta");
  revalidatePath("/barbero");
  return { ok: true };
}

// Calificar la atención de una visita ya completada (postventa). Mismo patrón de
// ownership que cancelarReservaCliente: la action usa supabaseAdmin (bypassa RLS),
// así que TODO se valida acá server-side (dueño, estado, score); no confiar en la UI.
// Rating gate: score alto → devuelve la URL de reseña de Google de LA sede que
// atendió; score bajo → null (feedback interno, no mandamos clientes molestos a Google).
export async function calificarServicio(input: {
  reservaId: string;
  score: number;
  comentario?: string;
}): Promise<{ ok: boolean; error?: string; googleReviewUrl?: string | null }> {
  const ctx = await ensureCliente();
  if (ctx.estado !== "cliente" || !ctx.clienteId) return { ok: false, error: "No autorizado" };

  const score = input.score;
  if (!Number.isInteger(score) || score < 1 || score > 5)
    return { ok: false, error: "La calificación va de 1 a 5 estrellas." };
  const comentario = (input.comentario ?? "").trim().slice(0, 500) || null;

  const admin = supabaseAdmin();
  const { data: res, error: getErr } = await admin
    .from("reservas")
    .select("id, cliente_ref, barbero_id, sede_id, estado")
    .eq("id", input.reservaId)
    .maybeSingle();
  if (getErr) return { ok: false, error: errorPublico("calificarServicio reserva", getErr) };
  if (!res) return { ok: false, error: "Reserva no encontrada" };
  const r = res as { cliente_ref: string | null; barbero_id: string | null; sede_id: string; estado: string };

  if (r.cliente_ref !== ctx.clienteId) return { ok: false, error: "Reserva no encontrada" };
  if (r.estado !== "completada")
    return { ok: false, error: "Solo se pueden calificar visitas ya completadas." };

  const { error: insErr } = await admin.from("resenas_servicio").insert({
    reserva_id: input.reservaId,
    cliente_ref: ctx.clienteId,
    barbero_id: r.barbero_id,
    sede_id: r.sede_id,
    score,
    comentario,
  });
  if (insErr) {
    // 23505 = unique(reserva_id): esta visita ya tiene calificación.
    if (insErr.code === "23505") return { ok: false, error: "Ya calificaste esta visita." };
    return { ok: false, error: errorPublico("calificarServicio", insErr) };
  }

  // Rating gate: solo con 4-5 estrellas se empuja a Google. La URL es de ESA sede
  // (cada sede tiene su ficha de Maps); nullable = botón apagado hasta configurarla.
  let googleReviewUrl: string | null = null;
  if (score >= 4) {
    const { data: sede, error: sedeErr } = await admin
      .from("sedes")
      .select("google_review_url")
      .eq("id", r.sede_id)
      .maybeSingle();
    if (sedeErr) errorPublico("calificarServicio sede", sedeErr);
    googleReviewUrl = (sede as { google_review_url?: string | null } | null)?.google_review_url ?? null;
  }

  revalidatePath("/cuenta");
  return { ok: true, googleReviewUrl };
}

// Reagendar la propia cita. Misma ventana de 2h que cancelar. Pre-chequea solape
// EXCLUYENDO la propia reserva; el constraint reservas_no_overlap es la red real.
export async function reagendarReservaCliente(
  reservaId: string,
  inicioISO: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await ensureCliente();
  if (ctx.estado !== "cliente" || !ctx.clienteId) return { ok: false, error: "No autorizado" };

  const admin = supabaseAdmin();
  const { data: res } = await admin
    .from("reservas")
    .select("id, cliente_ref, estado, inicio, barbero_id, servicio_id")
    .eq("id", reservaId)
    .maybeSingle();
  if (!res) return { ok: false, error: "Reserva no encontrada" };
  const r = res as {
    cliente_ref: string | null; estado: string; inicio: string;
    barbero_id: string | null; servicio_id: string | null;
  };

  if (r.cliente_ref !== ctx.clienteId) return { ok: false, error: "Reserva no encontrada" };
  if (!["pendiente", "confirmada"].includes(r.estado))
    return { ok: false, error: "Esta cita ya no se puede reagendar." };

  const limite = Date.now() + CANCELACION_MIN_HORAS * 3600_000;
  if (new Date(r.inicio).getTime() <= limite)
    return { ok: false, error: `Las citas solo se reagendan hasta ${CANCELACION_MIN_HORAS} horas antes. Escribinos por WhatsApp.` };

  const nuevoInicio = new Date(inicioISO);
  if (isNaN(nuevoInicio.getTime())) return { ok: false, error: "Horario inválido." };
  if (nuevoInicio.getTime() <= Date.now()) return { ok: false, error: "Elegí un horario futuro." };

  let dur = 30;
  if (r.servicio_id) {
    const { data: serv } = await admin.from("servicios").select("duracion_min").eq("id", r.servicio_id).maybeSingle();
    dur = (serv as { duracion_min?: number } | null)?.duracion_min ?? 30;
  }
  const nuevoFin = new Date(nuevoInicio.getTime() + dur * 60000);

  // Pre-chequeo de solape del barbero, excluyendo la propia reserva.
  if (r.barbero_id) {
    const { data: clash } = await admin
      .from("reservas")
      .select("id")
      .eq("barbero_id", r.barbero_id)
      .not("estado", "in", "(cancelada,no_show)")
      .not("id", "eq", reservaId)
      .lt("inicio", nuevoFin.toISOString())
      .gt("fin", nuevoInicio.toISOString())
      .limit(1);
    if (clash && clash.length) return { ok: false, error: "Ese horario ya fue tomado. Elegí otro, por favor." };
  }

  const { data: upd, error } = await admin
    .from("reservas")
    .update({ inicio: nuevoInicio.toISOString(), fin: nuevoFin.toISOString() })
    .eq("id", reservaId)
    .in("estado", ["pendiente", "confirmada"])
    .select("id");
  if (error) {
    if (error.code === "23P01") return { ok: false, error: "Ese horario ya fue tomado. Elegí otro, por favor." };
    return { ok: false, error: errorPublico("reagendarReservaCliente", error) };
  }
  if (!upd || upd.length === 0) return { ok: false, error: "Esta cita ya no se puede reagendar." };
  // Confirmación DESPUÉS del éxito, nunca bloqueante: pushACliente jamás lanza.
  await pushACliente(ctx.clienteId, {
    title: "Cita reagendada",
    body: `Tu cita cambió para ${fechaHoraBogota(nuevoInicio)}.`,
    url: "/cuenta",
  });
  revalidatePath("/cuenta");
  revalidatePath("/barbero");
  return { ok: true };
}

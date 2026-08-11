"use server";

import { type SupabaseClient } from "@supabase/supabase-js";
import { supabaseServerAuth, supabaseAdmin } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { CANCELACION_MIN_HORAS, slotEnVentana, bogotaYmd } from "@/lib/slots";
import { ventanaDeDia } from "@/lib/horario";
import { choqueAusencia } from "@/lib/ausencias";
import { errorPublico } from "@/lib/errors";
import { pushACliente, pushABarbero, pushASede } from "@/lib/push";
import { fechaHoraBogota } from "@/lib/format";

// Ventana de "deshacer" (minutos): desde la pantalla de confirmación del wizard,
// el cliente puede cancelar la reserva que ACABA de hacer si puso un dato mal.
const DESHACER_MIN = 60;

// Cancela una reserva recién creada usando su confirm_token como credencial
// (quien lo tiene acaba de reservar). Es un POST (server action), no un GET, así
// que un prefetch no la dispara. Acotada a lo recién creado para que no sea un
// atajo al límite de 2h del portal. Al pasar a 'cancelada', la vista
// v_confirmaciones_pendientes la excluye → el correo de confirmación no sale.
export async function cancelarReservaReciente(
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!/^[0-9a-fA-F-]{36}$/.test(token)) return { ok: false, error: "Enlace inválido." };
  const sb = supabaseAdmin();
  const { data: r } = await sb
    .from("reservas")
    .select("id, estado, creado_en")
    .eq("confirm_token", token)
    .maybeSingle();
  if (!r) return { ok: false, error: "No encontramos esa reserva." };
  const row = r as { id: string; estado: string; creado_en: string };
  if (row.estado === "cancelada") return { ok: true }; // idempotente
  if (row.estado !== "confirmada" && row.estado !== "pendiente")
    return { ok: false, error: "Esta cita ya no se puede deshacer acá. Escríbenos por WhatsApp." };
  if (Date.now() - new Date(row.creado_en).getTime() > DESHACER_MIN * 60_000)
    return { ok: false, error: "Para cancelar esta cita entra a Mi cuenta o escríbenos por WhatsApp." };
  const { error } = await sb.from("reservas").update({ estado: "cancelada" }).eq("id", row.id);
  if (error) return { ok: false, error: errorPublico("cancelarReservaReciente", error, "No se pudo cancelar. Intenta de nuevo.") };
  revalidatePath("/barbero");
  return { ok: true };
}

export type CuentaContext = {
  estado: "anon" | "staff" | "cliente";
  clienteId?: string;
  nombre?: string;
  /** Foto de la cuenta de Google (user_metadata.avatar_url/picture); null si no hay. */
  avatarUrl?: string | null;
};

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

  // Reservó como INVITADO y ahora entra con Google: su ficha ya existe con ese
  // correo (upsert_cliente dedup por correo, 0025). Sin este paso se creaba una
  // ficha nueva y sus citas de invitado quedaban huérfanas: no las veía en
  // /cuenta y la tarjeta de cortes se partía en dos.
  // Solo se reclama una ficha SIN dueño (auth_id null): una ya atada a otra
  // cuenta no se toca ni aunque comparta el correo.
  const mail = email.trim().toLowerCase();
  if (mail) {
    const { data: huerfana } = await admin
      .from("clientes")
      .select("id")
      .ilike("email", mail)
      .is("auth_id", null)
      .order("creado_en", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (huerfana) {
      const id = (huerfana as { id: string }).id;
      const { error } = await admin.from("clientes").update({ auth_id: userId }).eq("id", id).is("auth_id", null);
      if (!error) return id;
      // Carrera (otro request la reclamó primero): seguimos al insert de abajo.
    }
  }

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
  const avatarUrl = (meta.avatar_url as string) || (meta.picture as string) || null;
  const id = await clienteIdForUser(admin, user.id, email, nombre);
  return { estado: "cliente", clienteId: id ?? undefined, nombre, avatarUrl };
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

  let notaObj: { propuesta_adelanto?: { inicio: string; fin: string; estado: string }; [k: string]: unknown } = {};
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

    // La propuesta pudo VENCERSE por el paso del tiempo: proponerAdelanto valida
    // inicio>ahora al PROPONER, pero si el cliente la acepta cuando esa hora ya pasó,
    // la cita se movería al PASADO. Nada lo re-validaba al aceptar. Se marca vencida.
    if (start.getTime() <= Date.now()) {
      prop.estado = "vencido";
      await admin.from("reservas").update({ nota: JSON.stringify(notaObj) }).eq("id", reservaId);
      return { ok: false, error: "Esa hora ya pasó. Pídele al barbero que te proponga otra." };
    }

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
      prop.estado = "vencido";
      await admin.from("reservas").update({ nota: JSON.stringify(notaObj) }).eq("id", reservaId);
      return { ok: false, error: "Lo sentimos, ese espacio ya fue tomado por otro cliente." };
    }

    prop.estado = "aceptada";
    const userNote = typeof notaObj.text === "string" ? notaObj.text : "";
    
    const { error: updErr } = await admin
      .from("reservas")
      .update({
        inicio: start.toISOString(),
        fin: end.toISOString(),
        // La cita se mueve a un horario más temprano → resetear el recordatorio
        // para que la NUEVA fecha vuelva a la vista de recordatorios pendientes.
        reminder_sent: false,
        nota: userNote.trim() ? userNote.trim() : JSON.stringify(notaObj),
      })
      .eq("id", reservaId);

    if (updErr) {
      // Carrera: el slot se tomó entre el pre-chequeo y este update (el EXCLUDE
      // reservas_no_overlap es la garantía real). Mensaje claro, no error genérico.
      if (updErr.code === "23P01") return { ok: false, error: "Ese espacio ya fue tomado por otro cliente." };
      return { ok: false, error: errorPublico("responderPropuestaAdelanto", updErr) };
    }

  } else {
    // Rejected
    prop.estado = "rechazada";
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

  // Upsert por endpoint (unique push_sub_endpoint_unica, 0022): en un equipo
  // compartido el mismo endpoint del navegador puede quedar atado a otro cliente,
  // así que hay que RE-VINCULARLO al cliente logueado ahora (si no, el dueño
  // anterior seguiría recibiendo sus avisos en este dispositivo → fuga de datos).
  // El upsert reemplaza el select+branch y cierra la fuga incluso si hubiera
  // filas duplicadas del pasado (el dedup + unique de 0022 las colapsa a una).
  // barbero_id/sede_id en null EXPLICITO: la migracion 0047 agrego el CHECK
  // push_sub_dueno_unico (exactamente UN dueno). En un aparato compartido, si el
  // staff se suscribio antes en este mismo navegador, la fila tenia sede_id; sin
  // limpiarlos, el upsert por endpoint dejaba cliente_ref Y sede_id -> viola el
  // CHECK y el cliente NO podia activar sus avisos. guardarPushStaff ya hace esto.
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      cliente_ref: ctx.clienteId,
      barbero_id: null,
      sede_id: null,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    { onConflict: "endpoint" },
  );

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
    .select("id, cliente_ref, estado, inicio, barbero_id, sede_id")
    .eq("id", reservaId)
    .maybeSingle();
  if (!res) return { ok: false, error: "Reserva no encontrada" };
  const r = res as { cliente_ref: string | null; estado: string; inicio: string; barbero_id: string | null; sede_id: string };

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
  // Aviso al LOCAL: a la sede (el aparato del mostrador con login de sede, que es
  // el modelo del producto) y al barbero mientras siga su login. Mismo tag: un
  // aparato suscrito de las dos formas ve UN aviso, no dos. Antes solo iba al
  // barbero, asi que el mostrador de sede nunca se enteraba de una cancelacion.
  const avisoCaida = {
    title: "Se cayó una cita",
    body: `Quedó libre el turno de ${fechaHoraBogota(new Date(r.inicio))}.`,
    url: "/barbero",
    tag: "cita-cancelada",
  };
  await pushASede(r.sede_id, avisoCaida);
  if (r.barbero_id) await pushABarbero(r.barbero_id, avisoCaida);
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
    .select("id, cliente_ref, estado, inicio, barbero_id, servicio_id, sede_id")
    .eq("id", reservaId)
    .maybeSingle();
  if (!res) return { ok: false, error: "Reserva no encontrada" };
  const r = res as {
    cliente_ref: string | null; estado: string; inicio: string;
    barbero_id: string | null; servicio_id: string | null; sede_id: string;
  };

  if (r.cliente_ref !== ctx.clienteId) return { ok: false, error: "Reserva no encontrada" };
  if (!["pendiente", "confirmada"].includes(r.estado))
    return { ok: false, error: "Esta cita ya no se puede reagendar." };

  const limite = Date.now() + CANCELACION_MIN_HORAS * 3600_000;
  if (new Date(r.inicio).getTime() <= limite)
    return { ok: false, error: `Las citas solo se reagendan hasta ${CANCELACION_MIN_HORAS} horas antes. Escribinos por WhatsApp.` };

  const nuevoInicio = new Date(inicioISO);
  if (isNaN(nuevoInicio.getTime())) return { ok: false, error: "Horario inválido." };
  // Ventana de 2h también sobre la hora NUEVA (simétrica a la vieja): sin esto el
  // cliente podía mover la cita a 15 min vista y quedar en la puerta de un solo
  // sentido (ya no la puede cancelar online). Misma regla que cancelar/reagendar.
  if (nuevoInicio.getTime() <= Date.now() + CANCELACION_MIN_HORAS * 3600_000)
    return { ok: false, error: `Elige un horario con al menos ${CANCELACION_MIN_HORAS} horas de anticipación.` };

  let dur = 30;
  if (r.servicio_id) {
    const { data: serv } = await admin.from("servicios").select("duracion_min").eq("id", r.servicio_id).maybeSingle();
    dur = (serv as { duracion_min?: number } | null)?.duracion_min ?? 30;
  }
  const nuevoFin = new Date(nuevoInicio.getTime() + dur * 60000);
  const fechaYmd = bogotaYmd(nuevoInicio);

  // Guard de calendario/horario (F-001): reagendar nació como camino paralelo a
  // createReserva y NO copió estos guards, así que aceptaba domingos y horas fuera
  // de rango (madrugada). Se valida contra la ventana EFECTIVA de ese día
  // (horarioEfectivo: excepción de la fecha → base de la semana → respaldo 9-20),
  // el MISMO criterio que ve el cliente y que usa createReserva; ya no se re-derivan
  // OPEN/CLOSE ni el "¿es domingo?" acá.
  const ventana = await ventanaDeDia(admin, r.sede_id, fechaYmd);
  if (!ventana.abierta)
    return { ok: false, error: "Ese día la barbería no atiende. Elige otra fecha." };
  // Minuto-del-día en Bogotá (UTC-5 fijo): el instante viene en UTC, hay que anclar
  // a Bogotá para no correrse contra la ventana.
  const hm = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(nuevoInicio);
  const minDia =
    Number(hm.find((p) => p.type === "hour")?.value) * 60 +
    Number(hm.find((p) => p.type === "minute")?.value);
  if (!slotEnVentana(minDia, dur, ventana))
    return { ok: false, error: "Ese horario no está disponible. Elige uno dentro del horario de atención." };

  // Ausencia/bloqueo del barbero (día completo o rango de horas, 0054): esa
  // persona no atiende ese rato, aunque la sede sí abra.
  if (r.barbero_id) {
    const ausErr = await choqueAusencia(admin, r.barbero_id, nuevoInicio, nuevoFin);
    if (ausErr) return { ok: false, error: ausErr };
  }

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
    if (clash && clash.length) return { ok: false, error: "Ese horario ya fue tomado. Elige otro, por favor." };
  }

  const { data: upd, error } = await admin
    .from("reservas")
    // reminder_sent: false → la NUEVA fecha vuelve a entrar a la vista de
    // recordatorios (si ya se había mandado el de la fecha vieja, no se perdería).
    // confirmado_en a null: el cliente confirmó la hora VIEJA; para la nueva se le
    // vuelve a preguntar en el recordatorio. El mostrador no debe mostrar "confirmó"
    // sobre una hora que ya no es.
    .update({ inicio: nuevoInicio.toISOString(), fin: nuevoFin.toISOString(), reminder_sent: false, confirmado_en: null })
    .eq("id", reservaId)
    .in("estado", ["pendiente", "confirmada"])
    .select("id");
  if (error) {
    if (error.code === "23P01") return { ok: false, error: "Ese horario ya fue tomado. Elige otro, por favor." };
    return { ok: false, error: errorPublico("reagendarReservaCliente", error) };
  }
  if (!upd || upd.length === 0) return { ok: false, error: "Esta cita ya no se puede reagendar." };
  // Confirmación DESPUÉS del éxito, nunca bloqueante: pushACliente jamás lanza.
  await pushACliente(ctx.clienteId, {
    title: "Cita reagendada",
    body: `Tu cita cambió para ${fechaHoraBogota(nuevoInicio)}.`,
    url: "/cuenta",
  });
  // Al local le cambia la agenda del día en DOS momentos (el hueco viejo y el
  // nuevo): antes reagendar no avisaba a nadie del mostrador. Se avisa a la sede
  // y al barbero, mismo tag.
  const avisoMov = {
    title: "Una cita se movió",
    body: `Un cliente reagendó para ${fechaHoraBogota(nuevoInicio)}.`,
    url: "/barbero",
    tag: "cita-movida",
  };
  await pushASede(r.sede_id, avisoMov);
  if (r.barbero_id) await pushABarbero(r.barbero_id, avisoMov);
  revalidatePath("/cuenta");
  revalidatePath("/barbero");
  return { ok: true };
}

// Confirmación de asistencia desde el link del correo, SIN login (el token es la
// credencial). La usa la ruta pública /confirmar/[token]. Idempotente: confirmar
// dos veces no cambia nada. Es una señal para el mostrador, nunca cancela ni mueve
// la cita, así que si un antivirus de correo prefetchea el link no hay daño.
// Devuelve los datos para pintar la pantalla de "listo, te esperamos".
export type ConfirmarResultado =
  | { estado: "ok" | "ya"; fecha: string; sede: string; barbero: string | null; servicio: string | null }
  | { estado: "invalida" }
  | { estado: "cancelada" };

export async function confirmarCitaPorToken(token: string): Promise<ConfirmarResultado> {
  // Un UUID mal formado ni toca la base.
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { estado: "invalida" };

  const admin = supabaseAdmin();
  const { data } = await admin
    .from("reservas")
    .select("id,inicio,estado,confirmado_en,sede_id,servicios(nombre),barberos(nombre),sedes(nombre)")
    .eq("confirm_token", token)
    .maybeSingle();
  if (!data) return { estado: "invalida" };

  const r = data as {
    id: string;
    inicio: string;
    estado: string;
    confirmado_en: string | null;
    servicios: { nombre?: string } | null;
    barberos: { nombre?: string } | null;
    sedes: { nombre?: string } | null;
  };

  const detalle = {
    fecha: fechaHoraBogota(new Date(r.inicio)),
    sede: r.sedes?.nombre ?? "la barbería",
    barbero: r.barberos?.nombre ?? null,
    servicio: r.servicios?.nombre ?? null,
  };

  // Una cita cerrada no se "confirma": se le dice al cliente que ya no aplica.
  if (["cancelada", "no_show", "completada"].includes(r.estado)) return { estado: "cancelada" };
  if (r.confirmado_en) return { estado: "ya", ...detalle };

  const { error } = await admin
    .from("reservas")
    .update({ confirmado_en: new Date().toISOString() })
    .eq("id", r.id)
    .is("confirmado_en", null);
  if (error) return { estado: "invalida" };

  // OJO: NO llamar revalidatePath acá. Esta action se invoca DIRECTO en el render
  // del Server Component /confirmar/[token] (page.tsx), y Next prohíbe revalidatePath
  // durante el render → lanzaba y la 1ª visita daba HTTP 500 (el UPDATE ya había
  // ocurrido, por eso el dato persistía pero la pantalla reventaba). La agenda del
  // mostrador (/barbero) se refresca por realtime sobre reservas, no necesita esto.
  return { estado: "ok", ...detalle };
}

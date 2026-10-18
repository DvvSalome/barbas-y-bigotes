"use server";

import { type SupabaseClient } from "@supabase/supabase-js";
import { supabaseServerAuth, supabaseAdmin } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { CANCELACION_MIN_HORAS, slotEnVentana, bogotaYmd } from "@/lib/slots";
import { ventanaDeDia } from "@/lib/horario";
import { choqueAusencia } from "@/lib/ausencias";
import { errorPublico } from "@/lib/errors";
import { pushACliente, pushABarbero, pushASede, pushAAdmins, guardarSuscripcion } from "@/lib/push";
import { encolarAvisoDueno } from "@/lib/avisos-dueno";
import { fechaHoraBogota } from "@/lib/format";
import { getVisitaPorTokenDeResena } from "@/lib/data/queries";
import { headers } from "next/headers";
import { permitir } from "@/lib/rate-limit";
import {
  TOPE_RESENA,
  comoTexto,
  componerResena,
  etiquetaLabel,
  etiquetasValidas,
  faltaColumnaResena,
  limpiarExtra,
  soloRepiteLaNota,
} from "@/lib/resena-texto";
import { redactarConIA } from "@/lib/resena-ia";

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

  // Un aparato es de UN solo cliente (0022, y desde 0085 el índice parcial
  // push_sub_endpoint_cliente): en un equipo compartido el endpoint del navegador
  // pudo quedar atado a otro cliente, y hay que RE-VINCULARLO al logueado ahora
  // (si no, el anterior seguiría recibiendo sus avisos acá → fuga de datos).
  // guardarSuscripcion borra al otro cliente y guarda esta fila con los cuatro
  // dueños explícitos (el CHECK push_sub_dueno_unico pide exactamente uno), sin
  // tocar las filas del equipo que compartan el aparato (0085). También valida
  // endpoint y llaves: esto es un POST que cualquier cuenta de Google puede llamar.
  const res = await guardarSuscripcion(
    { tipo: "cliente", id: ctx.clienteId },
    { endpoint: subscription?.endpoint, p256dh: subscription?.keys?.p256dh, auth: subscription?.keys?.auth },
  );

  if (!res.ok) {
    console.error("Error saving push subscription", res.error);
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
      error: `Las citas solo se cancelan hasta ${CANCELACION_MIN_HORAS} horas antes. Escríbenos por WhatsApp para cancelar sobre la hora.`,
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
// Devuelve la URL de reseña de Google de LA sede que atendió, SEA CUAL SEA la nota.
// Antes solo se la daba a quien ponía 4-5 estrellas: eso es "review gating", lo
// prohíbe la política de Google y puede costar las reseñas de la ficha (ver 0035).
export async function calificarServicio(input: {
  reservaId: string;
  score: number;
  comentario?: string;
  /** Ids de los chips (resena-texto.ts); se validan acá contra el catálogo. */
  etiquetas?: string[];
  /** El comentario salió del texto que le armamos (aunque lo haya retocado). */
  textoGenerado?: boolean;
}): Promise<{ ok: boolean; error?: string; googleReviewUrl?: string | null }> {
  const ctx = await ensureCliente();
  if (ctx.estado !== "cliente" || !ctx.clienteId) return { ok: false, error: "No autorizado" };

  const score = input.score;
  if (!Number.isInteger(score) || score < 1 || score > 5)
    return { ok: false, error: "La calificación va de 1 a 5 estrellas." };
  // comoTexto: la action recibe lo que le manden (un arreglo no es comentario,
  // y `.trim()` sobre él reventaba con un 500).
  const comentario = comoTexto(input.comentario).trim().slice(0, TOPE_RESENA) || null;
  const reservaId = comoTexto(input.reservaId);

  const r = await reservaParaCalificar(reservaId, ctx.clienteId);
  if (!r.ok) return { ok: false, error: r.error };

  const etiquetas = etiquetasValidas(score, input.etiquetas, r.servicio);
  const insErr = await insertarResena(
    {
      reserva_id: reservaId,
      cliente_ref: ctx.clienteId,
      barbero_id: r.barberoId,
      sede_id: r.sedeId,
      score,
      comentario,
    },
    { etiquetas, texto_generado: Boolean(input.textoGenerado && comentario) },
  );
  if (insErr) {
    // 23505 = unique(reserva_id): esta visita ya tiene calificación.
    if (insErr.code === "23505") return { ok: false, error: "Ya calificaste esta visita." };
    return { ok: false, error: errorPublico("calificarServicio", insErr) };
  }

  // La URL es de ESA sede (cada sede tiene su ficha de Maps); nullable = botón
  // apagado hasta configurarla.
  const { data: sede, error: sedeErr } = await supabaseAdmin()
    .from("sedes")
    .select("google_review_url")
    .eq("id", r.sedeId)
    .maybeSingle();
  if (sedeErr) errorPublico("calificarServicio sede", sedeErr);
  const googleReviewUrl = (sede as { google_review_url?: string | null } | null)?.google_review_url || null;

  await avisarResenaBaja({
    score,
    comentario,
    etiquetas,
    textoGenerado: Boolean(input.textoGenerado && comentario),
    clienteRef: ctx.clienteId,
    barberoId: r.barberoId,
    sedeId: r.sedeId,
    servicio: r.servicio,
  });

  revalidatePath("/cuenta");
  return { ok: true, googleReviewUrl };
}

/**
 * La cita del cliente logueado que se va a calificar (o a redactar): suya,
 * completada y con el nombre del servicio (los chips dependen de él). Corre con
 * service role: el dueño se verifica acá, no en la UI.
 */
async function reservaParaCalificar(
  reservaId: string,
  clienteId: string,
): Promise<
  | { ok: true; barberoId: string | null; sedeId: string; servicio: string | null; inicio: string }
  | { ok: false; error: string }
> {
  if (!/^[0-9a-f-]{36}$/i.test(reservaId)) return { ok: false, error: "Reserva no encontrada" };
  const { data: res, error: getErr } = await supabaseAdmin()
    .from("reservas")
    .select("id, cliente_ref, barbero_id, sede_id, estado, inicio, servicios(nombre)")
    .eq("id", reservaId)
    .maybeSingle();
  if (getErr) return { ok: false, error: errorPublico("calificarServicio reserva", getErr) };
  if (!res) return { ok: false, error: "Reserva no encontrada" };
  const r = res as {
    cliente_ref: string | null;
    barbero_id: string | null;
    sede_id: string;
    estado: string;
    inicio: string;
    servicios: { nombre?: string } | null;
  };
  if (r.cliente_ref !== clienteId) return { ok: false, error: "Reserva no encontrada" };
  if (r.estado !== "completada") return { ok: false, error: "Solo se pueden calificar visitas ya completadas." };
  return { ok: true, barberoId: r.barbero_id, sedeId: r.sede_id, servicio: r.servicios?.nombre ?? null, inicio: r.inicio };
}

/**
 * Guarda la calificación. Con 0088 aplicada van también los chips y la marca de
 * texto armado; sin ella (deploy antes de la migración) se reintenta sin esas
 * columnas: el texto ya dice lo que marcó, así que el dueño no pierde nada.
 * Si el primer insert falló por la columna, no escribió nada: reintentar es seguro.
 */
async function insertarResena(
  fila: Record<string, unknown>,
  nuevas: { etiquetas: string[]; texto_generado: boolean },
): Promise<{ code?: string; message: string } | null> {
  const admin = supabaseAdmin();
  const { error } = await admin.from("resenas_servicio").insert({ ...fila, ...nuevas });
  if (!error) return null;
  if (!faltaColumnaResena(error)) return error;
  const { error: sinColumnas } = await admin.from("resenas_servicio").insert(fila);
  return sinColumnas ?? null;
}

/**
 * Una calificación de 3 o menos le avisa al DUEÑO al momento: push a sus aparatos
 * y correo a los suyos (alertas, 0084). Antes solo aparecía unos días en "Para
 * hacer", y nadie se enteraba si no entraba al panel. Nunca lanza: la
 * calificación ya quedó guardada.
 */
async function avisarResenaBaja(c: {
  score: number;
  comentario: string | null;
  /** Ids ya validados; al aviso van como texto ("Tuve que esperar"). */
  etiquetas?: string[];
  textoGenerado?: boolean;
  clienteRef: string | null;
  barberoId: string | null;
  sedeId: string;
  servicioId?: string | null;
  servicio?: string | null;
}): Promise<void> {
  if (c.score > 3) return;
  try {
    const admin = supabaseAdmin();
    const nombre = async (tabla: "clientes" | "barberos" | "sedes" | "servicios", id: string | null | undefined) => {
      if (!id) return null;
      const { data } = await admin.from(tabla).select("nombre").eq("id", id).maybeSingle();
      return (data as { nombre?: string } | null)?.nombre ?? null;
    };
    const [cliente, barbero, sede, servicioDeCita] = await Promise.all([
      nombre("clientes", c.clienteRef),
      nombre("barberos", c.barberoId),
      nombre("sedes", c.sedeId),
      c.servicio ? Promise.resolve(null) : nombre("servicios", c.servicioId),
    ]);
    const quien = cliente ?? "Un cliente";
    const conQuien = barbero ? ` con ${barbero}` : "";
    const etiquetas = (c.etiquetas ?? []).map(etiquetaLabel);
    // En el push manda lo que marcó (se lee de un vistazo en la pantalla
    // bloqueada); sin chips, el comentario. Entre «» solo lo que escribió él:
    // el texto que le armamos no se cita como palabras suyas, y si solo repite
    // la nota ("Mala experiencia.") no dice nada que las estrellas no digan.
    const armado = Boolean(c.textoGenerado);
    const detalle = etiquetas.length
      ? `: ${etiquetas.join(" · ")}`
      : c.comentario && !(armado && soloRepiteLaNota(c.score, c.comentario))
        ? armado
          ? `: ${c.comentario.slice(0, 90)}`
          : `: «${c.comentario.slice(0, 90)}»`
        : " · sin comentario";
    await pushAAdmins({
      title: `Calificación de ${c.score} de 5 ★`,
      body: `${quien}${conQuien}${detalle}`,
      url: c.clienteRef ? `/admin/clientes/${c.clienteRef}` : "/admin",
      tag: "resena-baja",
    });
    await encolarAvisoDueno("resena_baja", {
      score: c.score,
      comentario: c.comentario,
      // El correo (docs/emails/aviso-dueno.js) las muestra como chips; uno viejo
      // que no las conoce sigue mostrando solo el comentario.
      etiquetas,
      texto_generado: Boolean(c.textoGenerado),
      cliente: quien,
      barbero,
      sede: sede ?? c.sedeId,
      sede_id: c.sedeId,
      servicio: c.servicio ?? servicioDeCita,
      fecha: new Date().toISOString(),
    }, { clienteRef: c.clienteRef });
  } catch (e) {
    console.error("[avisarResenaBaja]", e);
  }
}

// La misma calificación, desde el enlace del correo de postventa (/calificar/[token]).
// Sin login: el token es la credencial (como /confirmar/[token]). Vale para ventas
// sin cita (walk-in), que /cuenta no podía calificar. Una sola por visita: el
// unique de venta_id y el de reserva_id (si vino de una cita) lo garantizan.
export async function calificarPorToken(input: {
  token: string;
  score: number;
  comentario?: string;
  etiquetas?: string[];
  textoGenerado?: boolean;
}): Promise<{ ok: boolean; error?: string; googleReviewUrl?: string | null }> {
  const score = input.score;
  if (!Number.isInteger(score) || score < 1 || score > 5)
    return { ok: false, error: "La calificación va de 1 a 5 estrellas." };
  const comentario = comoTexto(input.comentario).trim().slice(0, TOPE_RESENA) || null;

  const v = await getVisitaPorTokenDeResena(comoTexto(input.token));
  // cliente_ref es obligatorio en resenas_servicio; el correo solo sale a ventas con cliente.
  if (!v || !v.clienteRef) return { ok: false, error: "Este enlace no es válido." };
  if (v.vencida) return { ok: false, error: "Este enlace ya venció." };
  if (v.yaCalificada) return { ok: false, error: "Ya calificaste esta visita." };

  const etiquetas = etiquetasValidas(score, input.etiquetas, v.servicio);
  const textoGenerado = Boolean(input.textoGenerado && comentario);
  const error = await insertarResena(
    {
      venta_id: v.ventaId,
      reserva_id: v.reservaId,
      cliente_ref: v.clienteRef,
      barbero_id: v.barberoId,
      sede_id: v.sedeId,
      score,
      comentario,
    },
    { etiquetas, texto_generado: textoGenerado },
  );
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Ya calificaste esta visita." };
    return { ok: false, error: errorPublico("calificarPorToken", error) };
  }
  await avisarResenaBaja({
    score,
    comentario,
    etiquetas,
    textoGenerado,
    clienteRef: v.clienteRef,
    barberoId: v.barberoId,
    sedeId: v.sedeId,
    servicio: v.servicio,
  });
  return { ok: true, googleReviewUrl: v.googleReviewUrl };
}

/**
 * "Tu reseña": el texto ya escrito con lo que el cliente marcó, para que lo
 * revise, lo cambie si quiere y lo envíe (y, si le provoca, lo pegue en Google).
 * NO guarda nada: guardar es calificarPorToken / calificarServicio.
 *
 * Misma credencial que guardar: el token del correo (sin login) o la cita del
 * cliente logueado en /cuenta. Con NVIDIA_API_KEY lo redacta la IA (resena-ia.ts); sin
 * llave, con la IA caída, lenta (>6 s) o con el freno puesto, sale la plantilla
 * de resena-texto.ts. Las dos siguen las mismas reglas (sin inventar, sin
 * nombrar al barbero) y el cliente no ve la diferencia.
 *
 * Freno (es un proxy a un LLM, quema plata): 6 redacciones por visita al día,
 * más un tope por IP y uno global por instancia. Pasado el freno no hay error:
 * sale la plantilla, que no cuesta nada.
 *
 * Todo lo que entra se trata como `unknown`: una server action es un POST que
 * cualquiera arma a mano, y un arreglo en `anterior` se saltaba el tope de 500
 * (pasaba como 500 elementos de cualquier largo) y le mandaba megas a Claude.
 */
export async function redactarResena(input: {
  token?: string;
  reservaId?: string;
  score: number;
  etiquetas?: string[];
  extra?: string;
  /** 0 la primera vez; "Otra versión" suma 1. */
  version?: number;
  /** El último texto que le ARMAMOS (no lo que tenga en el cuadro): la nueva versión no puede repetirlo. */
  anterior?: string;
}): Promise<{ ok: boolean; texto?: string; error?: string }> {
  const score = input.score;
  if (!Number.isInteger(score) || score < 1 || score > 5)
    return { ok: false, error: "La calificación va de 1 a 5 estrellas." };
  const token = comoTexto(input.token);

  // La misma validación que guardar: si no podría calificar, tampoco redacta.
  let visita: string;
  let servicio: string | null;
  // Sin IA aunque haya cupo (la plantilla igual le sirve al cliente).
  let soloPlantilla = false;
  if (token) {
    const v = await getVisitaPorTokenDeResena(token);
    if (!v || !v.clienteRef) return { ok: false, error: "Este enlace no es válido." };
    if (v.vencida) return { ok: false, error: "Este enlace ya venció." };
    if (v.yaCalificada) return { ok: false, error: "Ya calificaste esta visita." };
    visita = v.ventaId;
    servicio = v.servicio;
  } else {
    const ctx = await ensureCliente();
    if (ctx.estado !== "cliente" || !ctx.clienteId) return { ok: false, error: "No autorizado" };
    const reservaId = comoTexto(input.reservaId);
    const r = await reservaParaCalificar(reservaId, ctx.clienteId);
    if (!r.ok) return { ok: false, error: r.error };
    // Lo mismo que mira el enlace del correo: ya calificada no redacta (si no,
    // cada cita vieja del historial abría su propio cupo de 6 redacciones al
    // día), y la IA solo para la ventana de 30 días que /cuenta ofrece calificar.
    const { count, error: califErr } = await supabaseAdmin()
      .from("resenas_servicio")
      .select("id", { count: "exact", head: true })
      .eq("reserva_id", reservaId);
    if (!califErr && (count ?? 0) > 0) return { ok: false, error: "Ya calificaste esta visita." };
    soloPlantilla = Boolean(califErr) || !(Date.now() - Date.parse(r.inicio) <= 30 * 86_400_000);
    visita = reservaId;
    servicio = r.servicio;
  }

  const etiquetas = etiquetasValidas(score, input.etiquetas, servicio);
  const extra = limpiarExtra(input.extra);
  const version = Math.max(0, Math.min(50, Math.floor(Number(input.version) || 0)));
  const anterior = comoTexto(input.anterior).slice(0, TOPE_RESENA) || null;
  // La semilla es la credencial que ya tiene el cliente (token o cita): la
  // plantilla le sale igual que la que arma su navegador sin IA.
  const semilla = token || visita;
  const plantilla = () => componerResena({ score, etiquetas, extra, semilla, version, evitar: anterior });
  if (soloPlantilla) return { ok: true, texto: plantilla() };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "sin-ip";
  const conCupo =
    permitir(`resena-ia:${visita}`, { porMinuto: 3, porHora: 6, porDia: 6 }) &&
    permitir(`resena-ia-ip:${ip}`, { porMinuto: 6, porHora: 20 }) &&
    permitir("resena-ia:global", { porMinuto: 30, porHora: 300 });
  if (!conCupo) return { ok: true, texto: plantilla() };

  const ia = await redactarConIA({ score, etiquetas, extra, servicio, version, anterior });
  // Si la IA devolvió lo mismo que ya vio, mejor una plantilla distinta.
  return { ok: true, texto: ia && ia !== anterior ? ia : plantilla() };
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
    return { ok: false, error: `Las citas solo se reagendan hasta ${CANCELACION_MIN_HORAS} horas antes. Escríbenos por WhatsApp.` };

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

// Eliminación de cuenta (Google Play la exige para toda app con inicio de sesión;
// es además el derecho de supresión de la Ley 1581). La regla vive en la base
// (eliminar_cuenta_cliente, 0072): anonimiza la ficha, cancela las citas futuras,
// borra notas/push/lista de espera; las ventas quedan sin nombre (obligación
// contable). Después se borra el usuario de Auth: eso es lo que cierra el acceso
// con Google. Solo el propio usuario, y nunca una cuenta del equipo.
export type EliminarCuentaResultado = { ok: true; citasCanceladas: number } | { ok: false; error: string };

export async function eliminarMiCuenta(): Promise<EliminarCuentaResultado> {
  const sb = await supabaseServerAuth();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Tienes que entrar con tu cuenta para eliminarla." };
  const admin = supabaseAdmin();
  const { data: prof } = await admin.from("profiles").select("rol").eq("auth_id", user.id).maybeSingle();
  if (prof && (prof as { rol: string }).rol !== "cliente") {
    return { ok: false, error: "Las cuentas del equipo las administra el dueño desde el panel." };
  }
  const { data, error } = await admin.rpc("eliminar_cuenta_cliente", { p_auth_id: user.id });
  if (error) return { ok: false, error: errorPublico("eliminarMiCuenta", error) };
  const fila = (Array.isArray(data) ? data[0] : data) as { citas_canceladas: number } | null | undefined;
  const { error: errAuth } = await admin.auth.admin.deleteUser(user.id);
  if (errAuth) {
    console.error("eliminarMiCuenta: auth.deleteUser", errAuth.message);
    return {
      ok: false,
      error: "Borramos tus datos, pero no pudimos cerrar el acceso con Google. Escríbenos a reservas@barbasybigotes.com y lo terminamos a mano.",
    };
  }
  return { ok: true, citasCanceladas: Number(fila?.citas_canceladas ?? 0) };
}

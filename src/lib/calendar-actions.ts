"use server";

import { revalidatePath } from "next/cache";
import { supabaseServerAuth, supabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, type ActionResult } from "@/lib/actions";
import { esEmailEnviable } from "@/lib/email";
import { calendarConfigurado, compartirCalendario, descompartirCalendario } from "@/lib/google-calendar";
import { errorPublico } from "@/lib/errors";
import { calendarioDeBarbero, encolarFuturas, sincronizarCalendar, quitarAccesoAgenda } from "@/lib/calendar-sync";

// Acciones del admin para Google Calendar (0073). Solo el dueño; todo con el
// service role después del gate, porque las tablas de calendario son deny-all.

async function gate(): Promise<string | null> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return denied;
  if (!calendarConfigurado()) return "Falta la credencial de Google (GOOGLE_CALENDAR_SA_JSON) en el servidor.";
  return null;
}

/** Crea la agenda de cada barbero activo (sin compartirla aún) y encola sus citas futuras. */
export async function prepararCalendarios(): Promise<ActionResult> {
  const denied = await gate();
  if (denied) return { ok: false, error: denied };
  const admin = supabaseAdmin();
  const { data: barberos, error } = await admin.from("barberos").select("id,nombre").eq("activo", true).order("nombre");
  if (error) return { ok: false, error: "No se pudieron leer los barberos." };
  let creadas = 0;
  const fallas: string[] = [];
  for (const b of (barberos ?? []) as { id: string; nombre: string }[]) {
    try {
      const { data: ya } = await admin.from("barbero_calendar").select("calendar_id").eq("barbero_id", b.id).maybeSingle();
      if (!ya) creadas++;
      await calendarioDeBarbero(admin, b.id, b.nombre);
    } catch (e) {
      fallas.push(`${b.nombre}: ${(e as Error).message}`);
    }
  }
  const encoladas = await encolarFuturas(admin);
  const sync = await sincronizarCalendar(12);
  revalidatePath("/admin/equipo");
  if (fallas.length) return { ok: false, error: `Agendas creadas: ${creadas}. Falló: ${fallas.join(" · ")}` };
  return {
    ok: true,
    aviso: `Agendas listas (${creadas} nuevas). Citas futuras encoladas: ${encoladas}; sincronizadas ahora: ${sync.procesados}${sync.errores ? `, con ${sync.errores} errores` : ""}. El resto sale solo en minutos.`,
  };
}

/** Si el correo de avisos cambió, el viejo deja de ver la agenda (best-effort: el nuevo es lo que importa). */
async function soltarCorreoViejo(calendarId: string, viejo: string | null, nuevo: string) {
  if (!viejo || viejo.toLowerCase() === nuevo.toLowerCase()) return;
  await descompartirCalendario(calendarId, viejo).catch((e: Error) => errorPublico("soltarCorreoViejo", { message: e.message }));
}

/** Comparte la agenda de cada barbero ACTIVO con su correo de avisos (Equipo → Correo de avisos). */
export async function compartirAgendasConBarberos(): Promise<ActionResult> {
  const denied = await gate();
  if (denied) return { ok: false, error: denied };
  const admin = supabaseAdmin();
  const [{ data: agendas }, { data: contactos }, { data: barberos, error: bErr }] = await Promise.all([
    admin.from("barbero_calendar").select("barbero_id,calendar_id,compartido_con"),
    admin.from("barbero_contacto").select("barbero_id,email"),
    // Solo los que trabajan aquí: la agenda de uno dado de baja (0087) tiene el
    // nombre y el teléfono de sus clientes y NO se le vuelve a compartir.
    admin.from("barberos").select("id,nombre").eq("activo", true),
  ]);
  if (bErr) return { ok: false, error: "No se pudieron leer los barberos. Intenta de nuevo." };
  const nombre = Object.fromEntries(((barberos ?? []) as { id: string; nombre: string }[]).map((b) => [b.id, b.nombre]));
  const correo = Object.fromEntries(((contactos ?? []) as { barbero_id: string; email: string }[]).map((c) => [c.barbero_id, c.email]));
  let compartidas = 0;
  const sinCorreo: string[] = [];
  const fallas: string[] = [];
  for (const a of (agendas ?? []) as { barbero_id: string; calendar_id: string; compartido_con: string | null }[]) {
    if (!nombre[a.barbero_id]) continue; // ya no trabaja aquí
    const email = correo[a.barbero_id];
    if (!email) {
      sinCorreo.push(nombre[a.barbero_id]);
      continue;
    }
    if (a.compartido_con === email) continue; // ya estaba
    try {
      await compartirCalendario(a.calendar_id, email, "reader");
      await soltarCorreoViejo(a.calendar_id, a.compartido_con, email);
      await admin
        .from("barbero_calendar")
        .update({ compartido_con: email, actualizado_en: new Date().toISOString() })
        .eq("barbero_id", a.barbero_id);
      compartidas++;
    } catch (e) {
      errorPublico("compartirAgendasConBarberos", { message: (e as Error).message });
      fallas.push(nombre[a.barbero_id]);
    }
  }
  revalidatePath("/admin/equipo");
  const partes = [`Compartidas ahora: ${compartidas}.`];
  if (sinCorreo.length) partes.push(`Sin correo cargado: ${sinCorreo.join(", ")}.`);
  if (fallas.length)
    return { ok: false, error: `${partes.join(" ")} Google no dejó compartir la de ${fallas.join(", ")}: intenta en un rato y, si sigue, avísale a soporte.` };
  return { ok: true, aviso: `${partes.join(" ")} A cada barbero le llega un correo de Google para aceptar la agenda.` };
}

/**
 * La agenda de UN barbero, desde su ficha: la crea si no existe y se la comparte
 * a su correo de avisos. Es lo mismo que los dos botones de "El local → Google
 * Calendar", pero para el que acaba de llegar, sin tocar a los demás.
 */
export async function compartirAgendaDeBarbero(barberoId: string): Promise<ActionResult> {
  const denied = await gate();
  if (denied) return { ok: false, error: denied };
  const admin = supabaseAdmin();
  const [{ data: b }, { data: c }] = await Promise.all([
    admin.from("barberos").select("id,nombre,activo").eq("id", barberoId).maybeSingle(),
    admin.from("barbero_contacto").select("email").eq("barbero_id", barberoId).maybeSingle(),
  ]);
  const barbero = b as { id: string; nombre: string; activo: boolean } | null;
  if (!barbero || !barbero.activo) return { ok: false, error: "Ese barbero no existe o ya no trabaja aquí." };
  const email = (c as { email?: string } | null)?.email ?? "";
  if (!email) return { ok: false, error: "Primero pon su correo de avisos: la agenda se le comparte a ese correo." };
  try {
    const calendarId = await calendarioDeBarbero(admin, barbero.id, barbero.nombre);
    const { data: fila } = await admin.from("barbero_calendar").select("compartido_con").eq("barbero_id", barbero.id).maybeSingle();
    const antes = (fila as { compartido_con?: string | null } | null)?.compartido_con ?? null;
    if (antes !== email) {
      await compartirCalendario(calendarId, email, "reader");
      await soltarCorreoViejo(calendarId, antes, email);
      await admin
        .from("barbero_calendar")
        .update({ compartido_con: email, actualizado_en: new Date().toISOString() })
        .eq("barbero_id", barbero.id);
    }
  } catch (e) {
    errorPublico("compartirAgendaDeBarbero", { message: (e as Error).message });
    return { ok: false, error: "Google no dejó compartir la agenda. Intenta en un rato y, si sigue, avísale a soporte." };
  }
  // Sus citas futuras que todavía no estén en la agenda, a la cola.
  await encolarFuturas(admin);
  revalidatePath("/admin/equipo");
  revalidatePath("/admin");
  return { ok: true, aviso: `Listo: le llega un correo de Google a ${email} para aceptar la agenda.` };
}

/**
 * Reintento de la baja: le quita el acceso a su agenda a un barbero que YA no
 * trabaja aquí (si Google falló en el momento de darlo de baja). Para un barbero
 * activo no se usa: a él se le comparte, no se le quita.
 */
export async function quitarAgendaDeExBarbero(barberoId: string): Promise<ActionResult> {
  const denied = await gate();
  if (denied) return { ok: false, error: denied };
  const admin = supabaseAdmin();
  const { data: b } = await admin.from("barberos").select("activo").eq("id", barberoId).maybeSingle();
  if (!b) return { ok: false, error: "Ese barbero no existe." };
  if ((b as { activo: boolean }).activo) return { ok: false, error: "Sigue trabajando aquí: su agenda se le deja." };
  try {
    const quitados = await quitarAccesoAgenda(admin, barberoId);
    revalidatePath("/admin/equipo");
    revalidatePath("/admin");
    return { ok: true, aviso: quitados.length ? `Listo: ${quitados.join(", ")} ya no ve la agenda.` : "Ya no tenía acceso a la agenda." };
  } catch (e) {
    errorPublico("quitarAgendaDeExBarbero", { message: (e as Error).message });
    return { ok: false, error: "Google no dejó quitarle la agenda. Intenta en un rato y, si sigue, avísale a soporte." };
  }
}

/** Un correo que ve TODAS las agendas (el dueño). Se aplica a las existentes y a las que se creen después. */
export async function compartirAgendasCon(email: string): Promise<ActionResult> {
  const denied = await gate();
  if (denied) return { ok: false, error: denied };
  const limpio = (email ?? "").trim().toLowerCase();
  if (!esEmailEnviable(limpio)) return { ok: false, error: "Ese correo no parece real. Tiene que ser una cuenta de Google." };
  const admin = supabaseAdmin();
  const { error } = await admin.from("calendar_compartidos").upsert({ email: limpio, rol: "reader" });
  if (error) return { ok: false, error: "No se pudo guardar el correo." };
  const { data: agendas } = await admin.from("barbero_calendar").select("calendar_id");
  const fallas: string[] = [];
  for (const a of (agendas ?? []) as { calendar_id: string }[]) {
    await compartirCalendario(a.calendar_id, limpio, "reader").catch((e: Error) => fallas.push(e.message));
  }
  revalidatePath("/admin/equipo");
  if (fallas.length) return { ok: false, error: `Guardado, pero Google rechazó ${fallas.length} agenda(s): ${fallas[0]}` };
  return { ok: true, aviso: `Listo: ${limpio} ve las ${(agendas ?? []).length} agendas. Le llega un correo de Google por cada una.` };
}

export async function quitarCompartido(email: string): Promise<ActionResult> {
  const denied = await gate();
  if (denied) return { ok: false, error: denied };
  // Solo se deja de aplicar a agendas NUEVAS: quitar el acceso ya dado se hace en
  // Google Calendar (compartir → quitar). Se avisa en la respuesta.
  const { error } = await supabaseAdmin().from("calendar_compartidos").delete().eq("email", email.trim().toLowerCase());
  if (error) return { ok: false, error: "No se pudo quitar." };
  revalidatePath("/admin/equipo");
  return { ok: true, aviso: "Quitado de la lista. El acceso a las agendas ya compartidas se retira desde Google Calendar." };
}

export async function sincronizarCalendarAhora(): Promise<ActionResult> {
  const denied = await gate();
  if (denied) return { ok: false, error: denied };
  const admin = supabaseAdmin();
  const encoladas = await encolarFuturas(admin);
  const r = await sincronizarCalendar(15);
  revalidatePath("/admin/equipo");
  const texto = `Encoladas: ${encoladas}. Sincronizadas: ${r.procesados}. Omitidas (sin barbero): ${r.omitidos}.`;
  if (r.errores) return { ok: false, error: `${texto} Errores: ${r.detalle.join(" · ")}` };
  return { ok: true, aviso: texto };
}

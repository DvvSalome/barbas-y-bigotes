"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServerAuth, supabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin, actualizarReserva, type ActionResult } from "@/lib/actions";
import { getResumenBaja, type ResumenBaja } from "@/lib/data/queries";
import { setearPinSede } from "@/lib/barbero-auth";
import { errorPublico } from "@/lib/errors";
import { faltaTabla } from "@/lib/avisos-reglas";
import { extDeMime, pareceImagen, variantesObsoletas, sanearNombre, nombreRepetido, normNombre } from "@/lib/admin-reglas";
import {
  validarNuevoBarbero,
  candidatosCorreoInterno,
  esPinValido,
  ERROR_PIN,
  BAN_DE_BAJA,
  motivoParaNoDarDeBaja,
  avisoAClientes,
  mensajeHomonimo,
  sanearOrden,
  reordenar,
  type NuevoBarberoEntrada,
  type CampoAlta,
} from "@/lib/equipo-reglas";
import { quitarAccesoAgenda } from "@/lib/calendar-sync";
import { bogotaYmd, MON } from "@/lib/slots";
import { esEmailEnviable } from "@/lib/email";

/*
  ALTA, FICHA, BAJA Y REACTIVACIÓN DE UN BARBERO (pedido del dueño, 14-oct:
  "que todo sea autogestionable, por si más adelante tienen otros barberos").

  Hasta acá, que un barbero existiera exigía SQL (fila en barberos + usuario de
  Auth + perfil + PIN) y que se fuera le dejaba el acceso abierto. Todo esto es
  del dueño: requireAdmin primero y DESPUÉS service role, porque las tablas que lo
  saben (barbero_pin, barbero_contacto, push_subscriptions, Auth) están cerradas.

  Correo: NADA de acá le manda un correo a nadie. El usuario de Auth se crea con
  email_confirm (Supabase no manda confirmación) y con un correo INTERNO que no es
  un buzón (equipo-reglas.ts). El barbero entra con su PIN: generateLink +
  verifyOtp en barbero-auth.ts, que tampoco manda nada.
*/

// ---------- Utilidades internas (no exportadas: un "use server" solo exporta actions) ----------

async function gateAdmin(): Promise<string | null> {
  return requireAdmin(await supabaseServerAuth());
}

/** Todo lo que muestra barberos: la web pública, la reserva, el login del staff y el panel. */
function revalidarEquipo() {
  for (const p of [
    "/",
    "/barberos",
    "/nosotros",
    "/reservar",
    "/login",
    "/barbero",
    "/admin",
    "/admin/equipo",
    "/admin/comisiones",
    "/admin/liquidacion",
    "/admin/agenda",
    "/admin/cuadre",
  ]) {
    revalidatePath(p);
  }
}

const primerNombre = (n: string) => n.trim().split(/\s+/)[0] ?? n;

function correoTomado(error: { code?: string; message?: string } | null | undefined): boolean {
  return (
    error?.code === "email_exists" ||
    error?.code === "user_already_exists" ||
    /already (been )?registered|already exists/i.test(error?.message ?? "")
  );
}

async function borrarUsuario(admin: SupabaseClient, authId: string) {
  const { error } = await admin.auth.admin.deleteUser(authId);
  if (error) errorPublico("equipo borrarUsuario", error);
}

/**
 * Crea el usuario de Auth con un correo INTERNO libre (kevin@, kevin.valencia@,
 * kevin2@…) y una contraseña que nadie conoce: con ella no se entra nunca, se
 * entra con el PIN. email_confirm: true = Supabase no manda ningún correo.
 */
async function crearUsuarioInterno(
  admin: SupabaseClient,
  nombre: string,
): Promise<{ ok: true; authId: string } | { ok: false; error: string }> {
  for (const email of candidatosCorreoInterno(nombre)) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: randomBytes(32).toString("base64url"),
      email_confirm: true,
      user_metadata: { nombre, cuenta: "barbero" },
    });
    if (!error && data.user) return { ok: true, authId: data.user.id };
    if (correoTomado(error)) continue; // ese nombre interno ya es de otro: el siguiente
    return { ok: false, error: errorPublico("crearUsuarioInterno", error, "No se pudo crear su acceso. Intenta de nuevo.") };
  }
  return { ok: false, error: "No quedó un nombre de acceso libre para ese barbero. Escribe su nombre completo y vuelve a intentar." };
}

/**
 * Deja al barbero con perfil + usuario de Auth (lo que loginBarberoPin busca).
 * Si ya lo tiene, no toca nada. Si el perfil apunta a un usuario que ya no
 * existe, le crea uno nuevo. Si algo falla a mitad, no deja un usuario suelto.
 */
async function asegurarAcceso(
  admin: SupabaseClient,
  barberoId: string,
  nombre: string,
): Promise<{ ok: true; authId: string; creado: boolean } | { ok: false; error: string }> {
  const { data: prof, error: pErr } = await admin
    .from("profiles")
    .select("id,auth_id")
    .eq("barbero_id", barberoId)
    .eq("rol", "barbero")
    .maybeSingle();
  if (pErr) return { ok: false, error: errorPublico("asegurarAcceso perfil", pErr, "No se pudo revisar su acceso. Intenta de nuevo.") };
  const fila = prof as { id: string; auth_id: string | null } | null;

  if (fila?.auth_id) {
    const { data: u, error } = await admin.auth.admin.getUserById(fila.auth_id);
    if (!error && u.user) return { ok: true, authId: fila.auth_id, creado: false };
    if (error && error.status !== 404)
      return { ok: false, error: errorPublico("asegurarAcceso usuario", error, "No se pudo revisar su acceso. Intenta de nuevo.") };
    // El perfil apunta a un usuario que ya no existe: se le crea otro abajo.
  }

  const nuevo = await crearUsuarioInterno(admin, nombre);
  if (!nuevo.ok) return nuevo;
  // email null en el perfil a propósito: nada en la app debe tener a mano una
  // dirección que no es un buzón (ver src/lib/email.ts, las tres suspensiones).
  const { error: escErr } = fila
    ? await admin.from("profiles").update({ auth_id: nuevo.authId, nombre }).eq("id", fila.id)
    : await admin.from("profiles").insert({ auth_id: nuevo.authId, rol: "barbero", barbero_id: barberoId, nombre, email: null });
  if (escErr) {
    await borrarUsuario(admin, nuevo.authId);
    // 23505 = otro "Crear acceso" ganó la carrera (índice único de 0087): ese
    // acceso ya existe y sirve; el usuario que sobraba ya se borró arriba.
    if (escErr.code === "23505") {
      const { data: otro } = await admin.from("profiles").select("auth_id").eq("barbero_id", barberoId).eq("rol", "barbero").maybeSingle();
      const authId = (otro as { auth_id?: string | null } | null)?.auth_id;
      if (authId) return { ok: true, authId, creado: false };
    }
    return { ok: false, error: errorPublico("asegurarAcceso escribir perfil", escErr, "No se pudo crear su acceso. Intenta de nuevo.") };
  }
  return { ok: true, authId: nuevo.authId, creado: true };
}

async function sedesActivas(admin: SupabaseClient): Promise<{ id: string; nombre: string }[]> {
  const { data } = await admin.from("sedes").select("id,nombre").eq("activa", true).order("nombre");
  return (data ?? []) as { id: string; nombre: string }[];
}

// ---------- Alta ----------

export type ResultadoAlta = ActionResult & {
  campo?: CampoAlta;
  /** Hay un dado de baja con ese nombre: el dueño dice si es él o es otra persona. */
  homonimo?: boolean;
};

/**
 * "Agregar barbero": crea, EN ESTE ORDEN, la ficha (todavía APAGADA), su usuario
 * de Auth, su perfil de barbero, su PIN, su correo de avisos (si vino) y recién al
 * final la prende. Si un paso falla se deshace lo creado: no quedan fichas a
 * medias, y mientras se arma no sale en la web (nadie le puede reservar a alguien
 * que todavía no puede entrar, y una reserva en ese lapso impedía deshacer).
 * La foto se sube después, desde la misma hoja, con subirFotoBarbero.
 */
export async function crearBarbero(input: NuevoBarberoEntrada & { otraPersona?: boolean }): Promise<ResultadoAlta> {
  const denied = await gateAdmin();
  if (denied) return { ok: false, error: denied };
  const admin = supabaseAdmin();

  const sedes = await sedesActivas(admin);
  const v = validarNuevoBarbero(input, sedes.map((s) => s.id));
  if (!v.ok) return { ok: false, error: v.error, campo: v.campo };
  const n = v.valor;

  // Nombre repetido: en la web el cliente no distinguiría a dos "Kevin" de la misma sede.
  const { data: todos, error: lErr } = await admin.from("barberos").select("id,nombre,sede_id,activo,orden");
  if (lErr) return { ok: false, error: errorPublico("crearBarbero leer", lErr) };
  const lista = (todos ?? []) as { id: string; nombre: string; sede_id: string; activo: boolean; orden: number | null }[];
  // Un dado de baja con el mismo nombre: puede ser él que vuelve o un homónimo.
  // No se decide por el dueño: se le pregunta, y "Es otra persona" sigue.
  const yaSeFue = lista.find((b) => !b.activo && normNombre(b.nombre) === normNombre(n.nombre));
  if (yaSeFue && !input.otraPersona) return { ok: false, campo: "nombre", homonimo: true, error: mensajeHomonimo(yaSeFue.nombre) };
  if (nombreRepetido(n.nombre, lista.filter((b) => b.activo && b.sede_id === n.sedeId)))
    return { ok: false, campo: "nombre", error: "Ya hay un barbero con ese nombre en esa sede. Agrégale el apellido para distinguirlos." };

  // Al final de su sede en la web (después se puede mover desde su ficha).
  const orden = Math.max(0, ...lista.filter((b) => b.sede_id === n.sedeId).map((b) => b.orden ?? 0)) + 1;

  // 1) La ficha, APAGADA: no sale en la web hasta el último paso.
  const { data: fila, error: insErr } = await admin
    .from("barberos")
    .insert({ nombre: n.nombre, sede_id: n.sedeId, activo: false, destacado: false, orden, ...n.contrato })
    .select("id")
    .single();
  if (insErr || !fila) return { ok: false, error: errorPublico("crearBarbero ficha", insErr, "No se pudo crear la ficha. Intenta de nuevo.") };
  const barberoId = (fila as { id: string }).id;

  // Deshacer en orden inverso. El perfil va antes que la ficha: al borrar la ficha,
  // profiles.barbero_id quedaría en null y el CHECK de rol lo rechazaría. Devuelve
  // el error para el dueño: si algo no se pudo borrar, se le dice la verdad en vez
  // de "no se creó nada".
  const deshacer = async (motivo: string, authId?: string): Promise<ResultadoAlta> => {
    let quedo = false;
    if (authId) {
      const { error } = await admin.from("profiles").delete().eq("auth_id", authId);
      if (error) errorPublico("crearBarbero deshacer perfil", error);
      await borrarUsuario(admin, authId);
    }
    const { error } = await admin.from("barberos").delete().eq("id", barberoId);
    if (error) {
      errorPublico("crearBarbero deshacer ficha", error);
      quedo = true;
    }
    if (!quedo) return { ok: false, error: `${motivo} No se creó nada: intenta de nuevo.` };
    revalidarEquipo();
    return {
      ok: false,
      error: `${motivo} Quedó una ficha suya sin terminar en «Ya no trabajan aquí» (no sale en la web): reactívalo desde ahí con un PIN, o avísale a soporte.`,
    };
  };

  // 2) Usuario de Auth + perfil de barbero.
  const acceso = await asegurarAcceso(admin, barberoId, n.nombre);
  if (!acceso.ok) return deshacer(acceso.error);

  // 3) El PIN (bcrypt en la base; el PIN no se guarda en ningún otro lado).
  const { error: pinErr } = await admin.rpc("set_pin_barbero", { p_barbero_id: barberoId, p_pin: n.pin });
  if (pinErr) return deshacer(errorPublico("crearBarbero pin", pinErr, "No se pudo guardar el PIN."), acceso.authId);

  // 4) El correo de avisos (opcional).
  if (n.correo) {
    const { error } = await admin
      .from("barbero_contacto")
      .upsert({ barbero_id: barberoId, email: n.correo, actualizado_en: new Date().toISOString() });
    if (error) {
      const r = await deshacer(
        faltaTabla(error)
          ? errorPublico("crearBarbero correo (tabla)", error, "Todavía no se pueden guardar correos de barberos: créalo sin correo o avísale a soporte.")
          : errorPublico("crearBarbero correo", error, "No se pudo guardar el correo."),
        acceso.authId,
      );
      return { ...r, campo: "correo" };
    }
  }

  // 5) Recién ahora sale en la web y en la reserva.
  const { error: onErr } = await admin.from("barberos").update({ activo: true }).eq("id", barberoId);
  if (onErr) return deshacer(errorPublico("crearBarbero activar", onErr, "No se pudo terminar de crearlo."), acceso.authId);

  revalidarEquipo();
  return {
    ok: true,
    id: barberoId,
    aviso: `${primerNombre(n.nombre)} quedó creado y ya sale en la web. Dale su PIN en persona: entra en barbasybigotes.com/login tocando su nombre.`,
  };
}

/** "Crear acceso" de la ficha: para un barbero que existe pero no puede entrar (lo crearon por SQL a medias). */
export async function crearAccesoBarbero(barberoId: string): Promise<ActionResult> {
  const denied = await gateAdmin();
  if (denied) return { ok: false, error: denied };
  const admin = supabaseAdmin();
  const { data: b } = await admin.from("barberos").select("id,nombre,activo").eq("id", barberoId).maybeSingle();
  const barb = b as { id: string; nombre: string; activo: boolean } | null;
  if (!barb) return { ok: false, error: "Ese barbero no existe." };
  if (!barb.activo) return { ok: false, error: "Ya no trabaja aquí. Reactívalo y el acceso se crea solo." };
  const r = await asegurarAcceso(admin, barb.id, barb.nombre);
  if (!r.ok) return { ok: false, error: r.error };
  const { data: pin } = await admin.from("barbero_pin").select("barbero_id").eq("barbero_id", barb.id).maybeSingle();
  revalidatePath("/admin/equipo");
  revalidatePath("/admin");
  if (!r.creado) return { ok: true, aviso: "Ya tenía acceso: no hizo falta crear nada." };
  return {
    ok: true,
    aviso: pin ? "Acceso creado: ya puede entrar con su PIN." : "Acceso creado. Ahora ponle su PIN aquí abajo para que pueda entrar.",
  };
}

// ---------- La ficha ----------

/**
 * Nombre, sede de siempre, posición en la web y "destacado". Cambiar de sede con
 * citas por delante en la vieja no se deja: quedarían con un barbero que ya no
 * está en esa agenda (el mostrador pinta una columna por barbero de la sede).
 */
export async function actualizarFichaBarbero(input: {
  barberoId: string;
  nombre: string;
  sedeId: string;
  /** 1 = primero en la web, dentro de su sede. */
  posicion: number;
  destacado: boolean;
}): Promise<ActionResult & { citasEnSedeVieja?: number }> {
  const denied = await gateAdmin();
  if (denied) return { ok: false, error: denied };
  const admin = supabaseAdmin();

  const nombre = sanearNombre(input.nombre, 60);
  if (!nombre || nombre.length < 2) return { ok: false, error: "Escribe el nombre con el que lo conocen los clientes." };
  const { data: b } = await admin.from("barberos").select("id,nombre,sede_id,activo").eq("id", input.barberoId).maybeSingle();
  const barb = b as { id: string; nombre: string; sede_id: string; activo: boolean } | null;
  if (!barb) return { ok: false, error: "Ese barbero no existe." };
  if (!barb.activo) return { ok: false, error: "Ya no trabaja aquí. Reactívalo primero." };
  const sedes = await sedesActivas(admin);
  const destino = sedes.find((s) => s.id === input.sedeId);
  if (!destino) return { ok: false, error: "Elige una sede." };
  const cambiaSede = destino.id !== barb.sede_id;

  if (cambiaSede) {
    const { count, error } = await admin
      .from("reservas")
      .select("id", { count: "exact", head: true })
      .eq("barbero_id", barb.id)
      .eq("sede_id", barb.sede_id)
      .in("estado", ["pendiente", "confirmada"])
      .gt("fin", new Date().toISOString());
    if (error) return { ok: false, error: errorPublico("actualizarFichaBarbero citas", error) };
    if ((count ?? 0) > 0) {
      const vieja = sedes.find((s) => s.id === barb.sede_id)?.nombre ?? "su sede";
      return {
        ok: false,
        citasEnSedeVieja: count ?? 0,
        error: `Tiene ${count === 1 ? "1 cita" : `${count} citas`} por delante en ${vieja}. Pásalas antes a otro barbero de allá («Sus citas por delante», aquí abajo) y vuelve a cambiar la sede.`,
      };
    }
  }

  const { data: compas } = await admin
    .from("barberos")
    .select("id,nombre,orden")
    .eq("sede_id", destino.id)
    .eq("activo", true)
    .order("orden")
    .order("nombre");
  const lista = (compas ?? []) as { id: string; nombre: string; orden: number }[];
  if (nombreRepetido(nombre, lista, [barb.id]))
    return { ok: false, error: `Ya hay un barbero con ese nombre en ${destino.nombre}. Agrégale el apellido para distinguirlos.` };

  const { error: upErr } = await admin
    .from("barberos")
    .update({ nombre, sede_id: destino.id, destacado: !!input.destacado })
    .eq("id", barb.id);
  if (upErr) return { ok: false, error: errorPublico("actualizarFichaBarbero", upErr) };

  // Posición en la web: se reubica y la sede queda numerada 1..n sin huecos.
  const ids = lista.map((x) => x.id).filter((x) => x !== barb.id);
  const total = ids.length + 1;
  const pos = sanearOrden(input.posicion, total) ?? total;
  // Si cambió de sede, él no está en `lista` (se leyó con la sede vieja) y su
  // orden se escribe sí o sí.
  const actual = new Map(lista.map((x) => [x.id, x.orden]));
  for (const { id, orden } of reordenar([...ids, barb.id], barb.id, pos)) {
    if (actual.get(id) === orden) continue;
    const { error } = await admin.from("barberos").update({ orden }).eq("id", id);
    if (error) errorPublico("actualizarFichaBarbero orden", error);
  }

  // El nombre del header de su app sale del perfil.
  if (nombre !== barb.nombre) {
    const { error } = await admin.from("profiles").update({ nombre }).eq("barbero_id", barb.id).eq("rol", "barbero");
    if (error) errorPublico("actualizarFichaBarbero perfil", error);
  }

  revalidarEquipo();
  return { ok: true, aviso: cambiaSede ? `Listo: desde ahora trabaja en ${destino.nombre}.` : "Ficha guardada." };
}

const FOTO_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Foto del barbero: mismo pipeline blindado que productos, servicios y sedes,
 * bucket 'barberos' (0087). `reintentable: false` = reintentar no sirve (falta el
 * bucket): el alta no le dice al dueño "súbela desde su ficha", donde fallaría igual.
 */
export async function subirFotoBarbero(formData: FormData): Promise<ActionResult & { reintentable?: boolean }> {
  const denied = await gateAdmin();
  if (denied) return { ok: false, error: denied };

  const barberoId = String(formData.get("barberoId") ?? "").trim();
  const file = formData.get("foto");
  if (!barberoId || !(file instanceof File) || file.size === 0) return { ok: false, error: "Elige una imagen." };
  if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type))
    return { ok: false, error: "La imagen tiene que ser JPG, PNG, WebP o AVIF." };
  if (file.size > FOTO_MAX_BYTES) return { ok: false, error: "La imagen no puede pesar más de 2MB." };
  const cabecera = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!pareceImagen(cabecera)) return { ok: false, error: "Ese archivo no es una imagen válida." };

  const admin = supabaseAdmin();
  const { data: b } = await admin.from("barberos").select("id").eq("id", barberoId).maybeSingle();
  if (!b) return { ok: false, error: "Ese barbero no existe." };

  const ext = extDeMime(file.type);
  const path = `${barberoId}.${ext}`;
  const { error: upErr } = await admin.storage.from("barberos").upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) {
    if (/bucket not found/i.test(upErr.message ?? ""))
      return {
        ok: false,
        reintentable: false,
        error: errorPublico("subirFotoBarbero sin bucket (falta 0087)", upErr, "Todavía no se pueden guardar fotos de barberos: avísale a soporte."),
      };
    return { ok: false, error: errorPublico("subirFotoBarbero upload", upErr, "No se pudo subir la foto. Intenta de nuevo.") };
  }
  const { error: rmErr } = await admin.storage.from("barberos").remove(variantesObsoletas(barberoId, ext));
  if (rmErr) errorPublico("subirFotoBarbero limpieza", rmErr);

  const { data: pub } = admin.storage.from("barberos").getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now()}`;
  const { error: updErr } = await admin.from("barberos").update({ foto_url: url }).eq("id", barberoId);
  if (updErr) return { ok: false, error: errorPublico("subirFotoBarbero update", updErr) };

  revalidarEquipo();
  return { ok: true, aviso: "Foto guardada: ya la ve el cliente en la web y al reservar." };
}

export async function quitarFotoBarbero(barberoId: string): Promise<ActionResult> {
  const denied = await gateAdmin();
  if (denied) return { ok: false, error: denied };
  const admin = supabaseAdmin();
  const paths = ["jpg", "png", "webp", "avif"].map((e) => `${barberoId}.${e}`);
  const { error: rmErr } = await admin.storage.from("barberos").remove(paths);
  if (rmErr) errorPublico("quitarFotoBarbero storage", rmErr); // best-effort: el campo es la verdad
  const { error } = await admin.from("barberos").update({ foto_url: null }).eq("id", barberoId);
  if (error) return { ok: false, error: errorPublico("quitarFotoBarbero", error) };
  revalidarEquipo();
  return { ok: true, aviso: "Foto quitada: en la web sale con una foto genérica que no es él hasta que subas otra." };
}


// ---------- La baja ----------

/** Lo que la hoja de baja muestra antes de confirmar (citas, plata, accesos). */
export async function cargarResumenBaja(
  barberoId: string,
): Promise<{ ok: true; resumen: ResumenBaja } | { ok: false; error: string }> {
  const denied = await gateAdmin();
  if (denied) return { ok: false, error: denied };
  const resumen = await getResumenBaja(barberoId);
  if (!resumen) return { ok: false, error: "No se pudo leer su ficha. Refresca e intenta de nuevo." };
  return { ok: true, resumen };
}

export type ResultadoBaja = ActionResult & {
  /** Lo que SÍ se hizo, en palabras del dueño (solo lo que salió bien). */
  hecho?: string[];
  /** Lo que falló y hay que reintentar: va aparte, en ámbar, con su botón. */
  pendientes?: string[];
  /** Clientes cuya cita se canceló y NO dejaron correo: no les llega nada, hay que llamarlos. */
  llamar?: { cliente: string; telefono: string | null; inicio: string }[];
};

const semanaCorta = (ymd: string) => {
  const [, m, d] = ymd.split("-").map(Number);
  return `${d} ${MON[m - 1] ?? ""}`;
};

type FilaPlata = { cobros: number; adelantos: number; consumos: number; ajustes: number } | null;
const tuvoMovimiento = (f: FilaPlata) => !!f && (f.cobros > 0 || f.adelantos !== 0 || f.consumos !== 0 || f.ajustes !== 0);

/**
 * Le cierra TODO lo que tenía abierto a un barbero YA dado de baja: PIN, usuario
 * (ban), sesiones, avisos del celular, agenda de Google y coberturas que venían.
 * Idempotente: la baja lo corre una vez y "Reintentar lo que faltó" otra.
 * Solo dice "hecho" lo que de verdad salió; lo demás va a pendientes.
 */
async function cerrarAccesos(admin: SupabaseClient, barberoId: string): Promise<{ hecho: string[]; pendientes: string[] }> {
  const hecho: string[] = [];
  const pendientes: string[] = [];

  // PIN. Aunque el borrado fallara, ya no entra: loginBarberoPin rechaza a un
  // barbero dado de baja con el mismo "PIN incorrecto" de siempre.
  const { error: pinErr } = await admin.from("barbero_pin").delete().eq("barbero_id", barberoId);
  if (pinErr) errorPublico("cerrarAccesos pin", pinErr);
  hecho.push("Su PIN dejó de servir.");

  // Su usuario: ban (no renueva ni vuelve a entrar) y borrado de sus sesiones
  // (0087), así el token que le quedaba muere ya. TODOS sus perfiles: con uno
  // repetido, maybeSingle fallaba y la baja creía que no tenía acceso.
  const { data: perfiles, error: pErr } = await admin.from("profiles").select("auth_id").eq("barbero_id", barberoId).eq("rol", "barbero");
  if (pErr) {
    errorPublico("cerrarAccesos perfiles", pErr);
    pendientes.push("No se pudo revisar su usuario de la app para bloquearlo y cerrarle la sesión.");
  } else {
    const ids = [...new Set(((perfiles ?? []) as { auth_id: string | null }[]).map((p) => p.auth_id).filter((x): x is string => !!x))];
    if (!ids.length) {
      hecho.push("No tenía usuario en la app, así que no había sesión que cerrar.");
    } else {
      let bloqueados = 0;
      for (const id of ids) {
        const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: BAN_DE_BAJA });
        if (error) errorPublico("cerrarAccesos ban", error);
        else bloqueados++;
      }
      const { error: sesErr } = await admin.rpc("cerrar_sesiones_barbero", { p_barbero_id: barberoId });
      // PGRST202 = la 0087 todavía no está aplicada: la sesión vence sola.
      if (sesErr) errorPublico(sesErr.code === "PGRST202" ? "cerrarAccesos sesiones (falta 0087)" : "cerrarAccesos sesiones", sesErr);
      if (bloqueados === ids.length && !sesErr) {
        hecho.push("Se le cerró la sesión en todos sus aparatos y su usuario quedó bloqueado.");
      } else {
        if (bloqueados === ids.length) hecho.push("Su usuario quedó bloqueado: no puede volver a entrar.");
        else pendientes.push("No se pudo bloquear su usuario de la app.");
        if (sesErr) pendientes.push("No se pudo cerrar la sesión que tenía abierta en su celular: se apaga sola en máximo una hora.");
      }
    }
  }

  // Los avisos a su celular.
  const { data: subs, error: pushErr } = await admin.from("push_subscriptions").delete().eq("barbero_id", barberoId).select("id");
  if (pushErr) {
    errorPublico("cerrarAccesos push", pushErr);
    pendientes.push("No se pudieron borrar sus avisos del celular.");
  } else if (subs?.length) {
    hecho.push(`Se borraron sus avisos en ${subs.length === 1 ? "1 celular" : `${subs.length} aparatos`}.`);
  }

  // Su agenda de Google (los eventos llevan nombre y teléfono de los clientes).
  try {
    const quitados = await quitarAccesoAgenda(admin, barberoId);
    if (quitados.length) hecho.push(`Se le quitó el acceso a su agenda de Google (${quitados.join(", ")}).`);
  } catch (e) {
    errorPublico("cerrarAccesos agenda", { message: (e as Error).message });
    pendientes.push("Google no dejó quitarle su agenda: todavía ve el nombre y el teléfono de tus clientes.");
  }

  // Si estaba anotado para cubrir otra sede en días que vienen, se borra.
  const { error: cobErr } = await admin.from("barbero_cobertura").delete().eq("barbero_id", barberoId).gte("fecha", bogotaYmd());
  if (cobErr && !faltaTabla(cobErr)) errorPublico("cerrarAccesos cobertura", cobErr);

  return { hecho, pendientes };
}

/**
 * Dar de baja. Primero se lo saca de la web (activo = false) para que nadie le
 * reserve mientras tanto; después se resuelven sus citas y se le cierra todo lo
 * que tenía abierto. Su plata, sus ventas y su historial NO se tocan.
 */
export async function darDeBajaBarbero(input: { barberoId: string; cancelarCitas: boolean }): Promise<ResultadoBaja> {
  const denied = await gateAdmin();
  if (denied) return { ok: false, error: denied };
  const admin = supabaseAdmin();

  const antes = await getResumenBaja(input.barberoId);
  if (!antes) return { ok: false, error: "No se pudo leer su ficha. Refresca e intenta de nuevo." };
  if (!antes.barbero.activo) return { ok: false, error: "Ya estaba dado de baja." };
  const motivo = motivoParaNoDarDeBaja({
    citasFuturas: antes.citas.length,
    cancelarCitas: input.cancelarCitas,
    enSilla: antes.enSilla,
    sinCobrar: antes.sinCobrar.length,
  });
  if (motivo) return { ok: false, error: motivo };
  const nombre = primerNombre(antes.barbero.nombre);

  // 1) Fuera de la web y de la reserva: desde acá nadie le puede reservar.
  const { data: off, error: offErr } = await admin
    .from("barberos")
    .update({ activo: false })
    .eq("id", input.barberoId)
    .eq("activo", true)
    .select("id");
  if (offErr) return { ok: false, error: errorPublico("darDeBajaBarbero activo", offErr) };
  if (!off?.length) return { ok: false, error: "Ya estaba dado de baja." };
  const volver = async () => {
    const { error } = await admin.from("barberos").update({ activo: true }).eq("id", input.barberoId);
    if (error) errorPublico("darDeBajaBarbero volver", error);
  };

  // 2) Sus citas: se relee DESPUÉS de sacarlo de la web, por si le reservaron
  //    mientras el dueño miraba la hoja.
  const { data: citasData, error: cErr } = await admin
    .from("reservas")
    .select("id,inicio,clientes(nombre,email,telefono)")
    .eq("barbero_id", input.barberoId)
    .in("estado", ["pendiente", "confirmada"])
    .gt("fin", new Date().toISOString())
    .order("inicio");
  if (cErr) {
    await volver();
    return { ok: false, error: errorPublico("darDeBajaBarbero citas", cErr, "No se pudieron leer sus citas. No se cambió nada.") };
  }
  const citas = ((citasData ?? []) as Record<string, unknown>[]).map((r) => {
    const c = r.clientes as { nombre?: string; email?: string | null; telefono?: string | null } | null;
    return {
      id: r.id as string,
      inicio: r.inicio as string,
      cliente: c?.nombre ?? "",
      telefono: c?.telefono?.trim() || null,
      conCorreo: esEmailEnviable((c?.email ?? "").trim()),
    };
  });
  if (citas.length && !input.cancelarCitas) {
    await volver();
    return {
      ok: false,
      error: `Le acaban de reservar: tiene ${citas.length === 1 ? "1 cita" : `${citas.length} citas`} por delante. Pásalas o marca «Cancelarlas». No se cambió nada.`,
    };
  }
  // El MISMO camino que "Cancelar" del mostrador: encola el correo "tu cita fue
  // cancelada" (0059) a quien dejó correo, y le manda el push si tiene la app.
  const fallidas: string[] = [];
  for (const c of citas) {
    const r = await actualizarReserva(c.id, { estado: "cancelada" });
    if (!r.ok) fallidas.push(r.error ?? "no se pudo");
  }
  if (fallidas.length) {
    await volver();
    return {
      ok: false,
      error: `Se cancelaron ${citas.length - fallidas.length} de ${citas.length} citas, pero ${fallidas.length} no (${fallidas[0]}). ${nombre} sigue activo: revisa y vuelve a intentar.`,
    };
  }

  const hecho: string[] = [`${nombre} quedó dado de baja: ya no sale en la web ni se le puede reservar.`];
  const llamar = citas.filter((c) => !c.conCorreo).map((c) => ({ cliente: c.cliente, telefono: c.telefono, inicio: c.inicio }));
  if (citas.length) {
    const conCorreo = citas.length - llamar.length;
    hecho.push(
      `${citas.length === 1 ? "Su cita quedó cancelada" : `Sus ${citas.length} citas quedaron canceladas`}. ${avisoAClientes(conCorreo, llamar.length)}`,
    );
  }

  // 3) Todo lo que tenía abierto.
  const cierre = await cerrarAccesos(admin, input.barberoId);
  hecho.push(...cierre.hecho);

  // 4) Su plata: no se toca, y se dice dónde está (no existe "pagado": la fila
  //    sigue en Liquidación esa semana aunque ya se le haya pagado).
  const semanas = [antes.semanaAnterior, antes.semana].filter((x) => x && tuvoMovimiento(x.fila)) as { desdeYmd: string }[];
  hecho.push(
    semanas.length
      ? `Su plata no se toca: la encuentras en Liquidación, ${semanas.length === 1 ? `semana del ${semanaCorta(semanas[0].desdeYmd)}` : `semanas del ${semanaCorta(semanas[0].desdeYmd)} y del ${semanaCorta(semanas[1].desdeYmd)}`}.`
      : "No tenía cobros, adelantos ni consumos esta semana ni la anterior.",
  );

  revalidarEquipo();
  return { ok: true, aviso: hecho.join(" "), hecho, pendientes: cierre.pendientes, llamar };
}

/** "Reintentar lo que faltó" de la baja: vuelve a cerrarle todo a un barbero YA dado de baja. */
export async function terminarBajaBarbero(barberoId: string): Promise<ResultadoBaja> {
  const denied = await gateAdmin();
  if (denied) return { ok: false, error: denied };
  const admin = supabaseAdmin();
  const { data: b, error } = await admin.from("barberos").select("activo").eq("id", barberoId).maybeSingle();
  if (error) return { ok: false, error: errorPublico("terminarBajaBarbero", error) };
  if (!b) return { ok: false, error: "Ese barbero no existe." };
  if ((b as { activo: boolean }).activo) return { ok: false, error: "Sigue trabajando aquí: no hay nada que cerrarle." };
  const cierre = await cerrarAccesos(admin, barberoId);
  revalidarEquipo();
  return { ok: true, aviso: cierre.hecho.join(" "), hecho: cierre.hecho, pendientes: cierre.pendientes };
}

/**
 * El PIN del MOSTRADOR de la sede del que se va: lo conoce, y con él entra como
 * rol 'sede' y ve la agenda, la caja y los clientes de toda la sede. La baja
 * ofrece cambiarlo y, si se marca, cerrar las sesiones del mostrador (el aparato
 * del local vuelve a pedir el PIN, el nuevo).
 */
export async function cambiarPinMostrador(input: { sedeId: string; pin: string; cerrarSesiones: boolean }): Promise<ActionResult> {
  const denied = await gateAdmin();
  if (denied) return { ok: false, error: denied };
  const pin = (input.pin ?? "").trim();
  if (!esPinValido(pin)) return { ok: false, error: ERROR_PIN };
  const r = await setearPinSede(input.sedeId, pin);
  if (!r.ok) return { ok: false, error: r.error ?? "No se pudo cambiar el PIN del mostrador." };
  revalidatePath("/admin/equipo");
  if (!input.cerrarSesiones) return { ok: true, aviso: "PIN del mostrador cambiado. Díselo al equipo en persona." };
  const { error } = await supabaseAdmin().rpc("cerrar_sesiones_sede", { p_sede_id: input.sedeId });
  if (error) {
    errorPublico(error.code === "PGRST202" ? "cambiarPinMostrador sesiones (falta 0087)" : "cambiarPinMostrador sesiones", error);
    return {
      ok: true,
      aviso: "PIN del mostrador cambiado, pero no se pudieron cerrar las sesiones que ya estaban abiertas: se apagan solas en máximo una hora.",
    };
  }
  return {
    ok: true,
    aviso: "PIN del mostrador cambiado y sesiones cerradas en todos los aparatos. En el del local, entra otra vez con el PIN nuevo.",
  };
}

/** "Reactivar" desde «Ya no trabajan aquí»: vuelve a la web, con PIN nuevo y su usuario desbloqueado. */
export async function reactivarBarbero(input: { barberoId: string; pin: string; quitarCorreo?: boolean }): Promise<ActionResult> {
  const denied = await gateAdmin();
  if (denied) return { ok: false, error: denied };
  if (!esPinValido((input.pin ?? "").trim())) return { ok: false, error: ERROR_PIN };
  const admin = supabaseAdmin();

  const { data: b } = await admin.from("barberos").select("id,nombre,activo,sede_id").eq("id", input.barberoId).maybeSingle();
  const barb = b as { id: string; nombre: string; activo: boolean; sede_id: string } | null;
  if (!barb) return { ok: false, error: "Ese barbero no existe." };
  if (barb.activo) return { ok: false, error: "Ya está activo." };

  // El correo de avisos que tenía: si el dueño lo quita (no es suyo, o lo cambió),
  // se borra ANTES de volver, para que la primera reserva no le llegue a otro.
  if (input.quitarCorreo) {
    const { error } = await admin.from("barbero_contacto").delete().eq("barbero_id", barb.id);
    if (error && !faltaTabla(error))
      return { ok: false, error: errorPublico("reactivarBarbero correo", error, "No se pudo quitar su correo de avisos. Intenta de nuevo.") };
  }

  // Primero el acceso y el PIN; recién al final vuelve a la web, para que no quede
  // "activo" sin poder entrar si algo falla en el camino.
  const acceso = await asegurarAcceso(admin, barb.id, barb.nombre);
  if (!acceso.ok) return { ok: false, error: acceso.error };
  const { error: unbanErr } = await admin.auth.admin.updateUserById(acceso.authId, { ban_duration: "none" });
  if (unbanErr) return { ok: false, error: errorPublico("reactivarBarbero desbloquear", unbanErr, "No se pudo desbloquear su usuario. Intenta de nuevo.") };
  const { error: pinErr } = await admin.rpc("set_pin_barbero", { p_barbero_id: barb.id, p_pin: input.pin.trim() });
  if (pinErr) return { ok: false, error: errorPublico("reactivarBarbero pin", pinErr, "No se pudo guardar el PIN. Intenta de nuevo.") };

  // Al final de su sede en la web, como uno nuevo.
  const { data: compas } = await admin.from("barberos").select("orden").eq("sede_id", barb.sede_id).eq("activo", true);
  const orden = Math.max(0, ...((compas ?? []) as { orden: number | null }[]).map((c) => c.orden ?? 0)) + 1;
  const { error } = await admin.from("barberos").update({ activo: true, orden }).eq("id", barb.id);
  if (error) return { ok: false, error: errorPublico("reactivarBarbero", error) };

  revalidarEquipo();
  return {
    ok: true,
    aviso: `${primerNombre(barb.nombre)} volvió: ya sale en la web y entra con el PIN nuevo. Revisa su ficha: ${input.quitarCorreo ? "ponle su correo de avisos, " : ""}la agenda de Google y los avisos del celular hay que activarlos otra vez.`,
  };
}

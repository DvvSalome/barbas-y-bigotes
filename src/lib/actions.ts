"use server";

import { revalidatePath } from "next/cache";
import { type SupabaseClient } from "@supabase/supabase-js";
import { supabaseServerAuth, supabaseAdmin } from "@/lib/supabase/server";
import { getStaffContext, getCorteIds, contarCortesCliente, precioCorteBase } from "@/lib/data/queries";
import { clienteIdForUser } from "@/lib/cliente-actions";
import { bogotaDayRange, bogotaYmd, finEfectivo } from "@/lib/slots";
import { errorPublico } from "@/lib/errors";
import { calcularCobro, snapshotDinero, diferenciaCaja } from "@/lib/cobro";
import { beneficioProximoCorte } from "@/lib/tarjeta";
import { pushACliente } from "@/lib/push";
import { fechaHoraBogota } from "@/lib/format";

export type ActionResult = { ok: boolean; error?: string; id?: string; total?: number; descuento?: number; propina?: number; puntos?: number; encolado?: boolean; esperaHasta?: string | null; tarjeta?: { cortesTotales: number; posicion: number; beneficio: "50%" | "gratis" | null }; resenaUrl?: string | null };

// --- Autorización (defensa en profundidad; la RLS es la barrera real) ---
// Las server actions corren con la sesión del usuario, pero igual revalidamos el
// rol acá: una action es un endpoint POST invocable directo, no confíes solo en la UI.
async function requireAdmin(sb: SupabaseClient): Promise<string | null> {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return "No autorizado";
  const { data } = await sb.from("profiles").select("rol").eq("auth_id", user.id).maybeSingle();
  if ((data as { rol?: string } | null)?.rol !== "admin") return "Requiere permiso de administrador";
  return null;
}

async function requireStaff(sb: SupabaseClient): Promise<string | null> {
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user ? null : "No autorizado";
}

export type CuponResult = {
  ok: boolean;
  error?: string;
  codigo?: string;
  tipo?: "porcentaje" | "monto";
  valor?: number;
  descripcion?: string | null;
};

// Valida un cupón y devuelve sus datos (sin aplicarlo). Lo usa el cobro para
// previsualizar el descuento. La validación autoritativa se repite al cobrar.
export async function validarCupon(codigo: string): Promise<CuponResult> {
  const code = (codigo ?? "").trim().toUpperCase();
  if (!code) return { ok: false, error: "Ingresá un código" };
  const sb = await supabaseServerAuth();
  const denied = await requireStaff(sb);
  if (denied) return { ok: false, error: denied };
  const { data } = await sb
    .from("cupones")
    .select("codigo,tipo,valor,activo,usos,usos_max,vence_en,descripcion")
    .eq("codigo", code)
    .maybeSingle();
  if (!data) return { ok: false, error: "Cupón no encontrado" };
  const c = data as {
    codigo: string; tipo: "porcentaje" | "monto"; valor: number; activo: boolean;
    usos: number; usos_max: number | null; vence_en: string | null; descripcion: string | null;
  };
  if (!c.activo) return { ok: false, error: "Cupón inactivo" };
  if (c.usos_max !== null && c.usos >= c.usos_max) return { ok: false, error: "Cupón agotado" };
  if (c.vence_en && c.vence_en < bogotaYmd()) return { ok: false, error: "Cupón vencido" };
  return { ok: true, codigo: c.codigo, tipo: c.tipo, valor: c.valor, descripcion: c.descripcion };
}

// Preview de la tarjeta de cortes para el form de cobro: el beneficio del PRÓXIMO
// corte del cliente. El server (completarReserva) es la fuente de verdad y lo
// recomputa; esto solo alimenta el aviso y el total en vivo del barbero. Cuenta
// con supabaseAdmin() (igual que el cobro) para no undercontar por la RLS 0010.
export async function getTarjetaParaCobro(
  clienteRef: string,
  sede: string,
): Promise<
  | { ok: true; cortesPrevios: number; posicion: number; tipo: "50%" | "gratis" | null; descuento: number }
  | { ok: false }
> {
  const sb = await supabaseServerAuth();
  const denied = await requireStaff(sb);
  if (denied || !clienteRef) return { ok: false };
  const admin = supabaseAdmin();
  const cortesPrevios = await contarCortesCliente(admin, clienteRef);
  const base = await precioCorteBase(admin, sede);
  const b = beneficioProximoCorte(cortesPrevios, base);
  return { ok: true, cortesPrevios, posicion: b.posicion, tipo: b.tipo, descuento: b.descuento };
}

// Upsert de cliente por teléfono vía RPC SECURITY DEFINER: dedup correcto sin exponer
// toda la tabla clientes al barbero (que ahora solo ve por RLS los clientes que atendió).
async function upsertClienteId(
  sb: SupabaseClient,
  nombre: string,
  telefono: string,
  email = "",
  origen = "registrado",
  fidelizado = true,
): Promise<string | null> {
  const { data } = await sb.rpc("upsert_cliente", {
    p_nombre: nombre ?? "",
    p_telefono: telefono ?? "",
    p_email: email ?? "",
    p_origen: origen,
    p_fidelizado: fidelizado,
  });
  return (data as string | null) ?? null;
}

export async function addProducto(input: {
  nombre: string;
  sede: string;
  precio: number;
  stock: number;
  stockMinimo: number;
  comisionPct: number;
}): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };
  const { data, error } = await sb
    .from("productos")
    .insert({
      nombre: input.nombre,
      sede_id: input.sede,
      precio: input.precio,
      stock: input.stock,
      stock_minimo: input.stockMinimo,
      comision_pct: input.comisionPct,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: errorPublico("addProducto", error) };
  revalidatePath("/admin/inventario");
  // El id permite encadenar la foto opcional (subirFotoProducto) tras crear.
  return { ok: true, id: (data as { id: string }).id };
}

const FOTO_MAX_BYTES = 2 * 1024 * 1024;

// Foto del producto → Supabase Storage (bucket público "productos", migración 0019).
// service role para el storage: la escritura del bucket no se expone por RLS,
// el gate real es requireAdmin acá.
export async function subirFotoProducto(formData: FormData): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };

  const productoId = String(formData.get("productoId") ?? "").trim();
  const file = formData.get("foto");
  if (!productoId || !(file instanceof File) || file.size === 0)
    return { ok: false, error: "Elegí una imagen." };
  // Allowlist (nada de SVG: un <script> embebido quedaría servido desde el bucket público).
  if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type))
    return { ok: false, error: "La imagen tiene que ser JPG, PNG, WebP o AVIF." };
  if (file.size > FOTO_MAX_BYTES) return { ok: false, error: "La imagen no puede pesar más de 2MB." };

  const admin = supabaseAdmin();
  // Existencia + sanidad del id (el path del storage se arma con él).
  const { data: prod } = await admin.from("productos").select("id").eq("id", productoId).maybeSingle();
  if (!prod) return { ok: false, error: "Producto no encontrado." };

  const ext =
    (file.type.split("/")[1] ?? "jpg").toLowerCase().replace("jpeg", "jpg").replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${productoId}.${ext}`;
  const { error: upErr } = await admin.storage
    .from("productos")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (upErr)
    return { ok: false, error: errorPublico("subirFotoProducto upload", upErr, "No se pudo subir la foto. Intentá de nuevo.") };

  // Limpieza best-effort: re-subir en otro formato (png→webp) dejaría el archivo
  // viejo huérfano en el bucket público (el path lleva la extensión). Se borran
  // las otras variantes del mismo producto; si el remove falla, no aborta la subida.
  const otrasVariantes = ["jpg", "png", "webp", "avif"].filter((e) => e !== ext).map((e) => `${productoId}.${e}`);
  const { error: rmErr } = await admin.storage.from("productos").remove(otrasVariantes);
  if (rmErr) errorPublico("subirFotoProducto limpieza", rmErr);

  const { data: pub } = admin.storage.from("productos").getPublicUrl(path);
  // Cache-buster: el path se repite en cada re-subida y el CDN no debe servir la vieja.
  const url = `${pub.publicUrl}?v=${Date.now()}`;
  const { error: updErr } = await admin.from("productos").update({ foto_url: url }).eq("id", productoId);
  if (updErr) return { ok: false, error: errorPublico("subirFotoProducto update", updErr) };

  revalidatePath("/admin/inventario");
  revalidatePath("/barbero");
  return { ok: true };
}

// --- Armador de combos (F3) ---

// Bebida que suma el combo cuando el admin la incluye (proto §7.1: "+$5.000").
const BEBIDA_COMBO = 5000;

// id kebab a partir del nombre (sin acentos, solo [a-z0-9-]). El que llama
// resuelve la colisión con sufijo -2, -3…
function slugCombo(nombre: string): string {
  const base = nombre
    .toLowerCase()
    .replace(/[áàä]/g, "a")
    .replace(/[éèë]/g, "e")
    .replace(/[íìï]/g, "i")
    .replace(/[óòö]/g, "o")
    .replace(/[úùü]/g, "u")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return base || "combo";
}

// Crea un combo EN LA SEDE ACTIVA del módulo Precios (decisión del dueño): queda
// priceado/disponible SOLO en esa sede (una fila en servicio_sede). Si el admin
// lo quiere en la otra sede, lo arma allá también.
export async function crearCombo(input: {
  sede: string;
  partes: string[];
  conBebida: boolean;
  nombre: string;
  duracionMin: number;
  precio: number;
}): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };

  // Validación (defensa en profundidad: la UI ya deshabilita el CTA).
  const nombre = (input.nombre ?? "").trim();
  const partes = Array.isArray(input.partes) ? input.partes.filter((p) => typeof p === "string" && p) : [];
  const precio = Math.round(Number(input.precio));
  const duracionMin = Math.round(Number(input.duracionMin));
  const conBebida = !!input.conBebida;
  if (partes.length < 2 && !(partes.length >= 1 && conBebida))
    return { ok: false, error: "Elegí al menos 2 partes (o 1 parte más la bebida)." };
  if (!nombre) return { ok: false, error: "Poné el nombre del combo." };
  if (!Number.isFinite(precio) || precio <= 0) return { ok: false, error: "Poné un precio válido." };
  if (!Number.isFinite(duracionMin) || duracionMin <= 0) return { ok: false, error: "Poné una duración válida." };

  const admin = supabaseAdmin();

  const { data: sedeRow } = await admin.from("sedes").select("id").eq("id", input.sede).maybeSingle();
  if (!sedeRow) return { ok: false, error: "Sede inválida." };

  // cuenta_corte: el combo cuenta para la tarjeta solo si alguna parte es un corte
  // (misma semántica que getCorteIds). Un combo sin corte NO suma sello.
  const corteIds = new Set(await getCorteIds(admin));
  const cuentaCorte = partes.some((p) => corteIds.has(p));

  // id único: slug del nombre, con sufijo -2, -3… si choca.
  const baseId = slugCombo(nombre);
  const { data: existentes } = await admin.from("servicios").select("id").like("id", `${baseId}%`);
  const tomados = new Set(((existentes ?? []) as { id: string }[]).map((r) => r.id));
  let id = baseId;
  for (let n = 2; tomados.has(id); n++) id = `${baseId}-${n}`;

  const row = {
    id,
    nombre,
    categoria: "combos",
    es_combo: true,
    duracion_min: duracionMin,
    activo: true,
  };
  // Intentá con cuenta_corte (0027); si la columna aún no existe, reintentá sin ella
  // (mismo espíritu tolerante que getCorteIds: no explotar si el orden se invierte).
  let { error: insErr } = await admin.from("servicios").insert({ ...row, cuenta_corte: cuentaCorte });
  if (insErr && /cuenta_corte/i.test(insErr.message ?? "")) {
    ({ error: insErr } = await admin.from("servicios").insert(row));
  }
  if (insErr) return { ok: false, error: errorPublico("crearCombo servicio", insErr) };

  // Precio/disponibilidad SOLO en la sede activa.
  const { error: ssErr } = await admin
    .from("servicio_sede")
    .insert({ servicio_id: id, sede_id: input.sede, precio, disponible: true });
  if (ssErr) {
    // No dejar un servicio huérfano (sin precio en ninguna sede).
    await admin.from("servicios").delete().eq("id", id);
    return { ok: false, error: errorPublico("crearCombo servicio_sede", ssErr) };
  }

  revalidatePath("/admin/precios");
  revalidatePath("/reservar");
  return { ok: true, id };
}

// Desactiva/reactiva un servicio (toggle servicios.activo). Desactivado no aparece
// en la reserva; el historial de ventas no se toca. Sirve para retirar un combo.
export async function setServicioActivo(id: string, activo: boolean): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };
  const admin = supabaseAdmin();
  const { error } = await admin.from("servicios").update({ activo }).eq("id", id);
  if (error) return { ok: false, error: errorPublico("setServicioActivo", error) };
  revalidatePath("/admin/precios");
  revalidatePath("/reservar");
  return { ok: true };
}

// Reserva desde el sitio público (sin sesión) → service role.
export async function createReserva(input: {
  sede: string;
  barberoId: string;
  servicioId: string;
  clienteNombre: string;
  telefono: string;
  email?: string;
  inicioISO: string;
  nota?: string;
}): Promise<ActionResult> {
  const sb = supabaseAdmin();
  const inicio = new Date(input.inicioISO);
  const { data: serv } = await sb
    .from("servicios")
    .select("nombre,duracion_min")
    .eq("id", input.servicioId)
    .maybeSingle();
  const dur = (serv as { duracion_min?: number } | null)?.duracion_min ?? 30;
  const servicioNombre = (serv as { nombre?: string } | null)?.nombre ?? "Tu cita";
  const fin = new Date(inicio.getTime() + dur * 60000);

  // Sin barbero no hay reserva: el EXCLUDE constraint no cubre barbero_id NULL,
  // así que N reservas caerían en el mismo slot, invisibles para todos los barberos.
  // (El wizard normal siempre manda barbero; solo el path del asistente IA lo omitía.)
  if (!input.barberoId) return { ok: false, error: "Elegí un barbero para reservar." };
  const barberoId = input.barberoId;
  // Pre-chequeo de solape (UX: evita crear el cliente si el cupo ya está tomado).
  // El EXCLUDE constraint en la DB es la garantía real contra carreras concurrentes.
  const { data: clash } = await sb
    .from("reservas")
    .select("id")
    .eq("barbero_id", barberoId)
    .not("estado", "in", "(cancelada,no_show)")
    .lt("inicio", fin.toISOString())
    .gt("fin", inicio.toISOString())
    .limit(1);
  if (clash && clash.length) return { ok: false, error: "Ese horario ya fue tomado. Elegí otro, por favor." };

  // Si reserva un cliente logueado, atamos la cita a SU ficha (auth_id verificado) para
  // que aparezca en su portal; si es anónimo, dedup por teléfono.
  let clienteRef: string | null = null;
  const {
    data: { user },
  } = await (await supabaseServerAuth()).auth.getUser();
  if (user) {
    const email = (user.email ?? "").trim().toLowerCase();
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const nombre = (meta.full_name as string) || (meta.name as string) || input.clienteNombre;
    clienteRef = await clienteIdForUser(sb, user.id, email, nombre);
  }
  if (!clienteRef) {
    clienteRef = await upsertClienteId(sb, input.clienteNombre, input.telefono, input.email ?? "", "app");
  }
  // La nota (ej. "Bebida: Gaseosa" del upsell) viaja al barbero en su agenda.
  // ponytail: si el barbero propone adelanto después, sobrescribe esta nota (raro;
  // igual el barbero cobra la bebida en consumos).
  const nota = (input.nota ?? "").trim() || null;
  const { error } = await sb.from("reservas").insert({
    sede_id: input.sede,
    barbero_id: barberoId,
    servicio_id: input.servicioId,
    cliente_ref: clienteRef,
    inicio: inicio.toISOString(),
    fin: fin.toISOString(),
    estado: "confirmada",
    canal: "app",
    nota,
  });
  if (error) {
    if (error.code === "23P01") return { ok: false, error: "Ese horario ya fue tomado. Elegí otro, por favor." };
    return { ok: false, error: errorPublico("createReserva", error) };
  }
  // Push DESPUÉS del éxito, nunca bloqueante: pushACliente jamás lanza.
  if (clienteRef) {
    await pushACliente(clienteRef, {
      title: "¡Reserva confirmada! ✂️",
      body: `${servicioNombre} — ${fechaHoraBogota(inicio)}`,
      url: "/cuenta",
    });
  }
  revalidatePath("/barbero");
  return { ok: true };
}

// Rangos ocupados de un barbero en un día (solo inicio/fin, sin datos del cliente).
// Lo consume el wizard público; por eso usa service role y nunca devuelve PII.
export async function getDisponibilidad(input: {
  barberoId: string;
  fechaISO: string;
}): Promise<{ inicio: string; fin: string }[]> {
  if (!input.barberoId) return [];
  const sb = supabaseAdmin();
  // El rango es el del día elegido EN BOGOTÁ: el server corre en UTC y con
  // setHours(0,0,0,0) la ventana quedaba corrida 5 horas.
  const { desde, hasta } = bogotaDayRange(new Date(input.fechaISO));
  const { data } = await sb
    .from("reservas")
    .select("inicio,fin,estado")
    .eq("barbero_id", input.barberoId)
    .not("estado", "in", "(cancelada,no_show)")
    .gte("inicio", desde.toISOString())
    .lt("inicio", hasta.toISOString());
  // Silla real: una cita EN CURSO ocupa hasta que el barbero la cierra, no solo
  // hasta el fin estimado (finEfectivo), así una atención que se alarga no libera
  // el cupo online antes de tiempo.
  const ahora = Date.now();
  return ((data ?? []) as { inicio: string; fin: string; estado: string }[]).map((r) => ({
    inicio: r.inicio,
    fin: finEfectivo(r.estado, r.fin, ahora),
  }));
}

// Walk-in registrado por el barbero (con sesión).
export async function registrarWalkin(input: {
  sede: string;
  barberoId: string;
  servicioId: string;
  clienteNombre: string;
  telefono: string;
  fidelizar?: boolean;
}): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const staff = await getStaffContext();
  if (staff.rol !== "admin" && staff.rol !== "barbero") return { ok: false, error: "No autorizado" };
  // El barbero solo agenda walk-ins a su propio nombre (RLS lo exige); el admin elige.
  const barberoId = staff.rol === "admin" ? input.barberoId || null : staff.barberoId;
  if (!barberoId) return { ok: false, error: "No se pudo determinar el barbero" };
  const clienteRef = await upsertClienteId(sb, input.clienteNombre, input.telefono, "", "walkin", input.fidelizar ?? true);
  const now = new Date();
  let dur = 30;
  if (input.servicioId) {
    const { data: serv } = await sb
      .from("servicios")
      .select("duracion_min")
      .eq("id", input.servicioId)
      .maybeSingle();
    dur = (serv as { duracion_min?: number } | null)?.duracion_min ?? 30;
  }
  const fin = new Date(now.getTime() + dur * 60000);
  const { error } = await sb.from("reservas").insert({
    sede_id: input.sede,
    barbero_id: barberoId,
    servicio_id: input.servicioId || null,
    cliente_ref: clienteRef,
    inicio: now.toISOString(),
    fin: fin.toISOString(),
    estado: "en_curso",
    canal: "walkin",
  });
  if (error) {
    // Barbero ocupado (solape detectado por el constraint EXCLUDE) → a la cola, no rechazo.
    if (error.code === "23P01") {
      const { data: busy } = await sb
        .from("reservas")
        .select("fin")
        .eq("barbero_id", barberoId)
        .not("estado", "in", "(cancelada,no_show)")
        .lt("inicio", fin.toISOString())
        .gt("fin", now.toISOString())
        .order("fin")
        .limit(1);
      const esperaHasta = (busy?.[0] as { fin?: string } | undefined)?.fin ?? null;
      const { error: eErr } = await sb.from("lista_espera").insert({
        sede_id: input.sede,
        barbero_id: barberoId,
        servicio_id: input.servicioId || null,
        cliente_ref: clienteRef,
        cliente_nombre: input.clienteNombre.trim() || null,
        telefono: input.telefono.trim() || null,
        estado: "esperando",
      });
      if (eErr) return { ok: false, error: errorPublico("registrarWalkin", eErr, "El barbero está ocupado y no se pudo encolar.") };
      revalidatePath("/barbero");
      return { ok: true, encolado: true, esperaHasta };
    }
    return { ok: false, error: errorPublico("registrarWalkin", error) };
  }
  revalidatePath("/barbero");
  return { ok: true };
}

export async function actualizarReserva(
  reservaId: string,
  patch: { estado?: string; llegada?: string },
): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireStaff(sb);
  if (denied) return { ok: false, error: denied };
  // .select() para detectar 0 filas: bajo RLS, tocar una reserva ajena no es error pero
  // no afecta filas → avisamos en vez de fingir éxito. cliente_ref: para el push de turno.
  const { data, error } = await sb
    .from("reservas")
    .update(patch)
    .eq("id", reservaId)
    .select("id,cliente_ref");
  if (error) return { ok: false, error: errorPublico("actualizarReserva", error) };
  if (!data || data.length === 0) return { ok: false, error: "Reserva no encontrada o sin permiso" };

  // "¡Es tu turno!": al marcar en_curso (botón "Llegó"), avisar al cliente. Solo en
  // ese estado, DESPUÉS del update exitoso, fire-and-forget (pushACliente jamás lanza).
  const clienteRef = (data[0] as { cliente_ref?: string | null }).cliente_ref ?? null;
  if (patch.estado === "en_curso" && clienteRef) {
    await pushACliente(clienteRef, {
      title: "¡Es tu turno! ✂️",
      body: "El barbero te está esperando.",
      url: "/cuenta",
      tag: "turno",
    });
  }

  revalidatePath("/barbero");
  return { ok: true };
}

// Auto-open de caja: la primera venta del día abre sola la caja de la sede, sin
// que nadie la abra a mano (el dueño no opera; los barberos registran todo).
// caja_sesiones es RLS admin-only (0008), por eso va con supabaseAdmin(). Es
// BEST-EFFORT: jamás puede tumbar un cobro — el caller la envuelve en try/catch
// y acá se traga el 23505 de la carrera (dos ventas simultáneas → una gana el
// unique index parcial `caja_una_abierta_por_sede`, la otra no reabre nada).
async function asegurarCajaAbierta(admin: SupabaseClient, sedeId: string): Promise<void> {
  const { data: abierta, error: selErr } = await admin
    .from("caja_sesiones")
    .select("id")
    .eq("sede_id", sedeId)
    .eq("estado", "abierta")
    .limit(1);
  if (selErr) {
    errorPublico("asegurarCajaAbierta select", selErr);
    return;
  }
  if (abierta && abierta.length > 0) return; // ya hay una caja abierta
  const { error: insErr } = await admin.from("caja_sesiones").insert({
    sede_id: sedeId,
    estado: "abierta",
    meta_dia: 0,
    monto_apertura: 0,
    auto_abierta: true,
  });
  // 23505 = otra venta simultánea ya la abrió (unique index parcial): ya quedó
  // abierta, ignorar. Cualquier otro error se loguea pero no se propaga.
  if (insErr && insErr.code !== "23505") errorPublico("asegurarCajaAbierta insert", insErr);
}

// Completar la atención: cobra el cierre completo (servicio de la reserva +
// servicios adicionales + consumos + propina + nota) y marca la reserva
// completada. reservaId null = venta rápida (sin cita: solo productos y/o
// servicios sueltos, cliente_ref null, nombre libre opcional).
export async function completarReserva(input: {
  reservaId: string | null;
  sede: string;
  barberoId: string | null;
  clienteRef: string | null;
  clienteNombre?: string; // venta rápida: texto libre opcional → ventas.cliente_nombre
  servicioId: string | null;
  serviciosExtra?: string[]; // servicios adicionales hechos en el momento
  medio: string;
  productos: { id: string; cantidad: number }[];
  propina?: number; // entero COP ≥ 0; NO entra al total
  nota?: string;
  cuponCodigo?: string;
  idemToken?: string; // token de idempotencia (obligatorio en venta rápida)
}): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const staff = await getStaffContext();
  if (staff.rol !== "admin" && staff.rol !== "barbero") return { ok: false, error: "No autorizado" };
  // barbero_id de la venta lo fija el servidor: el barbero cobra a su nombre; el admin puede cobrar por otro.
  const barberoId = staff.rol === "admin" ? input.barberoId : staff.barberoId;

  // Medio de pago: validación autoritativa contra la tabla administrable
  // (service role: la lectura no depende de la RLS del que cobra).
  const medio = (input.medio ?? "").trim();
  const { data: medioRow, error: medioErr } = await supabaseAdmin()
    .from("medios_pago")
    .select("slug")
    .eq("slug", medio)
    .eq("activo", true)
    .maybeSingle();
  if (medioErr) return { ok: false, error: errorPublico("completarReserva medio", medioErr) };
  if (!medioRow) return { ok: false, error: "Medio de pago inválido o inactivo." };

  const items: Record<string, unknown>[] = [];

  // Comisión del barbero para los servicios (principal + adicionales).
  const extras = [...new Set((input.serviciosExtra ?? []).filter(Boolean))];
  let barberComision = 0;
  if (barberoId && (input.servicioId || extras.length)) {
    const { data: barb } = await sb
      .from("barberos")
      .select("tipo_contrato,comision_pct")
      .eq("id", barberoId)
      .maybeSingle();
    const barbRow = barb as { tipo_contrato?: string | null; comision_pct?: number | null } | null;
    if (barbRow && barbRow.tipo_contrato === "porcentaje") {
      barberComision = barbRow.comision_pct != null ? Number(barbRow.comision_pct) : 50;
    }
  }

  if (input.servicioId) {
    const { data: p } = await sb
      .from("servicio_sede")
      .select("precio,servicios(nombre)")
      .eq("sede_id", input.sede)
      .eq("servicio_id", input.servicioId)
      .maybeSingle();
    // Igual que los adicionales: sin precio en la sede se rechaza, no se
    // completa una venta cobrando $0 por el servicio en silencio.
    if (!p) return { ok: false, error: "El servicio de la cita no tiene precio en esta sede." };
    const row = p as Record<string, unknown>;
    items.push({
      tipo: "servicio",
      ref_id: input.servicioId,
      descripcion: (row.servicios as { nombre?: string } | null)?.nombre ?? "Servicio",
      cantidad: 1,
      precio_unitario: row.precio,
      comision_pct: barberComision,
    });
  }

  // Servicios adicionales: precio por sede vía servicio_sede, misma comisión
  // que el principal. Sin precio en la sede → rechazo (nada se cobra "gratis").
  if (extras.length) {
    const { data: extRows, error: extErr } = await sb
      .from("servicio_sede")
      .select("servicio_id,precio,servicios(nombre)")
      .eq("sede_id", input.sede)
      .in("servicio_id", extras);
    if (extErr) return { ok: false, error: errorPublico("completarReserva extras", extErr) };
    const porId = new Map(
      ((extRows ?? []) as Record<string, unknown>[]).map((r) => [r.servicio_id as string, r]),
    );
    for (const id of extras) {
      const row = porId.get(id);
      if (!row) return { ok: false, error: "Un servicio adicional no tiene precio en esta sede." };
      items.push({
        tipo: "servicio",
        ref_id: id,
        descripcion: (row.servicios as { nombre?: string } | null)?.nombre ?? "Servicio",
        cantidad: 1,
        precio_unitario: row.precio,
        comision_pct: barberComision,
      });
    }
  }

  if (input.productos.length) {
    const ids = input.productos.map((p) => p.id);
    const { data: prods } = await sb.from("productos").select("id,nombre,precio,comision_pct").in("id", ids);
    for (const sel of input.productos) {
      const cantidad = Math.floor(sel.cantidad);
      if (!Number.isFinite(cantidad) || cantidad < 1) return { ok: false, error: "Cantidad de producto inválida." };
      const pr = ((prods ?? []) as Record<string, unknown>[]).find((x) => x.id === sel.id);
      // No descartar en silencio: cobraría menos de lo que el barbero vio en pantalla.
      if (!pr) return { ok: false, error: "Un producto ya no está disponible. Actualizá la página." };
      items.push({
        tipo: "producto",
        ref_id: sel.id,
        descripcion: pr.nombre,
        cantidad,
        precio_unitario: pr.precio,
        comision_pct: pr.comision_pct !== null ? Number(pr.comision_pct) : 0,
      });
    }
  }

  // Venta rápida: sin reserva no hay "servicio de la cita"; exigir al menos 1 ítem.
  if (!input.reservaId && items.length === 0) {
    return { ok: false, error: "Agregá al menos un servicio o producto para la venta rápida." };
  }

  // Anti doble-cobro de la venta rápida: sin reserva NO hay claim ni el unique
  // parcial ventas_reserva_unica (es where reserva_id is not null), así que un
  // doble-clic o 2 dispositivos crearían 2 ventas idénticas. El idemToken (único
  // por apertura del form) + el unique parcial ventas_idem_unica (0021) cierran
  // la carrera: la 2da inserción choca 23505 y se rechaza sin doble cobro.
  const idemToken = (input.idemToken ?? "").trim() || null;
  if (!input.reservaId && !idemToken) {
    return { ok: false, error: "No se pudo asegurar la venta. Actualizá la página e intentá de nuevo." };
  }

  // Cupón (opcional): valida y descuenta (sobre servicios + productos, tope el bruto).
  let cupon: { tipo: "porcentaje" | "monto"; valor: number } | null = null;
  let cuponCodigo: string | null = null;
  if (input.cuponCodigo && input.cuponCodigo.trim()) {
    const v = await validarCupon(input.cuponCodigo);
    if (!v.ok) return { ok: false, error: v.error ?? "Cupón inválido" };
    cupon = { tipo: v.tipo!, valor: v.valor! };
    cuponCodigo = v.codigo!;
  }

  // Tarjeta de cortes: si la venta incluye un corte y hay cliente, el 5º corte
  // del ciclo va 50% y el 10º gratis (topado al precio del corte base de la sede).
  // El conteo se deriva de las ventas previas; se recomputa acá (fuente de verdad).
  // Cuenta con supabaseAdmin(): la RLS 0010 scopea las ventas por barbero, así que
  // la sesión del barbero undercontaría el historial del cliente entre barberos.
  let beneficioTarjeta: "50%" | "gratis" | null = null;
  let descuentoTarjeta = 0;
  let tarjetaPos = 0;
  let cortesPrevios = 0;
  if (input.clienteRef) {
    const admin = supabaseAdmin();
    const corteIds = await getCorteIds(admin);
    const corteItem = items
      .filter((it) => it.tipo === "servicio" && corteIds.includes(it.ref_id as string))
      .sort((a, b) => (b.precio_unitario as number) - (a.precio_unitario as number))[0];
    if (corteItem) {
      cortesPrevios = await contarCortesCliente(admin, input.clienteRef);
      const base = await precioCorteBase(admin, input.sede);
      const b = beneficioProximoCorte(cortesPrevios, base);
      beneficioTarjeta = b.tipo;
      tarjetaPos = b.posicion;
      descuentoTarjeta = Math.min(b.descuento, corteItem.precio_unitario as number);
    }
  }

  // Matemática del cobro (pura, testeada en scripts/check-cobro.ts):
  // total neto SIN propina; puntos sobre el neto.
  const cobro = calcularCobro({
    items: items.map((it) => ({ precio: it.precio_unitario as number, cantidad: it.cantidad as number })),
    cupon,
    propina: input.propina,
    descuentoExtra: descuentoTarjeta,
  });
  const nota = (input.nota ?? "").trim() || null;

  // --- Orden anti doble cobro ---
  // 1) Claim de la reserva ANTES de crear la venta: solo una llamada pasa el
  //    update condicional; la otra ve 0 filas y no cobra de nuevo.
  let estadoAnterior: string | null = null;
  if (input.reservaId) {
    const { data: prev, error: prevErr } = await sb
      .from("reservas")
      .select("estado")
      .eq("id", input.reservaId)
      .maybeSingle();
    if (prevErr) return { ok: false, error: errorPublico("completarReserva reserva", prevErr) };
    if (!prev) return { ok: false, error: "Reserva no encontrada o sin permiso" };
    estadoAnterior = (prev as { estado: string }).estado;

    const { data: claimed, error: claimErr } = await sb
      .from("reservas")
      .update({ estado: "completada" })
      .eq("id", input.reservaId)
      .in("estado", ["pendiente", "confirmada", "en_curso"])
      .select("id");
    if (claimErr) return { ok: false, error: errorPublico("completarReserva claim", claimErr) };
    if (!claimed || claimed.length === 0) {
      return { ok: false, error: "Esta cita ya fue cobrada o cancelada." };
    }
  }

  // Revierte el claim si algo posterior falla (deja la reserva cobrable de nuevo).
  async function revertirClaim() {
    if (!input.reservaId || !estadoAnterior) return;
    const { error: revErr } = await sb.from("reservas").update({ estado: estadoAnterior }).eq("id", input.reservaId);
    if (revErr) errorPublico("completarReserva revertir", revErr);
  }

  // 2) Reservar el uso del cupón ANTES de armar/insertar la venta. bump_cupon_uso
  //    es atómico (0008: incrementa solo si usos < usos_max, devuelve found), así
  //    que reservar el uso primero cierra la carrera de dos cobros casi simultáneos
  //    con un cupón de 1 uso: solo uno consigue el uso, el otro se rechaza acá SIN
  //    haber cobrado el descuento. Antes el bump iba al final y su `false` (tope
  //    alcanzado) se ignoraba → ambos cobros aplicaban el mismo cupón.
  //    TRADEOFF documentado: si la venta/ítems fallan DESPUÉS de este bump, el uso
  //    queda consumido (no hay decremento: cupones es escritura solo-admin por RLS
  //    y agregar una RPC de reverso excede este fix). Es un caso raro y el peor
  //    resultado es que un cupón quede "gastado" sin cobro — nunca un doble cobro.
  if (cuponCodigo) {
    const { data: bumped, error: cupErr } = await sb.rpc("bump_cupon_uso", { p_codigo: cuponCodigo });
    if (cupErr) {
      await revertirClaim();
      return { ok: false, error: errorPublico("completarReserva bump_cupon_uso", cupErr, "No se pudo aplicar el cupón. Intentá de nuevo.") };
    }
    if (bumped === false) {
      await revertirClaim();
      return { ok: false, error: "Cupón agotado." };
    }
  }

  // 3) La venta. Los unique index ventas_reserva_unica (reserva) y ventas_idem_unica
  //    (venta rápida, 0021) son el backstop anti doble-cobro.
  const { data: venta, error } = await sb
    .from("ventas")
    .insert({
      sede_id: input.sede,
      barbero_id: barberoId,
      cliente_ref: input.clienteRef,
      cliente_nombre: !input.clienteRef ? (input.clienteNombre ?? "").trim() || null : null,
      reserva_id: input.reservaId,
      idem_token: idemToken,
      medio,
      total: cobro.total,
      descuento: cobro.descuento,
      cupon_codigo: cuponCodigo,
      propina: cobro.propina,
      beneficio_tarjeta: beneficioTarjeta,
      nota,
    })
    .select("id")
    .single();
  if (error || !venta) {
    // 23505 = ya existe una venta para esta reserva/token: quedó cobrada, no revertir
    // (la venta ganadora ya consumió el uso del cupón; revertirlo lo desharía mal).
    if (error?.code === "23505") {
      const yaMsg = input.reservaId ? "Esta cita ya fue cobrada." : "Esta venta ya fue cobrada.";
      return { ok: false, error: errorPublico("completarReserva", error, yaMsg) };
    }
    await revertirClaim();
    return { ok: false, error: errorPublico("completarReserva", error, "No se pudo completar el cobro. Intentá de nuevo.") };
  }
  const ventaId = (venta as { id: string }).id;

  // 4) Los ítems. Si fallan, NO puede quedar la venta huérfana: se borra la
  //    venta y se revierte la reserva para reintentar el cobro completo.
  if (items.length) {
    const { error: itemsErr } = await sb.from("venta_items").insert(items.map((it) => ({ ...it, venta_id: ventaId })));
    if (itemsErr) {
      const { error: delErr } = await sb.from("ventas").delete().eq("id", ventaId);
      if (delErr) errorPublico("completarReserva borrar venta", delErr);
      await revertirClaim();
      return { ok: false, error: errorPublico("completarReserva items", itemsErr, "No se pudieron registrar los consumos de la venta. Intentá de nuevo.") };
    }
  }

  // 5) Auto-open de caja: la venta ya quedó registrada (con sus ítems), así que
  //    esta es la primera venta que abre la caja del día si estaba cerrada. Es
  //    best-effort: envuelto para que una caja que no abrió JAMÁS tumbe el cobro.
  try {
    await asegurarCajaAbierta(supabaseAdmin(), input.sede);
  } catch (e) {
    errorPublico("completarReserva auto-open caja", e as { message?: string });
  }

  // 6) Efectos secundarios: la venta ya quedó registrada; si algo de esto falla
  //    NO se aborta el cobro, pero SIEMPRE queda log (nunca tragar en silencio).
  //    (El uso del cupón ya se reservó en el paso 2, antes de la venta.)
  for (const it of items) {
    if (it.tipo !== "producto") continue;
    const { error: stockErr } = await sb.rpc("decrement_stock", { p_id: it.ref_id, p_qty: it.cantidad });
    if (stockErr) errorPublico("completarReserva decrement_stock", stockErr);
  }
  // Fidelidad: puntos por el neto cobrado (sin propina), solo si el cliente está inscrito.
  let puntos = input.clienteRef ? cobro.puntos : 0;
  if (input.clienteRef && puntos > 0) {
    const { data: cli } = await sb.from("clientes").select("fidelizado").eq("id", input.clienteRef).maybeSingle();
    if ((cli as { fidelizado?: boolean } | null)?.fidelizado === false) puntos = 0;
    if (puntos > 0) {
      const { error: ptsErr } = await sb.from("puntos_mov").insert({
        cliente_ref: input.clienteRef,
        tipo: "ganado",
        puntos,
        venta_id: ventaId,
        nota: "Compra",
      });
      if (ptsErr) {
        errorPublico("completarReserva puntos_mov", ptsErr);
        puntos = 0;
      }
    }
  }

  // Push post-servicio: invita a calificar la visita en /cuenta. Solo para citas
  // reales (con reserva y cliente vinculado); la venta rápida no tiene qué calificar.
  // Fire-and-forget DESPUÉS del éxito del cobro: pushACliente jamás lanza.
  if (input.reservaId && input.clienteRef) {
    await pushACliente(input.clienteRef, {
      title: "¿Cómo estuvo tu corte? ✂️",
      body: "Contanos con una calificación. Te toma 10 segundos.",
      url: "/cuenta",
      tag: "califica",
    });
  }

  // Link de reseña de Google de la sede (best-effort) para el "¡Cobrado!": el
  // barbero invita al cliente a dejar la reseña al terminar. Nunca tumba el cobro.
  let resenaUrl: string | null = null;
  {
    const { data: sedeRow } = await supabaseAdmin()
      .from("sedes")
      .select("google_review_url")
      .eq("id", input.sede)
      .maybeSingle();
    resenaUrl = (sedeRow as { google_review_url?: string | null } | null)?.google_review_url ?? null;
  }

  revalidatePath("/barbero");
  revalidatePath("/admin/inventario");
  return {
    ok: true,
    total: cobro.total,
    descuento: cobro.descuento,
    propina: cobro.propina,
    puntos,
    resenaUrl,
    // Estado de la tarjeta post-venta (solo si esta venta tenía un corte).
    tarjeta:
      tarjetaPos > 0
        ? { cortesTotales: cortesPrevios + 1, posicion: tarjetaPos, beneficio: beneficioTarjeta }
        : undefined,
  };
}

// ---------- Búsqueda global (paleta Ctrl-K del admin) ----------
export type BusquedaGlobal = {
  clientes: { id: string; nombre: string; telefono: string }[];
  productos: { id: string; nombre: string; stock: number; sede: string }[];
};

// Busca clientes (nombre/teléfono) y productos (nombre) para la paleta de
// comandos. Solo admin: expone PII de clientes de ambas sedes.
export async function buscarGlobal(q: string): Promise<BusquedaGlobal> {
  const vacio: BusquedaGlobal = { clientes: [], productos: [] };
  const s = (q ?? "").trim();
  if (s.length < 2) return vacio;
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return vacio;
  // Sin metacaracteres de ilike ni comas (separador del .or() de PostgREST).
  const like = `%${s.replace(/[%_,()]/g, "")}%`;
  const [cliRes, prodRes] = await Promise.all([
    sb
      .from("clientes")
      .select("id,nombre,telefono")
      .or(`nombre.ilike.${like},telefono.ilike.${like}`)
      .order("nombre")
      .limit(5),
    sb.from("productos").select("id,nombre,stock,sede_id").ilike("nombre", like).order("nombre").limit(5),
  ]);
  return {
    clientes: ((cliRes.data ?? []) as Record<string, unknown>[]).map((c) => ({
      id: c.id as string,
      nombre: (c.nombre as string) ?? "Cliente",
      telefono: (c.telefono as string) ?? "",
    })),
    productos: ((prodRes.data ?? []) as Record<string, unknown>[]).map((p) => ({
      id: p.id as string,
      nombre: p.nombre as string,
      stock: (p.stock as number) ?? 0,
      sede: p.sede_id as string,
    })),
  };
}

// ---------- Cupones (admin) + canje de puntos ----------
export async function crearCupon(input: {
  codigo: string;
  descripcion: string;
  tipo: "porcentaje" | "monto";
  valor: number;
  usosMax: number | null;
  venceEn: string | null;
}): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };
  const code = input.codigo.trim().toUpperCase();
  if (!code) return { ok: false, error: "Código requerido" };
  if (!input.valor || input.valor <= 0) return { ok: false, error: "Valor inválido" };
  if (input.tipo === "porcentaje" && input.valor > 100) return { ok: false, error: "El porcentaje no puede superar 100" };
  const { error } = await sb.from("cupones").insert({
    codigo: code,
    descripcion: input.descripcion || null,
    tipo: input.tipo,
    valor: input.valor,
    usos_max: input.usosMax,
    vence_en: input.venceEn,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Ya existe un cupón con ese código." };
    return { ok: false, error: errorPublico("crearCupon", error) };
  }
  revalidatePath("/admin/cupones");
  return { ok: true };
}

export async function toggleCupon(codigo: string, activo: boolean): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };
  const { error } = await sb.from("cupones").update({ activo }).eq("codigo", codigo);
  if (error) return { ok: false, error: errorPublico("toggleCupon", error) };
  revalidatePath("/admin/cupones");
  return { ok: true };
}

export async function canjearPuntos(input: { clienteRef: string; puntos: number; nota: string }): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };
  if (!input.puntos || input.puntos <= 0) return { ok: false, error: "Puntos inválidos" };
  // Verifica saldo disponible.
  const { data } = await sb.from("puntos_mov").select("tipo,puntos").eq("cliente_ref", input.clienteRef);
  const saldo = ((data ?? []) as { tipo: string; puntos: number }[]).reduce(
    (a, m) => a + (m.tipo === "ganado" ? m.puntos : -m.puntos),
    0,
  );
  if (input.puntos > saldo) return { ok: false, error: `Saldo insuficiente (${saldo} pts)` };
  const { error } = await sb.from("puntos_mov").insert({
    cliente_ref: input.clienteRef,
    tipo: "canjeado",
    puntos: input.puntos,
    nota: input.nota || "Canje",
  });
  if (error) return { ok: false, error: errorPublico("canjearPuntos", error) };
  revalidatePath(`/admin/clientes/${input.clienteRef}`);
  return { ok: true };
}

export async function historialCliente(clienteRef: string) {
  const { getHistorialCliente } = await import("@/lib/data/queries");
  return getHistorialCliente(clienteRef);
}

export async function registrarGasto(input: {
  sede: string;
  categoria: string;
  monto: number;
  descripcion: string;
}): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };
  const { error } = await sb.from("gastos").insert({
    sede_id: input.sede,
    categoria: input.categoria,
    monto: input.monto,
    descripcion: input.descripcion || null,
  });
  if (error) return { ok: false, error: errorPublico("registrarGasto", error) };
  revalidatePath("/admin/cuadre");
  revalidatePath("/admin");
  return { ok: true };
}

export async function registrarAdelanto(input: {
  barberoId: string;
  monto: number;
  nota: string;
}): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };
  const { error } = await sb.from("adelantos").insert({
    barbero_id: input.barberoId,
    monto: input.monto,
    saldo: input.monto,
    nota: input.nota || null,
  });
  if (error) return { ok: false, error: errorPublico("registrarAdelanto", error) };
  revalidatePath("/admin/cuadre");
  revalidatePath("/admin");
  return { ok: true };
}

// ---------- CRM de cliente: notas, wallet, reseñas ----------
export async function agregarNotaCliente(input: { clienteRef: string; nota: string }): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };
  if (!input.nota.trim()) return { ok: false, error: "Escribí la nota" };
  const { error } = await sb.from("cliente_notas").insert({ cliente_ref: input.clienteRef, nota: input.nota.trim() });
  if (error) return { ok: false, error: errorPublico("agregarNotaCliente", error) };
  revalidatePath(`/admin/clientes/${input.clienteRef}`);
  return { ok: true };
}

export async function agregarMovWallet(input: {
  clienteRef: string;
  tipo: "recarga" | "consumo";
  monto: number;
  nota: string;
}): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };
  if (!input.monto || input.monto <= 0) return { ok: false, error: "Monto inválido" };
  const { error } = await sb.from("cliente_wallet_mov").insert({
    cliente_ref: input.clienteRef,
    tipo: input.tipo,
    monto: input.monto,
    nota: input.nota || null,
  });
  if (error) return { ok: false, error: errorPublico("agregarMovWallet", error) };
  revalidatePath(`/admin/clientes/${input.clienteRef}`);
  return { ok: true };
}

export async function agregarResenaCliente(input: {
  clienteRef: string;
  barberoId: string;
  score: number;
  nota: string;
}): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };
  if (input.score < 1 || input.score > 5) return { ok: false, error: "Puntaje 1 a 5" };
  const { error } = await sb.from("cliente_resenas").insert({
    cliente_ref: input.clienteRef,
    barbero_id: input.barberoId || null,
    score: input.score,
    nota: input.nota || null,
  });
  if (error) return { ok: false, error: errorPublico("agregarResenaCliente", error) };
  revalidatePath(`/admin/clientes/${input.clienteRef}`);
  return { ok: true };
}

// ---------- Sesiones de caja (abrir / cerrar) ----------
export async function abrirCaja(input: {
  sede: string;
  metaDia: number;
  montoApertura: number;
}): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };
  const { error } = await sb.from("caja_sesiones").insert({
    sede_id: input.sede,
    meta_dia: input.metaDia,
    monto_apertura: input.montoApertura,
    estado: "abierta",
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Ya hay una caja abierta en esa sede." };
    return { ok: false, error: errorPublico("abrirCaja", error) };
  }
  revalidatePath("/admin/cuadre");
  revalidatePath("/admin");
  return { ok: true };
}

// Snapshot puro de lo recaudado desde la apertura, desglosado por medio. Lo
// comparten el cierre admin (cerrarCaja) y el cierre del barbero (cerrarCajaSede),
// para que la matemática de la plata sea UNA sola: esperado en el cajón =
// fondo de apertura + efectivo + propina cobrada en efectivo − gastos. `admin`
// es un SupabaseClient (la RLS de caja es admin-only, pero ventas/gastos las lee
// cualquiera de los dos clientes). `montoApertura` es el fondo que ya estaba en
// el cajón al abrir (0 en las cajas auto-abiertas por el barbero).
async function snapshotCaja(
  admin: SupabaseClient,
  sedeId: string,
  abiertaEnISO: string,
  montoApertura: number,
): Promise<{
  totales: ReturnType<typeof snapshotDinero>["totales"];
  efectivo: number;
  datafono: number;
  totalGastos: number;
  esperadoEfectivo: number;
  citas: number;
}> {
  const { data: ventas } = await admin
    .from("ventas")
    .select("medio,total,propina")
    .eq("sede_id", sedeId)
    .gte("creado_en", abiertaEnISO);
  const vs = (ventas ?? []) as { medio: string; total: number; propina: number | null }[];
  const { data: gastos } = await admin
    .from("gastos")
    .select("monto")
    .eq("sede_id", sedeId)
    .gte("creado_en", abiertaEnISO);
  const totalGastos = ((gastos ?? []) as { monto: number }[]).reduce((a, g) => a + g.monto, 0);
  // Matemática pura del snapshot (misma que testea scripts/check-caja.ts): el
  // esperado incluye el fondo de apertura y descuenta los gastos del cajón.
  const { totales, efectivo, datafono, esperadoEfectivo } = snapshotDinero(vs, {
    montoApertura,
    totalGastos,
  });
  return { totales, efectivo, datafono, totalGastos, esperadoEfectivo, citas: vs.length };
}

// Cierre de caja UNIFICADO: la MISMA función que ejecutan el cierre admin
// (cerrarCaja) y el del barbero (cerrarCajaSede), para que la matemática y el
// guard de idempotencia no vuelvan a divergir. El update es CONDICIONAL a
// 'abierta' + .select("id"): si otra llamada ya la cerró en la carrera (o el
// admin cierra sobre una UI vieja tras el cierre del barbero), 0 filas → no
// pisa el conteo del que la cerró primero, avisa "La caja ya fue cerrada.".
async function ejecutarCierreCaja(
  client: SupabaseClient,
  params: {
    sesionId: string;
    sede: string;
    abiertaEnISO: string;
    montoApertura: number;
    efectivoContado: number;
    nota: string | null;
    cerradaPor?: string | null;
  },
): Promise<
  | { ok: true; snap: Awaited<ReturnType<typeof snapshotCaja>>; diferencia: number }
  | { ok: false; error: string }
> {
  const snap = await snapshotCaja(client, params.sede, params.abiertaEnISO, params.montoApertura);
  const diferencia = diferenciaCaja(params.efectivoContado, snap.esperadoEfectivo);
  // Columnas legacy pobladas por compat (histórico y UI vieja) + snapshot jsonb.
  const update: Record<string, unknown> = {
    estado: "cerrada",
    cerrada_en: new Date().toISOString(),
    total_efectivo: snap.efectivo,
    total_datafono: snap.datafono,
    totales: snap.totales,
    total_gastos: snap.totalGastos,
    citas: snap.citas,
    efectivo_contado: params.efectivoContado,
    diferencia,
    nota: params.nota,
  };
  // cerrada_por solo lo setea el cierre del barbero (trazabilidad del email).
  if (params.cerradaPor !== undefined) update.cerrada_por = params.cerradaPor;

  const { data: cerrada, error } = await client
    .from("caja_sesiones")
    .update(update)
    .eq("id", params.sesionId)
    .eq("estado", "abierta")
    .select("id");
  if (error) return { ok: false, error: errorPublico("ejecutarCierreCaja", error) };
  if (!cerrada || cerrada.length === 0) return { ok: false, error: "La caja ya fue cerrada." };
  return { ok: true, snap, diferencia };
}

export async function cerrarCaja(input: {
  sesionId: string;
  sede: string;
  abiertaEnISO: string;
  efectivoContado: number;
  nota: string;
}): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };
  // El fondo de apertura sale de la sesión (el admin lo pudo setear al abrir).
  const { data: ses } = await sb
    .from("caja_sesiones")
    .select("monto_apertura")
    .eq("id", input.sesionId)
    .maybeSingle();
  const montoApertura = Number((ses as { monto_apertura?: number | null } | null)?.monto_apertura ?? 0);

  const res = await ejecutarCierreCaja(sb, {
    sesionId: input.sesionId,
    sede: input.sede,
    abiertaEnISO: input.abiertaEnISO,
    montoApertura,
    efectivoContado: input.efectivoContado,
    nota: input.nota || null,
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/admin/cuadre");
  revalidatePath("/admin");
  return { ok: true };
}

export type CierreCajaResult = {
  ok: boolean;
  error?: string;
  total?: number;
  diferencia?: number;
  esperado?: number;
};

// Cierre de caja por el BARBERO de la sede (o el admin como override). El barbero
// cierra SÓLO su sede (se ignora input.sede). caja_sesiones es RLS admin-only
// (0008): por eso el trabajo va con supabaseAdmin() detrás del gate requireStaff.
export async function cerrarCajaSede(input: {
  efectivoContado: number;
  nota?: string;
  sede?: string;
}): Promise<CierreCajaResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireStaff(sb);
  if (denied) return { ok: false, error: denied };
  const staff = await getStaffContext();
  if (staff.rol !== "admin" && staff.rol !== "barbero") return { ok: false, error: "No autorizado" };

  const admin = supabaseAdmin();

  // La sede: el barbero cierra la SUYA (buscada por su barbero_id, ignora input);
  // el admin elige explícitamente.
  let sede: string | null = null;
  if (staff.rol === "barbero") {
    if (!staff.barberoId) return { ok: false, error: "No se pudo determinar tu sede." };
    const { data: barb } = await admin.from("barberos").select("sede_id").eq("id", staff.barberoId).maybeSingle();
    sede = (barb as { sede_id?: string } | null)?.sede_id ?? null;
    if (!sede) return { ok: false, error: "No se pudo determinar tu sede." };
  } else {
    sede = (input.sede ?? "").trim() || null;
    if (!sede) return { ok: false, error: "Elegí una sede." };
  }

  // Efectivo contado: entero COP ≥ 0.
  const efectivoContado = Math.floor(Number(input.efectivoContado));
  if (!Number.isFinite(efectivoContado) || efectivoContado < 0)
    return { ok: false, error: "Ingresá el efectivo contado (un número igual o mayor a 0)." };

  // Caja abierta de la sede.
  const { data: sesion, error: selErr } = await admin
    .from("caja_sesiones")
    .select("id,abierta_en,monto_apertura")
    .eq("sede_id", sede)
    .eq("estado", "abierta")
    .maybeSingle();
  if (selErr) return { ok: false, error: errorPublico("cerrarCajaSede select", selErr) };
  if (!sesion) return { ok: false, error: "No hay una caja abierta en esta sede." };
  const ses = sesion as { id: string; abierta_en: string; monto_apertura: number | null };

  // profile.id del que cierra → cerrada_por (para el email y la trazabilidad).
  const {
    data: { user },
  } = await sb.auth.getUser();
  let cerradaPor: string | null = null;
  if (user) {
    const { data: prof } = await admin.from("profiles").select("id").eq("auth_id", user.id).maybeSingle();
    cerradaPor = (prof as { id?: string } | null)?.id ?? null;
  }

  // Cierre unificado (mismo guard de idempotencia que el cierre admin). Las cajas
  // auto-abiertas por el barbero tienen monto_apertura = 0 (sin fondo).
  const res = await ejecutarCierreCaja(admin, {
    sesionId: ses.id,
    sede,
    abiertaEnISO: ses.abierta_en,
    montoApertura: Number(ses.monto_apertura ?? 0),
    efectivoContado,
    nota: (input.nota ?? "").trim() || null,
    cerradaPor,
  });
  if (!res.ok) return { ok: false, error: res.error };
  const snap = res.snap;
  const diferencia = res.diferencia;

  const total = Object.values(snap.totales).reduce((a, t) => a + t.total, 0);
  revalidatePath("/barbero");
  revalidatePath("/admin");
  revalidatePath("/admin/cuadre");
  return { ok: true, total, diferencia, esperado: snap.esperadoEfectivo };
}

// ---------- Medios de pago (admin) ----------
// slug = nombre en minúsculas, sin tildes, espacios → guiones (ej. "Nequi QR" → "nequi-qr").
function slugDeMedio(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export async function crearMedioPago(nombre: string): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };
  const nom = (nombre ?? "").trim();
  const slug = slugDeMedio(nom);
  if (!nom || !slug) return { ok: false, error: "Escribí el nombre del medio de pago" };
  // Va al final de la lista: orden = max + 1.
  const { data: last } = await sb
    .from("medios_pago")
    .select("orden")
    .order("orden", { ascending: false })
    .limit(1);
  const orden = ((last?.[0] as { orden?: number } | undefined)?.orden ?? 0) + 1;
  const { error } = await sb.from("medios_pago").insert({ slug, nombre: nom, activo: true, orden });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Ya existe un medio de pago con ese nombre." };
    return { ok: false, error: errorPublico("crearMedioPago", error) };
  }
  revalidatePath("/admin/cuadre");
  revalidatePath("/barbero");
  return { ok: true };
}

// Sin delete: el histórico de ventas referencia el slug por FK; solo se desactiva.
export async function toggleMedioPago(slug: string, activo: boolean): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };
  const { data, error } = await sb.from("medios_pago").update({ activo }).eq("slug", slug).select("slug");
  if (error) return { ok: false, error: errorPublico("toggleMedioPago", error) };
  if (!data || data.length === 0) return { ok: false, error: "Medio de pago no encontrado" };
  revalidatePath("/admin/cuadre");
  revalidatePath("/barbero");
  return { ok: true };
}

// Lista de espera (motor de la "notificación alternativa").
export async function agregarListaEspera(input: {
  sede: string;
  barberoId: string;
  servicioId: string;
  clienteNombre: string;
  telefono: string;
}): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireStaff(sb);
  if (denied) return { ok: false, error: denied };
  const clienteRef = await upsertClienteId(sb, input.clienteNombre, input.telefono, "", "walkin");
  const { error } = await sb.from("lista_espera").insert({
    sede_id: input.sede,
    barbero_id: input.barberoId || null,
    servicio_id: input.servicioId || null,
    cliente_ref: clienteRef,
    cliente_nombre: input.clienteNombre.trim() || null,
    telefono: input.telefono.trim() || null,
    estado: "esperando",
  });
  if (error) return { ok: false, error: errorPublico("agregarListaEspera", error) };
  revalidatePath("/barbero");
  return { ok: true };
}

// Atender ahora a alguien de la lista de espera: crea la atención en_curso y lo saca de la cola.
// Reclama la entrada de forma atómica ('asignado' sale del filtro de la cola) para evitar
// doble atención / carrera con cancelación; revierte el claim si no se pudo crear la atención.
export async function servirEspera(id: string): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const staff = await getStaffContext();
  if (staff.rol !== "admin" && staff.rol !== "barbero") return { ok: false, error: "No autorizado" };
  // Claim atómico: solo una llamada gana, y solo si sigue en la cola.
  const { data: claimed } = await sb
    .from("lista_espera")
    .update({ estado: "asignado" })
    .eq("id", id)
    .in("estado", ["esperando", "notificado"])
    .select("sede_id,barbero_id,servicio_id,cliente_ref,cliente_nombre,telefono");
  const ent = (claimed?.[0] ?? null) as {
    sede_id: string; barbero_id: string | null; servicio_id: string | null;
    cliente_ref: string | null; cliente_nombre: string | null; telefono: string | null;
  } | null;
  if (!ent) return { ok: false, error: "Esa espera ya fue atendida o cancelada" };

  async function revertir() {
    await sb.from("lista_espera").update({ estado: "esperando" }).eq("id", id);
  }

  // El barbero se atiende a sí mismo; el admin usa el barbero asignado en la espera.
  const barberoId = staff.rol === "barbero" ? staff.barberoId : ent.barbero_id;
  if (!barberoId) {
    await revertir();
    return { ok: false, error: "Asigná un barbero a esta espera primero" };
  }
  const clienteRef =
    ent.cliente_ref ?? (await upsertClienteId(sb, ent.cliente_nombre ?? "", ent.telefono ?? "", "", "walkin"));
  const now = new Date();
  let dur = 30;
  if (ent.servicio_id) {
    const { data: serv } = await sb.from("servicios").select("duracion_min").eq("id", ent.servicio_id).maybeSingle();
    dur = (serv as { duracion_min?: number } | null)?.duracion_min ?? 30;
  }
  const fin = new Date(now.getTime() + dur * 60000);
  const { error } = await sb.from("reservas").insert({
    sede_id: ent.sede_id,
    barbero_id: barberoId,
    servicio_id: ent.servicio_id,
    cliente_ref: clienteRef,
    inicio: now.toISOString(),
    fin: fin.toISOString(),
    estado: "en_curso",
    canal: "walkin",
  });
  if (error) {
    await revertir();
    if (error.code === "23P01") return { ok: false, error: "El barbero sigue ocupado ahora mismo." };
    return { ok: false, error: errorPublico("servirEspera", error) };
  }
  revalidatePath("/barbero");
  return { ok: true };
}

export async function actualizarListaEspera(id: string, estado: string): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireStaff(sb);
  if (denied) return { ok: false, error: denied };
  const { error } = await sb.from("lista_espera").update({ estado }).eq("id", id);
  if (error) return { ok: false, error: errorPublico("actualizarListaEspera", error) };
  revalidatePath("/barbero");
  return { ok: true };
}

export async function proponerAdelanto(input: {
  reservaId: string;
  inicioISO: string;
}): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireStaff(sb);
  if (denied) return { ok: false, error: denied };

  const admin = supabaseAdmin();
  // cliente_ref apunta a `clientes` (cliente_id era la columna legacy de profiles, siempre null).
  const { data: res, error: getErr } = await admin
    .from("reservas")
    .select("id, nota, cliente_ref, servicio_id")
    .eq("id", input.reservaId)
    .maybeSingle();

  if (getErr || !res) return { ok: false, error: "Reserva no encontrada." };

  // Fetch service duration
  let dur = 30;
  if (res.servicio_id) {
    const { data: serv } = await admin
      .from("servicios")
      .select("duracion_min")
      .eq("id", res.servicio_id)
      .maybeSingle();
    dur = (serv as { duracion_min?: number } | null)?.duracion_min ?? 30;
  }
  const fin = new Date(new Date(input.inicioISO).getTime() + dur * 60000);

  let notaObj: Record<string, unknown> = {};
  try {
    notaObj = JSON.parse(res.nota || "{}");
  } catch {
    notaObj = { text: res.nota || "" };
  }

  notaObj.propuesta_adelanto = {
    inicio: input.inicioISO,
    fin: fin.toISOString(),
    estado: "pendiente",
    creado_en: new Date().toISOString(),
  };

  const { error: updErr } = await admin
    .from("reservas")
    .update({
      nota: JSON.stringify(notaObj),
    })
    .eq("id", input.reservaId);

  if (updErr) return { ok: false, error: errorPublico("proponerAdelanto", updErr) };

  // Aviso real al cliente DESPUÉS del éxito (fire-and-forget: jamás lanza).
  if (res.cliente_ref) {
    await pushACliente(res.cliente_ref, {
      title: "Te ofrecemos adelantar tu cita",
      body: `Hay un cupo más temprano: ${fechaHoraBogota(new Date(input.inicioISO))}. Entrá para aceptar o rechazar.`,
      url: "/cuenta",
    });
  }

  revalidatePath("/barbero");
  revalidatePath("/cuenta");
  return { ok: true };
}

export type BarberLiveStatus = {
  id: string;
  nombre: string;
  sede: string;
  sedeId: string;
  fotoUrl: string | null;
  status: "disponible" | "ocupado" | "no_activo";
  servicioActual?: string;
  terminaA?: string;
};

export async function getLiveBarberStatuses(): Promise<BarberLiveStatus[]> {
  const admin = supabaseAdmin();
  
  // Fetch active barbers with names, sedes, and photos
  const { data: bData } = await admin
    .from("barberos")
    .select("id, nombre, sede_id, foto_url")
    .eq("activo", true);
    
  if (!bData) return [];
  
  const now = new Date();
  // "Hoy" es el día civil en Bogotá (el server corre en UTC).
  const { desde, hasta } = bogotaDayRange(now);

  // Fetch reservations for today
  const { data: rData } = await admin
    .from("reservas")
    .select("id, inicio, fin, estado, barbero_id, servicios(nombre)")
    .not("estado", "in", "(cancelada,no_show)")
    .gte("inicio", desde.toISOString())
    .lt("inicio", hasta.toISOString());
    
  const result: BarberLiveStatus[] = bData.map((b) => {
    const activeRes = rData?.find((r) => {
      if (r.barbero_id !== b.id) return false;
      const rStart = new Date(r.inicio).getTime();
      const rFin = new Date(r.fin).getTime();
      const curTime = now.getTime();
      return curTime >= rStart && curTime <= rFin && ["confirmada", "en_curso"].includes(r.estado);
    });
    
    return {
      id: b.id,
      nombre: b.nombre,
      sede: b.sede_id === "parque-venezuela" ? "Parque Venezuela" : "Plaza de la Paz",
      sedeId: b.sede_id,
      fotoUrl: b.foto_url,
      status: activeRes ? "ocupado" : "disponible",
      servicioActual: activeRes ? (activeRes.servicios as { nombre?: string } | null)?.nombre : undefined,
      terminaA: activeRes ? new Date(activeRes.fin).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" }) : undefined,
    };
  });
  
  return result;
}

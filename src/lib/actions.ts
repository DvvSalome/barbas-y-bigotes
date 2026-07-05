"use server";

import { revalidatePath } from "next/cache";
import { type SupabaseClient } from "@supabase/supabase-js";
import { supabaseServerAuth, supabaseAdmin } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/data/queries";
import { clienteIdForUser } from "@/lib/cliente-actions";
import { bogotaDayRange, bogotaYmd } from "@/lib/slots";
import { errorPublico } from "@/lib/errors";

export type ActionResult = { ok: boolean; error?: string; total?: number; descuento?: number; puntos?: number; encolado?: boolean; esperaHasta?: string | null };

// Fidelidad: el cliente gana 1 punto por cada $1.000 cobrados (neto).
const PUNTOS_POR_COP = 1000;

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

function calcDescuento(tipo: string, valor: number, total: number): number {
  const d = tipo === "porcentaje" ? Math.round((total * valor) / 100) : valor;
  return Math.max(0, Math.min(d, total)); // nunca más que el total
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
  const { error } = await sb.from("productos").insert({
    nombre: input.nombre,
    sede_id: input.sede,
    precio: input.precio,
    stock: input.stock,
    stock_minimo: input.stockMinimo,
    comision_pct: input.comisionPct,
  });
  if (error) return { ok: false, error: errorPublico("addProducto", error) };
  revalidatePath("/admin/inventario");
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
}): Promise<ActionResult> {
  const sb = supabaseAdmin();
  const inicio = new Date(input.inicioISO);
  const { data: serv } = await sb
    .from("servicios")
    .select("duracion_min")
    .eq("id", input.servicioId)
    .maybeSingle();
  const dur = (serv as { duracion_min?: number } | null)?.duracion_min ?? 30;
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
  const { error } = await sb.from("reservas").insert({
    sede_id: input.sede,
    barbero_id: barberoId,
    servicio_id: input.servicioId,
    cliente_ref: clienteRef,
    inicio: inicio.toISOString(),
    fin: fin.toISOString(),
    estado: "confirmada",
    canal: "app",
  });
  if (error) {
    if (error.code === "23P01") return { ok: false, error: "Ese horario ya fue tomado. Elegí otro, por favor." };
    return { ok: false, error: errorPublico("createReserva", error) };
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
    .select("inicio,fin")
    .eq("barbero_id", input.barberoId)
    .not("estado", "in", "(cancelada,no_show)")
    .gte("inicio", desde.toISOString())
    .lt("inicio", hasta.toISOString());
  return ((data ?? []) as { inicio: string; fin: string }[]).map((r) => ({ inicio: r.inicio, fin: r.fin }));
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
  // no afecta filas → avisamos en vez de fingir éxito.
  const { data, error } = await sb.from("reservas").update(patch).eq("id", reservaId).select("id");
  if (error) return { ok: false, error: errorPublico("actualizarReserva", error) };
  if (!data || data.length === 0) return { ok: false, error: "Reserva no encontrada o sin permiso" };
  revalidatePath("/barbero");
  return { ok: true };
}

// Completar la atención: crea la venta (servicio + consumos) y marca la reserva completada.
export async function completarReserva(input: {
  reservaId: string;
  sede: string;
  barberoId: string | null;
  clienteRef: string | null;
  servicioId: string | null;
  medio: string;
  productos: { id: string; cantidad: number }[];
  cuponCodigo?: string;
}): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const staff = await getStaffContext();
  if (staff.rol !== "admin" && staff.rol !== "barbero") return { ok: false, error: "No autorizado" };
  // barbero_id de la venta lo fija el servidor: el barbero cobra a su nombre; el admin puede cobrar por otro.
  const barberoId = staff.rol === "admin" ? input.barberoId : staff.barberoId;
  let total = 0;
  const items: Record<string, unknown>[] = [];

  if (input.servicioId) {
    const [pRes, barbRes] = await Promise.all([
      sb
        .from("servicio_sede")
        .select("precio,servicios(nombre)")
        .eq("sede_id", input.sede)
        .eq("servicio_id", input.servicioId)
        .maybeSingle(),
      barberoId
        ? sb
            .from("barberos")
            .select("tipo_contrato,comision_pct")
            .eq("id", barberoId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const p = pRes.data;
    const barb = barbRes.data;

    let barberComision = 0;
    const barbRow = barb as { tipo_contrato?: string | null; comision_pct?: number | null } | null;
    if (barbRow && barbRow.tipo_contrato === "porcentaje") {
      barberComision = barbRow.comision_pct != null ? Number(barbRow.comision_pct) : 50;
    }

    if (p) {
      const row = p as Record<string, unknown>;
      total += row.precio as number;
      items.push({
        tipo: "servicio",
        ref_id: input.servicioId,
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
      const pr = ((prods ?? []) as Record<string, unknown>[]).find((x) => x.id === sel.id);
      if (!pr) continue;
      total += (pr.precio as number) * sel.cantidad;
      items.push({
        tipo: "producto",
        ref_id: sel.id,
        descripcion: pr.nombre,
        cantidad: sel.cantidad,
        precio_unitario: pr.precio,
        comision_pct: pr.comision_pct !== null ? Number(pr.comision_pct) : 0,
      });
    }
  }

  // Cupón (opcional): valida y descuenta del total.
  let descuento = 0;
  let cuponCodigo: string | null = null;
  if (input.cuponCodigo && input.cuponCodigo.trim()) {
    const v = await validarCupon(input.cuponCodigo);
    if (!v.ok) return { ok: false, error: v.error ?? "Cupón inválido" };
    descuento = calcDescuento(v.tipo!, v.valor!, total);
    cuponCodigo = v.codigo!;
  }
  const totalNeto = Math.max(0, total - descuento);

  const { data: venta, error } = await sb
    .from("ventas")
    .insert({
      sede_id: input.sede,
      barbero_id: barberoId,
      cliente_ref: input.clienteRef,
      reserva_id: input.reservaId,
      medio: input.medio,
      total: totalNeto,
      descuento,
      cupon_codigo: cuponCodigo,
    })
    .select("id")
    .single();
  if (error || !venta) return { ok: false, error: errorPublico("completarReserva", error, "No se pudo completar el cobro. Intentá de nuevo.") };
  const ventaId = (venta as { id: string }).id;

  if (items.length) {
    const { error: itemsErr } = await sb.from("venta_items").insert(items.map((it) => ({ ...it, venta_id: ventaId })));
    if (itemsErr) return { ok: false, error: errorPublico("completarReserva items", itemsErr, "No se pudieron registrar los consumos de la venta") };
  }
  for (const sel of input.productos) {
    await sb.rpc("decrement_stock", { p_id: sel.id, p_qty: sel.cantidad });
  }
  // Registrar uso del cupón (atómico: incrementa solo si no superó el tope; sin carrera).
  if (cuponCodigo) {
    await sb.rpc("bump_cupon_uso", { p_codigo: cuponCodigo });
  }
  // Fidelidad: puntos por el neto cobrado, solo si el cliente está inscrito.
  let puntos = Math.floor(totalNeto / PUNTOS_POR_COP);
  if (input.clienteRef && puntos > 0) {
    const { data: cli } = await sb.from("clientes").select("fidelizado").eq("id", input.clienteRef).maybeSingle();
    if ((cli as { fidelizado?: boolean } | null)?.fidelizado === false) puntos = 0;
    if (puntos > 0) {
      await sb.from("puntos_mov").insert({
        cliente_ref: input.clienteRef,
        tipo: "ganado",
        puntos,
        venta_id: ventaId,
        nota: "Compra",
      });
    }
  }
  await sb.from("reservas").update({ estado: "completada" }).eq("id", input.reservaId);

  revalidatePath("/barbero");
  revalidatePath("/admin/inventario");
  return { ok: true, total: totalNeto, descuento, puntos };
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
  // Snapshot de lo recaudado desde que se abrió la caja.
  const { data: ventas } = await sb
    .from("ventas")
    .select("medio,total")
    .eq("sede_id", input.sede)
    .gte("creado_en", input.abiertaEnISO);
  const vs = (ventas ?? []) as { medio: string; total: number }[];
  const efectivo = vs.filter((v) => v.medio === "efectivo").reduce((a, v) => a + v.total, 0);
  const datafono = vs.filter((v) => v.medio === "datafono").reduce((a, v) => a + v.total, 0);
  const { data: gastos } = await sb
    .from("gastos")
    .select("monto")
    .eq("sede_id", input.sede)
    .gte("creado_en", input.abiertaEnISO);
  const totalGastos = ((gastos ?? []) as { monto: number }[]).reduce((a, g) => a + g.monto, 0);
  const diferencia = input.efectivoContado - efectivo;

  const { error } = await sb
    .from("caja_sesiones")
    .update({
      estado: "cerrada",
      cerrada_en: new Date().toISOString(),
      total_efectivo: efectivo,
      total_datafono: datafono,
      total_gastos: totalGastos,
      citas: vs.length,
      efectivo_contado: input.efectivoContado,
      diferencia,
      nota: input.nota || null,
    })
    .eq("id", input.sesionId);
  if (error) return { ok: false, error: errorPublico("cerrarCaja", error) };
  revalidatePath("/admin/cuadre");
  revalidatePath("/admin");
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

  let notaObj: any = {};
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

  // aviso real al cliente: Bloque 3 (push+email)

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
      servicioActual: activeRes ? (activeRes.servicios as any)?.nombre : undefined,
      terminaA: activeRes ? new Date(activeRes.fin).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" }) : undefined,
    };
  });
  
  return result;
}

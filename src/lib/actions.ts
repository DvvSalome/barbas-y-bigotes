"use server";

import { revalidatePath } from "next/cache";
import { type SupabaseClient } from "@supabase/supabase-js";
import { supabaseServerAuth, supabaseAdmin } from "@/lib/supabase/server";

export type ActionResult = { ok: boolean; error?: string; total?: number };

async function upsertClienteId(
  sb: SupabaseClient,
  nombre: string,
  telefono: string,
  email = "",
): Promise<string | null> {
  const tel = (telefono ?? "").trim();
  const mail = (email ?? "").trim();
  if (tel) {
    const { data: existing } = await sb
      .from("clientes")
      .select("id,email")
      .eq("telefono", tel)
      .maybeSingle();
    if (existing) {
      const row = existing as { id: string; email: string | null };
      if (mail && !row.email) await sb.from("clientes").update({ email: mail }).eq("id", row.id);
      return row.id;
    }
  }
  const { data } = await sb
    .from("clientes")
    .insert({ nombre: (nombre ?? "").trim() || "Cliente", telefono: tel || null, email: mail || null })
    .select("id")
    .single();
  return (data as { id: string } | null)?.id ?? null;
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
  const { error } = await sb.from("productos").insert({
    nombre: input.nombre,
    sede_id: input.sede,
    precio: input.precio,
    stock: input.stock,
    stock_minimo: input.stockMinimo,
    comision_pct: input.comisionPct,
  });
  if (error) return { ok: false, error: error.message };
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

  const barberoId = input.barberoId || null;
  // Pre-chequeo de solape (UX: evita crear el cliente si el cupo ya está tomado).
  // El EXCLUDE constraint en la DB es la garantía real contra carreras concurrentes.
  if (barberoId) {
    const { data: clash } = await sb
      .from("reservas")
      .select("id")
      .eq("barbero_id", barberoId)
      .not("estado", "in", "(cancelada,no_show)")
      .lt("inicio", fin.toISOString())
      .gt("fin", inicio.toISOString())
      .limit(1);
    if (clash && clash.length) return { ok: false, error: "Ese horario ya fue tomado. Elegí otro, por favor." };
  }

  const clienteRef = await upsertClienteId(sb, input.clienteNombre, input.telefono, input.email ?? "");
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
    return { ok: false, error: error.message };
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
  const day = new Date(input.fechaISO);
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const { data } = await sb
    .from("reservas")
    .select("inicio,fin")
    .eq("barbero_id", input.barberoId)
    .not("estado", "in", "(cancelada,no_show)")
    .gte("inicio", start.toISOString())
    .lt("inicio", end.toISOString());
  return ((data ?? []) as { inicio: string; fin: string }[]).map((r) => ({ inicio: r.inicio, fin: r.fin }));
}

// Walk-in registrado por el barbero (con sesión).
export async function registrarWalkin(input: {
  sede: string;
  barberoId: string;
  servicioId: string;
  clienteNombre: string;
  telefono: string;
}): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const clienteRef = await upsertClienteId(sb, input.clienteNombre, input.telefono);
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
    barbero_id: input.barberoId,
    servicio_id: input.servicioId || null,
    cliente_ref: clienteRef,
    inicio: now.toISOString(),
    fin: fin.toISOString(),
    estado: "en_curso",
    canal: "walkin",
  });
  if (error) {
    if (error.code === "23P01") return { ok: false, error: "Ese barbero ya tiene un cliente en ese horario." };
    return { ok: false, error: error.message };
  }
  revalidatePath("/barbero");
  return { ok: true };
}

export async function actualizarReserva(
  reservaId: string,
  patch: { estado?: string; llegada?: string },
): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const { error } = await sb.from("reservas").update(patch).eq("id", reservaId);
  if (error) return { ok: false, error: error.message };
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
}): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  let total = 0;
  const items: Record<string, unknown>[] = [];

  if (input.servicioId) {
    const { data: p } = await sb
      .from("servicio_sede")
      .select("precio,servicios(nombre)")
      .eq("sede_id", input.sede)
      .eq("servicio_id", input.servicioId)
      .maybeSingle();
    if (p) {
      const row = p as Record<string, unknown>;
      total += row.precio as number;
      items.push({
        tipo: "servicio",
        ref_id: input.servicioId,
        descripcion: (row.servicios as { nombre?: string } | null)?.nombre ?? "Servicio",
        cantidad: 1,
        precio_unitario: row.precio,
      });
    }
  }

  if (input.productos.length) {
    const ids = input.productos.map((p) => p.id);
    const { data: prods } = await sb.from("productos").select("id,nombre,precio").in("id", ids);
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
      });
    }
  }

  const { data: venta, error } = await sb
    .from("ventas")
    .insert({
      sede_id: input.sede,
      barbero_id: input.barberoId,
      cliente_ref: input.clienteRef,
      reserva_id: input.reservaId,
      medio: input.medio,
      total,
    })
    .select("id")
    .single();
  if (error || !venta) return { ok: false, error: error?.message ?? "No se pudo completar" };

  if (items.length) {
    await sb.from("venta_items").insert(
      items.map((it) => ({ ...it, venta_id: (venta as { id: string }).id })),
    );
  }
  for (const sel of input.productos) {
    await sb.rpc("decrement_stock", { p_id: sel.id, p_qty: sel.cantidad });
  }
  await sb.from("reservas").update({ estado: "completada" }).eq("id", input.reservaId);

  revalidatePath("/barbero");
  revalidatePath("/admin/inventario");
  return { ok: true, total };
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
  const { error } = await sb.from("gastos").insert({
    sede_id: input.sede,
    categoria: input.categoria,
    monto: input.monto,
    descripcion: input.descripcion || null,
  });
  if (error) return { ok: false, error: error.message };
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
  const { error } = await sb.from("adelantos").insert({
    barbero_id: input.barberoId,
    monto: input.monto,
    saldo: input.monto,
    nota: input.nota || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/cuadre");
  revalidatePath("/admin");
  return { ok: true };
}

// ---------- Sesiones de caja (abrir / cerrar) ----------
export async function abrirCaja(input: {
  sede: string;
  metaDia: number;
  montoApertura: number;
}): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const { error } = await sb.from("caja_sesiones").insert({
    sede_id: input.sede,
    meta_dia: input.metaDia,
    monto_apertura: input.montoApertura,
    estado: "abierta",
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Ya hay una caja abierta en esa sede." };
    return { ok: false, error: error.message };
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
  if (error) return { ok: false, error: error.message };
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
  const { error } = await sb.from("lista_espera").insert({
    sede_id: input.sede,
    barbero_id: input.barberoId || null,
    servicio_id: input.servicioId || null,
    cliente_nombre: input.clienteNombre.trim() || null,
    telefono: input.telefono.trim() || null,
    estado: "esperando",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/barbero");
  return { ok: true };
}

export async function actualizarListaEspera(id: string, estado: string): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const { error } = await sb.from("lista_espera").update({ estado }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/barbero");
  return { ok: true };
}

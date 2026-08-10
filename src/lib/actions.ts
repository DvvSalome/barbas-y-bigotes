"use server";

import { revalidatePath } from "next/cache";
import {
  sanearCop,
  sanearCantidad,
  sanearComisionPct,
  sanearNombre,
  sanearEspecialidades,
  sanearPrevioHoras,
  slugCombo as slugComboRegla,
  resolverColisionSlug,
  esComboValido,
  extDeMime,
  variantesObsoletas,
  pareceImagen,
  DURACION_MAX_MIN,
} from "@/lib/admin-reglas";
import { type SupabaseClient } from "@supabase/supabase-js";
import { supabaseServerAuth, supabaseAdmin } from "@/lib/supabase/server";
import { getStaffContext, getCorteIds, contarCortesCliente, precioCorteBase, ventasDeSesion } from "@/lib/data/queries";
import { clienteIdForUser } from "@/lib/cliente-actions";
import {
  bogotaDayRange,
  bogotaYmd,
  finEfectivo,
  MARGEN_LLEGADA_HORAS,
  slotEnVentana,
} from "@/lib/slots";
import { ventanaDeDia } from "@/lib/horario";
import { errorPublico } from "@/lib/errors";
import { calcularCobro, snapshotDinero, diferenciaCaja } from "@/lib/cobro";
import { beneficioProximoCorte, type BeneficioTarjeta } from "@/lib/tarjeta";
import { pushACliente, pushABarbero, pushASede } from "@/lib/push";
import { cop, fechaHoraBogota } from "@/lib/format";

export type ActionResult = { ok: boolean; error?: string; /** Se guardó, pero con salvedades que el admin debe ver (p.ej. especialidades descartadas). */ aviso?: string; id?: string; total?: number; descuento?: number; propina?: number; puntos?: number; encolado?: boolean; esperaHasta?: string | null; tarjeta?: { cortesTotales: number; posicion: number; beneficio: BeneficioTarjeta | null }; resenaUrl?: string | null; /** confirm_token de la reserva recién creada: credencial para deshacerla desde la confirmación del wizard. */ token?: string | null };

// --- Autorización (defensa en profundidad; la RLS es la barrera real) ---
// Las server actions corren con la sesión del usuario, pero igual revalidamos el
// rol acá: una action es un endpoint POST invocable directo, no confíes solo en la UI.
// Exportada: la usa tambien el route handler que exporta el CSV de metricas.
export async function requireAdmin(sb: SupabaseClient): Promise<string | null> {
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
  if (!user) return "No autorizado";
  // Antes alcanzaba con estar logueado: un CLIENTE con sesión de Google pasaba
  // este gate. Para casi todas las actions la RLS lo frenaba igual, pero
  // getTarjetaParaCobro corre con supabaseAdmin() (bypassea RLS) y le habría
  // dejado leer los cortes de cualquier cliente sabiendo su UUID. Se pide rol,
  // igual que requireAdmin.
  const { data } = await sb.from("profiles").select("rol").eq("auth_id", user.id).maybeSingle();
  const rol = (data as { rol?: string } | null)?.rol;
  if (!ROLES_MOSTRADOR.includes(rol ?? "")) return "Requiere permiso del equipo";
  return null;
}

/**
 * Quién puede operar el mostrador: el dueño, un barbero con su PIN y —desde
 * 0044— el PERFIL POR SEDE, que es el aparato compartido del local. Se lista en
 * un solo lugar porque el chequeo estaba repetido en cinco actions y agregar el
 * rol nuevo en cuatro de las cinco habría dejado un agujero silencioso: la
 * pantalla entra pero una acción suelta responde "No autorizado".
 */
const ROLES_MOSTRADOR = ["admin", "barbero", "sede"];
const puedeMostrador = (rol: string) => ROLES_MOSTRADOR.includes(rol);

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
  | { ok: true; cortesPrevios: number; posicion: number; tipo: BeneficioTarjeta | null; descuento: number }
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

  // La tabla productos NO tiene CHECKs, así que esta es la única barrera: sin
  // ella entraba un precio negativo o una comisión del 250% tal cual, y el cobro
  // los lee de la base (completarReserva). Reglas en admin-reglas.ts (probadas
  // en scripts/check-admin.ts).
  const nombre = sanearNombre(input.nombre);
  if (!nombre) return { ok: false, error: "Poné el nombre del producto." };
  const precio = sanearCop(input.precio);
  if (precio === null) return { ok: false, error: "El precio tiene que ser un número entero de pesos, sin decimales." };
  const stock = sanearCantidad(input.stock);
  if (stock === null) return { ok: false, error: "El stock tiene que ser un número entero, cero o más." };
  const stockMinimo = sanearCantidad(input.stockMinimo);
  if (stockMinimo === null) return { ok: false, error: "El mínimo tiene que ser un número entero, cero o más." };
  const comisionPct = sanearComisionPct(input.comisionPct);
  if (comisionPct === null) return { ok: false, error: "La comisión tiene que estar entre 0 y 100." };

  const { data: sedeRow } = await sb.from("sedes").select("id").eq("id", input.sede).maybeSingle();
  if (!sedeRow) return { ok: false, error: "Sede inválida." };

  const { data, error } = await sb
    .from("productos")
    .insert({
      nombre,
      sede_id: input.sede,
      precio,
      stock,
      stock_minimo: stockMinimo,
      comision_pct: comisionPct,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: errorPublico("addProducto", error) };
  const productoId = (data as { id: string }).id;
  // Kardex: registrar el stock inicial como 'entrada'. Sin esto el historial del
  // producto arranca sin punto de partida y no cuadra (las ventas ya las anota
  // decrement_stock, y los ajustes ingresar_stock). service_role porque
  // stock_movimientos es RLS restringida; el gate real es requireAdmin de arriba.
  // Best-effort: no tumba la creación del producto.
  if (stock > 0) {
    const { error: movErr } = await supabaseAdmin()
      .from("stock_movimientos")
      .insert({ producto_id: productoId, cantidad: stock, motivo: "entrada", nota: "Inventario inicial" });
    if (movErr) errorPublico("addProducto movimiento inicial", movErr);
  }
  revalidatePath("/admin/inventario");
  // El id permite encadenar la foto opcional (subirFotoProducto) tras crear.
  return { ok: true, id: productoId };
}

// Precio editable desde /admin/inventario. Revalida /reservar porque las
// bebidas del upsell (en_upsell) muestran este precio en el wizard.
export async function actualizarPrecioProducto(id: string, precio: number): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };
  const p = sanearCop(precio);
  if (p === null) return { ok: false, error: "El precio tiene que ser un número entero de pesos, sin decimales." };
  const { error } = await sb.from("productos").update({ precio: p }).eq("id", id);
  if (error) return { ok: false, error: errorPublico("actualizarPrecioProducto", error) };
  revalidatePath("/admin/inventario");
  revalidatePath("/reservar");
  return { ok: true };
}

// Entrada de mercancía: SUMA al stock y deja el rastro (quién, cuándo, cuánto).
// Se suma en la base (RPC) y no se pisa el número: en el local venden mientras
// el dueño registra el pedido que acaba de llegar.
export async function ingresarStock(input: {
  productoId: string;
  cantidad: number;
  motivo?: "entrada" | "ajuste" | "merma";
  nota?: string;
}): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };
  const n = sanearCantidad(input.cantidad);
  if (n === null || n === 0) return { ok: false, error: "Poné cuántas unidades entraron (un número entero)." };

  const { data, error } = await supabaseAdmin().rpc("ingresar_stock", {
    p_producto_id: input.productoId,
    p_cantidad: n,
    p_motivo: input.motivo ?? "entrada",
    p_nota: input.nota ?? null,
    p_barbero_id: null,
  });
  if (error) return { ok: false, error: errorPublico("ingresarStock", error) };
  revalidatePath("/admin/inventario");
  revalidatePath("/barbero");
  return { ok: true, total: data as number };
}

// Corrección de inventario: el dueño contó y hay otra cantidad. Se traduce a un
// movimiento por la DIFERENCIA para que el historial siga cuadrando.
export async function ajustarStock(productoId: string, stockReal: number): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };
  const real = sanearCantidad(stockReal);
  if (real === null || real < 0) return { ok: false, error: "El stock tiene que ser un número entero, 0 o más." };

  const admin = supabaseAdmin();
  const { data: p } = await admin.from("productos").select("stock").eq("id", productoId).maybeSingle();
  if (!p) return { ok: false, error: "No encontramos ese producto." };
  const actual = (p as { stock: number }).stock ?? 0;
  const delta = real - actual;
  if (delta === 0) return { ok: true, total: real };

  const { error } = await admin.rpc("ingresar_stock", {
    p_producto_id: productoId,
    p_cantidad: delta,
    p_motivo: "ajuste",
    p_nota: `Conteo: quedó en ${real}`,
    p_barbero_id: null,
  });
  if (error) return { ok: false, error: errorPublico("ajustarStock", error) };
  revalidatePath("/admin/inventario");
  revalidatePath("/barbero");
  return { ok: true, total: real };
}

// Precio de un servicio EN UNA SEDE. Cada sede cobra distinto, así que la fila
// vive en servicio_sede; si la sede todavía no tenía precio para ese servicio se
// crea (upsert), que es como se habilita un servicio en una sede.
export async function actualizarPrecioServicioSede(
  servicioId: string,
  sedeId: string,
  precio: number,
): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };
  const p = sanearCop(precio);
  if (p === null || p <= 0) {
    return { ok: false, error: "El precio tiene que ser un número entero de pesos, mayor a $0." };
  }
  // .select() a propósito: si RLS bloquea la escritura, Postgres NO devuelve
  // error, devuelve 0 filas. Sin este chequeo la UI mostraba "guardado" y el
  // precio seguía igual (era justo lo que pasaba antes de la policy de 0045).
  const { data, error } = await sb
    .from("servicio_sede")
    .upsert({ servicio_id: servicioId, sede_id: sedeId, precio: p }, { onConflict: "servicio_id,sede_id" })
    .select("servicio_id");
  if (error) return { ok: false, error: errorPublico("actualizarPrecioServicioSede", error) };
  if (!data || data.length === 0) {
    return { ok: false, error: "No se guardó el precio: tu usuario no tiene permiso para editar el catálogo." };
  }
  // El precio se ve en el wizard público y en el cobro del mostrador.
  revalidatePath("/admin/precios");
  revalidatePath("/reservar");
  revalidatePath("/barbero");
  revalidatePath("/");
  return { ok: true };
}

// Contrato del barbero: con qué trabaja (porcentaje de comisión o arriendo de
// silla). Es lo que usa el cobro para repartir, así que se sanea acá también.
export async function actualizarContratoBarbero(input: {
  barberoId: string;
  tipo: "porcentaje" | "arriendo";
  comisionPct?: number | null;
  arriendoMensual?: number | null;
}): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };

  // Igual que en el precio: .select() para distinguir "guardado" de "RLS lo
  // bloqueó y afectó 0 filas".
  const campos =
    input.tipo === "porcentaje"
      ? (() => {
          const pct = sanearComisionPct(input.comisionPct);
          return pct === null ? null : { tipo_contrato: "porcentaje", comision_pct: pct, arriendo_mensual: null };
        })()
      : (() => {
          const monto = sanearCop(input.arriendoMensual ?? null);
          return monto === null || monto <= 0
            ? null
            : { tipo_contrato: "arriendo", arriendo_mensual: monto, comision_pct: null };
        })();
  if (!campos) {
    return {
      ok: false,
      error:
        input.tipo === "porcentaje"
          ? "La comisión tiene que ir entre 0 y 100."
          : "El arriendo tiene que ser un monto en pesos mayor a $0.",
    };
  }
  const { data, error } = await sb.from("barberos").update(campos).eq("id", input.barberoId).select("id");
  if (error) return { ok: false, error: errorPublico("actualizarContratoBarbero", error) };
  if (!data || data.length === 0) {
    return { ok: false, error: "No se guardó el contrato: tu usuario no tiene permiso para editar el equipo." };
  }
  revalidatePath("/admin/comisiones");
  revalidatePath("/barbero");
  return { ok: true };
}

// Días especiales de la sede: abrir un domingo/festivo o cerrar un día hábil.
// El default (lun-sáb 9-20) sigue en el código; esto son las excepciones.
export async function marcarDiaEspecial(input: {
  sede: string;
  fecha: string;
  abierta: boolean;
  motivo?: string;
  /** Horario propio del día (minutos). null/undefined = usar el de la semana. */
  abreMin?: number | null;
  cierraMin?: number | null;
}): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };
  if (!input.sede || !/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) return { ok: false, error: "Datos inválidos" };
  if (input.fecha < bogotaYmd()) return { ok: false, error: "No se puede cambiar una fecha pasada." };
  // Horas del día especial: solo cuando se abre, y las dos juntas y coherentes.
  // El CHECK de la tabla (0034) exige ambas null o ambas con abre<cierra en rango.
  let abreMin: number | null = null;
  let cierraMin: number | null = null;
  if (input.abierta && input.abreMin != null && input.cierraMin != null) {
    const a = Math.floor(input.abreMin);
    const c = Math.floor(input.cierraMin);
    if (!(a >= 0 && c <= 1440 && a < c)) return { ok: false, error: "El horario del día no es válido." };
    abreMin = a;
    cierraMin = c;
  }
  // upsert: volver a marcar la misma fecha cambia la decisión en vez de fallar.
  const { data, error } = await sb
    .from("sede_dias_especiales")
    .upsert(
      {
        sede_id: input.sede,
        fecha: input.fecha,
        abierta: input.abierta,
        motivo: (input.motivo ?? "").trim() || null,
        abre_min: abreMin,
        cierra_min: cierraMin,
      },
      { onConflict: "sede_id,fecha" },
    )
    .select("id");
  if (error) return { ok: false, error: errorPublico("marcarDiaEspecial", error) };
  if (!data || data.length === 0)
    return { ok: false, error: "No se guardó el día especial: tu usuario no tiene permiso." };
  revalidatePath("/admin/horarios");
  revalidatePath("/admin/equipo");
  revalidatePath("/reservar");
  return { ok: true };
}

// Horario base de un día de la semana de una sede (migración 0048). Solo admin.
export async function actualizarHorarioSemanal(input: {
  sede: string;
  dow: number;
  abierta: boolean;
  abreMin: number;
  cierraMin: number;
}): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };
  if (!input.sede || !Number.isInteger(input.dow) || input.dow < 0 || input.dow > 6)
    return { ok: false, error: "Datos inválidos" };
  const a = Math.floor(input.abreMin);
  const c = Math.floor(input.cierraMin);
  // Siempre se guardan horas coherentes (aunque el día quede cerrado): el CHECK de
  // 0048 las exige, y así al reabrir el día conserva su última franja.
  if (!(a >= 0 && c <= 1440 && a < c)) return { ok: false, error: "El horario no es válido (abre antes de cerrar)." };
  const { data, error } = await sb
    .from("sede_horario_semanal")
    .upsert(
      { sede_id: input.sede, dow: input.dow, abierta: input.abierta, abre_min: a, cierra_min: c, actualizado_en: new Date().toISOString() },
      { onConflict: "sede_id,dow" },
    )
    .select("dow");
  if (error) return { ok: false, error: errorPublico("actualizarHorarioSemanal", error) };
  if (!data || data.length === 0)
    return { ok: false, error: "No se guardó el horario: tu usuario no tiene permiso." };
  revalidatePath("/admin/horarios");
  revalidatePath("/reservar");
  return { ok: true };
}

export async function quitarDiaEspecial(id: string): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };
  const { error } = await sb.from("sede_dias_especiales").delete().eq("id", id);
  if (error) return { ok: false, error: errorPublico("quitarDiaEspecial", error) };
  revalidatePath("/admin/equipo");
  revalidatePath("/reservar");
  return { ok: true };
}

// Ausencias de barbero (MVP F4): el admin marca que un barbero no atiende una
// fecha. El booking deja de ofrecerlo/permitirlo ese día (guards en getDisponibilidad
// y createReserva). No toca citas ya creadas de ese día.
export async function marcarAusencia(input: { barberoId: string; fecha: string; motivo?: string }): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };
  if (!input.barberoId || !/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) return { ok: false, error: "Datos inválidos" };
  if (input.fecha < bogotaYmd()) return { ok: false, error: "No se puede marcar una fecha pasada." };
  const { error } = await sb.from("barbero_ausencias").insert({
    barbero_id: input.barberoId,
    fecha: input.fecha,
    motivo: (input.motivo ?? "").trim() || null,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Ese barbero ya está marcado ausente esa fecha." };
    return { ok: false, error: errorPublico("marcarAusencia", error) };
  }
  revalidatePath("/admin/equipo");
  revalidatePath("/reservar");
  return { ok: true };
}

export async function quitarAusencia(id: string): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };
  const { error } = await sb.from("barbero_ausencias").delete().eq("id", id);
  if (error) return { ok: false, error: errorPublico("quitarAusencia", error) };
  revalidatePath("/admin/equipo");
  revalidatePath("/reservar");
  return { ok: true };
}

// Marca/desmarca un producto para el paso "¿le sumas una bebida?" del wizard.
// Config por sede: cada fila de productos es de una sede, así el dueño decide
// qué bebidas ofrece en cada una (migración 0028).
export async function toggleProductoUpsell(id: string, value: boolean): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };
  const { error } = await sb.from("productos").update({ en_upsell: value }).eq("id", id);
  if (error) return { ok: false, error: errorPublico("toggleProductoUpsell", error) };
  revalidatePath("/admin/inventario");
  revalidatePath("/reservar");
  return { ok: true };
}

const FOTO_MAX_BYTES = 2 * 1024 * 1024;

// Margen para marcar "Llegó" (regla en slots.ts, compartida con la UI).
const MARGEN_LLEGADA_MS = MARGEN_LLEGADA_HORAS * 3600_000;

// Minuto-del-día (0..1439) EN BOGOTÁ de un instante. El server corre en UTC, así
// que la hora civil se deriva con Intl y no depende del TZ del proceso. Se usa
// para validar server-side que un inicio caiga en el horario de atención
// (OPEN/CLOSE/STEP de slots.ts), sin re-derivar las horas.
function minutoDelDiaBogota(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hh * 60 + mm;
}

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
    return { ok: false, error: "Elige una imagen." };
  // Allowlist (nada de SVG: un <script> embebido quedaría servido desde el bucket público).
  if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type))
    return { ok: false, error: "La imagen tiene que ser JPG, PNG, WebP o AVIF." };
  if (file.size > FOTO_MAX_BYTES) return { ok: false, error: "La imagen no puede pesar más de 2MB." };
  // El MIME lo declara el cliente: se confirma con los primeros bytes. Sin esto,
  // un archivo de texto renombrado .png quedaba servido desde el bucket público.
  const cabecera = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!pareceImagen(cabecera))
    return { ok: false, error: "Ese archivo no es una imagen válida." };

  const admin = supabaseAdmin();
  // Existencia + sanidad del id (el path del storage se arma con él).
  const { data: prod } = await admin.from("productos").select("id").eq("id", productoId).maybeSingle();
  if (!prod) return { ok: false, error: "Producto no encontrado." };

  const ext = extDeMime(file.type);
  const path = `${productoId}.${ext}`;
  const { error: upErr } = await admin.storage
    .from("productos")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (upErr)
    return { ok: false, error: errorPublico("subirFotoProducto upload", upErr, "No se pudo subir la foto. Intenta de nuevo.") };

  // Limpieza best-effort: re-subir en otro formato (png→webp) dejaría el archivo
  // viejo huérfano en el bucket público (el path lleva la extensión). Se borran
  // las otras variantes del mismo producto; si el remove falla, no aborta la subida.
  const otrasVariantes = variantesObsoletas(productoId, ext);
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
  if (!esComboValido(partes, conBebida))
    return { ok: false, error: "Elige al menos 2 partes (o 1 parte más la bebida)." };
  if (!nombre) return { ok: false, error: "Poné el nombre del combo." };
  if (!Number.isFinite(precio) || precio <= 0) return { ok: false, error: "Poné un precio válido." };
  if (!Number.isFinite(duracionMin) || duracionMin <= 0 || duracionMin > DURACION_MAX_MIN)
    return { ok: false, error: `La duración tiene que estar entre 1 minuto y ${DURACION_MAX_MIN / 60} horas.` };

  const admin = supabaseAdmin();

  const { data: sedeRow } = await admin.from("sedes").select("id").eq("id", input.sede).maybeSingle();
  if (!sedeRow) return { ok: false, error: "Sede inválida." };

  // cuenta_corte: el combo cuenta para la tarjeta solo si alguna parte es un corte
  // (misma semántica que getCorteIds). Un combo sin corte NO suma sello.
  const corteIds = new Set(await getCorteIds(admin));
  const cuentaCorte = partes.some((p) => corteIds.has(p));

  // id único: slug del nombre, con sufijo -2, -3… si choca.
  const baseId = slugComboRegla(nombre);
  const { data: existentes } = await admin.from("servicios").select("id").like("id", `${baseId}%`);
  const id = resolverColisionSlug(baseId, ((existentes ?? []) as { id: string }[]).map((r) => r.id));

  const row = {
    id,
    nombre,
    categoria: "combos",
    es_combo: true,
    duracion_min: duracionMin,
    activo: true,
  };
  // Intenta con cuenta_corte (0027); si la columna aún no existe, reintentá sin ella
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

// Edita el perfil público de un barbero (bio + especialidades) desde /admin/equipo.
// Va con supabaseAdmin() detrás del gate admin (mismo patrón que las otras
// mutaciones del back-office). Las especialidades se reemplazan enteras: se borran
// las viejas y se reinsertan las nuevas saneadas (trim, sin vacíos, sin duplicados
// —case-insensitive, para no chocar con el PK (barbero_id, especialidad)—, máx 6).
export async function actualizarPerfilBarbero(input: {
  barberoId: string;
  bio: string;
  especialidades: string[];
}): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };

  const barberoId = (input.barberoId ?? "").trim();
  if (!barberoId) return { ok: false, error: "Barbero inválido." };

  const bio = (input.bio ?? "").trim();

  const { especialidades, descartadas } = sanearEspecialidades(input.especialidades);

  const admin = supabaseAdmin();

  const { data: barberoRow } = await admin.from("barberos").select("id").eq("id", barberoId).maybeSingle();
  if (!barberoRow) return { ok: false, error: "Barbero inválido." };

  const { error: bioErr } = await admin.from("barberos").update({ bio: bio || null }).eq("id", barberoId);
  if (bioErr) return { ok: false, error: errorPublico("actualizarPerfilBarbero bio", bioErr) };

  const { error: delErr } = await admin.from("barbero_especialidades").delete().eq("barbero_id", barberoId);
  if (delErr) return { ok: false, error: errorPublico("actualizarPerfilBarbero delete", delErr) };

  if (especialidades.length) {
    const { error: insErr } = await admin
      .from("barbero_especialidades")
      .insert(especialidades.map((especialidad) => ({ barbero_id: barberoId, especialidad })));
    if (insErr) return { ok: false, error: errorPublico("actualizarPerfilBarbero insert", insErr) };
  }

  revalidatePath("/admin/equipo");
  revalidatePath("/barberos");
  revalidatePath("/reservar");
  // Se guardó, pero puede que no todo: antes esto respondía "Perfil guardado" y
  // el admin no se enteraba de que se le recortaron especialidades (varios
  // barberos ya tienen 7-8 cargadas de antes del límite).
  if (descartadas.length) {
    const sobrantes = descartadas.filter((d) => d.motivo === "excede-maximo").length;
    const dups = descartadas.length - sobrantes;
    const partes: string[] = [];
    if (sobrantes) partes.push(`${sobrantes} por el máximo de 6`);
    if (dups) partes.push(`${dups} repetida${dups > 1 ? "s" : ""}`);
    return { ok: true, aviso: `Se guardó, pero no se incluyeron ${partes.join(" y ")}.` };
  }
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
  // inicioISO inválido (NaN) → error claro, no dejar que reviente con 500 al hacer
  // toISOString() más abajo. Y la cita tiene que ser a futuro (nada de fechas pasadas).
  if (Number.isNaN(inicio.getTime())) return { ok: false, error: "La fecha de la cita no es válida." };
  if (inicio.getTime() <= Date.now()) return { ok: false, error: "Esa hora ya pasó. Elige un horario a futuro." };
  const { data: serv } = await sb
    .from("servicios")
    .select("nombre,duracion_min")
    .eq("id", input.servicioId)
    .maybeSingle();
  const dur = (serv as { duracion_min?: number } | null)?.duracion_min ?? 30;
  const servicioNombre = (serv as { nombre?: string } | null)?.nombre ?? "Tu cita";
  const fin = new Date(inicio.getTime() + dur * 60000);

  // Horario de atención (autoritativo): el inicio tiene que caber en la ventana
  // REAL de ese día (excepción → semana → respaldo) y estar alineado al paso. El
  // wizard ya lo respeta; esto blinda el POST directo y el path del asistente IA
  // (se reservaba a las 3am). Misma función que ve el cliente, así no divergen.
  const minDia = minutoDelDiaBogota(inicio);
  const ventana = await ventanaDeDia(sb, input.sede, bogotaYmd(inicio));
  if (!ventana.abierta) return { ok: false, error: "Ese día la barbería no atiende. Elige otra fecha." };
  if (!slotEnVentana(minDia, dur, ventana)) {
    return { ok: false, error: "Ese horario está fuera del horario de atención." };
  }

  // Sin barbero no hay reserva: el EXCLUDE constraint no cubre barbero_id NULL,
  // así que N reservas caerían en el mismo slot, invisibles para todos los barberos.
  // (El wizard normal siempre manda barbero; solo el path del asistente IA lo omitía.)
  if (!input.barberoId) return { ok: false, error: "Elige un barbero para reservar." };
  const barberoId = input.barberoId;
  // El barbero tiene que existir, estar activo y ser DE la sede elegida: sin este
  // chequeo se podía reservar un barbero de la otra sede (o inactivo) por POST directo.
  const { data: barb } = await sb
    .from("barberos")
    .select("sede_id,activo")
    .eq("id", barberoId)
    .maybeSingle();
  const barbRow = barb as { sede_id?: string; activo?: boolean } | null;
  if (!barbRow || barbRow.activo === false || barbRow.sede_id !== input.sede)
    return { ok: false, error: "Ese barbero no está disponible en esa sede." };
  // El servicio tiene que tener precio en la sede (fila en servicio_sede): un
  // servicio de otra sede o sin precio no debe generar una cita fantasma.
  const { data: ss } = await sb
    .from("servicio_sede")
    .select("servicio_id")
    .eq("sede_id", input.sede)
    .eq("servicio_id", input.servicioId)
    .maybeSingle();
  if (!ss) return { ok: false, error: "Ese servicio no está disponible en esa sede." };
  // Guard de ausencia (autoritativo): el admin marcó que el barbero no atiende esa
  // fecha. Se bloquea acá aunque la UI se saltara (endpoint POST directo).
  const { data: aus } = await sb
    .from("barbero_ausencias")
    .select("id")
    .eq("barbero_id", barberoId)
    .eq("fecha", bogotaYmd(inicio))
    .limit(1);
  if (aus && aus.length) return { ok: false, error: "Ese barbero no atiende ese día. Elige otra fecha u otro barbero." };

  // (El guard de calendario —día cerrado / domingo— ya lo cubre `ventana.abierta`
  // de arriba, resuelto con horarioEfectivo. Antes había un chequeo aparte que
  // solo miraba `abierta` e ignoraba las horas.)

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
  if (clash && clash.length) return { ok: false, error: "Ese horario ya fue tomado. Elige otro, por favor." };

  // Recorte de largo sano en los campos de texto libres (POST directo sin la UI):
  // evita fichas de cliente y notas con payloads gigantes.
  const clienteNombre = (input.clienteNombre ?? "").trim().slice(0, 120);
  const telefono = (input.telefono ?? "").trim().slice(0, 40);
  // Si reserva un cliente logueado, atamos la cita a SU ficha (auth_id verificado) para
  // que aparezca en su portal; si es anónimo, dedup por teléfono.
  let clienteRef: string | null = null;
  const {
    data: { user },
  } = await (await supabaseServerAuth()).auth.getUser();
  if (user) {
    const email = (user.email ?? "").trim().toLowerCase();
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const nombre = (meta.full_name as string) || (meta.name as string) || clienteNombre;
    clienteRef = await clienteIdForUser(sb, user.id, email, nombre);
  }
  if (!clienteRef) {
    clienteRef = await upsertClienteId(sb, clienteNombre, telefono, input.email ?? "", "app");
  }
  // La nota (ej. "Bebida: Gaseosa" del upsell) viaja al barbero en su agenda.
  // ponytail: si el barbero propone adelanto después, sobrescribe esta nota (raro;
  // igual el barbero cobra la bebida en consumos).
  const nota = (input.nota ?? "").trim().slice(0, 500) || null;
  const { data: creada, error } = await sb
    .from("reservas")
    .insert({
      sede_id: input.sede,
      barbero_id: barberoId,
      servicio_id: input.servicioId,
      cliente_ref: clienteRef,
      inicio: inicio.toISOString(),
      fin: fin.toISOString(),
      estado: "confirmada",
      canal: "app",
      nota,
    })
    // Devolvemos el confirm_token: es la credencial con la que la pantalla de
    // confirmación del wizard deja DESHACER la reserva recién hecha (por si el
    // cliente puso un dato mal), sin exigir login.
    .select("confirm_token")
    .single();
  if (error) {
    if (error.code === "23P01") return { ok: false, error: "Ese horario ya fue tomado. Elige otro, por favor." };
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
  // Y al LOCAL, que hasta ahora no se enteraba de nada con la app cerrada: el
  // ding del mostrador solo suena si la pantalla está abierta. Va a la sede (el
  // aparato del mostrador, el destinatario del modelo por sede) y al barbero
  // mientras sigan existiendo sus logins. Mismo tag en las dos: si el aparato
  // está suscrito de las dos formas, ve UN aviso, no dos.
  const avisoCita = {
    title: "Nueva cita ✂️",
    body: `${clienteNombre || "Un cliente"} · ${servicioNombre} · ${fechaHoraBogota(inicio)}`,
    url: "/barbero",
    tag: "cita-nueva",
  };
  await pushASede(input.sede, avisoCita);
  await pushABarbero(barberoId, avisoCita);
  revalidatePath("/barbero");
  return { ok: true, token: (creada as { confirm_token?: string } | null)?.confirm_token ?? null };
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
  // Ausencia: si el barbero no atiende esa fecha, se bloquea el día completo (todos
  // los slots quedan ocupados → el wizard muestra "sin horarios" y "cualquier
  // barbero" lo excluye porque nunca cuenta como libre). OJO: el fin va 23:59 del
  // MISMO día, no 00:00 del siguiente: ocupaSlot del wizard compara minutos-del-día
  // (getHours()*60) y con fin=medianoche el rango colapsaba a [0,0] y no bloqueaba
  // nada (bug cazado en QA 2026-07-17).
  const { data: aus } = await sb
    .from("barbero_ausencias")
    .select("id")
    .eq("barbero_id", input.barberoId)
    .eq("fecha", bogotaYmd(new Date(input.fechaISO)))
    .limit(1);
  if (aus && aus.length)
    return [{ inicio: desde.toISOString(), fin: new Date(hasta.getTime() - 60000).toISOString() }];
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
  if (!puedeMostrador(staff.rol)) return { ok: false, error: "No autorizado" };
  // Modo mostrador: el walk-in se puede anotar a cualquier barbero de la misma
  // sede (quien lo registra no siempre es quien atiende). Sin elección, cae en
  // uno mismo. El admin elige libre.
  const barberoId = input.barberoId || staff.barberoId;
  if (!barberoId) return { ok: false, error: "No se pudo determinar el barbero" };
  if (!(await staffPuedeOperarBarbero(staff, barberoId)))
    return { ok: false, error: "Ese barbero es de otra sede." };
  // La sede se DERIVA del barbero, no se confia en input.sede: el gate valida al
  // barbero, pero el sede_id del INSERT (service_role) llegaba crudo del POST, asi
  // que un staff de Parque podia crear la reserva con sede: 'plaza' + un barbero de
  // Parque -> reserva con barbero cruzado de sede y venta en la caja equivocada.
  const sedeReal = await sedeDeBarbero(barberoId);
  if (!sedeReal) return { ok: false, error: "No se pudo determinar la sede del barbero." };

  // Guard de ausencia: createReserva ya lo tenía y el walk-in NO, así que se le
  // podía meter un cliente a alguien marcado como ausente. Peor: la atención
  // quedaba "en curso" y el sitio público lo mostraba "en silla" el resto del
  // día, cuando ni siquiera estaba en la barbería.
  const hoyYmd = bogotaYmd(new Date());
  const { data: ausente } = await sb
    .from("barbero_ausencias")
    .select("id")
    .eq("barbero_id", barberoId)
    .eq("fecha", hoyYmd)
    .limit(1);
  if (ausente && ausente.length) {
    return { ok: false, error: "Ese barbero está marcado como ausente hoy. Elegí otro o quitá la ausencia." };
  }
  // Mostrador compartido: una vez validada la sede/barbero acá, el INSERT va con
  // service_role. La RLS de reservas (0010) exige barbero_id = current_barbero_id(),
  // así que un barbero anotando el walk-in de un COLEGA de su sede chocaba 42501.
  // El gate staffPuedeOperarBarbero de arriba es el control real (mismo patrón que
  // actualizarReserva/completarReserva). NO usar admin antes de esa validación.
  const admin = supabaseAdmin();
  // La silla es UNA: si el barbero ya tiene una atención EN CURSO (aunque se haya
  // pasado de su fin estimado —por eso el EXCLUDE de solape, que usa el fin guardado,
  // no la ve—), no se le puede encimar otro walk-in. El operador cierra la atención
  // actual (cobra) y registra la nueva.
  const { data: enSilla } = await admin
    .from("reservas")
    .select("id")
    .eq("barbero_id", barberoId)
    .eq("estado", "en_curso")
    .limit(1);
  if (enSilla && enSilla.length) {
    return { ok: false, error: "Ese barbero tiene un cliente en la silla ahora. Cerrá esa atención antes de registrar otra." };
  }
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
  const { error } = await admin.from("reservas").insert({
    sede_id: sedeReal,
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
      const { data: busy } = await admin
        .from("reservas")
        .select("fin")
        .eq("barbero_id", barberoId)
        .not("estado", "in", "(cancelada,no_show)")
        .lt("inicio", fin.toISOString())
        .gt("fin", now.toISOString())
        .order("fin")
        .limit(1);
      const esperaHasta = (busy?.[0] as { fin?: string } | undefined)?.fin ?? null;
      // Mismo servicio_sede: la fila de espera va a la MISMA sede del walk-in, con
      // service_role (la policy staff_all_lista_espera es is_staff(), funciona con
      // cualquier cliente).
      const { error: eErr } = await admin.from("lista_espera").insert({
        sede_id: sedeReal,
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
  // Modo mostrador: el equipo comparte un aparato, así que se puede marcar la
  // llegada o cancelar la cita de cualquier barbero DE LA MISMA SEDE. El chequeo
  // de sede se hace acá (la RLS de reservas sigue estricta por barbero, por eso
  // el update va con admin una vez validado).
  const staff = await getStaffContext();
  const admin = supabaseAdmin();
  const { data: rsv } = await admin
    .from("reservas")
    .select("sede_id,inicio")
    .eq("id", reservaId)
    .maybeSingle();
  if (!rsv) return { ok: false, error: "Reserva no encontrada" };
  const rsvRow = rsv as { sede_id: string; inicio: string };
  if (!(await staffPuedeOperarSede(staff, rsvRow.sede_id)))
    return { ok: false, error: "Esa cita es de otra sede." };

  // Whitelist de las transiciones del mostrador: solo estas tres. A 'completada'
  // se llega EXCLUSIVAMENTE por completarReserva (cierra con venta); aceptar
  // cualquier valor del enum acá dejaba marcar una cita 'completada'/'pendiente'
  // por POST directo y volverla no cobrable (el claim de completarReserva solo
  // reclama pendiente/confirmada/en_curso).
  const ESTADOS_MOSTRADOR = ["en_curso", "cancelada", "no_show"];
  if (patch.estado !== undefined && !ESTADOS_MOSTRADOR.includes(patch.estado))
    return { ok: false, error: "Estado inválido." };

  // Guard de "Llegó": no se puede pasar a la silla una cita que arranca dentro de
  // más de 2 horas. En el mostrador hay varias tarjetas juntas y un clic en la del
  // turno de la tarde la cerraba como venta de ahora. El que llega temprano igual
  // pasa (hasta 2h antes); un cliente que aún no existe, no.
  if (patch.estado === "en_curso") {
    const faltanMs = new Date(rsvRow.inicio).getTime() - Date.now();
    if (faltanMs > MARGEN_LLEGADA_MS) {
      return { ok: false, error: "Esa cita todavía no empieza. Marcá la llegada más cerca de la hora." };
    }
  }

  // Armado del update campo por campo (no pasar el patch crudo): así ningún
  // campo inesperado del POST llega a la tabla. La llegada es una etiqueta de
  // texto que la UI manda como 'a_tiempo'; se acota a los valores conocidos.
  const cambios: { estado?: string; llegada?: string } = {};
  if (patch.estado !== undefined) cambios.estado = patch.estado;
  if (patch.llegada !== undefined) {
    if (!["a_tiempo", "tarde"].includes(patch.llegada))
      return { ok: false, error: "Llegada inválida." };
    cambios.llegada = patch.llegada;
  }
  if (Object.keys(cambios).length === 0) return { ok: false, error: "Nada para actualizar." };

  // Solo se actua sobre citas ACTIVAS: el filtro de estado ORIGEN evita pisar una
  // ya cerrada. Sin el, marcar "no llego" sobre una cita ya COBRADA (por doble
  // clic, por el realtime que la movio, o por POST directo) la volvia no_show y
  // dejaba la venta huerfana; y una cancelada podia revivir a en_curso.
  const { data, error } = await admin
    .from("reservas")
    .update(cambios)
    .eq("id", reservaId)
    .in("estado", ["pendiente", "confirmada", "en_curso"])
    .select("id,cliente_ref");
  if (error) return { ok: false, error: errorPublico("actualizarReserva", error) };
  if (!data || data.length === 0) return { ok: false, error: "Esta cita ya fue cerrada o cobrada." };

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
  // Cancelación por la barbería (barbero o admin): avisar al cliente para que
  // no llegue a una cita que ya no existe. El cupo queda libre solo (el
  // constraint y la disponibilidad excluyen canceladas).
  if (patch.estado === "cancelada" && clienteRef) {
    await pushACliente(clienteRef, {
      title: "Tu cita fue cancelada",
      body: "La barbería tuvo que cancelar tu cita. Puedes reservar de nuevo cuando quieras.",
      url: "/reservar",
      tag: "cancelacion",
    });
  }

  revalidatePath("/barbero");
  return { ok: true };
}

// ---------- Modo mostrador: alcance por sede ----------
// El equipo comparte un solo aparato en el local, así que un barbero opera sobre
// las citas de TODA SU SEDE (marcar llegada, cobrar), no solo las suyas. El límite
// duro es la sede: nunca puede tocar la otra. El admin no tiene límite.
// Se resuelve acá en el server (no aflojando RLS) para que el permiso viva en un
// solo lugar auditable y las demás rutas sigan con el scope estricto de siempre.
async function sedeDeBarbero(barberoId: string): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from("barberos")
    .select("sede_id")
    .eq("id", barberoId)
    .maybeSingle();
  return (data as { sede_id?: string } | null)?.sede_id ?? null;
}

/** ¿Este staff puede operar sobre algo de esta sede? */
export async function staffPuedeOperarSede(
  staff: { rol: string; barberoId: string | null; sedeId?: string | null },
  sedeId: string,
): Promise<boolean> {
  if (staff.rol === "admin") return true;
  // Perfil por sede (0044): su límite es su propia sede, igual que el barbero.
  if (staff.rol === "sede") return !!staff.sedeId && staff.sedeId === sedeId;
  if (staff.rol !== "barbero" || !staff.barberoId) return false;
  return (await sedeDeBarbero(staff.barberoId)) === sedeId;
}

/** ¿Este staff puede atribuirle una venta a este barbero (misma sede)? */
async function staffPuedeOperarBarbero(
  staff: { rol: string; barberoId: string | null; sedeId?: string | null },
  barberoId: string,
): Promise<boolean> {
  if (staff.rol === "admin") return true;
  if (staff.rol === "sede") {
    return !!staff.sedeId && (await sedeDeBarbero(barberoId)) === staff.sedeId;
  }
  if (staff.rol !== "barbero" || !staff.barberoId) return false;
  if (staff.barberoId === barberoId) return true;
  const [mia, suya] = await Promise.all([sedeDeBarbero(staff.barberoId), sedeDeBarbero(barberoId)]);
  return !!mia && mia === suya;
}

// Auto-open de caja: la primera venta del día abre sola la caja de la sede, sin
// que nadie la abra a mano (el dueño no opera; los barberos registran todo).
// caja_sesiones es RLS admin-only (0008), por eso va con supabaseAdmin(). Es
// BEST-EFFORT: jamás puede tumbar un cobro — el caller la envuelve en try/catch
// y acá se traga el 23505 de la carrera (dos ventas simultáneas → una gana el
// unique index parcial `caja_una_abierta_por_sede`, la otra no reabre nada).
// Devuelve el id de la sesión de caja abierta de la sede (la que había o la que
// abre acá), o null si no se pudo. La venta lo estampa (caja_sesion_id, 0052) para
// pertenecer a ESA sesión sin depender de la ventana de tiempo (#08).
async function asegurarCajaAbierta(admin: SupabaseClient, sedeId: string): Promise<string | null> {
  const { data: abierta, error: selErr } = await admin
    .from("caja_sesiones")
    .select("id")
    .eq("sede_id", sedeId)
    .eq("estado", "abierta")
    .limit(1);
  if (selErr) {
    errorPublico("asegurarCajaAbierta select", selErr);
    return null;
  }
  if (abierta && abierta.length > 0) return (abierta[0] as { id: string }).id; // ya hay una caja abierta
  const { data: nueva, error: insErr } = await admin
    .from("caja_sesiones")
    .insert({ sede_id: sedeId, estado: "abierta", meta_dia: 0, monto_apertura: 0, auto_abierta: true })
    .select("id")
    .maybeSingle();
  if (insErr) {
    // 23505 = otra venta simultánea ya la abrió (unique index parcial): re-leemos su
    // id para estampar la venta en la sesión ganadora. Otro error: log, sin propagar.
    if (insErr.code === "23505") {
      const { data: reab } = await admin
        .from("caja_sesiones")
        .select("id")
        .eq("sede_id", sedeId)
        .eq("estado", "abierta")
        .limit(1);
      return reab && reab.length ? (reab[0] as { id: string }).id : null;
    }
    errorPublico("asegurarCajaAbierta insert", insErr);
    return null;
  }
  return (nueva as { id: string } | null)?.id ?? null;
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
  /** Medio con que se pagó la PROPINA si difiere del de la venta (0053). Hoy solo
   *  'efectivo' desde el form ("propina en efectivo"). null/undefined = el de la venta. */
  propinaMedio?: string | null;
  nota?: string;
  cuponCodigo?: string;
  idemToken?: string; // token de idempotencia (obligatorio en venta rápida)
}): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const staff = await getStaffContext();
  if (!puedeMostrador(staff.rol)) return { ok: false, error: "No autorizado" };

  // Atribución del barbero de la venta (define la comisión). Modo mostrador
  // compartido: cualquiera del equipo cobra desde el mismo equipo y la comisión
  // igual cae en quien atendió, sin pedir PIN.
  //   1) Si la venta cierra una CITA, manda el barbero DE LA CITA.
  //   2) Venta rápida (sin cita): el que se elija, o uno mismo si no se eligió.
  // Siempre validado contra la sede: nadie cobra para una sede que no es la suya.
  // Cliente de servicio para la ruta de plata. La autorización ya se resolvió
  // arriba (rol + sede + atribución fijada por el server), así que la RLS por
  // barbero acá solo estorbaría: en el mostrador se cobra la cita de OTRO
  // barbero de la misma sede y la RLS (0010) la bloquearía en el claim, la venta,
  // los ítems y los puntos.
  const admin = supabaseAdmin();

  // Cuando la venta cierra una CITA, la sede / el servicio principal / el cliente
  // se DERIVAN de la reserva, no de lo que mande el form: así nadie puede "cobrar
  // combo, registrar barato" ni asignarle los sellos/puntos a una ficha ajena
  // (AUD-A-001 / AUD-A-002). En venta rápida (sin cita) sí mandan los input.*.
  // Los servicios ADICIONALES siguen siendo input-driven, priceados en la sede de
  // la cita (sedeEfectiva).
  let barberoId: string | null;
  let sedeEfectiva: string;
  let servicioEfectivo: string | null;
  let clienteEfectivo: string | null;
  if (input.reservaId) {
    const { data: rsv } = await admin
      .from("reservas")
      .select("barbero_id,sede_id,servicio_id,cliente_ref")
      .eq("id", input.reservaId)
      .maybeSingle();
    if (!rsv) return { ok: false, error: "Cita no encontrada" };
    const r = rsv as { barbero_id: string | null; sede_id: string; servicio_id: string | null; cliente_ref: string | null };
    if (!(await staffPuedeOperarSede(staff, r.sede_id)))
      return { ok: false, error: "Esa cita es de otra sede." };
    barberoId = r.barbero_id;
    sedeEfectiva = r.sede_id;
    servicioEfectivo = r.servicio_id;
    clienteEfectivo = r.cliente_ref;
  } else {
    barberoId = input.barberoId || staff.barberoId;
    if (barberoId && !(await staffPuedeOperarBarbero(staff, barberoId)))
      return { ok: false, error: "Ese barbero es de otra sede." };
    sedeEfectiva = input.sede;
    // La sede se valida SIEMPRE, no solo a través del barbero. Un perfil por
    // sede (0044) no tiene barbero propio, así que en una venta rápida sin
    // barbero elegido no había nada que atara la venta a su local: podía
    // registrarla en la otra sede mandando otro `input.sede`.
    if (!(await staffPuedeOperarSede(staff, sedeEfectiva)))
      return { ok: false, error: "Esa venta es de otra sede." };
    servicioEfectivo = input.servicioId;
    clienteEfectivo = input.clienteRef;
  }

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
  if (barberoId && (servicioEfectivo || extras.length)) {
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

  if (servicioEfectivo) {
    const { data: p } = await sb
      .from("servicio_sede")
      .select("precio,servicios(nombre)")
      .eq("sede_id", sedeEfectiva)
      .eq("servicio_id", servicioEfectivo)
      .maybeSingle();
    // Igual que los adicionales: sin precio en la sede se rechaza, no se
    // completa una venta cobrando $0 por el servicio en silencio.
    if (!p) return { ok: false, error: "El servicio de la cita no tiene precio en esta sede." };
    const row = p as Record<string, unknown>;
    items.push({
      tipo: "servicio",
      ref_id: servicioEfectivo,
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
      .eq("sede_id", sedeEfectiva)
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
    // Filtrado por sede_id = sedeEfectiva: cada producto pertenece a UNA sede (con
    // su propio precio, comision y stock). Sin esto, un cobro en la sede A podia
    // incluir el id de un producto de la sede B, y decrement_stock bajaba el
    // inventario del otro local con su precio/comision. El guard `!pr` de abajo
    // rechaza el producto que no exista en esta sede (no viene en `prods`).
    const { data: prods } = await sb
      .from("productos")
      .select("id,nombre,precio,comision_pct")
      .eq("sede_id", sedeEfectiva)
      .in("id", ids);
    for (const sel of input.productos) {
      const cantidad = Math.floor(sel.cantidad);
      if (!Number.isFinite(cantidad) || cantidad < 1) return { ok: false, error: "Cantidad de producto inválida." };
      const pr = ((prods ?? []) as Record<string, unknown>[]).find((x) => x.id === sel.id);
      // No descartar en silencio: cobraría menos de lo que el barbero vio en pantalla.
      if (!pr) return { ok: false, error: "Un producto ya no está disponible en esta sede. Actualizá la página." };
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
    return { ok: false, error: "No se pudo asegurar la venta. Actualizá la página e intenta de nuevo." };
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
  // del ciclo se lleva un REGALO (sin descuento) y el 10º va al 50% (topado al
  // precio del corte base de la sede).
  // El conteo se deriva de las ventas previas; se recomputa acá (fuente de verdad).
  // Cuenta con supabaseAdmin(): la RLS 0010 scopea las ventas por barbero, así que
  // la sesión del barbero undercontaría el historial del cliente entre barberos.
  let beneficioTarjeta: BeneficioTarjeta | null = null;
  let descuentoTarjeta = 0;
  let tarjetaPos = 0;
  let cortesPrevios = 0;
  if (clienteEfectivo) {
    const admin = supabaseAdmin();
    const corteIds = await getCorteIds(admin);
    const corteItem = items
      .filter((it) => it.tipo === "servicio" && corteIds.includes(it.ref_id as string))
      .sort((a, b) => (b.precio_unitario as number) - (a.precio_unitario as number))[0];
    if (corteItem) {
      cortesPrevios = await contarCortesCliente(admin, clienteEfectivo);
      const base = await precioCorteBase(admin, sedeEfectiva);
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
    const { data: prev, error: prevErr } = await admin
      .from("reservas")
      .select("estado")
      .eq("id", input.reservaId)
      .maybeSingle();
    if (prevErr) return { ok: false, error: errorPublico("completarReserva reserva", prevErr) };
    if (!prev) return { ok: false, error: "Reserva no encontrada o sin permiso" };
    estadoAnterior = (prev as { estado: string }).estado;

    const { data: claimed, error: claimErr } = await admin
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
    const { error: revErr } = await admin.from("reservas").update({ estado: estadoAnterior }).eq("id", input.reservaId);
    if (revErr) errorPublico("completarReserva revertir", revErr);
  }

  // 2) El uso del cupón se sube DESPUÉS de la venta (paso 6), no antes: ver la nota
  //    ahí. Subirlo antes hacía que, en la venta RÁPIDA (sin claim de reserva), un
  //    doble-toque con el mismo idem_token gastara DOS usos —la 2ª venta rebotaba con
  //    23505 recién en el INSERT, después del bump—. Ahora el bump va tras la barrera
  //    de idempotencia, así el doble-toque ni llega a él.

  // 3) Auto-open de caja ANTES de insertar la venta: el panel/cierre de caja solo
  //    cuenta ventas con creado_en >= abierta_en, y la primera venta del día quedaba
  //    84ms más vieja que la apertura → caja en $0 y cierre descuadrado (bug cazado
  //    en QA 2026-07-17). Best-effort: jamás tumba el cobro; si la venta luego falla,
  //    queda una caja auto-abierta vacía (inofensivo). Devuelve el id de la sesión
  //    para ESTAMPARLO en la venta (caja_sesion_id, 0052): así la venta pertenece a
  //    esta caja aunque el cobro se confirme justo mientras se cierra (#08).
  let cajaSesionId: string | null = null;
  try {
    cajaSesionId = await asegurarCajaAbierta(supabaseAdmin(), sedeEfectiva);
  } catch (e) {
    errorPublico("completarReserva auto-open caja", e as { message?: string });
  }

  // 4) La venta. Los unique index ventas_reserva_unica (reserva) y ventas_idem_unica
  //    (venta rápida, 0021) son el backstop anti doble-cobro.
  const { data: venta, error } = await admin
    .from("ventas")
    .insert({
      sede_id: sedeEfectiva,
      caja_sesion_id: cajaSesionId,
      barbero_id: barberoId,
      cliente_ref: clienteEfectivo,
      cliente_nombre: !clienteEfectivo ? (input.clienteNombre ?? "").trim() || null : null,
      reserva_id: input.reservaId,
      idem_token: idemToken,
      medio,
      total: cobro.total,
      descuento: cobro.descuento,
      cupon_codigo: cuponCodigo,
      propina: cobro.propina,
      // Medio propio de la propina solo si hay propina y difiere del de la venta
      // (0053); si no, null = va con el medio de la venta (compat).
      propina_medio:
        cobro.propina > 0 && input.propinaMedio && input.propinaMedio !== medio ? input.propinaMedio : null,
      beneficio_tarjeta: beneficioTarjeta,
      nota,
    })
    .select("id")
    .single();
  if (error || !venta) {
    // 23505 = ya existe una venta para esta reserva/token: quedó cobrada. Este cobro
    // "perdedor" no tocó nada (el cupón se sube DESPUÉS de la venta, paso 6, así que
    // esta llamada ni bumpeó): solo retorna. La ganadora sube el uso tras su insert.
    if (error?.code === "23505") {
      const yaMsg = input.reservaId ? "Esta cita ya fue cobrada." : "Esta venta ya fue cobrada.";
      return { ok: false, error: errorPublico("completarReserva", error, yaMsg) };
    }
    await revertirClaim();
    return { ok: false, error: errorPublico("completarReserva", error, "No se pudo completar el cobro. Intenta de nuevo.") };
  }
  const ventaId = (venta as { id: string }).id;

  // 5) Los ítems. Si fallan, NO puede quedar la venta huérfana: se borra la
  //    venta y se revierte la reserva para reintentar el cobro completo.
  if (items.length) {
    const { error: itemsErr } = await admin.from("venta_items").insert(items.map((it) => ({ ...it, venta_id: ventaId })));
    if (itemsErr) {
      const { error: delErr } = await admin.from("ventas").delete().eq("id", ventaId);
      if (delErr) errorPublico("completarReserva borrar venta", delErr);
      await revertirClaim();
      return { ok: false, error: errorPublico("completarReserva items", itemsErr, "No se pudieron registrar los consumos de la venta. Intenta de nuevo.") };
    }
  }

  // 6) Subir el uso del cupón: recién ACÁ, con la venta (+ ítems) ya committeada y
  //    pasada la barrera anti doble-cobro (claim de reserva / unique index de
  //    idem_token). Así un doble-toque de la venta rápida NO llega a este bump (la 2ª
  //    llamada ya rebotó con 23505). bump_cupon_uso es atómico (0008: sube solo si
  //    usos < usos_max). TRADEOFF: dos cobros DISTINTOS que corran por el ÚLTIMO uso a
  //    la vez podrían ambos aplicar el descuento (el bump atómico topa al 2º y esa
  //    venta queda sin uso contado) → un cupón puede pasarse en 1 canje. Caso raro y
  //    el peor efecto es ese, nunca un doble cobro. Best-effort: la venta ya está hecha,
  //    un fallo del bump se loguea pero no la tumba.
  if (cuponCodigo) {
    const { data: bumped, error: cupErr } = await sb.rpc("bump_cupon_uso", { p_codigo: cuponCodigo });
    if (cupErr) errorPublico("completarReserva bump_cupon_uso", cupErr);
    else if (bumped === false)
      errorPublico("completarReserva cupon sobre tope", { message: `cupón ${cuponCodigo} superó su tope en carrera` });
  }

  // 7) Efectos secundarios: la venta ya quedó registrada; si algo de esto falla
  //    NO se aborta el cobro, pero SIEMPRE queda log (nunca tragar en silencio).
  for (const it of items) {
    if (it.tipo !== "producto") continue;
    const { error: stockErr } = await sb.rpc("decrement_stock", { p_id: it.ref_id, p_qty: it.cantidad });
    if (stockErr) errorPublico("completarReserva decrement_stock", stockErr);
  }
  // Fidelidad: puntos por el neto cobrado (sin propina), solo si el cliente está inscrito.
  let puntos = clienteEfectivo ? cobro.puntos : 0;
  if (clienteEfectivo && puntos > 0) {
    const { data: cli } = await admin.from("clientes").select("fidelizado").eq("id", clienteEfectivo).maybeSingle();
    if ((cli as { fidelizado?: boolean } | null)?.fidelizado === false) puntos = 0;
    if (puntos > 0) {
      const { error: ptsErr } = await admin.from("puntos_mov").insert({
        cliente_ref: clienteEfectivo,
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
  if (input.reservaId && clienteEfectivo) {
    await pushACliente(clienteEfectivo, {
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
      .eq("id", sedeEfectiva)
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
  // Vencimiento en el pasado: se rechaza (si no, el cupón se creaba y se listaba
  // como ACTIVO pero validarCupon lo rebota como "vencido" al cobrar). Se compara
  // contra HOY en Bogotá —no el UTC del server— para no rechazar el día vigente.
  if (input.venceEn && input.venceEn < bogotaYmd())
    return { ok: false, error: "Esa fecha de vencimiento ya pasó. Elige hoy o una fecha futura." };
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
  // Puntos: entero mayor a cero (antes solo chequeaba >0, dejaba pasar decimales/gigantes).
  const puntos = sanearCantidad(input.puntos);
  if (puntos === null || puntos <= 0) return { ok: false, error: "Puntos inválidos" };
  // Verifica saldo disponible.
  const { data } = await sb.from("puntos_mov").select("tipo,puntos").eq("cliente_ref", input.clienteRef);
  const saldo = ((data ?? []) as { tipo: string; puntos: number }[]).reduce(
    (a, m) => a + (m.tipo === "ganado" ? m.puntos : -m.puntos),
    0,
  );
  if (puntos > saldo) return { ok: false, error: `Saldo insuficiente (${saldo} pts)` };
  const { error } = await sb.from("puntos_mov").insert({
    cliente_ref: input.clienteRef,
    tipo: "canjeado",
    puntos,
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
  // Saneo del monto (misma barrera que addProducto): entero de pesos, sin negativos
  // ni decimales raros, y mayor a cero (un gasto de $0 no cuadra). Sin esto un
  // negativo inflaba el esperado del cierre y daba un faltante inventado.
  const monto = sanearCop(input.monto);
  if (monto === null || monto <= 0)
    return { ok: false, error: "El monto tiene que ser un número entero de pesos, mayor a cero." };
  const { error } = await sb.from("gastos").insert({
    sede_id: input.sede,
    categoria: input.categoria,
    monto,
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
  // Saneo del monto: entero de pesos, mayor a cero. Un negativo dejaba un saldo
  // negativo que se resta mal en la liquidación del barbero.
  const monto = sanearCop(input.monto);
  if (monto === null || monto <= 0)
    return { ok: false, error: "El monto tiene que ser un número entero de pesos, mayor a cero." };
  const { error } = await sb.from("adelantos").insert({
    barbero_id: input.barberoId,
    monto,
    saldo: monto,
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
  if (!input.nota.trim()) return { ok: false, error: "Escribe la nota" };
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
  // Monto de la wallet: entero de pesos, mayor a cero.
  const monto = sanearCop(input.monto);
  if (monto === null || monto <= 0) return { ok: false, error: "Monto inválido" };
  // Un consumo no puede dejar el monedero en negativo (mismo criterio que canjearPuntos).
  // Sin esto, un consumo mayor a lo recargado mostraba un saldo imposible en la ficha.
  if (input.tipo === "consumo") {
    const { data } = await sb.from("cliente_wallet_mov").select("tipo,monto").eq("cliente_ref", input.clienteRef);
    const saldo = ((data ?? []) as { tipo: string; monto: number }[]).reduce(
      (a, m) => a + (m.tipo === "recarga" ? m.monto : -m.monto),
      0,
    );
    if (monto > saldo) return { ok: false, error: `Saldo insuficiente en el monedero (disponible ${cop(saldo)}).` };
  }
  const { error } = await sb.from("cliente_wallet_mov").insert({
    cliente_ref: input.clienteRef,
    tipo: input.tipo,
    monto,
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
  // Meta y fondo de apertura: enteros de pesos, cero o más (el fondo puede ser 0).
  const metaDia = sanearCantidad(input.metaDia);
  if (metaDia === null)
    return { ok: false, error: "La meta del día tiene que ser un número entero de pesos, cero o más." };
  const montoApertura = sanearCantidad(input.montoApertura);
  if (montoApertura === null)
    return { ok: false, error: "El fondo de apertura tiene que ser un número entero de pesos, cero o más." };
  const { error } = await sb.from("caja_sesiones").insert({
    sede_id: input.sede,
    meta_dia: metaDia,
    monto_apertura: montoApertura,
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
  sesionId: string,
): Promise<{
  totales: ReturnType<typeof snapshotDinero>["totales"];
  efectivo: number;
  datafono: number;
  totalGastos: number;
  esperadoEfectivo: number;
  citas: number;
}> {
  // Ventas de ESTA sesión por caja_sesion_id (0052), no por ventana de tiempo: así el
  // cierre no deja huérfana una venta que se confirmó justo mientras se cerraba (#08).
  const vs = (await ventasDeSesion(
    admin,
    sedeId,
    sesionId,
    abiertaEnISO,
    "medio,total,propina,propinaMedio:propina_medio",
  )) as { medio: string; total: number; propina: number | null; propinaMedio: string | null }[];
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
  const snap = await snapshotCaja(client, params.sede, params.abiertaEnISO, params.montoApertura, params.sesionId);
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
  if (!puedeMostrador(staff.rol)) return { ok: false, error: "No autorizado" };

  const admin = supabaseAdmin();

  // La sede: el barbero cierra la SUYA (buscada por su barbero_id, ignora input);
  // el admin elige explícitamente.
  let sede: string | null = null;
  if (staff.rol === "barbero") {
    if (!staff.barberoId) return { ok: false, error: "No se pudo determinar tu sede." };
    const { data: barb } = await admin.from("barberos").select("sede_id").eq("id", staff.barberoId).maybeSingle();
    sede = (barb as { sede_id?: string } | null)?.sede_id ?? null;
    if (!sede) return { ok: false, error: "No se pudo determinar tu sede." };
  } else if (staff.rol === "sede") {
    // El mostrador cierra SU caja; el `input.sede` se ignora igual que con el
    // barbero, para que un POST directo no cierre la caja del otro local.
    sede = staff.sedeId;
    if (!sede) return { ok: false, error: "No se pudo determinar tu sede." };
  } else {
    sede = (input.sede ?? "").trim() || null;
    if (!sede) return { ok: false, error: "Elige una sede." };
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
  if (!nom || !slug) return { ok: false, error: "Escribe el nombre del medio de pago" };
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
  // Alcance por sede: la RLS de lista_espera es is_staff() sin scoping, así que el
  // candado real vive acá. Un barbero solo encola en SU sede y para barberos de su
  // sede; el admin puede en cualquiera.
  const staff = await getStaffContext();
  if (!(await staffPuedeOperarSede(staff, input.sede)))
    return { ok: false, error: "Esa sede no es la tuya." };
  if (input.barberoId && !(await staffPuedeOperarBarbero(staff, input.barberoId)))
    return { ok: false, error: "Ese barbero es de otra sede." };
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
export async function servirEspera(id: string, barberoElegido?: string): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const staff = await getStaffContext();
  if (!puedeMostrador(staff.rol)) return { ok: false, error: "No autorizado" };
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

  // Alcance por sede: la RLS de lista_espera/reservas no ata la sede de la espera,
  // así que un barbero podía reclamar una espera de la OTRA sede. Se valida acá y
  // se revierte el claim si no corresponde.
  if (!(await staffPuedeOperarSede(staff, ent.sede_id))) {
    await revertir();
    return { ok: false, error: "Esa espera es de otra sede." };
  }

  // La cita es de quien FIGURA en la espera (define su comisión, igual que
  // completarReserva deriva de reservas.barbero_id). Si la espera no tiene barbero
  // ("el primero que se desocupe"), cae en: el que el mostrador ELIGE al atender
  // (barberoElegido) o, si hay un barbero logueado, en él. Sin esta via, el perfil
  // 'sede' (login primario del mostrador, sin barbero propio) no podia servir NI
  // UNA espera "cualquiera", que es el caso normal.
  const barberoId = ent.barbero_id ?? barberoElegido ?? staff.barberoId;
  if (!barberoId) {
    await revertir();
    return { ok: false, error: "Elegí qué barbero la atiende." };
  }
  // El barbero elegido debe ser de la sede de la espera (mismo gate que el walk-in).
  if (barberoElegido && !(await staffPuedeOperarBarbero(staff, barberoId))) {
    await revertir();
    return { ok: false, error: "Ese barbero es de otra sede." };
  }
  // La silla es UNA: si el barbero ya tiene una atención en curso (aunque se haya
  // pasado de su fin estimado), no se le encima otra. Se revierte el claim de la espera.
  const { data: enSilla } = await sb.from("reservas").select("id").eq("barbero_id", barberoId).eq("estado", "en_curso").limit(1);
  if (enSilla && enSilla.length) {
    await revertir();
    return { ok: false, error: "Ese barbero tiene un cliente en la silla ahora. Cerrá esa atención antes de servir la espera." };
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
  // Whitelist contra el enum estado_espera (defensa en profundidad).
  const ESTADOS_ESPERA = ["esperando", "notificado", "asignado", "vencido", "cancelado"];
  if (!ESTADOS_ESPERA.includes(estado)) return { ok: false, error: "Estado inválido." };
  // Alcance por sede: leer la sede de la fila y validar antes de tocarla (la RLS
  // de lista_espera es is_staff() sin scoping por sede).
  const staff = await getStaffContext();
  const { data: fila } = await supabaseAdmin()
    .from("lista_espera")
    .select("sede_id")
    .eq("id", id)
    .maybeSingle();
  if (!fila) return { ok: false, error: "Esa espera no existe." };
  if (!(await staffPuedeOperarSede(staff, (fila as { sede_id: string }).sede_id)))
    return { ok: false, error: "Esa espera es de otra sede." };
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
  const staff = await getStaffContext();

  const admin = supabaseAdmin();
  // cliente_ref apunta a `clientes` (cliente_id era la columna legacy de profiles, siempre null).
  const { data: res, error: getErr } = await admin
    .from("reservas")
    .select("id, nota, cliente_ref, servicio_id, sede_id, inicio")
    .eq("id", input.reservaId)
    .maybeSingle();

  if (getErr || !res) return { ok: false, error: "Reserva no encontrada." };
  const rRow = res as { sede_id: string; inicio: string };
  // Gate de sede (igual que actualizarReserva/completarReserva): un barbero solo
  // propone adelantos sobre citas de SU sede; el admin sobre cualquiera. Antes no
  // había chequeo alguno y cualquier staff pisaba la nota de CUALQUIER reserva.
  if (!(await staffPuedeOperarSede(staff, rRow.sede_id)))
    return { ok: false, error: "Esa cita es de otra sede." };

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

  // Validación de la hora propuesta (antes se escribía a ojos cerrados): a futuro,
  // dentro de la ventana REAL de ese día (horarioEfectivo) y ANTES de la hora
  // actual de la cita (es un ADELANTO). El cliente re-valida al aceptar.
  const nuevo = new Date(input.inicioISO);
  if (Number.isNaN(nuevo.getTime())) return { ok: false, error: "La hora propuesta no es válida." };
  if (nuevo.getTime() <= Date.now()) return { ok: false, error: "Esa hora ya pasó. Proponé un horario a futuro." };
  if (nuevo.getTime() >= new Date(rRow.inicio).getTime())
    return { ok: false, error: "El adelanto tiene que ser antes de la hora actual de la cita." };
  const minDiaAdel = minutoDelDiaBogota(nuevo);
  const ventanaAdel = await ventanaDeDia(admin, rRow.sede_id, bogotaYmd(nuevo));
  if (!slotEnVentana(minDiaAdel, dur, ventanaAdel))
    return { ok: false, error: "Ese horario está fuera del horario de atención." };

  const fin = new Date(nuevo.getTime() + dur * 60000);

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
      body: `Hay un cupo más temprano: ${fechaHoraBogota(new Date(input.inicioISO))}. Entra para aceptar o rechazar.`,
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

// ---------- Ajustes de avisos automáticos ----------
/**
 * Antelación del aviso "tu cita es en un rato" (migración 0038). El RPC
 * tomar_avisos_pendientes lee estos valores en cada corrida, así que el cambio
 * aplica desde el próximo envío sin tocar n8n.
 */
export async function actualizarAjustesAvisos(input: {
  previoHoras: number;
  previoActivo: boolean;
}): Promise<ActionResult> {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  if (denied) return { ok: false, error: denied };
  // Mismos límites que el CHECK de la tabla: se validan acá para dar un mensaje
  // entendible en vez de un error de constraint.
  const horas = sanearPrevioHoras(input.previoHoras);
  if (horas === null)
    return { ok: false, error: "La antelación debe estar entre 30 minutos y 12 horas." };

  const { error } = await sb
    .from("ajustes_avisos")
    .update({
      previo_horas: horas,
      previo_activo: input.previoActivo,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return { ok: false, error: errorPublico("actualizarAjustesAvisos", error) };
  revalidatePath("/admin/avisos");
  return { ok: true };
}

// ---------- Avisos al barbero en su celular (web push del staff, 0047) ----------
/**
 * Guarda la suscripción push del STAFF logueado. El dueño de la suscripción sale
 * del PERFIL, no del cliente: un perfil por sede la ata a la sede (el aparato del
 * mostrador, que es el destinatario que importa) y un login de barbero a su ficha.
 *
 * El upsert va por `endpoint` y RE-VINCULA la fila al que está logueado ahora: en
 * el aparato compartido del local ese mismo navegador pudo quedar suscrito antes
 * como cliente o como otro barbero, y si no se re-vincula los avisos le siguen
 * llegando al anterior.
 */
export async function guardarPushStaff(sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<ActionResult> {
  const staff = await getStaffContext();
  const dueno = staff.sedeId
    ? { sede_id: staff.sedeId, barbero_id: null, cliente_ref: null }
    : staff.barberoId
      ? { sede_id: null, barbero_id: staff.barberoId, cliente_ref: null }
      : null;
  // El admin/dueño no tiene sede ni ficha: no hay a quién atar la suscripción.
  if (!dueno) return { ok: false, error: "Esta sesión no tiene sede ni barbero al que avisarle." };
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { ok: false, error: "Suscripción inválida." };
  }
  const { error } = await supabaseAdmin().from("push_subscriptions").upsert(
    // Los tres campos van explícitos (dos en null): el CHECK push_sub_dueno_unico
    // exige exactamente un dueño, y en un upsert los que no se mandan conservan
    // el valor viejo de la fila.
    { ...dueno, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, error: errorPublico("guardarPushStaff", error, "No se pudieron activar los avisos.") };
  return { ok: true };
}

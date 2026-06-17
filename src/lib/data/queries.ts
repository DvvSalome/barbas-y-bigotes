import { supabaseServer, supabaseServerAuth } from "@/lib/supabase/server";
import type { Sede, SedeId, Servicio, Barbero, Producto, Categoria } from "./types";

export async function getSedes(): Promise<Sede[]> {
  const sb = supabaseServer();
  const { data } = await sb.from("sedes").select("id,nombre,direccion").order("nombre");
  return (data ?? []).map((s) => ({
    id: s.id as SedeId,
    nombre: s.nombre,
    direccion: s.direccion ?? undefined,
  }));
}

export async function getServicios(): Promise<Servicio[]> {
  const sb = supabaseServer();
  const { data } = await sb
    .from("servicios")
    .select("id,nombre,categoria,duracion_min,es_combo,desde,servicio_sede(sede_id,precio)");
  return (data ?? []).map((s: Record<string, unknown>) => {
    const precios = {} as Record<SedeId, number>;
    for (const p of (s.servicio_sede as { sede_id: string; precio: number }[]) ?? []) {
      precios[p.sede_id as SedeId] = p.precio;
    }
    return {
      id: s.id as string,
      nombre: s.nombre as string,
      categoria: s.categoria as Categoria,
      duracionMin: s.duracion_min as number,
      esCombo: s.es_combo as boolean,
      desde: s.desde as boolean,
      precios,
    };
  });
}

export async function getBarberos(): Promise<Barbero[]> {
  const sb = supabaseServer();
  const { data } = await sb
    .from("barberos")
    .select(
      "id,nombre,sede_id,tipo_contrato,comision_pct,arriendo_mensual,foto_url,destacado,rating,resenas,orden,barbero_especialidades(especialidad)",
    )
    .eq("activo", true)
    .order("sede_id")
    .order("orden");
  return (data ?? []).map((b: Record<string, unknown>) => ({
    id: b.id as string,
    nombre: b.nombre as string,
    sede: b.sede_id as SedeId,
    especialidades: ((b.barbero_especialidades as { especialidad: string }[]) ?? []).map(
      (e) => e.especialidad,
    ),
    tipoContrato: b.tipo_contrato as Barbero["tipoContrato"],
    comisionPct: (b.comision_pct as number) ?? undefined,
    arriendoMensual: (b.arriendo_mensual as number) ?? undefined,
    fotoUrl: (b.foto_url as string) ?? null,
    destacado: b.destacado as boolean,
    rating: (b.rating as number) ?? undefined,
    resenas: (b.resenas as number) ?? undefined,
  }));
}

export async function getProductos(): Promise<Producto[]> {
  const sb = supabaseServer();
  const { data } = await sb
    .from("productos")
    .select("id,nombre,sede_id,precio,stock,stock_minimo,comision_pct")
    .order("sede_id");
  return (data ?? []).map((p: Record<string, unknown>) => ({
    id: p.id as string,
    nombre: p.nombre as string,
    sede: p.sede_id as SedeId,
    precio: p.precio as number,
    stock: p.stock as number,
    stockMinimo: p.stock_minimo as number,
    comisionPct: p.comision_pct as number,
  }));
}

export async function getVentasHoy() {
  const sb = await supabaseServerAuth();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { data } = await sb
    .from("ventas")
    .select(
      "id,medio,total,cliente_nombre,llegada,creado_en,sede_id,barberos(nombre),venta_items(descripcion,cantidad)",
    )
    .gte("creado_en", start.toISOString())
    .order("creado_en", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map((v) => ({
    id: v.id as string,
    medio: v.medio as string,
    total: v.total as number,
    cliente: (v.cliente_nombre as string) ?? "",
    llegada: (v.llegada as string) ?? "",
    sede: v.sede_id as string,
    barbero: (v.barberos as { nombre?: string } | null)?.nombre ?? "",
    items: ((v.venta_items as { descripcion: string; cantidad: number }[]) ?? []).map((i) =>
      i.cantidad > 1 ? `${i.descripcion} ×${i.cantidad}` : i.descripcion,
    ),
  }));
}

export type AgendaItem = {
  id: string;
  inicio: string;
  estado: string;
  canal: string;
  llegada: string | null;
  sede: string;
  barberoId: string | null;
  barbero: string;
  servicioId: string | null;
  servicio: string;
  clienteRef: string | null;
  cliente: string;
  telefono: string;
};

export async function getAgendaHoy(barberoId?: string | null): Promise<AgendaItem[]> {
  const sb = await supabaseServerAuth();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  let q = sb
    .from("reservas")
    .select(
      "id,inicio,estado,canal,llegada,sede_id,servicio_id,barbero_id,cliente_ref,servicios(nombre),barberos(nombre),clientes(nombre,telefono)",
    )
    .gte("inicio", start.toISOString())
    .lt("inicio", end.toISOString());
  if (barberoId) q = q.eq("barbero_id", barberoId);
  const { data } = await q.order("inicio");
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    inicio: r.inicio as string,
    estado: r.estado as string,
    canal: r.canal as string,
    llegada: (r.llegada as string) ?? null,
    sede: r.sede_id as string,
    barberoId: (r.barbero_id as string) ?? null,
    barbero: (r.barberos as { nombre?: string } | null)?.nombre ?? "",
    servicioId: (r.servicio_id as string) ?? null,
    servicio: (r.servicios as { nombre?: string } | null)?.nombre ?? "",
    clienteRef: (r.cliente_ref as string) ?? null,
    cliente: (r.clientes as { nombre?: string } | null)?.nombre ?? "",
    telefono: (r.clientes as { telefono?: string } | null)?.telefono ?? "",
  }));
}

export async function getHistorialCliente(clienteRef: string) {
  const sb = await supabaseServerAuth();
  const { data } = await sb
    .from("ventas")
    .select("id,total,medio,creado_en,barberos(nombre),venta_items(descripcion,cantidad)")
    .eq("cliente_ref", clienteRef)
    .order("creado_en", { ascending: false })
    .limit(20);
  return ((data ?? []) as Record<string, unknown>[]).map((v) => ({
    id: v.id as string,
    total: v.total as number,
    medio: v.medio as string,
    fecha: v.creado_en as string,
    barbero: (v.barberos as { nombre?: string } | null)?.nombre ?? "",
    items: ((v.venta_items as { descripcion: string; cantidad: number }[]) ?? []).map((i) =>
      i.cantidad > 1 ? `${i.descripcion} ×${i.cantidad}` : i.descripcion,
    ),
  }));
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getResumen() {
  const sb = await supabaseServerAuth();
  const start = startOfToday();
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const [ventasRes, prodsRes, adelRes] = await Promise.all([
    sb.from("ventas").select("total,medio").gte("creado_en", start.toISOString()),
    sb.from("productos").select("stock,stock_minimo"),
    sb.from("adelantos").select("monto").gte("fecha", monthStart.toISOString().slice(0, 10)),
  ]);
  const vs = (ventasRes.data ?? []) as { total: number; medio: string }[];
  const efectivo = vs.filter((v) => v.medio === "efectivo").reduce((a, v) => a + v.total, 0);
  const datafono = vs.filter((v) => v.medio === "datafono").reduce((a, v) => a + v.total, 0);
  const bajoMinimo = ((prodsRes.data ?? []) as { stock: number; stock_minimo: number }[]).filter(
    (p) => p.stock <= p.stock_minimo,
  ).length;
  const adelantosMes = ((adelRes.data ?? []) as { monto: number }[]).reduce((a, x) => a + x.monto, 0);
  return { ingresosHoy: efectivo + datafono, efectivo, datafono, citasHoy: vs.length, bajoMinimo, adelantosMes };
}

export type CuadreSede = {
  sede: string;
  nombre: string;
  efectivo: number;
  datafono: number;
  ingresos: number;
  gastos: number;
  neto: number;
  citas: number;
};

export async function getCuadre() {
  const sb = await supabaseServerAuth();
  const start = startOfToday();
  const fechaHoy = start.toISOString().slice(0, 10);
  const [sedesRes, ventasRes, gastosRes] = await Promise.all([
    sb.from("sedes").select("id,nombre").order("nombre"),
    sb.from("ventas").select("sede_id,medio,total").gte("creado_en", start.toISOString()),
    sb.from("gastos").select("id,sede_id,categoria,descripcion,monto").gte("fecha", fechaHoy),
  ]);
  const ventas = (ventasRes.data ?? []) as { sede_id: string; medio: string; total: number }[];
  const gastos = (gastosRes.data ?? []) as {
    id: string;
    sede_id: string;
    categoria: string;
    descripcion: string | null;
    monto: number;
  }[];

  const porSede: CuadreSede[] = ((sedesRes.data ?? []) as { id: string; nombre: string }[]).map((s) => {
    const vs = ventas.filter((v) => v.sede_id === s.id);
    const efectivo = vs.filter((v) => v.medio === "efectivo").reduce((a, v) => a + v.total, 0);
    const datafono = vs.filter((v) => v.medio === "datafono").reduce((a, v) => a + v.total, 0);
    const g = gastos.filter((x) => x.sede_id === s.id).reduce((a, x) => a + x.monto, 0);
    const ingresos = efectivo + datafono;
    return { sede: s.id, nombre: s.nombre, efectivo, datafono, ingresos, gastos: g, neto: ingresos - g, citas: vs.length };
  });

  const total = porSede.reduce(
    (acc, s) => ({
      efectivo: acc.efectivo + s.efectivo,
      datafono: acc.datafono + s.datafono,
      ingresos: acc.ingresos + s.ingresos,
      gastos: acc.gastos + s.gastos,
      neto: acc.neto + s.neto,
      citas: acc.citas + s.citas,
    }),
    { efectivo: 0, datafono: 0, ingresos: 0, gastos: 0, neto: 0, citas: 0 },
  );

  return { porSede, total, gastosHoy: gastos };
}

export type EsperaItem = {
  id: string;
  sede: string;
  barberoId: string | null;
  barbero: string;
  servicio: string;
  cliente: string;
  telefono: string;
  estado: string;
  creadoEn: string;
};

export async function getListaEspera(barberoId?: string | null): Promise<EsperaItem[]> {
  const sb = await supabaseServerAuth();
  let q = sb
    .from("lista_espera")
    .select(
      "id,sede_id,barbero_id,estado,creado_en,cliente_nombre,telefono,servicios(nombre),barberos(nombre)",
    )
    .in("estado", ["esperando", "notificado"]);
  // Un barbero ve los suyos + los que esperan a "cualquiera"; el admin (sin filtro) ve todo.
  if (barberoId) q = q.or(`barbero_id.eq.${barberoId},barbero_id.is.null`);
  const { data } = await q.order("creado_en");
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    sede: r.sede_id as string,
    barberoId: (r.barbero_id as string) ?? null,
    barbero: (r.barberos as { nombre?: string } | null)?.nombre ?? "Cualquiera",
    servicio: (r.servicios as { nombre?: string } | null)?.nombre ?? "—",
    cliente: (r.cliente_nombre as string) ?? "",
    telefono: (r.telefono as string) ?? "",
    estado: r.estado as string,
    creadoEn: r.creado_en as string,
  }));
}

export type StaffContext = { rol: string; barberoId: string | null; nombre: string };

// Rol + barbero del usuario logueado (para decidir qué agenda mostrar).
// Sin perfil → no filtra (las tablas igual están protegidas por RLS is_staff()).
export async function getStaffContext(): Promise<StaffContext> {
  const sb = await supabaseServerAuth();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { rol: "anon", barberoId: null, nombre: "" };
  const { data } = await sb
    .from("profiles")
    .select("rol,barbero_id,nombre")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!data) return { rol: "admin", barberoId: null, nombre: "" };
  const row = data as { rol: string; barbero_id: string | null; nombre: string };
  return { rol: row.rol, barberoId: row.barbero_id ?? null, nombre: row.nombre ?? "" };
}

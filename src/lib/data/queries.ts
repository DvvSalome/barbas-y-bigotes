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
    .select("id,nombre,categoria,duracion_min,es_combo,desde,servicio_sede(sede_id,precio)")
    .eq("activo", true);
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
      "id,nombre,sede_id,tipo_contrato,comision_pct,arriendo_mensual,foto_url,destacado,rating,resenas,bio,orden,barbero_especialidades(especialidad)",
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
    bio: (b.bio as string) ?? null,
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
  nota: string | null;
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
      "id,inicio,estado,canal,llegada,sede_id,servicio_id,barbero_id,cliente_ref,nota,servicios(nombre),barberos(nombre),clientes(nombre,telefono)",
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
    nota: r.nota as string | null,
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

export type CajaSesionSede = {
  sede: string;
  nombre: string;
  sesionId: string | null;
  abiertaEn: string | null;
  metaDia: number;
  montoApertura: number;
  efectivo: number;
  datafono: number;
  ingresos: number;
  citas: number;
};

// Estado de caja por sede: si hay sesión abierta + lo recaudado desde la apertura
// (o desde el inicio del día si no hay sesión abierta).
export async function getCajaSesiones(): Promise<CajaSesionSede[]> {
  const sb = await supabaseServerAuth();
  const [sedesRes, openRes] = await Promise.all([
    sb.from("sedes").select("id,nombre").order("nombre"),
    sb.from("caja_sesiones").select("id,sede_id,meta_dia,monto_apertura,abierta_en").eq("estado", "abierta"),
  ]);
  const sedes = (sedesRes.data ?? []) as { id: string; nombre: string }[];
  const open = (openRes.data ?? []) as {
    id: string;
    sede_id: string;
    meta_dia: number;
    monto_apertura: number;
    abierta_en: string;
  }[];
  const out: CajaSesionSede[] = [];
  for (const s of sedes) {
    const sess = open.find((o) => o.sede_id === s.id);
    const start = sess ? sess.abierta_en : startOfToday().toISOString();
    const { data: ventas } = await sb
      .from("ventas")
      .select("medio,total")
      .eq("sede_id", s.id)
      .gte("creado_en", start);
    const vs = (ventas ?? []) as { medio: string; total: number }[];
    const efectivo = vs.filter((v) => v.medio === "efectivo").reduce((a, v) => a + v.total, 0);
    const datafono = vs.filter((v) => v.medio === "datafono").reduce((a, v) => a + v.total, 0);
    out.push({
      sede: s.id,
      nombre: s.nombre,
      sesionId: sess?.id ?? null,
      abiertaEn: sess?.abierta_en ?? null,
      metaDia: sess?.meta_dia ?? 0,
      montoApertura: sess?.monto_apertura ?? 0,
      efectivo,
      datafono,
      ingresos: efectivo + datafono,
      citas: vs.length,
    });
  }
  return out;
}

export type PendienteCobro = {
  id: string;
  sede: string;
  cliente: string;
  barbero: string;
  servicio: string;
  inicio: string;
  monto: number;
};

// Reservas de hoy aún no completadas/canceladas: lo que falta cobrar.
export async function getReservasPendientesCobro(): Promise<PendienteCobro[]> {
  const sb = await supabaseServerAuth();
  const start = startOfToday();
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const [resRes, preciosRes] = await Promise.all([
    sb
      .from("reservas")
      .select("id,inicio,sede_id,servicio_id,clientes(nombre),barberos(nombre),servicios(nombre)")
      .in("estado", ["pendiente", "confirmada", "en_curso"])
      .gte("inicio", start.toISOString())
      .lt("inicio", end.toISOString())
      .order("inicio"),
    sb.from("servicio_sede").select("servicio_id,sede_id,precio"),
  ]);
  const precios = new Map<string, number>();
  for (const p of (preciosRes.data ?? []) as { servicio_id: string; sede_id: string; precio: number }[]) {
    precios.set(`${p.servicio_id}|${p.sede_id}`, p.precio);
  }
  return ((resRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    sede: r.sede_id as string,
    cliente: (r.clientes as { nombre?: string } | null)?.nombre ?? "Cliente",
    barbero: (r.barberos as { nombre?: string } | null)?.nombre ?? "—",
    servicio: (r.servicios as { nombre?: string } | null)?.nombre ?? "Servicio",
    inicio: r.inicio as string,
    monto: precios.get(`${r.servicio_id as string}|${r.sede_id as string}`) ?? 0,
  }));
}

export type CuadreCerrado = {
  id: string;
  sede: string;
  fecha: string;
  metaDia: number;
  ingresos: number;
  efectivo: number;
  datafono: number;
  gastos: number;
  diferencia: number | null;
  citas: number;
};

export async function getCuadresAnteriores(limit = 12): Promise<CuadreCerrado[]> {
  const sb = await supabaseServerAuth();
  const { data } = await sb
    .from("caja_sesiones")
    .select("id,sede_id,cerrada_en,meta_dia,total_efectivo,total_datafono,total_gastos,diferencia,citas,sedes(nombre)")
    .eq("estado", "cerrada")
    .order("cerrada_en", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Record<string, unknown>[]).map((c) => {
    const ef = (c.total_efectivo as number) ?? 0;
    const da = (c.total_datafono as number) ?? 0;
    return {
      id: c.id as string,
      sede: (c.sedes as { nombre?: string } | null)?.nombre ?? (c.sede_id as string),
      fecha: c.cerrada_en as string,
      metaDia: (c.meta_dia as number) ?? 0,
      efectivo: ef,
      datafono: da,
      ingresos: ef + da,
      gastos: (c.total_gastos as number) ?? 0,
      diferencia: (c.diferencia as number) ?? null,
      citas: (c.citas as number) ?? 0,
    };
  });
}

export type ClienteRow = {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  visitas: number;
  facturado: number;
  ultima: string | null;
};

export async function getClientes(search = ""): Promise<ClienteRow[]> {
  const sb = await supabaseServerAuth();
  let q = sb.from("clientes").select("id,nombre,telefono,email,creado_en");
  const s = search.trim();
  if (s) q = q.or(`nombre.ilike.%${s}%,telefono.ilike.%${s}%,email.ilike.%${s}%`);
  const [clientesRes, ventasRes] = await Promise.all([
    q.order("nombre"),
    sb.from("ventas").select("cliente_ref,total,creado_en"),
  ]);
  const agg = new Map<string, { visitas: number; facturado: number; ultima: string | null }>();
  for (const v of (ventasRes.data ?? []) as { cliente_ref: string | null; total: number; creado_en: string }[]) {
    if (!v.cliente_ref) continue;
    const a = agg.get(v.cliente_ref) ?? { visitas: 0, facturado: 0, ultima: null };
    a.visitas += 1;
    a.facturado += v.total;
    if (!a.ultima || v.creado_en > a.ultima) a.ultima = v.creado_en;
    agg.set(v.cliente_ref, a);
  }
  return ((clientesRes.data ?? []) as Record<string, unknown>[]).map((c) => {
    const a = agg.get(c.id as string) ?? { visitas: 0, facturado: 0, ultima: null };
    return {
      id: c.id as string,
      nombre: (c.nombre as string) ?? "Cliente",
      telefono: (c.telefono as string) ?? "",
      email: (c.email as string) ?? "",
      visitas: a.visitas,
      facturado: a.facturado,
      ultima: a.ultima,
    };
  });
}

export type ClienteDetalle = {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  notasFicha: string | null;
  creadoEn: string;
  visitas: number;
  facturado: number;
  ultima: string | null;
  walletBalance: number;
  ratingProm: number | null;
  puntosBalance: number;
  historial: { id: string; total: number; fecha: string; medio: string; barbero: string; items: string[] }[];
  reservas: { id: string; inicio: string; estado: string; servicio: string; barbero: string }[];
  notas: { id: string; nota: string; fecha: string }[];
  wallet: { id: string; tipo: string; monto: number; nota: string; fecha: string }[];
  resenas: { id: string; score: number; nota: string; barbero: string; fecha: string }[];
  puntos: { id: string; tipo: string; puntos: number; nota: string; fecha: string }[];
};

export async function getClienteDetalle(id: string): Promise<ClienteDetalle | null> {
  const sb = await supabaseServerAuth();
  const { data: c } = await sb
    .from("clientes")
    .select("id,nombre,telefono,email,notas,creado_en")
    .eq("id", id)
    .maybeSingle();
  if (!c) return null;
  const cli = c as Record<string, unknown>;

  const [ventasRes, reservasRes, notasRes, walletRes, resenasRes, puntosRes] = await Promise.all([
    sb
      .from("ventas")
      .select("id,total,medio,creado_en,barberos(nombre),venta_items(descripcion,cantidad)")
      .eq("cliente_ref", id)
      .order("creado_en", { ascending: false })
      .limit(50),
    sb
      .from("reservas")
      .select("id,inicio,estado,servicios(nombre),barberos(nombre)")
      .eq("cliente_ref", id)
      .order("inicio", { ascending: false })
      .limit(30),
    sb.from("cliente_notas").select("id,nota,creado_en").eq("cliente_ref", id).order("creado_en", { ascending: false }),
    sb.from("cliente_wallet_mov").select("id,tipo,monto,nota,creado_en").eq("cliente_ref", id).order("creado_en", { ascending: false }),
    sb.from("cliente_resenas").select("id,score,nota,creado_en,barberos(nombre)").eq("cliente_ref", id).order("creado_en", { ascending: false }),
    sb.from("puntos_mov").select("id,tipo,puntos,nota,creado_en").eq("cliente_ref", id).order("creado_en", { ascending: false }),
  ]);

  const ventas = (ventasRes.data ?? []) as Record<string, unknown>[];
  const wallet = (walletRes.data ?? []) as { id: string; tipo: string; monto: number; nota: string | null; creado_en: string }[];
  const resenas = (resenasRes.data ?? []) as Record<string, unknown>[];
  const puntos = (puntosRes.data ?? []) as { id: string; tipo: string; puntos: number; nota: string | null; creado_en: string }[];

  const facturado = ventas.reduce((a, v) => a + (v.total as number), 0);
  const ultima = ventas.length ? (ventas[0].creado_en as string) : null;
  const walletBalance = wallet.reduce((a, w) => a + (w.tipo === "recarga" ? w.monto : -w.monto), 0);
  const puntosBalance = puntos.reduce((a, p) => a + (p.tipo === "ganado" ? p.puntos : -p.puntos), 0);
  const ratingProm = resenas.length
    ? Math.round((resenas.reduce((a, r) => a + (r.score as number), 0) / resenas.length) * 10) / 10
    : null;

  return {
    id: cli.id as string,
    nombre: (cli.nombre as string) ?? "Cliente",
    telefono: (cli.telefono as string) ?? "",
    email: (cli.email as string) ?? "",
    notasFicha: (cli.notas as string) ?? null,
    creadoEn: cli.creado_en as string,
    visitas: ventas.length,
    facturado,
    ultima,
    walletBalance,
    ratingProm,
    puntosBalance,
    historial: ventas.map((v) => ({
      id: v.id as string,
      total: v.total as number,
      fecha: v.creado_en as string,
      medio: v.medio as string,
      barbero: (v.barberos as { nombre?: string } | null)?.nombre ?? "",
      items: ((v.venta_items as { descripcion: string; cantidad: number }[]) ?? []).map((i) =>
        i.cantidad > 1 ? `${i.descripcion} ×${i.cantidad}` : i.descripcion,
      ),
    })),
    reservas: ((reservasRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      inicio: r.inicio as string,
      estado: r.estado as string,
      servicio: (r.servicios as { nombre?: string } | null)?.nombre ?? "—",
      barbero: (r.barberos as { nombre?: string } | null)?.nombre ?? "—",
    })),
    notas: ((notasRes.data ?? []) as { id: string; nota: string; creado_en: string }[]).map((n) => ({
      id: n.id,
      nota: n.nota,
      fecha: n.creado_en,
    })),
    wallet: wallet.map((w) => ({ id: w.id, tipo: w.tipo, monto: w.monto, nota: w.nota ?? "", fecha: w.creado_en })),
    resenas: resenas.map((r) => ({
      id: r.id as string,
      score: r.score as number,
      nota: (r.nota as string) ?? "",
      barbero: (r.barberos as { nombre?: string } | null)?.nombre ?? "",
      fecha: r.creado_en as string,
    })),
    puntos: puntos.map((p) => ({ id: p.id, tipo: p.tipo, puntos: p.puntos, nota: p.nota ?? "", fecha: p.creado_en })),
  };
}

export type Cupon = {
  codigo: string;
  descripcion: string;
  tipo: string;
  valor: number;
  activo: boolean;
  usos: number;
  usosMax: number | null;
  venceEn: string | null;
};

export async function getCupones(): Promise<Cupon[]> {
  const sb = await supabaseServerAuth();
  const { data } = await sb
    .from("cupones")
    .select("codigo,descripcion,tipo,valor,activo,usos,usos_max,vence_en")
    .order("creado_en", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map((c) => ({
    codigo: c.codigo as string,
    descripcion: (c.descripcion as string) ?? "",
    tipo: c.tipo as string,
    valor: c.valor as number,
    activo: c.activo as boolean,
    usos: (c.usos as number) ?? 0,
    usosMax: (c.usos_max as number) ?? null,
    venceEn: (c.vence_en as string) ?? null,
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
  // Fail-closed: sin perfil → rol sin privilegios (no asumir admin).
  if (!data) return { rol: "none", barberoId: null, nombre: "" };
  const row = data as { rol: string; barbero_id: string | null; nombre: string };
  return { rol: row.rol, barberoId: row.barbero_id ?? null, nombre: row.nombre ?? "" };
}

// ---------- Portal del cliente ----------
export type CuentaData = {
  proximas: { id: string; inicio: string; estado: string; servicio: string; barbero: string; sede: string; nota: string | null; barberoId: string | null; servicioId: string | null; duracionMin: number }[];
  pasadas: { id: string; inicio: string; estado: string; servicio: string; barbero: string }[];
  puntosBalance: number;
  puntos: { tipo: string; puntos: number; nota: string; fecha: string }[];
  cola: { id: string; estado: string; servicio: string; barbero: string; creadoEn: string }[];
};

// Datos del cliente logueado. La RLS de cliente (0013) limita todo a lo propio.
export async function getCuenta(): Promise<CuentaData> {
  const sb = await supabaseServerAuth();
  const now = Date.now();
  const [resR, puntosR, colaR] = await Promise.all([
    sb.from("reservas").select("id,inicio,estado,sede_id,nota,barbero_id,servicio_id,servicios(nombre,duracion_min),barberos(nombre)").order("inicio", { ascending: false }).limit(40),
    sb.from("puntos_mov").select("tipo,puntos,nota,creado_en").order("creado_en", { ascending: false }).limit(40),
    sb.from("lista_espera").select("id,estado,creado_en,servicios(nombre),barberos(nombre)").in("estado", ["esperando", "notificado"]),
  ]);
  const reservas = ((resR.data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    inicio: r.inicio as string,
    estado: r.estado as string,
    sede: r.sede_id as string,
    nota: r.nota as string | null,
    barberoId: (r.barbero_id as string) ?? null,
    servicioId: (r.servicio_id as string) ?? null,
    duracionMin: (r.servicios as { duracion_min?: number } | null)?.duracion_min ?? 30,
    servicio: (r.servicios as { nombre?: string } | null)?.nombre ?? "—",
    barbero: (r.barberos as { nombre?: string } | null)?.nombre ?? "—",
  }));
  const activos = ["pendiente", "confirmada", "en_curso"];
  const esProxima = (r: { inicio: string; estado: string }) =>
    new Date(r.inicio).getTime() >= now && activos.includes(r.estado);
  const proximas = reservas.filter(esProxima).sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());
  const pasadas = reservas.filter((r) => !esProxima(r));
  const puntos = ((puntosR.data ?? []) as { tipo: string; puntos: number; nota: string | null; creado_en: string }[]).map((p) => ({
    tipo: p.tipo,
    puntos: p.puntos,
    nota: p.nota ?? "",
    fecha: p.creado_en,
  }));
  const puntosBalance = puntos.reduce((a, p) => a + (p.tipo === "ganado" ? p.puntos : -p.puntos), 0);
  const cola = ((colaR.data ?? []) as Record<string, unknown>[]).map((c) => ({
    id: c.id as string,
    estado: c.estado as string,
    servicio: (c.servicios as { nombre?: string } | null)?.nombre ?? "—",
    barbero: (c.barberos as { nombre?: string } | null)?.nombre ?? "Cualquiera",
    creadoEn: c.creado_en as string,
  }));
  return { proximas, pasadas, puntosBalance, puntos, cola };
}

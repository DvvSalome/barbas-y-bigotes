import { type SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer, supabaseServerAuth, supabaseAdmin } from "@/lib/supabase/server";
import { bogotaDayRange, bogotaDayRangeDeFecha, bogotaYmd } from "@/lib/slots";
import { totalesPorMedio, snapshotDinero, type TotalesPorMedio } from "@/lib/cobro";
import { CERQUILLO_EXCLUIDOS, estadoTarjeta, TARJETA_SIZE } from "@/lib/tarjeta";
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

// Catálogo COMPLETO para /admin/precios: incluye servicios INACTIVOS (para poder
// reactivar combos desactivados; getServicios() los filtra). servicios es catálogo
// público sin RLS y la página que lo consume es admin-only, así que va con anon.
export async function getServiciosCatalogoAdmin(): Promise<Servicio[]> {
  const sb = supabaseServer();
  const { data } = await sb
    .from("servicios")
    .select("id,nombre,categoria,duracion_min,es_combo,desde,activo,servicio_sede(sede_id,precio)")
    .order("categoria");
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
      activo: s.activo as boolean,
      precios,
    };
  });
}

// Precio por sede de TODOS los servicios (activos e inactivos) para el checkout
// del staff. A diferencia de getServicios() (solo activos, para los chips de
// adicionales), esto resuelve el precio del servicio FIJO de una reserva aunque
// el admin lo haya desactivado después: si no, el total en vivo del CheckoutForm
// cobraría de menos vs. lo que completarReserva cobra por servicio_sede.
export type PrecioServicioStaff = {
  id: string;
  nombre: string;
  preciosPorSede: Record<string, number>;
};

export async function getPreciosServiciosStaff(): Promise<PrecioServicioStaff[]> {
  const sb = supabaseServer();
  const { data } = await sb.from("servicios").select("id,nombre,servicio_sede(sede_id,precio)");
  return (data ?? []).map((s: Record<string, unknown>) => {
    const preciosPorSede: Record<string, number> = {};
    for (const p of (s.servicio_sede as { sede_id: string; precio: number }[]) ?? []) {
      preciosPorSede[p.sede_id] = p.precio;
    }
    return { id: s.id as string, nombre: s.nombre as string, preciosPorSede };
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
  const res = await sb
    .from("productos")
    .select("id,nombre,sede_id,precio,stock,stock_minimo,comision_pct,foto_url")
    .order("sede_id");
  let rows: Record<string, unknown>[] | null = res.data;
  if (res.error) {
    // Compat pre-0019: si foto_url todavía no existe en la DB, el POS no se cae.
    rows = (
      await sb
        .from("productos")
        .select("id,nombre,sede_id,precio,stock,stock_minimo,comision_pct")
        .order("sede_id")
    ).data;
  }
  return (rows ?? []).map((p: Record<string, unknown>) => ({
    id: p.id as string,
    nombre: p.nombre as string,
    sede: p.sede_id as SedeId,
    precio: p.precio as number,
    stock: p.stock as number,
    stockMinimo: p.stock_minimo as number,
    comisionPct: p.comision_pct as number,
    fotoUrl: (p.foto_url as string) ?? null,
  }));
}


export type MedioPago = { slug: string; nombre: string; activo: boolean; orden: number };

// Medios de pago activos (botones del cobro). Lectura pública como los catálogos;
// la validación autoritativa del medio la hace completarReserva server-side.
export async function getMedios(): Promise<MedioPago[]> {
  const sb = supabaseServer();
  const { data } = await sb
    .from("medios_pago")
    .select("slug,nombre,activo,orden")
    .eq("activo", true)
    .order("orden");
  return (data ?? []) as MedioPago[];
}

// Todos los medios (activos e inactivos): los administra el admin en /admin/cuadre
// y sirven para ponerle nombre a los slugs de cierres viejos.
export async function getMediosTodos(): Promise<MedioPago[]> {
  const sb = await supabaseServerAuth();
  const { data } = await sb.from("medios_pago").select("slug,nombre,activo,orden").order("orden");
  return (data ?? []) as MedioPago[];
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
  // "Hoy" es el día civil en Bogotá, no el del server (Vercel corre en UTC).
  const { desde, hasta } = bogotaDayRange();
  let q = sb
    .from("reservas")
    .select(
      "id,inicio,estado,canal,llegada,sede_id,servicio_id,barbero_id,cliente_ref,nota,servicios(nombre),barberos(nombre),clientes(nombre,telefono)",
    )
    .gte("inicio", desde.toISOString())
    .lt("inicio", hasta.toISOString());
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

// "Cobrado hoy" del header de la agenda: suma de ventas del día civil (Bogotá).
// Con la sesión del staff, RLS (0010) scopea las ventas al barbero logueado; el
// admin (sin filtro) ve todas. Si se pasa barberoId, filtra explícito para
// coincidir con el filtro de la agenda.
export async function getCobradoHoy(barberoId?: string | null): Promise<number> {
  const sb = await supabaseServerAuth();
  const { desde, hasta } = bogotaDayRange();
  let q = sb
    .from("ventas")
    .select("total")
    .gte("creado_en", desde.toISOString())
    .lt("creado_en", hasta.toISOString());
  if (barberoId) q = q.eq("barbero_id", barberoId);
  const { data } = await q;
  return ((data ?? []) as { total: number }[]).reduce((a, v) => a + v.total, 0);
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

export async function getResumen() {
  const sb = await supabaseServerAuth();
  const { desde } = bogotaDayRange();
  const mesInicio = `${bogotaYmd().slice(0, 8)}01`; // primer día del mes civil en Bogotá
  const [ventasRes, prodsRes, adelRes] = await Promise.all([
    sb.from("ventas").select("total,medio").gte("creado_en", desde.toISOString()),
    sb.from("productos").select("stock,stock_minimo"),
    sb.from("adelantos").select("monto").gte("fecha", mesInicio),
  ]);
  const vs = (ventasRes.data ?? []) as { total: number; medio: string }[];
  // Ingresos = TODOS los medios; efectivo/datáfono se desglosan y el resto va en "otros".
  const ingresosHoy = vs.reduce((a, v) => a + v.total, 0);
  const efectivo = vs.filter((v) => v.medio === "efectivo").reduce((a, v) => a + v.total, 0);
  const datafono = vs.filter((v) => v.medio === "datafono").reduce((a, v) => a + v.total, 0);
  const otros = ingresosHoy - efectivo - datafono;
  const bajoMinimo = ((prodsRes.data ?? []) as { stock: number; stock_minimo: number }[]).filter(
    (p) => p.stock <= p.stock_minimo,
  ).length;
  const adelantosMes = ((adelRes.data ?? []) as { monto: number }[]).reduce((a, x) => a + x.monto, 0);
  return { ingresosHoy, efectivo, datafono, otros, citasHoy: vs.length, bajoMinimo, adelantosMes };
}

export type CuadreSede = {
  sede: string;
  nombre: string;
  efectivo: number;
  datafono: number;
  /** Ventas en los demás medios (Nequi, transferencia, etc.). */
  otros: number;
  ingresos: number;
  gastos: number;
  neto: number;
  citas: number;
};

export async function getCuadre() {
  const sb = await supabaseServerAuth();
  const { desde } = bogotaDayRange();
  const fechaHoy = bogotaYmd();
  const [sedesRes, ventasRes, gastosRes] = await Promise.all([
    sb.from("sedes").select("id,nombre").order("nombre"),
    sb.from("ventas").select("sede_id,medio,total").gte("creado_en", desde.toISOString()),
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
    // Ingresos = TODOS los medios (Nequi, transferencia, etc. incluidos).
    const ingresos = vs.reduce((a, v) => a + v.total, 0);
    const otros = ingresos - efectivo - datafono;
    return { sede: s.id, nombre: s.nombre, efectivo, datafono, otros, ingresos, gastos: g, neto: ingresos - g, citas: vs.length };
  });

  const total = porSede.reduce(
    (acc, s) => ({
      efectivo: acc.efectivo + s.efectivo,
      datafono: acc.datafono + s.datafono,
      otros: acc.otros + s.otros,
      ingresos: acc.ingresos + s.ingresos,
      gastos: acc.gastos + s.gastos,
      neto: acc.neto + s.neto,
      citas: acc.citas + s.citas,
    }),
    { efectivo: 0, datafono: 0, otros: 0, ingresos: 0, gastos: 0, neto: 0, citas: 0 },
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
  /** Desglose por medio de pago (slug → total + propina) desde la apertura. */
  totales: TotalesPorMedio;
  /** Propinas cobradas en efectivo: entran al cajón para el cuadre. */
  propinaEfectivo: number;
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
    const start = sess ? sess.abierta_en : bogotaDayRange().desde.toISOString();
    const { data: ventas } = await sb
      .from("ventas")
      .select("medio,total,propina")
      .eq("sede_id", s.id)
      .gte("creado_en", start);
    const vs = (ventas ?? []) as { medio: string; total: number; propina: number | null }[];
    const totales = totalesPorMedio(vs);
    // Ingresos = TODOS los medios (no solo efectivo + datáfono).
    const ingresos = Object.values(totales).reduce((a, t) => a + t.total, 0);
    out.push({
      sede: s.id,
      nombre: s.nombre,
      sesionId: sess?.id ?? null,
      abiertaEn: sess?.abierta_en ?? null,
      metaDia: sess?.meta_dia ?? 0,
      montoApertura: sess?.monto_apertura ?? 0,
      efectivo: totales.efectivo?.total ?? 0,
      datafono: totales.datafono?.total ?? 0,
      ingresos,
      citas: vs.length,
      totales,
      propinaEfectivo: totales.efectivo?.propina ?? 0,
    });
  }
  return out;
}

export type CajaSedeEstado = {
  sesionId: string;
  abiertaEn: string;
  /** Esperado en el cajón = fondo de apertura + efectivo + propina en efectivo − gastos.
   *  Mismo cálculo que el cierre real (cerrarCajaSede), para que el preview no engañe. */
  esperadoEfectivo: number;
  /** Ingresos de TODOS los medios desde la apertura (solo para contexto). */
  ingresos: number;
} | null;

// Estado de la caja de UNA sede para el panel de cierre del barbero: la sesión
// abierta + el esperado en efectivo, o null si no hay caja abierta. caja_sesiones
// es RLS admin-only (0008) → supabaseAdmin() (el gate real es que /barbero es
// staff-only). No selecciona columnas de 0020 (aún sin ejecutar): tolera pre-migración.
export async function getCajaSede(sedeId: string): Promise<CajaSedeEstado> {
  if (!sedeId) return null;
  const admin = supabaseAdmin();
  const { data: sesion } = await admin
    .from("caja_sesiones")
    .select("id,abierta_en,monto_apertura")
    .eq("sede_id", sedeId)
    .eq("estado", "abierta")
    .maybeSingle();
  if (!sesion) return null;
  const ses = sesion as { id: string; abierta_en: string; monto_apertura: number | null };
  // Ventas + gastos desde la apertura: el preview debe usar el MISMO cálculo que
  // el cierre (fondo + efectivo + propina efectivo − gastos), o el barbero ve un
  // "esperado" inflado y una diferencia falsa cuando hubo gastos.
  const [ventasRes, gastosRes] = await Promise.all([
    admin.from("ventas").select("medio,total,propina").eq("sede_id", sedeId).gte("creado_en", ses.abierta_en),
    admin.from("gastos").select("monto").eq("sede_id", sedeId).gte("creado_en", ses.abierta_en),
  ]);
  const vs = (ventasRes.data ?? []) as { medio: string; total: number; propina: number | null }[];
  const totalGastos = ((gastosRes.data ?? []) as { monto: number }[]).reduce((a, g) => a + g.monto, 0);
  const { esperadoEfectivo, ingresos } = snapshotDinero(vs, {
    montoApertura: ses.monto_apertura ?? 0,
    totalGastos,
  });
  return { sesionId: ses.id, abiertaEn: ses.abierta_en, esperadoEfectivo, ingresos };
}

export type CajaDesgloseBarbero = {
  barberoId: string;
  nombre: string;
  fotoUrl: string | null;
  /** Suma de ventas.total del barbero desde la apertura de la caja. */
  ventas: number;
  /** Comisión del barbero = Σ(precio_unitario·cantidad·comision_pct/100) de sus venta_items. */
  comision: number;
};

export type CajaDesglose = {
  /** Barberos activos de la sede (ordenados), cada uno con sus ventas y comisión. */
  barberos: CajaDesgloseBarbero[];
  /** Efectivo esperado en el cajón (mismo cálculo que el cierre). */
  efectivo: number;
  /** Ingresos por medios digitales (todo lo que no es efectivo) desde la apertura. */
  digital: number;
} | null;

// Desglose de la caja ABIERTA de una sede para el panel del barbero: ventas y
// comisión por barbero + totales de sede (efectivo esperado / digital). Devuelve
// null si no hay caja abierta. Igual que getCajaSede, usa supabaseAdmin() porque
// caja_sesiones/ventas son RLS admin/scoped (0008/0010) y acá se necesita el
// consolidado de la sede; el gate real es que /barbero es staff-only.
export async function getCajaDesglose(sedeId: string): Promise<CajaDesglose> {
  if (!sedeId) return null;
  const admin = supabaseAdmin();
  const { data: sesion } = await admin
    .from("caja_sesiones")
    .select("id,abierta_en,monto_apertura")
    .eq("sede_id", sedeId)
    .eq("estado", "abierta")
    .maybeSingle();
  if (!sesion) return null;
  const ses = sesion as { id: string; abierta_en: string; monto_apertura: number | null };

  const [barbsRes, ventasRes, gastosRes, itemsRes] = await Promise.all([
    admin
      .from("barberos")
      .select("id,nombre,foto_url,orden")
      .eq("sede_id", sedeId)
      .eq("activo", true)
      .order("orden"),
    admin
      .from("ventas")
      .select("barbero_id,medio,total,propina")
      .eq("sede_id", sedeId)
      .gte("creado_en", ses.abierta_en),
    admin.from("gastos").select("monto").eq("sede_id", sedeId).gte("creado_en", ses.abierta_en),
    // Comisión por barbero: se calcula sobre los venta_items (los servicios llevan
    // el comision_pct del barbero —50—, los productos el suyo). No hay un cálculo
    // reusable en /admin/comisiones (esa página solo edita el % del contrato), así
    // que se calcula acá con el join venta_items→ventas (misma sede + desde apertura).
    admin
      .from("venta_items")
      .select("cantidad,precio_unitario,comision_pct,ventas!inner(barbero_id,sede_id,creado_en)")
      .eq("ventas.sede_id", sedeId)
      .gte("ventas.creado_en", ses.abierta_en),
  ]);

  const barbs = (barbsRes.data ?? []) as {
    id: string;
    nombre: string;
    foto_url: string | null;
    orden: number | null;
  }[];
  const vs = (ventasRes.data ?? []) as {
    barbero_id: string | null;
    medio: string;
    total: number;
    propina: number | null;
  }[];
  const totalGastos = ((gastosRes.data ?? []) as { monto: number }[]).reduce((a, g) => a + g.monto, 0);
  // El embed a la venta padre (to-one) llega como objeto en runtime, pero el tipo
  // inferido de PostgREST lo trata como array → cast vía unknown.
  const items = (itemsRes.data ?? []) as unknown as {
    cantidad: number;
    precio_unitario: number;
    comision_pct: number | null;
    ventas: { barbero_id: string | null } | null;
  }[];

  // Ventas por barbero (suma de ventas.total desde la apertura).
  const ventasPorBarbero = new Map<string, number>();
  for (const v of vs) {
    if (!v.barbero_id) continue;
    ventasPorBarbero.set(v.barbero_id, (ventasPorBarbero.get(v.barbero_id) ?? 0) + v.total);
  }
  // Comisión por barbero: precio_unitario·cantidad·comision_pct/100 por ítem.
  const comisionPorBarbero = new Map<string, number>();
  for (const it of items) {
    const bid = it.ventas?.barbero_id;
    if (!bid) continue;
    const c = (it.precio_unitario * it.cantidad * (Number(it.comision_pct) || 0)) / 100;
    comisionPorBarbero.set(bid, (comisionPorBarbero.get(bid) ?? 0) + c);
  }

  const barberos: CajaDesgloseBarbero[] = barbs.map((b) => ({
    barberoId: b.id,
    nombre: b.nombre,
    fotoUrl: b.foto_url ?? null,
    ventas: ventasPorBarbero.get(b.id) ?? 0,
    comision: Math.round(comisionPorBarbero.get(b.id) ?? 0),
  }));

  // Totales de sede: efectivo esperado (fondo + efectivo + propina efectivo − gastos)
  // y digital (todo lo cobrado por medios distintos de efectivo).
  const snap = snapshotDinero(vs, { montoApertura: ses.monto_apertura ?? 0, totalGastos });
  const efectivo = snap.esperadoEfectivo;
  const digital = snap.ingresos - snap.efectivo;

  return { barberos, efectivo, digital };
}

export type CajaHoy = {
  sede: string;
  nombre: string;
  estado: "abierta" | "cerrada" | "sin_abrir";
  /** Ingresos del día (todos los medios). */
  total: number;
  /** Diferencia de efectivo del cierre; null si sigue abierta o sin abrir. */
  diferencia: number | null;
  /** Nombre/email de quién cerró; null pre-migración 0020 o si sigue abierta. */
  cerradaPor: string | null;
  /** ISO: abierta_en si está abierta, cerrada_en si cerró; null si sin abrir. */
  hora: string | null;
};

// El cierre cerrado de HOY (día civil Bogotá) de una sede, tolerando pre-migración
// 0020: intenta leer cerrada_por y, si aún no existe la columna, reintenta sin ella.
async function cajaCerradaHoy(
  admin: ReturnType<typeof supabaseAdmin>,
  sedeId: string,
  desde: Date,
  hasta: Date,
): Promise<{ total: number; diferencia: number | null; cerradaPor: string | null; hora: string } | null> {
  const cols = "cerrada_en,totales,total_efectivo,total_datafono,diferencia";
  const pedir = (select: string) =>
    admin
      .from("caja_sesiones")
      .select(select)
      .eq("sede_id", sedeId)
      .eq("estado", "cerrada")
      .gte("cerrada_en", desde.toISOString())
      .lt("cerrada_en", hasta.toISOString())
      .order("cerrada_en", { ascending: false })
      .limit(1)
      .maybeSingle();
  let row: Record<string, unknown> | null = null;
  let cerradaPorId: string | null = null;
  const r = await pedir(`${cols},cerrada_por`);
  if (r.error) {
    const r2 = await pedir(cols);
    row = (r2.data as Record<string, unknown> | null) ?? null;
  } else {
    row = (r.data as Record<string, unknown> | null) ?? null;
    cerradaPorId = (row?.cerrada_por as string | null) ?? null;
  }
  if (!row) return null;
  const totales = (row.totales as TotalesPorMedio | null) ?? null;
  const total = totales
    ? Object.values(totales).reduce((a, t) => a + t.total, 0)
    : ((row.total_efectivo as number) ?? 0) + ((row.total_datafono as number) ?? 0);
  let cerradaPor: string | null = null;
  if (cerradaPorId) {
    const { data: prof } = await admin.from("profiles").select("nombre,email").eq("id", cerradaPorId).maybeSingle();
    const p = prof as { nombre?: string; email?: string } | null;
    cerradaPor = p?.nombre || p?.email || null;
  }
  return { total, diferencia: (row.diferencia as number | null) ?? null, cerradaPor, hora: row.cerrada_en as string };
}

// Estado de caja de HOY por sede para el dashboard admin (read-only, un vistazo).
// Prioriza la caja ABIERTA (invariante: máx. una por sede; puede venir de ayer si
// nadie la cerró → se muestra abierta como recordatorio ámbar). Si no hay abierta,
// muestra el cierre de hoy. caja RLS admin-only → supabaseAdmin (dashboard es admin).
export async function getCierresHoy(sede?: string | null): Promise<CajaHoy[]> {
  const sb = await supabaseServerAuth();
  const admin = supabaseAdmin();
  const { desde, hasta } = bogotaDayRange();
  const sedesRes = await sb.from("sedes").select("id,nombre").order("nombre");
  let sedes = (sedesRes.data ?? []) as { id: string; nombre: string }[];
  if (sede) sedes = sedes.filter((s) => s.id === sede);

  const out: CajaHoy[] = [];
  for (const s of sedes) {
    // 1) Caja abierta (cualquier fecha): prioridad, es lo que el dueño debe ver.
    const { data: abiertaRow } = await admin
      .from("caja_sesiones")
      .select("id,abierta_en")
      .eq("sede_id", s.id)
      .eq("estado", "abierta")
      .maybeSingle();
    if (abiertaRow) {
      const ab = abiertaRow as { id: string; abierta_en: string };
      const { data: ventas } = await admin
        .from("ventas")
        .select("total")
        .eq("sede_id", s.id)
        .gte("creado_en", ab.abierta_en);
      const total = ((ventas ?? []) as { total: number }[]).reduce((a, v) => a + v.total, 0);
      out.push({ sede: s.id, nombre: s.nombre, estado: "abierta", total, diferencia: null, cerradaPor: null, hora: ab.abierta_en });
      continue;
    }
    // 2) Cierre de hoy.
    const cerr = await cajaCerradaHoy(admin, s.id, desde, hasta);
    if (cerr) {
      out.push({ sede: s.id, nombre: s.nombre, estado: "cerrada", ...cerr });
      continue;
    }
    // 3) Nada hoy: la caja se abre sola con la primera venta.
    out.push({ sede: s.id, nombre: s.nombre, estado: "sin_abrir", total: 0, diferencia: null, cerradaPor: null, hora: null });
  }
  return out;
}

export type CajaChip = { abierta: boolean; desde: string | null; abiertasCount: number; sedesCount: number };

// Estado liviano de caja para el chip del topbar admin (sin sumar ventas).
// Con 2 sedes el binario engaña: se reporta cuántas están abiertas del total.
export async function getCajaChip(): Promise<CajaChip> {
  const sb = await supabaseServerAuth();
  const [abiertasRes, sedesRes] = await Promise.all([
    sb.from("caja_sesiones").select("abierta_en").eq("estado", "abierta").order("abierta_en"),
    sb.from("sedes").select("id"),
  ]);
  const abiertas = (abiertasRes.data ?? []) as { abierta_en: string }[];
  return {
    abierta: abiertas.length > 0,
    desde: abiertas[0]?.abierta_en ?? null,
    abiertasCount: abiertas.length,
    sedesCount: (sedesRes.data ?? []).length,
  };
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
  const { desde, hasta } = bogotaDayRange();
  const [resRes, preciosRes] = await Promise.all([
    sb
      .from("reservas")
      .select("id,inicio,sede_id,servicio_id,clientes(nombre),barberos(nombre),servicios(nombre)")
      .in("estado", ["pendiente", "confirmada", "en_curso"])
      .gte("inicio", desde.toISOString())
      .lt("inicio", hasta.toISOString())
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
  /** Desglose por medio del cierre (jsonb); null en cierres viejos (solo las 2 columnas legacy). */
  totales: TotalesPorMedio | null;
};

export async function getCuadresAnteriores(limit = 12): Promise<CuadreCerrado[]> {
  const sb = await supabaseServerAuth();
  const { data } = await sb
    .from("caja_sesiones")
    .select("id,sede_id,cerrada_en,meta_dia,total_efectivo,total_datafono,totales,total_gastos,diferencia,citas,sedes(nombre)")
    .eq("estado", "cerrada")
    .order("cerrada_en", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Record<string, unknown>[]).map((c) => {
    const totales = (c.totales as TotalesPorMedio | null) ?? null;
    const ef = totales ? totales.efectivo?.total ?? 0 : ((c.total_efectivo as number) ?? 0);
    const da = totales ? totales.datafono?.total ?? 0 : ((c.total_datafono as number) ?? 0);
    // Cierres nuevos: ingresos = todos los medios; viejos: solo las 2 columnas legacy.
    const ingresos = totales ? Object.values(totales).reduce((a, t) => a + t.total, 0) : ef + da;
    return {
      id: c.id as string,
      sede: (c.sedes as { nombre?: string } | null)?.nombre ?? (c.sede_id as string),
      fecha: c.cerrada_en as string,
      metaDia: (c.meta_dia as number) ?? 0,
      efectivo: ef,
      datafono: da,
      ingresos,
      gastos: (c.total_gastos as number) ?? 0,
      diferencia: (c.diferencia as number) ?? null,
      citas: (c.citas as number) ?? 0,
      totales,
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
  /** Postventa: lo que EL CLIENTE opinó del servicio (resenas_servicio), últimas 10. */
  calificaciones: { id: string; score: number; comentario: string; barbero: string; sede: string; fecha: string }[];
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

  const [ventasRes, reservasRes, notasRes, walletRes, resenasRes, puntosRes, califRes] = await Promise.all([
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
    sb
      .from("resenas_servicio")
      .select("id,score,comentario,creado_en,barberos(nombre),sedes(nombre)")
      .eq("cliente_ref", id)
      .order("creado_en", { ascending: false })
      .limit(10),
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
    calificaciones: ((califRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      score: r.score as number,
      comentario: (r.comentario as string) ?? "",
      barbero: (r.barberos as { nombre?: string } | null)?.nombre ?? "—",
      sede: (r.sedes as { nombre?: string } | null)?.nombre ?? "—",
      fecha: r.creado_en as string,
    })),
  };
}

export type PostventaResumen = {
  /** Promedio de score de los últimos 30 días (1 decimal); null sin datos. */
  promedio: number | null;
  /** Cantidad de calificaciones de los últimos 30 días. */
  total: number;
  /** Últimas 3 calificaciones que traen comentario. */
  ultimas: { id: string; score: number; comentario: string; barbero: string; sede: string; fecha: string }[];
};

// Postventa para el panel admin: cómo vienen calificando los clientes.
// Sesión del staff: la RLS de resenas_servicio (0018) da todo al admin y
// solo lo suyo al barbero. Si la tabla aún no existe, queda vacío.
export async function getPostventaResumen(sede?: string): Promise<PostventaResumen> {
  const sb = await supabaseServerAuth();
  const desde = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
  let scoresQ = sb.from("resenas_servicio").select("score").gte("creado_en", desde);
  if (sede) scoresQ = scoresQ.eq("sede_id", sede);
  let ultimasQ = sb
    .from("resenas_servicio")
    .select("id,score,comentario,creado_en,barberos(nombre),sedes(nombre)")
    .not("comentario", "is", null)
    .order("creado_en", { ascending: false })
    .limit(3);
  if (sede) ultimasQ = ultimasQ.eq("sede_id", sede);
  const [scoresRes, ultimasRes] = await Promise.all([scoresQ, ultimasQ]);
  const scores = ((scoresRes.data ?? []) as { score: number }[]).map((s) => s.score);
  const promedio = scores.length
    ? Math.round((scores.reduce((a, s) => a + s, 0) / scores.length) * 10) / 10
    : null;
  const ultimas = ((ultimasRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    score: r.score as number,
    comentario: (r.comentario as string) ?? "",
    barbero: (r.barberos as { nombre?: string } | null)?.nombre ?? "—",
    sede: (r.sedes as { nombre?: string } | null)?.nombre ?? "—",
    fecha: r.creado_en as string,
  }));
  return { promedio, total: scores.length, ultimas };
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

// ---------- Dashboard "Hoy" (admin) ----------
// Todas las ventanas de día usan bogotaDayRange (el server corre en UTC).

export type MedioHoy = { slug: string; nombre: string; total: number; propina: number };
export type VentasHoy = { total: number; propinas: number; atenciones: number; medios: MedioHoy[] };

// "La plata": cobrado hoy desglosado por medio de pago (total + propina).
export async function ventasHoyPorMedio(sede?: SedeId | null): Promise<VentasHoy> {
  const sb = await supabaseServerAuth();
  const { desde, hasta } = bogotaDayRange();
  let q = sb
    .from("ventas")
    .select("medio,total,propina")
    .gte("creado_en", desde.toISOString())
    .lt("creado_en", hasta.toISOString());
  if (sede) q = q.eq("sede_id", sede);
  const [ventasRes, mediosRes] = await Promise.all([
    q,
    sb.from("medios_pago").select("slug,nombre,orden"),
  ]);
  const vs = (ventasRes.data ?? []) as { medio: string; total: number; propina: number | null }[];
  const nombres = new Map(
    ((mediosRes.data ?? []) as { slug: string; nombre: string }[]).map((m) => [m.slug, m.nombre]),
  );
  const totales = totalesPorMedio(vs);
  const medios: MedioHoy[] = Object.entries(totales)
    .map(([slug, t]) => ({
      slug,
      nombre: nombres.get(slug) ?? slug.charAt(0).toUpperCase() + slug.slice(1),
      total: t.total,
      propina: t.propina,
    }))
    .sort((a, b) => b.total - a.total);
  return {
    total: vs.reduce((a, v) => a + v.total, 0),
    propinas: vs.reduce((a, v) => a + (v.propina ?? 0), 0),
    atenciones: vs.length,
    medios,
  };
}

export type EquipoAhoraItem = {
  id: string;
  nombre: string;
  sede: SedeId;
  /** Reserva en_curso de hoy (si hay): a quién atiende y cuándo sale. */
  enSilla: { cliente: string; servicio: string; fin: string } | null;
  pinBloqueado: boolean;
};

// "Equipo ahora": barberos activos con su estado en vivo + PIN bloqueado.
// supabaseAdmin: barbero_pin no expone SELECT por RLS (solo service role) y la
// página que llama esto vive detrás del guard admin del layout; no recibe
// input del cliente más allá del filtro de sede validado por el caller.
export async function equipoAhora(sede?: SedeId | null): Promise<EquipoAhoraItem[]> {
  const admin = supabaseAdmin();
  const { desde, hasta } = bogotaDayRange();
  let bq = admin
    .from("barberos")
    .select("id,nombre,sede_id,orden")
    .eq("activo", true)
    .order("sede_id")
    .order("orden");
  if (sede) bq = bq.eq("sede_id", sede);
  const [bRes, rRes, pinRes] = await Promise.all([
    bq,
    admin
      .from("reservas")
      .select("barbero_id,fin,servicios(nombre),clientes(nombre)")
      .eq("estado", "en_curso")
      .gte("inicio", desde.toISOString())
      .lt("inicio", hasta.toISOString())
      .order("fin", { ascending: false }),
    admin.from("barbero_pin").select("barbero_id,bloqueado_hasta"),
  ]);
  const now = Date.now();
  const bloqueados = new Set(
    ((pinRes.data ?? []) as { barbero_id: string; bloqueado_hasta: string | null }[])
      .filter((p) => p.bloqueado_hasta && new Date(p.bloqueado_hasta).getTime() > now)
      .map((p) => p.barbero_id),
  );
  const enCurso = new Map<string, { cliente: string; servicio: string; fin: string }>();
  for (const r of ((rRes.data ?? []) as Record<string, unknown>[]).reverse()) {
    const bid = r.barbero_id as string | null;
    if (!bid) continue;
    enCurso.set(bid, {
      cliente: (r.clientes as { nombre?: string } | null)?.nombre ?? "Walk-in",
      servicio: (r.servicios as { nombre?: string } | null)?.nombre ?? "Servicio",
      fin: r.fin as string,
    });
  }
  return ((bRes.data ?? []) as Record<string, unknown>[]).map((b) => ({
    id: b.id as string,
    nombre: b.nombre as string,
    sede: b.sede_id as SedeId,
    enSilla: enCurso.get(b.id as string) ?? null,
    pinBloqueado: bloqueados.has(b.id as string),
  }));
}

export type CitaSiguiente = {
  id: string;
  inicio: string;
  cliente: string;
  servicio: string;
  barbero: string;
  sede: SedeId;
};

// "Siguientes citas": lo que viene hoy (aún no empezado ni cerrado).
export async function citasSiguientes(sede?: SedeId | null, limit = 6): Promise<CitaSiguiente[]> {
  const sb = await supabaseServerAuth();
  const { hasta } = bogotaDayRange();
  let q = sb
    .from("reservas")
    .select("id,inicio,sede_id,servicios(nombre),barberos(nombre),clientes(nombre)")
    .in("estado", ["pendiente", "confirmada"])
    .gte("inicio", new Date().toISOString())
    .lt("inicio", hasta.toISOString())
    .order("inicio")
    .limit(limit);
  if (sede) q = q.eq("sede_id", sede);
  const { data } = await q;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    inicio: r.inicio as string,
    cliente: (r.clientes as { nombre?: string } | null)?.nombre ?? "Walk-in",
    servicio: (r.servicios as { nombre?: string } | null)?.nombre ?? "—",
    barbero: (r.barberos as { nombre?: string } | null)?.nombre ?? "—",
    sede: r.sede_id as SedeId,
  }));
}

export type ParaHacer = {
  bajoMinimo: { id: string; nombre: string; stock: number; sede: SedeId }[];
  malasResenas: { id: string; score: number; comentario: string; barbero: string; sede: SedeId; fecha: string }[];
  cuponesPorVencer: { codigo: string; venceEn: string; usos: number; usosMax: number | null }[];
};

// "Para hacer": stock bajo mínimo, calificaciones ≤3★ (últimos 7 días civiles)
// y cupones activos que vencen en ≤2 días.
export async function paraHacer(sede?: SedeId | null): Promise<ParaHacer> {
  const sb = await supabaseServerAuth();
  const desde7 = bogotaDayRangeDeFecha(bogotaYmd(new Date(Date.now() - 6 * 86_400_000))).desde;
  const hoy = bogotaYmd();
  const limite = bogotaYmd(new Date(Date.now() + 2 * 86_400_000));

  let pq = sb.from("productos").select("id,nombre,stock,stock_minimo,sede_id");
  if (sede) pq = pq.eq("sede_id", sede);
  let rq = sb
    .from("resenas_servicio")
    .select("id,score,comentario,creado_en,sede_id,barberos(nombre)")
    .lte("score", 3)
    .gte("creado_en", desde7.toISOString())
    .order("creado_en", { ascending: false })
    .limit(5);
  if (sede) rq = rq.eq("sede_id", sede);
  const cq = sb
    .from("cupones")
    .select("codigo,vence_en,usos,usos_max")
    .eq("activo", true)
    .not("vence_en", "is", null)
    .gte("vence_en", hoy)
    .lte("vence_en", limite)
    .order("vence_en");

  const [pRes, rRes, cRes] = await Promise.all([pq, rq, cq]);
  return {
    bajoMinimo: ((pRes.data ?? []) as Record<string, unknown>[])
      .filter((p) => (p.stock as number) <= (p.stock_minimo as number))
      .map((p) => ({
        id: p.id as string,
        nombre: p.nombre as string,
        stock: p.stock as number,
        sede: p.sede_id as SedeId,
      })),
    malasResenas: ((rRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      score: r.score as number,
      comentario: (r.comentario as string) ?? "",
      barbero: (r.barberos as { nombre?: string } | null)?.nombre ?? "—",
      sede: r.sede_id as SedeId,
      fecha: r.creado_en as string,
    })),
    cuponesPorVencer: ((cRes.data ?? []) as Record<string, unknown>[]).map((c) => ({
      codigo: c.codigo as string,
      venceEn: c.vence_en as string,
      usos: (c.usos as number) ?? 0,
      usosMax: (c.usos_max as number) ?? null,
    })),
  };
}

export type Serie7Dias = {
  /** Los últimos 7 días civiles en Bogotá (el último es hoy). */
  dias: { ymd: string; total: number }[];
  semana: number;
  semanaAnterior: number;
};

// Sparkline de ingresos: últimos 7 días vs los 7 anteriores.
export async function serie7Dias(sede?: SedeId | null): Promise<Serie7Dias> {
  const sb = await supabaseServerAuth();
  const { hasta } = bogotaDayRange();
  const desde14 = bogotaDayRangeDeFecha(bogotaYmd(new Date(Date.now() - 13 * 86_400_000))).desde;
  let q = sb
    .from("ventas")
    .select("creado_en,total")
    .gte("creado_en", desde14.toISOString())
    .lt("creado_en", hasta.toISOString());
  if (sede) q = q.eq("sede_id", sede);
  const { data } = await q;
  const dias: { ymd: string; total: number }[] = [];
  for (let i = 6; i >= 0; i--) dias.push({ ymd: bogotaYmd(new Date(Date.now() - i * 86_400_000)), total: 0 });
  const idx = new Map(dias.map((d, i) => [d.ymd, i]));
  let semanaAnterior = 0;
  for (const v of (data ?? []) as { creado_en: string; total: number }[]) {
    const i = idx.get(bogotaYmd(new Date(v.creado_en)));
    if (i != null) dias[i].total += v.total;
    else semanaAnterior += v.total;
  }
  return { dias, semana: dias.reduce((a, d) => a + d.total, 0), semanaAnterior };
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

// ---------- Tarjeta de cortes (fidelización) ----------
// El conteo de sellos se DERIVA de las ventas (no hay tabla nueva). "Corte" = un
// servicio de categoría cortes/combos menos los cerquillos. Estas lecturas tocan
// ventas/venta_items: el caller pasa el cliente Supabase correcto según su rol
// (admin/service_role para el cobro del barbero — RLS 0010 scopea las ventas por
// barbero y undercontaría; la sesión del cliente para su propio portal — RLS 0013).

// Ids de servicios que cuentan como "corte" para la tarjeta: categoría cortes/combos
// menos los cerquillos (flequillos). Los combos legado SIEMPRE incluyen corte
// ("Corte + …"), pero el armador (F3) puede crear combos SIN corte: esos llevan
// cuenta_corte=false (migración 0027) y NO deben sumar sello. null/true siguen contando.
export async function getCorteIds(sb: SupabaseClient): Promise<string[]> {
  let rows: { id: string; cuenta_corte: boolean | null }[];
  const res = await sb.from("servicios").select("id,cuenta_corte").in("categoria", ["cortes", "combos"]);
  if (res.error) {
    // Compat pre-0027: si la columna cuenta_corte todavía no existe (deploy antes
    // de aplicar la migración), reintentá sin ella — todo combo cuenta, como antes.
    const fb = await sb.from("servicios").select("id").in("categoria", ["cortes", "combos"]);
    rows = ((fb.data ?? []) as { id: string }[]).map((s) => ({ id: s.id, cuenta_corte: null }));
  } else {
    rows = (res.data ?? []) as { id: string; cuenta_corte: boolean | null }[];
  }
  return rows
    .filter((s) => s.cuenta_corte !== false)
    .map((s) => s.id)
    .filter((id) => !CERQUILLO_EXCLUIDOS.has(id));
}

// Nº de ventas del cliente que incluyeron al menos un corte (1 sello por venta).
export async function contarCortesCliente(sb: SupabaseClient, clienteRef: string): Promise<number> {
  if (!clienteRef) return 0;
  const corteIds = await getCorteIds(sb);
  if (corteIds.length === 0) return 0;
  const { data } = await sb
    .from("venta_items")
    .select("venta_id, ventas!inner(cliente_ref)")
    .eq("tipo", "servicio")
    .in("ref_id", corteIds)
    .eq("ventas.cliente_ref", clienteRef);
  return new Set(((data ?? []) as { venta_id: string }[]).map((r) => r.venta_id)).size;
}

// Precio del corte base en la sede (para topar el beneficio). 0 si no está priceado.
export async function precioCorteBase(sb: SupabaseClient, sede: string): Promise<number> {
  const { data } = await sb
    .from("servicio_sede")
    .select("precio")
    .eq("servicio_id", "corte")
    .eq("sede_id", sede)
    .maybeSingle();
  return (data as { precio?: number } | null)?.precio ?? 0;
}

// Estado de la tarjeta para el admin (solo lectura). Corre bajo la sesión del admin
// (RLS le da todas las ventas del cliente); la página que lo llama es admin-only.
export async function getTarjetaCliente(clienteRef: string) {
  const sb = await supabaseServerAuth();
  const cortesTotales = await contarCortesCliente(sb, clienteRef);
  const est = estadoTarjeta(cortesTotales);
  return {
    cortesTotales,
    sellos: est.sellos,
    tarjetasCompletas: Math.floor(cortesTotales / TARJETA_SIZE),
    proximo: est.proximo,
  };
}

// ---------- Portal del cliente ----------
export type CuentaData = {
  proximas: { id: string; inicio: string; estado: string; servicio: string; barbero: string; sede: string; nota: string | null; barberoId: string | null; servicioId: string | null; duracionMin: number }[];
  pasadas: { id: string; inicio: string; estado: string; servicio: string; barbero: string }[];
  puntosBalance: number;
  puntos: { tipo: string; puntos: number; nota: string; fecha: string }[];
  tarjeta: { cortes: number; sellos: number; proximo: { tipo: "50%" | "gratis"; faltan: number } };
  cola: { id: string; estado: string; servicio: string; barbero: string; fotoBarbero: string | null; creadoEn: string }[];
};

export type ReservaSinCalificar = {
  id: string;
  inicio: string;
  servicio: string;
  barbero: string;
  sede: string;
};

// La reserva completada más reciente del cliente (últimos 30 días) que todavía no
// tiene calificación. supabaseAdmin porque resenas_servicio no expone SELECT al
// cliente por RLS (deny by default); el clienteId viene VERIFICADO por ensureCliente
// en el caller (mismo patrón de ownership de las cliente-actions).
export async function getReservaSinCalificar(clienteId: string): Promise<ReservaSinCalificar | null> {
  if (!clienteId) return null;
  const admin = supabaseAdmin();
  const desde = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
  const { data, error } = await admin
    .from("reservas")
    .select("id,inicio,sede_id,servicios(nombre),barberos(nombre),sedes(nombre)")
    .eq("cliente_ref", clienteId)
    .eq("estado", "completada")
    .gte("inicio", desde)
    .order("inicio", { ascending: false })
    .limit(10);
  if (error || !data || data.length === 0) return null;
  const rows = data as Record<string, unknown>[];

  const ids = rows.map((r) => r.id as string);
  const { data: calif, error: califErr } = await admin
    .from("resenas_servicio")
    .select("reserva_id")
    .in("reserva_id", ids);
  // Fail-closed: si la tabla aún no existe (migración pendiente) o falla la
  // lectura, no se muestra el card (mejor que invitar a calificar y que falle).
  if (califErr) return null;
  const yaCalificadas = new Set(((calif ?? []) as { reserva_id: string }[]).map((c) => c.reserva_id));

  const pendiente = rows.find((r) => !yaCalificadas.has(r.id as string));
  if (!pendiente) return null;
  return {
    id: pendiente.id as string,
    inicio: pendiente.inicio as string,
    servicio: (pendiente.servicios as { nombre?: string } | null)?.nombre ?? "Tu servicio",
    barbero: (pendiente.barberos as { nombre?: string } | null)?.nombre ?? "—",
    sede: (pendiente.sedes as { nombre?: string } | null)?.nombre ?? (pendiente.sede_id as string),
  };
}

// Datos del cliente logueado. La RLS de cliente (0013) limita todo a lo propio,
// así que el conteo de cortes con la sesión del propio cliente es completo (ve
// todas sus ventas, sin importar qué barbero lo atendió).
export async function getCuenta(clienteRef: string): Promise<CuentaData> {
  const sb = await supabaseServerAuth();
  const now = Date.now();
  const [resR, puntosR, colaR] = await Promise.all([
    sb.from("reservas").select("id,inicio,estado,sede_id,nota,barbero_id,servicio_id,servicios(nombre,duracion_min),barberos(nombre)").order("inicio", { ascending: false }).limit(40),
    sb.from("puntos_mov").select("tipo,puntos,nota,creado_en").order("creado_en", { ascending: false }).limit(40),
    sb.from("lista_espera").select("id,estado,creado_en,servicios(nombre),barberos(nombre,foto_url)").in("estado", ["esperando", "notificado"]),
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
    fotoBarbero: (c.barberos as { foto_url?: string | null } | null)?.foto_url ?? null,
    creadoEn: c.creado_en as string,
  }));
  // Tarjeta de cortes: sellos reales derivados de las ventas del propio cliente.
  const cortesTotales = await contarCortesCliente(sb, clienteRef);
  const est = estadoTarjeta(cortesTotales);
  const tarjeta = { cortes: cortesTotales, sellos: est.sellos, proximo: est.proximo };
  return { proximas, pasadas, puntosBalance, puntos, tarjeta, cola };
}

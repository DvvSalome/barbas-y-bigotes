import { type SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer, supabaseServerAuth, supabaseAdmin } from "@/lib/supabase/server";
import { calendarConfigurado } from "@/lib/google-calendar";
import { bogotaDayRange, bogotaDayRangeDeFecha, bogotaYmd, horarioEfectivo, rangoPeriodo, semanaDeFecha, type Periodo } from "@/lib/slots";
import {
  totalesPorMedio,
  totalDeMedio,
  snapshotDinero,
  sumaGastosEfectivo,
  comisionDeItems,
  netoLiquidacion,
  type TotalesPorMedio,
  type ItemComision,
} from "@/lib/cobro";
import {
  estadoTarjeta,
  sanearConfigTarjeta,
  TARJETA_DEFECTO,
  type BeneficioTarjeta,
  type ConfigTarjeta,
} from "@/lib/tarjeta";
import type { Sede, SedeId, Servicio, Barbero, Producto, Categoria, TipoContrato } from "./types";

export async function getSedes(): Promise<Sede[]> {
  const sb = supabaseServer();
  const { data } = await sb.from("sedes").select("id,nombre,direccion,foto_url").order("nombre");
  return (data ?? []).map((s) => ({
    id: s.id as SedeId,
    nombre: s.nombre,
    direccion: s.direccion ?? undefined,
    fotoUrl: (s.foto_url as string | null) ?? null,
  }));
}

export async function getServicios(): Promise<Servicio[]> {
  const sb = supabaseServer();
  const { data } = await sb
    .from("servicios")
    .select(
      "id,nombre,categoria,duracion_min,es_combo,desde,foto_url,descripcion,cuenta_corte,servicio_sede(sede_id,precio)",
    )
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
      fotoUrl: (s.foto_url as string) ?? null,
      descripcion: (s.descripcion as string) ?? null,
      cuentaCorte: (s.cuenta_corte as boolean | null) ?? null,
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
    .select(
      "id,nombre,categoria,duracion_min,es_combo,desde,activo,foto_url,descripcion,cuenta_corte,servicio_sede(sede_id,precio)",
    )
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
      fotoUrl: (s.foto_url as string) ?? null,
      descripcion: (s.descripcion as string) ?? null,
      cuentaCorte: (s.cuenta_corte as boolean | null) ?? null,
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

// Campos PÚBLICOS del catálogo (sin el contrato). El contrato —tipo/comisión/
// arriendo— es dato confidencial de negocio y NO se expone acá (ver getBarberosContrato).
function mapBarberoPublico(b: Record<string, unknown>): Barbero {
  return {
    id: b.id as string,
    nombre: b.nombre as string,
    sede: b.sede_id as SedeId,
    especialidades: ((b.barbero_especialidades as { especialidad: string }[]) ?? []).map((e) => e.especialidad),
    fotoUrl: (b.foto_url as string) ?? null,
    destacado: b.destacado as boolean,
    rating: (b.rating as number) ?? undefined,
    resenas: (b.resenas as number) ?? undefined,
    bio: (b.bio as string) ?? null,
  };
}

// Catálogo público de barberos (lo lee la web, el wizard, el login del staff). NO
// trae tipo_contrato/comision_pct/arriendo_mensual: esas columnas están revocadas a
// anon/authenticated (0049) porque son el reparto de plata del local. Si se pidieran
// acá con la anon key, el REST las devolvía a cualquiera.
export async function getBarberos(): Promise<Barbero[]> {
  const sb = supabaseServer();
  const { data } = await sb
    .from("barberos")
    .select("id,nombre,sede_id,foto_url,destacado,rating,resenas,bio,orden,barbero_especialidades(especialidad)")
    .eq("activo", true)
    .order("sede_id")
    .order("orden");
  return (data ?? []).map((b) => mapBarberoPublico(b as Record<string, unknown>));
}

// Correo de avisos por barbero (barbero_contacto, 0066). La tabla es RLS-cerrada
// (solo service_role), así que se lee igual que los contratos (0049): service
// role SOLO tras confirmar que quien pide es admin. Lo usa /admin/equipo.
export async function getEmailsBarberos(): Promise<Record<string, string>> {
  const auth = await supabaseServerAuth();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return {};
  const { data: prof } = await auth.from("profiles").select("rol").eq("auth_id", user.id).maybeSingle();
  if ((prof as { rol?: string } | null)?.rol !== "admin") return {};
  // Antes de aplicar 0066 la tabla no existe: {} y la pantalla vive igual.
  const { data } = await supabaseAdmin().from("barbero_contacto").select("barbero_id,email");
  return Object.fromEntries(
    ((data ?? []) as { barbero_id: string; email: string }[]).map((r) => [r.barbero_id, r.email]),
  );
}

export type BarberoConContrato = Barbero & { tipoContrato: TipoContrato };

// Barberos CON su contrato (comisión/arriendo). Datos confidenciales: las 3 columnas
// están revocadas a anon y authenticated (0049), así que se leen con service_role y
// SOLO tras confirmar que quien pide es admin (defensa en profundidad: service_role
// saltea la RLS). Lo usa /admin/comisiones.
export async function getBarberosContrato(): Promise<BarberoConContrato[]> {
  const auth = await supabaseServerAuth();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return [];
  const { data: prof } = await auth.from("profiles").select("rol").eq("auth_id", user.id).maybeSingle();
  if ((prof as { rol?: string } | null)?.rol !== "admin") return [];

  const sb = supabaseAdmin();
  const { data } = await sb
    .from("barberos")
    .select(
      "id,nombre,sede_id,tipo_contrato,comision_pct,arriendo_mensual,foto_url,destacado,rating,resenas,bio,orden,barbero_especialidades(especialidad)",
    )
    .eq("activo", true)
    .order("sede_id")
    .order("orden");
  return (data ?? []).map((b) => {
    const r = b as Record<string, unknown>;
    return {
      ...mapBarberoPublico(r),
      tipoContrato: (r.tipo_contrato as TipoContrato) ?? "porcentaje",
      comisionPct: (r.comision_pct as number) ?? undefined,
      arriendoMensual: (r.arriendo_mensual as number) ?? undefined,
    };
  });
}

export async function getProductos(): Promise<Producto[]> {
  const sb = supabaseServer();
  const res = await sb
    .from("productos")
    .select("id,nombre,sede_id,precio,stock,stock_minimo,comision_pct,foto_url,en_upsell")
    .order("sede_id");
  let rows: Record<string, unknown>[] | null = res.data;
  if (res.error) {
    // Compat pre-0019/0028: si foto_url o en_upsell todavía no existen, el POS no se cae.
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
    enUpsell: (p.en_upsell as boolean) ?? false,
    fotoUrl: (p.foto_url as string) ?? null,
  }));
}

export type DiaEspecial = {
  id: string;
  sede: SedeId;
  fecha: string;
  abierta: boolean;
  motivo: string | null;
  abreMin: number | null;
  cierraMin: number | null;
};

export type HorarioSemanal = {
  sede: SedeId;
  dow: number; // 0=domingo..6=sábado
  abierta: boolean;
  abreMin: number;
  cierraMin: number;
};

// Horario base semanal por sede (migración 0048). Lectura pública: el wizard y el
// bloque de "Horarios de atención" lo usan. Si la tabla aún no existe (migración
// sin aplicar), devuelve [] y horarioEfectivo cae al respaldo 9-20; nada se rompe.
export async function getHorarioSemanal(): Promise<HorarioSemanal[]> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("sede_horario_semanal")
    .select("sede_id,dow,abierta,abre_min,cierra_min");
  if (error) {
    console.error("getHorarioSemanal:", error.message);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map((h) => ({
    sede: h.sede_id as SedeId,
    dow: h.dow as number,
    abierta: h.abierta as boolean,
    abreMin: h.abre_min as number,
    cierraMin: h.cierra_min as number,
  }));
}

// Excepciones de calendario de hoy en adelante (abrir un domingo, cerrar un
// festivo). Lectura pública: el wizard arma con esto los días que ofrece.
export async function getDiasEspeciales(): Promise<DiaEspecial[]> {
  const sb = supabaseServer();
  const { data } = await sb
    .from("sede_dias_especiales")
    .select("id,sede_id,fecha,abierta,motivo,abre_min,cierra_min")
    .gte("fecha", bogotaYmd())
    .order("fecha");
  return (data ?? []).map((d: Record<string, unknown>) => ({
    id: d.id as string,
    sede: d.sede_id as SedeId,
    fecha: d.fecha as string,
    abierta: d.abierta as boolean,
    motivo: (d.motivo as string) ?? null,
    abreMin: (d.abre_min as number) ?? null,
    cierraMin: (d.cierra_min as number) ?? null,
  }));
}

export type Ausencia = { id: string; barberoId: string; fecha: string };

// Ausencias de DÍA COMPLETO de hoy en adelante. Lectura pública: el wizard filtra
// al barbero ausente y el admin lista/quita. Los bloqueos por HORAS (0054) NO
// entran acá — viven en el calendario y en getDisponibilidad como ocupados.
export async function getAusencias(): Promise<Ausencia[]> {
  const sb = supabaseServer();
  const { data } = await sb
    .from("barbero_ausencias")
    .select("id,barbero_id,fecha")
    .is("desde_min", null)
    .gte("fecha", bogotaYmd())
    .order("fecha");
  return (data ?? []).map((a: Record<string, unknown>) => ({
    id: a.id as string,
    barberoId: a.barbero_id as string,
    fecha: a.fecha as string,
  }));
}

/** Ausencia con todo (admin): incluye los bloqueos por horas (0054). */
export type AusenciaAdmin = Ausencia & { motivo: string | null; desdeMin: number | null; hastaMin: number | null };

// TODAS las ausencias/bloqueos de hoy en adelante, para Equipo → Ausencias.
// (getAusencias queda solo-día-completo porque el wizard la usa para ESCONDER
// al barbero: un almuerzo no debe sacarlo del catálogo.)
export async function getAusenciasAdmin(): Promise<AusenciaAdmin[]> {
  const sb = supabaseServer();
  const { data } = await sb
    .from("barbero_ausencias")
    .select("id,barbero_id,fecha,motivo,desde_min,hasta_min")
    .gte("fecha", bogotaYmd())
    .order("fecha");
  return (data ?? []).map((a: Record<string, unknown>) => ({
    id: a.id as string,
    barberoId: a.barbero_id as string,
    fecha: a.fecha as string,
    motivo: (a.motivo as string) ?? null,
    desdeMin: (a.desde_min as number) ?? null,
    hastaMin: (a.hasta_min as number) ?? null,
  }));
}

export type BebidaUpsell = { id: string; nombre: string; precio: number; sede: SedeId };

// Bebidas del paso "¿le sumas una bebida?" del wizard: productos activos marcados
// en_upsell, por sede. El wizard filtra por la sede activa. Orden por precio para
// que el menú quede ascendente (Agua, Gaseosa, Cerveza, Energizante).
export async function getBebidasUpsell(): Promise<BebidaUpsell[]> {
  const sb = supabaseServer();
  const { data } = await sb
    .from("productos")
    .select("id,nombre,precio,sede_id")
    .eq("en_upsell", true)
    .eq("activo", true)
    .order("precio");
  return (data ?? []).map((p: Record<string, unknown>) => ({
    id: p.id as string,
    nombre: p.nombre as string,
    precio: p.precio as number,
    sede: p.sede_id as SedeId,
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
  /** El cliente confirmó su asistencia desde el correo (señal para el mostrador). */
  confirmado: boolean;
};

export async function getAgendaHoy(barberoId?: string | null): Promise<AgendaItem[]> {
  const sb = await supabaseServerAuth();
  // "Hoy" es el día civil en Bogotá, no el del server (Vercel corre en UTC).
  const { desde, hasta } = bogotaDayRange();
  let q = sb
    .from("reservas")
    .select(
      "id,inicio,estado,canal,llegada,confirmado_en,sede_id,servicio_id,barbero_id,cliente_ref,nota,servicios(nombre),barberos(nombre),clientes(nombre,telefono)",
    )
    .gte("inicio", desde.toISOString())
    .lt("inicio", hasta.toISOString());
  if (barberoId) q = q.eq("barbero_id", barberoId);
  const { data, error } = await q.order("inicio");
  if (error) console.error("getAgendaHoy:", error.message);
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
    confirmado: r.confirmado_en != null,
  }));
}

// ---------- Modo mostrador (una pantalla compartida en el local) ----------
// La agenda y el cobrado de TODA la sede, no solo del barbero logueado. Van con
// service role a propósito: la RLS de reservas/ventas scopea por barbero (0010) y
// acá el alcance correcto es la sede. Quien llama DEBE haber verificado antes que
// el staff pertenece a esa sede (staffPuedeOperarSede en actions.ts); estas
// funciones no son un permiso, son una lectura ya autorizada.
/** Agenda de hoy de una sede. `sedeId` null = las dos (mostrador del dueño). */
export async function getAgendaSedeHoy(sedeId: string | null): Promise<AgendaItem[]> {
  const admin = supabaseAdmin();
  const { desde, hasta } = bogotaDayRange();
  let q = admin
    .from("reservas")
    .select(
      "id,inicio,estado,canal,llegada,confirmado_en,sede_id,servicio_id,barbero_id,cliente_ref,nota,servicios(nombre),barberos(nombre),clientes(nombre,telefono)",
    )
    .gte("inicio", desde.toISOString())
    .lt("inicio", hasta.toISOString())
    .order("inicio");
  if (sedeId) q = q.eq("sede_id", sedeId);
  const { data, error } = await q;
  if (error) console.error("getAgendaSedeHoy:", error.message);
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
    confirmado: r.confirmado_en != null,
  }));
}

/** Ítem del calendario admin: la cita + su duración (para dibujar el bloque). */
export type AgendaDiaItem = AgendaItem & { duracionMin: number };

// Agenda de una sede en un día CUALQUIERA (el calendario del admin navega por
// fechas, no solo hoy). Mismo contrato de confianza que getAgendaSedeHoy: service
// role tras el gate de /admin — lectura ya autorizada, no un permiso.
export async function getAgendaSedeDia(sedeId: string, fechaYmd: string): Promise<AgendaDiaItem[]> {
  return getAgendaSedeRango(sedeId, fechaYmd, 1);
}

// Rango de días (la vista SEMANA del calendario): un solo viaje para los 7 días.
export async function getAgendaSedeRango(sedeId: string, desdeYmd: string, dias: number): Promise<AgendaDiaItem[]> {
  const admin = supabaseAdmin();
  const { desde } = bogotaDayRangeDeFecha(desdeYmd);
  const hasta = new Date(desde.getTime() + dias * 86_400_000);
  const { data, error } = await admin
    .from("reservas")
    .select(
      "id,inicio,estado,canal,llegada,confirmado_en,sede_id,servicio_id,barbero_id,cliente_ref,nota,servicios(nombre,duracion_min),barberos(nombre),clientes(nombre,telefono)",
    )
    .eq("sede_id", sedeId)
    .gte("inicio", desde.toISOString())
    .lt("inicio", hasta.toISOString())
    .order("inicio");
  if (error) console.error("getAgendaSedeRango:", error.message);
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
    confirmado: r.confirmado_en != null,
    duracionMin: (r.servicios as { duracion_min?: number } | null)?.duracion_min ?? 30,
  }));
}

export type AdelantoHoy = {
  id: string;
  barbero: string;
  monto: number;
  nota: string | null;
  creadoEn: string;
  /** Con qué se pagó (0067); null en filas de antes (eran efectivo). */
  medio: string | null;
};

// Adelantos registrados HOY (día civil Bogotá), con el nombre del barbero. El
// cuadre los lista para que registrar un adelanto deje rastro visible (antes no
// aparecía en ninguna parte y el dueño lo registraba dos veces).
export async function getAdelantosHoy(): Promise<AdelantoHoy[]> {
  const admin = supabaseAdmin();
  const { desde, hasta } = bogotaDayRange();
  const { data, error } = await admin
    .from("adelantos")
    // select("*") tolera que `medio` (0067) aún no exista.
    .select("*,barberos(nombre)")
    .gte("creado_en", desde.toISOString())
    .lt("creado_en", hasta.toISOString())
    .order("creado_en", { ascending: false });
  if (error) console.error("getAdelantosHoy:", error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((a) => ({
    id: a.id as string,
    barbero: (a.barberos as { nombre?: string } | null)?.nombre ?? "",
    monto: a.monto as number,
    nota: (a.nota as string) ?? null,
    creadoEn: a.creado_en as string,
    medio: (a.medio as string) ?? null,
  }));
}

/** Bloqueo pintado en el calendario. desdeMin null = todo el día. */
export type BloqueoDia = {
  id: string;
  barberoId: string;
  motivo: string | null;
  desdeMin: number | null;
  hastaMin: number | null;
};

// Bloqueos/ausencias de un día para las columnas del calendario (0054). Mismo
// contrato que getAgendaSedeDia: lectura ya autorizada tras el gate staff/admin.
export async function getBloqueosDia(barberoIds: string[], fechaYmd: string): Promise<BloqueoDia[]> {
  if (!barberoIds.length) return [];
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("barbero_ausencias")
    .select("id,barbero_id,motivo,desde_min,hasta_min")
    .in("barbero_id", barberoIds)
    .eq("fecha", fechaYmd);
  if (error) console.error("getBloqueosDia:", error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((b) => ({
    id: b.id as string,
    barberoId: b.barbero_id as string,
    motivo: (b.motivo as string) ?? null,
    desdeMin: (b.desde_min as number) ?? null,
    hastaMin: (b.hasta_min as number) ?? null,
  }));
}

/** Una venta de hoy con lo que se llevó el cliente. */
export type VentaHoy = {
  id: string;
  /** null = venta rápida (sin cita). */
  reservaId: string | null;
  barberoId: string | null;
  /** Nombre del cliente de la venta rápida (la de una cita lo saca de la agenda). */
  cliente: string;
  total: number;
  propina: number;
  descuento: number;
  medio: string;
  creadoEn: string;
  items: { tipo: string; descripcion: string; cantidad: number; precioUnitario: number }[];
};

/**
 * Ventas de hoy de la sede CON sus ítems: qué se llevó cada cliente. `sedeId`
 * null = las DOS sedes, que es lo que ve el dueño cuando abre el mostrador (el
 * barbero siempre pasa la suya).
 * De acá sale también el "cobrado hoy" (suma de los totales): un solo viaje.
 */
export async function getVentasSedeHoy(sedeId: string | null): Promise<VentaHoy[]> {
  const admin = supabaseAdmin();
  const { desde, hasta } = bogotaDayRange();
  let q = admin
    .from("ventas")
    .select(
      "id,reserva_id,barbero_id,total,propina,descuento,medio,creado_en,cliente_nombre,clientes(nombre),venta_items(tipo,descripcion,cantidad,precio_unitario)",
    )
    .gte("creado_en", desde.toISOString())
    .lt("creado_en", hasta.toISOString())
    .order("creado_en", { ascending: false });
  if (sedeId) q = q.eq("sede_id", sedeId);
  const { data, error } = await q;
  if (error) console.error("getVentasSedeHoy:", error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((v) => ({
    id: v.id as string,
    reservaId: (v.reserva_id as string) ?? null,
    barberoId: (v.barbero_id as string) ?? null,
    cliente:
      (v.clientes as { nombre?: string } | null)?.nombre ?? (v.cliente_nombre as string) ?? "",
    total: v.total as number,
    propina: (v.propina as number) ?? 0,
    descuento: (v.descuento as number) ?? 0,
    medio: v.medio as string,
    creadoEn: v.creado_en as string,
    items: (
      (v.venta_items as
        | { tipo: string; descripcion: string; cantidad: number; precio_unitario: number }[]
        | null) ?? []
    ).map((i) => ({
      tipo: i.tipo,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      precioUnitario: i.precio_unitario,
    })),
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
  const { data, error } = await q;
  if (error) console.error("getCobradoHoy:", error.message);
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
    sb.from("ventas").select("total,medio,pagos").gte("creado_en", desde.toISOString()),
    sb.from("productos").select("stock,stock_minimo"),
    sb.from("adelantos").select("monto").gte("fecha", mesInicio),
  ]);
  const vs = (ventasRes.data ?? []) as { total: number; medio: string; pagos?: unknown }[];
  // Ingresos = TODOS los medios; efectivo/datáfono se desglosan y el resto va en "otros".
  const ingresosHoy = vs.reduce((a, v) => a + v.total, 0);
  // Por MEDIO REPARTIDO, no por el medio principal: en un cobro mixto (0060) el
  // filtro por v.medio cargaba los 35 mil enteros al efectivo aunque 15 hubieran
  // entrado por Nequi.
  const efectivo = totalDeMedio(vs, "efectivo");
  const datafono = totalDeMedio(vs, "datafono");
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
  const { desde, hasta } = bogotaDayRange();
  const [sedesRes, ventasRes, gastosRes] = await Promise.all([
    sb.from("sedes").select("id,nombre").order("nombre"),
    sb.from("ventas").select("sede_id,medio,total,pagos").gte("creado_en", desde.toISOString()),
    // Gastos por creado_en dentro del día de Bogotá [desde, hasta), igual que las
    // ventas y el cierre de caja. Antes se filtraba por la columna `fecha` (date con
    // default current_date en UTC) con un `>=` abierto: un gasto de la noche quedaba
    // fechado el día siguiente y, sin cota superior, se contaba HOY y MAÑANA.
    // select("*") a propósito: tolera que `medio` (0067) aún no exista.
    sb
      .from("gastos")
      .select("*")
      .gte("creado_en", desde.toISOString())
      .lt("creado_en", hasta.toISOString()),
  ]);
  const ventas = (ventasRes.data ?? []) as { sede_id: string; medio: string; total: number; pagos?: unknown }[];
  const gastos = (gastosRes.data ?? []) as {
    id: string;
    sede_id: string;
    categoria: string;
    descripcion: string | null;
    monto: number;
    medio?: string | null;
  }[];

  const porSede: CuadreSede[] = ((sedesRes.data ?? []) as { id: string; nombre: string }[]).map((s) => {
    const vs = ventas.filter((v) => v.sede_id === s.id);
    const efectivo = totalDeMedio(vs, "efectivo");
    const datafono = totalDeMedio(vs, "datafono");
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

export async function getListaEspera(
  barberoId?: string | null,
  /** Perfil por sede (0044): la espera se acota a SU sede. La RLS de
   *  lista_espera es is_staff(), que ya incluye al rol `sede`, así que sin este
   *  filtro el mostrador de un local vería también la cola del otro. */
  sedeId?: string | null,
): Promise<EsperaItem[]> {
  const sb = await supabaseServerAuth();
  // El login PERSONAL de barbero no trae sede en su perfil (StaffContext.sedeId=null),
  // pero SU ficha sí. Sin acotar por sede, el `.or(barbero_id.is.null)` de abajo le
  // mostraría las entradas "cualquiera" —con nombre y teléfono del cliente— de la OTRA
  // sede. Se resuelve la sede del barbero y se acota igual que el rol `sede`.
  let sedeScope = sedeId ?? null;
  if (!sedeScope && barberoId) {
    const { data: b } = await sb.from("barberos").select("sede_id").eq("id", barberoId).maybeSingle();
    sedeScope = (b as { sede_id?: string } | null)?.sede_id ?? null;
  }
  let q = sb
    .from("lista_espera")
    .select(
      // lista_espera tiene DOS FKs a barberos (barbero_id y cupo_barbero_id, ver 0033):
      // hay que desambiguar el embed a la FK correcta o PostgREST tira PGRST201 y la fila
      // queda muerta. La clave del embed sigue siendo "barberos" para el map de abajo.
      "id,sede_id,barbero_id,estado,creado_en,cliente_nombre,telefono,servicios(nombre),barberos!lista_espera_barbero_id_fkey(nombre)",
    )
    .in("estado", ["esperando", "notificado"]);
  // Un barbero ve los suyos + los que esperan a "cualquiera" (de su sede); el admin
  // (sin filtro) ve todo.
  if (barberoId) q = q.or(`barbero_id.eq.${barberoId},barbero_id.is.null`);
  if (sedeScope) q = q.eq("sede_id", sedeScope);
  const { data, error } = await q.order("creado_en");
  // No tragarse el error: un fallo de esquema/RLS no debe leerse como "nadie en espera".
  if (error) console.error("getListaEspera:", error.message);
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
  /** Gastos en efectivo desde la apertura (salen del cajón). */
  gastos: number;
  /** Adelantos en efectivo a los barberos de la sede desde la apertura (también
   *  salen del cajón; los por transferencia no cuentan acá). */
  adelantos: number;
  /** Efectivo esperado en el cajón = fondo + efectivo + propina efectivo − gastos.
   *  MISMO cálculo que el cierre real (cerrarCaja/snapshotDinero); la card del admin
   *  lo usa tal cual, no lo re-deriva, para que el preview no engañe. */
  esperadoEfectivo: number;
};

// Ventas que pertenecen a una sesión de caja (0052): las ESTAMPADAS con su id (las
// nuevas) MÁS —red de transición e histórico— las SIN estampar que caen en su ventana
// de tiempo. Reemplaza la asociación solo-por-tiempo que dejaba ventas huérfanas si se
// confirmaban justo mientras se cerraba la caja (auditoría #08). El cierre y las
// previews lo usan para que "esperado" no dependa del timing. Dos queries en vez de un
// `.or(...)` con timestamp: evita el frágil string de filtro de PostgREST.
export async function ventasDeSesion(
  client: SupabaseClient,
  sede: string,
  sesionId: string,
  abiertaEnISO: string,
  cols: string,
): Promise<Record<string, unknown>[]> {
  const [tagged, sinTag] = await Promise.all([
    client.from("ventas").select(cols).eq("sede_id", sede).eq("caja_sesion_id", sesionId),
    client
      .from("ventas")
      .select(cols)
      .eq("sede_id", sede)
      .is("caja_sesion_id", null)
      .gte("creado_en", abiertaEnISO),
  ]);
  // .select(cols) con cols dinámico: supabase-js no infiere las columnas (tipa data
  // como error), por eso el cast va vía unknown.
  return [
    ...((tagged.data ?? []) as unknown as Record<string, unknown>[]),
    ...((sinTag.data ?? []) as unknown as Record<string, unknown>[]),
  ];
}

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
    // Ventas de la SESIÓN (por caja_sesion_id, 0052) si hay caja abierta; si no, lo
    // recaudado del día. Gastos por creado_en dentro del período (igual que getCajaSede
    // y el cierre), para que el "esperado" salga del MISMO snapshotDinero que el cierre.
    const [vsRaw, gastosRes] = await Promise.all([
      sess
        ? ventasDeSesion(sb, s.id, sess.id, sess.abierta_en, "medio,total,propina,propinaMedio:propina_medio,pagos")
        : sb
            .from("ventas")
            .select("medio,total,propina,propinaMedio:propina_medio,pagos")
            .eq("sede_id", s.id)
            .gte("creado_en", start)
            .then((r) => (r.data ?? []) as unknown as Record<string, unknown>[]),
      sb.from("gastos").select("*").eq("sede_id", s.id).gte("creado_en", start),
    ]);
    const vs = vsRaw as { medio: string; total: number; propina: number | null; propinaMedio: string | null }[];
    // Del cajón solo salió lo pagado en efectivo (0067); un gasto por Nequi no
    // puede inventar un faltante en el cierre.
    const gastosEf = sumaGastosEfectivo((gastosRes.data ?? []) as { monto: number; medio?: string | null }[]);
    // Los adelantos en efectivo también salen del cajón (regla del dueño, 27-ago).
    const adelantosEf = await adelantosEfectivoSede(sb, s.id, start);
    const totalGastos = gastosEf + adelantosEf;
    const montoApertura = sess?.monto_apertura ?? 0;
    const snap = snapshotDinero(vs, { montoApertura, totalGastos });
    out.push({
      sede: s.id,
      nombre: s.nombre,
      sesionId: sess?.id ?? null,
      abiertaEn: sess?.abierta_en ?? null,
      metaDia: sess?.meta_dia ?? 0,
      montoApertura,
      efectivo: snap.efectivo,
      datafono: snap.datafono,
      ingresos: snap.ingresos, // TODOS los medios (no solo efectivo + datáfono)
      citas: vs.length,
      totales: snap.totales,
      propinaEfectivo: snap.totales.efectivo?.propina ?? 0,
      gastos: gastosEf,
      adelantos: adelantosEf,
      esperadoEfectivo: snap.esperadoEfectivo,
    });
  }
  return out;
}

// Adelantos EN EFECTIVO a los barberos de una sede desde `desdeISO`: plata que
// salió físicamente del cajón (el dueño lo confirmó el 27-ago: el adelanto en
// efectivo sale de caja; por transferencia, no). Se suma al mismo `totalGastos`
// del snapshot. `adelantos` no tiene sede: se llega por el barbero.
export async function adelantosEfectivoSede(client: SupabaseClient, sedeId: string, desdeISO: string): Promise<number> {
  const { data, error } = await client
    .from("adelantos")
    .select("monto,medio,barberos!inner(sede_id)")
    .eq("barberos.sede_id", sedeId)
    .gte("creado_en", desdeISO);
  if (error) console.error("adelantosEfectivoSede:", error.message);
  return sumaGastosEfectivo((data ?? []) as { monto: number; medio?: string | null }[]);
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
  // Ventas de la SESIÓN (por caja_sesion_id, 0052) + gastos desde la apertura: el
  // preview debe usar el MISMO cálculo que el cierre (fondo + efectivo + propina
  // efectivo − gastos) y el mismo criterio de pertenencia, o el barbero ve un
  // "esperado" que no coincide con lo que sale al cerrar.
  const [vsRaw, gastosRes] = await Promise.all([
    ventasDeSesion(admin, sedeId, ses.id, ses.abierta_en, "medio,total,propina,propinaMedio:propina_medio,pagos"),
    admin.from("gastos").select("*").eq("sede_id", sedeId).gte("creado_en", ses.abierta_en),
  ]);
  const vs = vsRaw as { medio: string; total: number; propina: number | null; propinaMedio: string | null }[];
  // Gastos + adelantos en efectivo: todo lo que salió del cajón desde la apertura.
  const totalGastos =
    sumaGastosEfectivo((gastosRes.data ?? []) as { monto: number; medio?: string | null }[]) +
    (await adelantosEfectivoSede(admin, sedeId, ses.abierta_en));
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

  const [barbsRes, vsRaw, gastosRes] = await Promise.all([
    admin
      .from("barberos")
      .select("id,nombre,foto_url,orden")
      .eq("sede_id", sedeId)
      .eq("activo", true)
      .order("orden"),
    // Ventas de la SESIÓN (por caja_sesion_id, 0052), con su id para atribuir la comisión.
    ventasDeSesion(admin, sedeId, ses.id, ses.abierta_en, "id,barbero_id,medio,total,propina,propinaMedio:propina_medio"),
    admin.from("gastos").select("monto").eq("sede_id", sedeId).gte("creado_en", ses.abierta_en),
  ]);

  const barbs = (barbsRes.data ?? []) as {
    id: string;
    nombre: string;
    foto_url: string | null;
    orden: number | null;
  }[];
  const vs = vsRaw as {
    id: string;
    barbero_id: string | null;
    medio: string;
    total: number;
    propina: number | null;
    propinaMedio: string | null;
  }[];
  const totalGastos = ((gastosRes.data ?? []) as { monto: number }[]).reduce((a, g) => a + g.monto, 0);
  // Comisión por barbero: se calcula sobre los venta_items (los servicios llevan el
  // comision_pct del barbero, los productos el suyo). Antes se traía con un join
  // embebido venta_items→ventas filtrado por ventana; ahora se piden por los ids de
  // las ventas de la sesión (mismo criterio caja_sesion_id que el resto) y se atribuye
  // con el mapa venta→barbero de arriba.
  const barberoDeVenta = new Map<string, string | null>();
  for (const v of vs) barberoDeVenta.set(v.id, v.barbero_id);
  const ventaIds = vs.map((v) => v.id);
  const { data: itemsData } = ventaIds.length
    ? await admin.from("venta_items").select("venta_id,cantidad,precio_unitario,comision_pct").in("venta_id", ventaIds)
    : { data: [] as Record<string, unknown>[] };
  const items = (itemsData ?? []) as {
    venta_id: string;
    cantidad: number;
    precio_unitario: number;
    comision_pct: number | null;
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
    const bid = barberoDeVenta.get(it.venta_id);
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
  /** Sedes donde se le ha atendido o tiene cita. Vacío = ficha sin movimiento. */
  sedes: string[];
};

// La lista sale ordenada por ÚLTIMA VISITA (lo más reciente arriba): alfabético
// entierra a los pocos clientes que dejan plata entre filas de "0 visitas · $0",
// y ver quién estuvo esta semana es la razón por la que el dueño abre el CRM.
// El buscador y los filtros viven en el cliente (ClientesLista) para que filtren
// mientras se escribe.
export async function getClientes(): Promise<ClienteRow[]> {
  const sb = await supabaseServerAuth();
  const [clientesRes, ventasRes, reservasRes] = await Promise.all([
    sb.from("clientes").select("id,nombre,telefono,email,creado_en").order("nombre"),
    sb.from("ventas").select("cliente_ref,total,creado_en,sede_id"),
    // Las CITAS también dicen de qué sede es alguien: el que reservó en Plaza y
    // todavía no ha venido no tiene venta, y filtrando por sede desaparecería
    // justo del listado donde el dueño lo iba a buscar.
    sb.from("reservas").select("cliente_ref,sede_id").not("cliente_ref", "is", null),
  ]);
  const agg = new Map<string, { visitas: number; facturado: number; ultima: string | null }>();
  // Un cliente puede moverse entre sedes: se guardan TODAS, no "la última".
  const sedesDe = new Map<string, Set<string>>();
  const marcarSede = (ref: string | null, sede: string | null) => {
    if (!ref || !sede) return;
    const s = sedesDe.get(ref) ?? new Set<string>();
    s.add(sede);
    sedesDe.set(ref, s);
  };
  for (const v of (ventasRes.data ?? []) as {
    cliente_ref: string | null;
    total: number;
    creado_en: string;
    sede_id: string | null;
  }[]) {
    if (!v.cliente_ref) continue;
    marcarSede(v.cliente_ref, v.sede_id);
    const a = agg.get(v.cliente_ref) ?? { visitas: 0, facturado: 0, ultima: null };
    a.visitas += 1;
    a.facturado += v.total;
    if (!a.ultima || v.creado_en > a.ultima) a.ultima = v.creado_en;
    agg.set(v.cliente_ref, a);
  }
  for (const r of (reservasRes.data ?? []) as { cliente_ref: string | null; sede_id: string | null }[]) {
    marcarSede(r.cliente_ref, r.sede_id);
  }
  return ((clientesRes.data ?? []) as Record<string, unknown>[])
    .map((c) => {
      const a = agg.get(c.id as string) ?? { visitas: 0, facturado: 0, ultima: null };
      return {
        id: c.id as string,
        nombre: (c.nombre as string) ?? "Cliente",
        telefono: (c.telefono as string) ?? "",
        email: (c.email as string) ?? "",
        visitas: a.visitas,
        facturado: a.facturado,
        ultima: a.ultima,
        sedes: [...(sedesDe.get(c.id as string) ?? [])],
      };
    })
    // Los que nunca compraron van al final, entre ellos por nombre (el .order de arriba).
    .sort((a, b) => (b.ultima ?? "").localeCompare(a.ultima ?? ""));
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
  fotoUrl: string | null;
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
    .select("id,nombre,sede_id,orden,foto_url")
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
    fotoUrl: (b.foto_url as string) ?? null,
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
  const { data, error } = await q;
  if (error) console.error("citasSiguientes:", error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    inicio: r.inicio as string,
    cliente: (r.clientes as { nombre?: string } | null)?.nombre ?? "Walk-in",
    servicio: (r.servicios as { nombre?: string } | null)?.nombre ?? "—",
    barbero: (r.barberos as { nombre?: string } | null)?.nombre ?? "—",
    sede: r.sede_id as SedeId,
  }));
}

// Citas de hoy que ya pasaron su hora y siguen sin registrar (nadie las inició
// ni las cerró). Antes se caían del panel — citasSiguientes solo mira de ahora en
// adelante — y el dueño veía la tarde vacía sin saber si el cliente no llegó o si
// al barbero se le olvidó cerrarla.
export async function citasVencidasHoy(sede?: SedeId | null, limit = 6): Promise<CitaSiguiente[]> {
  const sb = await supabaseServerAuth();
  const { desde } = bogotaDayRange();
  let q = sb
    .from("reservas")
    .select("id,inicio,sede_id,servicios(nombre),barberos(nombre),clientes(nombre)")
    .in("estado", ["pendiente", "confirmada"])
    .gte("inicio", desde.toISOString())
    .lt("inicio", new Date().toISOString())
    // Descendente + limit deja las más cercanas a ahora; se reordena abajo.
    .order("inicio", { ascending: false })
    .limit(limit);
  if (sede) q = q.eq("sede_id", sede);
  const { data, error } = await q;
  if (error) console.error("citasVencidasHoy:", error.message);
  return ((data ?? []) as Record<string, unknown>[])
    .map((r) => ({
      id: r.id as string,
      inicio: r.inicio as string,
      cliente: (r.clientes as { nombre?: string } | null)?.nombre ?? "Walk-in",
      servicio: (r.servicios as { nombre?: string } | null)?.nombre ?? "—",
      barbero: (r.barberos as { nombre?: string } | null)?.nombre ?? "—",
      sede: r.sede_id as SedeId,
    }))
    .reverse();
}

export type AtendidaSinCobrar = {
  id: string;
  inicio: string;
  cliente: string;
  servicio: string;
  barbero: string;
  sede: SedeId;
  /** Precio de lista del servicio en esa sede; null si la reserva no tiene servicio. */
  precio: number | null;
};

// Plata que se va sin rastro: citas de HOY marcadas 'completada' que nunca
// pasaron por caja. Como no hay venta, no salen en ningún listado del panel: la
// atención desaparece y nadie la reclama. Es el error típico de cerrar con prisa.
export async function atendidasSinCobrar(sede?: SedeId | null): Promise<AtendidaSinCobrar[]> {
  const sb = await supabaseServerAuth();
  const { desde, hasta } = bogotaDayRange();
  let q = sb
    .from("reservas")
    .select("id,inicio,sede_id,servicio_id,servicios(nombre),barberos(nombre),clientes(nombre)")
    .eq("estado", "completada")
    .gte("inicio", desde.toISOString())
    .lt("inicio", hasta.toISOString())
    .order("inicio");
  if (sede) q = q.eq("sede_id", sede);
  const { data, error } = await q;
  if (error) console.error("atendidasSinCobrar:", error.message);
  const reservas = (data ?? []) as Record<string, unknown>[];
  if (reservas.length === 0) return [];

  // El cruce va por reserva_id y no por fecha de la venta: una cita de hoy que se
  // cobre mañana igual está cobrada, no hay que gritarla.
  const { data: ventasData } = await sb
    .from("ventas")
    .select("reserva_id")
    .in("reserva_id", reservas.map((r) => r.id as string));
  const cobradas = new Set(
    ((ventasData ?? []) as { reserva_id: string | null }[]).map((v) => v.reserva_id).filter(Boolean),
  );

  const sinCobrar = reservas.filter((r) => !cobradas.has(r.id as string));
  if (sinCobrar.length === 0) return [];

  const servicioIds = [
    ...new Set(sinCobrar.map((r) => r.servicio_id as string | null).filter((s): s is string => !!s)),
  ];
  const { data: preciosData } = servicioIds.length
    ? await sb.from("servicio_sede").select("servicio_id,sede_id,precio").in("servicio_id", servicioIds)
    : { data: [] };
  const precios = new Map(
    ((preciosData ?? []) as { servicio_id: string; sede_id: string; precio: number }[]).map((p) => [
      `${p.servicio_id}|${p.sede_id}`,
      p.precio,
    ]),
  );

  return sinCobrar.map((r) => ({
    id: r.id as string,
    inicio: r.inicio as string,
    cliente: (r.clientes as { nombre?: string } | null)?.nombre ?? "Walk-in",
    servicio: (r.servicios as { nombre?: string } | null)?.nombre ?? "Sin servicio",
    barbero: (r.barberos as { nombre?: string } | null)?.nombre ?? "Sin barbero",
    sede: r.sede_id as SedeId,
    precio: precios.get(`${r.servicio_id as string}|${r.sede_id as string}`) ?? null,
  }));
}

export type ParaHacer = {
  bajoMinimo: { id: string; nombre: string; stock: number; sede: SedeId }[];
  /** clienteRef null = reseña de un walk-in sin ficha (no hay a dónde linkear). */
  malasResenas: { id: string; score: number; comentario: string; barbero: string; sede: SedeId; fecha: string; clienteRef: string | null }[];
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
    .select("id,score,comentario,creado_en,sede_id,cliente_ref,barberos(nombre)")
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
      clienteRef: (r.cliente_ref as string) ?? null,
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
  const { data, error } = await q;
  if (error) console.error("serie7Dias:", error.message);
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

export type StaffContext = {
  rol: string;
  barberoId: string | null;
  /** Sede del perfil por sede (rol `sede`, 0044). null en admin y en barbero. */
  sedeId: string | null;
  nombre: string;
  fotoUrl: string | null;
};

// Rol + barbero del usuario logueado (para decidir qué agenda mostrar).
// Sin perfil → no filtra (las tablas igual están protegidas por RLS is_staff()).
export async function getStaffContext(): Promise<StaffContext> {
  const sb = await supabaseServerAuth();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { rol: "anon", barberoId: null, sedeId: null, nombre: "", fotoUrl: null };
  const { data } = await sb
    .from("profiles")
    .select("rol,barbero_id,sede_id,nombre")
    .eq("auth_id", user.id)
    .maybeSingle();
  // Fail-closed: sin perfil → rol sin privilegios (no asumir admin).
  if (!data) return { rol: "none", barberoId: null, sedeId: null, nombre: "", fotoUrl: null };
  const row = data as { rol: string; barbero_id: string | null; sede_id: string | null; nombre: string };
  // Foto del barbero (para el header de la app): la ficha vive en barberos.
  let fotoUrl: string | null = null;
  if (row.barbero_id) {
    const { data: b } = await sb.from("barberos").select("foto_url").eq("id", row.barbero_id).maybeSingle();
    fotoUrl = ((b as { foto_url?: string } | null)?.foto_url as string) ?? null;
  }
  return {
    rol: row.rol,
    barberoId: row.barbero_id ?? null,
    sedeId: row.sede_id ?? null,
    nombre: row.nombre ?? "",
    fotoUrl,
  };
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
    // de aplicar la migración), reintenta sin ella — todo combo cuenta, como antes.
    const fb = await sb.from("servicios").select("id").in("categoria", ["cortes", "combos"]);
    rows = ((fb.data ?? []) as { id: string }[]).map((s) => ({ id: s.id, cuenta_corte: null }));
  } else {
    rows = (res.data ?? []) as { id: string; cuenta_corte: boolean | null }[];
  }
  // Antes también se filtraba con un Set de ids escrito a mano (los cerquillos).
  // Eso ahora es dato: 0064 los marca cuenta_corte=false y el dueño puede cambiar
  // cualquier servicio desde el catálogo.
  return rows.filter((s) => s.cuenta_corte !== false).map((s) => s.id);
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

/**
 * Config de la tarjeta (0064). Singleton id=1. Si la fila no existe todavía —o
 * quedó con una forma rara— se cae al comportamiento de siempre en vez de dejar
 * al cobro sin regla: una tarjeta que no premia nada se nota tarde y con el
 * cliente adelante.
 */
export async function getConfigTarjeta(): Promise<ConfigTarjeta> {
  const { data, error } = await supabaseAdmin()
    .from("ajustes_tarjeta")
    .select("tamano,hitos")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    // Tabla todavía sin crear (deploy antes de la migración): no es motivo para
    // romper el cobro ni el portal.
    console.error("getConfigTarjeta:", error.message);
    return TARJETA_DEFECTO;
  }
  return sanearConfigTarjeta(data) ?? TARJETA_DEFECTO;
}

// Estado de la tarjeta para el admin (solo lectura). Corre bajo la sesión del admin
// (RLS le da todas las ventas del cliente); la página que lo llama es admin-only.
export async function getTarjetaCliente(clienteRef: string) {
  const sb = await supabaseServerAuth();
  const [cortesTotales, cfg] = await Promise.all([contarCortesCliente(sb, clienteRef), getConfigTarjeta()]);
  const est = estadoTarjeta(cortesTotales, cfg);
  return {
    cortesTotales,
    sellos: est.sellos,
    tarjetasCompletas: Math.floor(cortesTotales / cfg.tamano),
    proximo: est.proximo,
    tamano: cfg.tamano,
  };
}

// ---------- Portal del cliente ----------
export type CuentaData = {
  proximas: { id: string; inicio: string; estado: string; servicio: string; barbero: string; sede: string; nota: string | null; barberoId: string | null; servicioId: string | null; duracionMin: number }[];
  pasadas: { id: string; inicio: string; estado: string; servicio: string; barbero: string }[];
  puntosBalance: number;
  puntos: { tipo: string; puntos: number; nota: string; fecha: string }[];
  tarjeta: {
    cortes: number;
    sellos: number;
    /** null solo si la config se quedó sin premios. */
    proximo: { tipo: BeneficioTarjeta; faltan: number; posicion: number } | null;
    cfg: ConfigTarjeta;
  };
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
    // FK desambiguada: lista_espera tiene DOS FKs a barberos (barbero_id y
    // cupo_barbero_id, 0033). Sin el !fkey, PostgREST responde 300/PGRST201 y esta
    // consulta falla -> la cola del cliente salia SIEMPRE vacia (verificado contra
    // la DB). getListaEspera ya usaba el mismo desambiguado.
    sb.from("lista_espera").select("id,estado,creado_en,servicios(nombre),barberos!lista_espera_barbero_id_fkey(nombre,foto_url)").in("estado", ["esperando", "notificado"]),
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
  const cfgTarjeta = await getConfigTarjeta();
  const est = estadoTarjeta(cortesTotales, cfgTarjeta);
  // `cfg` viaja al portal para que la tarjeta DIBUJADA tenga los mismos sellos y
  // premios que aplica el cobro.
  const tarjeta = { cortes: cortesTotales, sellos: est.sellos, proximo: est.proximo, cfg: cfgTarjeta };
  return { proximas, pasadas, puntosBalance, puntos, tarjeta, cola };
}

// ---------- Ajustes de avisos automáticos (/admin/avisos) ----------
export type AjustesAvisos = {
  previoHoras: number;
  previoActivo: boolean;
  /** "Te toca corte" (0068): cada cuántos días sin venir se avisa, y si está prendido. */
  corteCadaDias: number;
  corteActivo: boolean;
};

/** Config de los avisos. Singleton (fila id=1, migraciones 0038 y 0068). */
export async function getAjustesAvisos(): Promise<AjustesAvisos> {
  const sb = await supabaseServerAuth();
  // select("*") a propósito: tolera que las columnas de 0068 aún no existan.
  const { data } = await sb.from("ajustes_avisos").select("*").eq("id", 1).maybeSingle();
  const row = data as {
    previo_horas?: number | string;
    previo_activo?: boolean;
    corte_cada_dias?: number;
    corte_activo?: boolean;
  } | null;
  // Defaults iguales a los de la tabla: la pantalla nunca queda en blanco aunque
  // la fila no esté (p. ej. si alguien la borra a mano).
  return {
    previoHoras: Number(row?.previo_horas ?? 2),
    previoActivo: row?.previo_activo ?? true,
    corteCadaDias: Number(row?.corte_cada_dias ?? 21),
    corteActivo: row?.corte_activo ?? false,
  };
}

export type ResumenTocaCorte = { elegiblesHoy: number; enviados30d: number };

// "Hoy le tocaría a N" + "salieron M en 30 días": el dueño ve el efecto de la
// cadencia ANTES de prender el aviso. La vista es de service_role (expone
// correos), por eso va tras confirmar que quien pide es admin (patrón 0049).
export async function getResumenTocaCorte(): Promise<ResumenTocaCorte> {
  const auth = await supabaseServerAuth();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return { elegiblesHoy: 0, enviados30d: 0 };
  const { data: prof } = await auth.from("profiles").select("rol").eq("auth_id", user.id).maybeSingle();
  if ((prof as { rol?: string } | null)?.rol !== "admin") return { elegiblesHoy: 0, enviados30d: 0 };
  const admin = supabaseAdmin();
  const hace30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [eleg, env] = await Promise.all([
    admin.from("v_toca_corte_elegibles").select("cliente_ref", { count: "exact", head: true }),
    admin
      .from("avisos_marketing")
      .select("id", { count: "exact", head: true })
      .eq("tipo", "toca_corte")
      .gte("enviado_en", hace30),
  ]);
  // Antes de aplicar 0068 ambas fallan: 0 y la pantalla vive igual.
  return { elegiblesHoy: eleg.count ?? 0, enviados30d: env.count ?? 0 };
}

// ---------- Métricas por período (/admin/metricas) ----------
export type { Periodo };
export type Metricas = {
  plata: number;
  /** Cantidad de COBROS (no de servicios sueltos: un cobro puede llevar varios). */
  servicios: number;
  ticket: number;
  propinas: number;
  /** Mismo largo de período, inmediatamente anterior. Un número solo no dice si vas bien. */
  antes: { plata: number; servicios: number };
  porBarbero: { nombre: string; fotoUrl: string | null; plata: number; cortes: number }[];
  porServicio: { nombre: string; veces: number; plata: number }[];
  porProducto: { nombre: string; veces: number; plata: number }[];
  serie: { ymd: string; total: number }[];
  clientes: { total: number; repiten: number };
  dias: number;
};

export async function getMetricas(p: Periodo = "mes", sede?: SedeId | null): Promise<Metricas> {
  const sb = await supabaseServerAuth();
  const { desde, hasta, prevDesde, prevHasta } = rangoPeriodo(p);

  // Una sola pasada por ventas: trae el período y el anterior juntos y se parten
  // en memoria. Son cientos de filas al mes, no miles: agregar en SQL sería un RPC
  // más que mantener. ponytail: mover a SQL si esto pasa de ~10k ventas por período.
  let q = sb
    .from("ventas")
    .select("id,total,propina,creado_en,barbero_id,cliente_ref,barberos(nombre,foto_url)")
    .gte("creado_en", prevDesde.toISOString())
    .lt("creado_en", hasta.toISOString());
  if (sede) q = q.eq("sede_id", sede);
  const { data, error } = await q;
  if (error) console.error("getMetricas:", error.message);
  const filas = (data ?? []) as Record<string, unknown>[];
  const enPeriodo = filas.filter((v) => new Date(v.creado_en as string) >= desde);
  // El comparativo es SOLO [prevDesde, prevHasta): en "mes" eso son los mismos días
  // del mes pasado, no toda la cola. Las ventas del hueco entre prevHasta y desde
  // (la parte final del mes anterior) se traen en la misma query pero no cuentan.
  const previas = filas.filter((v) => {
    const t = new Date(v.creado_en as string);
    return t >= prevDesde && t < prevHasta;
  });

  const plata = enPeriodo.reduce((a, v) => a + ((v.total as number) ?? 0), 0);
  const propinas = enPeriodo.reduce((a, v) => a + ((v.propina as number) ?? 0), 0);

  // Ítems solo del período (para el ranking de servicios y contar cortes por barbero).
  const ids = enPeriodo.map((v) => v.id as string);
  const { data: itemsRaw } = ids.length
    ? await sb.from("venta_items").select("venta_id,tipo,ref_id,descripcion,cantidad,precio_unitario").in("venta_id", ids)
    : { data: [] };
  const items = (itemsRaw ?? []) as Record<string, unknown>[];

  // Con la foto: el ranking de "quién produce" se lee por la cara, no leyendo
  // seis nombres parecidos.
  const porBarbero = new Map<
    string,
    { nombre: string; fotoUrl: string | null; plata: number; cortes: number }
  >();
  for (const v of enPeriodo) {
    const b = v.barberos as { nombre?: string; foto_url?: string | null } | null;
    const nombre = b?.nombre ?? "Sin barbero";
    const acc = porBarbero.get(nombre) ?? { nombre, fotoUrl: b?.foto_url ?? null, plata: 0, cortes: 0 };
    acc.plata += (v.total as number) ?? 0;
    acc.cortes += 1;
    porBarbero.set(nombre, acc);
  }

  type Linea = { nombre: string; veces: number; plata: number };
  const porServicio = new Map<string, Linea>();
  const porProducto = new Map<string, Linea>();
  for (const it of items) {
    const destino = it.tipo === "servicio" ? porServicio : it.tipo === "producto" ? porProducto : null;
    if (!destino) continue;
    const nombre = (it.descripcion as string) ?? "—";
    // Se agrupa por ref_id, NO por el texto: la venta guarda el nombre tal como
    // era el día del cobro, así que renombrar un servicio partía el ranking en
    // dos ("Corte clásico / degradado" y "Corte (clásico, degradado)" salían
    // como dos servicios distintos). El nombre visible es el más reciente.
    const clave = (it.ref_id as string) || nombre;
    const acc = destino.get(clave) ?? { nombre, veces: 0, plata: 0 };
    acc.nombre = nombre;
    const cant = (it.cantidad as number) ?? 1;
    acc.veces += cant;
    acc.plata += cant * (((it.precio_unitario as number) ?? 0));
    destino.set(clave, acc);
  }

  // Un balde por CADA día civil de Bogotá en [desde, hasta], inclusive. Antes se
  // usaba Math.round(span/día) y se caminaba hacia atrás desde `hasta`: como el período
  // casi nunca mide un nº entero de días (hasta = ahora), redondeaba hacia abajo y el
  // día más temprano (p.ej. el 1° del mes) no quedaba como balde, así que sus ventas se
  // caían del gráfico aunque el KPI "Entró" sí las contaba (chart ≠ total, y encima
  // dependía de la hora). Ahora se recorre día civil por día civil (Colombia no tiene
  // DST, así que +24h siempre cae en la misma hora local y avanza un día civil).
  const serie = new Map<string, number>();
  const finYmd = bogotaYmd(hasta);
  const cursor = new Date(desde.getTime());
  for (let guard = 0; guard < 400; guard++) {
    const ymd = bogotaYmd(cursor);
    serie.set(ymd, 0);
    if (ymd >= finYmd) break;
    cursor.setTime(cursor.getTime() + 86_400_000);
  }
  for (const v of enPeriodo) {
    const d = bogotaYmd(new Date(v.creado_en as string));
    if (serie.has(d)) serie.set(d, (serie.get(d) ?? 0) + ((v.total as number) ?? 0));
  }
  const dias = serie.size;

  // "Repiten" = clientes del período que ya habían venido ANTES del período.
  // Es la métrica que importa en una barbería: si nadie vuelve, no hay negocio.
  const refs = [...new Set(enPeriodo.map((v) => v.cliente_ref).filter(Boolean))] as string[];
  let repiten = 0;
  if (refs.length) {
    const { data: viejas } = await sb
      .from("ventas")
      .select("cliente_ref")
      .in("cliente_ref", refs)
      .lt("creado_en", desde.toISOString());
    repiten = new Set(((viejas ?? []) as { cliente_ref: string }[]).map((r) => r.cliente_ref)).size;
  }

  return {
    plata,
    servicios: enPeriodo.length,
    ticket: enPeriodo.length ? Math.round(plata / enPeriodo.length) : 0,
    propinas,
    antes: {
      plata: previas.reduce((a, v) => a + ((v.total as number) ?? 0), 0),
      servicios: previas.length,
    },
    porBarbero: [...porBarbero.values()].sort((a, b) => b.plata - a.plata),
    porServicio: [...porServicio.values()].sort((a, b) => b.veces - a.veces),
    // Los productos se ordenan por PLATA, no por unidades: importa cuánto deja el
    // mostrador, y una cera de $32k no compite en unidades con las gaseosas.
    porProducto: [...porProducto.values()].sort((a, b) => b.plata - a.plata),
    serie: [...serie.entries()].map(([ymd, total]) => ({ ymd, total })),
    clientes: { total: refs.length, repiten },
    dias,
  };
}

/** Ventas del período en crudo, una fila por cobro. Alimenta el CSV de /admin/metricas. */
export async function getVentasParaCsv(
  p: Periodo = "mes",
  sede?: SedeId | null,
  // Rango a la medida (export de X a Y): cuando viene, manda sobre el período.
  rango?: { desde: Date; hasta: Date },
) {
  const sb = await supabaseServerAuth();
  const { desde, hasta } = rango ?? rangoPeriodo(p);
  let q = sb
    .from("ventas")
    .select(
      "creado_en,sede_id,medio,pagos,total,propina,descuento,cupon_codigo,cliente_nombre,barberos(nombre),clientes(nombre),venta_items(tipo,descripcion,cantidad,precio_unitario)",
    )
    .gte("creado_en", desde.toISOString())
    .lt("creado_en", hasta.toISOString())
    .order("creado_en");
  if (sede) q = q.eq("sede_id", sede);
  const { data, error } = await q;
  if (error) console.error("getVentasParaCsv:", error.message);
  return (data ?? []) as Record<string, unknown>[];
}

export type PulsoDia = {
  /** Plata y cobros de HOY por barbero (solo aparecen los que cobraron algo). */
  porBarbero: Record<string, { plata: number; cobros: number }>;
  /**
   * Qué tan llena está la jornada: minutos ya agendados sobre los minutos que
   * el equipo tiene disponibles hoy. El denominador respeta el horario REAL de
   * cada sede (0048) — con horario editable, dar por hecho 9-20 mentiría los
   * días de cierre temprano o feriado.
   */
  ocupacion: { agendado: number; disponible: number; ratio: number };
  /** Citas de hoy que siguen en pie (canceladas fuera). */
  citasHoy: number;
};

/**
 * El pulso del día para el tablero: plata por barbero y ocupación de la jornada.
 * Reutiliza las lecturas de horario que ya existen en vez de re-derivar la
 * ventana del día (regla del repo: la fuente única es horarioEfectivo).
 */
export async function pulsoDelDia(sede?: SedeId | null): Promise<PulsoDia> {
  const sb = await supabaseServerAuth();
  const { desde, hasta } = bogotaDayRange();
  const hoy = bogotaYmd();

  let qVentas = sb
    .from("ventas")
    .select("barbero_id,total")
    .gte("creado_en", desde.toISOString())
    .lt("creado_en", hasta.toISOString());
  if (sede) qVentas = qVentas.eq("sede_id", sede);

  let qReservas = sb
    .from("reservas")
    .select("inicio,fin,estado,sede_id")
    .gte("inicio", desde.toISOString())
    .lt("inicio", hasta.toISOString());
  if (sede) qReservas = qReservas.eq("sede_id", sede);

  const [ventasRes, reservasRes, barberos, semanal, especiales] = await Promise.all([
    qVentas,
    qReservas,
    getBarberos(),
    getHorarioSemanal(),
    getDiasEspeciales(),
  ]);
  if (ventasRes.error) console.error("pulsoDelDia ventas:", ventasRes.error.message);
  if (reservasRes.error) console.error("pulsoDelDia reservas:", reservasRes.error.message);

  const porBarbero: PulsoDia["porBarbero"] = {};
  for (const v of (ventasRes.data ?? []) as { barbero_id: string | null; total: number }[]) {
    if (!v.barbero_id) continue; // venta de mostrador sin barbero: suma al total, no a nadie
    const acc = (porBarbero[v.barbero_id] ??= { plata: 0, cobros: 0 });
    acc.plata += v.total;
    acc.cobros += 1;
  }

  const vivas = ((reservasRes.data ?? []) as { inicio: string; fin: string; estado: string }[]).filter(
    (r) => r.estado !== "cancelada",
  );
  const agendado = vivas.reduce(
    (a, r) => a + Math.max(0, (Date.parse(r.fin) - Date.parse(r.inicio)) / 60_000),
    0,
  );

  // Denominador: por cada sede en juego, sus barberos activos × su ventana de hoy.
  const sedes = sede ? [sede] : [...new Set(barberos.map((b) => b.sede))];
  let disponible = 0;
  for (const s of sedes) {
    const v = horarioEfectivo(
      hoy,
      semanal.filter((h) => h.sede === s),
      especiales.filter((e) => e.sede === s),
    );
    if (!v.abierta) continue;
    disponible += barberos.filter((b) => b.sede === s).length * (v.cierraMin - v.abreMin);
  }

  return {
    porBarbero,
    ocupacion: { agendado, disponible, ratio: disponible > 0 ? agendado / disponible : 0 },
    citasHoy: vivas.length,
  };
}

export type TestimonioPublico = {
  id: string;
  score: number;
  comentario: string;
  barbero: string;
  sede: string;
  fecha: string;
};

/**
 * Reseñas REALES para la home. Existe porque los testimonios del sitio eran
 * inventados ("Carlos M.", "Andrés R.", "Julián P." con frases escritas a mano):
 * publicidad falsa en un sitio comercial, y encima con reseñas de verdad
 * durmiendo en la base.
 *
 * Sin nombre de cliente: `resenas_servicio` no lo guarda, así que se publica el
 * comentario, la nota, el barbero y la sede — nada que identifique a nadie.
 * Se muestran solo las de 4★ o más: elegir qué testimonios poner en la vitrina
 * propia es normal; lo que Google prohíbe es filtrar a QUIÉN se le pide reseña,
 * y eso el correo postventa no lo hace (va a todos por igual).
 *
 * supabaseAdmin porque la tabla no abre lectura a anónimos y esta página es
 * pública: la consulta acota a mano lo que sale (sin ids de cliente, sin correos).
 */
export async function getTestimoniosPublicos(limite = 3): Promise<TestimonioPublico[]> {
  const admin = supabaseAdmin();
  const desde = new Date(Date.now() - 365 * 24 * 3600_000).toISOString();
  const { data, error } = await admin
    .from("resenas_servicio")
    .select("id,score,comentario,creado_en,barberos(nombre),sedes(nombre)")
    .not("comentario", "is", null)
    .neq("comentario", "")
    .gte("score", 4)
    .gte("creado_en", desde)
    .order("creado_en", { ascending: false })
    .limit(limite);
  if (error) {
    console.error("getTestimoniosPublicos:", error.message);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    score: Number(r.score),
    comentario: String(r.comentario ?? "").trim(),
    barbero: (r.barberos as { nombre?: string } | null)?.nombre ?? "",
    sede: (r.sedes as { nombre?: string } | null)?.nombre ?? "",
    fecha: String(r.creado_en ?? ""),
  }));
}

// ---------- Liquidación semanal por barbero (0063) ----------
// Lo que el dueño pide para pagar: "el valor total facturado, el 50% del barbero,
// lo adelantado y las bebidas o mecatos consumidos por ellos pendientes a
// descontar". Antes había que sacarlo a mano de tres pantallas distintas.

export type LiquidacionBarbero = {
  barberoId: string;
  nombre: string;
  sedeId: string;
  tipoContrato: TipoContrato;
  /** Lo que entró por su trabajo en el período (neto, sin propina). */
  facturado: number;
  /** Su parte: comisión real por ítem, o 0 si paga arriendo. */
  comision: number;
  /** Arriendo mensual del contrato, si es de silla (informativo). */
  arriendo: number;
  propinas: number;
  cobros: number;
  adelantos: number;
  consumos: number;
  /** Ajustes a mano del dueño en el período, ya sumados con su signo (0075). */
  ajustes: number;
  /** Lo que queda por pagarle: su parte − adelantos − consumos + ajustes. */
  neto: number;
  /** Detalle de lo consumido, para que el descuento no sea un número a ciegas. */
  detalleConsumos: { producto: string; cantidad: number; total: number; fecha: string }[];
  /** Cada ajuste con su motivo. Sin el motivo, el barbero ve que le restaron
   *  $30.000 y no sabe por qué — que es justo lo que hay que evitar. */
  detalleAjustes: { id: string; monto: number; nota: string; fecha: string }[];
};

/**
 * Liquidación de un rango [desde, hasta) por barbero.
 *
 * La comisión NO se calcula con un 50% supuesto: sale de `venta_items.comision_pct`,
 * que se guarda POR ÍTEM al cobrar. Así un producto al 10% y un servicio al 50%
 * liquidan cada uno como corresponde, y una comisión que cambió el mes pasado no
 * reescribe lo ya cobrado.
 *
 * Las propinas se informan aparte y NO entran al neto: son del barbero desde el
 * momento en que se las dieron, no algo que el local le deba.
 */
export async function getLiquidacion(
  desde: Date,
  hasta: Date,
  sede?: SedeId | null,
): Promise<LiquidacionBarbero[]> {
  const admin = supabaseAdmin();
  const [barbRes, ventasRes, adelRes, consRes, ajuRes] = await Promise.all([
    admin
      .from("barberos")
      .select("id,nombre,sede_id,tipo_contrato,comision_pct,arriendo_mensual")
      .eq("activo", true)
      .order("sede_id")
      .order("nombre"),
    admin
      .from("ventas")
      .select("id,barbero_id,sede_id,total,propina,creado_en,venta_items(cantidad,precio_unitario,comision_pct)")
      .gte("creado_en", desde.toISOString())
      .lt("creado_en", hasta.toISOString()),
    admin
      .from("adelantos")
      .select("barbero_id,monto,creado_en")
      .gte("creado_en", desde.toISOString())
      .lt("creado_en", hasta.toISOString()),
    admin
      .from("consumos_barbero")
      .select("barbero_id,cantidad,precio_unitario,fecha,productos(nombre)")
      .gte("fecha", bogotaYmd(desde))
      .lte("fecha", bogotaYmd(new Date(hasta.getTime() - 1))),
    admin
      .from("ajustes_liquidacion")
      .select("id,barbero_id,monto,nota,fecha")
      .gte("fecha", bogotaYmd(desde))
      .lte("fecha", bogotaYmd(new Date(hasta.getTime() - 1))),
  ]);
  // La tabla de consumos puede no existir todavía (deploy antes de aplicar 0063):
  // eso no puede tumbar la pantalla, solo deja el descuento en cero.
  if (consRes.error) console.error("getLiquidacion consumos:", consRes.error.message);
  // Mismo criterio para los ajustes (0075): sin tabla, cero ajustes y la
  // liquidación sigue siendo la de siempre.
  if (ajuRes.error) console.error("getLiquidacion ajustes:", ajuRes.error.message);

  const barberos = ((barbRes.data ?? []) as Record<string, unknown>[]).filter(
    (b) => !sede || b.sede_id === sede,
  );

  const porBarbero = new Map<string, LiquidacionBarbero>();
  for (const b of barberos) {
    porBarbero.set(b.id as string, {
      barberoId: b.id as string,
      nombre: (b.nombre as string) ?? "",
      sedeId: b.sede_id as string,
      tipoContrato: ((b.tipo_contrato as TipoContrato) ?? "porcentaje") as TipoContrato,
      facturado: 0,
      comision: 0,
      arriendo: (b.arriendo_mensual as number) ?? 0,
      propinas: 0,
      cobros: 0,
      adelantos: 0,
      consumos: 0,
      ajustes: 0,
      neto: 0,
      detalleConsumos: [],
      detalleAjustes: [],
    });
  }

  for (const v of (ventasRes.data ?? []) as Record<string, unknown>[]) {
    const fila = porBarbero.get(v.barbero_id as string);
    if (!fila) continue; // venta sin barbero, o de la otra sede
    fila.facturado += (v.total as number) ?? 0;
    fila.propinas += (v.propina as number) ?? 0;
    fila.cobros += 1;
    // Arriendo de silla: no hay comisión que repartir, la plata es del barbero y
    // el local cobra el arriendo aparte.
    if (fila.tipoContrato === "arriendo") continue;
    fila.comision += comisionDeItems((v.venta_items ?? []) as ItemComision[]);
  }

  for (const a of (adelRes.data ?? []) as Record<string, unknown>[]) {
    const fila = porBarbero.get(a.barbero_id as string);
    if (fila) fila.adelantos += (a.monto as number) ?? 0;
  }

  for (const c of (consRes.data ?? []) as Record<string, unknown>[]) {
    const fila = porBarbero.get(c.barbero_id as string);
    if (!fila) continue;
    const total = ((c.precio_unitario as number) ?? 0) * ((c.cantidad as number) ?? 1);
    fila.consumos += total;
    fila.detalleConsumos.push({
      producto: (c.productos as { nombre?: string } | null)?.nombre ?? "Producto",
      cantidad: (c.cantidad as number) ?? 1,
      total,
      fecha: c.fecha as string,
    });
  }

  for (const a of (ajuRes.data ?? []) as Record<string, unknown>[]) {
    const fila = porBarbero.get(a.barbero_id as string);
    if (!fila) continue;
    const monto = (a.monto as number) ?? 0;
    fila.ajustes += monto;
    fila.detalleAjustes.push({
      id: a.id as string,
      monto,
      nota: (a.nota as string) ?? "",
      fecha: a.fecha as string,
    });
  }

  for (const fila of porBarbero.values()) fila.neto = netoLiquidacion(fila);
  // Primero el que más produjo: es el orden en que el dueño quiere leerlo.
  return [...porBarbero.values()].sort((a, b) => b.facturado - a.facturado);
}

// ---------- Lo que el barbero ve de su propia plata (0074) ----------

/**
 * ¿El dueño dejó que los barberos vean lo que llevan acumulado de la SEMANA?
 * Lo de HOY lo ven siempre y no se configura.
 *
 * Tolera que la tabla NO exista: el deploy puede llegar antes de que el dueño
 * corra la migración en el SQL Editor, y eso no puede tumbar el mostrador. Sin
 * tabla, apagado.
 */
export async function getAjustesEquipo(): Promise<{ barberoVeSemana: boolean }> {
  const sb = await supabaseServerAuth();
  const { data, error } = await sb.from("ajustes_equipo").select("barbero_ve_semana").eq("id", 1).maybeSingle();
  if (error) {
    console.error("getAjustesEquipo:", error.message);
    return { barberoVeSemana: false };
  }
  return { barberoVeSemana: !!(data as { barbero_ve_semana?: boolean } | null)?.barbero_ve_semana };
}

export type MiSemana = {
  desdeYmd: string;
  hastaYmd: string;
  /** Lo que produjo en la semana (lo que cobró, no lo que se lleva). */
  facturado: number;
  comision: number;
  propinas: number;
  adelantos: number;
  consumos: number;
  /** Ajustes a mano del dueño, con signo y con su motivo (0075). El neto ya los
   *  lleva: si no se le dice cuáles fueron, el número le cambia sin explicación. */
  ajustes: number;
  detalleAjustes: { id: string; monto: number; nota: string; fecha: string }[];
  /** Lo que le queda por cobrar el fin de semana. */
  neto: number;
  cobros: number;
};

/**
 * La semana EN CURSO de UN barbero, y de nadie más.
 *
 * Se apoya en getLiquidacion, que es la MISMA cuenta con la que el dueño paga:
 * si acá se calculara aparte, un día darían distinto y el barbero tendría razón
 * en desconfiar del número. Se le devuelve solo SU fila; el resto del equipo ni
 * sale de esta función.
 */
export async function getMiSemana(barberoId: string): Promise<MiSemana | null> {
  const hoy = bogotaYmd();
  const { desdeYmd, hastaYmd } = semanaDeFecha(hoy);
  const desde = bogotaDayRangeDeFecha(desdeYmd).desde;
  const hasta = bogotaDayRangeDeFecha(hastaYmd).hasta;
  const filas = await getLiquidacion(desde, hasta, null);
  const mia = filas.find((f) => f.barberoId === barberoId);
  if (!mia) return null;
  return {
    desdeYmd,
    hastaYmd,
    facturado: mia.facturado,
    comision: mia.comision,
    propinas: mia.propinas,
    adelantos: mia.adelantos,
    consumos: mia.consumos,
    ajustes: mia.ajustes,
    detalleAjustes: mia.detalleAjustes,
    neto: mia.neto,
    cobros: mia.cobros,
  };
}

// Google Calendar (0073): qué agenda tiene cada barbero y cómo va la cola. Solo
// admin → service role (las tablas son deny-all). Sin credencial en el servidor
// devuelve configurado=false y la pantalla lo dice.
export type CalendarEstado = {
  configurado: boolean;
  agendas: Record<string, { calendarId: string; compartidoCon: string | null }>;
  compartidos: { email: string; rol: string }[];
  sincronizadas: number;
  pendientes: number;
  errores: { reservaId: string; error: string }[];
};

export async function getCalendarEstado(): Promise<CalendarEstado> {
  const vacio: CalendarEstado = { configurado: false, agendas: {}, compartidos: [], sincronizadas: 0, pendientes: 0, errores: [] };
  const auth = await supabaseServerAuth();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return vacio;
  const { data: prof } = await auth.from("profiles").select("rol").eq("auth_id", user.id).maybeSingle();
  if ((prof as { rol?: string } | null)?.rol !== "admin") return vacio;
  const admin = supabaseAdmin();
  const [agendas, compartidos, sincronizadas, pendientes, errores] = await Promise.all([
    admin.from("barbero_calendar").select("barbero_id,calendar_id,compartido_con"),
    admin.from("calendar_compartidos").select("email,rol").order("creado_en"),
    admin.from("reserva_calendar").select("reserva_id", { count: "exact", head: true }),
    admin.from("calendar_cola").select("id", { count: "exact", head: true }).is("procesado_en", null),
    admin.from("calendar_cola").select("reserva_id,error").is("procesado_en", null).not("error", "is", null).order("id", { ascending: false }).limit(5),
  ]);
  return {
    configurado: calendarConfigurado(),
    agendas: Object.fromEntries(
      ((agendas.data ?? []) as { barbero_id: string; calendar_id: string; compartido_con: string | null }[]).map((a) => [
        a.barbero_id,
        { calendarId: a.calendar_id, compartidoCon: a.compartido_con },
      ]),
    ),
    compartidos: (compartidos.data ?? []) as { email: string; rol: string }[],
    sincronizadas: sincronizadas.count ?? 0,
    pendientes: pendientes.count ?? 0,
    errores: ((errores.data ?? []) as { reserva_id: string; error: string }[]).map((e) => ({ reservaId: e.reserva_id, error: e.error })),
  };
}

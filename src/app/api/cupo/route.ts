// GET /api/cupo — el próximo cupo online de cada barbero y de cada sede, para
// los chips de la home. Calculado en el servidor con las mismas reglas que el
// wizard (src/lib/cupo.ts) y cacheado 60 s: la home es ISR de 10 min, y un cupo
// de hace 10 minutos ya puede estar tomado.
//
// Solo expone ids de barbero y sede, fecha y minuto: nada de clientes ni de qué
// servicio está en curso. Lee con service role porque anónimo no tiene política
// de lectura sobre reservas (y no debe tenerla).
import { supabaseAdmin } from "@/lib/supabase/server";
import { bogotaYmd, finEfectivo, type HorarioDia, type ExcepcionDia } from "@/lib/slots";
import { proximoCupo, sumarDias, DIAS_CUPO, type Cupo, type Ocupado, type RespuestaCupo } from "@/lib/cupo";

export const revalidate = 60;

type CupoBarbero = RespuestaCupo["barberos"][number];

export async function GET() {
  const sb = supabaseAdmin();
  const hoy = bogotaYmd();
  const ahoraMs = Date.now();
  const hasta = sumarDias(hoy, DIAS_CUPO);
  const [barR, semR, espR, resR, ausR, corteR] = await Promise.all([
    sb.from("barberos").select("id,sede_id").eq("activo", true),
    sb.from("sede_horario_semanal").select("sede_id,dow,abierta,abre_min,cierra_min"),
    sb.from("sede_dias_especiales").select("sede_id,fecha,abierta,abre_min,cierra_min").gte("fecha", hoy).lte("fecha", hasta),
    sb
      .from("reservas")
      .select("barbero_id,inicio,fin,estado")
      .not("estado", "in", "(cancelada,no_show)")
      .gte("inicio", `${hoy}T00:00:00-05:00`)
      .lt("inicio", `${hasta}T00:00:00-05:00`),
    sb.from("barbero_ausencias").select("barbero_id,fecha,desde_min,hasta_min").gte("fecha", hoy).lte("fecha", hasta),
    sb.from("servicios").select("duracion_min").eq("id", "corte").maybeSingle(),
  ]);
  const error = barR.error ?? semR.error ?? espR.error ?? resR.error ?? ausR.error;
  if (error) return Response.json({ error: "No se pudo calcular el cupo." }, { status: 503 });

  // El chip habla del corte: es lo que la gente reserva y lo que la landing anuncia.
  const duracionMin = (corteR.data as { duracion_min: number | null } | null)?.duracion_min ?? 30;

  type FilaSem = { sede_id: string; dow: number; abierta: boolean; abre_min: number; cierra_min: number };
  type FilaEsp = { sede_id: string; fecha: string; abierta: boolean; abre_min: number | null; cierra_min: number | null };
  type FilaRes = { barbero_id: string; inicio: string; fin: string; estado: string };
  type FilaAus = { barbero_id: string; fecha: string; desde_min: number | null; hasta_min: number | null };

  const semanalPorSede = new Map<string, HorarioDia[]>();
  for (const h of (semR.data ?? []) as FilaSem[]) {
    const lista = semanalPorSede.get(h.sede_id) ?? [];
    lista.push({ dow: h.dow, abierta: h.abierta, abreMin: h.abre_min, cierraMin: h.cierra_min });
    semanalPorSede.set(h.sede_id, lista);
  }
  const especialesPorSede = new Map<string, ExcepcionDia[]>();
  for (const e of (espR.data ?? []) as FilaEsp[]) {
    const lista = especialesPorSede.get(e.sede_id) ?? [];
    lista.push({ fecha: e.fecha, abierta: e.abierta, abreMin: e.abre_min, cierraMin: e.cierra_min });
    especialesPorSede.set(e.sede_id, lista);
  }
  // Ocupación por barbero y día civil de Bogotá.
  const reservasPor = new Map<string, Ocupado[]>();
  for (const r of (resR.data ?? []) as FilaRes[]) {
    const clave = `${r.barbero_id}|${bogotaYmd(new Date(r.inicio))}`;
    const lista = reservasPor.get(clave) ?? [];
    // Una cita en curso ocupa hasta que el barbero la cierra (finEfectivo).
    lista.push({ inicio: r.inicio, fin: finEfectivo(r.estado, r.fin, ahoraMs) });
    reservasPor.set(clave, lista);
  }
  const ausenciasPor = new Map<string, FilaAus[]>();
  for (const a of (ausR.data ?? []) as FilaAus[]) {
    const clave = `${a.barbero_id}|${a.fecha}`;
    const lista = ausenciasPor.get(clave) ?? [];
    lista.push(a);
    ausenciasPor.set(clave, lista);
  }

  const barberos: CupoBarbero[] = ((barR.data ?? []) as { id: string; sede_id: string }[]).map((b) => ({
    id: b.id,
    sede: b.sede_id,
    cupo: proximoCupo({
      hoy,
      ahoraMs,
      duracionMin,
      semanal: semanalPorSede.get(b.sede_id) ?? [],
      especiales: especialesPorSede.get(b.sede_id) ?? [],
      ocupadosDe: (ymd) => {
        const aus = ausenciasPor.get(`${b.id}|${ymd}`) ?? [];
        // Ausencia de día entero: ese día no cuenta.
        if (aus.some((a) => a.desde_min == null)) return null;
        const inicioDia = new Date(`${ymd}T00:00:00-05:00`).getTime();
        const bloqueos: Ocupado[] = aus.map((a) => ({
          inicio: new Date(inicioDia + (a.desde_min ?? 0) * 60_000).toISOString(),
          fin: new Date(inicioDia + (a.hasta_min ?? 1440) * 60_000).toISOString(),
        }));
        return [...bloqueos, ...(reservasPor.get(`${b.id}|${ymd}`) ?? [])];
      },
    }),
  }));

  const antes = (a: Cupo, b: Cupo) => a.fecha < b.fecha || (a.fecha === b.fecha && a.minuto < b.minuto);
  const sedes: RespuestaCupo["sedes"] = {};
  let mejor: RespuestaCupo["mejor"] = null;
  for (const b of barberos) {
    if (!b.cupo) {
      sedes[b.sede] ??= null;
      continue;
    }
    const actual = sedes[b.sede];
    if (!actual || antes(b.cupo, actual.cupo)) sedes[b.sede] = { cupo: b.cupo, barbero: b.id };
    if (!mejor || antes(b.cupo, mejor.cupo)) mejor = { sede: b.sede, barbero: b.id, cupo: b.cupo };
  }

  const salida: RespuestaCupo = { generado: new Date(ahoraMs).toISOString(), hoy, duracionMin, barberos, sedes, mejor };
  return Response.json(salida, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}

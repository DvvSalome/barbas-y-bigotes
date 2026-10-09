// GET /api/estado — qué está haciendo cada barbero AHORA y cuántos cortes lleva
// hoy, para el público (home y asistente de reserva). La regla vive en
// src/lib/estado-barbero.ts (probada en scripts/check-estado.ts).
//
// Sin caché: el navegador la vuelve a pedir cuando llega el aviso público de
// "cambió la agenda" (migración 0080), y un CDN con caché le devolvería justo lo
// de antes del cambio. Es una lectura chica (citas de hoy de 6 barberos).
//
// Solo expone ids, estado, minutos y conteos: nada de clientes ni servicios. Lee
// con service role porque el público no puede leer reservas (y no debe).
import { supabaseAdmin } from "@/lib/supabase/server";
import { bogotaYmd, horarioEfectivo, type HorarioDia, type ExcepcionDia } from "@/lib/slots";
import { estadoDeBarbero, minutoBogota, type RespuestaEstado, type ReservaHoy, type AusenciaHoy } from "@/lib/estado-barbero";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = supabaseAdmin();
  const hoy = bogotaYmd();
  const ahoraMs = Date.now();
  const [barR, semR, espR, resR, ausR, cobR] = await Promise.all([
    sb.from("barberos").select("id,sede_id").eq("activo", true),
    sb.from("sede_horario_semanal").select("sede_id,dow,abierta,abre_min,cierra_min"),
    sb.from("sede_dias_especiales").select("sede_id,fecha,abierta,abre_min,cierra_min").eq("fecha", hoy),
    sb
      .from("reservas")
      .select("barbero_id,inicio,fin,estado")
      .not("estado", "in", "(cancelada,no_show)")
      .gte("inicio", `${hoy}T00:00:00-05:00`)
      .lt("inicio", new Date(Date.parse(`${hoy}T00:00:00-05:00`) + 86_400_000).toISOString()),
    sb.from("barbero_ausencias").select("barbero_id,desde_min,hasta_min").eq("fecha", hoy),
    // Quién cubre hoy en la otra sede (0081). Sin la tabla, nadie.
    sb.from("barbero_cobertura").select("barbero_id,sede_id").eq("fecha", hoy),
  ]);
  const error = barR.error ?? semR.error ?? espR.error ?? resR.error ?? ausR.error;
  if (error) return Response.json({ error: "No se pudo leer el estado." }, { status: 503 });

  type FilaSem = { sede_id: string; dow: number; abierta: boolean; abre_min: number; cierra_min: number };
  type FilaEsp = { sede_id: string; fecha: string; abierta: boolean; abre_min: number | null; cierra_min: number | null };
  const semanal = (semR.data ?? []) as FilaSem[];
  const especiales = (espR.data ?? []) as FilaEsp[];
  const ventanaDe = (sede: string) =>
    horarioEfectivo(
      hoy,
      semanal.filter((h) => h.sede_id === sede).map<HorarioDia>((h) => ({ dow: h.dow, abierta: h.abierta, abreMin: h.abre_min, cierraMin: h.cierra_min })),
      especiales
        .filter((e) => e.sede_id === sede)
        .map<ExcepcionDia>((e) => ({ fecha: e.fecha, abierta: e.abierta, abreMin: e.abre_min, cierraMin: e.cierra_min })),
    );
  const reservas: ReservaHoy[] = ((resR.data ?? []) as { barbero_id: string; inicio: string; fin: string; estado: string }[]).map((r) => ({
    barberoId: r.barbero_id,
    inicio: r.inicio,
    fin: r.fin,
    estado: r.estado,
  }));
  const ausencias: AusenciaHoy[] = ((ausR.data ?? []) as { barbero_id: string; desde_min: number | null; hasta_min: number | null }[]).map((a) => ({
    barberoId: a.barbero_id,
    desdeMin: a.desde_min,
    hastaMin: a.hasta_min,
  }));

  const cobertura = new Map(((cobR.data ?? []) as { barbero_id: string; sede_id: string }[]).map((c) => [c.barbero_id, c.sede_id]));

  const salida: RespuestaEstado = {
    generado: new Date(ahoraMs).toISOString(),
    hoy,
    ahoraMin: minutoBogota(ahoraMs),
    barberos: ((barR.data ?? []) as { id: string; sede_id: string }[]).map((b) =>
      estadoDeBarbero({
        id: b.id,
        sede: b.sede_id,
        ventana: ventanaDe(b.sede_id),
        reservas,
        ausencias,
        ahoraMs,
        cubreOtraSede: !!cobertura.get(b.id) && cobertura.get(b.id) !== b.sede_id,
      }),
    ),
  };
  return Response.json(salida, { headers: { "Cache-Control": "no-store" } });
}

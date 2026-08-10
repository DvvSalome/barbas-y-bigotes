// Resolución server-side del horario de una sede. Vive acá (módulo plano, sin
// "use server") porque actions.ts es "use server" y no puede EXPORTAR un helper
// que recibe un SupabaseClient — pero tanto las validaciones de reserva/adelanto
// (actions.ts) como las de reagendar (cliente-actions.ts) necesitan el MISMO
// criterio que ve el cliente, así que no puede vivir dentro de un solo action file.
import { type SupabaseClient } from "@supabase/supabase-js";
import { horarioEfectivo, type VentanaDia } from "@/lib/slots";

// Ventana de atención efectiva de una sede en una fecha (YYYY-MM-DD Bogotá),
// resuelta con horarioEfectivo (excepción del día → base de la semana → respaldo
// 9-20). Si las tablas todavía no existen (migración 0048 sin aplicar), cae al
// respaldo y nada se rompe.
export async function ventanaDeDia(sb: SupabaseClient, sede: string, fechaYmd: string): Promise<VentanaDia> {
  const [semR, excR] = await Promise.all([
    sb.from("sede_horario_semanal").select("dow,abierta,abre_min,cierra_min").eq("sede_id", sede),
    sb
      .from("sede_dias_especiales")
      .select("fecha,abierta,abre_min,cierra_min")
      .eq("sede_id", sede)
      .eq("fecha", fechaYmd),
  ]);
  const semanal = ((semR.data ?? []) as Record<string, unknown>[]).map((h) => ({
    dow: h.dow as number,
    abierta: h.abierta as boolean,
    abreMin: h.abre_min as number,
    cierraMin: h.cierra_min as number,
  }));
  const especiales = ((excR.data ?? []) as Record<string, unknown>[]).map((e) => ({
    fecha: e.fecha as string,
    abierta: e.abierta as boolean,
    abreMin: (e.abre_min as number) ?? null,
    cierraMin: (e.cierra_min as number) ?? null,
  }));
  return horarioEfectivo(fechaYmd, semanal, especiales);
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { bogotaYmd } from "@/lib/slots";

// Minuto del día EN Bogotá (UTC-5 fijo, sin DST) — no depende de la TZ del server.
const minutoBogota = (d: Date) => (d.getUTCHours() * 60 + d.getUTCMinutes() - 300 + 1440) % 1440;

// Guard compartido de barbero_ausencias (migración 0054): una fila sin horas es
// ausencia de DÍA COMPLETO; con desde_min/hasta_min es un bloqueo parcial
// (almuerzo, diligencia). Lo usan createReserva, agendarCita, moverCita,
// registrarWalkin y el reagendar del cliente — un solo lugar para la regla.
// Devuelve el mensaje de error si el rango [inicio, fin) choca, o null si pasa.
export async function choqueAusencia(
  client: SupabaseClient,
  barberoId: string,
  inicio: Date,
  fin: Date,
): Promise<string | null> {
  const { data } = await client
    .from("barbero_ausencias")
    .select("desde_min,hasta_min")
    .eq("barbero_id", barberoId)
    .eq("fecha", bogotaYmd(inicio));
  const filas = (data ?? []) as { desde_min: number | null; hasta_min: number | null }[];
  if (filas.some((f) => f.desde_min == null))
    return "Ese barbero no atiende ese día. Elegí otra fecha u otro barbero.";
  const ini = minutoBogota(inicio);
  const finMin = ini + Math.round((fin.getTime() - inicio.getTime()) / 60000);
  if (filas.some((f) => (f.desde_min ?? 0) < finMin && (f.hasta_min ?? 1440) > ini))
    return "El barbero tiene ese rato bloqueado. Elegí otra hora.";
  return null;
}

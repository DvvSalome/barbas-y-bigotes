// Cola de avisos para el DUEÑO (migración 0084). SOLO SERVIDOR: usa service role.
// Módulo plano a propósito (sin "use server"): si viviera en un archivo de server
// actions, encolarAvisoDueno quedaría como un endpoint POST público con el que
// cualquiera podría mandarle correos al dueño.
//
// La app deja acá lo que el dueño tiene que saber (cita nueva, calificación baja,
// caja abierta, prueba de correo); el cierre de caja lo encola un trigger en la
// base. n8n la vacía con tomar_avisos_dueno() y manda un correo por destinatario
// (el correo lo arma el nodo Code de docs/emails/aviso-dueno.js).
//
// Mismo contrato que el push: NUNCA lanza. Un aviso que no se pudo encolar no
// puede tumbar una reserva, una calificación ni un cierre.

import { supabaseAdmin } from "@/lib/supabase/server";
import { faltaTabla } from "@/lib/avisos-reglas";

export type TipoAvisoDueno = "cita" | "cierre" | "caja_abierta" | "resena_baja" | "prueba";

/** La tabla todavía no existe (deploy antes de aplicar 0084): se sigue sin ruido. */
export const faltaTablaAvisosDueno = faltaTabla;

/**
 * Deja un aviso en la cola. Devuelve true si quedó encolado.
 *
 * `datos` va tal cual al correo: nombres y fechas ISO ya resueltos, sin ids que
 * haya que volver a buscar. `soloEmail` es solo para 'prueba'. `clienteRef` va
 * siempre que `datos` hable de un cliente (nombre, teléfono, nota, comentario):
 * es con lo que eliminar_cuenta_cliente borra esas filas (0084).
 */
export async function encolarAvisoDueno(
  tipo: TipoAvisoDueno,
  datos: Record<string, unknown>,
  opts: { soloEmail?: string; clienteRef?: string | null } = {},
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin()
      .from("aviso_dueno_cola")
      .insert({ tipo, datos, solo_email: opts.soloEmail ?? null, cliente_ref: opts.clienteRef ?? null });
    if (!error) return true;
    if (!faltaTablaAvisosDueno(error)) console.error("[encolarAvisoDueno]", tipo, error.message);
    return false;
  } catch (e) {
    console.error("[encolarAvisoDueno]", tipo, e);
    return false;
  }
}

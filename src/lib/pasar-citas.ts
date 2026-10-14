// Pasar citas de un barbero a otro, a la MISMA hora.
//
// Vivía dentro de "Equipo de hoy" del mostrador (EquipoHoy.tsx). La baja de un
// barbero en /admin/equipo necesita exactamente lo mismo para sus citas futuras,
// así que salió a este módulo en vez de copiarse: el que decide si una cita cabe
// sigue siendo moverCita (ventana del día, ausencia y solape —el mismo choque que
// frena reservas_no_overlap—), y cada cita que no cabe se dice con su motivo sin
// frenar a las demás.
//
// El motivo se traduce al contexto (motivoAlPasar): moverCita dice "Elige otra
// hora" y acá no se elige hora, solo a quién va.
//
// Lo importan componentes de cliente: moverCita es una server action.

import { moverCita, type ActionResult } from "@/lib/actions";
import { horaBogota } from "@/lib/format";
import { motivoAlPasar } from "@/lib/equipo-reglas";

export type CitaParaPasar = { id: string; inicio: string; cliente?: string };

export type ResultadoPasar = {
  pasadas: number;
  /** Las que no se movieron, con su etiqueta y el motivo, dicho para quien pasa citas. */
  fallas: { id: string; texto: string }[];
};

export async function pasarCitas(
  citas: CitaParaPasar[],
  destinoId: string,
  etiqueta: (c: CitaParaPasar) => string = (c) => `${horaBogota(c.inicio)} (${c.cliente || "cliente"})`,
  /** Nombre del que las recibe, para decir "Juan ya tiene a alguien a esa hora". */
  nombreDestino = "",
): Promise<ResultadoPasar> {
  const fallas: ResultadoPasar["fallas"] = [];
  // Una por una y en orden: si dos citas del que se va chocaran entre sí en el
  // destino, la primera gana y la segunda se reporta (en paralelo, cuál gana
  // dependería de la red).
  for (const c of citas) {
    const res = await moverCita({ reservaId: c.id, inicioISO: c.inicio, barberoId: destinoId }).catch(
      () => ({ ok: false, error: "sin conexión" }) as ActionResult,
    );
    if (!res.ok) fallas.push({ id: c.id, texto: `${etiqueta(c)}: ${motivoAlPasar(res.error, nombreDestino)}` });
  }
  return { pasadas: citas.length - fallas.length, fallas };
}

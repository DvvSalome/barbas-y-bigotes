// Qué está haciendo cada barbero AHORA y qué lleva hecho hoy, para el público
// (pedido del dueño, 9-oct: "que si le dan clic a cualquier barbero, de verdad
// les aparezca en tiempo real qué ya está hecho y qué está haciendo").
//
// Módulo puro: lo usa la ruta /api/estado (servidor) y lo prueba
// scripts/check-estado.ts. Importa slots con extensión .ts para que node lo corra
// sin bundler (tsconfig tiene allowImportingTsExtensions).
//
// Antes la etiqueta "En silla" salía de "hay una reserva que cubre esta hora",
// sin mirar el estado: un cliente que no llegó, uno agendado que aún no se
// sentaba o un corte que ya se cobró, todos decían "En silla". Ahora "En silla"
// es solo una cita EN CURSO (el barbero la marcó como llegada o es un walk-in).
import { finEfectivo, type VentanaDia } from "./slots.ts";

export type EstadoVivo = "en_silla" | "con_cita" | "pausa" | "libre" | "cerrado" | "ausente";

export type EstadoBarbero = {
  id: string;
  sede: string;
  estado: EstadoVivo;
  /** Minuto del día (Bogotá) en que se desocupa: en silla, con cita o en pausa. */
  hastaMin: number | null;
  /** Cortes cobrados hoy (completados). */
  hechos: number;
  /** Citas de hoy que todavía no terminan (agendadas, sin empezar). */
  porAtender: number;
};

export type RespuestaEstado = {
  generado: string;
  hoy: string;
  /** Minuto del día en Bogotá cuando se calculó. */
  ahoraMin: number;
  barberos: EstadoBarbero[];
};

export type ReservaHoy = { barberoId: string; inicio: string; fin: string; estado: string };
export type AusenciaHoy = { barberoId: string; desdeMin: number | null; hastaMin: number | null };

/** Minuto del día en Bogotá (UTC-5 fijo) de un instante. */
export function minutoBogota(ms: number): number {
  const d = new Date(ms - 5 * 3600_000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function estadoDeBarbero(opts: {
  id: string;
  sede: string;
  ventana: VentanaDia;
  reservas: ReservaHoy[];
  ausencias: AusenciaHoy[];
  ahoraMs: number;
}): EstadoBarbero {
  const { id, sede, ventana, ahoraMs } = opts;
  const ahora = minutoBogota(ahoraMs);
  const mias = opts.reservas.filter((r) => r.barberoId === id);
  const hechos = mias.filter((r) => r.estado === "completada").length;
  const porAtender = mias.filter(
    (r) => (r.estado === "pendiente" || r.estado === "confirmada") && Date.parse(r.fin) > ahoraMs,
  ).length;
  const base = { id, sede, hechos, porAtender };

  const aus = opts.ausencias.filter((a) => a.barberoId === id);
  if (aus.some((a) => a.desdeMin == null)) return { ...base, estado: "ausente", hastaMin: null };

  // En silla: lo que el barbero marcó como empezado manda, aunque haya llegado
  // antes de la hora o se esté pasando (la silla está ocupada de verdad).
  const enCurso = mias.find((r) => r.estado === "en_curso");
  if (enCurso) {
    const fin = minutoBogota(Date.parse(finEfectivo(enCurso.estado, enCurso.fin, ahoraMs)));
    return { ...base, estado: "en_silla", hastaMin: fin > ahora ? fin : null };
  }

  if (!ventana.abierta || ahora < ventana.abreMin || ahora >= ventana.cierraMin) {
    return { ...base, estado: "cerrado", hastaMin: null };
  }

  const pausa = aus.find((a) => (a.desdeMin ?? 0) <= ahora && ahora < (a.hastaMin ?? 1440));
  if (pausa) return { ...base, estado: "pausa", hastaMin: pausa.hastaMin ?? null };

  // Con cita: alguien agendado a esta hora que todavía no se sienta.
  const cita = mias.find(
    (r) =>
      (r.estado === "pendiente" || r.estado === "confirmada") &&
      Date.parse(r.inicio) <= ahoraMs &&
      ahoraMs < Date.parse(r.fin),
  );
  if (cita) return { ...base, estado: "con_cita", hastaMin: minutoBogota(Date.parse(cita.fin)) };

  return { ...base, estado: "libre", hastaMin: null };
}

/** Lo que lee el cliente, sin la hora formateada (la pone quien muestra). */
export function textoEstado(e: Pick<EstadoBarbero, "estado" | "hastaMin">, fmt: (min: number) => string): string {
  switch (e.estado) {
    case "en_silla":
      return e.hastaMin != null ? `En silla · sale ${fmt(e.hastaMin)}` : "En silla ahora";
    case "con_cita":
      return e.hastaMin != null ? `Con cita hasta ${fmt(e.hastaMin)}` : "Con cita";
    case "pausa":
      return e.hastaMin != null ? `En pausa · vuelve ${fmt(e.hastaMin)}` : "En pausa";
    case "libre":
      return "Libre ahora";
    case "ausente":
      return "No atiende hoy";
    default:
      // Fuera del horario: "Libre ahora" engañaría. Corto para que quepa en la tarjeta.
      return "Puedes reservar";
  }
}

/** Color del punto de estado: verde libre, rojo en silla, ámbar con cita/ausente. */
export const COLOR_ESTADO: Record<EstadoVivo, string> = {
  libre: "#34d399",
  en_silla: "#e8675c",
  con_cita: "#fbbf24",
  ausente: "#fbbf24",
  pausa: "#9c958a",
  cerrado: "#9c958a",
};

/** "3 cortes hoy" · "1 corte hoy" · null si no lleva ninguno. */
export function textoHechos(n: number): string | null {
  return n > 0 ? `${n} ${n === 1 ? "corte" : "cortes"} hoy` : null;
}

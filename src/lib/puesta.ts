// Puesta a punto: lo que le falta al negocio para que los avisos lleguen.
//
// Lógica PURA, sin I/O (Node la corre directo en scripts/check-puesta.ts).
// saludConfiguracion() en src/lib/data/queries.ts junta los datos —con service
// role, después de confirmar que es el admin— y esto decide qué decirle al dueño
// en el Inicio.
//
// Por qué existe: el Inicio decía «Todo al día» con 0 aparatos del equipo
// recibiendo avisos, el dueño sin correo y las agendas de Google sin compartir.
// Cada pendiente dice QUÉ hacer y DÓNDE; si lo tiene que hacer otra persona en
// su aparato (activar los avisos del celular), dice el paso en ESE aparato,
// porque el dueño no los puede activar por otro.
//
// Tonos:
//   falta       — algo no está llegando a nadie (se destaca arriba)
//   sugerencia  — funciona, pero se puede aprovechar mejor (discreto)

export type TonoPuesta = "falta" | "sugerencia";

export type PendientePuesta = {
  /** Estable: sirve de key y para probar. */
  clave: string;
  tono: TonoPuesta;
  titulo: string;
  detalle: string;
  href: string;
  boton: string;
};

/**
 * Lo que se pudo medir. `null` en cualquier campo = no se pudo saber (tabla sin
 * crear, lectura fallida): ese chequeo se calla en vez de acusar algo que no se
 * verificó.
 */
export type DatosPuesta = {
  /** Correos del dueño en Avisos → "Avisos para ti" (0084). */
  correosDueno: number | null;
  /** Aparatos de algún admin con avisos al celular (0083). */
  aparatosDueno: number | null;
  /** Sedes abiertas y cuántos aparatos del mostrador tienen avisos. */
  sedes: { id: string; nombre: string; aparatos: number }[] | null;
  /** Barberos activos. */
  barberos:
    | {
        id: string;
        nombre: string;
        /** Aparatos con sus avisos al celular. */
        aparatos: number | null;
        /** Tiene correo de avisos en Equipo (barbero_contacto). */
        correo: boolean | null;
        /** Tiene usuario para entrar con su PIN (profiles con su barbero_id). */
        acceso: boolean | null;
      }[]
    | null;
  /** Google Calendar (0073). null si no está configurado en el servidor. */
  agendas: { sinAgenda: string[]; sinCompartir: string[] } | null;
  /** Cobros no anulados de los últimos 7 días, y cuántos sin cliente con correo. */
  cobros7d: { total: number; sinCorreo: number } | null;
  /** "Te toca corte" (0068). */
  tocaCorte: { activo: boolean; elegibles: number } | null;
};

/**
 * ¿Hay algo que no le está llegando a nadie? Es lo único que le quita al Inicio
 * el «Todo al día»: las sugerencias no, porque algunas son decisiones del dueño
 * ("Te toca corte" apagado a propósito, un barbero sin smartphone) y no se pueden
 * descartar; si contaran, el «Todo al día» no volvería a salir nunca.
 */
export const hayFaltas = (lista: PendientePuesta[]): boolean => lista.some((p) => p.tono === "falta");

/** Desde cuántos cobros en la semana vale la pena hablar de los que van sin cliente. */
export const COBROS_MINIMOS = 5;

/** "Ana", "Ana y Luis", "Ana, Luis y Pedro", "Ana, Luis, Pedro y 3 más". */
export function listaNombres(nombres: string[], max = 3): string {
  const n = nombres.filter(Boolean);
  if (n.length <= 1) return n[0] ?? "";
  if (n.length <= max) return `${n.slice(0, -1).join(", ")} y ${n[n.length - 1]}`;
  return `${n.slice(0, max).join(", ")} y ${n.length - max} más`;
}

const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] ?? nombre;

export function armarPuesta(d: DatosPuesta): PendientePuesta[] {
  const lista: PendientePuesta[] = [];

  // --- El dueño -------------------------------------------------------------
  if (d.correosDueno === 0) {
    lista.push({
      clave: "correo-dueno",
      tono: "falta",
      titulo: "No te llega ningún aviso por correo",
      detalle: "Pon tu correo y te avisamos de cada cita que reservan por la web, de cada cierre de caja y si una caja se queda abierta.",
      href: "/admin/avisos",
      boton: "Poner mi correo",
    });
  }
  if (d.aparatosDueno === 0) {
    lista.push({
      clave: "celular-dueno",
      tono: "sugerencia",
      titulo: "Tu celular no recibe avisos",
      detalle: "Abre este panel en tu celular, entra a Avisos y toca «Activar avisos»: te suena cada cliente que reserva por la web.",
      href: "/admin/avisos",
      boton: "Activar",
    });
  }

  // --- El mostrador de cada sede ----------------------------------------------
  for (const s of d.sedes ?? []) {
    if (s.aparatos > 0) continue;
    lista.push({
      clave: `mostrador-${s.id}`,
      tono: "falta",
      titulo: `El mostrador de ${s.nombre} no recibe avisos`,
      detalle:
        "Ni las reservas por la web ni «la caja sigue abierta» suenan en el local. En la tableta o el celular del local: entra al mostrador con el PIN de la sede y, en Turnos, toca «Activar avisos» (si dice que están bloqueados, ahí mismo explica cómo desbloquearlos). El PIN no se puede ver: si nadie lo recuerda, ponle uno nuevo en Equipo → El local → PIN del mostrador.",
      href: "/admin/equipo",
      boton: "Ir a Equipo",
    });
  }

  // --- Los barberos -------------------------------------------------------------
  const barberos = d.barberos ?? [];

  const sinAcceso = barberos.filter((b) => b.acceso === false);
  if (sinAcceso.length) {
    const uno = sinAcceso.length === 1;
    lista.push({
      clave: "barberos-sin-acceso",
      tono: "falta",
      titulo: uno
        ? `${primerNombre(sinAcceso[0].nombre)} no puede entrar a la app`
        : `${sinAcceso.length} barberos no pueden entrar a la app`,
      detalle: `${uno ? "Le falta" : `${listaNombres(sinAcceso.map((b) => b.nombre))}: les falta`} el acceso para entrar con su PIN. Ese acceso lo crea soporte (FourG): escríbeles con ${uno ? "su nombre" : "los nombres"}.`,
      href: "/admin/equipo",
      boton: "Ver equipo",
    });
  }

  const sinCorreo = barberos.filter((b) => b.correo === false);
  if (sinCorreo.length) {
    const uno = sinCorreo.length === 1;
    lista.push({
      clave: "barberos-sin-correo",
      tono: "falta",
      titulo: uno
        ? `${primerNombre(sinCorreo[0].nombre)} no tiene correo de avisos`
        : `${sinCorreo.length} barberos sin correo de avisos`,
      detalle: uno
        ? "No se entera por correo cuando le reservan. Ponlo en Equipo, en su ficha, y toca «Probar»."
        : `${listaNombres(sinCorreo.map((b) => b.nombre))}: no se enteran por correo cuando les reservan. Ponlo en Equipo, en la ficha de cada uno, y toca «Probar».`,
      href: "/admin/equipo",
      boton: uno ? "Poner correo" : "Poner correos",
    });
  }

  // Sin acceso no pueden activar nada: ese pendiente ya está arriba.
  const sinCelular = barberos.filter((b) => b.aparatos === 0 && b.acceso !== false);
  if (sinCelular.length) {
    const uno = sinCelular.length === 1;
    lista.push({
      clave: "barberos-sin-celular",
      tono: "sugerencia",
      titulo: uno
        ? `${primerNombre(sinCelular[0].nombre)} no tiene avisos en el celular`
        : `${sinCelular.length} barberos sin avisos en el celular`,
      detalle: uno
        ? "No le suena cuando un cliente le reserva por la web o le cancela desde su cuenta. En su celular: que entre con su PIN y toque «Activar avisos» en Turnos."
        : `${listaNombres(sinCelular.map((b) => b.nombre))}: no les suena cuando un cliente les reserva por la web o les cancela desde su cuenta. En el celular de cada uno: que entre con su PIN y toque «Activar avisos» en Turnos.`,
      href: "/admin/equipo",
      boton: "Ver equipo",
    });
  }

  // --- Google Calendar ---------------------------------------------------------
  if (d.agendas) {
    const nombres = [...d.agendas.sinAgenda, ...d.agendas.sinCompartir];
    if (nombres.length) {
      const uno = nombres.length === 1;
      const crear = d.agendas.sinAgenda.length > 0;
      lista.push({
        clave: "agendas-google",
        tono: "sugerencia",
        titulo: uno
          ? `${primerNombre(nombres[0])} no ve sus citas en Google Calendar`
          : `${nombres.length} barberos no ven sus citas en Google Calendar`,
        detalle: `${uno ? "" : `${listaNombres(nombres)}. `}En Equipo → El local → Google Calendar, toca ${crear ? "«Crear las agendas» y después " : ""}«Compartir con los barberos». Se comparte al correo de avisos de cada uno.`,
        href: "/admin/equipo",
        boton: "Compartir",
      });
    }
  }

  // --- Los cobros sin cliente ---------------------------------------------------
  const c = d.cobros7d;
  if (c && c.total >= COBROS_MINIMOS && c.sinCorreo * 2 > c.total) {
    lista.push({
      clave: "cobros-sin-cliente",
      tono: "sugerencia",
      titulo: `${c.sinCorreo} de ${c.total} cobros de la semana sin cliente con correo`,
      detalle: "A ellos no les llega la invitación a calificar ni «te toca corte». Al cobrar, que elijan al cliente y le pidan el correo.",
      href: "/admin/metricas",
      boton: "Ver cobros",
    });
  }

  // --- "Te toca corte" -----------------------------------------------------------
  if (d.tocaCorte && !d.tocaCorte.activo) {
    const n = d.tocaCorte.elegibles;
    lista.push({
      clave: "toca-corte",
      tono: "sugerencia",
      titulo: "«Te toca corte» está apagado",
      detalle:
        n > 0
          ? `Hoy le escribiría a ${n === 1 ? "1 cliente" : `${n} clientes`} que llevan días sin venir y dejaron su correo. Se prende en Avisos.`
          : "Le escribe a quien lleva días sin venir y dejó su correo, con el botón para reservar. Se prende en Avisos.",
      href: "/admin/avisos",
      boton: "Revisar",
    });
  }

  // Lo que no está llegando, primero; el orden de cada grupo se respeta.
  return [...lista.filter((p) => p.tono === "falta"), ...lista.filter((p) => p.tono === "sugerencia")];
}

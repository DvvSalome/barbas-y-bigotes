// Reglas PURAS del equipo: el alta, la ficha y la baja de un barbero.
//
// Sin I/O: Node las corre directo en scripts/check-equipo.ts. Las usan las
// server actions de src/lib/equipo-actions.ts, el PIN de barbero-auth.ts, la
// ficha de /admin/equipo, Comisiones y la puesta a punto del Inicio.
//
// Por qué existe (pedido del dueño, 14-oct: "que todo sea autogestionable, por
// si más adelante tienen otros barberos"): dar de alta a un barbero exigía SQL y
// dejarlo ir le dejaba el acceso abierto. Lo que decide cosas —qué correo de
// login se inventa, qué le falta a la ficha, cuándo se puede confirmar una
// baja— vive acá, una sola vez, con su chequeo.

import { esEmailEnviable } from "./email.ts";
import { correoCorregido } from "./avisos-reglas.ts";
import { sanearNombre, sanearComisionPct, sanearCop } from "./admin-reglas.ts";

// ---------- PIN ----------

/** Los que se adivinan al primer intento. Vivía dentro de barbero-auth.ts. */
export const PINS_TRIVIALES = new Set([
  "000000", "111111", "222222", "333333", "444444", "555555", "666666",
  "777777", "888888", "999999", "123456", "654321", "012345", "121212",
]);

export function esPinValido(pin: string): boolean {
  return /^\d{6}$/.test(pin) && !PINS_TRIVIALES.has(pin);
}

export const ERROR_PIN = "El PIN son 6 dígitos y no puede ser uno fácil de adivinar (123456, 000000…).";

// ---------- Contrato ----------

export type TipoContratoEquipo = "porcentaje" | "arriendo";

export type ContratoBarbero = {
  tipo: TipoContratoEquipo;
  comisionPct: number | null;
  arriendoMensual: number | null;
};

/**
 * Lo que el cobro (completarReserva) le reconoce al barbero que va por comisión
 * y no tiene porcentaje cargado. Comisiones mostraba "0 %" para ese caso y el
 * cobro aplicaba 50: el dueño veía una cosa y se pagaba otra.
 */
export const COMISION_POR_DEFECTO = 50;

/** ¿El contrato está escrito, o el cobro está usando el de por defecto? */
export function contratoDefinido(c: ContratoBarbero): boolean {
  if (c.tipo === "arriendo") return c.arriendoMensual != null && c.arriendoMensual > 0;
  return c.comisionPct != null;
}

/** El porcentaje que de verdad se aplica al cobrar; null si paga arriendo. */
export function comisionQueSeCobra(c: ContratoBarbero): number | null {
  if (c.tipo === "arriendo") return null;
  return c.comisionPct != null ? Number(c.comisionPct) : COMISION_POR_DEFECTO;
}

const pesos = (n: number) => `$ ${Math.round(n).toLocaleString("es-CO")}`;

/** "Comisión 45 %", "Arriendo $ 500.000 al mes" o "Sin definir · se cobra 50 %". */
export function textoContrato(c: ContratoBarbero): string {
  if (!contratoDefinido(c)) {
    return c.tipo === "arriendo" ? "Arriendo sin monto" : `Sin definir · se cobra ${COMISION_POR_DEFECTO} %`;
  }
  return c.tipo === "arriendo" ? `Arriendo ${pesos(c.arriendoMensual ?? 0)} al mes` : `Comisión ${Number(c.comisionPct)} %`;
}

/** El contrato que manda el formulario, listo para la tabla, o el motivo en palabras del dueño. */
export function sanearContrato(entrada: {
  tipo?: unknown;
  comisionPct?: unknown;
  arriendoMensual?: unknown;
}):
  | { ok: true; fila: { tipo_contrato: TipoContratoEquipo; comision_pct: number | null; arriendo_mensual: number | null } }
  | { ok: false; error: string } {
  if (entrada.tipo === "arriendo") {
    const monto = sanearCop(entrada.arriendoMensual);
    if (monto === null || monto <= 0) return { ok: false, error: "El arriendo va en pesos, mayor a $0." };
    return { ok: true, fila: { tipo_contrato: "arriendo", arriendo_mensual: monto, comision_pct: null } };
  }
  if (entrada.tipo !== "porcentaje") return { ok: false, error: "Elige si va por comisión o paga arriendo." };
  const pct = sanearComisionPct(entrada.comisionPct);
  if (pct === null) return { ok: false, error: "La comisión va entre 0 y 100." };
  return { ok: true, fila: { tipo_contrato: "porcentaje", comision_pct: pct, arriendo_mensual: null } };
}

// ---------- El correo del LOGIN (no el de avisos) ----------
//
// Supabase pide un correo para cada usuario. El del barbero NO es para escribirle:
// es un nombre interno con el que su PIN abre la sesión (generateLink + verifyOtp,
// nada sale por correo). Se sigue el patrón de los que ya existen:
// <primer nombre>@barbasybigotes.com. Ese buzón NO existe, y está bien: nadie le
// manda nada. Lo que no puede pasar es que coincida con un buzón REAL del dominio
// (reservas@) ni con uno que se vaya a crear (hola@, info@…): por eso la lista de
// reservados, y por eso el chequeo exige que ninguno pase esEmailEnviable.

export const DOMINIO_INTERNO = "barbasybigotes.com";

const LOCALES_RESERVADOS = new Set([
  "reservas", "reserva", "admin", "administrador", "administracion", "hola", "info", "contacto",
  "soporte", "ventas", "marketing", "noreply", "no-reply", "postmaster", "abuse", "webmaster",
  "hostmaster", "dueno", "barbas", "citas", "pagos", "facturacion", "equipo", "staff", "barberos",
]);

/** Minúsculas, sin tildes ni eñes, solo letras y números: "Íñigo" → "inigo". */
export function slugLocal(texto: string): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 30);
}

const reservado = (local: string) => LOCALES_RESERVADOS.has(local) || local.startsWith("mostrador");

/**
 * Los correos de login a probar, en orden: "kevin@", "kevin.valencia@", "kevin2@",
 * "kevin3@"… El primero que Supabase no tenga, gana (la action prueba en orden).
 */
export function candidatosCorreoInterno(nombre: string, cuantos = 8): string[] {
  const partes = (nombre ?? "").trim().split(/\s+/).map(slugLocal).filter(Boolean);
  // Un primer nombre que es (o empieza como) un buzón del local va con prefijo:
  // "Reservas" → barbero.reservas@, nunca reservas@ ni reservas2@.
  const crudo = partes[0] || "barbero";
  const primero = reservado(crudo) ? `barbero.${crudo}` : crudo;
  const locales: string[] = [];
  const sumar = (l: string) => {
    if (l && !reservado(l) && !locales.includes(l)) locales.push(l);
  };
  sumar(primero);
  if (partes.length > 1) sumar(`${primero}.${partes[partes.length - 1]}`);
  for (let n = 2; locales.length < cuantos && n < 100; n++) sumar(`${primero}${n}`);
  return locales.slice(0, cuantos).map((l) => `${l}@${DOMINIO_INTERNO}`);
}

// ---------- El correo de AVISOS del barbero ----------

/** El correo de avisos limpio (o null si lo dejó vacío), o el motivo en palabras del dueño. */
export function correoDeAvisos(email: unknown): { ok: true; email: string | null } | { ok: false; error: string } {
  const limpio = (typeof email === "string" ? email : "").trim().toLowerCase().slice(0, 120);
  if (!limpio) return { ok: true, email: null };
  if (limpio.endsWith(`@${DOMINIO_INTERNO}`) && !esEmailEnviable(limpio))
    return { ok: false, error: "Ese buzón no existe en barbasybigotes.com. Usa el correo personal del barbero (Gmail, Outlook…)." };
  if (!esEmailEnviable(limpio)) return { ok: false, error: "Ese correo no parece real. Revisa cómo está escrito." };
  const sugerido = correoCorregido(limpio);
  if (sugerido) return { ok: false, error: `¿Quisiste decir ${sugerido}? Revisa cómo está escrito.` };
  return { ok: true, email: limpio };
}

// ---------- El alta ----------

export type NuevoBarberoEntrada = {
  nombre?: unknown;
  sedeId?: unknown;
  pin?: unknown;
  correo?: unknown;
  tipo?: unknown;
  comisionPct?: unknown;
  arriendoMensual?: unknown;
};

export type NuevoBarbero = {
  nombre: string;
  sedeId: string;
  pin: string;
  correo: string | null;
  contrato: { tipo_contrato: TipoContratoEquipo; comision_pct: number | null; arriendo_mensual: number | null };
};

export type CampoAlta = "nombre" | "sede" | "pin" | "correo" | "contrato";

/** Todo lo del formulario de "Agregar barbero", validado de una vez, con el campo que falló. */
export function validarNuevoBarbero(
  x: NuevoBarberoEntrada,
  sedes: string[],
): { ok: true; valor: NuevoBarbero } | { ok: false; campo: CampoAlta; error: string } {
  const nombre = sanearNombre(x.nombre, 60);
  if (!nombre || nombre.length < 2) return { ok: false, campo: "nombre", error: "Escribe el nombre con el que lo conocen los clientes." };
  const sedeId = typeof x.sedeId === "string" ? x.sedeId : "";
  if (!sedes.includes(sedeId)) return { ok: false, campo: "sede", error: "Elige en qué sede trabaja." };
  const pin = typeof x.pin === "string" ? x.pin.trim() : "";
  if (!esPinValido(pin)) return { ok: false, campo: "pin", error: ERROR_PIN };
  const correo = correoDeAvisos(x.correo);
  if (!correo.ok) return { ok: false, campo: "correo", error: correo.error };
  const contrato = sanearContrato({ tipo: x.tipo, comisionPct: x.comisionPct, arriendoMensual: x.arriendoMensual });
  if (!contrato.ok) return { ok: false, campo: "contrato", error: contrato.error };
  return { ok: true, valor: { nombre, sedeId, pin, correo: correo.email, contrato: contrato.fila } };
}

// ---------- La ficha: qué le falta para trabajar ----------

export type DatosChecklist = {
  /** Perfil + usuario de Auth para entrar con el PIN. null = no se pudo saber. */
  acceso: boolean | null;
  pin: { tiene: boolean; bloqueado: boolean } | null;
  foto: boolean;
  contrato: ContratoBarbero | null;
  /** Correo de avisos (barbero_contacto). */
  correo: string | null;
  /** ¿Salió una prueba a ESE correo? null = no se sabe. */
  correoProbado: boolean | null;
  /** Google Calendar: null si el servidor no lo tiene configurado (no es reproche). */
  agenda: { creada: boolean; compartidaCon: string | null } | null;
  /** Aparatos con sus avisos al celular. null = no se sabe. */
  aparatos: number | null;
  /** Último ingreso a la app: null = nunca, undefined = no se sabe. */
  ultimoIngreso: string | null | undefined;
};

export type ClavePunto = "acceso" | "pin" | "foto" | "contrato" | "correo" | "agenda" | "celular" | "ingreso";

export type PuntoChecklist = {
  clave: ClavePunto;
  /** ok = listo · falta = cuenta en "Le faltan N" · nota = está, pero conviene mirarlo. */
  estado: "ok" | "falta" | "nota";
  titulo: string;
  detalle: string;
  /** Dos o tres palabras para la fila de la lista ("sin PIN"). */
  corto: string;
  /** Sin esto no trabaja con la app hoy (no entra o no se entera de sus citas). */
  bloquea: boolean;
};

/**
 * Los puntos de la ficha, en el orden en que se arreglan. Lo que no se pudo medir
 * (null/undefined) no aparece: acusar sin saber es peor que callar.
 */
export function checklistBarbero(d: DatosChecklist, fecha: (iso: string) => string = (iso) => iso.slice(0, 10)): PuntoChecklist[] {
  const p: PuntoChecklist[] = [];

  if (d.acceso === false) {
    p.push({
      clave: "acceso",
      estado: "falta",
      titulo: "Sin acceso a la app",
      detalle: "Sin esto el PIN no le sirve. Toca «Crear acceso»: no le llega ningún correo, solo queda listo para entrar con su PIN.",
      corto: "sin acceso",
      bloquea: true,
    });
  } else if (d.acceso === true) {
    p.push({
      clave: "acceso",
      estado: "ok",
      titulo: "Acceso a la app creado",
      detalle: "Entra con su PIN desde su app (aquí abajo, «Su app en el celular») o en barbasybigotes.com/login tocando su nombre.",
      corto: "acceso",
      bloquea: false,
    });
  }

  if (d.pin) {
    if (d.pin.bloqueado) {
      p.push({ clave: "pin", estado: "falta", titulo: "PIN bloqueado", detalle: "Se equivocó 5 veces. Desbloquéalo o ponle uno nuevo.", corto: "PIN bloqueado", bloquea: true });
    } else if (!d.pin.tiene) {
      p.push({ clave: "pin", estado: "falta", titulo: "Sin PIN", detalle: "Ponle un PIN de 6 dígitos y díselo en persona: no se lo mandamos por ningún lado.", corto: "sin PIN", bloquea: true });
    } else {
      p.push({ clave: "pin", estado: "ok", titulo: "PIN puesto", detalle: "Si lo olvida, ponle uno nuevo: el anterior deja de servir.", corto: "PIN", bloquea: false });
    }
  }

  p.push(
    d.foto
      ? { clave: "foto", estado: "ok", titulo: "Foto puesta", detalle: "Es la que ve el cliente en la web y al reservar.", corto: "foto", bloquea: false }
      : { clave: "foto", estado: "falta", titulo: "Sin foto", detalle: SIN_FOTO, corto: "sin foto", bloquea: false },
  );

  if (d.contrato) {
    p.push(
      contratoDefinido(d.contrato)
        ? { clave: "contrato", estado: "ok", titulo: textoContrato(d.contrato), detalle: "Es lo que usa el cobro para repartir.", corto: "contrato", bloquea: false }
        : {
            clave: "contrato",
            estado: "falta",
            titulo: "Contrato sin definir",
            detalle: `Hoy se le cobra el ${COMISION_POR_DEFECTO} % de comisión por defecto. Si no es eso, cámbialo aquí abajo.`,
            corto: "contrato sin definir",
            bloquea: false,
          },
    );
  }

  if (!d.correo) {
    p.push({ clave: "correo", estado: "falta", titulo: "Sin correo de avisos", detalle: "No se entera por correo cuando le reservan.", corto: "sin correo", bloquea: true });
  } else if (d.correoProbado === false) {
    p.push({ clave: "correo", estado: "nota", titulo: "Correo puesto, sin probar", detalle: `Toca «Probar» y confirma con él que le llegó a ${d.correo}.`, corto: "correo sin probar", bloquea: false });
  } else {
    p.push({ clave: "correo", estado: "ok", titulo: d.correoProbado ? "Correo de avisos probado" : "Correo de avisos puesto", detalle: `Le llega un correo a ${d.correo} apenas le reservan.`, corto: "correo", bloquea: false });
  }

  if (d.agenda) {
    if (d.agenda.compartidaCon) {
      p.push({ clave: "agenda", estado: "ok", titulo: "Agenda de Google compartida", detalle: `Con ${d.agenda.compartidaCon}: ve sus citas en Google Calendar.`, corto: "agenda", bloquea: false });
    } else {
      p.push({
        clave: "agenda",
        estado: "falta",
        titulo: d.agenda.creada ? "Agenda de Google sin compartir" : "Sin agenda de Google",
        detalle: d.correo
          ? `Toca «Compartir su agenda»: ${d.agenda.creada ? "" : "se crea y "}se le comparte a ${d.correo}.`
          : "Primero pon su correo de avisos: la agenda se le comparte a ese correo.",
        corto: d.agenda.creada ? "agenda sin compartir" : "sin agenda",
        bloquea: false,
      });
    }
  }

  // Sin acceso no puede activar avisos ni entrar: eso ya lo dice el primer punto.
  // Estos dos los hace ÉL, no el dueño: si faltan son una NOTA (se ven, con qué
  // decirle), no cuentan en "Le faltan N". Si contaran, nadie llegaría a "Listo"
  // sin instalar la app, y el dueño no tiene cómo arreglarlo desde acá.
  if (d.acceso !== false && d.aparatos !== null) {
    p.push(
      d.aparatos > 0
        ? { clave: "celular", estado: "ok", titulo: "Avisos en el celular", detalle: `Activos en ${d.aparatos === 1 ? "1 aparato" : `${d.aparatos} aparatos`}.`, corto: "celular", bloquea: false }
        : {
            clave: "celular",
            estado: "nota",
            titulo: "Sin avisos en el celular",
            detalle: "Esto lo hace él: que entre con su PIN y toque «Activar avisos» en Turnos. Tú no los puedes activar por él.",
            corto: "sin avisos en el celular",
            bloquea: false,
          },
    );
  }
  if (d.acceso !== false && d.ultimoIngreso !== undefined) {
    p.push(
      d.ultimoIngreso
        ? { clave: "ingreso", estado: "ok", titulo: "Ya entró a la app", detalle: `Última vez: ${fecha(d.ultimoIngreso)}.`, corto: "entró", bloquea: false }
        : {
            clave: "ingreso",
            estado: "nota",
            titulo: "Nunca ha entrado",
            detalle: "Esto lo hace él: mándale su app (aquí abajo, «Su app en el celular»), que la agregue a la pantalla de inicio y entre con su PIN.",
            corto: "nunca ha entrado",
            bloquea: false,
          },
    );
  }
  return p;
}

/** "Listo" o "Le faltan 3: sin PIN · sin foto · sin agenda", y cuántos le impiden trabajar. */
export function resumenChecklist(puntos: PuntoChecklist[]): { faltan: number; bloquean: number; subtitulo: string } {
  const faltas = puntos.filter((p) => p.estado === "falta");
  const bloquean = faltas.filter((p) => p.bloquea).length;
  if (!faltas.length) return { faltan: 0, bloquean: 0, subtitulo: "Listo" };
  // Lo que le impide trabajar va primero: es lo que el dueño viene a buscar.
  const orden = [...faltas.filter((p) => p.bloquea), ...faltas.filter((p) => !p.bloquea)];
  return {
    faltan: faltas.length,
    bloquean,
    subtitulo: `Le ${faltas.length === 1 ? "falta 1" : `faltan ${faltas.length}`}: ${orden.map((p) => p.corto).join(" · ")}`,
  };
}

/**
 * El encabezado de la ficha, por lo que IMPIDE trabajar y no por todo lo que falta:
 * "No puede trabajar con la app: sin PIN" (ámbar), "Puede trabajar · 2 pendientes"
 * o "Listo para trabajar con la app".
 */
export function encabezadoFicha(puntos: PuntoChecklist[]): { texto: string; tono: "bloquea" | "pendiente" | "listo" } {
  const faltas = puntos.filter((p) => p.estado === "falta");
  const bloqueantes = faltas.filter((p) => p.bloquea);
  if (bloqueantes.length) {
    return { texto: `No puede trabajar con la app: ${bloqueantes.map((p) => p.corto).join(" · ")}`, tono: "bloquea" };
  }
  if (faltas.length) {
    return { texto: `Puede trabajar · ${faltas.length === 1 ? "1 pendiente" : `${faltas.length} pendientes`}`, tono: "pendiente" };
  }
  return { texto: "Listo para trabajar con la app", tono: "listo" };
}

/** Etiqueta de la insignia de la lista: qué significa el número. */
export const etiquetaInsignia = (n: number) => (n === 1 ? "1 cosa le impide trabajar" : `${n} cosas le impiden trabajar`);

/**
 * Sin foto, la web y la reserva muestran una foto GENÉRICA (de otra persona), no
 * sus iniciales: las iniciales solo salen en el panel. El cliente elige barbero
 * por la cara y llega esperando a otro.
 */
export const SIN_FOTO = "En la web y al reservar sale con una foto genérica que no es él, y el cliente elige barbero por la cara.";

// ---------- La baja ----------

/** Ban "para siempre" de Supabase Auth (100 años). "none" lo quita al reactivar. */
export const BAN_DE_BAJA = "876000h";

/**
 * ¿Se puede confirmar la baja? null = sí; si no, el motivo en palabras del dueño.
 * Una cita futura que nadie atiende es un cliente que llega a la puerta y no hay
 * barbero: o se pasa a otro, o se cancela avisándole.
 */
export function motivoParaNoDarDeBaja(x: {
  citasFuturas: number;
  cancelarCitas: boolean;
  enSilla: boolean;
  /** Citas de los últimos 7 días que ya pasaron y nadie cobró ni marcó "no vino". */
  sinCobrar?: number;
}): string | null {
  if (x.enSilla) return "Está atendiendo a alguien ahora mismo. Cobra esa cita primero y vuelve a intentarlo.";
  // Al darlo de baja su columna sale del mostrador y nadie más puede cobrar esos
  // cortes: el ingreso y su comisión no entrarían nunca a caja ni a liquidación.
  if ((x.sinCobrar ?? 0) > 0) {
    const n = x.sinCobrar ?? 0;
    return `Tiene ${n === 1 ? "1 cita que ya pasó y no se ha cobrado" : `${n} citas que ya pasaron y no se han cobrado`}. Cóbrala${n === 1 ? "" : "s"} o márcala${n === 1 ? "" : "s"} «No vino» antes de darlo de baja.`;
  }
  if (x.citasFuturas > 0 && !x.cancelarCitas) {
    return `Todavía tiene ${x.citasFuturas === 1 ? "1 cita" : `${x.citasFuturas} citas`} por delante. Pásalas a otro barbero o marca «Cancelarlas».`;
  }
  return null;
}

/**
 * Qué se le dice al dueño de los clientes cuyas citas se cancelan: el aviso por
 * correo solo le llega a quien dejó correo (0059), y el push solo a quien tiene la
 * app. "A cada cliente le llega" era falso para 3 de cada 4 citas (medido 14-oct).
 */
export function avisoAClientes(conCorreo: number, sinCorreo: number): string {
  const total = conCorreo + sinCorreo;
  if (!total) return "";
  if (!sinCorreo) return total === 1 ? "Al cliente le llega el correo de que su cita se canceló." : "A los clientes les llega el correo de que su cita se canceló.";
  const llamar = sinCorreo === 1 ? "1 no dejó correo: llámalo" : `${sinCorreo} no dejaron correo: llámalos`;
  if (!conCorreo) return total === 1 ? "No dejó correo, así que no le llega ningún aviso: llámalo." : `Ninguno dejó correo, así que no les llega ningún aviso: llámalos.`;
  return `A ${conCorreo === 1 ? "1 le llega" : `${conCorreo} les llega`} el correo de que su cita se canceló; ${llamar}.`;
}

/**
 * El motivo de moverCita, dicho en el contexto de PASAR una cita a otro a la misma
 * hora. moverCita lo dice pensando en el que elige hora ("Elige otro"), y en la
 * hoja de pasar citas no se elige hora: el dueño buscaba dónde y no había.
 */
export function motivoAlPasar(error: string | undefined, destino: string): string {
  const quien = (destino ?? "").trim() || "Ese barbero";
  const e = (error ?? "").trim();
  if (/ya fue tomado/i.test(e)) return `${quien} ya tiene a alguien a esa hora`;
  if (/rato bloqueado/i.test(e)) return `${quien} tiene ese rato bloqueado`;
  if (/no atiende ese d[ií]a/i.test(e)) return `${quien} no viene ese día`;
  if (/no est[aá] en la sede/i.test(e)) return `${quien} no está en esa sede ese día`;
  if (/ya no trabaja aqu[ií]/i.test(e)) return `${quien} ya no trabaja aquí`;
  if (/fuera del horario/i.test(e)) return "la sede ya no abre a esa hora";
  if (/la sede no atiende/i.test(e)) return "la sede no abre ese día";
  if (/ya no se puede mover|cambi[oó] de estado/i.test(e)) return "ya empezó o se cerró mientras tanto";
  if (!e) return "no se pudo";
  // Cualquier otro: sin la coletilla de "elige otra hora" que acá no aplica.
  return e.replace(/\s*Elige otr[oa][^.]*\.?\s*$/i, "").replace(/\.$/, "") || "no se pudo";
}

/**
 * Alta con el nombre de alguien que ya se fue. En esta barbería los nombres son de
 * una palabra (Kevin, Bryan, Abel): puede ser él que vuelve o un homónimo. Nunca
 * se empuja a reactivar sin que el dueño diga que es la misma persona: un homónimo
 * reactivado hereda calificaciones, historial y el correo de avisos del otro.
 */
export function mensajeHomonimo(nombre: string): string {
  return `Ya trabajó aquí un ${nombre}. Si es él, reactívalo en «Ya no trabajan aquí», al final de Equipo: así conserva su historial. Si es otra persona, toca «Es otra persona» (o agrégale el apellido para distinguirlos).`;
}

/** Posición en la web (1 = primero) saneada al rango de la sede. */
export function sanearOrden(valor: unknown, cuantos: number): number | null {
  const n = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isInteger(n) || n < 1) return null;
  return Math.min(n, Math.max(1, cuantos));
}

/** Reubica `id` en la posición `pos` (1 = primero) y devuelve la lista con su orden nuevo 1..n. */
export function reordenar(ids: string[], id: string, pos: number): { id: string; orden: number }[] {
  const resto = ids.filter((x) => x !== id);
  const i = Math.max(0, Math.min(resto.length, pos - 1));
  return [...resto.slice(0, i), id, ...resto.slice(i)].map((x, k) => ({ id: x, orden: k + 1 }));
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { categorias } from "@/lib/data/seed";
import { createReserva, getDisponibilidad } from "@/lib/actions";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Sede, SedeId, Servicio, Barbero, Categoria } from "@/lib/data/types";
import type { BebidaUpsell, Ausencia } from "@/lib/data/queries";
import { cop } from "@/lib/format";
import { ScissorsIcon } from "@/components/icons";
import { DOW, MON, STEP, OPEN, CLOSE, fmtTime, buildSlots } from "@/lib/slots";

// ------------------------------------------------------------------
//  WIZARD DE RESERVA — recreación 1:1 del prototipo (Claude Design).
//  Fuente: .superpowers/design/publico-reservar.md §6.
//  Una sola pantalla, 5 pasos internos, header fijo + footer sticky.
//  Mobile-first: se ve perfecto a 390px sin desbordes horizontales.
// ------------------------------------------------------------------

type Step = "sede" | "servicio" | "barbero" | "horario" | "datos" | "ok";

const ORDEN: Step[] = ["sede", "servicio", "barbero", "horario", "datos"];
const TITULOS: Record<Exclude<Step, "ok">, string> = {
  sede: "Sede",
  servicio: "Servicio",
  barbero: "Barbero",
  horario: "Día y hora",
  datos: "Tus datos",
};

// Detalle corto + foto de frente por sede (contenido estático del proto §6.3 / §7).
const SEDE_INFO: Record<string, { detalle: string; frente: string }> = {
  "parque-venezuela": { detalle: "Cra 65 · Barranquilla", frente: "/sedes/parque-venezuela-frente.jpg" },
  "plaza-de-la-paz": { detalle: "Centro · Barranquilla", frente: "/sedes/plaza-de-la-paz-frente.jpg" },
};

// Fotos de servicio que cicla el proto (§6.4): corte-2, corte-3, corte-5, corte-1 por índice.
const SERV_FOTOS = ["/cortes/corte-2.jpg", "/cortes/corte-3.jpg", "/cortes/corte-5.jpg", "/cortes/corte-1.jpg"];

// Copy default del upsell (proto §6.9; sin fuente admin, usamos el del prototipo).
const UPSELL_EXTRA = { titulo: "¿Le sumás una bebida a tu corte?", sub: "Te la sirven apenas te sentás en la silla.", rechazo: "No, gracias" };
const UPSELL_COMBO = { titulo: "Tu combo incluye bebida. ¿Cuál querés?", sub: "Va incluida en el precio del combo.", rechazo: "Sin bebida" };
// Reglas admin (upsellOn/comboOn) — no hay tabla de config; ambos activos por defecto.
const UPSELL_ON = true;
const COMBO_ON = true;

const GRAD_CTA = "linear-gradient(180deg,#e8675c,#d23f34)";

// Correo obligatorio: el copy del paso datos promete "Te llega la confirmación al
// correo", así que es el canal real de contacto. Regex simple (no RFC completo).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// El OAuth de Google recarga la página y el estado del wizard vive en React:
// antes del redirect se guarda un snapshot en sessionStorage y al volver se
// restaura (válido 30 min).
const RESUME_KEY = "bb-reserva-reanudar";

const GoogleG = () => (
  <svg viewBox="0 0 48 48" className="h-[18px] w-[18px] shrink-0" aria-hidden>
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6.1C12.3 13.3 17.6 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.2-3.9 6.6-9.6 6.6-16.6z" />
    <path fill="#FBBC05" d="M10.4 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.8-6.1C1 16.3 0 20 0 24s1 7.7 2.6 10.7l7.8-6.1z" />
    <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.1-5.5c-2 1.4-4.6 2.2-8.1 2.2-6.4 0-11.7-3.8-13.6-9.4l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

type Bebida = BebidaUpsell;

function mismoDia(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

// "Hoy" / "Mañana" / "Vie 10 jul" para resúmenes.
function diaLabel(d: Date) {
  const hoy = new Date();
  const man = new Date();
  man.setDate(hoy.getDate() + 1);
  if (mismoDia(d, hoy)) return "Hoy";
  if (mismoDia(d, man)) return "Mañana";
  return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
}

// Badge de duración del proto (§6.4): "30M" / "1H" / "1H 15M".
function durBadge(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}H ${m}M`;
  if (h) return `${h}H`;
  return `${m}M`;
}

// ¿El rango [inicio,fin) ocupa el slot t (de duración dur)?
function ocupaSlot(t: number, dur: number, rango: { inicio: string; fin: string }) {
  const oi = new Date(rango.inicio);
  const of = new Date(rango.fin);
  const sM = oi.getHours() * 60 + oi.getMinutes();
  const eM = of.getHours() * 60 + of.getMinutes();
  return t < eM && t + dur > sM;
}

function RelojIcon() {
  return (
    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#e8675c" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function BookingWizard({
  sedes,
  barberos,
  servicios,
  bebidas,
  ausencias,
  initialBarberoId,
  initialSedeId,
}: {
  sedes: Sede[];
  barberos: Barbero[];
  servicios: Servicio[];
  bebidas: BebidaUpsell[];
  ausencias: Ausencia[];
  initialBarberoId?: string;
  initialSedeId?: SedeId;
}) {
  const router = useRouter();

  const initialBarbero = barberos.find((b) => b.id === initialBarberoId) ?? null;
  // La sede del barbero preseleccionado manda sobre ?sede= si llegan ambos.
  const sedeDefault =
    initialBarbero?.sede ??
    initialSedeId ??
    (sedes.find((s) => s.id === "parque-venezuela")?.id ?? sedes[0]?.id ?? null);

  // Deep-link de sede o barbero → arranca en paso 2 (Servicio) con la sede fija (proto §12).
  const [step, setStep] = useState<Step>(initialBarbero || initialSedeId ? "servicio" : "sede");
  const [sedeId, setSedeId] = useState<SedeId | null>(sedeDefault);
  const [servicio, setServicio] = useState<Servicio | null>(null);
  const [servicioFoto, setServicioFoto] = useState<string>(SERV_FOTOS[0]);
  const [selectedCat, setSelectedCat] = useState<Categoria>("cortes");
  const [barbero, setBarbero] = useState<Barbero | null>(initialBarbero);
  const [day, setDay] = useState<Date | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [bebida, setBebida] = useState<Bebida | null>(null);
  const [bebidaIncluida, setBebidaIncluida] = useState(false); // combo → sin cargo
  const [upsellMode, setUpsellMode] = useState<"extra" | "combo" | null>(null);
  const [upsellSeen, setUpsellSeen] = useState(false);
  // Nudge de Google antes de confirmar como invitado (una vez por flujo): sin
  // cuenta no hay seguimiento (cita en la fila, tarjeta de cortes, recordatorios).
  const [loginNudge, setLoginNudge] = useState(false);
  const [nudgeSeen, setNudgeSeen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Sesión Google del cliente: si está logueado, la reserva queda atada a su
  // cuenta (el server usa el email de la sesión) y el paso datos no pide correo.
  const [sesion, setSesion] = useState<{ nombre: string; email: string } | null>(null);
  // "Ahora" estable por montaje: evita llamar Date.now() en render (regla de pureza
  // del React Compiler). El estado en vivo del barbero se refresca con statusHoy.
  const [ahora] = useState(() => Date.now());
  // Ocupación del día elegido, por barbero (para los slots del paso 4).
  const [ocupadosDia, setOcupadosDia] = useState<Record<string, { inicio: string; fin: string }[]>>({});
  const [cargandoSlots, setCargandoSlots] = useState(false);
  // Ocupación de HOY, por barbero (estado en vivo del paso 3).
  const [statusHoy, setStatusHoy] = useState<Record<string, { inicio: string; fin: string }[]>>({});

  const sedeBarberos = useMemo(() => barberos.filter((b) => b.sede === sedeId), [barberos, sedeId]);
  const sedeNombre = sedes.find((s) => s.id === sedeId)?.nombre ?? "—";
  // Solo servicios con precio en la sede activa: los combos son por sede (F3) y un
  // servicio sin fila en servicio_sede de esta sede no debe ofrecerse (mostraba "—").
  const serviciosSede = useMemo(
    () => servicios.filter((s) => (sedeId ? s.precios[sedeId] != null : true)),
    [servicios, sedeId],
  );
  const cats = useMemo(
    () => (Object.keys(categorias) as Categoria[]).filter((c) => serviciosSede.some((s) => s.categoria === c)),
    [serviciosSede],
  );
  // Bebidas del upsell filtradas por la sede activa (config por sede, migración 0028).
  const bebidasSede = useMemo(
    () => bebidas.filter((b) => b.sede === sedeId),
    [bebidas, sedeId],
  );
  // Barberos ausentes en el día de referencia (el elegido, o hoy si aún no hay).
  // Se compara por YYYY-MM-DD local, igual que la fecha que guarda el admin.
  const ausenteSet = useMemo(() => {
    const ref = day ?? new Date(ahora);
    const ymd = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}-${String(ref.getDate()).padStart(2, "0")}`;
    return new Set(ausencias.filter((a) => a.fecha === ymd).map((a) => a.barberoId));
  }, [ausencias, day, ahora]);

  // Días disponibles: próximos días hábiles (domingos cerrado). Estable entre renders.
  const [dias] = useState<Date[]>(() => {
    const out: Date[] = [];
    const base = new Date();
    for (let i = 0; out.length < 6 && i < 14; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      if (d.getDay() !== 0) out.push(d); // salta domingo
    }
    return out;
  });

  const slots = useMemo(() => (servicio ? buildSlots(servicio.duracionMin) : ([] as number[])), [servicio]);
  const dur = servicio?.duracionMin ?? STEP;

  // Al entrar al paso horario sin día elegido, preselecciona el primero (proto muestra "Hoy").
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- preselección de UX al entrar al paso (no cascada real)
    if (step === "horario" && !day && dias.length) setDay(dias[0]);
  }, [step, day, dias]);

  // Al montar: (1) si venimos del redirect de Google, restaurar la reserva a
  // medias desde sessionStorage; (2) detectar la sesión del cliente para el
  // paso datos ("Reservando como …").
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(RESUME_KEY);
      if (raw) {
        sessionStorage.removeItem(RESUME_KEY);
        const s = JSON.parse(raw) as {
          t?: number;
          sedeId?: SedeId;
          servicioId?: string;
          barberoId?: string | null;
          dayISO?: string;
          slot?: number;
          bebida?: Bebida | null;
          bebidaIncluida?: boolean;
          servicioFoto?: string;
        };
        const sv = servicios.find((x) => x.id === s.servicioId) ?? null;
        const d = s.dayISO ? new Date(s.dayISO) : null;
        if (s.t && Date.now() - s.t < 30 * 60000 && s.sedeId && sv && d && !isNaN(d.getTime()) && s.slot != null) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación al montar desde sessionStorage (redirect de Google)
          setSedeId(s.sedeId);
          setServicio(sv);
          if (s.servicioFoto) setServicioFoto(s.servicioFoto);
          setBarbero(barberos.find((x) => x.id === s.barberoId) ?? null);
          setDay(d);
          setSlot(s.slot);
          setBebida(s.bebida ?? null);
          setBebidaIncluida(!!s.bebidaIncluida);
          setUpsellSeen(true);
          setStep("datos");
        }
      }
    } catch {
      // Snapshot corrupto: el wizard arranca normal.
    }
    let vivo = true;
    supabaseBrowser()
      .auth.getSession()
      .then(({ data }) => {
        const u = data.session?.user;
        if (!vivo || !u?.email) return;
        const meta = (u.user_metadata ?? {}) as { full_name?: string; name?: string };
        setSesion({ nombre: meta.full_name || meta.name || "", email: u.email });
      });
    return () => {
      vivo = false;
    };
  }, [servicios, barberos]);

  // Disponibilidad del día elegido: barbero fijo o todos los de la sede (para "cualquier barbero").
  useEffect(() => {
    if (!day || !sedeId) return;
    const consulta = barbero ? [barbero] : sedeBarberos;
    if (!consulta.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpiar disponibilidad cuando no hay barbero que consultar
      setOcupadosDia({});
      return;
    }
    let cancel = false;
    const fetchAll = () =>
      Promise.all(
        consulta.map((b) =>
          getDisponibilidad({ barberoId: b.id, fechaISO: day.toISOString() }).then((r) => [b.id, r] as const),
        ),
      ).then((entries) => {
        if (!cancel) setOcupadosDia(Object.fromEntries(entries));
      });
    // Sin setState síncrono en el cuerpo del effect (regla del React Compiler).
    Promise.resolve()
      .then(() => {
        if (!cancel) setCargandoSlots(true);
        return fetchAll();
      })
      .finally(() => {
        if (!cancel) setCargandoSlots(false);
      });
    // Realtime: cualquier reserva de esta sede re-consulta la disponibilidad.
    const sb = supabaseBrowser();
    const sub = sb
      .channel(`wizard-${sedeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservas", filter: `sede_id=eq.${sedeId}` }, () => {
        fetchAll();
      })
      .subscribe();
    const poll = setInterval(fetchAll, 30000);
    return () => {
      cancel = true;
      sb.removeChannel(sub);
      clearInterval(poll);
    };
  }, [day, sedeId, barbero, sedeBarberos]);

  // Estado en vivo del paso 3: ocupación de HOY de los barberos de la sede.
  useEffect(() => {
    if (step !== "barbero" || !sedeBarberos.length) return;
    let cancel = false;
    const hoy = new Date();
    Promise.all(
      sedeBarberos.map((b) =>
        getDisponibilidad({ barberoId: b.id, fechaISO: hoy.toISOString() }).then((r) => [b.id, r] as const),
      ),
    )
      .then((entries) => {
        if (!cancel) setStatusHoy(Object.fromEntries(entries));
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [step, sedeBarberos]);

  // Slots ocupados por reserva (tachados) y pasados (apagados sin tachar) — proto §6.6.
  const ocupadoSet = useMemo(() => {
    const s = new Set<number>();
    if (!day) return s;
    for (const t of slots) {
      if (barbero) {
        if ((ocupadosDia[barbero.id] ?? []).some((o) => ocupaSlot(t, dur, o))) s.add(t);
      } else {
        // "Cualquier barbero": ocupado sólo si NINGÚN barbero de la sede está libre.
        const alguienLibre = sedeBarberos.some((b) => !(ocupadosDia[b.id] ?? []).some((o) => ocupaSlot(t, dur, o)));
        if (!alguienLibre) s.add(t);
      }
    }
    return s;
  }, [day, slots, dur, barbero, sedeBarberos, ocupadosDia]);

  const pasadoSet = useMemo(() => {
    const s = new Set<number>();
    if (!day) return s;
    const now = new Date();
    if (mismoDia(day, now)) {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      for (const t of slots) if (t <= nowMin) s.add(t);
    }
    return s;
  }, [day, slots]);

  const sinCupos = slots.length > 0 && slots.every((t) => ocupadoSet.has(t) || pasadoSet.has(t));
  // Primer horario realmente reservable del día: lleva el sello "Próximo" para
  // que el ojo caiga ahí y no en la grilla completa.
  const proximoLibre = slots.find((t) => !ocupadoSet.has(t) && !pasadoSet.has(t)) ?? null;
  // Cuántos turnos ya tomó el barbero hoy (prueba social del encabezado).
  const tomadosHoy = slots.filter((t) => ocupadoSet.has(t)).length;

  // Estado en vivo de un barbero para el chip del paso 3.
  function estadoBarbero(bId: string): { tipo: "libre" | "silla" | "cerrado"; label: string } {
    const rangos = statusHoy[bId] ?? [];
    const now = ahora;
    const activa = rangos.find((o) => new Date(o.inicio).getTime() <= now && now <= new Date(o.fin).getTime());
    if (activa) {
      const f = new Date(activa.fin);
      return { tipo: "silla", label: `En silla · sale ${fmtTime(f.getHours() * 60 + f.getMinutes())}` };
    }
    // Fuera del horario de la barbería (domingo, antes de abrir o después de cerrar)
    // "Libre ahora" (verde) engaña: no está trabajando. Se muestra neutro.
    const d = new Date(now);
    const min = d.getHours() * 60 + d.getMinutes();
    if (d.getDay() === 0 || min < OPEN || min >= CLOSE) {
      return { tipo: "cerrado", label: "Disponible para reservar" };
    }
    return { tipo: "libre", label: "Libre ahora" };
  }

  const precioServicio = servicio && sedeId ? servicio.precios[sedeId] : null;
  // `!= null` (no `!== null`): precios[sedeId] es `undefined` (no null) cuando el
  // servicio no tiene precio en esa sede → antes daba `undefined + 0 = NaN`.
  const total = precioServicio != null ? precioServicio + (bebida && !bebidaIncluida ? bebida.precio : 0) : null;
  const bebidaTxt = bebida ? ` + ${bebida.nombre.toLowerCase()}${bebidaIncluida ? " (incluida)" : ""}` : "";

  // Nombre y correo obligatorios para habilitar "Confirmar" en el paso datos.
  // Con sesión Google no se piden: el server usa el email (y nombre) de la sesión.
  const emailValido = EMAIL_RE.test(email.trim());
  const datosValidos = sesion ? true : nombre.trim().length > 0 && emailValido;

  const paso = (ORDEN.indexOf(step as Exclude<Step, "ok">) + 1) as number;

  function irAtras() {
    const idx = ORDEN.indexOf(step as Exclude<Step, "ok">);
    if (idx > 0) setStep(ORDEN[idx - 1]);
    else router.push("/");
  }

  const puedeContinuar =
    step === "servicio"
      ? !!servicio
      : step === "horario"
        ? slot !== null
        : step === "datos"
          ? datosValidos
          : true;

  function avanzar() {
    if (!puedeContinuar) return;
    if (step === "servicio") {
      // Upsell de bebida entre paso 2 y 3, una sola vez por flujo (proto §6.9).
      // Solo si la sede tiene bebidas configuradas (en_upsell); si no, se salta.
      if (!upsellSeen && servicio && bebidasSede.length > 0) {
        const esComboBebida = servicio.nombre.toLowerCase().includes("bebida");
        if (esComboBebida && COMBO_ON) {
          setUpsellMode("combo");
          setUpsellSeen(true);
          return;
        }
        if (!esComboBebida && UPSELL_ON) {
          setUpsellMode("extra");
          setUpsellSeen(true);
          return;
        }
      }
      setStep("barbero");
      return;
    }
    if (step === "datos") {
      // Invitado: antes de confirmar, recomendar una vez entrar con Google (con
      // cuenta hay seguimiento de la cita y tarjeta de cortes; como invitado no).
      if (!sesion && !nudgeSeen) {
        setLoginNudge(true);
        return;
      }
      confirmar();
      return;
    }
    const idx = ORDEN.indexOf(step as Exclude<Step, "ok">);
    setStep(ORDEN[idx + 1]);
  }

  function elegirBebida(b: Bebida | null) {
    setBebida(b);
    setBebidaIncluida(upsellMode === "combo" && !!b);
    setUpsellMode(null);
    setStep("barbero");
  }

  // Login con Google desde el paso datos: guarda el snapshot del wizard y va al
  // OAuth; al volver a /reservar el effect de montaje restaura todo en el paso 5.
  async function loginGoogle() {
    if (!sedeId || !servicio || slot === null || !day) return;
    const snap = {
      t: Date.now(),
      sedeId,
      servicioId: servicio.id,
      barberoId: barbero?.id ?? null,
      dayISO: day.toISOString(),
      slot,
      bebida,
      bebidaIncluida,
      servicioFoto,
    };
    try {
      sessionStorage.setItem(RESUME_KEY, JSON.stringify(snap));
    } catch {}
    await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/reservar`,
        // Forzar el selector de cuenta: si no, Google reusa la última sesión y no
        // deja elegir/​cambiar de cuenta (importante para no reservar con la equivocada).
        queryParams: { prompt: "select_account" },
      },
    });
  }

  // "¿No sos vos?": cierra la sesión y vuelve al formulario de invitado. Desde ahí
  // se puede entrar con OTRA cuenta de Google (el botón fuerza el selector) o seguir
  // como invitado. Reseteo el nudge para que vuelva a ofrecer login si sigue de invitado.
  async function cambiarCuenta() {
    await supabaseBrowser().auth.signOut();
    setSesion(null);
    setNudgeSeen(false);
  }

  async function confirmar() {
    if (!servicio || !day || slot === null || !sedeId) return;
    // Defensa: el botón ya exige datos válidos, pero confirmar() es la puerta real.
    // (Con sesión Google el server usa el correo de la sesión: no se exige acá.)
    if (!sesion && (!nombre.trim() || !EMAIL_RE.test(email.trim()))) {
      setErrorMsg("Completá tu nombre y un correo válido para confirmar.");
      return;
    }
    // Resolver barbero: si el cliente no eligió, asignamos el primero libre en ese cupo.
    let elegido = barbero;
    if (!elegido) {
      elegido = sedeBarberos.find((b) => !(ocupadosDia[b.id] ?? []).some((o) => ocupaSlot(slot, dur, o))) ?? null;
      if (!elegido) {
        setErrorMsg("Ese horario ya fue tomado. Elegí otro, por favor.");
        setSlot(null);
        setStep("horario");
        return;
      }
    }
    setSaving(true);
    setErrorMsg(null);
    const inicio = new Date(day);
    inicio.setHours(Math.floor(slot / 60), slot % 60, 0, 0);
    // Upsell: la bebida extra (con cargo) se pierde si no viaja al barbero. La
    // mandamos como nota para que la vea en su agenda. La incluida en combo no
    // lleva nota (se sirve por el propio combo; no se cobra aparte).
    const nota = bebida && !bebidaIncluida ? `Bebida: ${bebida.nombre}` : undefined;
    const res = await createReserva({
      sede: sedeId,
      barberoId: elegido.id,
      servicioId: servicio.id,
      clienteNombre: (sesion ? sesion.nombre || nombre.trim() : nombre.trim()) || "Cliente",
      telefono: "",
      email: sesion ? sesion.email : email.trim(),
      inicioISO: inicio.toISOString(),
      nota,
    });
    setSaving(false);
    if (res.ok) {
      setBarbero(elegido);
      setStep("ok");
      return;
    }
    setErrorMsg(res.error ?? "No se pudo reservar");
    setSlot(null);
    setStep("horario");
  }

  // ---------------------------------------------------------------
  //  Pantalla de confirmación animada (proto §6.10)
  // ---------------------------------------------------------------
  if (step === "ok" && servicio && day && slot !== null) {
    return (
      <div
        className="flex min-h-dvh flex-col items-center justify-start overflow-y-auto px-6 py-12 text-center"
        style={{ background: "radial-gradient(90% 50% at 50% 0%, rgba(210,63,52,.12), transparent 60%)" }}
      >
        {/* Firma: logo "afeitado" por la máquina de cortar */}
        <div className="relative mx-auto mb-6 h-[145px] w-[160px]" style={{ animation: "bbglow 2.6s ease-in-out 1.5s infinite" }}>
          <Image
            src="/brand/logo-face-transparent.png"
            alt="Barbas & Bigotes"
            width={140}
            height={140}
            className="absolute left-1/2 top-1 h-[140px] w-[140px] -translate-x-1/2 object-contain"
            style={{ animation: "bbcut 1.4s ease-in-out .2s both, bbbuzz .07s linear .2s 20 alternate" }}
          />
          <div className="absolute z-[2]" style={{ left: "50%", marginLeft: "-14px", top: "-48px", animation: "bbclipper 1.4s ease-in-out .2s both" }}>
            <div style={{ transformOrigin: "center top", animation: "bbwob .09s linear .2s 16 alternate" }}>
              <div style={{ width: 28, height: 8, borderRadius: "2px 2px 0 0", background: "repeating-linear-gradient(90deg,#d8d2c7 0 2.5px, transparent 2.5px 6px)" }} />
              <div
                className="relative mx-auto"
                style={{ width: 23, height: 38, borderRadius: "5px 5px 11px 11px", background: "linear-gradient(180deg,#4a433b,#211d19)", border: "1px solid rgba(242,237,228,.3)", boxShadow: "0 6px 16px rgba(0,0,0,.5)" }}
              >
                <div className="absolute left-1/2 top-2" style={{ width: 5, height: 11, marginLeft: "-2.5px", borderRadius: 2, background: "#d23f34", boxShadow: "0 0 8px #d23f34" }} />
              </div>
            </div>
          </div>
        </div>

        <div className="w-full max-w-md">
          <span
            className="inline-block rounded-full border px-4 py-1.5 font-display text-xs font-extrabold uppercase tracking-[0.1em]"
            style={{ animation: "bbrise .5s ease-out .15s both", borderColor: "rgba(52,211,153,.4)", background: "rgba(52,211,153,.08)", color: "#34d399" }}
          >
            ✓ Reserva confirmada
          </span>

          <h2 className="mt-5 font-display text-[40px] font-extrabold uppercase leading-[0.95]" style={{ animation: "bbrise .5s ease-out .25s both" }}>
            ¡Listo,
            <br />
            te esperamos!
          </h2>

          <p className="mx-auto mt-3 max-w-[30ch] text-[13.5px] text-muted" style={{ animation: "bbrise .5s ease-out .35s both" }}>
            Ya quedó agendada, {nombre.trim() || "crack"}. Te enviamos el comprobante y el recordatorio al correo
            {email.trim() ? ` ${email.trim()}` : ""}. Sede {sedeNombre}.
          </p>

          <div className="mt-6 rounded-2xl border border-line bg-panel text-left" style={{ animation: "bbrise .5s ease-out .45s both" }}>
            <div className="flex items-center gap-3 border-b border-[rgba(242,237,228,0.07)] p-3.5">
              <div className="relative h-[46px] w-[46px] shrink-0 overflow-hidden rounded-[10px]">
                <Image src={servicioFoto} alt="" fill sizes="46px" className="object-cover" />
              </div>
              <div className="min-w-0">
                <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted">Servicio</div>
                <div className="truncate text-sm font-semibold text-ink">
                  {servicio.nombre}
                  {bebidaTxt}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 border-b border-[rgba(242,237,228,0.07)] p-3.5">
              <div className="relative h-[34px] w-[34px] shrink-0 overflow-hidden rounded-full">
                <Image src={barbero?.fotoUrl || "/barberos/generico.jpg"} alt="" fill sizes="34px" className="object-cover object-top" />
              </div>
              <div className="min-w-0">
                <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted">Barbero</div>
                <div className="truncate text-sm font-semibold text-ink">{barbero?.nombre ?? "Cualquier barbero"}</div>
              </div>
            </div>
            <div className="border-b border-[rgba(242,237,228,0.07)] p-3.5">
              <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted">Cuándo</div>
              <div className="text-sm font-semibold text-ink">
                {diaLabel(day)}, {fmtTime(slot)}
              </div>
            </div>
            <div className="flex items-end justify-between p-3.5">
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted">Total</div>
                <div className="text-[11px] text-muted">Lo pagás en la barbería.</div>
              </div>
              {total !== null && <div className="font-display text-[22px] font-extrabold tabular-nums text-accent-soft">{cop(total)}</div>}
            </div>
          </div>

          <div className="mt-6 flex gap-2.5" style={{ animation: "bbrise .5s ease-out .55s both" }}>
            <button
              onClick={() => router.push("/cuenta")}
              className="flex min-h-[50px] flex-[1.3] items-center justify-center rounded-2xl font-display text-[15px] font-extrabold uppercase tracking-wide text-on-accent"
              style={{ background: GRAD_CTA }}
            >
              Ver mi cuenta
            </button>
            <button
              onClick={() => router.push("/")}
              className="flex flex-1 items-center justify-center rounded-2xl border border-[rgba(242,237,228,0.16)] px-3 text-[13px] text-muted"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------
  //  App-shell del wizard: header + progreso + cuerpo scroll + footer sticky
  //  Ancho completo en desktop (pedido del dueño): sin el marco de 1152px del
  //  prototipo, que dejaba grandes márgenes negros y se veía compactado. El
  //  padding lateral md:px-14 da el aire; el mobile ya era full width.
  // ---------------------------------------------------------------
  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-bg">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] md:px-14">
        <button onClick={irAtras} aria-label="Atrás" className="text-[20px] leading-none text-muted transition hover:text-ink">
          ←
        </button>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[22px] font-extrabold uppercase leading-none">Reservá tu turno</div>
          <div className="mt-0.5 text-[11.5px] text-muted">
            Paso {paso} de 5 · {TITULOS[step as Exclude<Step, "ok">]}
          </div>
        </div>
        <div className="font-display text-[18px] font-extrabold tabular-nums text-accent-soft">{paso}/5</div>
      </header>

      {/* Barra de progreso */}
      <div className="shrink-0 px-4 pt-2 md:px-14">
        <div className="h-[3px] w-full overflow-hidden rounded-full bg-[rgba(242,237,228,0.08)]">
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${paso * 20}%`, background: "linear-gradient(90deg,#e8675c,#d23f34)" }} />
        </div>
      </div>

      {/* Cuerpo scrolleable */}
      {/* pb-10: el footer sticky del total tapaba el final del contenido al hacer
          scroll hasta abajo (se comía el cierre del resumen en mobile). */}
      <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-5 md:px-14 md:pt-7">
        {/* ---------- Paso 1 · Sede ---------- */}
        {step === "sede" && (
          <div>
            <h2 className="font-display text-[26px] font-extrabold uppercase leading-none">¿En qué sede?</h2>
            <p className="mt-1.5 text-xs text-muted">Las dos abren de lunes a sábado, 9 am – 8 pm.</p>
            <div className="mt-5 flex flex-col gap-3 md:grid md:grid-cols-[repeat(auto-fit,minmax(340px,1fr))] md:gap-4">
              {sedes.map((s) => {
                const sel = sedeId === s.id;
                const info = SEDE_INFO[s.id] ?? { detalle: s.direccion ?? "Barranquilla", frente: "/sedes/parque-venezuela-frente.jpg" };
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSedeId(s.id);
                      setBarbero(null);
                    }}
                    className="relative h-[130px] w-full overflow-hidden rounded-2xl text-left md:h-[300px]"
                    style={{ border: `2px solid ${sel ? "#d23f34" : "rgba(242,237,228,.12)"}` }}
                  >
                    <Image src={info.frente} alt={s.nombre} fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover" />
                    <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 25%, rgba(12,11,10,.88) 100%)" }} />
                    {sel && (
                      <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[12px] font-extrabold text-on-accent">✓</span>
                    )}
                    <div className="absolute inset-x-4 bottom-3.5">
                      <div className="font-display text-[23px] font-extrabold uppercase leading-none text-white">{s.nombre}</div>
                      <div className="mt-1 text-[11.5px] text-[#c9c2b6]">{info.detalle}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ---------- Paso 2 · Servicio ---------- */}
        {step === "servicio" && (
          <div>
            <h2 className="font-display text-[26px] font-extrabold uppercase leading-none">¿Qué servicio?</h2>
            <div className="mb-2 mt-5 text-[10px] font-bold uppercase tracking-[0.24em] text-accent-soft">Categorías</div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-[repeat(auto-fit,minmax(230px,1fr))]">
              {cats.map((cat) => {
                const activa = selectedCat === cat;
                const n = serviciosSede.filter((s) => s.categoria === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCat(cat)}
                    className="flex min-h-[44px] items-center justify-between gap-2 rounded-[10px] px-3 py-2.5"
                    style={{
                      background: "linear-gradient(90deg,#211d19,#151311)",
                      border: `1px solid ${activa ? "rgba(210,63,52,.75)" : "rgba(242,237,228,.14)"}`,
                    }}
                  >
                    <span className={`font-display text-[14px] font-bold uppercase leading-none ${activa ? "text-ink" : "text-muted"}`}>{categorias[cat]}</span>
                    <span className="shrink-0 text-[10px] text-accent-soft">{n}</span>
                  </button>
                );
              })}
            </div>

            <div className="mb-3 mt-6 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-accent-soft">Servicios disponibles</span>
              <span className="text-[11px] text-muted">{serviciosSede.filter((s) => s.categoria === selectedCat).length} opciones</span>
            </div>

            <div className="grid grid-cols-2 gap-[9px] md:grid-cols-[repeat(auto-fill,minmax(160px,190px))] md:justify-center md:gap-3">
              {serviciosSede
                .filter((s) => s.categoria === selectedCat)
                .map((s, i) => {
                  const sel = servicio?.id === s.id;
                  const foto = SERV_FOTOS[i % SERV_FOTOS.length];
                  const precio = sedeId ? s.precios[sedeId] : s.precios["parque-venezuela"];
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setServicio(s);
                        setServicioFoto(foto);
                        setSlot(null);
                        // Reset del upsell: si venías de un combo con bebida incluida y
                        // cambiás a otro servicio, no arrastres la bebida (se regalaba
                        // gratis) y re-evaluá el upsell con el servicio nuevo.
                        setBebida(null);
                        setBebidaIncluida(false);
                        setUpsellSeen(false);
                      }}
                      className="flex flex-col overflow-hidden rounded-xl text-left"
                      style={{ border: `2px solid ${sel ? "#d23f34" : "rgba(242,237,228,.1)"}` }}
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-elevated md:aspect-[3/2]">
                        <Image src={foto} alt="" fill sizes="(max-width:768px) 50vw, 240px" className="object-cover" />
                        <span
                          className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-[5px] px-2 py-0.5 font-display text-[11px] font-extrabold text-white"
                          style={{ background: "rgba(5,4,3,.85)" }}
                        >
                          <RelojIcon />
                          {durBadge(s.duracionMin)}
                        </span>
                        {sel && (
                          <span className="absolute right-1.5 top-1.5 flex h-[21px] w-[21px] items-center justify-center rounded-full bg-accent text-[11px] font-extrabold text-on-accent">✓</span>
                        )}
                      </div>
                      <div className="px-2.5 pb-1 pt-2.5">
                        <div className="min-h-[34px] text-[12.5px] font-bold leading-tight text-ink">{s.nombre}</div>
                      </div>
                      <div className="mt-auto flex items-center justify-between border-t border-[rgba(242,237,228,0.07)] px-2.5 py-2">
                        <span className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-muted">Precio</span>
                        <span className="font-display text-[17px] font-extrabold tabular-nums text-accent-soft">{precio != null ? cop(precio) : "—"}</span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* ---------- Paso 3 · Barbero ---------- */}
        {step === "barbero" && (
          <div>
            <h2 className="font-display text-[26px] font-extrabold uppercase leading-none">Elegí tu barbero</h2>
            <p className="mt-1.5 text-xs text-muted">{sedeNombre} · o seguí sin elegir y te asignamos uno.</p>
            {sedeBarberos.length ? (
              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fit,minmax(190px,240px))] md:justify-center">
                {sedeBarberos.map((b) => {
                  const sel = barbero?.id === b.id;
                  const ausente = ausenteSet.has(b.id);
                  const est = estadoBarbero(b.id);
                  // Ausente pisa el estado en vivo: no está trabajando ese día.
                  const chipColor = ausente ? "#fbbf24" : est.tipo === "silla" ? "#e8675c" : est.tipo === "cerrado" ? "#9c958a" : "#34d399";
                  const chipBorder = ausente ? "rgba(251,191,36,.4)" : est.tipo === "silla" ? "rgba(210,63,52,.45)" : est.tipo === "cerrado" ? "rgba(242,237,228,.16)" : "rgba(52,211,153,.4)";
                  const estadoLabel = ausente ? (day ? "Ausente ese día" : "Ausente hoy") : est.label;
                  // Misma estructura que la card de /barberos: foto arriba (B/N → color
                  // al seleccionar/hover), barra accent y cuerpo con rating + chips.
                  return (
                    <button
                      key={b.id}
                      onClick={() => setBarbero(sel ? null : b)}
                      className={`group flex flex-col overflow-hidden rounded-[18px] border bg-panel text-left transition duration-200 hover:-translate-y-1 ${
                        sel ? "border-accent" : "border-line hover:border-accent/40"
                      }`}
                    >
                      <div className="relative aspect-[4/4.4] bg-[linear-gradient(165deg,#262019,#0b0a09)]">
                        <Image
                          src={b.fotoUrl || "/barberos/generico.jpg"}
                          alt={b.nombre}
                          fill
                          sizes="(max-width:768px) 50vw, 33vw"
                          className={`object-cover object-top transition-[filter] duration-500 group-hover:grayscale-0 ${sel ? "grayscale-0" : "grayscale"}`}
                        />
                        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,transparent 45%,rgba(0,0,0,.85))" }} />
                        {b.destacado && (
                          <span className="absolute left-2.5 top-2.5 rounded-full bg-accent px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.08em] text-on-accent">★ TOP</span>
                        )}
                        {sel && (
                          <span className="absolute right-2.5 top-2.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-accent text-[11px] font-extrabold text-on-accent">✓</span>
                        )}
                        <div className="absolute inset-x-3 bottom-2.5">
                          <div className="font-display text-[21px] font-extrabold uppercase leading-none text-white">{b.nombre}</div>
                        </div>
                      </div>

                      <div className="h-0.5 w-full bg-accent/70" />

                      <div className="flex flex-1 flex-col px-3 py-3">
                        <div className="flex items-center gap-1.5 text-[11.5px]">
                          <span className="tracking-[1px] text-accent">★★★★★</span>
                          {b.rating != null && <b className="text-ink">{b.rating.toFixed(1)}</b>}
                          {b.resenas ? <span className="text-muted">· {b.resenas}</span> : null}
                        </div>

                        {b.especialidades.length > 0 && (
                          <>
                            <div className="mb-1.5 mt-2.5 text-[9px] uppercase tracking-[0.18em] text-muted">Especialista en</div>
                            <div className="flex flex-wrap gap-1">
                              {b.especialidades.slice(0, 4).map((e) => (
                                <span key={e} className="rounded-full border border-line bg-white/[0.04] px-2 py-0.5 text-[10px] text-ink/85">{e}</span>
                              ))}
                            </div>
                          </>
                        )}

                        <span
                          className="mt-2.5 inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                          style={{ borderColor: chipBorder, background: "rgba(5,4,3,.35)", color: chipColor }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: chipColor }} />
                          {estadoLabel}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-5 rounded-xl border border-line bg-panel px-4 py-3 text-sm text-muted">Esta sede no tiene barberos cargados todavía.</p>
            )}
          </div>
        )}

        {/* ---------- Paso 4 · Día y hora ---------- */}
        {step === "horario" && servicio && (
          <div>
            <h2 className="font-display text-[26px] font-extrabold uppercase leading-none">¿Cuándo pasás?</h2>

            {errorMsg && (
              <div className="mt-4 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent-soft">{errorMsg}</div>
            )}

            <div className="mt-5 md:grid md:grid-cols-[320px_1fr] md:gap-6">
              {/* Selector de día */}
              <div className="md:rounded-2xl md:border md:border-line md:bg-panel md:p-4">
                <div className="mb-2 hidden text-[10px] font-bold uppercase tracking-[0.24em] text-accent-soft md:block">Elegí el día</div>
                <div className="grid grid-cols-3 gap-2 md:grid-cols-1">
                  {dias.map((d) => {
                    const activa = day ? mismoDia(day, d) : false;
                    const hoy = new Date();
                    const man = new Date();
                    man.setDate(hoy.getDate() + 1);
                    const main = mismoDia(d, hoy) ? "Hoy" : mismoDia(d, man) ? "Mañana" : `${DOW[d.getDay()]} ${d.getDate()}`;
                    const sub = `${DOW[d.getDay()].toLowerCase()} ${d.getDate()} ${MON[d.getMonth()]}`;
                    return (
                      <button
                        key={d.toISOString()}
                        onClick={() => {
                          setDay(d);
                          setSlot(null);
                          setErrorMsg(null);
                        }}
                        className="flex items-center justify-center rounded-xl px-2 py-2.5 md:justify-between md:px-3.5"
                        style={
                          activa
                            ? { background: GRAD_CTA, border: "1px solid rgba(232,103,92,.9)", color: "#fbf7f0", boxShadow: "0 10px 22px -8px rgba(210,63,52,.65)" }
                            : { background: "linear-gradient(180deg,#211d19,#151311)", border: "1px solid rgba(242,237,228,.1)", color: "#f2ede4" }
                        }
                      >
                        <div className="flex flex-col items-center md:items-start">
                          <span className="font-display text-[15px] font-extrabold uppercase leading-none">{main}</span>
                          <span className="mt-0.5 text-[10px]" style={{ color: activa ? "rgba(251,247,240,.85)" : "#9c958a" }}>
                            {sub}
                          </span>
                        </div>
                        <span className="hidden text-lg leading-none md:block" style={{ color: activa ? "rgba(251,247,240,.85)" : "#9c958a" }}>
                          ›
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 hidden text-[11px] leading-relaxed text-muted md:block">
                  Horario de la sede: 9:00 am – 8:00 pm.
                  <br />
                  Domingos cerrado.
                </p>
              </div>

              {/* Slots */}
              <div className="mt-6 md:mt-0">
                {!day ? (
                  <p className="text-sm text-muted">Elegí un día para ver los horarios.</p>
                ) : cargandoSlots ? (
                  <div className="grid grid-cols-3 gap-2 md:grid-cols-[repeat(auto-fill,minmax(110px,1fr))]">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="h-[54px] animate-pulse rounded-[13px] border border-line/50 bg-panel md:h-[50px]" />
                    ))}
                  </div>
                ) : sinCupos ? (
                  <p className="rounded-xl border border-line bg-panel px-4 py-3 text-sm text-muted">
                    No quedan horarios disponibles este día. Probá con otra fecha.
                  </p>
                ) : (
                  <div className="space-y-5">
                    {/* Leyenda: explica la tijera sin que nadie tenga que adivinar,
                        y de paso dice cuántos turnos ya se tomaron ese día. */}
                    {tomadosHoy > 0 && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-panel px-3.5 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted">
                          <span
                            aria-hidden
                            className="grid h-[20px] w-[20px] place-items-center rounded-full"
                            style={{ background: "#2a1d1b", border: "1px solid rgba(232,103,92,.5)" }}
                          >
                            <ScissorsIcon className="h-[11px] w-[11px] text-accent-soft" />
                          </span>
                          <b className="font-semibold text-ink">{tomadosHoy}</b>
                          {tomadosHoy === 1 ? " turno ya tomado" : " turnos ya tomados"}
                        </span>
                        {proximoLibre !== null && (
                          <span className="text-[11.5px] text-muted">
                            Próximo libre: <b className="font-semibold text-accent-soft">{fmtTime(proximoLibre)}</b>
                          </span>
                        )}
                      </div>
                    )}
                    {(
                      [
                        // NADA se oculta: la agenda del día se muestra completa. Los
                        // turnos tomados van tachados con tijera (prueba social: el
                        // cliente ve que al barbero le están reservando) y los que ya
                        // pasaron quedan atenuados. El próximo libre destaca.
                        ["Mañana", slots.filter((t) => t < 720)],
                        ["Tarde", slots.filter((t) => t >= 720)],
                      ] as const
                    ).map(([label, lista]) =>
                      lista.length ? (
                        <div key={label}>
                          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{label}</div>
                          <div className="grid grid-cols-3 gap-2 md:grid-cols-[repeat(auto-fill,minmax(110px,1fr))]">
                            {lista.map((t) => {
                              const ocupado = ocupadoSet.has(t);
                              const pasado = pasadoSet.has(t);
                              const deshab = ocupado || pasado;
                              const activo = slot === t;
                              // "Tomado" = reservado por alguien. Se muestra tachado con
                              // tijera aunque ya haya pasado: es la prueba de que el
                              // barbero tuvo turnos ese día.
                              const tomado = ocupado;
                              const esProximo = t === proximoLibre && !activo;
                              return (
                                <button
                                  key={t}
                                  disabled={deshab}
                                  aria-label={
                                    tomado ? `${fmtTime(t)}, turno tomado` : pasado ? `${fmtTime(t)}, ya pasó` : fmtTime(t)
                                  }
                                  onClick={() => {
                                    setSlot(t);
                                    setErrorMsg(null);
                                  }}
                                  className="relative flex min-h-[54px] items-center justify-center rounded-[13px] font-display text-[18px] font-extrabold tabular-nums transition md:min-h-[50px] md:rounded-xl md:text-[17px]"
                                  style={
                                    activo
                                      ? { background: GRAD_CTA, border: "1px solid rgba(232,103,92,.9)", color: "#fbf7f0", boxShadow: "0 10px 22px -8px rgba(210,63,52,.65)" }
                                      : tomado
                                        ? {
                                            // Tomado: se lee, pero tachado. Un pelín más
                                            // presente que un hueco vacío, porque es la
                                            // señal de demanda.
                                            background: "rgba(210,63,52,.06)",
                                            border: "1px solid rgba(210,63,52,.16)",
                                            color: "rgba(156,149,138,.75)",
                                            textDecoration: "line-through",
                                            textDecorationColor: "rgba(232,103,92,.7)",
                                            textDecorationThickness: "2px",
                                          }
                                        : pasado
                                          ? { background: "transparent", border: "1px solid rgba(242,237,228,.05)", color: "rgba(156,149,138,.32)" }
                                          : esProximo
                                            ? {
                                                background: "linear-gradient(180deg,#2a231d,#171412)",
                                                border: "1px solid rgba(232,103,92,.55)",
                                                color: "#f2ede4",
                                                boxShadow: "0 0 0 3px rgba(210,63,52,.12)",
                                              }
                                            : { background: "linear-gradient(180deg,#211d19,#151311)", border: "1px solid rgba(242,237,228,.1)", color: "#f2ede4" }
                                  }
                                >
                                  {fmtTime(t)}
                                  {tomado && (
                                    <span
                                      aria-hidden
                                      className="absolute -right-1.5 -top-1.5 grid h-[20px] w-[20px] place-items-center rounded-full"
                                      style={{ background: "#2a1d1b", border: "1px solid rgba(232,103,92,.5)" }}
                                    >
                                      <ScissorsIcon className="h-[11px] w-[11px] text-accent-soft" />
                                    </span>
                                  )}
                                  {esProximo && (
                                    <span
                                      aria-hidden
                                      className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-[1px] text-[8.5px] font-bold uppercase tracking-[0.1em]"
                                      style={{ background: "#d23f34", color: "#fbf7f0" }}
                                    >
                                      Próximo
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null,
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---------- Paso 5 · Datos ---------- */}
        {step === "datos" && servicio && day && slot !== null && (
          // Ancho tope + centrado: a pantalla completa los campos se estiraban a
          // todo lo ancho y el paso se veía vacío. En desktop va a dos columnas
          // (formulario | resumen), en mobile apilado.
          <div className="mx-auto w-full max-w-[980px]">
            <h2 className="font-display text-[26px] font-extrabold uppercase leading-none">Tus datos</h2>
            <p className="mt-1.5 text-xs text-muted">Último paso: te llega la confirmación al correo.</p>

            <div className="mt-6 grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_340px] md:gap-7">
              {/* ---- Columna izquierda: identificación ---- */}
              <div>
                {sesion ? (
                  <div className="flex flex-col gap-3">
                    {/* Cliente logueado: la reserva queda en su cuenta, sin re-tipear datos. */}
                    <div className="rounded-[18px] border border-accent/35 bg-panel p-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink">
                          <GoogleG />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-ink">
                            {sesion.nombre || sesion.email}
                          </div>
                          <div className="truncate text-xs text-muted">{sesion.email}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                        <span className="text-[11.5px] text-muted">La confirmación llega a este correo.</span>
                        <button
                          type="button"
                          onClick={cambiarCuenta}
                          className="shrink-0 whitespace-nowrap text-xs font-semibold text-accent-soft underline decoration-line underline-offset-4 transition hover:text-accent"
                        >
                          ¿No sos vos?
                        </button>
                      </div>
                    </div>
                    {!sesion.nombre && (
                      <label className="block">
                        <span className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted">
                          Tu nombre
                        </span>
                        <input
                          value={nombre}
                          onChange={(e) => setNombre(e.target.value)}
                          placeholder="Como querés que te llamemos"
                          className="w-full rounded-xl border border-line bg-panel px-3.5 py-3 text-sm text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none"
                        />
                      </label>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <label className="block">
                      <span className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted">
                        Tu nombre
                      </span>
                      <input
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        placeholder="Como querés que te llamemos"
                        className="w-full rounded-xl border border-line bg-panel px-3.5 py-3 text-sm text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted">
                        Tu correo
                      </span>
                      <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email"
                        inputMode="email"
                        placeholder="nombre@correo.com"
                        aria-invalid={email.trim().length > 0 && !emailValido}
                        className={`w-full rounded-xl border bg-panel px-3.5 py-3 text-sm text-ink placeholder:text-muted/70 focus:outline-none ${
                          email.trim().length > 0 && !emailValido
                            ? "border-accent/60 focus:border-accent"
                            : "border-line focus:border-accent"
                        }`}
                      />
                      <span className="mt-1.5 block text-[11px] text-muted">
                        {email.trim().length > 0 && !emailValido
                          ? "Revisá el correo: falta el @ o el dominio."
                          : "Ahí te mandamos la confirmación y el recordatorio."}
                      </span>
                    </label>

                    {/* Como invitado (arriba) o con la cuenta Google del cliente. Si ya
                        empezó a escribir como invitado, el bloque de Google se achica a
                        una línea para que no parezca un paso pendiente. */}
                    {nombre.trim().length > 0 || email.trim().length > 0 ? (
                      <button
                        type="button"
                        onClick={loginGoogle}
                        className="py-1 text-center text-[11.5px] text-muted underline decoration-line underline-offset-4 transition hover:text-ink"
                      >
                        ¿Preferís continuar con Google? Queda en tu cuenta y sumás tarjeta
                      </button>
                    ) : (
                      <>
                        {/* Sin font-display ni tracking: una sola "o" condensada y
                            espaciada se leía como un "0". */}
                        <div className="flex items-center gap-3 py-0.5" aria-hidden>
                          <span className="h-px flex-1 bg-line" />
                          <span className="text-[11px] font-semibold lowercase text-muted">o bien</span>
                          <span className="h-px flex-1 bg-line" />
                        </div>
                        <button
                          type="button"
                          onClick={loginGoogle}
                          className="flex w-full items-center justify-center gap-3 rounded-xl bg-ink py-3.5 text-sm font-semibold text-bg transition hover:bg-white"
                        >
                          <GoogleG /> Continuar con Google
                        </button>
                        <p className="text-center text-[11px] leading-relaxed text-muted">
                          Con tu cuenta la reserva queda en Mi cuenta y sumás en tu tarjeta de cortes.
                        </p>
                      </>
                    )}
                  </div>
                )}

                {errorMsg && (
                  <div className="mt-4 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent-soft">
                    {errorMsg}
                  </div>
                )}
              </div>

              {/* ---- Columna derecha: resumen de la reserva ---- */}
              <aside className="overflow-hidden rounded-[18px] border border-line bg-panel">
                <div className="border-b border-line/70 px-4 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-soft">Tu reserva</div>
                </div>

                {/* Barbero con foto: el mismo anclaje visual de los otros pasos. */}
                <div className="flex items-center gap-3 px-4 py-3.5">
                  {barbero?.fotoUrl ? (
                    <Image
                      src={barbero.fotoUrl}
                      alt={barbero.nombre}
                      width={48}
                      height={48}
                      className="h-12 w-12 shrink-0 rounded-full object-cover object-top ring-2 ring-accent/40"
                    />
                  ) : (
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-elevated font-display text-lg font-bold text-accent-soft ring-2 ring-line">
                      ✂
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Barbero</div>
                    <div className="truncate font-display text-[19px] font-bold uppercase leading-tight text-ink">
                      {barbero?.nombre ?? "Cualquier barbero"}
                    </div>
                  </div>
                </div>

                {/* La HORA es el ancla del resumen: es el dato que el cliente
                    viene a confirmar. Como fila suelta se perdía entre servicio
                    y sede; acá va en grande, con la franja accent al borde. */}
                <div className="relative overflow-hidden border-t border-line/70 bg-accent/[0.07] px-4 py-3.5">
                  <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-accent" />
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent-soft">
                    {diaLabel(day)}
                    {diaLabel(day) === "Hoy" || diaLabel(day) === "Mañana"
                      ? ` · ${DOW[day.getDay()].toLowerCase()} ${day.getDate()} ${MON[day.getMonth()]}`
                      : ""}
                  </div>
                  <div className="mt-1 font-display text-[34px] font-extrabold leading-none tabular-nums text-ink">
                    {fmtTime(slot)}
                  </div>
                  {servicio.duracionMin != null && (
                    <div className="mt-1 text-[11.5px] text-muted">
                      Dura {durBadge(servicio.duracionMin).toLowerCase()} aprox.
                    </div>
                  )}
                </div>

                <div className="space-y-2.5 border-t border-line/70 px-4 py-3.5">
                  <ResumenRow k="Servicio" v={`${servicio.nombre}${bebidaTxt}`} />
                  <ResumenRow k="Sede" v={sedeNombre} />
                </div>

                {/* Total, alineado con lo que muestra el footer sticky. */}
                {total !== null && (
                  <div className="flex items-baseline justify-between gap-3 border-t border-line bg-elevated/40 px-4 py-3.5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Total</span>
                    <span className="font-display text-[26px] font-extrabold leading-none tabular-nums text-ink">
                      {cop(total)}
                    </span>
                  </div>
                )}

                <p className="px-4 pb-4 pt-3 text-[11px] leading-relaxed text-muted">
                  Se paga en la barbería. Podés cancelar o reagendar hasta 2 horas antes.
                </p>
              </aside>
            </div>
          </div>
        )}
      </main>

      {/* Footer sticky de resumen/total */}
      <footer
        className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-3 md:px-14"
        style={{ background: "rgba(12,11,10,.95)", backdropFilter: "blur(10px)" }}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] text-muted">
            {servicio ? `${servicio.nombre}${bebidaTxt} · ${barbero ? barbero.nombre : "Cualquier barbero"}${day && slot !== null ? ` · ${diaLabel(day)} ${fmtTime(slot)}` : ""}` : "Elegí un servicio y una hora"}
          </div>
          <div className="font-display text-[24px] font-extrabold tabular-nums leading-none text-ink">{total !== null ? cop(total) : "—"}</div>
        </div>
        <button
          onClick={avanzar}
          disabled={!puedeContinuar || saving}
          className="shrink-0 rounded-2xl px-6 py-3.5 font-display text-[16px] font-bold uppercase tracking-[0.05em] text-on-accent transition disabled:cursor-not-allowed"
          style={{ background: GRAD_CTA, boxShadow: "0 12px 26px -10px rgba(210,63,52,.7)", opacity: !puedeContinuar || saving ? 0.4 : 1 }}
        >
          {step === "datos" ? (saving ? "Confirmando…" : "Confirmar") : "Continuar"}
        </button>
      </footer>

      {/* Nudge de Google antes de confirmar como invitado (bottom sheet) */}
      {loginNudge && (
        <div className="fixed inset-0 z-[10] flex flex-col justify-end" style={{ background: "rgba(5,4,3,.7)", backdropFilter: "blur(2px)" }} onClick={() => setLoginNudge(false)}>
          <div className="w-full px-0" onClick={(e) => e.stopPropagation()}>
            <div className="rounded-t-[22px] border-t border-line px-5 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-5 md:mx-auto md:max-w-md md:rounded-[22px] md:border" style={{ background: "#0c0b0a" }}>
              <div className="mx-auto mb-4 h-1 w-[38px] rounded-full md:hidden" style={{ background: "rgba(242,237,228,.18)" }} />
              <h3 className="text-center font-display text-[23px] font-extrabold uppercase leading-tight">¿Querés seguirle el rastro a tu cita?</h3>
              <p className="mx-auto mt-2 max-w-[34ch] text-center text-[13px] leading-relaxed text-muted">
                Si entrás con Google, la reserva queda en <b className="text-ink">Mi cuenta</b>: ves tu lugar en la fila, te avisamos si se libera un cupo antes y sumás en tu <b className="text-ink">tarjeta de cortes</b>. Como invitado no hay forma de hacer seguimiento.
              </p>
              <button
                type="button"
                onClick={loginGoogle}
                className="mt-5 flex w-full items-center justify-center gap-3 rounded-xl bg-ink py-3 text-sm font-semibold text-bg transition hover:bg-white"
              >
                <GoogleG /> Continuar con Google
              </button>
              <button
                type="button"
                onClick={() => {
                  setNudgeSeen(true);
                  setLoginNudge(false);
                  confirmar();
                }}
                className="mt-2.5 min-h-[46px] w-full rounded-xl border border-line text-[13px] font-semibold text-muted transition hover:text-ink"
              >
                Reservar como invitado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upsell de bebida (bottom sheet) */}
      {upsellMode && (
        <div className="fixed inset-0 z-[9] flex flex-col justify-end" style={{ background: "rgba(5,4,3,.65)", backdropFilter: "blur(2px)" }} onClick={() => elegirBebida(null)}>
          <div
            className="w-full px-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-t-[22px] border-t border-line px-4 pb-[calc(env(safe-area-inset-bottom)+30px)] pt-5 md:px-14" style={{ background: "#0c0b0a" }}>
              <div className="mx-auto mb-4 h-1 w-[38px] rounded-full" style={{ background: "rgba(242,237,228,.18)" }} />
              <h3 className="text-center font-display text-[24px] font-extrabold uppercase leading-tight">
                {upsellMode === "combo" ? UPSELL_COMBO.titulo : UPSELL_EXTRA.titulo}
              </h3>
              <p className="mt-1 text-center text-xs text-muted">{upsellMode === "combo" ? UPSELL_COMBO.sub : UPSELL_EXTRA.sub}</p>

              <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-[repeat(auto-fit,minmax(230px,1fr))]">
                {bebidasSede.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => elegirBebida(b)}
                    className="flex min-h-[54px] items-center justify-between rounded-[13px] border border-line px-3.5"
                    style={{ background: "linear-gradient(180deg,#211d19,#151311)" }}
                  >
                    <span className="text-[13.5px] font-bold text-ink">{b.nombre}</span>
                    {upsellMode === "combo" ? (
                      <span className="font-display text-[16px] font-extrabold" style={{ color: "#34d399" }}>Incluida</span>
                    ) : (
                      <span className="font-display text-[16px] font-extrabold tabular-nums text-accent-soft">+{cop(b.precio).replace(/\s/g, "")}</span>
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={() => elegirBebida(null)}
                className="mt-3 min-h-[46px] w-full rounded-xl border border-line text-[13px] font-semibold text-muted"
              >
                {upsellMode === "combo" ? UPSELL_COMBO.rechazo : UPSELL_EXTRA.rechazo}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResumenRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <span className="shrink-0 text-[12.5px] text-muted">{k}</span>
      <span className="text-right text-[12.5px] font-semibold text-ink">{v}</span>
    </div>
  );
}

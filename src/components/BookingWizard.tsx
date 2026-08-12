"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { categorias } from "@/lib/data/seed";
import { createReserva, getDisponibilidad } from "@/lib/actions";
import { cancelarReservaReciente } from "@/lib/cliente-actions";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Sede, SedeId, Servicio, Barbero, Categoria } from "@/lib/data/types";
import type { BebidaUpsell, Ausencia, DiaEspecial, HorarioSemanal } from "@/lib/data/queries";
import { cop } from "@/lib/format";
import { ScissorsIcon } from "@/components/icons";
import { DOW, MON, STEP, OPEN, CLOSE, fmtTime, buildSlots, horarioEfectivo, instanteBogota, type VentanaDia } from "@/lib/slots";

// YYYY-MM-DD de un Date por sus componentes LOCALES (mismo criterio con que se
// rotulan los chips de día); horarioEfectivo lo re-ancla a mediodía UTC para el dow.
const ymdLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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

// Detalle + fachada de fábrica por sede: compartido con el admin (FotoSede)
// para que la tarjeta de allá muestre LO MISMO que ve el cliente acá.
import { SEDE_INFO } from "@/lib/data/sede-info";

// Fotos de servicio: SOLO la foto real subida por el admin (0055). Antes se
// ciclaban 4 fotos genéricas por índice y a "Cejas" le tocaba un corte: parecía
// un error y confundía justo al elegir. Sin foto → placeholder neutro.

// Copy default del upsell (proto §6.9; sin fuente admin, usamos el del prototipo).
const UPSELL_EXTRA = { titulo: "¿Le sumas una bebida a tu corte?", sub: "Te la sirven apenas te sientas en la silla.", rechazo: "No, gracias" };
const UPSELL_COMBO = { titulo: "Tu combo incluye bebida. ¿Cuál quieres?", sub: "Va incluida en el precio del combo.", rechazo: "Sin bebida" };
// Reglas admin (upsellOn/comboOn) — no hay tabla de config; ambos activos por defecto.
const UPSELL_ON = true;
const COMBO_ON = true;

const GRAD_CTA = "linear-gradient(180deg,#e8675c,#d23f34)";

// Correo obligatorio: el copy del paso datos promete "Te llega la confirmación al
// correo", así que es el canal real de contacto. Regex simple (no RFC completo).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// El OAuth de Google recarga la página y el estado del wizard vive en React:
// antes del redirect se guarda un snapshot en sessionStorage y al volver se
// restaura. El MISMO snapshot se reescribe en cada cambio de paso, así un F5 o
// el Atrás del navegador a mitad del wizard tampoco pierden lo elegido.
const RESUME_KEY = "bb-reserva-reanudar";
// La CONFIRMACIÓN también sobrevive a un reload: un deploy en caliente (Next
// recarga la página por "version skew" de los server actions), la actualización
// del PWA o un F5 justo después de confirmar borraban la pantalla "¡Listo!" —
// la reserva SÍ existía pero el cliente no veía nada y podía reservar DOBLE.
// Cazado en el E2E del 12-ago. Sin PII (nombre/correo no se guardan).
const OK_KEY = "bb-reserva-lista";
const OK_TTL_MS = 15 * 60000;
// Vale 30 min: cubre el redirect de Google y un refresco/Atrás a mitad del wizard.
const RESUME_TTL_MS = 30 * 60000;

// Marca que dejamos en history.state para saber qué paso corresponde a cada
// entrada del historial (ver el bloque "Atrás del teléfono" más abajo).
const HIST_MARCA = "bbPaso";

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
  diasEspeciales,
  horarioSemanal,
  initialBarberoId,
  initialSedeId,
}: {
  sedes: Sede[];
  barberos: Barbero[];
  servicios: Servicio[];
  bebidas: BebidaUpsell[];
  ausencias: Ausencia[];
  diasEspeciales: DiaEspecial[];
  horarioSemanal: HorarioSemanal[];
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
  const pasoInicial: Exclude<Step, "ok"> = initialBarbero || initialSedeId ? "servicio" : "sede";
  const [step, setStep] = useState<Step>(pasoInicial);
  // Deshacer desde la confirmación: el confirm_token que devuelve createReserva es
  // la credencial para cancelar la reserva recién hecha (dato mal cargado).
  const [reservaToken, setReservaToken] = useState<string | null>(null);
  const [cancelada, setCancelada] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [sedeId, setSedeId] = useState<SedeId | null>(sedeDefault);
  const [servicio, setServicio] = useState<Servicio | null>(null);
  const [servicioFoto, setServicioFoto] = useState<string>("");
  // Arranca en la primera categoría CON servicios de la sede (antes era siempre
  // 'cortes': si la sede no tenía cortes, la grilla quedaba vacía sin aviso).
  const [selectedCat, setSelectedCat] = useState<Categoria>(() => {
    const conServicios = (Object.keys(categorias) as Categoria[]).filter((c) =>
      servicios.some((s) => s.categoria === c && (sedeDefault ? s.precios[sedeDefault] != null : true)),
    );
    return conServicios.includes("cortes") ? "cortes" : (conServicios[0] ?? "cortes");
  });
  const [barbero, setBarbero] = useState<Barbero | null>(initialBarbero);
  // "Cualquier barbero" explícito: distingue "aún no eligió nada" (ninguna
  // tarjeta marcada) de "eligió que le asignemos el primero libre" (la tarjeta
  // Cualquiera marcada). Antes la única pista era una frase del subtítulo.
  const [cualquierBarbero, setCualquierBarbero] = useState(false);
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
  const [sesion, setSesion] = useState<{ nombre: string; email: string; foto: string | null } | null>(null);
  // "Ahora" estable por montaje: evita llamar Date.now() en render (regla de pureza
  // del React Compiler). El estado en vivo del barbero se refresca con statusHoy.
  const [ahora] = useState(() => Date.now());
  // El cuerpo scrollea por dentro (<main overflow-y-auto>), no la ventana, y es el
  // MISMO nodo en los 5 pasos: al cambiar de paso conserva el scroll anterior.
  // Avanzando casi no se nota (el paso siguiente suele ser más corto y el navegador
  // lo recorta), pero al VOLVER por un error el paso 4 sí tiene alto de sobra: el
  // aviso "Ese horario ya fue tomado" quedaba renderizado debajo del header y el
  // cliente veía los horarios otra vez sin saber por qué. Medido: 127px de scroll
  // heredado, aviso en y=15, header hasta y=69.
  const cuerpoRef = useRef<HTMLElement>(null);
  // --- Atrás del teléfono (gesto desde el borde en Android) -------------
  // Es la navegación más usada del celular y hasta acá sacaba al cliente de
  // /reservar entero: perdía sede, servicio, barbero y día, y volvía a empezar.
  // Cada paso que avanza apila UNA entrada de historial marcada con su índice,
  // así el Atrás retrocede de a un paso y el Adelante lo rehace.
  const pasoRef = useRef<Step>(pasoInicial);
  // Piso: el paso de la entrada original de /reservar. Atrás desde ahí SÍ sale
  // del wizard — si no, el cliente queda atrapado sin salida.
  const pisoRef = useRef(ORDEN.indexOf(pasoInicial));
  // Paso marcado en la entrada de historial actual.
  const marcaRef = useRef(ORDEN.indexOf(pasoInicial));
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
  // Servicios de la categoría activa (para el contador, la grilla y el vacío).
  const serviciosCat = useMemo(
    () => serviciosSede.filter((s) => s.categoria === selectedCat),
    [serviciosSede, selectedCat],
  );
  // Si la sede activa no tiene servicios en la categoría elegida (cambio de
  // sede o rehidratación), saltar a la primera categoría con servicios.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- realinear la categoría al cambiar de sede (no cascada real)
    if (cats.length && !cats.includes(selectedCat)) setSelectedCat(cats[0]);
  }, [cats, selectedCat]);
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

  // Horario de la sede activa, partido en base semanal + excepciones de fecha.
  // horarioEfectivo (misma función que valida el server) resuelve la cascada:
  // excepción del día → base de ese día de semana → respaldo 9-20 / domingo cerrado.
  const semanalSede = useMemo(() => horarioSemanal.filter((h) => h.sede === sedeId), [horarioSemanal, sedeId]);
  const especialesSede = useMemo(() => diasEspeciales.filter((e) => e.sede === sedeId), [diasEspeciales, sedeId]);

  // Días disponibles: próximos días que la sede ABRE (según su horario efectivo).
  // El dueño puede cerrar un día fijo de la semana, abrir un domingo o cambiar un
  // festivo desde el admin; acá se refleja tal cual. Depende de la sede porque una
  // puede abrir y la otra no.
  const dias = useMemo<Date[]>(() => {
    const out: Date[] = [];
    const base = new Date(ahora);
    for (let i = 0; out.length < 6 && i < 21; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      if (horarioEfectivo(ymdLocal(d), semanalSede, especialesSede).abierta) out.push(d);
    }
    return out;
  }, [semanalSede, especialesSede, ahora]);

  // Ventana efectiva del día elegido; de ahí salen los slots (alineados a su apertura).
  const ventanaDia = useMemo<VentanaDia>(
    () => (day ? horarioEfectivo(ymdLocal(day), semanalSede, especialesSede) : { abierta: false, abreMin: OPEN, cierraMin: CLOSE }),
    [day, semanalSede, especialesSede],
  );
  // Ventana de HOY: para el chip "en vivo" del paso 3 (barbero libre / fuera de horario).
  const ventanaHoy = useMemo<VentanaDia>(
    () => horarioEfectivo(ymdLocal(new Date(ahora)), semanalSede, especialesSede),
    [semanalSede, especialesSede, ahora],
  );

  const slots = useMemo(
    () =>
      servicio && ventanaDia.abierta
        ? buildSlots(servicio.duracionMin, ventanaDia.abreMin, ventanaDia.cierraMin)
        : ([] as number[]),
    [servicio, ventanaDia],
  );
  const dur = servicio?.duracionMin ?? STEP;

  // Al entrar al paso horario sin día elegido, preselecciona el primero (proto muestra "Hoy").
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- preselección de UX al entrar al paso (no cascada real)
    if (step === "horario" && !day && dias.length) setDay(dias[0]);
  }, [step, day, dias]);

  // Cada paso arranca desde arriba: si no, el título y un posible aviso de error
  // quedan por encima del scroll heredado (ver cuerpoRef).
  useEffect(() => {
    cuerpoRef.current?.scrollTo({ top: 0 });
  }, [step]);

  // Mantiene la pila del navegador al día con el paso visible. Se conserva el
  // history.state de Next (árbol interno + __NA) para que el popstate del router
  // no dispare una recarga.
  useEffect(() => {
    pasoRef.current = step;
    if (step === "ok") return; // la confirmación no participa del historial
    const idx = ORDEN.indexOf(step);
    if (idx === marcaRef.current) return; // ya sincronizado (llegamos por popstate)
    if (idx > marcaRef.current) {
      // Una entrada POR PASO, aunque el wizard salte varios de golpe (la
      // reanudación tras el login de Google va directo al paso 5): así el Atrás
      // sigue volviendo de a uno.
      for (let i = marcaRef.current + 1; i <= idx; i++) {
        window.history.pushState({ ...window.history.state, [HIST_MARCA]: i }, "");
      }
    } else {
      // Retroceso que no pasó por el historial: se reemplaza la entrada actual
      // en vez de apilar basura que obligue a tocar Atrás dos veces.
      window.history.replaceState({ ...window.history.state, [HIST_MARCA]: idx }, "");
      if (idx < pisoRef.current) pisoRef.current = idx;
    }
    marcaRef.current = idx;
  }, [step]);

  // Atrás / Adelante del navegador → un paso del wizard, sin perder lo elegido.
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      // Ya reservó: el Atrás no debe devolverlo al formulario (confirmaría dos veces).
      if (pasoRef.current === "ok") {
        router.replace("/");
        return;
      }
      // Con una hoja abierta (upsell / nudge de Google) el Atrás la cierra y deja
      // el paso donde estaba, como cualquier bottom sheet de Android. Reponemos
      // la entrada que consumió el gesto. En el piso no hay nada que reponer: ahí
      // el Atrás sale del wizard, como siempre.
      if ((upsellMode || loginNudge) && marcaRef.current > pisoRef.current) {
        setUpsellMode(null);
        setLoginNudge(false);
        window.history.pushState({ ...window.history.state, [HIST_MARCA]: marcaRef.current }, "");
        return;
      }
      const marca = (e.state as Record<string, unknown> | null)?.[HIST_MARCA];
      // Entrada sin marca = la original de /reservar (o ya salimos de la página).
      const idx = typeof marca === "number" ? marca : pisoRef.current;
      marcaRef.current = idx;
      setStep(ORDEN[idx]);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [router, upsellMode, loginNudge]);

  // Al montar: (1) si venimos del redirect de Google, restaurar la reserva a
  // medias desde sessionStorage; (2) detectar la sesión del cliente para el
  // paso datos ("Reservando como …").
  useEffect(() => {
    // PRIMERO: ¿hay una confirmación reciente que un reload se comió? Se
    // restaura la pantalla ¡Listo! con su token de deshacer — nunca el form
    // (evita la doble reserva del cliente que cree que falló).
    try {
      const rawOk = sessionStorage.getItem(OK_KEY);
      if (rawOk) {
        const o = JSON.parse(rawOk) as {
          t?: number;
          token?: string | null;
          sedeId?: SedeId | null;
          servicioId?: string;
          barberoId?: string | null;
          dayISO?: string | null;
          slot?: number | null;
          bebida?: Bebida | null;
          bebidaIncluida?: boolean;
          servicioFoto?: string;
        };
        if (o.t && Date.now() - o.t < OK_TTL_MS) {
          const sv = servicios.find((x) => x.id === o.servicioId) ?? null;
          const d = o.dayISO ? new Date(o.dayISO) : null;
          if (sv && d && !isNaN(d.getTime()) && o.slot != null && o.sedeId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- rehidratación al montar (reload post-confirmación)
            setSedeId(o.sedeId);
            setServicio(sv);
            if (o.servicioFoto) setServicioFoto(o.servicioFoto);
            setBarbero(barberos.find((x) => x.id === o.barberoId) ?? null);
            setDay(d);
            setSlot(o.slot);
            setBebida(o.bebida ?? null);
            setBebidaIncluida(!!o.bebidaIncluida);
            setReservaToken(o.token ?? null);
            setStep("ok");
            return;
          }
        }
        sessionStorage.removeItem(OK_KEY); // vencida o incompleta
      }
    } catch {
      // Snapshot corrupto: seguimos con el flujo normal.
    }
    try {
      const raw = sessionStorage.getItem(RESUME_KEY);
      if (raw) {
        const s = JSON.parse(raw) as {
          t?: number;
          step?: Step;
          sedeId?: SedeId | null;
          servicioId?: string;
          barberoId?: string | null;
          dayISO?: string | null;
          slot?: number | null;
          bebida?: Bebida | null;
          bebidaIncluida?: boolean;
          servicioFoto?: string;
        };
        const sv = servicios.find((x) => x.id === s.servicioId) ?? null;
        const d = s.dayISO ? new Date(s.dayISO) : null;
        const diaOk = d != null && !isNaN(d.getTime());
        const fresco = !!s.t && Date.now() - s.t < RESUME_TTL_MS;
        // Restauramos si el snapshot está vivo y tenía alguna selección real
        // (sede o servicio). El día/slot pueden faltar si se guardó en un paso
        // temprano: rehidratamos lo que haya.
        if (fresco && (sv || s.sedeId)) {
          // Paso a restaurar, RECORTADO a lo que los datos permiten pintar: nunca
          // caer en "horario" sin servicio ni en "datos" sin slot (main en blanco).
          let destino: Step = s.step && ORDEN.includes(s.step) ? s.step : "servicio";
          if ((destino === "horario" || destino === "datos") && !sv) destino = "servicio";
          if (destino === "datos" && (!diaOk || s.slot == null)) destino = sv ? "horario" : "servicio";
           
          if (s.sedeId) setSedeId(s.sedeId);
          if (sv) {
            setServicio(sv);
            if (s.servicioFoto) setServicioFoto(s.servicioFoto);
          }
          setBarbero(barberos.find((x) => x.id === s.barberoId) ?? null);
          if (diaOk) setDay(d);
          if (s.slot != null) setSlot(s.slot);
          setBebida(s.bebida ?? null);
          setBebidaIncluida(!!s.bebidaIncluida);
          // El upsell de bebida ya se ofreció si estábamos más allá de elegir servicio.
          if (ORDEN.indexOf(destino) >= ORDEN.indexOf("barbero")) setUpsellSeen(true);
          // Alinear la marca del historial con la entrada actual SOLO si sobrevivió
          // al F5 (tiene marca): así el efecto de historial no apila duplicados.
          // Sin marca (navegación fresca / vuelta de Google) se deja el ref inicial
          // para que el efecto reponga las entradas y el Atrás siga funcionando.
          const marcaActual = (window.history.state as Record<string, unknown> | null)?.[HIST_MARCA];
          if (typeof marcaActual === "number") marcaRef.current = marcaActual;
          setStep(destino);
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
        const meta = (u.user_metadata ?? {}) as {
          full_name?: string;
          name?: string;
          avatar_url?: string;
          picture?: string;
        };
        setSesion({
          nombre: meta.full_name || meta.name || "",
          email: u.email,
          foto: meta.avatar_url || meta.picture || null,
        });
      });
    return () => {
      vivo = false;
    };
  }, [servicios, barberos]);

  // Persistimos la reserva a medio armar en CADA cambio (paso + selección), no
  // solo antes del login de Google: así un F5 o el Atrás del navegador no borran
  // lo elegido (se rehidrata al montar). No guardamos nombre/correo (datos
  // sensibles y opcionales): el paso datos se vuelve a completar. Se limpia al
  // confirmar. Progressive enhancement: si sessionStorage falla, el wizard sigue.
  const primerRenderRef = useRef(true);
  useEffect(() => {
    // El primer disparo es el montaje: no pisar el snapshot ANTES de rehidratarlo.
    if (primerRenderRef.current) {
      primerRenderRef.current = false;
      return;
    }
    try {
      if (step === "ok") {
        sessionStorage.removeItem(RESUME_KEY);
        return;
      }
      const hayAlgo = !!servicio || !!barbero || !!day || slot !== null || step !== pasoInicial;
      if (!hayAlgo) {
        sessionStorage.removeItem(RESUME_KEY);
        return;
      }
      sessionStorage.setItem(
        RESUME_KEY,
        JSON.stringify({
          t: Date.now(),
          step,
          sedeId,
          servicioId: servicio?.id,
          barberoId: barbero?.id ?? null,
          dayISO: day ? day.toISOString() : null,
          slot,
          bebida,
          bebidaIncluida,
          servicioFoto,
        }),
      );
    } catch {
      // sessionStorage lleno/bloqueado: seguimos sin persistencia.
    }
  }, [step, sedeId, servicio, barbero, day, slot, bebida, bebidaIncluida, servicioFoto, pasoInicial]);

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
  // Sin cupos por CIERRE (ya pasó la jornada) vs por AGENDA LLENA: el mensaje
  // cambia, porque uno invita a otro día y el otro es señal de demanda.
  const diaCerrado = slots.length > 0 && slots.every((t) => pasadoSet.has(t));
  // Cuántos turnos ya tomó el barbero hoy (prueba social del encabezado).
  const tomadosHoy = slots.filter((t) => ocupadoSet.has(t)).length;

  // Estado en vivo de un barbero para el chip del paso 3.
  function estadoBarbero(bId: string): { tipo: "libre" | "silla" | "cerrado"; label: string } {
    const rangos = statusHoy[bId] ?? [];
    const now = ahora;
    const activa = rangos.find((o) => new Date(o.inicio).getTime() <= now && now <= new Date(o.fin).getTime());
    if (activa) {
      const i = new Date(activa.inicio);
      const f = new Date(activa.fin);
      const desdeMin = i.getHours() * 60 + i.getMinutes();
      const hastaMin = f.getHours() * 60 + f.getMinutes();
      // Una AUSENCIA llega como un bloque del día entero (getDisponibilidad
      // devuelve 00:00–23:59 para tapar todos los slots). Sin distinguirla, el
      // chip decía "En silla · sale 11:59 pm": el barbero ni siquiera estaba en
      // la barbería y el sitio lo mostraba atendiendo hasta medianoche.
      if (desdeMin <= ventanaHoy.abreMin && hastaMin >= ventanaHoy.cierraMin) {
        return { tipo: "cerrado", label: "No atiende hoy" };
      }
      return { tipo: "silla", label: `En silla · sale ${fmtTime(hastaMin)}` };
    }
    // Fuera del horario de la barbería (día cerrado, antes de abrir o tras cerrar):
    // "Libre ahora" (verde) engaña: no está trabajando. Se muestra neutro.
    const d = new Date(now);
    const min = d.getHours() * 60 + d.getMinutes();
    if (!ventanaHoy.abierta || min < ventanaHoy.abreMin || min >= ventanaHoy.cierraMin) {
      // Corto a propósito: "Disponible para reservar" no cabía en la card móvil
      // (~161px de ancho) y partía el chip en dos líneas.
      return { tipo: "cerrado", label: "Puedes reservar" };
    }
    return { tipo: "libre", label: "Libre ahora" };
  }

  const precioServicio = servicio && sedeId ? servicio.precios[sedeId] : null;
  // `!= null` (no `!== null`): precios[sedeId] es `undefined` (no null) cuando el
  // servicio no tiene precio en esa sede → antes daba `undefined + 0 = NaN`.
  const total = precioServicio != null ? precioServicio + (bebida && !bebidaIncluida ? bebida.precio : 0) : null;
  // La bebida con cargo dice su precio donde se la nombra: antes subía el total
  // en silencio y el cliente no podía reconstruir la cifra a la vista.
  const bebidaTxt = bebida
    ? ` + ${bebida.nombre.toLowerCase()}${bebidaIncluida ? " (incluida)" : ` (+${cop(bebida.precio)})`}`
    : "";

  // Nombre y correo obligatorios para habilitar "Confirmar" en el paso datos.
  // Con sesión Google no se piden: el server usa el email (y nombre) de la sesión.
  const emailValido = EMAIL_RE.test(email.trim());
  const datosValidos = sesion ? true : nombre.trim().length > 0 && emailValido;

  const paso = (ORDEN.indexOf(step as Exclude<Step, "ok">) + 1) as number;

  // Volver un paso. Si esa entrada existe en el historial se vuelve POR ÉL (el
  // paso lo cambia el popstate): así la flecha del header y el Atrás del
  // teléfono no se desincronizan.
  function irAtras() {
    const idx = ORDEN.indexOf(step as Exclude<Step, "ok">);
    if (idx <= 0) {
      router.push("/");
      return;
    }
    if (idx > pisoRef.current) window.history.back();
    else setStep(ORDEN[idx - 1]);
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
      step: "datos" as Step,
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

  // "¿No eres tú?": cierra la sesión y vuelve al formulario de invitado. Desde ahí
  // se puede entrar con OTRA cuenta de Google (el botón fuerza el selector) o seguir
  // como invitado. Reseteo el nudge para que vuelva a ofrecer login si sigue de invitado.
  async function cambiarCuenta() {
    await supabaseBrowser().auth.signOut();
    setSesion(null);
    setNudgeSeen(false);
  }

  // Falló la confirmación → de vuelta a elegir horario. También por el historial:
  // así no queda una entrada de más apuntando al paso 5, que sin slot ni siquiera
  // se puede pintar.
  function volverAHorario() {
    setSlot(null);
    if (marcaRef.current > pisoRef.current) window.history.back();
    else setStep("horario");
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
        setErrorMsg("Ese horario ya fue tomado. Elige otro, por favor.");
        volverAHorario();
        return;
      }
    }
    setSaving(true);
    setErrorMsg(null);
    // El slot es minuto-del-día de BOGOTÁ; se arma el instante en Bogotá (UTC-5), no
    // en la TZ del teléfono (setHours corría la hora en dispositivos fuera de Colombia).
    const inicio = instanteBogota(ymdLocal(day), slot);
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
      // Persistir la confirmación ANTES de pintarla: si un reload (deploy/PWA/F5)
      // llega en este instante, al remontar se restaura la pantalla ¡Listo!.
      try {
        sessionStorage.setItem(
          OK_KEY,
          JSON.stringify({
            t: Date.now(),
            token: res.token ?? null,
            sedeId,
            servicioId: servicio.id,
            barberoId: elegido.id,
            dayISO: day.toISOString(),
            slot,
            bebida,
            bebidaIncluida,
            servicioFoto,
          }),
        );
      } catch {}
      setReservaToken(res.token ?? null);
      setBarbero(elegido);
      setStep("ok");
      return;
    }
    setErrorMsg(res.error ?? "No se pudo reservar");
    volverAHorario();
  }

  // Salir de la confirmación por un CTA la da por vista: no se re-muestra.
  const limpiarOk = () => {
    try {
      sessionStorage.removeItem(OK_KEY);
    } catch {}
  };

  // Deshecha desde la confirmación: el cliente notó un dato mal y canceló. No sale
  // el correo de confirmación (la vista v_confirmaciones_pendientes excluye las
  // 'cancelada'); acá le ofrecemos reservar de nuevo con la info correcta.
  if (step === "ok" && cancelada) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 py-12 text-center">
        <span className="inline-block rounded-full border border-line px-4 py-1.5 font-display text-xs font-extrabold uppercase tracking-[0.1em] text-muted">
          Reserva cancelada
        </span>
        <h2 className="max-w-[20ch] font-display text-[32px] font-extrabold uppercase leading-[0.95]">
          Listo, la cancelamos
        </h2>
        <p className="max-w-[32ch] text-sm text-muted">
          No te mandamos confirmación. Si había un dato mal, reserva de nuevo con la info correcta.
        </p>
        <button
          onClick={() => {
            window.location.href = "/reservar";
          }}
          className="mt-2 flex min-h-[50px] items-center justify-center rounded-2xl px-8 font-display text-[15px] font-extrabold uppercase tracking-wide text-on-accent"
          style={{ background: GRAD_CTA }}
        >
          Reservar de nuevo
        </button>
        <button onClick={() => router.push("/")} className="text-[13px] text-muted underline underline-offset-2">
          Volver al inicio
        </button>
      </div>
    );
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
            {/* Tras un reload el snapshot no trae nombre/correo (sin PII): la frase
                del correo solo sale si tenemos el correo, para no dejarla coja. */}
            Ya quedó agendada{nombre.trim() ? `, ${nombre.trim()}` : ""}.
            {email.trim() ? ` Te enviamos el comprobante y el recordatorio al correo ${email.trim()}.` : " Te llega el comprobante y el recordatorio al correo."}{" "}
            Sede {sedeNombre}.
          </p>

          <div className="mt-6 rounded-2xl border border-line bg-panel text-left" style={{ animation: "bbrise .5s ease-out .45s both" }}>
            <div className="flex items-center gap-3 border-b border-[rgba(242,237,228,0.07)] p-3.5">
              <div className="relative h-[46px] w-[46px] shrink-0 overflow-hidden rounded-[10px]">
                {servicioFoto ? (
                  <Image src={servicioFoto} alt="" fill sizes="46px" className="object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-elevated text-lg text-muted/50" aria-hidden>
                    ✂
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted">Servicio</div>
                {/* Sin truncar: esta card es el comprobante de lo que reservó. Un
                    "Corte (clásico, degradado, tijera …" acá deja al cliente sin
                    saber qué pidió. Que ocupe dos líneas, hay lugar de sobra. */}
                <div className="text-sm font-semibold leading-snug text-ink">
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
                <div className="text-[11px] text-muted">Lo pagas en la barbería.</div>
              </div>
              {total !== null && (
                <div className="font-display text-[22px] font-extrabold tabular-nums text-accent-soft">
                  {servicio.desde && <span className="mr-1 text-[12px] font-bold text-muted">desde</span>}
                  {cop(total)}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex gap-2.5" style={{ animation: "bbrise .5s ease-out .55s both" }}>
            {/* El invitado NO tiene cuenta: mandarlo a /cuenta como CTA estrella
                era ofrecerle una puerta cerrada justo después de reservar. */}
            {sesion ? (
              <>
                <button
                  onClick={() => {
                    limpiarOk();
                    router.push("/cuenta");
                  }}
                  className="flex min-h-[50px] flex-[1.3] items-center justify-center rounded-2xl font-display text-[15px] font-extrabold uppercase tracking-wide text-on-accent"
                  style={{ background: GRAD_CTA }}
                >
                  Ver mi cuenta
                </button>
                <button
                  onClick={() => {
                    limpiarOk();
                    router.push("/");
                  }}
                  className="flex flex-1 items-center justify-center rounded-2xl border border-[rgba(242,237,228,0.16)] px-3 text-[13px] text-muted"
                >
                  Volver al inicio
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  limpiarOk();
                  router.push("/");
                }}
                className="flex min-h-[50px] flex-1 items-center justify-center rounded-2xl font-display text-[15px] font-extrabold uppercase tracking-wide text-on-accent"
                style={{ background: GRAD_CTA }}
              >
                Volver al inicio
              </button>
            )}
          </div>

          {/* Deshacer: por si puso un dato mal. Sin cuenta regresiva; cancela con
              el confirm_token y no se manda la confirmación por correo. */}
          {reservaToken && (
            <div className="mt-4" style={{ animation: "bbrise .5s ease-out .65s both" }}>
              <button
                onClick={async () => {
                  setCancelError(null);
                  setCancelando(true);
                  const r = await cancelarReservaReciente(reservaToken);
                  setCancelando(false);
                  if (r.ok) {
                    limpiarOk(); // deshecha: un reload no debe revivir el "¡Listo!"
                    setCancelada(true);
                  } else setCancelError(r.error ?? "No se pudo cancelar. Intenta de nuevo.");
                }}
                disabled={cancelando}
                className="text-[12.5px] text-muted underline underline-offset-2 transition hover:text-ink disabled:opacity-50"
              >
                {cancelando ? "Cancelando…" : "¿Algún dato mal? Cancelar esta reserva"}
              </button>
              {cancelError && <p className="mt-1.5 text-[12px] text-accent-soft">{cancelError}</p>}
            </div>
          )}
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
        {/* -ml-2 para que el área táctil crezca sin correr el título: el glifo medía
            20px de alto, la mitad del mínimo cómodo con el pulgar (44px). */}
        <button
          onClick={irAtras}
          aria-label="Atrás"
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[20px] leading-none text-muted transition hover:text-ink active:bg-ink/10"
        >
          ←
        </button>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[22px] font-extrabold uppercase leading-none">Reserva tu turno</div>
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
      <main ref={cuerpoRef} className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-5 md:px-14 md:pt-7">
        {/* ---------- Paso 1 · Sede ---------- */}
        {step === "sede" && (
          <div>
            <h2 className="font-display text-[26px] font-extrabold uppercase leading-none">¿En qué sede?</h2>
            {/* Sin horas fijas acá: cambian por sede y día, y el dueño las edita. El
                día y la hora reales salen en el paso 4 y en "Horarios de atención". */}
            <p className="mt-1.5 text-xs text-muted">Elige el local; el día y la hora los ves en seguida.</p>
            <div className="mt-5 flex flex-col gap-3 md:grid md:grid-cols-[repeat(auto-fit,minmax(340px,1fr))] md:gap-4">
              {sedes.map((s) => {
                const sel = sedeId === s.id;
                // La foto de la DB (subida en Admin → Horarios, 0058) MANDA; el
                // mapa hardcodeado queda de respaldo para las dos sedes fundadoras.
                const info = {
                  detalle: SEDE_INFO[s.id]?.detalle ?? s.direccion ?? "Barranquilla",
                  frente: s.fotoUrl ?? SEDE_INFO[s.id]?.frente ?? null,
                };
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSedeId(s.id);
                      setBarbero(null);
                    }}
                    className={`relative h-[130px] w-full overflow-hidden rounded-2xl text-left md:h-[300px] ${info.frente ? "bb-foto-skeleton" : "bg-elevated"}`}
                    style={{ border: `2px solid ${sel ? "#d23f34" : "rgba(242,237,228,.12)"}` }}
                  >
                    {info.frente ? (
                      <Image src={info.frente} alt={s.nombre} fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover" />
                    ) : (
                      <span aria-hidden className="absolute inset-0 flex items-center justify-center font-display text-6xl text-muted/25">
                        {s.nombre.charAt(0).toUpperCase()}
                      </span>
                    )}
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
            {/* Contexto de sede (y barbero si vino elegido). Sin esto, quien entra
                desde "Reservar con Kevin" en /barberos aterriza acá y la pantalla
                no nombra ni al barbero ni la sede: no sabe si su eleccion quedó,
                ni en qué local reserva, y los precios cambian entre sedes.
                Mismo formato que el subtítulo del paso 3. */}
            <p className="mt-1.5 text-xs text-muted">
              {sedeNombre}
              {barbero ? ` · con ${barbero.nombre}` : ""}
            </p>
            <div className="mb-2 mt-5 text-[10px] font-bold uppercase tracking-[0.24em] text-accent-soft">Categorías</div>
            {/* MÓVIL: fila que se desliza. Las 7 categorías en grilla 2x4 medían
                200px y empujaban los servicios abajo del pliegue: en un iPhone SE
                no entraba NI UNA card de servicio completa (medido). En fila son
                ~56px. DESKTOP mantiene la grilla del proto (§6.4), donde entran
                de sobra. Los chips no cambian de estilo, solo de acomodo. */}
            <div className="relative">
              <div className="scroll-x-limpio -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:snap-none md:grid-cols-[repeat(auto-fit,minmax(230px,1fr))] md:overflow-visible md:px-0 md:pb-0">
                {cats.map((cat) => {
                  const activa = selectedCat === cat;
                  const n = serviciosSede.filter((s) => s.categoria === cat).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCat(cat)}
                      className="flex min-h-[44px] shrink-0 snap-start items-center justify-between gap-2 rounded-[10px] px-3 py-2.5 md:shrink"
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
              {/* Señal de que la fila sigue: sin el fade, nada indicaba que había
                  más categorías scrolleando a la derecha. Solo móvil (en desktop
                  es grilla y no scrollea). */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 -right-4 w-10 bg-gradient-to-l from-bg to-transparent md:hidden"
              />
            </div>

            <div className="mb-3 mt-6 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-accent-soft">Servicios disponibles</span>
              <span className="text-[11px] text-muted">{serviciosCat.length} opciones</span>
            </div>

            {/* Vacío explícito: la grilla sin filas parecía una pantalla rota. */}
            {serviciosCat.length === 0 && (
              <p className="rounded-xl border border-line bg-panel px-4 py-3 text-sm text-muted">
                No hay servicios en esta categoría. Mira las otras categorías de arriba.
              </p>
            )}

            <div className="grid grid-cols-2 gap-[9px] md:grid-cols-[repeat(auto-fill,minmax(160px,190px))] md:justify-center md:gap-3">
              {serviciosCat
                .map((s) => {
                  const sel = servicio?.id === s.id;
                  const foto = s.fotoUrl ?? null;
                  const precio = sedeId ? s.precios[sedeId] : s.precios["parque-venezuela"];
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setServicio(s);
                        setServicioFoto(foto ?? "");
                        setSlot(null);
                        // Reset del upsell: si venías de un combo con bebida incluida y
                        // cambias a otro servicio, no arrastres la bebida (se regalaba
                        // gratis) y re-evaluá el upsell con el servicio nuevo.
                        setBebida(null);
                        setBebidaIncluida(false);
                        setUpsellSeen(false);
                      }}
                      className="flex flex-col overflow-hidden rounded-xl text-left"
                      style={{ border: `2px solid ${sel ? "#d23f34" : "rgba(242,237,228,.1)"}` }}
                    >
                      <div className={`relative aspect-[4/3] w-full overflow-hidden md:aspect-[3/2] ${foto ? "bb-foto-skeleton" : ""}`}>
                        {foto ? (
                          <Image src={foto} alt="" fill sizes="(max-width:768px) 50vw, 240px" className="object-cover" />
                        ) : (
                          // Sin foto real no se inventa una: fondo neutro con tijera.
                          <span className="absolute inset-0 flex items-center justify-center bg-elevated text-3xl text-muted/40" aria-hidden>
                            ✂
                          </span>
                        )}
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
                        {/* Qué incluye: sin esto el cliente decidía solo con el nombre. */}
                        {s.descripcion && (
                          <div className="mt-0.5 text-[10.5px] leading-snug text-muted">{s.descripcion}</div>
                        )}
                      </div>
                      <div className="mt-auto flex items-center justify-between border-t border-[rgba(242,237,228,0.07)] px-2.5 py-2">
                        <span className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-muted">Precio</span>
                        {/* "desde": el precio abierto no se disfraza de cerrado. */}
                        <span className="font-display text-[17px] font-extrabold tabular-nums text-accent-soft">
                          {precio != null ? (
                            <>
                              {s.desde && <span className="mr-1 text-[10px] font-bold text-muted">desde</span>}
                              {cop(precio)}
                            </>
                          ) : (
                            "—"
                          )}
                        </span>
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
            <h2 className="font-display text-[26px] font-extrabold uppercase leading-none">Elige tu barbero</h2>
            <p className="mt-1.5 text-xs text-muted">{sedeNombre} · o sigue sin escoger y te asignamos uno.</p>
            {sedeBarberos.length ? (
              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fit,minmax(190px,240px))] md:justify-center">
                {/* Tarjeta explícita de "Cualquier barbero": antes la única pista
                    era el subtítulo y Continuar sin elegir funcionaba en silencio.
                    Marcada = barbero null Y el cliente la tocó (cualquierBarbero). */}
                <button
                  onClick={() => {
                    setBarbero(null);
                    setCualquierBarbero(true);
                  }}
                  className={`relative flex aspect-[3/3.6] flex-col items-center justify-center gap-3 overflow-hidden rounded-[14px] border-2 px-3 text-center transition duration-200 md:hover:-translate-y-1 ${
                    !barbero && cualquierBarbero ? "border-accent" : "border-line md:hover:border-accent/40"
                  }`}
                  style={{
                    background:
                      !barbero && cualquierBarbero
                        ? "radial-gradient(circle at 50% 30%, rgba(210,63,52,.22), #151311 72%)"
                        : "radial-gradient(circle at 50% 30%, #272119, #0e0d0b 76%)",
                  }}
                >
                  {!barbero && cualquierBarbero && (
                    <span className="absolute right-2 top-2 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-accent text-[11px] font-extrabold text-on-accent">✓</span>
                  )}
                  <span className="grid h-12 w-12 place-items-center rounded-full border border-line bg-elevated">
                    <ScissorsIcon className="h-5 w-5 text-accent-soft" />
                  </span>
                  <span>
                    <span className="block font-display text-[19px] font-extrabold uppercase leading-tight text-white">Cualquier barbero</span>
                    <span className="mt-1 block text-[11px] leading-snug text-muted">Te asignamos el primero libre</span>
                  </span>
                </button>
                {sedeBarberos.map((b) => {
                  const sel = barbero?.id === b.id;
                  const ausente = ausenteSet.has(b.id);
                  const est = estadoBarbero(b.id);
                  // Ausente pisa el estado en vivo: no está trabajando ese día.
                  const chipColor = ausente ? "#fbbf24" : est.tipo === "silla" ? "#e8675c" : est.tipo === "cerrado" ? "#9c958a" : "#34d399";
                  const chipBorder = ausente ? "rgba(251,191,36,.4)" : est.tipo === "silla" ? "rgba(210,63,52,.45)" : est.tipo === "cerrado" ? "rgba(242,237,228,.16)" : "rgba(52,211,153,.4)";
                  const estadoLabel = ausente ? (day ? "Ausente ese día" : "Ausente hoy") : est.label;
                  // Card del proto §6.5: una sola pieza aspect 3/3.6 con la foto
                  // enmascarada y el texto encima. Antes acá vivía la card de
                  // /barberos (foto + cuerpo con "Especialista en" + 4 chips): en
                  // móvil medía ~800px de alto, así que entraban dos barberos por
                  // pantalla y las cards quedaban de alturas distintas según cuántas
                  // especialidades tuviera cada uno. Las especialidades siguen en
                  // /barberos, que es donde el proto las pone.
                  return (
                    <button
                      key={b.id}
                      onClick={() => {
                        setBarbero(sel ? null : b);
                        // Elegir (o soltar) un barbero concreto desmarca "Cualquiera".
                        setCualquierBarbero(false);
                      }}
                      className={`group relative aspect-[3/3.6] overflow-hidden rounded-[14px] border-2 text-left transition duration-200 md:hover:-translate-y-1 ${
                        sel ? "border-accent" : "border-line md:hover:border-accent/40"
                      }`}
                      style={{
                        background: sel
                          ? "radial-gradient(circle at 50% 30%, rgba(210,63,52,.22), #151311 72%)"
                          : "radial-gradient(circle at 50% 30%, #272119, #0e0d0b 76%)",
                      }}
                    >
                      <Image
                        src={b.fotoUrl || "/barberos/generico.jpg"}
                        alt={b.nombre}
                        fill
                        sizes="(max-width:768px) 50vw, 240px"
                        className={`object-cover object-top transition-[filter] duration-300 md:group-hover:grayscale-0 ${
                          sel ? "" : "grayscale contrast-[1.05] brightness-[.88]"
                        }`}
                        style={{
                          maskImage: "radial-gradient(ellipse 82% 92% at 50% 40%, black 48%, transparent 74%)",
                          WebkitMaskImage: "radial-gradient(ellipse 82% 92% at 50% 40%, black 48%, transparent 74%)",
                        }}
                      />
                      <span
                        aria-hidden
                        className="absolute inset-0"
                        style={{ background: "linear-gradient(180deg, rgba(12,11,10,0) 45%, rgba(12,11,10,.82))" }}
                      />
                      {b.destacado && (
                        <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.08em] text-on-accent">★ TOP</span>
                      )}
                      {sel && (
                        <span className="absolute right-2 top-2 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-accent text-[11px] font-extrabold text-on-accent">✓</span>
                      )}

                      <div className="absolute inset-x-2.5 bottom-2.5">
                        <div className="font-display text-[21px] font-extrabold uppercase leading-none text-white">{b.nombre}</div>
                        {b.rating != null && (
                          <div className="mt-1 text-[10px] text-[#c9c2b6]">
                            ★ {b.rating.toFixed(1)}
                            {b.resenas ? ` · ${b.resenas} reseñas` : ""}
                          </div>
                        )}
                        <span
                          className="mt-1.5 inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2 py-0.5 text-[9.5px] font-semibold"
                          style={{ borderColor: chipBorder, background: "rgba(5,4,3,.55)", color: chipColor }}
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: chipColor }} />
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
            <h2 className="font-display text-[26px] font-extrabold uppercase leading-none">¿Cuándo pasas?</h2>

            {errorMsg && (
              <div className="mt-4 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent-soft">{errorMsg}</div>
            )}

            <div className="mt-5 md:grid md:grid-cols-[320px_1fr] md:gap-6">
              {/* Selector de día */}
              <div className="md:rounded-2xl md:border md:border-line md:bg-panel md:p-4">
                <div className="mb-2 hidden text-[10px] font-bold uppercase tracking-[0.24em] text-accent-soft md:block">Elige el día</div>
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
                {/* Horas REALES del día elegido (no un rango fijo): pueden cambiar por
                    sede/día y las edita el dueño. Los chips de día ya muestran solo
                    los días que la sede abre. */}
                <p className="mt-3 hidden text-[11px] leading-relaxed text-muted md:block">
                  {ventanaDia.abierta
                    ? `Ese día atendemos de ${fmtTime(ventanaDia.abreMin)} a ${fmtTime(ventanaDia.cierraMin)}.`
                    : "Ese día la sede no atiende."}
                </p>
              </div>

              {/* Slots */}
              <div className="mt-6 md:mt-0">
                {!day ? (
                  <p className="text-sm text-muted">Elige un día para ver los horarios.</p>
                ) : cargandoSlots ? (
                  <div className="grid grid-cols-3 gap-2 md:grid-cols-[repeat(auto-fill,minmax(110px,1fr))]">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="h-[54px] animate-pulse rounded-[13px] border border-line/50 bg-panel md:h-[50px]" />
                    ))}
                  </div>
                ) : sinCupos ? (
                  // Dos motivos distintos para quedarse sin horarios, y conviene
                  // decirlos distinto: el día ya cerró (nadie puede reservar más
                  // hoy) o el barbero se llenó (sí hay demanda, prueba otro día).
                  <div className="rounded-2xl border border-line bg-panel px-5 py-6 text-center">
                    <span
                      aria-hidden
                      className="mx-auto grid h-11 w-11 place-items-center rounded-full"
                      style={{ background: "#211d19", border: "1px solid rgba(242,237,228,.12)" }}
                    >
                      {diaCerrado ? <RelojIcon /> : <ScissorsIcon className="h-4 w-4 text-accent-soft" />}
                    </span>
                    <p className="mt-3 font-display text-[19px] font-bold uppercase leading-tight">
                      {diaCerrado ? "Este día ya cerró" : "Agenda llena este día"}
                    </p>
                    <p className="mx-auto mt-1.5 max-w-[34ch] text-[13px] leading-relaxed text-muted">
                      {diaCerrado
                        ? "Ya pasó el horario de atención. Elige otro día y te guardamos el turno."
                        : `${barbero ? barbero.nombre : "El equipo"} ya tiene todos los turnos tomados. Prueba con otra fecha${barbero ? " u otro barbero" : ""}.`}
                    </p>
                    {dias.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const i = dias.findIndex((d) => (day ? mismoDia(d, day) : false));
                          const siguiente = dias[i + 1] ?? dias[0];
                          setDay(siguiente);
                          setSlot(null);
                          setErrorMsg(null);
                        }}
                        className="mt-4 rounded-full bg-accent px-6 py-2.5 text-[12.5px] font-bold uppercase tracking-[0.08em] text-on-accent transition hover:bg-accent-soft"
                      >
                        Ver el día siguiente
                      </button>
                    )}
                  </div>
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

        {/* Escape: si el historial nos trajo al paso "Día y hora" sin servicio
            (snapshot vencido tras un F5, o entrada de historial suelta), no dejar
            el cuerpo en blanco — invitamos a reiniciar en vez de una pantalla rota. */}
        {step === "horario" && !servicio && <SeleccionPerdida onReiniciar={() => setStep("servicio")} />}

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
                        {sesion.foto ? (
                          // Foto real de la cuenta; la G queda solo de respaldo.
                          // eslint-disable-next-line @next/next/no-img-element -- avatar remoto de Google; next/image exigiría configurar el dominio.
                          <img
                            src={sesion.foto}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-line"
                          />
                        ) : (
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink">
                            <GoogleG />
                          </span>
                        )}
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
                          ¿No eres tú?
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
                          placeholder="Como quieres que te digamos"
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
                        placeholder="Como quieres que te digamos"
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
                          ? "Revisa el correo: falta el @ o el dominio."
                          : "Ya mismo te mandamos la confirmación y el recordatorio."}
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
                        ¿Prefieres continuar con Google? Queda en tu cuenta y sumas tarjeta
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
                          Con tu cuenta la reserva queda en Mi cuenta y sumas en tu tarjeta de cortes.
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
                  {/* Servicio con su precio y la bebida en línea propia con el
                      suyo: el total de abajo se reconstruye a la vista, nada
                      sube la cuenta en silencio. */}
                  <ResumenRow
                    k="Servicio"
                    v={`${servicio.nombre}${precioServicio != null ? ` · ${servicio.desde ? "desde " : ""}${cop(precioServicio)}` : ""}`}
                  />
                  {bebida && (
                    <ResumenRow
                      k="Bebida"
                      v={bebidaIncluida ? `${bebida.nombre} (incluida)` : `${bebida.nombre} +${cop(bebida.precio)}`}
                    />
                  )}
                  <ResumenRow k="Sede" v={sedeNombre} />
                </div>

                {/* Total, alineado con lo que muestra el footer sticky. */}
                {total !== null && (
                  <div className="flex items-baseline justify-between gap-3 border-t border-line bg-elevated/40 px-4 py-3.5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Total</span>
                    <span className="font-display text-[26px] font-extrabold leading-none tabular-nums text-ink">
                      {servicio.desde && <span className="mr-1 text-[13px] font-bold text-muted">desde</span>}
                      {cop(total)}
                    </span>
                  </div>
                )}

                <p className="px-4 pb-4 pt-3 text-[11px] leading-relaxed text-muted">
                  Se paga en la barbería. Puedes cancelar o reagendar hasta 2 horas antes.
                </p>
              </aside>
            </div>
          </div>
        )}

        {/* Mismo escape para "Tus datos" si falta servicio, día o slot. */}
        {step === "datos" && (!servicio || !day || slot === null) && (
          <SeleccionPerdida onReiniciar={() => setStep(servicio ? "horario" : "servicio")} />
        )}
      </main>

      {/* Footer sticky de resumen/total */}
      <footer
        className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-3 md:px-14"
        style={{ background: "rgba(12,11,10,.95)", backdropFilter: "blur(10px)" }}
      >
        <div className="min-w-0 flex-1">
          {/* El día y la hora van PRIMERO cuando ya se eligieron: la línea trunca
              por la derecha, así que antes se comía justo el dato que el cliente
              está por confirmar ("Corte (clásico, degradado, tijera o niñ…" y la
              hora invisible). El nombre del servicio sí puede cortarse: ya está
              arriba en grande. */}
          <div className="truncate text-[11px] text-muted">
            {servicio
              ? [
                  day && slot !== null ? `${diaLabel(day)} ${fmtTime(slot)}` : null,
                  `${servicio.nombre}${bebidaTxt}`,
                  barbero ? barbero.nombre : "Cualquier barbero",
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Elige un servicio y una hora"}
          </div>
          <div className="font-display text-[24px] font-extrabold tabular-nums leading-none text-ink">
            {total !== null ? (
              <>
                {servicio?.desde && <span className="mr-1 text-[12px] font-bold text-muted">desde</span>}
                {cop(total)}
              </>
            ) : (
              "—"
            )}
          </div>
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
              <h3 className="text-center font-display text-[23px] font-extrabold uppercase leading-tight">¿Quieres seguirle el rastro a tu cita?</h3>
              <p className="mx-auto mt-2 max-w-[34ch] text-center text-[13px] leading-relaxed text-muted">
                Si entras con Google, la reserva queda en <b className="text-ink">Mi cuenta</b>: ves tu lugar en la fila, te avisamos si se libera un cupo antes y sumas en tu <b className="text-ink">tarjeta de cortes</b>. Como invitado no hay forma de hacer seguimiento.
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

// Estado de escape cuando el historial deja el wizard en un paso que no puede
// pintar (p. ej. "Día y hora" sin servicio tras un F5 con snapshot vencido).
// Evita el <main> en blanco del que se quejaba la auditoría (AUD-E-002).
function SeleccionPerdida({ onReiniciar }: { onReiniciar: () => void }) {
  return (
    <div className="mx-auto mt-6 max-w-md rounded-2xl border border-line bg-panel px-5 py-8 text-center">
      <h2 className="font-display text-[22px] font-extrabold uppercase leading-tight">Se perdió tu selección</h2>
      <p className="mx-auto mt-2 max-w-[34ch] text-[13px] leading-relaxed text-muted">
        Pasó un rato y no pudimos recuperar lo que habías elegido. Arranquemos de nuevo, es rápido.
      </p>
      <button
        type="button"
        onClick={onReiniciar}
        className="mt-5 rounded-full bg-accent px-6 py-2.5 text-[12.5px] font-bold uppercase tracking-[0.08em] text-on-accent transition hover:bg-accent-soft"
      >
        Empezar de nuevo
      </button>
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

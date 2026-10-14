"use client";

import { useEffect, useState } from "react";
import { guardarPushStaff, probarAvisoStaff, estadoAvisosAparato, soltarAvisosDeEsteAparato } from "@/lib/actions";
import { aQuien } from "@/lib/avisos-reglas";

// Avisos de cita en el aparato del STAFF (migración 0047).
// El ding del mostrador solo suena con la app abierta en pantalla: con el
// celular bloqueado, una reserva nueva entraba en silencio. Esto suscribe ESTE
// aparato; a quién se ata (la sede o el barbero) lo decide el server desde el
// perfil, no el cliente.
// Deliberadamente distinto al PushManager del portal: la copia habla de citas
// del local, no de turnos del cliente.

function claveVapid(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const bruto = window.atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

/** ¿La suscripción existente se firmó con la llave VAPID vigente? Si la llave
 *  rotó, la vieja no recibe nada y hay que reemplazarla. */
function conKeyVigente(sub: PushSubscription, actual: Uint8Array) {
  const k = sub.options?.applicationServerKey;
  if (!k) return false;
  const bytes = new Uint8Array(k);
  return bytes.length === actual.length && bytes.every((b, i) => b === actual[i]);
}

// getRegistration() responde al instante; si el SW se está instalando se espera
// .ready con techo (en dev el PWA está apagado y .ready no resuelve nunca).
async function obtenerSW(ms = 5000): Promise<ServiceWorkerRegistration | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  if (reg?.active) return reg;
  // Registrado pero instalándose: la primera visita tarda ~25 s en producción
  // (precarga). Con el techo de 5 s el botón decía "Disponible en la app
  // instalada" y nadie podía activar los avisos. En producción el PWA siempre
  // está prendido (aunque todavía no se haya registrado): se espera sin techo.
  if (reg || process.env.NODE_ENV === "production") return navigator.serviceWorker.ready;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((r) => setTimeout(() => r(null), ms)),
  ]);
}

type Estado = "cargando" | "oculto" | "bloqueado" | "ios-instalar" | "sin-sw" | "listo" | "activo";

/** A quién más del equipo le avisa este aparato y qué pasa si este perfil activa. */
type Aparato = {
  endpoint: string | null;
  otros: string[];
  /** 0085 aplicada: activar AGREGA a este perfil; sin ella, se los quita al que estaba. */
  varios: boolean;
  /** El aparato ya le avisa al mostrador: es del local. */
  delLocal: boolean;
};
const SIN_APARATO: Aparato = { endpoint: null, otros: [], varios: true, delLocal: false };

/**
 * ¿Los avisos de ESTE perfil llegan a este aparato? No alcanza con que el
 * navegador tenga una suscripción: desde 0085 un aparato puede avisarle a varios
 * (la tableta = la sede + el dueño), y antes la tarjeta le decía "activos" al
 * dueño en la tableta del local aunque los avisos le llegaran solo a la sede.
 * Si el servidor no responde, se asume que no: "Activar" es idempotente, un
 * "activos" falso no.
 */
async function deEstePerfil(endpoint: string): Promise<{ mio: boolean; aparato: Aparato }> {
  try {
    const r = await estadoAvisosAparato(endpoint);
    if (!r.ok) return { mio: false, aparato: { ...SIN_APARATO, endpoint } };
    return { mio: r.mio, aparato: { endpoint, otros: r.otros, varios: r.varios, delLocal: r.delLocal } };
  } catch {
    return { mio: false, aparato: { ...SIN_APARATO, endpoint } };
  }
}

/** `dueno`: la versión del panel del admin (0083), que recibe TODAS las citas web. */
export function AvisosBarbero({ dueno = false }: { dueno?: boolean } = {}) {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prueba, setPrueba] = useState<{ ok: boolean; texto: string } | null>(null);
  const [probando, setProbando] = useState(false);
  // A quién MÁS le avisa este aparato (la sede, otro barbero…), para decirlo.
  const [aparato, setAparato] = useState<Aparato>(SIN_APARATO);
  const otros = aparato.otros;
  const [soltando, setSoltando] = useState(false);

  // Probar: el barbero activa los avisos y hasta ahora tenía que ESPERAR una
  // reserva real para saber si funcionaban. Si el permiso estaba revocado o la
  // suscripción vencida, se enteraba perdiendo una cita.
  async function probar() {
    setProbando(true);
    setPrueba(null);
    const res = await probarAvisoStaff();
    setPrueba(
      res.ok
        ? { ok: true, texto: "Enviado. Debería aparecerte en un segundo." }
        : { ok: false, texto: res.error ?? "No se pudo enviar." },
    );
    setProbando(false);
  }

  useEffect(() => {
    let vivo = true;
    (async () => {
      const ua = window.navigator.userAgent;
      // iOS solo entrega push a la PWA instalada (16.4+). iPadOS se reporta
      // como "Macintosh": lo delata el touch.
      const esIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
      const instalada =
        (window.navigator as { standalone?: boolean }).standalone === true ||
        window.matchMedia("(display-mode: standalone)").matches;
      if (esIOS && !instalada) return vivo && setEstado("ios-instalar");
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return vivo && setEstado("oculto");
      // Sin Notification no hay a dónde entregar el push. Se consulta con `in`
      // porque leer .permission sobre un objeto inexistente revienta el efecto.
      if (!("Notification" in window)) return vivo && setEstado("oculto");
      // Permiso bloqueado: el que tocó "Bloquear" una vez no volvía a ver la
      // tarjeta nunca y no sabía que tenía los avisos apagados. Se le explica cómo
      // desbloquearlo, también en el mostrador y al barbero: la puesta a punto del
      // Inicio los manda justo a este botón.
      if (Notification.permission === "denied") return vivo && setEstado("bloqueado");
      try {
        const reg = await obtenerSW();
        if (!vivo) return;
        if (!reg) return setEstado("sin-sw");
        const sub = await reg.pushManager.getSubscription();
        const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vivo) return;
        if (!sub || !key || !conKeyVigente(sub, claveVapid(key))) return setEstado("listo");
        // El navegador está suscrito; falta saber si es para ESTE perfil.
        const r = await deEstePerfil(sub.endpoint);
        if (!vivo) return;
        setAparato(r.aparato);
        setEstado(r.mio ? "activo" : "listo");
      } catch {
        if (vivo) setEstado("sin-sw");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [dueno]);

  async function activar() {
    setGuardando(true);
    setError(null);
    try {
      const reg = await obtenerSW();
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!reg || !key) {
        setEstado("sin-sw");
        return;
      }
      const actual = claveVapid(key);
      let sub = await reg.pushManager.getSubscription();
      if (sub && !conKeyVigente(sub, actual)) {
        await sub.unsubscribe();
        sub = null;
      }
      sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: actual });
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("suscripción inválida");
      const res = await guardarPushStaff({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      if (res.ok) {
        setAparato((await deEstePerfil(json.endpoint)).aparato);
        setEstado("activo");
      } else setError(res.error ?? "No se pudieron activar los avisos.");
    } catch {
      // Lo más común: el usuario tocó "Bloquear" en el permiso del navegador.
      if ("Notification" in window && Notification.permission === "denied") setEstado("bloqueado");
      else setError("No se pudieron activar. Revisa que el navegador tenga permitidas las notificaciones.");
    } finally {
      setGuardando(false);
    }
  }

  // Desactivar: quita SOLO a este perfil del aparato (los demás que lo comparten
  // siguen recibiendo). No se desuscribe el navegador: eso se los cortaría a todos.
  async function desactivar() {
    if (!aparato.endpoint) return;
    setSoltando(true);
    setPrueba(null);
    const res = await soltarAvisosDeEsteAparato(aparato.endpoint).catch(() => null);
    setSoltando(false);
    if (res?.ok) setEstado("listo");
    else setPrueba({ ok: false, texto: res?.error ?? "No se pudieron desactivar. Revisa la conexión." });
  }

  if (estado === "cargando" || estado === "oculto") return null;

  if (estado === "activo") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="flex items-center gap-2 text-[12px] text-muted">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok" />
          <span>
            {dueno
              ? "Avisos activos en este aparato: te llega cada cliente que reserva, aunque tengas la app cerrada."
              : "Avisos activos en este aparato: te llega la cita al celular aunque tengas la app cerrada."}
            {otros.length > 0 && ` También le avisa ${aQuien(otros)}.`}
          </span>
        </p>
        <button
          onClick={probar}
          disabled={probando}
          className="min-h-11 shrink-0 px-2 text-[12px] font-semibold text-muted underline decoration-line underline-offset-4 transition hover:text-ink disabled:opacity-50"
        >
          {probando ? "Enviando…" : "Probar"}
        </button>
        {aparato.endpoint && (
          <button
            onClick={desactivar}
            disabled={soltando}
            className="min-h-11 shrink-0 px-2 text-[12px] font-semibold text-muted underline decoration-line underline-offset-4 transition hover:text-ink disabled:opacity-50"
          >
            {soltando ? "Desactivando…" : "Desactivar en este aparato"}
          </button>
        )}
        {prueba && (
          <span className={`text-[12px] ${prueba.ok ? "text-ok" : "text-warn"}`}>{prueba.texto}</span>
        )}
      </div>
    );
  }

  if (estado === "bloqueado") {
    return (
      <div className="rounded-2xl border border-warn/40 bg-warn/[0.06] px-4 py-3.5">
        <p className="text-[13.5px] font-bold text-ink">Los avisos están bloqueados en este navegador</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          Alguna vez se tocó «Bloquear» y por eso {dueno ? "no te llega nada" : "no suena ninguna cita"} en este
          aparato. Para desbloquearlos:
        </p>
        <ol className="mt-1.5 grid gap-1 pl-4 text-[12.5px] leading-relaxed text-muted [&>li]:list-decimal">
          <li>
            En el navegador, toca el <span className="font-semibold text-ink">candado</span> (o el ícono de ajustes)
            junto a la dirección de la página.
          </li>
          <li>
            Entra a <span className="font-semibold text-ink">Notificaciones</span> o{" "}
            <span className="font-semibold text-ink">Permisos</span> y elige{" "}
            <span className="font-semibold text-ink">Permitir</span>.
          </li>
          <li>Vuelve a cargar esta página y toca «Activar avisos».</li>
        </ol>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
          Si usas la app instalada: mantén presionado su ícono → Información de la app → Notificaciones → Permitir.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-accent/35 bg-accent/[0.06] px-4 py-3.5">
      <p className="text-[13.5px] font-bold text-ink">Avisos de citas en tu celular</p>
      {estado === "ios-instalar" ? (
        <div className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
          {/* iPhone NO entrega avisos a una pestaña de Safari: solo a la app
              instalada en la pantalla de inicio (iOS 16.4+). Por eso son pasos y
              no una línea: es el punto donde el barbero abandona. */}
          <p>En iPhone, Safari solo avisa si la app está instalada. Son tres toques:</p>
          <ol className="mt-1.5 grid gap-1 pl-4 [counter-reset:p] [&>li]:list-decimal">
            <li>
              Toca <span className="font-semibold text-ink">Compartir</span>, el cuadrito con la flecha para
              arriba, abajo en el centro.
            </li>
            <li>
              Baja y toca <span className="font-semibold text-ink">Agregar a pantalla de inicio</span>.
            </li>
            <li>
              Abre <span className="font-semibold text-ink">B&amp;B Equipo</span> desde el ícono nuevo y
              vuelve acá: el botón de activar te va a aparecer.
            </li>
          </ol>
        </div>
      ) : estado === "sin-sw" ? (
        <p className="mt-1 text-[12.5px] text-muted">Disponible en la app instalada.</p>
      ) : (
        <>
          <p className="mt-1 text-[12.5px] text-muted">
            {otros.length > 0
              ? aparato.varios
                ? `Este aparato ya le avisa ${aQuien(otros)}, pero a ti no. Actívalos y te llegan también a ti, sin quitárselos.`
                : `Este aparato ya le avisa ${aQuien(otros)}. Si los activas, te llegan a ti y dejan de llegarle ${aQuien(otros)}.`
              : dueno
                ? "Actívalos y te llega al celular cada cliente que reserve por la web, aunque tengas la app cerrada."
                : "Ahora mismo solo suena si tienes el mostrador abierto en pantalla. Actívalos y te avisamos cuando un cliente reserve por la web o cancele desde su cuenta."}
          </p>
          {/* El dueño en un aparato del local: sus avisos traen el faltante del
              cierre y el comentario de una mala calificación, y se verían en la
              pantalla que usan los barberos y los clientes. */}
          {dueno && aparato.delLocal && (
            <p className="mt-1.5 text-[12.5px] font-semibold leading-relaxed text-warn">
              Ojo: este es un aparato del local. Si los activas acá, los cierres de caja y las calificaciones bajas
              se van a ver en su pantalla. Mejor actívalos en tu celular.
            </p>
          )}
          <button
            onClick={activar}
            disabled={guardando}
            className="mt-2.5 min-h-11 rounded-full bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] px-5 text-[13px] font-bold text-on-accent transition hover:brightness-105 disabled:opacity-50"
          >
            {guardando ? "Activando…" : "Activar avisos"}
          </button>
        </>
      )}
      {error && <p className="mt-2 text-[12px] text-accent-soft">{error}</p>}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { guardarPushStaff, probarAvisoStaff } from "@/lib/actions";

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
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((r) => setTimeout(() => r(null), ms)),
  ]);
}

type Estado = "cargando" | "oculto" | "ios-instalar" | "sin-sw" | "listo" | "activo";

export function AvisosBarbero() {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prueba, setPrueba] = useState<{ ok: boolean; texto: string } | null>(null);
  const [probando, setProbando] = useState(false);

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
      if (!("Notification" in window) || Notification.permission === "denied") {
        return vivo && setEstado("oculto");
      }
      try {
        const reg = await obtenerSW();
        if (!vivo) return;
        if (!reg) return setEstado("sin-sw");
        const sub = await reg.pushManager.getSubscription();
        const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vivo) return;
        setEstado(sub && key && conKeyVigente(sub, claveVapid(key)) ? "activo" : "listo");
      } catch {
        if (vivo) setEstado("sin-sw");
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

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
      if (res.ok) setEstado("activo");
      else setError(res.error ?? "No se pudieron activar los avisos.");
    } catch {
      // Lo más común: el usuario tocó "Bloquear" en el permiso del navegador.
      setError("No se pudieron activar. Revisa que el navegador tenga permitidas las notificaciones.");
    } finally {
      setGuardando(false);
    }
  }

  if (estado === "cargando" || estado === "oculto") return null;

  if (estado === "activo") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="flex items-center gap-2 text-[12px] text-muted">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok" />
          Avisos activos en este aparato: te llega la cita al celular aunque tengas la app cerrada.
        </p>
        <button
          onClick={probar}
          disabled={probando}
          className="min-h-11 shrink-0 px-2 text-[12px] font-semibold text-muted underline decoration-line underline-offset-4 transition hover:text-ink disabled:opacity-50"
        >
          {probando ? "Enviando…" : "Probar"}
        </button>
        {prueba && (
          <span className={`text-[12px] ${prueba.ok ? "text-ok" : "text-warn"}`}>{prueba.texto}</span>
        )}
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
              Abre <span className="font-semibold text-ink">Barbas &amp; Bigotes</span> desde el ícono nuevo y
              vuelve acá: el botón de activar te va a aparecer.
            </li>
          </ol>
        </div>
      ) : estado === "sin-sw" ? (
        <p className="mt-1 text-[12.5px] text-muted">Disponible en la app instalada.</p>
      ) : (
        <>
          <p className="mt-1 text-[12.5px] text-muted">
            Ahora mismo solo suena si tienes el mostrador abierto en pantalla. Actívalos y te avisamos
            cuando entre una cita tuya o se caiga una.
          </p>
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

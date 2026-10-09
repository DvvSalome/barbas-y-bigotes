"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { instanteBogota, fmtTime } from "@/lib/slots";
import { textoCupo, horaParam, type Cupo, type RespuestaCupo } from "@/lib/cupo";
import { textoEstado, textoHechos, COLOR_ESTADO, type RespuestaEstado } from "@/lib/estado-barbero";
import { supabaseBrowser } from "@/lib/supabase/client";
import css from "./propuesta.module.css";

/*
  Las dos únicas islas de JavaScript de la propuesta (más el ícono de WhatsApp,
  que vive acá para que lo compartan las secciones del servidor y la barra).
  Todo lo demás es HTML del servidor y CSS.
*/

export function WhatsAppIcono({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.43 9.43 0 0 1-4.8-1.32l-.35-.2-3.57.93.95-3.48-.22-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.21 4.24-9.45 9.46-9.45 2.52 0 4.9.99 6.68 2.77a9.4 9.4 0 0 1 2.77 6.69c0 5.21-4.24 9.45-9.46 9.45zm8.05-17.5A11.33 11.33 0 0 0 12.04.66C5.77.66.66 5.77.66 12.04c0 2 .52 3.96 1.52 5.69L.57 23.6l6.01-1.58a11.37 11.37 0 0 0 5.45 1.39h.01c6.27 0 11.38-5.11 11.38-11.38 0-3.04-1.18-5.9-3.33-8.03z" />
    </svg>
  );
}

/**
 * La pared del hero en escritorio sigue apenas al puntero (se inclina hacia
 * donde miras). GSAP se descarga SOLO con pantalla ancha, puntero fino y
 * movimiento permitido; en celular este componente es un <div> y nada más. El
 * movimiento de las columnas y el encendido de las fotos son CSS puro.
 */
export function Inclinable({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const quiere = window.matchMedia("(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    if (!quiere.matches) return;
    let vivo = true;
    let limpiar = () => {};
    import("gsap").then(({ gsap }) => {
      if (!vivo) return;
      const mover = (e: PointerEvent) => {
        const px = e.clientX / window.innerWidth - 0.5;
        const py = e.clientY / window.innerHeight - 0.5;
        gsap.to(el, { "--rx": `${(-py * 5).toFixed(2)}deg`, "--ry": `${(px * 7).toFixed(2)}deg`, duration: 1.1, ease: "power3.out", overwrite: true });
      };
      window.addEventListener("pointermove", mover, { passive: true });
      limpiar = () => window.removeEventListener("pointermove", mover);
    });
    return () => {
      vivo = false;
      limpiar();
    };
  }, []);
  return (
    <div ref={caja} className={className}>
      {children}
    </div>
  );
}

/**
 * La barra fija de reserva del celular. Aparece solo cuando ningún CTA de la
 * página ([data-cta]) está a la vista: así nunca tapa el botón del hero, los
 * del elenco ni el del cierre, y aparece justo cuando el lector ya bajó y le
 * puede servir. La caja no recibe toques (pointer-events-none): solo los dos
 * botones, así el degradado de arriba no le roba el toque a lo que hay debajo.
 */
export function BarraReserva({ whatsapp }: { whatsapp: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const ctas = Array.from(document.querySelectorAll<HTMLElement>("[data-cta]"));
    if (!ctas.length || !("IntersectionObserver" in window)) return;
    const aLaVista = new Set<Element>();
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (e.isIntersecting) aLaVista.add(e.target);
          else aLaVista.delete(e.target);
        }
        setVisible(aLaVista.size === 0);
      },
      { threshold: 0.2 },
    );
    ctas.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);
  return (
    <div
      className={`${css.barra} pointer-events-none fixed inset-x-0 bottom-0 z-30 flex items-center gap-2.5 bg-[linear-gradient(180deg,rgba(12,11,10,0),rgba(12,11,10,0.94)_30%)] px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-5 md:hidden`}
      data-visible={visible ? "" : undefined}
      // inert: escondida, sale del orden de tabulación y del árbol de accesibilidad
      // de una vez (y suelta el foco si lo tenía), sin tabIndex a mano.
      inert={!visible}
    >
      <a
        href={whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Escribir por WhatsApp"
        className="bb-btn bb-btn-fantasma bb-btn-redondo pointer-events-auto"
      >
        <WhatsAppIcono className="text-[#25d366]" />
      </a>
      <Link href="/reservar?desde=barra" className="bb-btn bb-btn-primario pointer-events-auto flex-1">
        Reservar mi cita
      </Link>
    </div>
  );
}

/* ── En vivo: próximo cupo y qué está haciendo cada barbero ──────────────── */
// Un solo almacén por página, compartido por el chip del hero, las caritas, la
// línea de cada barbero y el chip del cierre. Se llena con /api/cupo y
// /api/estado, y se refresca:
//   · al instante, con el aviso público "cambió la agenda de esta sede" (0080);
//   · cada 30 s, de respaldo;
//   · al volver a la pestaña.
const CUPO_FRESCO_MS = 10 * 60_000;
type Vivo = { cupo: RespuestaCupo | null; estado: RespuestaEstado | null };
let vivo: Vivo | undefined;
const oyentes = new Set<() => void>();
let arrancado = false;

const pedir = <T,>(url: string) =>
  fetch(url, { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
    .catch(() => null);
// Un cupo viejo es una promesa rota (un caché intermedio o el service worker sin
// red): más de 10 min → como si no hubiera.
const fresco = (d: { generado: string } | null) => !!d && Date.now() - Date.parse(d.generado) < CUPO_FRESCO_MS;

let enCurso: Promise<void> | null = null;
function refrescar(saltarCache: boolean) {
  enCurso ??= Promise.all([
    pedir<RespuestaCupo>(saltarCache ? `/api/cupo?t=${Date.now()}` : "/api/cupo"),
    pedir<RespuestaEstado>("/api/estado"),
  ])
    .then(async ([cupo, estado]) => {
      if (!fresco(cupo) && !saltarCache) cupo = await pedir<RespuestaCupo>(`/api/cupo?t=${Date.now()}`);
      vivo = { cupo: fresco(cupo) ? cupo : null, estado: fresco(estado) ? estado : (vivo?.estado ?? null) };
      oyentes.forEach((f) => f());
    })
    .finally(() => {
      enCurso = null;
    });
  return enCurso;
}

function arrancar() {
  if (arrancado) return;
  arrancado = true;
  let espera: ReturnType<typeof setTimeout> | undefined;
  // Una acción del mostrador puede disparar varios avisos seguidos: se juntan.
  const pronto = () => {
    clearTimeout(espera);
    espera = setTimeout(() => refrescar(true), 400);
  };
  refrescar(false).then(() => {
    const sedes = [...new Set((vivo?.estado?.barberos ?? []).map((b) => b.sede))];
    const sb = supabaseBrowser();
    for (const sede of sedes) sb.channel(`disponibilidad:${sede}`).on("broadcast", { event: "cambio" }, pronto).subscribe();
  });
  setInterval(() => refrescar(true), 30_000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") pronto();
  });
}

function suscribir(avisar: () => void) {
  oyentes.add(avisar);
  arrancar();
  return () => {
    oyentes.delete(avisar);
  };
}
const useVivo = () => useSyncExternalStore(suscribir, () => vivo, () => undefined);

function useCupo(): RespuestaCupo | null | undefined {
  const v = useVivo();
  return v === undefined ? undefined : v.cupo;
}

const vigente = (c: Cupo | null | undefined): c is Cupo => !!c && instanteBogota(c.fecha, c.minuto).getTime() > Date.now();
const conCupo = (base: string, c: Cupo) => `${base}&fecha=${c.fecha}&hora=${horaParam(c.minuto)}`;

function RelojIcono() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-accent-soft" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

/**
 * El chip del hero y del cierre. En el HTML del servidor dice "Mira las horas
 * libres de hoy" y lleva al wizard; con el dato vivo pasa a "Próximo cupo online:
 * hoy 3:30 pm · Plaza de la Paz" y el enlace ya lleva barbero, sede, día y hora.
 * Altura reservada (44 px): el cambio de texto no mueve nada.
 */
export function ChipCupo({ desde, sedes, className = "" }: { desde: string; sedes: Record<string, string>; className?: string }) {
  const datos = useCupo();
  const mejor = datos?.mejor && vigente(datos.mejor.cupo) ? datos.mejor : null;
  const href = mejor
    ? conCupo(`/reservar?barbero=${mejor.barbero}&sede=${mejor.sede}&desde=${desde}`, mejor.cupo)
    : `/reservar?desde=${desde}`;
  const texto = mejor && datos ? `Próximo cupo online: ${textoCupo(mejor.cupo, datos.hoy)} · ${sedes[mejor.sede] ?? mejor.sede}` : "Mira las horas libres de hoy";
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-line bg-panel/70 px-4 text-[14px] font-semibold text-ink backdrop-blur-[8px] transition hover:border-ink/40 ${className}`}
    >
      <RelojIcono />
      <span key={texto} className={`${css.cambio} truncate`}>
        {texto}
      </span>
    </Link>
  );
}

/** Punto de color con lo que está haciendo el barbero (caritas del hero). */
export function PuntoVivo({ barberoId }: { barberoId: string }) {
  const e = useVivo()?.estado?.barberos.find((b) => b.id === barberoId);
  if (!e || (e.estado !== "libre" && e.estado !== "en_silla")) return null;
  return (
    <span
      title={textoEstado(e, fmtTime)}
      className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full ring-2 ring-bg"
      style={{ background: COLOR_ESTADO[e.estado] }}
    >
      <span className="sr-only">{textoEstado(e, fmtTime)}</span>
    </span>
  );
}

/**
 * Las líneas vivas de cada barbero en el elenco: qué está haciendo AHORA, cuántos
 * cortes lleva hoy y su próximo cupo. Ejemplo: "● En silla · sale 3:30 pm · 2
 * cortes hoy" / "Próximo cupo: hoy 4:00 pm". En el HTML del servidor va solo
 * "Ver sus horas libres"; lo demás llega con el dato vivo.
 */
export function LineaCupo({ barberoId }: { barberoId: string }) {
  const v = useVivo();
  const datos = v?.cupo;
  const e = v?.estado?.barberos.find((b) => b.id === barberoId);
  const cupo = datos?.barberos.find((b) => b.id === barberoId)?.cupo;
  const texto = datos && vigente(cupo) ? `Próximo cupo: ${textoCupo(cupo, datos.hoy)}` : "Ver sus horas libres";
  const vivoTxt = e ? [textoEstado(e, fmtTime), textoHechos(e.hechos)].filter(Boolean).join(" · ") : null;
  return (
    <>
      {e && vivoTxt && (
        <span key={vivoTxt} className={`${css.cambio} flex items-center gap-1.5 text-[13px] font-semibold text-ink`}>
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLOR_ESTADO[e.estado] }} />
          {vivoTxt}
        </span>
      )}
      <span key={texto} className={`${css.cambio} block text-[13px] font-semibold text-ink/90`}>
        {texto}
      </span>
    </>
  );
}

/** El enlace de la pieza del barbero: con el dato vivo, lleva también día y hora. */
export function EnlaceCupo({ base, barberoId, className, children }: { base: string; barberoId: string; className?: string; children: React.ReactNode }) {
  const datos = useCupo();
  const cupo = datos?.barberos.find((b) => b.id === barberoId)?.cupo;
  return (
    <Link href={vigente(cupo) ? conCupo(base, cupo) : base} className={className}>
      {children}
    </Link>
  );
}

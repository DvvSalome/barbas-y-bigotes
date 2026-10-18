"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { BarberoPinLogin, type Destino } from "@/components/barbero/BarberoPinLogin";
import { soltarAvisosAlSalir } from "@/components/staff/PerfilMenu";
import { supabaseBrowser } from "@/lib/supabase/client";
import { pasosInstalar, sistemaDe, nombreCorto, type Sistema } from "@/lib/app-personal";

/*
  La pantalla de /equipo/<slug>: la app PROPIA de un barbero o de un mostrador.

  · Sin nadie del equipo adentro → su teclado de PIN, sin la lista de nombres.
  · Con SU sesión → en la app instalada, directo a su agenda; en el navegador,
    "Ya entraste" + cómo instalarla (si lo mandáramos directo a /barbero, nunca
    vería los pasos y el "Agregar a inicio" lo haría desde otra página).
  · Con OTRA persona adentro (la tablet del local, o el dueño probando el
    enlace) → "Entraste como X": seguir como X o cambiar a él.

  Arriba, mientras NO esté instalada, la tarjeta de cómo instalarla según el
  celular. Lo de "instalada o no" solo lo sabe el navegador: en el servidor (y
  al hidratar) vale null y la tarjeta no se pinta, para que en la app instalada
  nunca parpadee.
*/

type Entorno = Sistema | "instalada";

function instalada(): boolean {
  return (
    (window.navigator as { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    // La app de Play Store (TWA) abre como si viniera de Android.
    document.referrer.startsWith("android-app://")
  );
}

function leerEntorno(): Entorno {
  try {
    if (instalada()) return "instalada";
    return sistemaDe(navigator.userAgent, navigator.maxTouchPoints ?? 0);
  } catch {
    return "otro";
  }
}

const sinSuscripcion = () => () => {};

/** null en el servidor y al hidratar; después, el celular de verdad. */
function useEntorno(): Entorno | null {
  return useSyncExternalStore(sinSuscripcion, leerEntorno, () => null);
}

/** El evento de Chrome para instalar con un botón propio (no está en los tipos del DOM). */
type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

function Avatar({ d, size = 80 }: { d: Destino; size?: number }) {
  return (
    <span
      className="relative mx-auto grid shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-panel"
      style={{ height: size, width: size }}
    >
      {d.fotoUrl ? (
        <Image src={d.fotoUrl} alt="" fill className="object-cover object-top" sizes={`${size}px`} priority />
      ) : d.tipo === "sede" ? (
        <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-accent" aria-hidden>
          <path d="M3 9h18M4 9V6l2-2h12l2 2v3M5 9v11h14V9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <span className="font-display text-3xl text-muted">{d.nombre.charAt(0)}</span>
      )}
    </span>
  );
}

function InstalarApp({ sistema, titulo, tipo }: { sistema: Sistema; titulo: string; tipo: Destino["tipo"] }) {
  const [aviso, setAviso] = useState<EventoInstalar | null>(null);
  const [lista, setLista] = useState(false);

  useEffect(() => {
    const alOfrecer = (e: Event) => {
      // Sin esto Chrome muestra su propia barrita y el botón de acá no serviría.
      e.preventDefault();
      setAviso(e as EventoInstalar);
    };
    const alInstalar = () => setLista(true);
    window.addEventListener("beforeinstallprompt", alOfrecer);
    window.addEventListener("appinstalled", alInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", alOfrecer);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  async function instalar() {
    if (!aviso) return;
    await aviso.prompt();
    const { outcome } = await aviso.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    setAviso(null);
    if (outcome === "accepted") setLista(true);
  }

  if (lista) {
    return (
      <div role="status" className="rounded-2xl border border-ok/40 bg-ok/10 px-4 py-3 text-left text-[13px] text-ok">
        Listo: ábrela desde el ícono «{titulo}» y entra con {tipo === "sede" ? "el PIN del local" : "tu PIN"}.
      </div>
    );
  }

  const pasos = pasosInstalar(sistema);
  return (
    <section aria-labelledby="instalar-titulo" className="rounded-2xl border border-line bg-panel px-4 py-4 text-left">
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-accent">{tipo === "sede" ? "La app del local" : "Tu app"}</p>
      <h2 id="instalar-titulo" className="mt-1 font-display text-xl font-semibold uppercase leading-tight">
        {sistema === "otro" ? "Para el celular" : sistema === "ios" ? "Agrégala a tu iPhone" : "Instálala en tu celular"}
      </h2>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        {sistema === "otro"
          ? `Abre este enlace en el celular: queda un ícono «${titulo}» que abre directo aquí.`
          : tipo === "sede"
            ? `Queda un ícono «${titulo}» que abre directo en el PIN del local.`
            : `Queda un ícono «${titulo}» que abre directo aquí, sin buscar tu nombre.`}
      </p>

      {sistema === "android" && aviso && (
        <button
          type="button"
          onClick={instalar}
          className="mt-3 flex min-h-11 w-full items-center justify-center rounded-full bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] px-4 text-[13px] font-bold uppercase tracking-wide text-on-accent"
        >
          Instalar «{titulo}»
        </button>
      )}

      {sistema !== "otro" && (
        <>
          {sistema === "android" && aviso && <p className="mt-3 text-[12px] text-muted">O desde el menú de Chrome:</p>}
          <ol className="mt-3 grid gap-2">
            {pasos.map((p, i) => (
              <li key={i} className="flex gap-2.5 text-[13px] leading-snug text-ink">
                <span
                  aria-hidden
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line text-[12px] font-bold text-muted"
                >
                  {i + 1}
                </span>
                <span className="pt-0.5">{p}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 border-t border-line/60 pt-3 text-[12px] leading-relaxed text-muted">
            {sistema === "ios"
              ? `La primera vez que la abras, entra con ${tipo === "sede" ? "el PIN del local" : "tu PIN"}: el iPhone guarda la sesión de la app aparte de Safari.`
              : `Ábrela desde el ícono y entra con ${tipo === "sede" ? "el PIN del local" : "tu PIN"}.`}
          </p>
        </>
      )}
    </section>
  );
}

export function EntradaPersonal({
  destino,
  titulo,
  entrada,
  sesion,
}: {
  destino: Destino;
  /** "B&B Meyer": lo que dice debajo del ícono. */
  titulo: string;
  entrada: "suya" | "otra" | "pin";
  /** Quién tiene la sesión abierta (para "Entraste como X"). */
  sesion: { nombre: string; esSede: boolean };
}) {
  const router = useRouter();
  const entorno = useEntorno();
  const [cambiado, setCambiado] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const esSede = destino.tipo === "sede";
  const quien = nombreCorto(destino.nombre);
  // "Entraste como Kevin" / "como el mostrador"; "la sesión de Kevin" / "del mostrador".
  const otro = sesion.esSede ? "el mostrador" : sesion.nombre.trim() ? nombreCorto(sesion.nombre) : "otra persona";
  const deOtro = sesion.esSede ? "del mostrador" : `de ${otro}`;

  // Su sesión, dentro de la app instalada: no hay nada que mostrar, a su agenda.
  useEffect(() => {
    if (entrada === "suya" && entorno === "instalada") router.replace("/barbero");
  }, [entrada, entorno, router]);

  async function cambiar() {
    setSaliendo(true);
    // Sus avisos dejan de sonar en este aparato (lo mismo que "Cerrar sesión").
    await soltarAvisosAlSalir();
    // Solo ESTE aparato: X sigue con su sesión en su propio celular, y el
    // mostrador en los demás aparatos del local.
    await supabaseBrowser().auth.signOut({ scope: "local" }).catch(() => null);
    setCambiado(true);
    setSaliendo(false);
    router.refresh();
  }

  const tarjeta = entorno && entorno !== "instalada" && <InstalarApp sistema={entorno} titulo={titulo} tipo={destino.tipo} />;

  let cuerpo: ReactNode;
  if (entrada === "suya") {
    cuerpo = (
      <div className="text-center">
        <Avatar d={destino} />
        <h1 className="mt-3 font-display text-2xl font-semibold">
          {entorno === "instalada" ? "Abriendo tu agenda…" : esSede ? `Mostrador · ${destino.nombre}` : `Ya entraste, ${nombreCorto(destino.nombre)}`}
        </h1>
        {entorno !== "instalada" && (
          <Link
            href="/barbero"
            className="mt-5 flex min-h-11 w-full items-center justify-center rounded-full bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] px-4 text-sm font-semibold uppercase tracking-wide text-on-accent"
          >
            {esSede ? "Abrir el mostrador" : "Abrir mi agenda"}
          </Link>
        )}
      </div>
    );
  } else if (entrada === "otra" && !cambiado) {
    cuerpo = (
      <div className="text-center">
        <Avatar d={destino} />
        <p className="mt-4 text-[12px] font-bold uppercase tracking-[0.2em] text-muted">
          {esSede ? `App del mostrador de ${destino.nombre}` : `App de ${destino.nombre}`}
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold">Entraste como {otro}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          En este aparato está abierta la sesión {deOtro}. ¿Quién la va a usar ahora?
        </p>
        <div className="mt-5 grid gap-2.5">
          <button
            type="button"
            onClick={cambiar}
            disabled={saliendo}
            className="flex min-h-11 w-full items-center justify-center rounded-full bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] px-4 text-sm font-semibold uppercase tracking-wide text-on-accent disabled:opacity-50"
          >
            {saliendo ? "Cerrando la sesión…" : esSede ? "Cambiar al mostrador" : `Cambiar a ${quien}`}
          </button>
          <Link
            href="/equipo"
            className="flex min-h-11 w-full items-center justify-center rounded-full border border-line px-4 text-sm font-semibold uppercase tracking-wide text-ink transition hover:border-accent/50"
          >
            Seguir como {otro}
          </Link>
        </div>
        <p className="mt-3 text-[12px] text-muted">Cambiar cierra la sesión {deOtro} solo en este aparato.</p>
      </div>
    );
  } else {
    cuerpo = <BarberoPinLogin fijo={destino} />;
  }

  return (
    <div className="mx-auto grid w-full max-w-sm gap-6">
      {tarjeta}
      {cuerpo}
    </div>
  );
}

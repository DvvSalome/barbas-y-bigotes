"use client";

// Card de calificación post-servicio. Vive en dos lados:
//  · /cuenta: la visita pendiente (o null). Se renderiza SIEMPRE desde el server
//    component: así la instancia sobrevive al re-render que dispara
//    revalidatePath("/cuenta") en la action y la pantalla de gracias no desaparece.
//  · /calificar/[token]: el enlace del correo de postventa, sin login. `inicial`
//    trae la estrella que tocó en el correo.
//
// Tres toques: estrellas (ya vienen marcadas desde el correo) → chips de lo que
// le gustó o lo que falló → "Tu reseña" ya escrita, que puede cambiar → Enviar.
// El dueño lo pidió así: a mano la gente no escribe, o escribe "bien" u "ok".
//
// Google se ofrece a TODOS después de calificar, con el mismo texto, el mismo
// botón y en la misma posición sea cual sea la nota. Mandar a Google solo a los
// contentos es "review gating": lo prohíbe la política de Google (ver 0035) y
// puede costar las reseñas de la ficha. A los de 1-3 se les ofrece ADEMÁS
// hablar con el dueño, debajo, sin quitarles el botón de Google. Nunca se
// publica por el cliente: él pega y publica.

import { useEffect, useRef, useState } from "react";
import { calificarServicio, calificarPorToken, redactarResena } from "@/lib/cliente-actions";
import { chipsPara, componerResena, esBuena, pareceGenerado, TOPE_EXTRA, TOPE_RESENA } from "@/lib/resena-texto";
import { ArrowRightIcon, CheckIcon, RepeatIcon, StarIcon } from "@/components/icons";

export type VisitaPendiente = {
  /** /cuenta: la cita a calificar. */
  reservaId?: string;
  /** /calificar/[token]: el enlace del correo. */
  token?: string;
  servicio: string;
  barbero: string;
  fecha: string; // ya formateada en el server (TZ Bogotá)
};

const WA_NEGOCIO = "573006734799";
const WA_TEXTO = "Hola, acabo de calificar mi visita a Barbas & Bigotes y quiero contarles cómo me fue.";

const CTA =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] px-6 py-3 text-sm font-semibold uppercase tracking-wide text-on-accent shadow-[0_12px_26px_-10px_rgba(210,63,52,0.7)] transition hover:brightness-105 disabled:opacity-50 disabled:shadow-none";
const SECUNDARIO =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-line bg-bg px-5 py-3 text-sm font-semibold text-ink transition hover:border-ink/30 disabled:opacity-50";

const NOMBRE_NOTA = ["", "Mala", "Floja", "Regular", "Buena", "Excelente"];

function WhatsAppIcono({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.43 9.43 0 0 1-4.8-1.32l-.35-.2-3.57.93.95-3.48-.22-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.21 4.24-9.45 9.46-9.45 2.52 0 4.9.99 6.68 2.77a9.4 9.4 0 0 1 2.77 6.69c0 5.21-4.24 9.45-9.46 9.45zm8.05-17.5A11.33 11.33 0 0 0 12.04.66C5.77.66.66 5.77.66 12.04c0 2 .52 3.96 1.52 5.69L.57 23.6l6.01-1.58a11.37 11.37 0 0 0 5.45 1.39h.01c6.27 0 11.38-5.11 11.38-11.38 0-3.04-1.18-5.9-3.33-8.03z" />
    </svg>
  );
}

/** Respaldo para navegadores sin navigator.clipboard (o que lo niegan). */
function copiarConSeleccion(texto: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = texto;
    ta.setAttribute("readonly", "");
    // 16 px: con menos, iOS hace zoom al seleccionar.
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px;";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, texto.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Copia al portapapeles. Hay que llamarla DENTRO del toque del cliente (sin un
 * await antes): los navegadores solo dejan escribir el portapapeles así.
 */
async function copiar(texto: string): Promise<boolean> {
  if (!texto) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // Negado o sin permiso: va el respaldo.
  }
  return copiarConSeleccion(texto);
}

/** Pantalla de gracias. También la usa /calificar cuando la visita ya estaba calificada. */
export function GraciasCalificacion({
  googleUrl,
  ya = false,
  texto = "",
  copiado = false,
  bajo = false,
  enfocar = false,
}: {
  googleUrl: string | null;
  ya?: boolean;
  /** El texto que envió: es el que se pega en Google. */
  texto?: string;
  /** Ya quedó en el portapapeles (se copió al tocar "Enviar"). */
  copiado?: boolean;
  /** Nota de 1 a 3: además de Google, la puerta para hablar con el dueño. */
  bajo?: boolean;
  /** Recién enviada: el foco va al título (el botón que tocó ya no existe y el lector de pantalla quedaba mudo). */
  enfocar?: boolean;
}) {
  const [estadoCopia, setEstadoCopia] = useState<"ok" | "fallo" | null>(copiado ? "ok" : null);
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (enfocar) titulo.current?.focus();
  }, [enfocar]);

  function abrirGoogle() {
    // Sin preventDefault: el enlace abre Google en otra pestaña mientras se
    // copia (de nuevo, por si el portapapeles se perdió en el camino).
    if (!texto) return;
    void copiar(texto).then((ok) => setEstadoCopia(ok ? "ok" : "fallo"));
  }

  return (
    <section className="mb-8 rounded-2xl border border-accent/40 bg-accent/5 p-5 text-center">
      <h3 ref={titulo} tabIndex={-1} className="font-display text-xl font-bold uppercase focus:outline-none">
        {ya ? "Ya calificaste esta visita" : "¡Gracias por contarnos!"}
      </h3>
      <p className="mt-2 text-sm text-muted">Tu calificación ya le llegó a la barbería.</p>

      {/* El MISMO bloque para todas las notas: mismo texto, mismo botón, mismo lugar. */}
      {googleUrl && (
        <div className="mt-5 border-t border-line pt-5">
          <h4 className="font-display text-lg font-bold uppercase">¿La publicas en Google?</h4>
          {texto ? (
            <>
              <p className="mt-1 text-sm text-muted">
                {estadoCopia === "ok"
                  ? "Ya te copiamos el texto: en Google mantén presionado el cuadro y toca Pegar."
                  : "Toca el botón: copiamos tu texto y te abrimos Google. Allá mantén presionado el cuadro y toca Pegar."}
              </p>
              <blockquote className="mt-3 rounded-xl border border-line bg-bg/70 px-4 py-3 text-left text-sm leading-relaxed text-ink/90 select-all">
                {texto}
              </blockquote>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">Ayuda a que más gente nos encuentre.</p>
          )}
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={abrirGoogle}
            className={`${CTA} mt-4 w-full sm:w-auto`}
          >
            {texto ? (estadoCopia === "ok" ? "Abrir Google" : "Copiar y abrir Google") : "Escribir mi reseña en Google"}
          </a>
          {estadoCopia === "fallo" && (
            <p className="mt-2 text-xs text-muted" role="status">
              No se pudo copiar solo: mantén presionado el texto de arriba para copiarlo.
            </p>
          )}
        </div>
      )}

      {bajo && (
        <div className="mt-5 border-t border-line pt-5">
          <p className="text-sm font-semibold text-ink">Ya le avisamos al dueño y te va a escribir.</p>
          <p className="mt-1 text-sm text-muted">Si prefieres, escríbele tú ya.</p>
          <a
            href={`https://wa.me/${WA_NEGOCIO}?text=${encodeURIComponent(WA_TEXTO)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`${SECUNDARIO} mt-3 w-full sm:w-auto`}
          >
            <WhatsAppIcono className="h-5 w-5 text-[#25d366]" />
            Escribirle por WhatsApp
          </a>
        </div>
      )}
    </section>
  );
}

type Final = { googleUrl: string | null; texto: string; copiado: boolean; bajo: boolean; enfocar: boolean };

export function CalificarServicio({
  pendiente,
  inicial = 0,
  conIA = false,
}: {
  pendiente: VisitaPendiente | null;
  inicial?: number;
  /** Hay llave de IA en el servidor: el texto lo redacta Claude (si no, la plantilla, al instante). */
  conIA?: boolean;
}) {
  const [score, setScore] = useState(inicial >= 1 && inicial <= 5 ? Math.round(inicial) : 0);
  const [sel, setSel] = useState<string[]>([]);
  const [extra, setExtra] = useState("");
  const [paso, setPaso] = useState<"calificar" | "texto">("calificar");
  const [texto, setTexto] = useState("");
  const [version, setVersion] = useState(0);
  const [redactando, setRedactando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [final, setFinal] = useState<Final | null>(null);
  // Lo que se usó para armar el texto: si vuelve atrás sin cambiar nada, no se
  // le reescribe lo que ya tenía (ni se gasta otra redacción).
  const firmaTexto = useRef("");
  const pedido = useRef(0);
  // Lo ÚLTIMO que le armamos. Es lo que va como "anterior" en Otra versión (no
  // lo que tenga en el cuadro, que es texto libre suyo y no tiene por qué ir a
  // la IA) y contra lo que se mide si lo que envía sigue siendo "texto armado".
  const ultimoArmado = useRef("");
  // Al cambiar de paso el botón que tocó desaparece y el foco caía al body: se
  // lleva al título del paso nuevo. No en la primera pintada (en /cuenta
  // saltaría la página hasta acá).
  const tituloPaso = useRef<HTMLHeadingElement>(null);
  const pasoPrevio = useRef(paso);
  useEffect(() => {
    if (pasoPrevio.current !== paso) tituloPaso.current?.focus();
    pasoPrevio.current = paso;
  }, [paso]);

  // Pantalla de gracias: persiste aunque el server ya no mande visita pendiente.
  if (final) return <GraciasCalificacion {...final} />;

  if (!pendiente) return null;
  const visita = pendiente;

  const chips = chipsPara(score, visita.servicio);
  // Lo marcado que vale para ESTA nota (si pasa de 5 a 2 y vuelve, lo de 5 sigue ahí).
  const marcadas = sel.filter((id) => chips.some((c) => c.id === id));
  const semilla = visita.token ?? visita.reservaId ?? "visita";

  function alternar(id: string) {
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function armado(t: string) {
    ultimoArmado.current = t;
    setTexto(t);
  }

  async function redactar(v: number, anterior: string | null) {
    const local = () => componerResena({ score, etiquetas: marcadas, extra, semilla, version: v, evitar: anterior });
    setVersion(v);
    setErr(null);
    if (!conIA) {
      armado(local());
      return;
    }
    const mio = ++pedido.current;
    setRedactando(true);
    try {
      const res = await redactarResena({
        token: visita.token,
        reservaId: visita.reservaId,
        score,
        etiquetas: marcadas,
        extra,
        version: v,
        anterior: anterior ?? undefined,
      });
      if (mio !== pedido.current) return; // llegó tarde: ya pidió otra
      if (res.ok && res.texto) {
        armado(res.texto);
      } else if (!res.ok && res.error) {
        // Enlace vencido o visita ya calificada: guardar tampoco va a poder.
        setErr(res.error);
        armado(local());
      } else {
        armado(local());
      }
    } catch {
      if (mio === pedido.current) armado(local());
    } finally {
      if (mio === pedido.current) setRedactando(false);
    }
  }

  function siguiente() {
    if (score < 1) return;
    setPaso("texto");
    const firma = JSON.stringify([score, marcadas, extra.trim()]);
    if (firma === firmaTexto.current && texto) return;
    firmaTexto.current = firma;
    void redactar(0, null);
  }

  async function enviar() {
    if (score < 1 || busy || redactando) return;
    const textoFinal = texto.trim();
    // Se copia en ESTE toque (antes de cualquier await): así la pantalla de
    // gracias ya puede decir "te copiamos el texto" sin otro toque.
    const copia = copiar(textoFinal);
    setBusy(true);
    setErr(null);
    try {
      const datos = {
        score,
        comentario: textoFinal || undefined,
        etiquetas: marcadas,
        // Retocado sigue siendo "armado"; reescrito entero ya es suyo.
        textoGenerado: pareceGenerado(textoFinal, ultimoArmado.current),
      };
      const res = visita.token
        ? await calificarPorToken({ token: visita.token, ...datos })
        : await calificarServicio({ reservaId: visita.reservaId ?? "", ...datos });
      if (!res.ok) {
        setErr(res.error ?? "No se pudo enviar. Intenta de nuevo.");
        return;
      }
      setFinal({ googleUrl: res.googleReviewUrl ?? null, texto: textoFinal, copiado: await copia, bajo: score <= 3, enfocar: true });
    } catch {
      // Falla de red: no dejar el botón colgado en "Enviando…".
      setErr("No se pudo enviar. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-8 rounded-2xl border border-line bg-panel p-5">
      <div className="font-display text-[11px] font-bold uppercase tracking-[0.3em] text-accent-soft">Tu opinión</div>

      {paso === "calificar" ? (
        <>
          <h3 ref={tituloPaso} tabIndex={-1} className="mt-1 font-display text-2xl font-bold uppercase focus:outline-none">
            ¿Cómo estuvo tu visita?
          </h3>
          <p className="mt-1 text-sm text-muted">
            {visita.servicio} · {visita.barbero} · {visita.fecha}
          </p>

          {/* Con wrap: en 360 px las 5 estrellas + "Excelente" no caben en una fila. */}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex gap-1" role="group" aria-label="Calificación de 1 a 5 estrellas">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  type="button"
                  key={n}
                  onClick={() => setScore(n)}
                  aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
                  aria-pressed={score === n}
                  className="rounded-lg p-1 transition hover:scale-110"
                >
                  <StarIcon className={`h-10 w-10 ${n <= score ? "fill-current text-accent" : "text-line"}`} />
                </button>
              ))}
            </div>
            <span className="text-sm font-semibold text-ink" aria-live="polite">
              {NOMBRE_NOTA[score]}
            </span>
          </div>

          {score >= 1 && (
            <div className="mt-5">
              <h4 className="font-display text-lg font-bold uppercase">
                {esBuena(score) ? "¿Qué te gustó?" : "¿Qué falló?"}
              </h4>
              <p className="text-xs text-muted">Toca todo lo que aplique.</p>
              <div
                className="mt-3 flex flex-wrap gap-2"
                role="group"
                aria-label={esBuena(score) ? "Lo que te gustó" : "Lo que falló"}
              >
                {chips.map((c) => {
                  const on = marcadas.includes(c.id);
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => alternar(c.id)}
                      aria-pressed={on}
                      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[14px] transition ${
                        on
                          ? "border-accent bg-accent/15 font-semibold text-ink"
                          : "border-line bg-bg text-ink/85 hover:border-ink/30"
                      }`}
                    >
                      {on && <CheckIcon className="h-4 w-4 text-accent-soft" />}
                      {c.label}
                    </button>
                  );
                })}
              </div>

              <label className="mt-4 block">
                <span className="sr-only">¿Algo más? (opcional)</span>
                <input
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  placeholder="¿Algo más? (opcional)"
                  maxLength={TOPE_EXTRA}
                  enterKeyHint="next"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      siguiente();
                    }
                  }}
                  className="min-h-12 w-full rounded-lg border border-line bg-bg px-3 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none sm:text-sm"
                />
              </label>
            </div>
          )}

          <button type="button" onClick={siguiente} disabled={score < 1} className={`${CTA} mt-5 w-full sm:w-auto`}>
            Siguiente
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setPaso("calificar")}
            className="-ml-1 mt-1 inline-flex min-h-11 items-center gap-1 px-1 text-sm text-muted underline decoration-line underline-offset-4 transition hover:text-ink"
          >
            ← Cambiar lo que marqué
          </button>
          <h3 ref={tituloPaso} tabIndex={-1} className="mt-1 font-display text-2xl font-bold uppercase focus:outline-none">
            Tu reseña
          </h3>
          <p className="mt-1 text-sm text-muted">Te dejamos el texto listo, cámbialo si quieres.</p>
          {/* Para el lector de pantalla: el esqueleto se cambia por el cuadro
              con el texto y nadie le avisaba que ya estaba. */}
          <p className="sr-only" aria-live="polite">
            {redactando ? "Armando tu reseña…" : "Tu reseña está lista: puedes cambiarla antes de enviarla."}
          </p>

          {redactando ? (
            <div className="mt-4 min-h-[8.5rem] rounded-lg border border-line bg-bg px-3 py-3" aria-hidden>
              <div className="h-3.5 w-11/12 animate-pulse rounded bg-line" />
              <div className="mt-2.5 h-3.5 w-10/12 animate-pulse rounded bg-line" />
              <div className="mt-2.5 h-3.5 w-7/12 animate-pulse rounded bg-line" />
              <p className="mt-4 text-xs text-muted">Armando tu reseña…</p>
            </div>
          ) : (
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              aria-label="Tu reseña"
              placeholder="Cuéntanos cómo te fue"
              rows={5}
              maxLength={TOPE_RESENA}
              className="mt-4 w-full rounded-lg border border-line bg-bg px-3 py-3 text-base leading-relaxed text-ink placeholder:text-muted focus:border-accent focus:outline-none sm:text-sm"
            />
          )}

          {err && (
            <div role="alert" className="mt-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">
              {err}
            </div>
          )}

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void redactar(version + 1, ultimoArmado.current || null)}
              disabled={redactando || busy}
              className={SECUNDARIO}
            >
              <RepeatIcon className="h-4 w-4" />
              Otra versión
            </button>
            <button type="button" onClick={enviar} disabled={busy || redactando} className={`${CTA} sm:flex-1`}>
              {busy ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

import Link from "next/link";
import Image from "next/image";
import { cop } from "@/lib/format";
import { CANCELACION_MIN_HORAS } from "@/lib/slots";
import { categorias } from "@/lib/data/seed";
import type { Barbero, Sede, Servicio } from "@/lib/data/types";
import { Inclinable } from "@/components/propuesta/Islas";
import css from "./propuesta.module.css";

/*
  Las secciones de la propuesta «La pared del local». Server components: todo
  el contenido va en el HTML (buscadores, IA y quien entra sin JS). Las únicas
  islas son la inclinación de la pared y la barra del celular (Islas.tsx).

  Regla de copy: cada bloque termina en un atajo real a /reservar con lo que ya
  se sabe (sede, servicio o barbero), no en un "saber más".
*/

export const WHATSAPP = `https://wa.me/573006734799?text=${encodeURIComponent("Hola, quiero reservar una cita en Barbas & Bigotes.")}`;
const CTA =
  "inline-flex min-h-[52px] items-center justify-center rounded-full bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] px-7 font-display text-[17px] font-bold uppercase tracking-[0.06em] text-on-accent shadow-[0_14px_30px_-12px_rgba(173,47,36,0.8)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-soft";
const H2 = "font-display text-[40px] font-extrabold uppercase leading-[0.92] tracking-tight text-ink sm:text-[56px]";
const nombreCorto = (n: string) => n.split(" (")[0];
const detalle = (n: string) => n.match(/\(([^)]+)\)/)?.[1] ?? "";

function WhatsAppIcono({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.43 9.43 0 0 1-4.8-1.32l-.35-.2-3.57.93.95-3.48-.22-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.21 4.24-9.45 9.46-9.45 2.52 0 4.9.99 6.68 2.77a9.4 9.4 0 0 1 2.77 6.69c0 5.21-4.24 9.45-9.46 9.45zm8.05-17.5A11.33 11.33 0 0 0 12.04.66C5.77.66.66 5.77.66 12.04c0 2 .52 3.96 1.52 5.69L.57 23.6l6.01-1.58a11.37 11.37 0 0 0 5.45 1.39h.01c6.27 0 11.38-5.11 11.38-11.38 0-3.04-1.18-5.9-3.33-8.03z" />
    </svg>
  );
}

function BotonWhatsApp({ grande = false }: { grande?: boolean }) {
  return (
    <a
      href={WHATSAPP}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribir por WhatsApp"
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-line text-ink transition hover:border-ink/40 ${
        grande ? "min-h-[52px] px-6 text-[15px] font-semibold" : "h-[52px] w-[52px]"
      }`}
    >
      <WhatsAppIcono className="h-6 w-6 text-[#25d366]" />
      {grande && "Escríbenos"}
    </a>
  );
}

const CORTES = [
  "Corte corto con degradado, visto de perfil",
  "Degradado alto con la parte de arriba corta",
  "Degradado en la nuca, visto de espaldas bajo el techo de luces",
  "Degradado bajo con el pelo peinado hacia atrás",
  "Degradado con twists arriba y barba perfilada",
  "Diseño de líneas en el degradado, con barba",
  "Degradado bajo con textura arriba, visto de espaldas",
];

/* ── 1. Hero: la pared del local ─────────────────────────────────────────── */
type FotoPared = { src: string; alt: string; pos?: string };

// Los cortes de la tira de abajo, en el mismo orden (los alt viven en CORTES).
const LOCAL: FotoPared[] = [
  { src: "/sedes/plaza-de-la-paz-interior.jpg", alt: "Las sillas bajo el techo de luces de Plaza de la Paz", pos: "52% 45%" },
  { src: "/sedes/plaza-de-la-paz-frente.jpg", alt: "La entrada de Plaza de la Paz de noche, con el letrero prendido", pos: "50% 42%" },
  { src: "/sedes/parque-venezuela-interior.jpg", alt: "El local de Parque Venezuela", pos: "42% 55%" },
  { src: "/sedes/parque-venezuela-frente.jpg", alt: "La vitrina de Parque Venezuela, de día", pos: "50% 45%" },
];

/**
 * La pared: cortes, caras y local intercalados, repartidos en 5 columnas (en
 * celular el CSS muestra 2). Cada columna lleva sus fotos dos veces para que el
 * bucle sea continuo: la animación corre exactamente la mitad de la altura.
 */
function armarPared(barberos: Barbero[]): FotoPared[][] {
  const cortes: FotoPared[] = CORTES.map((alt, i) => ({ src: `/cortes/corte-${i + 1}.jpg`, alt }));
  const caras: FotoPared[] = barberos.filter((b) => b.fotoUrl).map((b) => ({ src: b.fotoUrl!, alt: `${b.nombre}, barbero`, pos: "50% 20%" }));
  const mezcla: FotoPared[] = [];
  const colas = [cortes, caras, LOCAL];
  // corte, cara, corte, local, corte, cara… hasta vaciar las tres colas.
  const orden = [0, 1, 0, 2];
  let k = 0;
  while (colas.some((c) => c.length)) {
    const cola = colas[orden[k % orden.length]];
    if (cola.length) mezcla.push(cola.shift()!);
    k++;
  }
  const columnas: FotoPared[][] = [[], [], [], [], []];
  mezcla.forEach((foto, i) => columnas[i % 5].push(foto));
  return columnas;
}

const DURACIONES = ["78s", "96s", "86s", "104s", "90s"];

function Pared({ barberos }: { barberos: Barbero[] }) {
  const columnas = armarPared(barberos);
  let n = 0;
  return (
    <div className={css.escena} aria-hidden>
      <Inclinable className={css.pared}>
        {columnas.map((fotos, c) => (
          <ul key={c} className={css.columna} style={{ "--dur": DURACIONES[c], "--desfase": `${-c * 23}s` } as React.CSSProperties}>
            {[...fotos, ...fotos].map((f, i) => (
              <li key={i} className={css.foto} style={{ "--i": n++ } as React.CSSProperties}>
                <Image
                  src={f.src}
                  alt=""
                  fill
                  sizes="(max-width: 1023px) 54vw, 21vw"
                  quality={55}
                  // Las columnas 3 a 5 van display:none en celular: con lazy no se
                  // bajan (un <img> eager se descarga aunque esté escondido).
                  loading={c < 2 ? "eager" : "lazy"}
                  fetchPriority={c < 2 && i < 2 ? "high" : "auto"}
                  style={f.pos ? { objectPosition: f.pos } : undefined}
                />
              </li>
            ))}
          </ul>
        ))}
      </Inclinable>
      <div className={css.velo} />
    </div>
  );
}

export function Hero({ barberos }: { barberos: Barbero[] }) {
  return (
    <section className="relative isolate overflow-hidden">
      <Pared barberos={barberos} />

      {/* pointer-events-none en la caja: así el puntero llega a las fotos de la
          pared que quedan a la derecha del texto (la caja mide todo el ancho).
          El texto arranca a media pantalla; en teléfonos bajitos (640 px) sube lo
          justo para que el botón quede dentro del primer pantallazo. */}
      <div className="pointer-events-none relative mx-auto max-w-6xl px-5 pb-10 pt-[min(50svh,100svh_-_380px)] lg:flex lg:min-h-[calc(100svh-84px)] lg:flex-col lg:justify-center lg:pb-16 lg:pt-0">
        <div className="pointer-events-auto max-w-xl">
          <h1>
            <span className={`${css.sube} block text-[15px] font-semibold tracking-[0.02em] text-ink/80`} style={{ "--t": "0.15s" } as React.CSSProperties}>
              Barbas &amp; Bigotes Barbershop
            </span>
            <span
              className={`${css.sube} mt-2 block font-display text-[clamp(44px,12.5vw,58px)] font-extrabold uppercase leading-[0.9] tracking-tight text-ink lg:text-[92px]`}
              style={{ "--t": "0.25s" } as React.CSSProperties}
            >
              Aparta tu silla sin hacer fila
            </span>
          </h1>
          <p className={`${css.sube} mt-4 max-w-[34ch] text-[16px] leading-relaxed text-ink/85 lg:text-[19px]`} style={{ "--t": "0.4s" } as React.CSSProperties}>
            Es nuestra app de reservas: escoges sede, barbero y hora, y te confirmamos al instante.
          </p>
          <div data-cta className={`${css.sube} mt-6 flex items-center gap-3`} style={{ "--t": "0.5s" } as React.CSSProperties}>
            <Link href="/reservar?desde=hero" className={`${CTA} flex-1 lg:flex-none`}>
              Reservar mi cita
            </Link>
            <BotonWhatsApp />
          </div>
          <p className={`${css.sube} mt-3 text-[13px] leading-snug text-muted`} style={{ "--t": "0.6s" } as React.CSSProperties}>
            Reservar es gratis y pagas en el local. Si te sale algo, cancelas hasta {CANCELACION_MIN_HORAS} horas antes.
          </p>
        </div>

        {/* Las caras: en una barbería se vuelve por el barbero, no por el local.
            Arrancan en gris y se encienden al pasar por encima (regla del sitio). */}
        <div className={`${css.sube} pointer-events-auto mt-8 max-w-xl`} style={{ "--t": "0.75s" } as React.CSSProperties}>
          <p className="text-[13px] font-semibold text-ink">Reserva directo con tu barbero</p>
          <ul className="mt-3 flex flex-wrap gap-2.5">
            {barberos.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/reservar?barbero=${b.id}&sede=${b.sede}&desde=hero-cara`}
                  aria-label={`Reservar con ${b.nombre}`}
                  className={`${css.gris} group flex flex-col items-center gap-1.5`}
                >
                  <span className="relative block h-14 w-14 overflow-hidden rounded-full ring-2 ring-line transition group-hover:ring-ink/60 lg:h-16 lg:w-16">
                    {b.fotoUrl ? (
                      <Image src={b.fotoUrl} alt="" fill sizes="128px" className="origin-[50%_18%] scale-[1.7] object-cover object-top" />
                    ) : (
                      <span className="grid h-full w-full place-items-center bg-elevated font-display text-lg font-bold">{b.nombre[0]}</span>
                    )}
                  </span>
                  <span className="text-[12px] text-muted transition group-hover:text-ink">{b.nombre.split(" ")[0]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ── 2. La carta: lo que cuesta, por sede ───────────────────────────────── */
const DESTACADOS = ["corte", "corte-barba", "corte-cejas", "corte-barba-cejas", "cerquillos"];

export function LaCarta({ servicios, sedes }: { servicios: Servicio[]; sedes: Sede[] }) {
  const destacados = DESTACADOS.map((id) => servicios.find((s) => s.id === id)).filter((s): s is Servicio => !!s);
  const porCategoria = Object.entries(categorias)
    .map(([c, etiqueta]) => ({ etiqueta, items: servicios.filter((s) => s.categoria === c) }))
    .filter((g) => g.items.length);
  return (
    <section id="precios" className={`${css.carta} mx-auto max-w-6xl px-5 py-20 lg:grid lg:grid-cols-[1fr_1.3fr] lg:gap-16`}>
      <div>
        <h2 className={H2}>Lo que cuesta</h2>
        <p className="mt-4 max-w-[36ch] text-[16px] leading-relaxed text-ink/80">
          Los precios de cada sede, como en la carta pegada en la pared. El que ves es el que pagas en el local.
        </p>
        {/* La sede se elige sin JavaScript: radios y :has() en el CSS. */}
        <fieldset className="mt-6 inline-flex gap-1 rounded-full border border-line p-1">
          <legend className="sr-only">Ver los precios de la sede</legend>
          {sedes.map((s, i) => (
            <label key={s.id} className={`${css.opcion} inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-[14px] font-semibold text-muted transition`}>
              <input type="radio" name="sede-carta" value={s.id} defaultChecked={i === 0} className="sr-only" />
              {s.nombre}
            </label>
          ))}
        </fieldset>
      </div>

      <div className="mt-8 lg:mt-2">
        {sedes.map((s) => (
          <ul key={s.id} data-sede={s.id} className="divide-y divide-line">
            {destacados
              .filter((sv) => sv.precios[s.id] != null)
              .map((sv) => (
                <li key={sv.id}>
                  <Link
                    href={`/reservar?sede=${s.id}&servicio=${sv.id}&desde=carta`}
                    aria-label={`Reservar ${nombreCorto(sv.nombre)} en ${s.nombre}, ${cop(sv.precios[s.id] ?? 0)}`}
                    className="group flex items-end gap-3 py-4"
                  >
                    <span className="min-w-0">
                      <span className="block font-display text-[24px] font-bold uppercase leading-none text-ink transition group-hover:text-accent-soft sm:text-[28px]">
                        {nombreCorto(sv.nombre)}
                      </span>
                      <span className="mt-1.5 block text-[13px] text-muted">
                        {detalle(sv.nombre) ? `${detalle(sv.nombre)}, ` : ""}
                        {sv.duracionMin} min
                      </span>
                    </span>
                    <span aria-hidden className={css.puntos} />
                    <span className="shrink-0 font-display text-[28px] font-bold tabular-nums text-ink sm:text-[32px]">
                      {cop(sv.precios[s.id] ?? 0)}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        ))}

        <details className="group mt-6 border-t border-line pt-4">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
            Ver los {servicios.length} servicios y combos
            <span aria-hidden className="text-2xl text-muted transition group-open:rotate-45">+</span>
          </summary>
          <div className="mt-4 space-y-6">
            {porCategoria.map((g) => (
              <div key={g.etiqueta}>
                <h3 className="text-[14px] font-semibold text-muted">{g.etiqueta}</h3>
                <ul className="mt-2 divide-y divide-line/60">
                  {g.items.map((sv) => (
                    <li key={sv.id} className="flex items-baseline justify-between gap-4 py-2.5 text-[14px]">
                      <span className="min-w-0 text-ink">{sv.nombre}</span>
                      <span className="shrink-0 tabular-nums text-ink/80">
                        {sedes
                          .map((s) => sv.precios[s.id])
                          .filter((p): p is number => p != null)
                          .map((p) => cop(p))
                          .filter((p, i, a) => a.indexOf(p) === i)
                          .join(" / ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      </div>
    </section>
  );
}

/* ── 3. Escoge quién te corta ─────────────────────────────────────────────── */
export function Elenco({ barberos, sedes }: { barberos: Barbero[]; sedes: Sede[] }) {
  const sedeDe = (id: string) => sedes.find((s) => s.id === id)?.nombre ?? "";
  return (
    <section id="barberos" className="py-20">
      <div className="mx-auto max-w-6xl px-5">
        <h2 className={H2}>Escoge quién te corta</h2>
        <p className="mt-4 max-w-[40ch] text-[16px] leading-relaxed text-ink/80">
          {barberos.length} barberos en {sedes.length} sedes. Cada uno tiene su mano: reserva directo con el tuyo.
        </p>
      </div>
      {/* Celular: se desliza de lado y se asoma el siguiente. Escritorio: grilla.
          Las fotos arrancan en gris y se encienden al pasar por encima. */}
      <ul className={`${css.pelicula} mt-8 flex gap-4 overflow-x-auto px-5 pb-2 lg:mx-auto lg:grid lg:max-w-6xl lg:grid-cols-3 lg:overflow-visible`}>
        {barberos.map((b) => (
          <li key={b.id} className={`${css.fotograma} w-[76vw] max-w-[320px] shrink-0 lg:w-auto lg:max-w-none`}>
            <article className={`${css.gris} group relative overflow-hidden rounded-[22px] border border-line bg-panel`}>
              <div className="relative aspect-[3/4]">
                {b.fotoUrl ? (
                  <Image
                    src={b.fotoUrl}
                    alt={`${b.nombre}, barbero de ${sedeDe(b.sede)}`}
                    fill
                    sizes="(max-width:1023px) 76vw, 360px"
                    className="object-cover object-top group-hover:scale-[1.04]"
                  />
                ) : null}
                <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(12,11,10,0.94)_100%)]" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <h3 className="font-display text-[46px] font-extrabold uppercase leading-[0.85] text-ink">{b.nombre.split(" ")[0]}</h3>
                  <p className="mt-2 text-[14px] text-ink/85">{sedeDe(b.sede)}</p>
                  {b.especialidades.length > 0 && (
                    <p className="mt-0.5 text-[13px] text-muted">{b.especialidades.slice(0, 3).join(", ")}</p>
                  )}
                </div>
              </div>
              <div className="p-4 pt-3">
                <Link
                  href={`/reservar?barbero=${b.id}&sede=${b.sede}&desde=elenco`}
                  className="flex min-h-12 items-center justify-center rounded-full border border-line text-[14px] font-semibold text-ink transition hover:border-accent hover:bg-accent/10"
                >
                  Reservar con {b.nombre.split(" ")[0]}
                </Link>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── 4. Así salen de la silla ─────────────────────────────────────────────── */

export function TiraCortes() {
  return (
    <section className="py-20">
      <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-5">
        <div>
          <h2 className={H2}>Así salen de la silla</h2>
          <p className="mt-4 text-[16px] text-ink/80">Cortes de verdad, hechos en nuestras dos sedes.</p>
        </div>
        <a
          href="https://instagram.com/barbasybigotes.baq"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center text-[14px] font-semibold text-accent-soft underline decoration-accent-soft/40 underline-offset-4"
        >
          Más trabajos en Instagram
        </a>
      </div>
      <ul className={`${css.pelicula} mt-8 flex gap-3 overflow-x-auto px-5 pb-2`}>
        {CORTES.map((alt, i) => (
          <li key={i} className={`${css.fotograma} w-[64vw] max-w-[300px] shrink-0 sm:w-[300px]`}>
            <div className="relative aspect-[4/5] overflow-hidden rounded-[18px] bg-panel">
              <Image src={`/cortes/corte-${i + 1}.jpg`} alt={alt} fill sizes="(max-width:640px) 64vw, 300px" className="object-cover" />
            </div>
          </li>
        ))}
        <li className={`${css.fotograma} w-[64vw] max-w-[300px] shrink-0 sm:w-[300px]`}>
          <div className="flex aspect-[4/5] flex-col justify-end rounded-[18px] border border-line bg-panel p-6">
            <p className="font-display text-[34px] font-extrabold uppercase leading-[0.9] text-ink">¿Te gustó uno?</p>
            <p className="mt-3 text-[15px] leading-relaxed text-ink/80">Guárdalo y muéstraselo a tu barbero cuando te sientes.</p>
            <Link href="/reservar?servicio=corte&desde=galeria" className={`${CTA} mt-6`}>
              Reservar corte
            </Link>
          </div>
        </li>
      </ul>
    </section>
  );
}

/* ── 5. Así funciona la app (lo que pide el verificador de Google) ───────── */
const PASOS = [
  { t: "Escoges y apartas", d: "Eliges sede, servicio, barbero y hora. Ves solo las horas que de verdad están libres." },
  { t: "Te confirmamos", d: "Te llega la confirmación al instante, te recordamos antes de la cita y te avisamos si se libera un cupo antes." },
  { t: "Llegas y te sientas", d: `Sin fila. Si te sale algo, cancelas o cambias la hora tú mismo hasta ${CANCELACION_MIN_HORAS} horas antes.` },
];

export function ComoFunciona() {
  return (
    <section id="la-app" className="mx-auto max-w-6xl px-5 py-20">
      <div className="max-w-2xl">
        <h2 className={H2}>Así funciona la app</h2>
        <p className="mt-5 text-[16px] leading-relaxed text-ink/85">
          Esta aplicación se llama <b className="text-ink">Barbas &amp; Bigotes</b> y es el sistema de reservas de nuestra barbería en
          Barranquilla, Colombia. Con ella agendas tu cita por internet, miras tu historial de visitas y sigues tu tarjeta de cortes, sin
          llamar ni esperar en el local. La desarrolla y opera Barbas &amp; Bigotes Barbershop.
        </p>
      </div>
      {/* Un proceso de verdad, en orden: por eso lleva números. El hexágono es la
          forma del techo del local. */}
      <ol className="mt-10 grid gap-8 sm:grid-cols-3">
        {PASOS.map((p, i) => (
          <li key={p.t}>
            <span aria-hidden className="relative grid h-14 w-16 place-items-center">
              <svg viewBox="0 0 64 56" className="absolute inset-0 h-full w-full">
                <polygon points="16,2 48,2 62,28 48,54 16,54 2,28" fill="none" stroke="#fbf8f1" strokeWidth="2" />
              </svg>
              <span className="relative font-display text-[22px] font-bold text-ink">{i + 1}</span>
            </span>
            <h3 className="mt-4 font-display text-[26px] font-bold uppercase leading-none text-ink">{p.t}</h3>
            <p className="mt-2 max-w-[32ch] text-[15px] leading-relaxed text-ink/75">{p.d}</p>
          </li>
        ))}
      </ol>
      <p className="mt-10 max-w-2xl text-[14px] leading-relaxed text-muted">
        Entrar con Google es opcional: sirve para guardar tus citas y tu tarjeta de cortes, y solo usamos tu nombre, tu correo y tu foto.
        Usar la app es gratis. Mira cómo tratamos tu información en la{" "}
        <Link href="/privacidad" className="text-ink underline underline-offset-4">
          política de privacidad
        </Link>{" "}
        y las reglas de reserva en los{" "}
        <Link href="/terminos" className="text-ink underline underline-offset-4">
          términos y condiciones
        </Link>
        .
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/reservar?desde=app" className={CTA}>
          Reservar mi cita
        </Link>
        <Link href="/cuenta" className="inline-flex min-h-[52px] items-center rounded-full border border-line px-6 text-[15px] font-semibold text-ink transition hover:border-ink/40">
          Entrar a mi cuenta
        </Link>
      </div>
    </section>
  );
}

/* ── 6. El cierre: la puerta del local, de noche ─────────────────────────── */
export function Cierre() {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="relative mx-auto aspect-[4/3] w-full max-w-[520px] overflow-hidden rounded-[22px] bg-panel lg:order-2 lg:aspect-[4/5]">
          <Image
            src="/sedes/plaza-de-la-paz-frente.jpg"
            alt="La entrada de la sede Plaza de la Paz de noche, con el letrero y el poste de barbero prendidos"
            fill
            sizes="(max-width: 1023px) 92vw, 520px"
            className="object-cover object-[50%_38%]"
          />
        </div>
        <div>
          <h2 className="font-display text-[48px] font-extrabold uppercase leading-[0.9] tracking-tight text-ink sm:text-[72px]">
            Tu próxima silla está a un toque
          </h2>
          <p className="mt-4 max-w-[36ch] text-[16px] leading-relaxed text-ink/80">
            Escoge la hora que te sirve y llega directo a sentarte. Si tienes una duda, escríbenos.
          </p>
          <div data-cta className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/reservar?desde=cierre" className={CTA}>
              Reservar mi cita
            </Link>
            <BotonWhatsApp grande />
          </div>
        </div>
      </div>
    </section>
  );
}

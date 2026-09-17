import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ContactoWidget } from "@/components/ContactoWidget";
import { ClienteLoginButton } from "@/components/cuenta/ClienteAuth";
import { AdelantoBanner } from "@/components/cuenta/AdelantoBanner";
import { PushManager } from "@/components/cuenta/PushManager";
import { CitaAcciones } from "@/components/cuenta/CitaAcciones";
import { CalificarServicio } from "@/components/cuenta/CalificarServicio";
import { ensureCliente } from "@/lib/cliente-actions";
import { TarjetaFidelidad } from "@/components/cuenta/TarjetaFidelidad";
import { SEDE_INFO } from "@/lib/data/sede-info";
import { getCuenta, getReservaSinCalificar, getHorarioSemanal, getDiasEspeciales } from "@/lib/data/queries";

export const metadata: Metadata = { title: "Mi cuenta" };

const ESTADO: Record<string, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  en_curso: "En curso",
  completada: "Completada",
  cancelada: "Cancelada",
  no_show: "No llegó",
  esperando: "En espera",
  notificado: "¡Es tu turno!",
};

// Poste de barbero: motivo de marca reutilizado del sitio (rojo + hueso).
const POLE = "repeating-linear-gradient(150deg, var(--accent) 0 6px, var(--ink) 6px 12px)";

const WA_URL =
  "https://wa.me/573006734799?text=Hola%20Barbas%20%26%20Bigotes%2C%20quisiera%20saber%20m%C3%A1s%20informaci%C3%B3n%20sobre%20sus%20servicios%20y%20reservas.";

function fechaLarga(iso: string) {
  // Server component: sin timeZone explícito la hora saldría en UTC (Vercel).
  return new Date(iso).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** YYYY-MM-DD en Bogotá. en-CA da justo ese formato. */
const ymdBogota = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

/**
 * La fecha de la próxima cita, para leerla de un vistazo y de lejos: "hoy · 4:30 pm".
 * Va en mayúsculas dentro de un titular, así que "p. m." con puntos y espacios
 * queda horrible — se normaliza a "pm". Y si es hoy o mañana lo dice con esas
 * palabras: es lo que el cliente quiere saber, no qué día de la semana cae.
 */
function fechaHero(iso: string): string {
  const d = new Date(iso);
  const hoy = new Date();
  const manana = new Date(hoy.getTime() + 86400000);
  const y = ymdBogota(d);
  let dia: string;
  if (y === ymdBogota(hoy)) dia = "hoy";
  else if (y === ymdBogota(manana)) dia = "mañana";
  else
    dia = d.toLocaleDateString("es-CO", {
      timeZone: "America/Bogota",
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  const hora = d
    .toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" })
    .replace(/\s*a\.?\s*m\.?/i, " am")
    .replace(/\s*p\.?\s*m\.?/i, " pm")
    .trim();
  return `${dia} · ${hora}`;
}

/** La nota de la reserva puede traer una propuesta de adelanto pendiente. */
function adelantoPendiente(nota: string | null) {
  if (!nota) return null;
  try {
    const obj = JSON.parse(nota);
    if (obj.propuesta_adelanto?.estado === "pendiente") {
      return obj.propuesta_adelanto as { inicio: string; fin: string };
    }
  } catch {}
  return null;
}

export default async function CuentaPage() {
  const ctx = await ensureCliente();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full px-6 py-16">
        {ctx.estado === "anon" && (
          <div className="mx-auto max-w-md text-center">
            {/* Barra sólida: la rayada (POLE_MINI) a 6px de alto se pixelaba en
                mobile y se veía sucia arriba del kicker. */}
            <span aria-hidden className="mx-auto mb-6 block h-1 w-12 rounded-full bg-accent" />
            <p className="font-display text-[11px] font-bold uppercase tracking-[0.34em] text-accent-soft">
              Mi cuenta
            </p>
            <h1 className="mt-3 font-display text-5xl font-extrabold uppercase leading-[0.95] text-balance">
              Tu barbería,<br />en tu bolsillo
            </h1>
            <p className="mx-auto mt-4 max-w-[30ch] text-muted">
              Entra con tu Gmail y mira tus citas, tu lugar en la fila y tus puntos de fidelidad.
            </p>
            <div className="mt-9 flex justify-center">
              <ClienteLoginButton />
            </div>
            <p className="mt-6 text-xs text-muted">
              ¿Primera vez? También puedes{" "}
              <Link href="/reservar" className="text-accent-soft transition hover:text-accent">
                reservar sin cuenta →
              </Link>
            </p>
            <div className="mt-11 flex justify-center gap-2">
              {["Sin filas", "Puntos", "Recordatorios"].map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-line px-3 py-1 font-display text-[10px] font-bold uppercase tracking-[0.08em] text-muted"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {ctx.estado === "staff" && (
          <div className="mx-auto max-w-md text-center">
            <h1 className="font-display text-4xl font-semibold uppercase">Cuenta de staff</h1>
            <p className="mt-4 text-muted">Ingresaste con una cuenta del equipo. Usa tu panel:</p>
            <div className="mt-7 flex justify-center gap-3">
              <Link
                href="/admin"
                className="rounded-full bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] px-6 py-3 text-sm font-semibold uppercase tracking-wide text-on-accent shadow-[0_10px_24px_-8px_rgba(210,63,52,0.6)] transition hover:brightness-105"
              >
                Panel admin
              </Link>
              <Link
                href="/barbero"
                className="rounded-full border border-line px-6 py-3 text-sm transition hover:border-accent/50"
              >
                App del barbero
              </Link>
            </div>
          </div>
        )}

        {ctx.estado === "cliente" && (
          <Portal clienteId={ctx.clienteId ?? ""} nombre={ctx.nombre} avatarUrl={ctx.avatarUrl} />
        )}
      </main>
      <SiteFooter compacto={ctx.estado === "cliente"} />
      {/* Widget de contacto: en el proto vive en home y Mi cuenta (§2.11). Acá
          el globo arranca CERRADO: el cliente ya entró, y desplegado se paraba
          encima del título "Próximas citas". */}
      <ContactoWidget globoAbierto={false} />
    </>
  );
}

/*
  El portal del cliente, reordenado (16-sep, opción A de la propuesta).

  Antes todo iba en una columna de 672 px centrada en 1.440 —384 px de negro
  muerto a cada lado— y en este orden: saludo, un aviso de notificaciones con
  borde ROJO (que en esta app significa acción o alerta), la tarjeta de cortes,
  la tarjeta ilustrada, y recién entonces sus citas, a 900 px de scroll. El
  cliente entra a saber cuándo es su corte y era lo último que encontraba.

  Ahora manda la CITA: fecha grande y los dos botones que de verdad usa. Después
  su tarjeta, con el número en tamaño de titular y la tarjeta ilustrada —la del
  dueño, réplica de la física, sin tocar— debajo del dato. En escritorio son dos
  columnas: lo suyo a la izquierda, lo de la casa a la derecha.

  El orden del DOM es el del CELULAR, que es la prioridad; en `lg` cada bloque se
  coloca con col-start/row-start explícitos, así ninguno de los dos anchos depende
  de cómo caiga el otro.
*/
async function Portal({ clienteId, nombre, avatarUrl }: { clienteId: string; nombre?: string; avatarUrl?: string | null }) {
  const [{ proximas, pasadas, tarjeta, cola }, sinCalificar, horarioSemanal, diasEspeciales] = await Promise.all([
    getCuenta(clienteId),
    getReservaSinCalificar(clienteId),
    getHorarioSemanal(),
    getDiasEspeciales(),
  ]);

  // Los turnos llamados (notificado) son el momento estrella; la espera va aparte.
  // TODOS los notificado se renderizan como hero (puede haber más de uno); antes
  // .find() tomaba solo el primero y el resto se perdía sin mostrarse en ningún lado.
  const turnos = cola.filter((c) => c.estado === "notificado");
  const enEspera = cola.filter((c) => c.estado !== "notificado");
  const [siguiente, ...otrasCitas] = proximas;
  const tamTarjeta = tarjeta.cfg.tamano;

  return (
    <div className="mx-auto w-full max-w-2xl lg:max-w-5xl">
      {/* Encabezado */}
      <div className="mb-7 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto remota de Google; next/image exigiría configurar el dominio.
            <img
              src={avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="h-12 w-12 shrink-0 rounded-full border border-line object-cover"
            />
          ) : (
            <span aria-hidden className="h-8 w-2 rounded" style={{ background: POLE }} />
          )}
          <div>
            <p className="font-display text-[11px] font-bold uppercase tracking-[0.3em] text-accent-soft">
              Mi cuenta
            </p>
            <h1 className="font-display text-3xl font-extrabold uppercase leading-none">
              Hola{nombre ? `, ${nombre.split(" ")[0]}` : " de nuevo"}
            </h1>
          </div>
        </div>
        {/* "Cerrar sesión" vive ahora en el botón de cuenta del header (HeaderCuenta),
            no acá: era el segundo botón suelto que se quería unificar. */}
      </div>

      {/* calificación post-servicio: SIEMPRE montado (pendiente puede ser null)
          para que la pantalla de gracias sobreviva al revalidatePath de la action */}
      <CalificarServicio
        pendiente={
          sinCalificar
            ? {
                reservaId: sinCalificar.id,
                servicio: sinCalificar.servicio,
                barbero: sinCalificar.barbero,
                fecha: fechaLarga(sinCalificar.inicio),
              }
            : null
        }
      />

      {/* Turnos llamados: hero a todo el ancho (uno por cada entrada notificada).
          Es lo único que gana a la próxima cita: está pasando AHORA. */}
      {turnos.map((turno) => (
        <section key={turno.id} className="mb-6 overflow-hidden rounded-2xl border border-accent/40 bg-accent/[0.07] p-6 text-center">
          {/* Foto del barbero con anillo rojo pulsante (proto §4). Fallback: inicial. */}
          <div className="relative mx-auto h-24 w-24">
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-accent/30 [animation:bbping_1.6s_ease-out_infinite]"
            />
            <span
              className="relative block h-24 w-24 overflow-hidden rounded-full border-2 border-accent bg-elevated bg-cover bg-top shadow-[0_0_34px_-4px_rgba(210,63,52,0.7)]"
              style={turno.fotoBarbero ? { backgroundImage: `url(${turno.fotoBarbero})` } : undefined}
            >
              {!turno.fotoBarbero && (
                <span className="grid h-full w-full place-items-center font-display text-3xl font-bold text-accent-soft">
                  {turno.barbero.charAt(0)}
                </span>
              )}
            </span>
          </div>
          <h2 className="mt-5 font-display text-4xl font-extrabold uppercase leading-[0.92]">
            ¡Es tu <span className="text-accent-soft">turno</span>!
          </h2>
          <p className="mx-auto mt-3 max-w-[26ch] text-sm text-muted">
            Pasa a la silla con {turno.barbero}. Te está esperando.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] px-5 py-2.5 font-display text-sm font-bold uppercase tracking-wide text-on-accent shadow-[0_12px_30px_-10px_rgba(210,63,52,0.8)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-on-accent/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-on-accent" />
            </span>
            {turno.servicio}
          </div>
        </section>
      ))}

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)] lg:items-start lg:gap-6">
        {/* ── Lo primero: su cita ─────────────────────────────────────── */}
        <section className="lg:col-start-1 lg:row-start-1">
          {siguiente ? (
            <>
              <div className="relative overflow-hidden rounded-2xl border border-ok/30 bg-ok/[0.045] p-5">
                <p className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-ok">
                  Tu próxima cita
                </p>
                <p className="mt-1.5 font-display text-[clamp(28px,8vw,36px)] font-extrabold uppercase leading-none lg:text-[44px]">
                  {fechaHero(siguiente.inicio)}
                </p>
                <p className="mt-2 text-sm text-muted">
                  {siguiente.servicio} · {siguiente.barbero}
                  <br />
                  {SEDE_INFO[siguiente.sede]?.nombre ?? "Barbas & Bigotes"}
                </p>
                <CitaAcciones
                  reservaId={siguiente.id}
                  barberoId={siguiente.barberoId}
                  duracionMin={siguiente.duracionMin}
                  inicio={siguiente.inicio}
                  horarioSemanal={horarioSemanal.filter((h) => h.sede === siguiente.sede)}
                  diasEspeciales={diasEspeciales.filter((d) => d.sede === siguiente.sede)}
                />
              </div>
              {adelantoPendiente(siguiente.nota) && (
                <div className="mt-2">
                  <AdelantoBanner
                    reservaId={siguiente.id}
                    inicioPropuesto={adelantoPendiente(siguiente.nota)!.inicio}
                    finPropuesto={adelantoPendiente(siguiente.nota)!.fin}
                  />
                </div>
              )}
            </>
          ) : (
            <EmptyProximas />
          )}
        </section>

        {/* ── Su tarjeta: el número primero, la ilustrada debajo ───────── */}
        <section className="rounded-2xl border border-line bg-panel p-5 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
                Tu tarjeta
              </p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-[46px] font-extrabold leading-[0.85] tabular-nums">
                  {tarjeta.sellos}
                </span>
                <span className="text-sm text-muted">de {tamTarjeta} cortes</span>
              </p>
              {tarjeta.proximo && (
                <p className="mt-1.5 text-[13px] text-accent-soft">
                  Te falta{tarjeta.proximo.faltan === 1 ? "" : "n"}{" "}
                  <b>{tarjeta.proximo.faltan}</b> para tu{" "}
                  <b>
                    {tarjeta.proximo.tipo === "regalo"
                      ? "regalo"
                      : `${tarjeta.proximo.tipo} de descuento`}
                  </b>
                  .
                </p>
              )}
            </div>
            {/* Desde md la CABECERA ya tiene su "Reservar" en rojo y es sticky:
                este sale, porque el dueno lo vio dos veces en la misma pantalla
                y tenia razon. Debajo de md la cabecera no lo muestra, asi que
                aca sigue siendo el unico camino a reservar. */}
            <Link
              href="/reservar"
              className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] px-5 font-display text-[13px] font-bold uppercase tracking-wide text-on-accent shadow-[0_12px_26px_-10px_rgba(210,63,52,0.7)] transition hover:brightness-105 md:hidden"
            >
              Reservar
            </Link>
          </div>

          {/* La tarjeta ilustrada es la RÉPLICA de la física (layout 2A del
              proyecto de Claude Design del dueño) y no se toca: baja un puesto,
              debajo del dato, porque es el premio y no el resumen. */}
          <div className="mt-4">
            <TarjetaFidelidad sellos={tarjeta.sellos} nombre={nombre} cfg={tarjeta.cfg} />
          </div>
        </section>

        {/* ── El resto de lo suyo ─────────────────────────────────────── */}
        <div className="flex flex-col gap-6 lg:col-start-1 lg:row-start-3">
          {/* En espera (sin estimado ficticio) */}
          {enEspera.length > 0 && (
            <section className="rounded-2xl border border-line bg-panel p-5">
              <div className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
                En la fila
              </div>
              <div className="mt-3 space-y-3">
                {enEspera.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{ESTADO[c.estado] ?? c.estado}</div>
                      <div className="text-sm text-muted">
                        {c.servicio} · {c.barbero}
                      </div>
                    </div>
                    <span className="rounded-full border border-line bg-accent/[0.06] px-3 py-1 font-display text-[10px] font-bold uppercase tracking-wide text-accent-soft">
                      Te avisamos
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Las demás citas, si tiene más de una agendada. */}
          {otrasCitas.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-xl font-bold uppercase">Después de esa</h2>
              <div className="space-y-3">
                {otrasCitas.map((r) => {
                  const prop = adelantoPendiente(r.nota);
                  return (
                    <div key={r.id} className="space-y-2">
                      <div className="relative overflow-hidden rounded-2xl border border-line bg-panel p-4 pl-5">
                        <span
                          aria-hidden
                          className="absolute inset-y-0 left-0 w-1 bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))]"
                        />
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="font-display text-lg font-bold uppercase">{r.servicio}</div>
                            <div className="mt-1 text-sm text-muted">
                              {fechaLarga(r.inicio)} · {r.barbero}
                            </div>
                          </div>
                          <span className="rounded-full bg-accent/15 px-3 py-1 font-display text-[10px] font-bold uppercase tracking-wide text-accent-soft">
                            {ESTADO[r.estado] ?? r.estado}
                          </span>
                        </div>
                        <CitaAcciones
                          reservaId={r.id}
                          barberoId={r.barberoId}
                          duracionMin={r.duracionMin}
                          inicio={r.inicio}
                          horarioSemanal={horarioSemanal.filter((h) => h.sede === r.sede)}
                          diasEspeciales={diasEspeciales.filter((d) => d.sede === r.sede)}
                        />
                      </div>
                      {prop && (
                        <AdelantoBanner
                          reservaId={r.id}
                          inicioPropuesto={prop.inicio}
                          finPropuesto={prop.fin}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Historial */}
          {pasadas.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-xl font-bold uppercase">Historial</h2>
              <div className="rounded-2xl border border-line bg-panel px-4">
                {pasadas.slice(0, 10).map((r) => {
                  // El chulito SOLO cuando de verdad se completó. Antes lo llevaban
                  // todas las filas, así que "No llegó" salía con un ✓ al lado y el
                  // ícono contradecía la palabra.
                  const completada = r.estado === "completada";
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-3 border-b border-line/60 py-3 text-sm last:border-b-0"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                            completada ? "bg-ok/12 text-ok" : "bg-elevated text-muted"
                          }`}
                        >
                          {completada ? (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <path d="M6 6l12 12M18 6 6 18" />
                            </svg>
                          )}
                        </span>
                        <div>
                          <div className="text-ink">{r.servicio}</div>
                          <div className="text-xs text-muted">{fechaLarga(r.inicio)}</div>
                        </div>
                      </div>
                      <span className={completada ? "text-muted" : "text-warn"}>
                        {ESTADO[r.estado] ?? r.estado}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Los avisos al celular: en la columna izquierda y en su PROPIA fila.
            La tarjeta mide 369 px y la cita 213: si no se pone algo debajo de la
            cita, el grid deja 156 px de hueco al lado de la tarjeta. Con los
            avisos ahí son 383 contra 369 y las dos columnas se acaban juntas. */}
        <div className="lg:col-start-1 lg:row-start-2">
          <PushManager />
        </div>

        {/* ── Accesos. Lo que antes era una caja roja arriba de todo. ──── */}
        <div className="flex flex-col gap-3 lg:col-start-2 lg:row-start-3">
          <div className="overflow-hidden rounded-2xl border border-line bg-panel">
            <a
              href={WA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[52px] items-center gap-3 border-b border-line/60 px-4 text-[14px] transition hover:bg-elevated/60"
            >
              <span className="flex-1">Escríbenos por WhatsApp</span>
              <span aria-hidden className="text-muted">›</span>
            </a>
            {/* Eliminación de cuenta: Play exige que sea alcanzable desde la app.
                Discreta —es rara y sin vuelta atrás— pero tocable: medía 15 px. */}
            <Link
              href="/cuenta/eliminar"
              className="flex min-h-[52px] items-center gap-3 px-4 text-[14px] text-muted transition hover:bg-elevated/60 hover:text-ink"
            >
              <span className="flex-1">Eliminar mi cuenta</span>
              <span aria-hidden>›</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// Estado vacío con intención: onboarding en vez de una lista en blanco.
function EmptyProximas() {
  const pasos = [
    { n: 1, t: "Elige sede, barbero y hora.", s: "Ves la disponibilidad real, sin llamar." },
    { n: 2, t: "Recibe recordatorios.", s: "Te avisamos por email y notificación." },
    { n: 3, t: "Suma puntos en cada visita.", s: "Se acumulan desde la primera vez." },
  ];
  return (
    <div className="rounded-2xl border border-line bg-panel p-6 text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-line bg-bg">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-accent-soft">
          <circle cx="6" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M8.1 8.1 20 20M8.1 15.9 20 4M12 12l3 3" />
        </svg>
      </span>
      <h3 className="mt-4 font-display text-xl font-bold uppercase">Todavía no tienes citas</h3>
      <p className="mx-auto mt-2 max-w-[26ch] text-sm text-muted">
        Reserva tu próximo corte y empieza a sumar puntos desde la primera visita.
      </p>
      <Link
        href="/reservar"
        className="mt-5 inline-flex min-h-12 items-center rounded-full bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] px-7 font-display text-sm font-bold uppercase tracking-wide text-on-accent shadow-[0_12px_26px_-10px_rgba(210,63,52,0.7)] transition hover:brightness-105"
      >
        Reservar una cita
      </Link>
      <div className="mt-6 space-y-3 text-left">
        {pasos.map((p) => (
          <div key={p.n} className="flex items-start gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line bg-elevated font-display text-[13px] font-bold text-accent-soft">
              {p.n}
            </span>
            <p className="text-[13.5px] leading-snug">
              <span className="font-semibold">{p.t}</span>{" "}
              <span className="text-muted">{p.s}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ContactoWidget } from "@/components/ContactoWidget";
import { ClienteLoginButton, ClienteLogout } from "@/components/cuenta/ClienteAuth";
import { AdelantoBanner } from "@/components/cuenta/AdelantoBanner";
import { PushManager } from "@/components/cuenta/PushManager";
import { CitaAcciones } from "@/components/cuenta/CitaAcciones";
import { CalificarServicio } from "@/components/cuenta/CalificarServicio";
import { ensureCliente } from "@/lib/cliente-actions";
import { getCuenta, getReservaSinCalificar } from "@/lib/data/queries";

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
const POLE_MINI = "repeating-linear-gradient(115deg, var(--accent) 0 7px, var(--ink) 7px 14px)";

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

export default async function CuentaPage() {
  const ctx = await ensureCliente();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-16">
        {ctx.estado === "anon" && (
          <div className="mx-auto max-w-md text-center">
            <span
              aria-hidden
              className="mx-auto mb-6 block h-1.5 w-10 rounded-full"
              style={{ background: POLE_MINI }}
            />
            <p className="font-display text-[11px] font-bold uppercase tracking-[0.34em] text-accent-soft">
              Mi cuenta
            </p>
            <h1 className="mt-3 font-display text-5xl font-extrabold uppercase leading-[0.95] text-balance">
              Tu barbería,<br />en tu bolsillo
            </h1>
            <p className="mx-auto mt-4 max-w-[30ch] text-muted">
              Entrá con tu Gmail y mirá tus citas, tu lugar en la fila y tus puntos de fidelidad.
            </p>
            <div className="mt-9 flex justify-center">
              <ClienteLoginButton />
            </div>
            <p className="mt-6 text-xs text-muted">
              ¿Primera vez? También podés{" "}
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
            <p className="mt-4 text-muted">Ingresaste con una cuenta del equipo. Usá tu panel:</p>
            <div className="mt-7 flex justify-center gap-3">
              <Link
                href="/admin"
                className="rounded-full bg-gradient-to-b from-accent-soft to-accent px-6 py-3 text-sm font-semibold uppercase tracking-wide text-on-accent shadow-[0_10px_24px_-8px_rgba(210,63,52,0.6)] transition hover:brightness-105"
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

        {ctx.estado === "cliente" && <Portal clienteId={ctx.clienteId ?? ""} />}
      </main>
      <SiteFooter />
      {/* Widget de contacto: en el proto vive en home y Mi cuenta (§2.11). */}
      <ContactoWidget />
    </>
  );
}

async function Portal({ clienteId }: { clienteId: string }) {
  const [{ proximas, pasadas, puntosBalance, cola }, sinCalificar] = await Promise.all([
    getCuenta(),
    getReservaSinCalificar(clienteId),
  ]);

  // El turno llamado (notificado) es el momento estrella; la espera va aparte.
  const turno = cola.find((c) => c.estado === "notificado");
  const enEspera = cola.filter((c) => c.estado !== "notificado");

  return (
    <div>
      {/* Encabezado */}
      <div className="mb-9 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span aria-hidden className="h-8 w-2 rounded" style={{ background: POLE }} />
          <div>
            <p className="font-display text-[11px] font-bold uppercase tracking-[0.3em] text-accent-soft">
              Mi cuenta
            </p>
            <h1 className="font-display text-3xl font-extrabold uppercase leading-none">Hola de nuevo</h1>
          </div>
        </div>
        <ClienteLogout />
      </div>

      <PushManager />

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

      {/* Turno llamado: hero */}
      {turno && (
        <section className="mb-8 overflow-hidden rounded-2xl border border-accent/40 bg-accent/[0.07] p-6 text-center">
          <span
            aria-hidden
            className="mx-auto block h-20 w-3 rounded-full shadow-[0_0_34px_-4px_rgba(210,63,52,0.7)]"
            style={{ background: POLE }}
          />
          <h2 className="mt-5 font-display text-4xl font-extrabold uppercase leading-[0.92]">
            ¡Es tu <span className="text-accent-soft">turno</span>!
          </h2>
          <p className="mx-auto mt-3 max-w-[26ch] text-sm text-muted">
            Pasá a la silla con {turno.barbero}. Te está esperando.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-accent-soft to-accent px-5 py-2.5 font-display text-sm font-bold uppercase tracking-wide text-on-accent shadow-[0_12px_30px_-10px_rgba(210,63,52,0.8)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-on-accent/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-on-accent" />
            </span>
            {turno.servicio}
          </div>
        </section>
      )}

      {/* En espera (sin estimado ficticio) */}
      {enEspera.length > 0 && (
        <section className="mb-8 rounded-2xl border border-line bg-panel p-5">
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

      {/* Puntos (balance real, sin niveles inventados) */}
      <section
        className="mb-8 flex items-center justify-between rounded-2xl border border-line p-5"
        style={{ background: "linear-gradient(155deg, #1c1714, var(--panel))" }}
      >
        <div>
          <div className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
            Puntos de fidelidad
          </div>
          <div className="mt-1 font-display text-5xl font-extrabold leading-none tabular-nums">
            {puntosBalance}
          </div>
        </div>
        <Link
          href="/reservar"
          className="rounded-full bg-gradient-to-b from-accent-soft to-accent px-6 py-3 font-display text-sm font-bold uppercase tracking-wide text-on-accent shadow-[0_12px_26px_-10px_rgba(210,63,52,0.7)] transition hover:brightness-105"
        >
          Reservar
        </Link>
      </section>

      {/* Próximas citas */}
      <section className="mb-8">
        <h2 className="mb-3 font-display text-2xl font-bold uppercase">Próximas citas</h2>
        {proximas.length === 0 ? (
          <EmptyProximas />
        ) : (
          <div className="space-y-3">
            {proximas.map((r) => {
              let prop: { inicio: string; fin: string; estado?: string } | null = null;
              if (r.nota) {
                try {
                  const obj = JSON.parse(r.nota);
                  if (obj.propuesta_adelanto?.estado === "pendiente") {
                    prop = obj.propuesta_adelanto;
                  }
                } catch {}
              }
              return (
                <div key={r.id} className="space-y-2">
                  <div className="relative overflow-hidden rounded-2xl border border-line bg-panel p-4 pl-5">
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-accent-soft to-accent"
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
        )}
      </section>

      {/* Historial */}
      {pasadas.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-2xl font-bold uppercase">Historial</h2>
          <div className="rounded-2xl border border-line bg-panel px-4">
            {pasadas.slice(0, 10).map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 border-b border-line/60 py-3 text-sm last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-elevated">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  <div>
                    <div className="text-ink">{r.servicio}</div>
                    <div className="text-xs text-muted">{fechaLarga(r.inicio)}</div>
                  </div>
                </div>
                <span className="text-muted">{ESTADO[r.estado] ?? r.estado}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// Estado vacío con intención: onboarding en vez de una lista en blanco.
function EmptyProximas() {
  const pasos = [
    { n: 1, t: "Elegí sede, barbero y hora.", s: "Ves la disponibilidad real, sin llamar." },
    { n: 2, t: "Recibí recordatorios.", s: "Te avisamos por email y notificación." },
    { n: 3, t: "Sumá puntos en cada visita.", s: "Se acumulan desde la primera vez." },
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
      <h3 className="mt-4 font-display text-xl font-bold uppercase">Todavía no tenés citas</h3>
      <p className="mx-auto mt-2 max-w-[26ch] text-sm text-muted">
        Reservá tu próximo corte y empezá a sumar puntos desde la primera visita.
      </p>
      <Link
        href="/reservar"
        className="mt-5 inline-block rounded-full bg-gradient-to-b from-accent-soft to-accent px-7 py-3 font-display text-sm font-bold uppercase tracking-wide text-on-accent shadow-[0_12px_26px_-10px_rgba(210,63,52,0.7)] transition hover:brightness-105"
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

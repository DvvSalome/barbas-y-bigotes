import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
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
      <main className="mx-auto max-w-3xl px-6 py-16">
        {ctx.estado === "anon" && (
          <div className="mx-auto max-w-md text-center">
            <p className="text-xs uppercase tracking-[0.4em] text-accent">Mi cuenta</p>
            <h1 className="mt-3 font-display text-5xl font-semibold uppercase">Tu barbería, en tu bolsillo</h1>
            <p className="mt-4 text-muted">
              Entrá con tu Gmail y mirá tus citas, tu lugar en la fila y tus puntos de fidelidad.
            </p>
            <div className="mt-9 flex justify-center">
              <ClienteLoginButton />
            </div>
            <p className="mt-6 text-xs text-muted">
              ¿Primera vez? También podés{" "}
              <Link href="/reservar" className="text-accent-soft hover:text-accent">
                reservar sin cuenta
              </Link>
              .
            </p>
          </div>
        )}

        {ctx.estado === "staff" && (
          <div className="mx-auto max-w-md text-center">
            <h1 className="font-display text-4xl font-semibold uppercase">Cuenta de staff</h1>
            <p className="mt-4 text-muted">Ingresaste con una cuenta del equipo. Usá tu panel:</p>
            <div className="mt-7 flex justify-center gap-3">
              <Link href="/admin" className="rounded-full bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft">
                Panel admin
              </Link>
              <Link href="/barbero" className="rounded-full border border-line px-6 py-3 text-sm transition hover:border-accent/50">
                App del barbero
              </Link>
            </div>
          </div>
        )}

        {ctx.estado === "cliente" && <Portal clienteId={ctx.clienteId ?? ""} />}
      </main>
      <SiteFooter />
    </>
  );
}

async function Portal({ clienteId }: { clienteId: string }) {
  const [{ proximas, pasadas, puntosBalance, cola }, sinCalificar] = await Promise.all([
    getCuenta(),
    getReservaSinCalificar(clienteId),
  ]);

  return (
    <div>
      <div className="mb-10 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-accent">Mi cuenta</p>
          <h1 className="mt-2 font-display text-4xl font-semibold uppercase">Hola de nuevo</h1>
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

      {/* fila / turno */}
      {cola.length > 0 && (
        <section className="mb-8 rounded-2xl border border-accent/40 bg-accent/5 p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-accent-soft">Tu turno</div>
          {cola.map((c) => (
            <div key={c.id} className="mt-2 flex items-center justify-between">
              <div>
                <div className="font-semibold">{ESTADO[c.estado] ?? c.estado}</div>
                <div className="text-sm text-muted">{c.servicio} · {c.barbero}</div>
              </div>
              {c.estado === "notificado" && (
                <span className="rounded-full bg-accent px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-on-accent">
                  Pasá ya
                </span>
              )}
            </div>
          ))}
        </section>
      )}

      {/* puntos */}
      <section className="mb-8 flex items-center justify-between rounded-2xl border border-line bg-panel p-5">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted">Puntos de fidelidad</div>
          <div className="mt-1 font-display text-4xl font-semibold text-accent-soft tabular-nums">{puntosBalance}</div>
        </div>
        <Link href="/reservar" className="rounded-full bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft">
          Reservar
        </Link>
      </section>

      {/* próximas */}
      <section className="mb-8">
        <h2 className="mb-3 font-display text-2xl uppercase">Próximas citas</h2>
        {proximas.length === 0 ? (
          <p className="text-sm text-muted">No tenés citas próximas. <Link href="/reservar" className="text-accent-soft hover:text-accent">Reservá una →</Link></p>
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
                  <div className="rounded-xl border border-line bg-panel p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{r.servicio}</div>
                        <div className="text-sm text-muted">{fechaLarga(r.inicio)} · {r.barbero}</div>
                      </div>
                      <span className="rounded-full bg-accent/15 px-3 py-1 text-[10px] uppercase tracking-wide text-accent-soft">
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

      {/* historial */}
      {pasadas.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-2xl uppercase">Historial</h2>
          <div className="space-y-2">
            {pasadas.slice(0, 10).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-bg p-3 text-sm">
                <span className="text-muted">{fechaLarga(r.inicio)} · {r.servicio}</span>
                <span className="text-muted">{ESTADO[r.estado] ?? r.estado}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

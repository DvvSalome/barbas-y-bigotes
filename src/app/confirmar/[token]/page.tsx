import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { confirmarCitaPorToken } from "@/lib/cliente-actions";

export const metadata: Metadata = {
  title: "Confirmar cita",
  robots: { index: false, follow: false },
};

const POLE = "repeating-linear-gradient(150deg, var(--accent) 0 6px, var(--ink) 6px 12px)";

// Pantalla del link "Confirmar asistencia" del correo. Pública y sin login: el
// token del correo es la credencial. La confirmación ocurre acá al cargar (mismo
// patrón que /cuenta con ensureCliente); es idempotente y jamás cancela ni mueve
// la cita, así que un prefetch de antivirus no hace daño.
export default async function ConfirmarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const res = await confirmarCitaPorToken(token);

  const ok = res.estado === "ok" || res.estado === "ya";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
        {ok ? (
          <>
            <span aria-hidden className="mb-6 h-10 w-2.5 rounded" style={{ background: POLE }} />
            <p className="font-display text-[11px] font-bold uppercase tracking-[0.34em] text-accent-soft">
              {res.estado === "ya" ? "Ya estaba confirmada" : "Cita confirmada"}
            </p>
            <h1 className="mt-3 font-display text-4xl font-extrabold uppercase leading-[0.95]">
              ¡Listo, te esperamos!
            </h1>
            <p className="mt-4 text-muted">
              {res.estado === "ya"
                ? "Esta cita ya la habías confirmado. No tienes que hacer nada más."
                : "Gracias por avisarnos. Tu barbero ya sabe que vienes."}
            </p>

            <div className="mt-8 w-full rounded-2xl border border-line bg-panel p-5 text-left">
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent-soft">
                Tu cita
              </div>
              <div className="mt-2 font-display text-lg font-bold capitalize text-ink">
                {res.fecha}
              </div>
              <div className="mt-1 text-sm text-muted">
                {res.servicio ?? "Tu servicio"}
                {res.barbero ? ` · con ${res.barbero}` : ""}
              </div>
              <div className="text-sm text-muted">{res.sede}</div>
            </div>

            <p className="mt-6 text-xs text-muted">
              ¿Te surgió algo? Puedes reagendar o cancelar hasta 2 horas antes desde{" "}
              <Link href="/cuenta" className="text-accent-soft underline">
                Mi cuenta
              </Link>
              .
            </p>
          </>
        ) : (
          <>
            <span aria-hidden className="mb-6 h-10 w-2.5 rounded" style={{ background: POLE }} />
            <h1 className="mt-1 font-display text-4xl font-extrabold uppercase leading-[0.95]">
              {res.estado === "cancelada" ? "Esta cita ya no está activa" : "No encontramos esa cita"}
            </h1>
            <p className="mt-4 text-muted">
              {res.estado === "cancelada"
                ? "La cita fue cancelada o ya pasó. Si quieres otro turno, reserva de nuevo cuando quieras."
                : "El enlace no es válido o ya venció. Si tienes una cita, reserva o revisa tu cuenta."}
            </p>
            <Link
              href="/reservar"
              className="mt-8 rounded-full bg-accent px-7 py-3 text-sm font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft"
            >
              Reservar un turno
            </Link>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

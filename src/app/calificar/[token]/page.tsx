import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CalificarServicio, GraciasCalificacion } from "@/components/cuenta/CalificarServicio";
import { getVisitaPorTokenDeResena } from "@/lib/data/queries";
import { fechaCortaBogota } from "@/lib/format";

export const metadata: Metadata = {
  title: "Califica tu visita",
  robots: { index: false, follow: false },
};

const POLE = "repeating-linear-gradient(150deg, var(--accent) 0 6px, var(--ink) 6px 12px)";

// Las cinco estrellas del correo de postventa llegan acá con ?n=<la que tocó>.
// Pública y sin login: el token del correo es la credencial. Cargar la página NO
// guarda nada (un antivirus que abre los enlaces del correo no puede calificar
// por el cliente): la estrella llega marcada y se guarda al tocar "Enviar".
export default async function CalificarPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ n?: string }>;
}) {
  const [{ token }, { n }] = await Promise.all([params, searchParams]);
  const visita = await getVisitaPorTokenDeResena(token);
  const vale = visita && visita.clienteRef && !visita.vencida;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-6 py-16">
        <span aria-hidden className="mx-auto mb-6 block h-10 w-2.5 rounded" style={{ background: POLE }} />
        {!vale ? (
          <div className="text-center">
            <h1 className="font-display text-4xl font-extrabold uppercase leading-[0.95]">
              {visita?.vencida ? "Este enlace ya venció" : "No encontramos esa visita"}
            </h1>
            <p className="mt-4 text-muted">
              {visita?.vencida ? "El enlace para calificar dura 30 días." : "El enlace no es válido."} Si quieres
              contarnos cómo te fue, escríbenos por{" "}
              <a href="https://wa.me/573006734799" className="text-accent-soft underline">
                WhatsApp
              </a>
              .
            </p>
            <Link href="/reservar?desde=calificar" className="bb-btn bb-btn-primario mt-8">
              Reservar un turno
            </Link>
          </div>
        ) : visita.yaCalificada ? (
          <GraciasCalificacion googleUrl={visita.googleReviewUrl} ya />
        ) : (
          <CalificarServicio
            inicial={Number(n) || 0}
            pendiente={{
              token,
              servicio: visita.servicio,
              barbero: visita.barbero,
              fecha: fechaCortaBogota(visita.fecha),
            }}
          />
        )}
      </main>
      <SiteFooter />
    </>
  );
}

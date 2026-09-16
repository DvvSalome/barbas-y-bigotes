import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { estadoMarketingPorToken } from "@/lib/marketing-actions";
import { BajaControles } from "./BajaControles";

export const metadata: Metadata = {
  title: "Avisos por correo",
  robots: { index: false, follow: false },
};

const POLE = "repeating-linear-gradient(150deg, var(--accent) 0 6px, var(--ink) 6px 12px)";

// Pantalla del enlace "No quiero más avisos" del correo. Pública y sin login:
// el token es la credencial. A diferencia de /confirmar, acá NO se actúa al
// cargar: la baja es un botón. Un antivirus que prefetchea el enlace no puede
// dar de baja a nadie sin querer (y Gmail usa el POST de un clic en /api/baja).
export default async function BajaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const res = await estadoMarketingPorToken(token);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
        <span aria-hidden className="mb-6 h-10 w-2.5 rounded" style={{ background: POLE }} />
        {res.estado === "invalido" ? (
          <>
            <h1 className="font-display text-4xl font-extrabold uppercase leading-[0.95]">Ese enlace no sirve</h1>
            <p className="mt-4 text-muted">
              No encontramos tu ficha con ese enlace. Si quieres dejar de recibir avisos, escríbenos por WhatsApp y lo
              hacemos a mano.
            </p>
            <Link
              href="https://wa.me/573006734799"
              className="mt-8 rounded-full border border-line px-7 py-3 text-sm font-semibold uppercase tracking-wide text-ink"
            >
              Escribir por WhatsApp
            </Link>
          </>
        ) : (
          <>
            <p className="font-display text-[11px] font-bold uppercase tracking-[0.34em] text-accent-soft">
              Avisos por correo
            </p>
            <h1 className="mt-3 font-display text-4xl font-extrabold uppercase leading-[0.95]">
              {res.estado === "baja" ? "Ya no te escribimos" : `Hola, ${res.nombre}`}
            </h1>
            <p className="mt-4 text-muted">
              {res.estado === "baja"
                ? "Quedaste fuera de los avisos de corte y promociones. Los correos de tus citas (confirmación y recordatorio) siguen llegando normal."
                : "Te avisamos cuando te toca corte y de alguna promoción de vez en cuando. Si preferís que no, tocá el botón y listo."}
            </p>
            <BajaControles token={token} estado={res.estado} />
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

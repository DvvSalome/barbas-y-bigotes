import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getDestinoApp, getStaffContext } from "@/lib/data/queries";
import { entradaPara, tituloApp } from "@/lib/app-personal";
import { metaAppPersonal } from "@/lib/app-equipo";
import { EntradaPersonal } from "@/components/staff/AppPersonal";
import { OlvidarRuta } from "@/components/staff/AppEquipo";

/*
  /equipo/<slug>: la app PROPIA de un barbero (/equipo/meyer) o del mostrador de
  una sede (/equipo/mostrador-plaza-de-la-paz). Pedido del dueño (17-oct): que
  "agregar a inicio" les deje SU app, que abra en su cuenta.

  Lo que la hace suya es el manifiesto que enlaza (start_url = esta ruta, id
  propio, "B&B Meyer") y el título del iPhone. Las reglas viven en
  src/lib/app-personal.ts; la pantalla, en components/staff/AppPersonal.tsx.

  Dinámica: depende de la sesión del aparato (y el proxy la refresca, ver
  src/proxy.ts). Un enlace que no es de nadie, o de alguien que ya no trabaja
  acá, dice eso y manda al login general.
*/
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

const ROBOTS = { index: false, follow: false } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const d = await getDestinoApp(slug);
  if (!d || !d.activo) return { title: "Enlace del equipo", robots: ROBOTS };
  return {
    ...metaAppPersonal(d),
    title: d.tipo === "sede" ? `Mostrador de ${d.nombre}` : `App de ${d.nombre}`,
    robots: ROBOTS,
  };
}

export default async function AppPersonal({ params }: Props) {
  const { slug } = await params;
  const d = await getDestinoApp(slug);

  if (!d || !d.activo) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4 py-10">
        <OlvidarRuta ruta={`/equipo/${slug.toLowerCase()}`} />
        <div className="w-full max-w-sm text-center">
          <Link href="/" className="flex justify-center" aria-label="Barbas & Bigotes">
            <Image src="/brand/logo-lockup.png" alt="Barbas & Bigotes Barbershop" width={1024} height={348} priority className="h-12 w-auto" />
          </Link>
          <h1 className="mt-8 font-display text-2xl font-semibold uppercase">Este enlace ya no abre</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {d
              ? "Esta app ya no está activa. Si crees que es un error, habla con el dueño."
              : "No es la app de nadie del equipo. Revisa que el enlace esté completo o pídele al dueño que te lo vuelva a mandar."}
          </p>
          <Link
            href="/login"
            className="mt-6 flex min-h-11 w-full items-center justify-center rounded-full border border-line px-4 text-sm font-semibold uppercase tracking-wide text-ink transition hover:border-accent/50"
          >
            Entrar al equipo
          </Link>
        </div>
      </main>
    );
  }

  const staff = await getStaffContext();
  return (
    <main className="flex min-h-dvh items-start justify-center px-4 py-8 sm:items-center sm:py-10">
      <EntradaPersonal
        destino={{ tipo: d.tipo, id: d.id, nombre: d.nombre, fotoUrl: d.fotoUrl }}
        titulo={tituloApp(d)}
        entrada={entradaPara(staff, d)}
        sesion={{ nombre: staff.nombre, esSede: staff.rol === "sede" }}
      />
    </main>
  );
}

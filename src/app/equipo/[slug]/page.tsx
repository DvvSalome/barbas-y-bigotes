import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getDestinoApp, getSedes, getStaffContext } from "@/lib/data/queries";
import { descripcionEnlace, entradaPara, tituloApp, tituloEnlace } from "@/lib/app-personal";
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
  const titulo = tituloEnlace(d);
  const descripcion = descripcionEnlace(d);
  // La tarjeta que arma WhatsApp con el enlace: sin esto hereda la de la web de
  // clientes ("Reserva tu cita online") y parece la página de reservas. El
  // ícono es el mismo que le va a quedar en la pantalla de inicio.
  const icono = { url: "/brand/icon-512x512.png", width: 512, height: 512, alt: tituloApp(d) };
  return {
    ...metaAppPersonal(d),
    title: titulo,
    description: descripcion,
    openGraph: {
      type: "website",
      locale: "es_CO",
      siteName: "Barbas & Bigotes Barbershop",
      url: d.ruta,
      title: `${titulo} · Barbas & Bigotes`,
      description: descripcion,
      images: [icono],
    },
    twitter: { card: "summary", title: `${titulo} · Barbas & Bigotes`, description: descripcion, images: [icono.url] },
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
  // Con dos sedes, "Entraste como el mostrador" no dice de cuál.
  const sedeDeLaSesion =
    staff.rol === "sede" && staff.sedeId ? ((await getSedes()).find((s) => s.id === staff.sedeId)?.nombre ?? null) : null;
  return (
    // En la app instalada del iPhone (status bar translúcida + viewport-fit
    // cover) la página arranca DEBAJO de la hora y la isla: el margen de arriba
    // suma el safe-area, o la foto del PIN queda tapada.
    <main className="flex min-h-dvh items-start justify-center px-4 pt-[calc(env(safe-area-inset-top)+2rem)] pb-8 sm:items-center sm:pt-[calc(env(safe-area-inset-top)+2.5rem)] sm:pb-10">
      <EntradaPersonal
        destino={{ tipo: d.tipo, id: d.id, nombre: d.nombre, fotoUrl: d.fotoUrl }}
        titulo={tituloApp(d)}
        entrada={entradaPara(staff, d)}
        sesion={{ nombre: staff.nombre, esSede: staff.rol === "sede", sede: sedeDeLaSesion }}
      />
    </main>
  );
}

import { getDestinoApp } from "@/lib/data/queries";
import { manifiestoPersonal } from "@/lib/app-personal";

// El manifiesto de la app PROPIA de un barbero o de un mostrador: lo enlaza
// /equipo/<slug> (generateMetadata) y es lo que hace que "Instalar app" en
// Android instale "B&B Meyer" abriendo en /equipo/meyer, y no la app general.
// Mismo origen que la página: la CSP (manifest-src 'self') lo deja pasar.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await getDestinoApp(slug);
  if (!d || !d.activo) {
    return new Response("Esta app ya no existe.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return new Response(JSON.stringify(manifiestoPersonal(d)), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      // Un rato en el navegador: si el dueño le cambia el nombre, el ícono lo
      // toma en la próxima revisión del manifiesto. El CDN no lo guarda.
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": "noindex",
    },
  });
}

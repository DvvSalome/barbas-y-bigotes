import * as Sentry from "@sentry/nextjs";

// TEMPORAL — verificación end-to-end de que Sentry quedó bien cableado en prod.
// Se borra apenas se confirme el evento en el panel. Pide un secreto por query
// para que no quede un generador de ruido abierto a internet, y responde 200:
// no tiene sentido dejar un 500 real servido en el sitio del cliente.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const clave = new URL(req.url).searchParams.get("clave");
  if (clave !== "bb-verificacion-sentry-2026") {
    return new Response("No encontrado", { status: 404 });
  }

  const id = Sentry.captureException(
    new Error("Prueba de cableado de Sentry — se puede ignorar y resolver"),
  );
  await Sentry.flush(4000); // en serverless el proceso muere antes de enviar

  return Response.json({
    ok: true,
    eventId: id,
    dsnPresente: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
    entorno: process.env.VERCEL_ENV ?? "local",
  });
}

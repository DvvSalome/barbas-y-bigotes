import { NextResponse } from "next/server";
import { darDeBajaPorToken } from "@/lib/marketing-actions";

// Baja de UN clic para Gmail/Yahoo (RFC 8058): el correo lleva la cabecera
// List-Unsubscribe-Post y el proveedor hace POST acá sin que el cliente vea
// nada. Un GET (alguien pegó la URL) lo lleva a la página con el botón.
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const res = await darDeBajaPorToken(token);
  return new NextResponse(null, { status: res.estado === "invalido" ? 404 : 200 });
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return NextResponse.redirect(new URL(`/baja/${token}`, req.url), 302);
}

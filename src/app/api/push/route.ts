// POST /api/push — disparador de push para los crons de n8n (recordatorio,
// cupo libre, confirmación): después de mandar cada email, n8n agrega un nodo
// HTTP que pega acá con el header x-push-secret y el push equivalente.
// El emisor real es src/lib/push.ts (web-push); esta ruta solo autentica y valida.

import { createHash, timingSafeEqual } from "node:crypto";
import { pushACliente } from "@/lib/push";

export const dynamic = "force-dynamic";

// Comparación en tiempo constante. Se hashean ambos lados porque
// timingSafeEqual exige buffers del mismo largo (y así tampoco se filtra
// el largo del secreto por el error).
function secretoValido(recibido: string | null): boolean {
  const esperado = process.env.PUSH_CRON_SECRET;
  if (!esperado || !recibido) return false;
  const a = createHash("sha256").update(recibido).digest();
  const b = createHash("sha256").update(esperado).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!secretoValido(request.headers.get("x-push-secret"))) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  const p = (json ?? {}) as Partial<{
    clienteRef: string;
    title: string;
    body: string;
    url: string;
    tag: string;
  }>;
  const esTexto = (v: unknown): v is string => typeof v === "string" && v.length > 0;
  if (
    !esTexto(p.clienteRef) ||
    !esTexto(p.title) ||
    !esTexto(p.body) ||
    (p.url !== undefined && typeof p.url !== "string") ||
    (p.tag !== undefined && typeof p.tag !== "string")
  ) {
    return Response.json(
      { ok: false, error: "Body inválido: se espera { clienteRef, title, body, url?, tag? }" },
      { status: 400 },
    );
  }

  // pushACliente jamás lanza (y borra las suscripciones muertas por su cuenta).
  await pushACliente(p.clienteRef, { title: p.title, body: p.body, url: p.url, tag: p.tag });
  return Response.json({ ok: true });
}

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
  // clienteRef debe ser UUID: si n8n manda la expresión sin evaluar
  // ("={{ $json.cliente_ref }}"), mejor 400 acá que un 200 que nunca notifica.
  const esUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  if (
    !esTexto(p.clienteRef) ||
    !esUuid(p.clienteRef) ||
    !esTexto(p.title) ||
    !esTexto(p.body) ||
    // Solo rutas internas: el worker abre esta URL con la identidad de la barbería.
    // El backslash también se rechaza: "/\evil.com" pasa el startsWith("/") pero
    // WHATWG normaliza \ → / y clients.openWindow abriría //evil.com (externo).
    (p.url !== undefined &&
      !(typeof p.url === "string" && p.url.startsWith("/") && !p.url.startsWith("//") && !p.url.includes("\\"))) ||
    (p.tag !== undefined && typeof p.tag !== "string")
  ) {
    return Response.json(
      { ok: false, error: "Body inválido: se espera { clienteRef (uuid), title, body, url? (ruta interna), tag? }" },
      { status: 400 },
    );
  }

  // pushACliente jamás lanza (y borra las suscripciones muertas por su cuenta).
  const r = await pushACliente(p.clienteRef, { title: p.title, body: p.body, url: p.url, tag: p.tag });

  // Respuesta honesta: n8n manda el email igual, pero acá NO mentimos con un 200
  // fijo. Si el push está apagado (sin VAPID) o todos los envíos fallaron, se
  // devuelve ok:false + motivo + conteos para que el cron pueda detectar la
  // degradación. "Sin suscripciones" es un 200 legítimo (el cliente no activó
  // push), pero queda visible en el body (enviadas:0).
  if (!r.configurado) {
    return Response.json({ ok: false, motivo: "push_deshabilitado", ...r }, { status: 503 });
  }
  if (r.enviadas === 0 && r.fallidas > 0) {
    return Response.json({ ok: false, motivo: "envio_fallido", ...r }, { status: 502 });
  }
  return Response.json({ ok: true, ...r });
}

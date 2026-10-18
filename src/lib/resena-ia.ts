// La reseña redactada con Claude. SOLO SERVIDOR: lee ANTHROPIC_API_KEY.
// Módulo plano a propósito (sin "use server"): si viviera en un archivo de
// server actions, redactarConIA quedaría como un endpoint POST público que
// quema tokens sin validar el token de la visita ni el freno. El único camino
// es redactarResena (cliente-actions.ts), que valida y frena antes.
//
// Contrato: NUNCA lanza y nunca hace esperar más de 6 s. Si no hay llave, si
// falla, si tarda o si el modelo se niega, devuelve null y la action usa la
// plantilla de resena-texto.ts. El cliente no se entera de cuál salió.

import Anthropic from "@anthropic-ai/sdk";
import { SISTEMA_RESENA, pedidoResena, textoDeRespuestaIA } from "@/lib/resena-texto";

// El modelo, en UNA sola constante. claude-opus-5-5 es el default de la casa.
// Decisión del dueño si pesa el costo: "claude-haiku-5-5" es mucho más barato y
// alcanza para 2 frases, PERO no tiene fallback del lado del servidor: al
// cambiarlo hay que quitar `betas` y `fallbacks` de la llamada de abajo (con
// Haiku 5.5 la lista de fallbacks devuelve 400).
export const MODELO_RESENA = "claude-opus-5-5";

/** Lo máximo que el cliente espera la redacción antes de recibir la plantilla. */
const ESPERA_MAX_MS = 6_000;

let cliente: Anthropic | null = null;
function anthropic(): Anthropic {
  // Sin reintentos: con 6 s de presupuesto, reintentar solo alarga la espera
  // del cliente; para eso está la plantilla.
  cliente ??= new Anthropic({ timeout: ESPERA_MAX_MS, maxRetries: 0 });
  return cliente;
}

/** ¿Está configurada la IA? (si no, ni se intenta: la plantilla sale al instante). */
export function hayIA(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function redactarConIA(p: {
  score: number;
  etiquetas: string[];
  extra?: string | null;
  servicio?: string | null;
  version?: number;
  anterior?: string | null;
}): Promise<string | null> {
  if (!hayIA()) return null;
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), ESPERA_MAX_MS);
  try {
    const r = await anthropic().beta.messages.create(
      {
        model: MODELO_RESENA,
        // La respuesta son 2-3 frases, pero el razonamiento adaptativo cuenta
        // dentro de max_tokens: con menos, una respuesta podría cortarse.
        max_tokens: 1500,
        // Esfuerzo bajo: es redacción corta, no un problema difícil (y baja
        // la espera y el costo).
        output_config: { effort: "low" },
        // Si el filtro de seguridad de Opus 5.5 se niega (falso positivo con
        // algún comentario raro), el servidor reintenta en el modelo que
        // recomienda Anthropic para esa categoría, dentro de la misma llamada.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: SISTEMA_RESENA,
        messages: [{ role: "user", content: pedidoResena(p) }],
      },
      { signal: control.signal },
    );
    // stop_reason se mira antes de leer el texto (refusal / max_tokens = null).
    return textoDeRespuestaIA(r);
  } catch (e) {
    if (e instanceof Anthropic.APIUserAbortError || e instanceof Anthropic.APIConnectionTimeoutError) {
      console.warn("[redactarConIA] tardó más de 6 s; va la plantilla");
    } else if (e instanceof Anthropic.RateLimitError) {
      console.warn("[redactarConIA] límite de la API; va la plantilla");
    } else if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      console.error("[redactarConIA] la llave de Anthropic no sirve:", e.status);
    } else if (e instanceof Anthropic.APIError) {
      console.error("[redactarConIA]", e.status, e.message);
    } else {
      console.error("[redactarConIA]", e);
    }
    return null;
  } finally {
    clearTimeout(reloj);
  }
}

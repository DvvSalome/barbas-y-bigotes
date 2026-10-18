// La reseña redactada con IA (NVIDIA NIM). SOLO SERVIDOR: lee NVIDIA_API_KEY.
// Módulo plano a propósito (sin "use server"): si viviera en un archivo de
// server actions, redactarConIA quedaría como un endpoint POST público que
// quema tokens sin validar el token de la visita ni el freno. El único camino
// es redactarResena (cliente-actions.ts), que valida y frena antes.
//
// Contrato: NUNCA lanza y nunca hace esperar más de 6 s. Si no hay llave, si
// falla, si tarda o si el modelo corta, devuelve null y la action usa la
// plantilla de resena-texto.ts. El cliente no se entera de cuál salió.
//
// Proveedor: decisión del usuario (18-oct): la llave NVIDIA de FourG. Medido ese
// día: este modelo con el "thinking" apagado contesta en ~1 s y no inventa; con
// el thinking prendido tarda 6-10 s y, con un max_tokens chico, devuelve
// content null (se gasta todo pensando). llama-3.1-70b (el del asistente viejo)
// ya no existe en NVIDIA.

import { SISTEMA_RESENA, pedidoResena, textoDeRespuestaIA } from "@/lib/resena-texto";

export const MODELO_RESENA = "nvidia/nemotron-3-super-120b-a12b";
const URL_NIM = "https://integrate.api.nvidia.com/v1/chat/completions";

/** Lo máximo que el cliente espera la redacción antes de recibir la plantilla. */
const ESPERA_MAX_MS = 6_000;

/** ¿Está configurada la IA? (si no, ni se intenta: la plantilla sale al instante). */
export function hayIA(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY);
}

export async function redactarConIA(p: {
  score: number;
  etiquetas: string[];
  extra?: string | null;
  servicio?: string | null;
  version?: number;
  anterior?: string | null;
}): Promise<string | null> {
  const llave = process.env.NVIDIA_API_KEY;
  if (!llave) return null;
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), ESPERA_MAX_MS);
  try {
    const r = await fetch(URL_NIM, {
      method: "POST",
      headers: { Authorization: `Bearer ${llave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODELO_RESENA,
        temperature: 0.5,
        // 2-3 frases caben de sobra; con el thinking apagado no hay razonamiento
        // que se coma el tope.
        max_tokens: 300,
        chat_template_kwargs: { enable_thinking: false },
        messages: [
          { role: "system", content: SISTEMA_RESENA },
          { role: "user", content: pedidoResena(p) },
        ],
      }),
      signal: control.signal,
    });
    if (!r.ok) {
      console.error("[redactarConIA] NVIDIA respondió", r.status);
      return null;
    }
    const j = (await r.json()) as {
      choices?: { finish_reason?: string | null; message?: { content?: string | null } }[];
    };
    const c = j.choices?.[0];
    // Mismo saneado que antes: "length" (se cortó) o sin texto = plantilla.
    return textoDeRespuestaIA({
      stop_reason: c?.finish_reason === "stop" ? "end_turn" : (c?.finish_reason ?? null),
      content: [{ type: "text", text: c?.message?.content ?? "" }],
    });
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") console.warn("[redactarConIA] tardó más de 6 s; va la plantilla");
    else console.error("[redactarConIA]", e);
    return null;
  } finally {
    clearTimeout(reloj);
  }
}

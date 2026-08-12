"use server";

import { headers } from "next/headers";
import { sedes, servicios, barberos, categorias } from "@/lib/data/seed";
import { permitir } from "@/lib/rate-limit";

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

// Topes anti-abuso: es un proxy a un LLM (quema tokens/plata). El asistente es
// publico por diseno (ayuda a reservar sin login), asi que en vez de exigir
// sesion acotamos la entrada del cliente: cuantos mensajes y que tan largos.
const MAX_MENSAJES = 20;
const MAX_LARGO_MENSAJE = 2000;

// El rol 'system' lo pone SOLO el servidor (el system prompt de abajo). Nunca
// dejamos que el cliente inyecte un 'system' propio para no reescribir las reglas.
function sanearMensajes(messages: ChatMessage[]): ChatMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(m => m && typeof m.content === "string" && m.content.trim().length > 0)
    .slice(-MAX_MENSAJES)
    .map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content.slice(0, MAX_LARGO_MENSAJE)
    }));
}

export async function chatConAsistente(messages: ChatMessage[]): Promise<{ text: string }> {
  // Rate limit por IP (deuda #1 de la auditoría E2E): sin esto, un bucle contra
  // esta action quemaba tokens del LLM sin freno. 8/min y 40/hora sobra para
  // una conversación humana de reserva; el exceso recibe un mensaje amable sin
  // tocar el modelo. Además un techo global por instancia como red de fondo.
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "sin-ip";
  if (!permitir(`ia:${ip}`, { porMinuto: 8, porHora: 40 }) || !permitir("ia:global", { porMinuto: 60, porHora: 600 })) {
    return {
      text: "Uy, me están llegando muchos mensajes seguidos 😅. Dame un minutico y volvemos a hablar — o si prefieres, reserva directo con los botones de arriba.",
    };
  }

  const nvidiaKey = process.env.NVIDIA_API_KEY || process.env.NVAPI_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  const mensajesSaneados = sanearMensajes(messages);

  const servicesContext = servicios.map(s => ({
    id: s.id,
    nombre: s.nombre,
    categoria: categorias[s.categoria] || s.categoria,
    duracion: `${s.duracionMin} min`,
    precios: s.precios
  }));

  const barbersContext = barberos.map(b => ({
    id: b.id,
    nombre: b.nombre,
    sede: b.sede === "parque-venezuela" ? "Parque Venezuela" : "Plaza de la Paz"
  }));

  const sedesContext = sedes.map(sd => ({
    id: sd.id,
    nombre: sd.nombre
  }));

  const systemPrompt = `Eres el Asistente de Reservas Virtual de la barbería "Barbas & Bigotes" en Barranquilla.
Tu objetivo es ayudar al usuario a agendar su cita de corte o cuidado masculino de forma amable, directa y con estilo barranquillero ("ajá", "bro", "bacano", "todo bien").

Aquí tienes el catálogo real de la barbería (servicios, barberos y sedes):
SEDES: ${JSON.stringify(sedesContext)}
BARBEROS: ${JSON.stringify(barbersContext)}
SERVICIOS: ${JSON.stringify(servicesContext)}

REGLAS DE COMPORTAMIENTO:
1. Sé conciso y directo. No des rodeos innecesarios.
2. Si el cliente no especifica sede, sugiérele elegir entre: Parque Venezuela y Plaza de la Paz.
3. Si no especifica barbero, sugiérele los disponibles para esa sede.
4. Ayúdalo a encontrar el servicio ideal (corte, barba, cejas, faciales, combos premium/deluxe).
5. Cuando tengas definidos:
   - Sede (ID exacto: "parque-venezuela" o "plaza-de-la-paz")
   - Barbero (nombre o ID)
   - Servicio (ID exacto del catálogo)
   Pregúntale por la fecha (hoy es lunes 29 de junio de 2026) y la hora deseada.
6. IMPORTANTE: Al final de tu mensaje, si y solo si has concretado estos campos con el usuario, añade una línea al final del texto con este formato exacto de JSON para que la interfaz lo procese:
   ACTION_CONFIRM: {"sedeId": "[id]", "barberoId": "[id]", "servicioId": "[id]", "fecha": "YYYY-MM-DD", "hora": [minutos_desde_media_noche]}
   Ejemplo de hora: 9:00 am son 540 minutos, 10:00 am son 600, 2:30 pm son 870, etc.

Habla en español colombiano caribeño.`;

  const fullMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...mensajesSaneados
  ];

  try {
    if (nvidiaKey) {
      const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${nvidiaKey}`
        },
        body: JSON.stringify({
          model: "meta/llama-3.1-70b-instruct",
          messages: fullMessages,
          temperature: 0.7,
          max_tokens: 512
        })
      });

      if (response.ok) {
        const json = await response.json();
        return { text: json.choices[0].message.content };
      } else {
        console.warn("NVIDIA NIM API falló, usando Gemini fallback. Status:", response.status);
      }
    }

    if (geminiKey) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: fullMessages.map(m => ({
              role: m.role === "assistant" ? "model" : m.role === "system" ? "user" : m.role,
              parts: [{ text: m.content }]
            })),
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 512
            }
          })
        }
      );

      if (response.ok) {
        const json = await response.json();
        return { text: json.candidates[0].content.parts[0].text };
      } else {
        throw new Error(`Gemini API respondió con error: ${response.statusText}`);
      }
    }

    throw new Error("No hay API keys configuradas en el servidor (NVIDIA_API_KEY o GEMINI_API_KEY)");
  } catch (err) {
    console.error("Error en chatConAsistente:", err instanceof Error ? err.message : err);
    return { text: "Todo bien bro, pero ando con problemas de conexión ahora mismo. ¿Podrías agendar usando el formulario clásico mientras me recupero?" };
  }
}

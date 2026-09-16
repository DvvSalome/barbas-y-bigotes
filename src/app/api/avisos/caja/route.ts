// POST /api/avisos/caja — "la caja sigue abierta": lo dispara un cron externo
// (GitHub Actions, 21:05 Bogotá) con el header x-push-secret. Busca cajas en
// estado 'abierta' y manda un push a la SEDE (la pantalla del mostrador), que
// es quien puede cerrarla. Nace del caso real del piloto: una caja quedó 22
// días abierta y nadie lo vio hasta entrar al cuadre.
// ?dry=1 = ensayo: reporta qué mandaría sin notificar a nadie.

import { supabaseAdmin } from "@/lib/supabase/server";
import { pushASede } from "@/lib/push";
import { secretoCronValido } from "@/lib/cron-secret";
import { horaBogota } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!secretoCronValido(request.headers.get("x-push-secret"))) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const dry = new URL(request.url).searchParams.get("dry") === "1";

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("caja_sesiones")
    .select("sede_id,abierta_en")
    .eq("estado", "abierta");
  if (error) return Response.json({ ok: false, error: "No se pudo leer las cajas" }, { status: 500 });

  const abiertas = (data ?? []) as { sede_id: string; abierta_en: string }[];
  const resultados: { sede: string; enviadas?: number; fallidas?: number }[] = [];

  for (const c of abiertas) {
    if (dry) {
      resultados.push({ sede: c.sede_id });
      continue;
    }
    const r = await pushASede(c.sede_id, {
      title: "La caja sigue abierta 💰",
      body: `Se abrió a las ${horaBogota(c.abierta_en)} y aún no se cierra. Cuenta el efectivo y ciérrala en el mostrador antes de salir.`,
      url: "/barbero?tab=cierre",
      // tag fijo: si el cron repite, el aviso se REEMPLAZA en vez de apilarse.
      tag: "caja-abierta",
    });
    resultados.push({ sede: c.sede_id, enviadas: r.enviadas, fallidas: r.fallidas });
  }

  return Response.json({ ok: true, dry, cajasAbiertas: abiertas.length, resultados });
}

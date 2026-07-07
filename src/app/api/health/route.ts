// GET /api/health — healthcheck liviano para un uptime monitor externo.
// Hace un ping mínimo a Supabase (count de sedes con la anon key, sin exponer
// datos) y responde { ok, db, ts }. 200 si la DB responde, 503 si no.
// NO expone datos sensibles: solo un booleano de disponibilidad y el timestamp.

import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const ts = new Date().toISOString();
  try {
    // head:true + count exact = no trae filas, solo confirma que la DB responde.
    const { error } = await supabaseServer()
      .from("sedes")
      .select("id", { count: "exact", head: true });
    if (error) {
      return Response.json({ ok: false, db: false, ts }, { status: 503 });
    }
    return Response.json({ ok: true, db: true, ts });
  } catch {
    return Response.json({ ok: false, db: false, ts }, { status: 503 });
  }
}

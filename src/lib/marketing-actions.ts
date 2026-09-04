"use server";

import { supabaseAdmin } from "@/lib/supabase/server";

// Baja y alta de los avisos de marketing ("te toca corte", promos) por el enlace
// del correo. Público y sin login: el token de la ficha es la credencial, igual
// que /confirmar/[token]. Nunca borra nada; solo apaga o prende una marca.

const TOKEN_RE = /^[0-9a-f-]{36}$/i;

export type EstadoMarketing = { estado: "invalido" } | { estado: "activo" | "baja"; nombre: string };

async function ficha(token: string) {
  if (!TOKEN_RE.test(token)) return null;
  const { data } = await supabaseAdmin()
    .from("clientes")
    .select("id,nombre,baja_en,acepta_marketing")
    .eq("marketing_token", token)
    .maybeSingle();
  return (data as { id: string; nombre: string; baja_en: string | null; acepta_marketing: boolean } | null) ?? null;
}

const estadoDe = (f: { nombre: string; baja_en: string | null; acepta_marketing: boolean }): EstadoMarketing => ({
  estado: f.baja_en || !f.acepta_marketing ? "baja" : "activo",
  nombre: f.nombre,
});

export async function estadoMarketingPorToken(token: string): Promise<EstadoMarketing> {
  const f = await ficha(token);
  return f ? estadoDe(f) : { estado: "invalido" };
}

/** Idempotente: darse de baja dos veces deja lo mismo. */
export async function darDeBajaPorToken(token: string): Promise<EstadoMarketing> {
  const f = await ficha(token);
  if (!f) return { estado: "invalido" };
  if (!f.baja_en) {
    await supabaseAdmin()
      .from("clientes")
      .update({ baja_en: new Date().toISOString(), acepta_marketing: false })
      .eq("id", f.id);
  }
  return { estado: "baja", nombre: f.nombre };
}

export async function reactivarAvisosPorToken(token: string): Promise<EstadoMarketing> {
  const f = await ficha(token);
  if (!f) return { estado: "invalido" };
  await supabaseAdmin()
    .from("clientes")
    .update({ baja_en: null, acepta_marketing: true, marketing_en: new Date().toISOString() })
    .eq("id", f.id);
  return { estado: "activo", nombre: f.nombre };
}

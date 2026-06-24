"use server";

import { type SupabaseClient } from "@supabase/supabase-js";
import { supabaseServerAuth, supabaseAdmin } from "@/lib/supabase/server";

export type CuentaContext = { estado: "anon" | "staff" | "cliente"; clienteId?: string };

// Devuelve el cliente_id de un usuario logueado NO-staff, creando su ficha si no existe.
// CLAVE DE SEGURIDAD: el enlace es por auth_id (identidad VERIFICADA de Google), nunca por
// email. clientes.email no es verificado (lo tipea cualquiera en el booking público), así que
// adoptar una ficha por email permitiría apropiarse de la ficha/PII de otra persona.
// Devuelve null si el usuario es staff. Corre con service role (admin), de confianza.
export async function clienteIdForUser(
  admin: SupabaseClient,
  userId: string,
  email: string,
  nombre: string,
): Promise<string | null> {
  const { data: prof } = await admin.from("profiles").select("id").eq("auth_id", userId).maybeSingle();
  if (prof) return null; // es staff, no cliente
  const { data: byAuth } = await admin.from("clientes").select("id").eq("auth_id", userId).maybeSingle();
  if (byAuth) return (byAuth as { id: string }).id;
  const { data: created } = await admin
    .from("clientes")
    .insert({ nombre: nombre || "Cliente", email: email || null, auth_id: userId, origen: "app" })
    .select("id")
    .single();
  return (created as { id: string } | null)?.id ?? null;
}

// Resuelve el estado del usuario para el portal y asegura su ficha de cliente.
export async function ensureCliente(): Promise<CuentaContext> {
  const sb = await supabaseServerAuth();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { estado: "anon" };

  const admin = supabaseAdmin();
  const { data: prof } = await admin.from("profiles").select("id").eq("auth_id", user.id).maybeSingle();
  if (prof) return { estado: "staff" };

  const email = (user.email ?? "").trim().toLowerCase();
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const nombre = (meta.full_name as string) || (meta.name as string) || (email ? email.split("@")[0] : "Cliente");
  const id = await clienteIdForUser(admin, user.id, email, nombre);
  return { estado: "cliente", clienteId: id ?? undefined };
}

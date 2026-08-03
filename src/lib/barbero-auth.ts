"use server";

import { supabaseServerAuth, supabaseAdmin } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/data/queries";
import { errorPublico } from "@/lib/errors";

const PINS_TRIVIALES = new Set([
  "000000", "111111", "222222", "333333", "444444", "555555", "666666",
  "777777", "888888", "999999", "123456", "654321", "012345", "121212",
]);

function esPinValido(pin: string): boolean {
  return /^\d{6}$/.test(pin) && !PINS_TRIVIALES.has(pin);
}

// Login del barbero por PIN. Verifica (con bloqueo) y mina la sesión real de Supabase.
export async function loginBarberoPin(
  barberoId: string,
  pin: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!/^\d{6}$/.test(pin)) return { ok: false, error: "El PIN son 6 dígitos." };

  const admin = supabaseAdmin();
  const { data: estado, error: vErr } = await admin.rpc("verificar_pin_barbero", {
    p_barbero_id: barberoId,
    p_pin: pin,
  });
  if (vErr) return { ok: false, error: "No se pudo verificar el PIN." };
  if (estado === "locked") return { ok: false, error: "Demasiados intentos. Esperá unos minutos." };
  if (estado !== "ok") return { ok: false, error: "PIN incorrecto." };

  // Resolver el email de auth del barbero y minar su sesión.
  const { data: prof } = await admin
    .from("profiles")
    .select("auth_id")
    .eq("barbero_id", barberoId)
    .eq("rol", "barbero")
    .maybeSingle();
  const authId = (prof as { auth_id?: string } | null)?.auth_id;
  if (!authId) return { ok: false, error: "Este barbero no tiene acceso configurado. Avisa al admin." };

  const { data: userData } = await admin.auth.admin.getUserById(authId);
  const email = userData?.user?.email;
  if (!email) return { ok: false, error: "Este barbero no tiene acceso configurado. Avisa al admin." };

  const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = (link as { properties?: { hashed_token?: string } } | null)?.properties?.hashed_token;
  if (lErr || !tokenHash) return { ok: false, error: "No se pudo iniciar sesión. Intenta de nuevo." };

  const sb = await supabaseServerAuth();
  const { error: oErr } = await sb.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (oErr) return { ok: false, error: "No se pudo iniciar sesión. Intenta de nuevo." };

  // Defensa: la sesión minada debe ser exactamente la de este barbero (no dependemos
  // de la unicidad de email de Supabase; lo verificamos contra el auth_id resuelto).
  const { data: { user } } = await sb.auth.getUser();
  if (!user || user.id !== authId) {
    await sb.auth.signOut();
    return { ok: false, error: "No se pudo iniciar sesión. Intenta de nuevo." };
  }

  return { ok: true };
}

/**
 * Login del MOSTRADOR de una sede por PIN (migración 0044). Mismo camino que el
 * del barbero —verificar con bloqueo, minar una sesión real de Supabase para que
 * la RLS siga aplicando, y comprobar que la sesión minada es la esperada—, pero
 * la identidad es la sede: un aparato compartido en el local, no una persona.
 */
export async function loginSedePin(
  sedeId: string,
  pin: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!/^\d{6}$/.test(pin)) return { ok: false, error: "El PIN son 6 dígitos." };

  const admin = supabaseAdmin();
  const { data: estado, error: vErr } = await admin.rpc("verificar_pin_sede", {
    p_sede_id: sedeId,
    p_pin: pin,
  });
  if (vErr) return { ok: false, error: "No se pudo verificar el PIN." };
  if (estado === "bloqueado") return { ok: false, error: "Demasiados intentos. Espera unos minutos." };
  if (estado === "sin_pin") return { ok: false, error: "Esta sede todavía no tiene PIN. Avísale al admin." };
  if (estado !== "ok") return { ok: false, error: "PIN incorrecto." };

  const { data: prof } = await admin
    .from("profiles")
    .select("auth_id")
    .eq("sede_id", sedeId)
    .eq("rol", "sede")
    .maybeSingle();
  const authId = (prof as { auth_id?: string } | null)?.auth_id;
  if (!authId) return { ok: false, error: "Esta sede no tiene acceso configurado. Avísale al admin." };

  const { data: userData } = await admin.auth.admin.getUserById(authId);
  const email = userData?.user?.email;
  if (!email) return { ok: false, error: "Esta sede no tiene acceso configurado. Avísale al admin." };

  const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = (link as { properties?: { hashed_token?: string } } | null)?.properties?.hashed_token;
  if (lErr || !tokenHash) return { ok: false, error: "No se pudo iniciar sesión. Intenta de nuevo." };

  const sb = await supabaseServerAuth();
  const { error: oErr } = await sb.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (oErr) return { ok: false, error: "No se pudo iniciar sesión. Intenta de nuevo." };

  // La sesión minada tiene que ser EXACTAMENTE la de esta sede.
  const { data: { user } } = await sb.auth.getUser();
  if (!user || user.id !== authId) {
    await sb.auth.signOut();
    return { ok: false, error: "No se pudo iniciar sesión. Intenta de nuevo." };
  }

  return { ok: true };
}

async function esAdmin(): Promise<boolean> {
  const staff = await getStaffContext();
  return staff.rol === "admin";
}

export async function setearPinBarbero(
  barberoId: string,
  pin: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await esAdmin())) return { ok: false, error: "Requiere permiso de administrador" };
  if (!esPinValido(pin)) return { ok: false, error: "PIN inválido (6 dígitos, no triviales como 123456 o 000000)." };
  const admin = supabaseAdmin();
  const { error } = await admin.rpc("set_pin_barbero", { p_barbero_id: barberoId, p_pin: pin });
  if (error) return { ok: false, error: errorPublico("setearPinBarbero", error, "No se pudo guardar el PIN. Intenta de nuevo.") };
  return { ok: true };
}

export async function desbloquearBarbero(barberoId: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await esAdmin())) return { ok: false, error: "Requiere permiso de administrador" };
  const admin = supabaseAdmin();
  const { error } = await admin.rpc("desbloquear_barbero", { p_barbero_id: barberoId });
  if (error) return { ok: false, error: errorPublico("desbloquearBarbero", error, "No se pudo desbloquear. Intenta de nuevo.") };
  return { ok: true };
}

/** Fija o rota el PIN del mostrador de una sede (0044). Solo admin. */
export async function setearPinSede(sedeId: string, pin: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await esAdmin())) return { ok: false, error: "Requiere permiso de administrador" };
  if (!esPinValido(pin)) return { ok: false, error: "PIN inválido (6 dígitos, no triviales como 123456 o 000000)." };
  const admin = supabaseAdmin();
  const { error } = await admin.rpc("setear_pin_sede", { p_sede_id: sedeId, p_pin: pin });
  if (error) return { ok: false, error: errorPublico("setearPinSede", error, "No se pudo guardar el PIN. Intenta de nuevo.") };
  return { ok: true };
}

/** Estado del PIN por sede (para la pantalla admin). El hash nunca sale. */
export async function getSedesPinEstado(): Promise<Record<string, { tienePin: boolean; bloqueado: boolean }>> {
  if (!(await esAdmin())) return {};
  const admin = supabaseAdmin();
  const { data, error } = await admin.from("sede_pin").select("sede_id,pin_hash,bloqueado_hasta");
  if (error) console.error("getSedesPinEstado:", error.message);
  const now = Date.now();
  const out: Record<string, { tienePin: boolean; bloqueado: boolean }> = {};
  for (const r of (data ?? []) as { sede_id: string; pin_hash: string; bloqueado_hasta: string | null }[]) {
    out[r.sede_id] = {
      tienePin: !!r.pin_hash,
      bloqueado: !!r.bloqueado_hasta && new Date(r.bloqueado_hasta).getTime() > now,
    };
  }
  return out;
}

// Estado de PIN por barbero (para la pantalla admin).
export async function getBarberosPinEstado(): Promise<Record<string, { tienePin: boolean; bloqueado: boolean }>> {
  if (!(await esAdmin())) return {};
  const admin = supabaseAdmin();
  const { data, error } = await admin.from("barbero_pin").select("barbero_id,pin_hash,bloqueado_hasta");
  if (error) console.error("getBarberosPinEstado:", error.message);
  const now = Date.now();
  const out: Record<string, { tienePin: boolean; bloqueado: boolean }> = {};
  for (const r of (data ?? []) as { barbero_id: string; pin_hash: string; bloqueado_hasta: string | null }[]) {
    out[r.barbero_id] = {
      tienePin: !!r.pin_hash,
      bloqueado: !!r.bloqueado_hasta && new Date(r.bloqueado_hasta).getTime() > now,
    };
  }
  return out;
}

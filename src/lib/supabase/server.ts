import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// anon, sin sesión — para lecturas públicas de catálogos (sedes, servicios, etc.)
export function supabaseServer() {
  return createClient(URL, KEY, { auth: { persistSession: false } });
}

// service role (SOLO SERVIDOR) — para escrituras de origen público sin sesión (ej. reserva
// desde el sitio). Nunca exponer al cliente; bypassa RLS, usar solo en server actions de confianza.
export function supabaseAdmin() {
  return createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

// con sesión (cookies) — para getUser y escrituras autenticadas
export async function supabaseServerAuth() {
  const cookieStore = await cookies();
  return createServerClient(URL, KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // setAll falla en server components (solo lectura); se ignora.
        }
      },
    },
  });
}

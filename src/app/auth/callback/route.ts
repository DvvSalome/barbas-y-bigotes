import { NextResponse } from "next/server";
import { supabaseServerAuth } from "@/lib/supabase/server";

// Callback de OAuth (Google): cambia el code por sesión (cookies) y redirige.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextRaw = searchParams.get("next") ?? "/cuenta";
  // Evita open-redirect: solo rutas internas (no "//host" ni absolutas).
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/cuenta";
  if (code) {
    const sb = await supabaseServerAuth();
    await sb.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${origin}${next}`);
}

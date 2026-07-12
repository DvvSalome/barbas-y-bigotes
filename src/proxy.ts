import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Refresh de sesión de Supabase en cada request con sesión (patrón oficial
// @supabase/ssr). Los server components no pueden escribir cookies, así que
// sin esto el token vence ~1h después del login y la sesión muere en
// navegación pura. Acá NO hay authz: los guards viven en los layouts.
// (Next 16: la convención `middleware` fue renombrada a `proxy`.)
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() valida el token contra Supabase y dispara el refresh si venció;
  // las cookies rotadas viajan en `response` vía setAll.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Solo las rutas que usan sesión (Google del cliente o PIN del barbero).
  matcher: ["/admin/:path*", "/barbero/:path*", "/cuenta/:path*", "/login"],
};

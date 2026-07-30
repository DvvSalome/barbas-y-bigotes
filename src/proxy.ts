import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Refresh de sesión de Supabase en cada request con sesión (patrón oficial
// @supabase/ssr). Los server components no pueden escribir cookies, así que
// sin esto el token vence ~1h después del login y la sesión muere en
// navegación pura.
//
// Además corta ANÓNIMOS de raíz en /admin y /barbero: el candado fino (rol
// admin vs barbero) sigue viviendo en los layouts, pero el layout no impide
// que Next streamee el payload RSC del page hijo (agenda, cobrado, comisiones)
// ANTES de que su redirect() resuelva —> fuga de datos a un no-logueado
// (AUD-B-001 / AUD-B-002). El proxy corre en el borde, antes de los Server
// Components: si no hay sesión, redirige acá y el page nunca se ejecuta.
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Anónimo (sin sesión) en zona de staff: cortar ANTES de cualquier render.
  // Solo /admin y /barbero; /login es público y /cuenta maneja su propio caso
  // (login del cliente es Google). El rol fino (barbero vs admin) lo siguen
  // resolviendo los layouts; acá solo se veta la ausencia total de sesión.
  const { pathname } = request.nextUrl;
  const zonaStaff = pathname.startsWith("/admin") || pathname.startsWith("/barbero");
  if (!user && zonaStaff) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirect = NextResponse.redirect(url);
    // Un anónimo no tiene cookies que rotar, pero copiamos las de `response`
    // por si getUser limpió tokens vencidos.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  // Solo las rutas que usan sesión (Google del cliente o PIN del barbero).
  matcher: ["/admin/:path*", "/barbero/:path*", "/cuenta/:path*", "/login"],
};

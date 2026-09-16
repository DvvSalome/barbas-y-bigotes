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

  // Redirige conservando las cookies que getUser() haya rotado; si no, una
  // sesión recién refrescada se perdería justo al ser expulsada.
  const irA = (destino: string) => {
    const url = request.nextUrl.clone();
    url.pathname = destino;
    const salida = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => salida.cookies.set(cookie));
    return salida;
  };

  // Sin sesión en zona de staff: cortar ANTES de cualquier render.
  if (!user && zonaStaff) return irA("/login");

  // Y el rol FINO de /admin se decide acá también, no solo en el layout. El
  // layout redirige, sí, pero Next renderiza layout y página en PARALELO: su
  // redirect() no llega a tiempo para frenar los fetches de la página, y
  // varios de esos leen con service_role (bypassan RLS). Medido en producción
  // con una sesión de barbero: /admin/liquidacion respondía 307 a /barbero y
  // aun así entregaba 54 KB con la liquidación del equipo (nombres y montos);
  // lo mismo en las otras 7 pantallas probadas. El gate propio que ya tenían
  // Hoy, Cupones y Horarios tapaba solo esas tres. Acá corre en el borde,
  // antes de que exista el Server Component, así que la página ni se ejecuta.
  if (user && pathname.startsWith("/admin")) {
    const { data: perfil } = await supabase
      .from("profiles")
      .select("rol")
      .eq("auth_id", user.id)
      .maybeSingle();
    const rol = (perfil as { rol?: string } | null)?.rol;
    // Sin fila en profiles es un CLIENTE (entró con Google), no un barbero.
    if (rol !== "admin") return irA(rol ? "/barbero" : "/cuenta");
  }

  return response;
}

export const config = {
  // Solo las rutas que usan sesión (Google del cliente o PIN del barbero).
  matcher: ["/admin/:path*", "/barbero/:path*", "/cuenta/:path*", "/login"],
};

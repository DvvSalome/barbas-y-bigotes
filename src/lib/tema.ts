// Tema claro/oscuro del STAFF (/admin y /barbero). El sitio público es dark de
// marca y NO lee esta cookie (PRODUCT.md: registro doble).
//
// SSR sin flash: los layouts staff leen la cookie con cookies() de next/headers
// y pintan data-theme en el mismo wrapper [data-staff]; el toggle client-side
// (PerfilMenu) actualiza el atributo en vivo y persiste la cookie.

export const TEMA_COOKIE = "bb-tema";

export type TemaStaff = "dark" | "light";

/** Normaliza el valor de la cookie: ausente o inválido = dark (default de marca). */
export function temaDesdeCookie(valor: string | undefined): TemaStaff {
  return valor === "light" ? "light" : "dark";
}

/**
 * Aplica el tema en vivo (sin recargar) y lo persiste un año.
 * Solo client-side: toca DOM y document.cookie.
 */
export function aplicarTema(tema: TemaStaff) {
  document.querySelectorAll<HTMLElement>("[data-staff]").forEach((el) => {
    el.setAttribute("data-theme", tema);
  });
  document.cookie = `${TEMA_COOKIE}=${tema}; path=/; max-age=31536000; samesite=lax`;
}

/** Lee el tema actual del wrapper staff ya pintado por el server (client-side). */
export function temaActual(): TemaStaff {
  const el = document.querySelector<HTMLElement>("[data-staff]");
  return temaDesdeCookie(el?.getAttribute("data-theme") ?? undefined);
}

/* ─────────────────────────────────────────────────────────────
   El tema se toca desde TRES lugares: el botón de la cabecera, el
   selector de Ajustes y el menú del avatar. Sin un lugar común, tocar
   uno dejaba a los otros dos mostrando el valor viejo hasta que algo
   los re-dibujara: el selector decía "Oscuro" con la pantalla en claro.

   Esto es ese lugar común. Cada vista se suscribe con
   useSyncExternalStore y todas se enteran del mismo cambio.
   ───────────────────────────────────────────────────────────── */

const oyentes = new Set<() => void>();

/** Para useSyncExternalStore: avisa cuando el tema cambia desde cualquier vista. */
export function suscribirTema(avisar: () => void) {
  oyentes.add(avisar);
  return () => {
    oyentes.delete(avisar);
  };
}

/**
 * Instantánea del tema. Devuelve un string, así que React lo compara por valor
 * y no re-dibuja de más. En el servidor no hay DOM: se usa `temaServidor`.
 */
export function leerTema(): TemaStaff {
  if (typeof document === "undefined") return "dark";
  return temaActual();
}

/** Instantánea del servidor. El layout ya pintó el atributo, así que al hidratar se corrige solo. */
export const temaServidor = (): TemaStaff => "dark";

/** Cambia el tema y avisa a todas las vistas suscritas. Usar esto, no aplicarTema. */
export function ponerTema(tema: TemaStaff) {
  aplicarTema(tema);
  oyentes.forEach((f) => f());
}

/** Del oscuro al claro y al revés. Lo que hace el botón de la cabecera. */
export function alternarTema(): TemaStaff {
  const proximo: TemaStaff = leerTema() === "dark" ? "light" : "dark";
  ponerTema(proximo);
  return proximo;
}

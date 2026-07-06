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

// Un deploy nuevo deja huérfanas las pestañas abiertas con el bundle viejo: sus
// server actions ya no existen en el servidor ("Failed to find Server Action.
// This request might be from an older or newer deployment") y TODO lo que toque
// el servidor revienta hasta recargar — el cliente ve "no se pudo" sin saber por
// qué, y el mostrador (una tablet que queda abierta todo el día) se queda sin
// poder cobrar. Vercel lo resuelve con Skew Protection, pero es del plan Pro.
//
// Versión casera: cuando una action REVIENTA (rechaza; un {ok:false} no cuenta),
// se recarga la página UNA vez por pestaña cada 10 minutos. El service worker
// sirve los documentos NetworkFirst, así que la recarga trae el HTML y los ids
// nuevos. Si vuelve a fallar dentro de esa ventana, no era el deploy: el caller
// muestra su error de siempre. Sin conexión no se recarga (caería en /~offline).
const CLAVE = "bb-recarga-deploy";
const VENTANA_MS = 10 * 60_000;

/** true = se disparó la recarga (no sigas pintando nada). false = muestra tu error. */
export function recargarSiDeployViejo(): boolean {
  if (typeof window === "undefined" || navigator.onLine === false) return false;
  try {
    const ultima = Number(sessionStorage.getItem(CLAVE) ?? 0);
    if (Date.now() - ultima < VENTANA_MS) return false;
    sessionStorage.setItem(CLAVE, String(Date.now()));
  } catch {
    // Sin sessionStorage no hay cómo frenar un bucle de recargas: mejor no recargar.
    return false;
  }
  // Que el service worker busque su versión nueva también (no bloquea la recarga).
  navigator.serviceWorker
    ?.getRegistration()
    .then((r) => r?.update())
    .catch(() => {});
  window.location.reload();
  return true;
}

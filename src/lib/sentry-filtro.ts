// Decisión de qué error de navegador vale la pena reportar. Módulo plano (sin
// imports de Next/Sentry) para poder verificarlo con Node: scripts/check-sentry.ts.
//
// Un filtro de errores es peligroso en las dos direcciones. Si deja pasar todo,
// el ruido entierra el aviso que importa. Si filtra de más, un bug real
// desaparece y nadie se entera nunca. Por eso la regla vive acá, sola y probada.

/**
 * Esquemas de archivo que solo puede producir una extensión del navegador.
 * `ext:` es el de los runtimes tipo Deno que embeben algunas extensiones; los
 * demás son los oficiales de cada navegador. Nuestro código siempre viene de
 * `https://<dominio>/…`, así que ninguno de estos puede aparecer en un stack
 * legítimo de la app.
 */
const ESQUEMAS_DE_EXTENSION = /^(ext:|chrome-extension:|moz-extension:|safari-(web-)?extension:|webkit-masked-url:)/;

/**
 * ¿La pila viene de una extensión del navegador?
 *
 * Alcanza con que la extensión aparezca en CUALQUIER punto: si tocó el stack,
 * no hay nada que podamos arreglar de nuestro lado.
 *
 * Sin stack devuelve false a propósito: ante la duda es mejor recibir ruido que
 * quedarse ciego ante un error real.
 */
export function esRuidoDeExtension(archivos: (string | undefined)[]): boolean {
  return archivos.some((f) => ESQUEMAS_DE_EXTENSION.test(f ?? ""));
}

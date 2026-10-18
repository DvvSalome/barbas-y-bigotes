// Limitador de frecuencia EN MEMORIA (sin dependencias ni tabla): ventana
// deslizante por clave (típicamente la IP). Es por instancia serverless —
// varias instancias = varios cupos — pero como disuasión real alcanza: el
// abuso barato es un bucle contra UNA instancia caliente.
// ponytail: en memoria; pasar a tabla/Redis si el abuso real lo amerita.

const registros = new Map<string, number[]>();
const MAX_CLAVES = 5_000; // techo de memoria: pasado esto se vacía (reset suave)
const HORA = 3_600_000;
const DIA = 24 * HORA;

/**
 * `porDia` es opcional (la reseña con IA: 6 por visita al día). Sin él, la
 * clave solo guarda la última hora, como siempre.
 */
export function permitir(
  clave: string,
  limites: { porMinuto: number; porHora: number; porDia?: number },
): boolean {
  const ahora = Date.now();
  if (registros.size > MAX_CLAVES) registros.clear();

  const ventana = limites.porDia !== undefined ? DIA : HORA;
  const marcas = (registros.get(clave) ?? []).filter((t) => ahora - t < ventana);
  const ultimoMinuto = marcas.filter((t) => ahora - t < 60_000).length;
  const ultimaHora = marcas.filter((t) => ahora - t < HORA).length;
  if (
    ultimoMinuto >= limites.porMinuto ||
    ultimaHora >= limites.porHora ||
    (limites.porDia !== undefined && marcas.length >= limites.porDia)
  ) {
    registros.set(clave, marcas); // registra la poda, no el intento rechazado
    return false;
  }
  marcas.push(ahora);
  registros.set(clave, marcas);
  return true;
}

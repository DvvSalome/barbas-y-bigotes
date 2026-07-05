// Red de seguridad de timezone: Vercel corre en UTC y `TZ` es una env reservada
// que no se puede setear desde el dashboard, así que fijamos el timezone del
// proceso por código. El negocio vive en Bogotá (UTC-5, sin DST). Los cálculos
// críticos igual usan bogotaDayRange() (src/lib/slots.ts) y no dependen de esto.
export function register() {
  process.env.TZ = "America/Bogota";
}

import { createHash, timingSafeEqual } from "node:crypto";

// Validación del secreto de los crons externos (n8n, GitHub Actions) contra
// PUSH_CRON_SECRET. Comparación en tiempo constante: se hashean ambos lados
// porque timingSafeEqual exige buffers del mismo largo (y así tampoco se
// filtra el largo del secreto por el error). Compartido por /api/push y
// /api/avisos/caja — la seguridad no se copia-pega.
export function secretoCronValido(recibido: string | null): boolean {
  const esperado = process.env.PUSH_CRON_SECRET;
  if (!esperado || !recibido) return false;
  const a = createHash("sha256").update(recibido).digest();
  const b = createHash("sha256").update(esperado).digest();
  return timingSafeEqual(a, b);
}

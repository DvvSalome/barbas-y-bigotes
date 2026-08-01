// Valida las plantillas de correo versionadas (docs/emails/*.html) contra la
// trampa que ya rompió el cupo Y la confirmación en silencio: un {{ }} VACÍO
// (aunque sea dentro de un comentario) hace que n8n lo evalúe como expresión y
// tire "invalid syntax" → el correo no sale y el cron reintenta para siempre.
// (No se chequea balance de {{ }}: las expresiones llevan objetos JS con `}}`
// legítimos, así que contarlas da falsos positivos.) Corre en `npm test` (CI).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "docs", "emails");
const archivos = readdirSync(dir).filter((f) => f.endsWith(".html"));
let fallos = 0;

for (const f of archivos) {
  const html = readFileSync(join(dir, f), "utf8");
  const vacias = html.match(/\{\{\s*\}\}/g) || [];
  if (vacias.length) {
    console.error(`✗ ${f}: ${vacias.length} expresión {{ }} VACÍA → rompe el envío en n8n (invalid syntax)`);
    fallos++;
  }
}

if (fallos) {
  console.error(`check-correos FALLÓ — ${fallos} problema(s) en docs/emails/. Reescribí sin llaves dobles (ni en comentarios).`);
  process.exit(1);
}
console.log(`check-correos OK — ${archivos.length} plantillas sin {{ }} vacías`);

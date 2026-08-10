// Chequeo ejecutable de los rangos de período de /admin/metricas.
//
//   TZ=UTC node scripts/check-metricas.ts
//
// El bug que este check existe para atrapar: comparar un mes A MEDIAS contra el
// mes anterior COMPLETO. Eso haría que el panel diga "vas peor" todos los meses
// hasta el día 30, y el dueño tomaría decisiones con un número que miente.
import assert from "node:assert/strict";
import { rangoPeriodo, bogotaYmd } from "../src/lib/slots.ts";
import { celdaCsv } from "../src/lib/format.ts";

const dia = 86_400_000;

// (a) "Este mes" el día 12: el rango va del 1° a hoy, y el comparativo tiene que ser
//     los MISMOS DÍAS del mes pasado — 1–12 jun, NO la cola de junio (19-30). Comparar
//     contra el cierre del mes anterior (quincena fuerte) sesgaba a "vas peor".
const doce = new Date("2026-07-12T15:00:00Z"); // 10:00 en Bogotá
const mes = rangoPeriodo("mes", doce);
assert.equal(bogotaYmd(mes.desde), "2026-07-01", "el mes arranca el 1° en Bogotá");
assert.equal(mes.hasta.getTime(), doce.getTime(), "el mes corre hasta ahora, no hasta fin de mes");
const largoMes = mes.hasta.getTime() - mes.desde.getTime();
// El comparativo arranca el 1° del MES ANTERIOR (misma fase del ciclo de pago)...
assert.equal(bogotaYmd(mes.prevDesde), "2026-06-01", "el comparativo arranca el 1° del mes anterior");
// ...y mide lo mismo que el actual: 1-jun + (mismo largo) = 12-jun 10:00 Bogotá.
assert.equal(
  mes.prevHasta.getTime() - mes.prevDesde.getTime(),
  largoMes,
  "el período anterior mide lo mismo que el actual (peras con peras)",
);
assert.equal(bogotaYmd(mes.prevHasta), "2026-06-12", "el comparativo termina el mismo día (12) del mes pasado");
assert.ok(mes.prevHasta <= mes.desde, "el comparativo va antes del período");

// (b) El 1° del mes a primera hora el rango es casi cero, pero nunca negativo:
//     con un rango negativo la serie de días se generaría al revés.
const primero = new Date("2026-07-01T05:30:00Z"); // 00:30 en Bogotá
const arranque = rangoPeriodo("mes", primero);
assert.ok(arranque.hasta.getTime() >= arranque.desde.getTime(), "rango no negativo el día 1");
assert.equal(bogotaYmd(arranque.desde), "2026-07-01");

// (c) Ventanas móviles: 30d y 90d miden justo eso, y su comparativo también.
for (const [p, n] of [["30d", 30], ["90d", 90]] as const) {
  const r = rangoPeriodo(p, doce);
  assert.equal(r.hasta.getTime() - r.desde.getTime(), n * dia, `${p} cubre ${n} días`);
  assert.equal(r.desde.getTime() - r.prevDesde.getTime(), n * dia, `el comparativo de ${p} también`);
  // Ventana móvil: el comparativo termina justo donde arranca el actual.
  assert.equal(r.prevHasta.getTime(), r.desde.getTime(), `el comparativo de ${p} termina donde arranca el actual`);
}

// (d) No depende del huso del proceso: el 1° de mes se calcula en Bogotá, no en UTC.
//     A las 02:00Z del 1-ago en Bogotá todavía es 31 de JULIO, así que el mes en
//     curso es julio (si se calculara en UTC daría agosto y el panel se vaciaría).
const madrugada = new Date("2026-08-01T02:00:00Z");
assert.equal(bogotaYmd(madrugada), "2026-07-31", "en Bogotá todavía es julio");
assert.equal(bogotaYmd(rangoPeriodo("mes", madrugada).desde), "2026-07-01", "el mes en curso sigue siendo julio");

// (e) Escapado del CSV. El separador es ";" (Excel en español), así que un nombre
//     con ";" DEBE ir citado o el contador recibe las columnas corridas.
assert.equal(celdaCsv("Meyer"), "Meyer", "lo normal no se toca");
assert.equal(celdaCsv('Pérez; Juan'), '"Pérez; Juan"', "un ; obliga a citar");
assert.equal(celdaCsv('Juan "El Mono"'), '"Juan ""El Mono"""', "las comillas se duplican dentro de comillas");
const conSalto = "línea1" + String.fromCharCode(10) + "línea2";
assert.equal(celdaCsv(conSalto), `"${conSalto}"`, "un salto de línea obliga a citar");
assert.equal(celdaCsv(null), "", "null es celda vacía, no la palabra null");
assert.equal(celdaCsv(0), "0", "el cero se escribe, no se come");
// Inyección de fórmulas: una celda que arranca con = + - @ (o tab/retorno) la
// ejecuta Excel al abrir el CSV. Se prefija con apóstrofo (fuerza texto) y se cita.
assert.equal(celdaCsv("=1+2"), "\"'=1+2\"", "una fórmula = se neutraliza con apóstrofo y se cita");
assert.equal(celdaCsv("+1"), "\"'+1\"", "el + también arranca fórmula");
assert.equal(celdaCsv("-1+1"), "\"'-1+1\"", "el - también arranca fórmula");
assert.equal(celdaCsv("@SUM(A1)"), "\"'@SUM(A1)\"", "el @ también arranca fórmula");
assert.equal(celdaCsv('=HYPERLINK("http://x","hola")'), '"\'=HYPERLINK(""http://x"",""hola"")"', "fórmula con comillas: se neutraliza y se duplican las comillas");
assert.equal(celdaCsv("Meyer=1"), "Meyer=1", "el = en medio NO es fórmula, no se toca");
// Una fila armada como en el route: 3 separadores = 4 columnas, pase lo que pase.
const fila = ["Corte; barba", 'Juan "JJ"', null, 35000].map(celdaCsv).join(";");
assert.equal(fila.split(";").length - (fila.match(/"[^"]*;[^"]*"/g)?.length ?? 0), 4, "no se corren las columnas");

console.log(`check-metricas OK — rangos, comparativos y escapado del CSV correctos (TZ: ${process.env.TZ ?? "(sistema)"})`);

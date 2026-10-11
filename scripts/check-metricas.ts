// Chequeo ejecutable de los rangos de período de /admin/metricas.
//
//   TZ=UTC node scripts/check-metricas.ts
//
// El bug que este check existe para atrapar: comparar un mes A MEDIAS contra el
// mes anterior COMPLETO. Eso haría que el panel diga "vas peor" todos los meses
// hasta el día 30, y el dueño tomaría decisiones con un número que miente.
import assert from "node:assert/strict";
import { rangoPeriodo, rangoFechas, semanaDeFecha, bogotaYmd } from "../src/lib/slots.ts";
import { celdaCsv } from "../src/lib/format.ts";
import { diasDelRango, porDia, agrupar, acumular, variacion, ejeRedondo, hayParaComparar, plataCorta, ritmoDelMes, escalera, type Cobro } from "../src/lib/metricas.ts";

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

// (a2) El día 31 tras un mes de 30 (y el 29-31 de marzo): lo transcurrido no cabe
//      en el mes anterior. El comparativo se topa en el 1° del mes actual; si se
//      pasara, los cobros del día 1 contarían en "este mes" Y en "el anterior".
for (const ahora of ["2026-10-31T20:00:00Z", "2026-03-30T20:00:00Z", "2026-03-31T04:59:00Z"]) {
  const r = rangoPeriodo("mes", new Date(ahora));
  assert.ok(r.prevHasta.getTime() <= r.desde.getTime(), `${ahora}: el comparativo no se mete en el mes actual`);
  assert.ok(r.prevHasta.getTime() > r.prevDesde.getTime(), `${ahora}: el comparativo no queda vacío`);
}
assert.equal(
  rangoPeriodo("mes", new Date("2026-10-31T20:00:00Z")).prevHasta.getTime(),
  rangoPeriodo("mes", new Date("2026-10-31T20:00:00Z")).desde.getTime(),
  "el 31 de octubre el comparativo es septiembre entero, ni un minuto más",
);

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

// Períodos nuevos (semana y año): ventana móvil y comparativo del MISMO largo,
// pegado justo antes. Un año que compare contra "los 30 días previos" mentiría.
for (const [periodo, dias] of [["7d", 7], ["365d", 365]] as const) {
  const r = rangoPeriodo(periodo, new Date("2026-08-15T17:00:00Z"));
  const largo = (r.hasta.getTime() - r.desde.getTime()) / 86_400_000;
  assert.ok(Math.abs(largo - dias) < 0.01, `${periodo} abarca ${dias} días`);
  assert.equal(r.prevHasta.getTime(), r.desde.getTime(), `${periodo}: el previo termina donde arranca el actual`);
  assert.ok(
    Math.abs((r.desde.getTime() - r.prevDesde.getTime()) / 86_400_000 - dias) < 0.01,
    `${periodo}: el previo mide lo mismo`,
  );
}



// (f) Export a la medida (de X a Y). Lo que tiene que atrapar: un rango que
//     recorta el ÚLTIMO día. El dueño pide "1 al 31" y espera el 31 adentro; si
//     `hasta` fuera exclusivo, el corte de mes perdería el día más cargado y
//     nadie lo notaría hasta cuadrar con el contador.
const rango = rangoFechas("2026-08-01", "2026-08-31");
assert.ok(rango, "un rango normal es válido");
assert.equal(bogotaYmd(rango.desde), "2026-08-01", "arranca el 1° a las 00:00 de Bogotá");
assert.equal(rango.hasta.getTime() - rango.desde.getTime(), 31 * dia, "cubre los 31 días COMPLETOS (hasta inclusive)");

// Un solo día vale y cubre sus 24 horas.
const unDia = rangoFechas("2026-08-10", "2026-08-10");
assert.ok(unDia, "desde = hasta es un rango de un día");
assert.equal(unDia.hasta.getTime() - unDia.desde.getTime(), dia, "el día completo, no cero");

// Basura y fechas al revés: null. El route handler corta con 400 — bajar otro
// período por defecto es entregar un archivo que dice fechas que no son.
assert.equal(rangoFechas("2026-08-31", "2026-08-01"), null, "al revés no vale");
assert.equal(rangoFechas("2026-02-31", "2026-03-01"), null, "el 31 de febrero no existe");
assert.equal(rangoFechas("31/08/2026", "2026-08-31"), null, "otro formato no vale");
assert.equal(rangoFechas("", ""), null, "vacío no vale");

// (g) La semana de liquidación va de LUNES a domingo. Si arrancara el domingo
//     (como getDay()), el pago del sábado caería en la semana siguiente y el
//     barbero cobraría el fin de semana siete días tarde.
const lunes = semanaDeFecha("2026-08-20"); // jueves
assert.equal(lunes.desdeYmd, "2026-08-17", "el jueves pertenece a la semana que arranca el lunes 17");
assert.equal(lunes.hastaYmd, "2026-08-23", "y termina el domingo 23");
// El domingo CIERRA su semana, no abre la siguiente.
const dom = semanaDeFecha("2026-08-23");
assert.equal(dom.desdeYmd, "2026-08-17", "el domingo 23 sigue siendo de la semana del 17");
assert.equal(dom.hastaYmd, "2026-08-23");
// Y el lunes es el primer día de la suya.
assert.equal(semanaDeFecha("2026-08-17").desdeYmd, "2026-08-17", "el lunes abre su propia semana");

// (h) Las cuentas de la gráfica (src/lib/metricas.ts).
//     Lo que tienen que atrapar: un cobro de la noche que cae en el día siguiente
//     (el servidor corre en UTC), "semanas" que no son de lunes a domingo, y un
//     tramo a medias que se ve bajito como si el negocio hubiera vendido menos.
const a = (iso: string, total: number): Cobro => ({ ms: Date.parse(iso), total });

// Días civiles de Bogotá, los dos extremos adentro. 02:00Z del 1-ago es todavía 31-jul en Bogotá.
assert.deepEqual(
  diasDelRango(new Date("2026-07-30T05:00:00Z"), new Date("2026-08-01T02:00:00Z")),
  ["2026-07-30", "2026-07-31"],
  "el rango se cuenta en días de Bogotá, no de UTC",
);
assert.deepEqual(diasDelRango(new Date("2026-08-02T10:00:00Z"), new Date("2026-08-01T10:00:00Z")), [], "un rango al revés no inventa días");

// Un cobro a las 9 pm de Bogotá (02:00Z del día siguiente) es del día en que se cobró.
const dias3 = ["2026-09-21", "2026-09-22", "2026-09-23"];
const baldes3 = porDia(
  [a("2026-09-22T02:00:00Z", 30_000), a("2026-09-21T15:00:00Z", 20_000), a("2026-09-23T17:00:00Z", 5_000), a("2026-09-25T17:00:00Z", 99_000)],
  dias3,
  "2026-09-23",
);
assert.deepEqual(baldes3.map((b) => b.total), [50_000, 0, 5_000], "el cobro de las 9 pm cuenta en su día de Bogotá, y lo de fuera del rango no cuenta");
assert.deepEqual(baldes3.map((b) => b.cobros), [2, 0, 1], "se cuentan los cobros, y el día sin cobros es un cero real");
assert.deepEqual(baldes3.map((b) => b.parcial), [false, false, true], "solo el día de hoy queda marcado como abierto");
assert.deepEqual(baldes3.map((b) => b.diasConCobros), [1, 0, 1], "un día con dos cobros es UN día con cobros");
// El día civil del módulo es el mismo de bogotaYmd (Intl), para cualquier hora.
for (const iso of ["2026-01-01T04:59:59Z", "2026-01-01T05:00:00Z", "2026-06-15T23:30:00Z", "2026-12-31T23:59:59Z"]) {
  assert.equal(porDia([a(iso, 1)], [bogotaYmd(new Date(iso))])[0].total, 1, `${iso} cae en el día que dice bogotaYmd`);
}

// Semanas de lunes a domingo. Del jueves 6 al miércoles 19 de agosto de 2026:
// jue-dom (4 días, a medias) · lun 10–dom 16 (completa) · lun 17–mié 19 (a medias).
const quincena = porDia([a("2026-08-06T15:00:00Z", 10), a("2026-08-10T15:00:00Z", 20), a("2026-08-16T15:00:00Z", 5), a("2026-08-19T15:00:00Z", 7)],
  diasDelRango(new Date("2026-08-06T12:00:00Z"), new Date("2026-08-19T12:00:00Z")));
const semanas = agrupar(quincena, "semana");
assert.deepEqual(semanas.map((s) => [s.desdeYmd, s.hastaYmd, s.total, s.cobros, s.parcial]), [
  ["2026-08-06", "2026-08-09", 10, 1, true],
  ["2026-08-10", "2026-08-16", 25, 2, false],
  ["2026-08-17", "2026-08-19", 7, 1, true],
], "las semanas van de lunes a domingo y las de los bordes quedan marcadas a medias");
// Una semana con sus 7 días pero con HOY adentro sigue abierta.
const conHoy = agrupar(porDia([], diasDelRango(new Date("2026-08-10T12:00:00Z"), new Date("2026-08-16T12:00:00Z")), "2026-08-16"), "semana");
assert.equal(conHoy.length, 1);
assert.equal(conHoy[0].parcial, true, "la semana que incluye el día de hoy todavía no cierra");

// Meses: del 15-ago al 10-oct → agosto a medias, septiembre completo, octubre a medias.
const meses = agrupar(porDia([a("2026-09-05T15:00:00Z", 100)], diasDelRango(new Date("2026-08-15T12:00:00Z"), new Date("2026-10-10T12:00:00Z"))), "mes");
assert.deepEqual(meses.map((m) => [m.desdeYmd, m.hastaYmd, m.total, m.parcial]), [
  ["2026-08-15", "2026-08-31", 0, true],
  ["2026-09-01", "2026-09-30", 100, false],
  ["2026-10-01", "2026-10-10", 0, true],
], "los meses son de calendario y solo el completo no va marcado");
// Agrupar no pierde ni inventa plata.
assert.equal(semanas.reduce((s, b) => s + b.total, 0), quincena.reduce((s, b) => s + b.total, 0), "la suma por semana es la suma por día");
assert.equal(agrupar(quincena, "dia"), quincena, "por día no se toca nada");
assert.deepEqual(semanas.map((s) => s.diasConCobros), [1, 2, 1], "la semana cuenta en cuántos días hubo cobros, no cuántos cobros");

assert.deepEqual(acumular([3, 0, 2]), [3, 3, 5], "suma corrida");
assert.deepEqual(acumular([]), [], "sin días no hay acumulado");

assert.equal(variacion(150, 100), 50, "50 % más");
assert.equal(variacion(50, 100), -50, "50 % menos");
assert.equal(variacion(100, 100), 0, "igual");
assert.equal(variacion(50_000, 0), null, "sin base no hay porcentaje: antes no se registraba");

// El eje: marcas redondas, parejas, que arrancan en 0 y cubren el máximo sin pasarse de largo.
for (const max of [1, 7, 55_000, 348_000, 659_000, 800_000, 1_007_000, 1_200_000, 15_854_500, 480_000_000]) {
  const m = ejeRedondo(max);
  assert.equal(m[0], 0, `${max}: el eje arranca en 0`);
  assert.ok(m.at(-1)! >= max, `${max}: el tope (${m.at(-1)}) cubre el máximo`);
  assert.ok(m.at(-1)! < max * 2 || max < 10, `${max}: el tope (${m.at(-1)}) no desperdicia medio eje`);
  assert.ok(m.length >= 2 && m.length <= 5, `${max}: entre 2 y 5 marcas (${m.join(", ")})`);
  const pasos = new Set(m.slice(1).map((v, i) => v - m[i]));
  assert.equal(pasos.size, 1, `${max}: los pasos son parejos (${m.join(", ")})`);
  assert.equal(new Set(m).size, m.length, `${max}: sin marcas repetidas`);
}
assert.deepEqual(ejeRedondo(1_007_000), [0, 400_000, 800_000, 1_200_000], "un pico de $ 1.007.000 se lee contra 400 mil / 800 mil / 1,2 M");
assert.deepEqual(ejeRedondo(0), [0], "sin plata no hay eje que inventar");

// ¿Se puede decir "vas mejor / peor"? Lo que tiene que atrapar: un porcentaje
// sacado de un puñado de días (el caso real de hoy: cobros en 4 días de 30).
assert.equal(hayParaComparar(4, 4, 30), false, "4 días con cobros de 30 no alcanzan");
assert.equal(hayParaComparar(20, 6, 30), false, "si el período ANTERIOR está flaco tampoco se compara");
assert.equal(hayParaComparar(7, 7, 30), true, "con 7 días de cada lado ya hay comparación");
assert.equal(hayParaComparar(2, 2, 3), true, "el día 3 del mes: 2 de 3 días con cobros sí compara");
assert.equal(hayParaComparar(1, 3, 3), false, "pero con 1 de 3 no");
assert.equal(hayParaComparar(0, 0, 0), false, "sin días no hay nada que comparar");

// Las marcas del eje, en corto y en español de acá.
assert.equal(plataCorta(1_200_000), "1,2 M");
assert.equal(plataCorta(2_000_000), "2 M", "sin ,0 de adorno");
assert.equal(plataCorta(15_854_500), "15,9 M");
assert.equal(plataCorta(400_000), "400 mil");
assert.equal(plataCorta(2_500), "2,5 mil");
assert.equal(plataCorta(900), "900");
assert.equal(plataCorta(0), "0");

// El ritmo del mes: este mes hasta HOY contra el mes pasado ENTERO. Lo que tiene
// que atrapar: que el mes pasado salga cortado al día de hoy (no se vería cómo
// cerró), que se cuelen días que no han llegado, y el cambio de año.
{
  const diasRitmo = porDia(
    [a("2026-09-05T15:00:00Z", 100), a("2026-09-30T15:00:00Z", 50), a("2026-10-02T15:00:00Z", 30), a("2026-10-03T15:00:00Z", 5)],
    diasDelRango(new Date("2026-08-01T12:00:00Z"), new Date("2026-10-03T12:00:00Z")),
    "2026-10-03",
  );
  const r = ritmoDelMes(diasRitmo, "2026-10-03");
  assert.equal(r.mes, "2026-10");
  assert.equal(r.mesAntes, "2026-09");
  assert.deepEqual(r.actual, [0, 30, 35], "octubre va hasta hoy (día 3), acumulado");
  assert.equal(r.antes.length, 30, "septiembre va completo, sus 30 días");
  assert.equal(r.antes[3], 0, "el 4 de septiembre todavía no había entrado nada");
  assert.equal(r.antes[4], 100, "el 5 entra la primera plata");
  assert.equal(r.antes.at(-1), 150, "septiembre cerró en 150");
  assert.equal(r.actual.at(-1), 35, "lo acumulado de este mes es lo que entró este mes");
  assert.equal(ritmoDelMes([], "2027-01-15").mesAntes, "2026-12", "en enero, el mes pasado es diciembre del año anterior");
}

// La escalera: solo H y V (nunca una diagonal), y nunca un NaN en el trazo.
assert.equal(escalera([0, 50, 50, 100], 100), "M0,100H0.5H1V50H1.5H2V50H2.5H3V0H3.5", "sube el día que entra plata y queda plana el que no");
assert.equal(escalera([0, 50], 100, true), "M0,100H0.5H1V50H1.5H2", "un mes cerrado llega hasta el borde de su último día");
assert.equal(escalera([0, 0, 0], 0), "M0,100H0.5H1V100H1.5H2V100H2.5", "todo en cero (y tope 0) es una raya en la base, sin NaN");
assert.equal(escalera([], 100), "", "sin días no hay trazo");
assert.ok(!/[LCQ]|NaN/.test(escalera([10, 30, 30, 90], 120, true)), "nada de diagonales ni NaN");
assert.equal(escalera([0, 50], 100, true, 80), "M0,100H0.5H1V50H1.5H2V20", "si cerró en otro valor que el último dibujado, el trazo termina ahí");
assert.equal(escalera([0, 50], 100, true, 50), "M0,100H0.5H1V50H1.5H2", "si cerró en lo mismo no agrega nada");

// Al FINAL: antes este aviso salía a mitad del archivo y decía "OK" con la mitad de los asertos sin correr.
console.log(`check-metricas OK — rangos, comparativos, CSV, export a la medida, semanas y cuentas de la gráfica (TZ: ${process.env.TZ ?? "(sistema)"})`);

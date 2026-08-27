// Self-check de slots: finEfectivo (disponibilidad guiada por la silla real),
// buildSlots/computeTaken (grilla y ocupación anclada a Bogotá) y faltaParaLlegar.
//   node scripts/check-slots.ts
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  finEfectivo,
  EN_CURSO_GRACIA_MIN,
  faltaParaLlegar,
  MARGEN_LLEGADA_HORAS,
  buildSlots,
  slotsDisponibles,
  GRANO_MIN,
  computeTaken,
  chocaConOcupados,
  horarioEfectivo,
  slotEnVentana,
  resumirSemana,
  dowDeFecha,
  instanteBogota,
  OPEN,
  CLOSE,
  STEP,
} from "../src/lib/slots.ts";

// ---- instanteBogota: la hora se arma en Bogotá (UTC-5), no en la TZ del proceso ----
// El wizard/reagendar usaban setHours (TZ del dispositivo) → fuera de Colombia el
// instante se corría. Esta función es TZ-safe; el hijo la re-corre bajo NY/Tokyo/UTC.
function checkInstanteBogota() {
  assert.equal(instanteBogota("2026-08-15", 780).toISOString(), "2026-08-15T18:00:00.000Z", "13:00 Bogotá = 18:00Z");
  assert.equal(instanteBogota("2026-08-15", 540).toISOString(), "2026-08-15T14:00:00.000Z", "09:00 Bogotá = 14:00Z");
  assert.equal(instanteBogota("2026-08-16", 0).toISOString(), "2026-08-16T05:00:00.000Z", "medianoche Bogotá = 05:00Z");
}

// ---- horarioEfectivo / slotEnVentana / resumirSemana (horarios editables) ----
// Fuente de verdad única cliente+servidor: la cascada excepción → semana → respaldo,
// la validación de slots contra la ventana, y el resumen del bloque público.
function checkHorarioEfectivo() {
  const fecha = "2026-08-15"; // sábado (dow 6)
  const dow = dowDeFecha(fecha);
  const semanal = [{ dow, abierta: true, abreMin: 540, cierraMin: 1200 }];

  // Sin excepción → base semanal.
  assert.deepEqual(
    horarioEfectivo(fecha, semanal, []),
    { abierta: true, abreMin: 540, cierraMin: 1200 },
    "usa la base semanal cuando no hay excepción",
  );
  // Excepción cerrada gana sobre la base.
  assert.equal(
    horarioEfectivo(fecha, semanal, [{ fecha, abierta: false, abreMin: null, cierraMin: null }]).abierta,
    false,
    "excepción cerrada cierra el día",
  );
  // Excepción abierta con horas propias (caso sábado 1:00–4:30).
  assert.deepEqual(
    horarioEfectivo(fecha, semanal, [{ fecha, abierta: true, abreMin: 780, cierraMin: 990 }]),
    { abierta: true, abreMin: 780, cierraMin: 990 },
    "excepción con horas propias manda su franja",
  );
  // Excepción abierta SIN horas → cae en las de la base.
  assert.deepEqual(
    horarioEfectivo(fecha, semanal, [{ fecha, abierta: true, abreMin: null, cierraMin: null }]),
    { abierta: true, abreMin: 540, cierraMin: 1200 },
    "excepción abierta sin horas usa las de la base",
  );
  // Respaldo sin base ni excepción: domingo cerrado, hábil 9-20.
  assert.equal(horarioEfectivo("2026-08-16", [], []).abierta, false, "respaldo: domingo cerrado");
  assert.deepEqual(
    horarioEfectivo("2026-08-17", [], []),
    { abierta: true, abreMin: OPEN, cierraMin: CLOSE },
    "respaldo: día hábil 9-20",
  );

  // slotEnVentana: alineado a la APERTURA de la ventana (no a OPEN), cabe completo.
  const vent = { abierta: true, abreMin: 780, cierraMin: 990 }; // 13:00–16:30
  assert.ok(slotEnVentana(780, 30, vent), "13:00 entra");
  assert.ok(slotEnVentana(960, 30, vent), "16:00 entra (termina justo al cierre)");
  assert.ok(!slotEnVentana(990, 30, vent), "16:30 no: no cabe antes del cierre");
  // Antes exigía caer en la grilla; ahora el servidor solo pide grano de 5, porque
  // los turnos ofrecidos dependen de las citas del día y el mostrador agenda a la
  // hora que llegó el cliente.
  assert.ok(slotEnVentana(795, 30, vent), "13:15 entra (grano de 5)");
  assert.ok(slotEnVentana(820, 30, vent), "13:40 entra: es la hora a la que llegó el cliente");
  assert.ok(!slotEnVentana(823, 30, vent), "13:43 no: nadie agenda a los 43 minutos");
  assert.ok(!slotEnVentana(540, 30, vent), "9:00 fuera de la ventana");
  assert.ok(!slotEnVentana(780, 30, { abierta: false, abreMin: 780, cierraMin: 990 }), "día cerrado: nada");

  // buildSlots con ventana custom arranca en abreMin y respeta el cierre.
  const s = buildSlots(30, 780, 990);
  assert.equal(s[0], 780, "buildSlots(30,13:00,16:30) arranca 13:00");
  assert.equal(s[s.length - 1], 960, "último inicio 16:00");
  assert.ok(!s.includes(990), "no ofrece inicio en el cierre");

  // resumirSemana agrupa días consecutivos con la misma franja (caso del seed).
  const seed = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dow: d, abierta: d !== 0, abreMin: 540, cierraMin: 1200 }));
  const esperado = [
    { dias: "Lun a Sáb", horas: "9:00 am a 8:00 pm" },
    { dias: "Dom", horas: "Cerrado" },
  ];
  assert.deepEqual(resumirSemana(seed), esperado, "resumen agrupa lun-sáb y separa el domingo");
  // Sin filas (migración 0048 aún sin aplicar): mismo resultado por el respaldo.
  // Es el estado EXACTO que ve el footer hoy, antes de aplicar la migración.
  assert.deepEqual(resumirSemana([]), esperado, "respaldo: sin base semanal, lun-sáb 9-20 y domingo cerrado");
}

// ---- buildSlots: grilla de inicios válidos, respeta el cierre (AUD-D-007) ----
function checkBuildSlots() {
  const s30 = buildSlots(30);
  assert.equal(s30[0], OPEN, "buildSlots(30) arranca en OPEN (9:00)");
  assert.equal(s30[s30.length - 1], CLOSE - 30, "buildSlots(30) termina 19:30");
  assert.ok(!s30.includes(CLOSE), "buildSlots nunca ofrece un inicio en/después de CLOSE");
  // Paso constante = STEP.
  for (let i = 1; i < s30.length; i++) assert.equal(s30[i] - s30[i - 1], STEP);
  // Duraciones más largas respetan el cierre (el último inicio + dur <= CLOSE).
  for (const dur of [45, 60, 90]) {
    const s = buildSlots(dur);
    assert.ok(s[s.length - 1] + dur <= CLOSE, `buildSlots(${dur}) respeta CLOSE`);
    assert.ok(s[0] === OPEN);
  }
}

// ---- computeTaken: ocupación anclada a Bogotá (AUD-D-001 + AUD-D-007) ----
// Estos casos usan instantes ABSOLUTOS (…Z) y esperan minutos-de-Bogotá (UTC-5).
// Si computeTaken volviera a usar la hora del dispositivo (getHours), fallan bajo
// cualquier TZ != Bogotá — por eso además se re-corren en un hijo con otra TZ.
function checkComputeTakenBogota() {
  const slots = buildSlots(30);
  // `day` deliberadamente NO es hoy, para que la rama "slots pasados de hoy" no
  // entre y los casos queden deterministas (solo prueba el solape).
  const day = new Date(2020, 0, 15); // 15-ene-2020, local

  // 14:30Z–15:00Z = 09:30–10:00 en Bogotá → 570..600. Borde exacto: el slot 9:00
  // (termina 9:30 == inicio ocupado) NO se tacha; solo se tacha 9:30.
  const t1 = computeTaken({
    slots,
    ocupados: [{ inicio: "2026-07-11T14:30:00Z", fin: "2026-07-11T15:00:00Z" }],
    day,
    duracionMin: 30,
  });
  assert.ok(!t1.has(9 * 60), "9:00 libre: fin del slot == inicio ocupado, no solapa");
  assert.ok(t1.has(9 * 60 + 30), "9:30 ocupado");
  assert.ok(!t1.has(10 * 60), "10:00 libre: inicio del slot == fin ocupado");

  // Solape PARCIAL: 14:15Z–14:45Z = 09:15–09:45 Bogotá → tacha 9:00 y 9:30.
  const t2 = computeTaken({
    slots,
    ocupados: [{ inicio: "2026-07-11T14:15:00Z", fin: "2026-07-11T14:45:00Z" }],
    day,
    duracionMin: 30,
  });
  assert.ok(t2.has(9 * 60), "9:00 ocupado por solape parcial");
  assert.ok(t2.has(9 * 60 + 30), "9:30 ocupado por solape parcial");
  assert.ok(!t2.has(10 * 60), "10:00 libre");

  // Sin ocupados y día que no es hoy: nada tachado.
  const t3 = computeTaken({ slots, ocupados: [], day, duracionMin: 30 });
  assert.equal(t3.size, 0, "sin ocupados y no-hoy: grilla libre");
}


// Hijo re-lanzado con TZ forzada: corre SOLO la matemática sensible a huso y sale.
// Si computeTaken usara la TZ del dispositivo, acá (TZ != Bogotá) reventaría.
if (process.env.SLOTS_TZ_CHILD) {
  checkBuildSlots();
  checkComputeTakenBogota();
  checkHorarioEfectivo();
  checkInstanteBogota();
  checkEncadenado();
  checkChocaConOcupados();
  process.exit(0);
}

const MIN = 60000;
// Fin estimado de una cita: 10:00:00Z. (Instantes absolutos; la TZ no importa.)
const fin = Date.parse("2026-07-11T10:00:00.000Z");
const finISO = new Date(fin).toISOString();
const gracia = EN_CURSO_GRACIA_MIN * MIN;

// 1) No en curso (pendiente/confirmada): nunca se extiende, aunque ya haya pasado.
assert.equal(finEfectivo("confirmada", finISO, fin + 30 * MIN), finISO);
assert.equal(finEfectivo("pendiente", finISO, fin + 999 * MIN), finISO);
assert.equal(finEfectivo("completada", finISO, fin + 30 * MIN), finISO);

// 2) En curso, todavía dentro del estimado (ahora <= fin): sin cambios.
assert.equal(finEfectivo("en_curso", finISO, fin - 5 * MIN), finISO);
assert.equal(finEfectivo("en_curso", finISO, fin), finISO);

// 3) En curso, pasado el estimado pero dentro de la gracia: rueda hasta AHORA.
const ahora1 = fin + 20 * MIN;
assert.equal(finEfectivo("en_curso", finISO, ahora1), new Date(ahora1).toISOString());

// 4) En curso, más allá de estimado + gracia: tope en fin + gracia (red de olvido).
const ahora2 = fin + (EN_CURSO_GRACIA_MIN + 40) * MIN;
assert.equal(finEfectivo("en_curso", finISO, ahora2), new Date(fin + gracia).toISOString());

// 5) Borde exacto: ahora == fin + gracia → tope.
assert.equal(finEfectivo("en_curso", finISO, fin + gracia), new Date(fin + gracia).toISOString());

// ---- Guard de "Llegó": no pasar a la silla una cita que arranca muy después ----
// El caso real que lo motivó: a la 1:45am se marcó "Llegó" en la cita de las 9:30am
// y quedó cobrada como venta de esa madrugada.
const cita = Date.parse("2026-07-20T14:30:00.000Z"); // 9:30 am Bogotá
const citaISO = new Date(cita).toISOString();
const margen = MARGEN_LLEGADA_HORAS * 3600_000;

// 1) Muy temprano (8h antes): bloquea y dice cuánto falta.
assert.equal(faltaParaLlegar(citaISO, cita - 8 * 3600_000), "faltan 8h");

// 2) Justo en el borde del margen: ya se puede marcar (<=, no <).
assert.equal(faltaParaLlegar(citaISO, cita - margen), null);

// 3) Un minuto antes del borde: todavía bloqueado.
assert.equal(faltaParaLlegar(citaISO, cita - margen - 60000), "faltan 2h");

// 4) El que llega temprano (30 min antes) SÍ pasa: es el caso legítimo que no
//    se puede romper por cazar el clic equivocado.
assert.equal(faltaParaLlegar(citaISO, cita - 30 * 60000), null);

// 5) A la hora y tarde: siempre habilitado (el cliente llegó tarde, se atiende).
assert.equal(faltaParaLlegar(citaISO, cita), null);
assert.equal(faltaParaLlegar(citaISO, cita + 45 * 60000), null);

// 6) Entre 2h y 2h59 se muestra en minutos redondeados a horas; más de 2h → "Xh".
assert.equal(faltaParaLlegar(citaISO, cita - 3 * 3600_000), "faltan 3h");

// Grilla + ocupación anclada a Bogotá, en la TZ actual del proceso.
checkBuildSlots();
checkComputeTakenBogota();
checkHorarioEfectivo();
checkInstanteBogota();

// Y lo mismo re-corrido en un proceso hijo con una TZ bien distinta a Bogotá:
// caza cualquier regresión a la hora del dispositivo aunque la máquina de dev
// esté configurada en Colombia.
for (const tz of ["America/New_York", "Asia/Tokyo", "UTC"]) {
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    env: { ...process.env, TZ: tz, SLOTS_TZ_CHILD: "1" },
    encoding: "utf8",
  });
  assert.equal(r.status, 0, `computeTaken debe dar lo mismo bajo TZ=${tz}\n${r.stderr ?? ""}`);
}

checkEncadenado();
checkChocaConOcupados();

console.log("check-slots OK");

// ---- chocaConOcupados: "ocupado" bloquea; "ya pasó" ya no ----
// Registrar el corte de ayer es un caso soportado (mostrador). El form separa
// las dos razones: esta función solo ve el SOLAPE, nunca el reloj.
function checkChocaConOcupados() {
  const o = (iniMin: number, finMin: number) => ({
    inicio: instanteBogota("2026-08-20", iniMin).toISOString(),
    fin: instanteBogota("2026-08-20", finMin).toISOString(),
  });
  const citas = [o(860, 880)]; // 2:20pm–2:40pm
  assert.ok(chocaConOcupados(870, 30, citas), "2:30 pisa la barba de 2:20–2:40");
  assert.ok(chocaConOcupados(850, 20, citas), "2:10+20 termina 2:30: pisa");
  assert.ok(!chocaConOcupados(880, 30, citas), "2:40 arranca justo al terminar: NO pisa (encadenado)");
  assert.ok(!chocaConOcupados(830, 30, citas), "1:50+30 termina justo 2:20: pegado por delante NO pisa");
  assert.ok(!chocaConOcupados(600, 30, []), "sin citas nada choca, aunque la hora sea vieja");
}

// ---- slotsDisponibles: la silla se encadena, no se regala ----
// El bug de negocio que atrapa: con grilla sola, una barba de 20 min que termina
// 2:40 empuja al siguiente cliente a las 2:45 (o peor, con la grilla vieja de 30,
// a las 3:00) y esos minutos no los usa nadie. El dueño lo midió en silla perdida.
function checkEncadenado() {
  const abre = 540; // 9:00
  const cierra = 1200; // 20:00
  const ocupado = (iniMin: number, finMin: number) => ({
    inicio: instanteBogota("2026-08-20", iniMin).toISOString(),
    fin: instanteBogota("2026-08-20", finMin).toISOString(),
  });

  // Barba de 20 que va de 14:20 a 14:40 → el turno 14:40 tiene que existir.
  const conBarba = slotsDisponibles(20, abre, cierra, [ocupado(860, 880)]);
  assert.ok(conBarba.includes(880), "se ofrece el turno justo cuando se desocupa la silla (14:40)");
  assert.ok(conBarba.includes(870), "la grilla sigue estando (14:30)");

  // Una cita que termina en una hora rara se redondea HACIA ARRIBA al grano de 5:
  // ofrecer 14:43 sería ofrecer algo que slotEnVentana rechaza, y redondear hacia
  // abajo metería la cita nueva dentro de la anterior.
  const raro = slotsDisponibles(20, abre, cierra, [ocupado(860, 883)]);
  assert.ok(raro.includes(885), "14:43 se ofrece como 14:45");
  assert.ok(!raro.includes(883), "nunca se ofrece una hora que el servidor rebotaría");
  for (const t of raro) assert.equal((t - abre) % GRANO_MIN, 0, `${t} respeta el grano de 5`);

  // Nada que no quepa antes del cierre, ni siquiera encadenado.
  const alCierre = slotsDisponibles(30, abre, cierra, [ocupado(1140, 1190)]);
  assert.ok(!alCierre.includes(1190), "19:50 + 30 min se pasa del cierre: no se ofrece");
  assert.ok(alCierre.every((t) => t + 30 <= cierra), "ningún turno se pasa del cierre");

  // Sin citas, es exactamente la grilla (no inventa turnos de la nada).
  assert.deepEqual(
    slotsDisponibles(30, abre, cierra, []),
    buildSlots(30, abre, cierra),
    "sin ocupación, la grilla de siempre",
  );

  // Y el encadenado no se cuela dos veces si cae justo en la grilla.
  const enGrilla = slotsDisponibles(30, abre, cierra, [ocupado(840, 870)]);
  assert.equal(enGrilla.filter((t) => t === 870).length, 1, "sin turnos repetidos");
  assert.deepEqual([...enGrilla].sort((a, b) => a - b), enGrilla, "vienen ordenados");
}

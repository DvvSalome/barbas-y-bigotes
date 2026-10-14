// Chequeo ejecutable del alta, la ficha y la baja de un barbero (src/lib/equipo-reglas.ts).
//
//   node scripts/check-equipo.ts
//
// Lo que sale caro si se rompe:
//   · el correo del LOGIN de un barbero nuevo: si coincidiera con un buzón real
//     (reservas@) o tuviera forma de enviable, algo podría terminar mandándole
//     correo y sumando rebotes — el buzón ya fue suspendido tres veces por eso;
//   · el contrato: Comisiones decía "0 %" cuando el cobro aplicaba 50;
//   · la ficha: decir "Listo" a un barbero que no puede entrar, o acusar algo que
//     no se pudo medir;
//   · la baja: dejar confirmar con citas por delante que nadie atiende.
import assert from "node:assert/strict";
import {
  esPinValido,
  candidatosCorreoInterno,
  slugLocal,
  DOMINIO_INTERNO,
  correoDeAvisos,
  validarNuevoBarbero,
  sanearContrato,
  contratoDefinido,
  comisionQueSeCobra,
  textoContrato,
  COMISION_POR_DEFECTO,
  checklistBarbero,
  resumenChecklist,
  encabezadoFicha,
  etiquetaInsignia,
  SIN_FOTO,
  motivoParaNoDarDeBaja,
  avisoAClientes,
  motivoAlPasar,
  mensajeHomonimo,
  sanearOrden,
  reordenar,
  BAN_DE_BAJA,
  type DatosChecklist,
} from "../src/lib/equipo-reglas.ts";
import { esEmailEnviable } from "../src/lib/email.ts";

// (1) PIN: 6 dígitos y nada de los que se adivinan al primer intento.
assert.equal(esPinValido("482915"), true);
for (const malo of ["123456", "000000", "111111", "654321", "12345", "1234567", "12a456", "", " 48291"]) {
  assert.equal(esPinValido(malo), false, `PIN ${JSON.stringify(malo)} no sirve`);
}

// (2) El correo del login: el patrón de los que ya existen (primer nombre), sin
//     tildes, y NUNCA un buzón que reciba correo.
assert.equal(slugLocal("Íñigo"), "inigo");
assert.equal(slugLocal("José-Luis O'Neil"), "joseluisoneil");
const kevin = candidatosCorreoInterno("Kevin Valencia");
assert.equal(kevin[0], `kevin@${DOMINIO_INTERNO}`, "primero, el primer nombre (como los 6 de hoy)");
assert.equal(kevin[1], `kevin.valencia@${DOMINIO_INTERNO}`, "si choca, nombre.apellido");
assert.equal(kevin[2], `kevin2@${DOMINIO_INTERNO}`, "y después numerado");
assert.equal(new Set(kevin).size, kevin.length, "sin repetidos");
assert.equal(candidatosCorreoInterno("Ángel Muñoz")[0], `angel@${DOMINIO_INTERNO}`);
assert.equal(candidatosCorreoInterno("  ")[0], `barbero@${DOMINIO_INTERNO}`, "nombre vacío: algo válido igual");
// Los buzones reales o probables del dominio no se usan nunca.
for (const nombre of ["Reservas", "Admin Pérez", "Hola", "Info", "Mostrador Plaza", "Soporte"]) {
  const c = candidatosCorreoInterno(nombre);
  const primero = slugLocal(nombre.split(" ")[0]);
  assert.ok(!c.includes(`${primero}@${DOMINIO_INTERNO}`), `${nombre}: no usa ${primero}@`);
  assert.ok(c.length >= 3, `${nombre}: igual hay alternativas`);
}
assert.equal(candidatosCorreoInterno("Reservas")[0], `barbero.reservas@${DOMINIO_INTERNO}`, "con prefijo, nunca reservas@");
assert.ok(!candidatosCorreoInterno("Reservas").some((c) => c.startsWith("reservas")), "ni reservas2@");
// La invariante que importa: ninguno pasa esEmailEnviable → nada en la app le manda correo.
for (const nombre of ["Kevin Valencia", "Reservas", "Bryan García", "Abel", "Jhon", "Meyer", "Junior", "Ñoño"]) {
  for (const c of candidatosCorreoInterno(nombre, 12)) {
    assert.equal(esEmailEnviable(c), false, `${c} no es enviable`);
    assert.match(c, /^[a-z0-9.]+@barbasybigotes\.com$/, `${c}: forma simple`);
  }
}

// (3) El correo de AVISOS sí tiene que ser real.
assert.deepEqual(correoDeAvisos(""), { ok: true, email: null }, "vacío = sin correo (es opcional)");
assert.deepEqual(correoDeAvisos("  Kevin@Gmail.com "), { ok: true, email: "kevin@gmail.com" });
assert.equal(correoDeAvisos("kevin@barbasybigotes.com").ok, false, "el buzón interno no existe");
assert.equal(correoDeAvisos("kevin@gmail").ok, false);
const tipeo = correoDeAvisos("kevin@gmial.com");
assert.ok(!tipeo.ok && /gmail\.com/.test(tipeo.error), "sugiere el dominio bien escrito");

// (4) Contrato: el "0 %" que en verdad era 50.
assert.equal(COMISION_POR_DEFECTO, 50);
const sinPct = { tipo: "porcentaje" as const, comisionPct: null, arriendoMensual: null };
assert.equal(contratoDefinido(sinPct), false);
assert.equal(comisionQueSeCobra(sinPct), 50, "lo que aplica completarReserva");
assert.equal(textoContrato(sinPct), "Sin definir · se cobra 50 %");
assert.equal(textoContrato({ tipo: "porcentaje", comisionPct: 45, arriendoMensual: null }), "Comisión 45 %");
assert.equal(comisionQueSeCobra({ tipo: "porcentaje", comisionPct: 0, arriendoMensual: null }), 0, "0 % escrito es 0 %, no 50");
assert.equal(contratoDefinido({ tipo: "porcentaje", comisionPct: 0, arriendoMensual: null }), true);
assert.equal(comisionQueSeCobra({ tipo: "arriendo", comisionPct: null, arriendoMensual: 500000 }), null);
assert.match(textoContrato({ tipo: "arriendo", comisionPct: null, arriendoMensual: 500000 }), /^Arriendo \$ 500\.000 al mes$/);
assert.deepEqual(sanearContrato({ tipo: "porcentaje", comisionPct: "45" }), {
  ok: true,
  fila: { tipo_contrato: "porcentaje", comision_pct: 45, arriendo_mensual: null },
});
assert.equal(sanearContrato({ tipo: "porcentaje", comisionPct: "" }).ok, false, "vacío no es 0 %");
assert.equal(sanearContrato({ tipo: "porcentaje", comisionPct: 120 }).ok, false);
assert.equal(sanearContrato({ tipo: "arriendo", arriendoMensual: 0 }).ok, false);
assert.equal(sanearContrato({ tipo: "otra" }).ok, false);

// (5) El formulario de alta, validado de una vez y con el campo que falló.
const SEDES = ["parque-venezuela", "plaza-de-la-paz"];
const bueno = { nombre: "  Kevin   Valencia ", sedeId: "plaza-de-la-paz", pin: "482915", correo: "", tipo: "porcentaje", comisionPct: "50" };
const v = validarNuevoBarbero(bueno, SEDES);
assert.ok(v.ok);
if (v.ok) {
  assert.equal(v.valor.nombre, "Kevin Valencia", "espacios normalizados");
  assert.equal(v.valor.correo, null);
  assert.equal(v.valor.contrato.comision_pct, 50);
}
const campo = (x: object) => {
  const r = validarNuevoBarbero({ ...bueno, ...x }, SEDES);
  return r.ok ? "ok" : r.campo;
};
assert.equal(campo({ nombre: "K" }), "nombre");
assert.equal(campo({ sedeId: "otra-sede" }), "sede");
assert.equal(campo({ pin: "123456" }), "pin");
assert.equal(campo({ correo: "kevin@barbasybigotes.com" }), "correo");
assert.equal(campo({ tipo: "arriendo", arriendoMensual: "" }), "contrato");
assert.equal(campo({ tipo: "arriendo", arriendoMensual: "450000" }), "ok");

// (6) El checklist de la ficha.
const completo: DatosChecklist = {
  acceso: true,
  pin: { tiene: true, bloqueado: false },
  foto: true,
  contrato: { tipo: "porcentaje", comisionPct: 50, arriendoMensual: null },
  correo: "kevin@gmail.com",
  correoProbado: true,
  agenda: { creada: true, compartidaCon: "kevin@gmail.com" },
  aparatos: 1,
  ultimoIngreso: "2026-10-13T15:00:00Z",
};
const claves = (d: DatosChecklist) => checklistBarbero(d).map((p) => p.clave);
assert.deepEqual(claves(completo), ["acceso", "pin", "foto", "contrato", "correo", "agenda", "celular", "ingreso"], "los 8 puntos, en orden");
assert.deepEqual(resumenChecklist(checklistBarbero(completo)), { faltan: 0, bloquean: 0, subtitulo: "Listo" });

// Un barbero recién creado con lo mínimo: entra, pero le falta lo de después.
const nuevo: DatosChecklist = {
  ...completo,
  foto: false,
  correo: null,
  correoProbado: null,
  agenda: { creada: false, compartidaCon: null },
  aparatos: 0,
  ultimoIngreso: null,
};
const rNuevo = resumenChecklist(checklistBarbero(nuevo));
// Avisos en el celular y primer ingreso los hace ÉL: se ven como nota, no cuentan.
assert.equal(rNuevo.faltan, 3);
assert.equal(rNuevo.bloquean, 1, "sin correo no se entera de sus citas: bloquea");
assert.equal(rNuevo.subtitulo, "Le faltan 3: sin correo · sin foto · sin agenda", "lo que bloquea, primero");
for (const clave of ["celular", "ingreso"] as const) {
  const punto = checklistBarbero(nuevo).find((p) => p.clave === clave)!;
  assert.equal(punto.estado, "nota", `${clave}: lo hace el barbero, es nota`);
  assert.match(punto.detalle, /lo hace él/);
}
// Con todo lo del dueño hecho, "Listo" aunque el barbero no haya instalado la app.
assert.equal(resumenChecklist(checklistBarbero({ ...completo, aparatos: 0, ultimoIngreso: null })).subtitulo, "Listo");
// El encabezado de la ficha va por lo que IMPIDE trabajar.
assert.deepEqual(encabezadoFicha(checklistBarbero(nuevo)), { texto: "No puede trabajar con la app: sin correo", tono: "bloquea" });
assert.deepEqual(encabezadoFicha(checklistBarbero({ ...completo, foto: false })), { texto: "Puede trabajar · 1 pendiente", tono: "pendiente" });
assert.deepEqual(encabezadoFicha(checklistBarbero(completo)), { texto: "Listo para trabajar con la app", tono: "listo" });
assert.equal(etiquetaInsignia(1), "1 cosa le impide trabajar");
assert.equal(etiquetaInsignia(2), "2 cosas le impiden trabajar");
// Sin foto NO salen las iniciales en la web: sale una foto genérica (de otra persona).
assert.doesNotMatch(SIN_FOTO, /iniciales/);
assert.match(SIN_FOTO, /foto genérica que no es él/);
assert.equal(checklistBarbero({ ...completo, foto: false }).find((p) => p.clave === "foto")!.detalle, SIN_FOTO);
const agendaNuevo = checklistBarbero(nuevo).find((p) => p.clave === "agenda")!;
assert.match(agendaNuevo.detalle, /Primero pon su correo/, "sin correo, la agenda no tiene a quién compartirse");

// Sin acceso: no se le reprocha el celular ni el primer ingreso (no puede).
const sinAcceso = checklistBarbero({ ...completo, acceso: false, aparatos: 0, ultimoIngreso: undefined });
assert.equal(sinAcceso[0].clave, "acceso");
assert.equal(sinAcceso[0].estado, "falta");
assert.equal(sinAcceso[0].bloquea, true);
assert.match(sinAcceso[0].detalle, /no le llega ningún correo/);
assert.ok(!sinAcceso.some((p) => p.clave === "celular" || p.clave === "ingreso"));
assert.equal(resumenChecklist(sinAcceso).subtitulo, "Le falta 1: sin acceso");

// Lo que no se pudo medir no aparece (null / undefined).
assert.deepEqual(
  claves({ ...completo, acceso: null, pin: null, agenda: null, aparatos: null, ultimoIngreso: undefined, contrato: null }),
  ["foto", "correo"],
  "sin datos, se calla",
);
// PIN bloqueado bloquea; correo sin probar es una nota que no cuenta.
const bloqueado = checklistBarbero({ ...completo, pin: { tiene: true, bloqueado: true }, correoProbado: false });
assert.equal(bloqueado.find((p) => p.clave === "pin")!.titulo, "PIN bloqueado");
assert.equal(bloqueado.find((p) => p.clave === "correo")!.estado, "nota");
assert.deepEqual(resumenChecklist(bloqueado), { faltan: 1, bloquean: 1, subtitulo: "Le falta 1: PIN bloqueado" });
// Contrato sin definir: falta, y dice cuánto se le está cobrando.
const sinContrato = checklistBarbero({ ...completo, contrato: sinPct }).find((p) => p.clave === "contrato")!;
assert.equal(sinContrato.estado, "falta");
assert.match(sinContrato.detalle, /50 %/);
// Fecha del último ingreso con el formateador que pasa la ficha.
assert.equal(checklistBarbero(completo, () => "lun 13 oct").find((p) => p.clave === "ingreso")!.detalle, "Última vez: lun 13 oct.");
// Tuteo en todo lo que lee el dueño.
for (const p of [...checklistBarbero(nuevo), ...sinAcceso, ...bloqueado]) {
  assert.doesNotMatch(`${p.titulo} ${p.detalle}`, /\b(podés|tenés|querés|poné|activá|tocá|escribí|decile|avisale)\b/i, `${p.clave}: tuteo`);
}

// (7) La baja: no se confirma con clientes sin barbero.
assert.equal(motivoParaNoDarDeBaja({ citasFuturas: 0, cancelarCitas: false, enSilla: false }), null);
assert.equal(motivoParaNoDarDeBaja({ citasFuturas: 3, cancelarCitas: true, enSilla: false }), null, "cancelándolas, sí");
assert.match(motivoParaNoDarDeBaja({ citasFuturas: 3, cancelarCitas: false, enSilla: false })!, /3 citas por delante/);
assert.match(motivoParaNoDarDeBaja({ citasFuturas: 1, cancelarCitas: false, enSilla: false })!, /1 cita por delante/);
assert.match(motivoParaNoDarDeBaja({ citasFuturas: 0, cancelarCitas: true, enSilla: true })!, /atendiendo/, "en la silla, nunca");
// Una cita que ya pasó y nadie cobró: después de la baja nadie la podría cobrar.
assert.match(motivoParaNoDarDeBaja({ citasFuturas: 0, cancelarCitas: false, enSilla: false, sinCobrar: 1 })!, /1 cita que ya pasó y no se ha cobrado/);
assert.match(motivoParaNoDarDeBaja({ citasFuturas: 0, cancelarCitas: true, enSilla: false, sinCobrar: 2 })!, /Cóbralas o márcalas «No vino»/, "cancelar no las resuelve");
assert.equal(motivoParaNoDarDeBaja({ citasFuturas: 0, cancelarCitas: false, enSilla: false, sinCobrar: 0 }), null);

// (7b) Qué se le dice al dueño de los clientes: solo al que dejó correo le llega.
assert.equal(avisoAClientes(0, 0), "");
assert.equal(avisoAClientes(2, 0), "A los clientes les llega el correo de que su cita se canceló.");
assert.equal(avisoAClientes(1, 0), "Al cliente le llega el correo de que su cita se canceló.");
assert.equal(avisoAClientes(1, 2), "A 1 le llega el correo de que su cita se canceló; 2 no dejaron correo: llámalos.");
assert.equal(avisoAClientes(3, 1), "A 3 les llega el correo de que su cita se canceló; 1 no dejó correo: llámalo.");
assert.match(avisoAClientes(0, 3), /Ninguno dejó correo/);
assert.match(avisoAClientes(0, 1), /llámalo\.$/);
for (const [c, sc] of [[1, 2], [0, 3], [2, 0]]) assert.doesNotMatch(avisoAClientes(c, sc), /a cada cliente/i, "nunca el absoluto falso");

// (7c) Pasar una cita: el motivo dicho para quien pasa citas (no se elige hora).
assert.equal(motivoAlPasar("Ese horario ya fue tomado. Elige otro.", "Juan"), "Juan ya tiene a alguien a esa hora");
assert.equal(motivoAlPasar("El barbero tiene ese rato bloqueado. Elige otra hora.", "Juan"), "Juan tiene ese rato bloqueado");
assert.equal(motivoAlPasar("Ese barbero no atiende ese día. Elige otra fecha u otro barbero.", "Juan"), "Juan no viene ese día");
assert.equal(motivoAlPasar("Ese barbero ya no trabaja aquí. Elige otro.", ""), "Ese barbero ya no trabaja aquí");
assert.equal(motivoAlPasar("Ese horario está fuera del horario de atención.", "Juan"), "la sede ya no abre a esa hora");
assert.equal(motivoAlPasar("Algo raro pasó. Elige otra fecha.", "Juan"), "Algo raro pasó");
assert.equal(motivoAlPasar(undefined, "Juan"), "no se pudo");
for (const e of ["Ese horario ya fue tomado. Elige otro.", "El barbero tiene ese rato bloqueado. Elige otra hora.", "Ese día la sede no atiende. Elige otra fecha."]) {
  assert.doesNotMatch(motivoAlPasar(e, "Juan"), /Elige/, `${e}: sin "Elige…" que acá no aplica`);
}

// (7d) Homónimo: nunca se empuja a reactivar sin que el dueño diga que es él.
assert.match(mensajeHomonimo("Kevin"), /Si es él, reactívalo/);
assert.match(mensajeHomonimo("Kevin"), /Si es otra persona/);
assert.match(BAN_DE_BAJA, /^\d+h$/, "duración que entiende Supabase Auth");
assert.ok(Number.parseInt(BAN_DE_BAJA, 10) >= 24 * 365 * 50, "el ban dura décadas, no días");

// (8) Posición en la web: 1..n sin huecos.
assert.equal(sanearOrden(2, 3), 2);
assert.equal(sanearOrden(9, 3), 3, "más allá del último = último");
assert.equal(sanearOrden(0, 3), null);
assert.equal(sanearOrden("x", 3), null);
assert.deepEqual(reordenar(["a", "b", "c"], "c", 1), [
  { id: "c", orden: 1 },
  { id: "a", orden: 2 },
  { id: "b", orden: 3 },
]);
assert.deepEqual(
  reordenar(["a", "b", "c"], "a", 3).map((x) => x.id),
  ["b", "c", "a"],
);
assert.deepEqual(
  reordenar(["a", "b"], "nuevo", 9).map((x) => `${x.id}:${x.orden}`),
  ["a:1", "b:2", "nuevo:3"],
  "uno que llega de otra sede entra donde se pide",
);

console.log("check-equipo OK — correo de login nunca enviable, contrato sin 0 % falso, checklist de 8 puntos, baja sin clientes huérfanos ni cortes sin cobrar, avisos honestos");

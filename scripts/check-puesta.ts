// Chequeo ejecutable de la "puesta a punto" del Inicio (src/lib/puesta.ts).
//
//   node scripts/check-puesta.ts
//
// Esto decide si el dueño ve «Todo al día» o una lista de cosas por arreglar. El
// error caro no es feo: es callarse. El Inicio decía «Todo al día» con 0 aparatos
// del equipo recibiendo avisos y el dueño sin correo, y nadie se enteró hasta la
// auditoría. El otro error caro es acusar sin saber: si un dato no se pudo leer
// (null), ese chequeo se calla.
import assert from "node:assert/strict";
import { armarPuesta, listaNombres, hayFaltas, COBROS_MINIMOS, type DatosPuesta } from "../src/lib/puesta.ts";

/** Un negocio con todo en orden. */
const sano: DatosPuesta = {
  correosDueno: 1,
  aparatosDueno: 1,
  sedes: [
    { id: "parque-venezuela", nombre: "Parque Venezuela", aparatos: 1 },
    { id: "plaza-de-la-paz", nombre: "Plaza de la Paz", aparatos: 2 },
  ],
  barberos: [
    { id: "a", nombre: "Andrés Gómez", aparatos: 1, correo: true, acceso: true },
    { id: "b", nombre: "Luis Pérez", aparatos: 1, correo: true, acceso: true },
  ],
  agendas: { sinAgenda: [], sinCompartir: [] },
  cobros7d: { total: 20, sinCorreo: 3 },
  tocaCorte: { activo: true, elegibles: 4 },
};

const claves = (d: DatosPuesta) => armarPuesta(d).map((p) => p.clave);

// (1) Todo en orden → nada que decir: el Inicio puede decir «Todo al día».
assert.deepEqual(armarPuesta(sano), [], "todo configurado: lista vacía");

// (2) Nada se pudo leer → tampoco se acusa nada.
const ciego: DatosPuesta = {
  correosDueno: null,
  aparatosDueno: null,
  sedes: null,
  barberos: null,
  agendas: null,
  cobros7d: null,
  tocaCorte: null,
};
assert.deepEqual(armarPuesta(ciego), [], "sin datos (p. ej. antes de 0084): se calla, no inventa");

// (3) El día de la auditoría (14-oct): sin correo del dueño, nadie con avisos al
//     celular, 6 agendas sin compartir, 25 de 26 cobros sin cliente, toca corte
//     apagado. Lo que no llega a NADIE va primero.
const auditoria: DatosPuesta = {
  correosDueno: 0,
  aparatosDueno: 0,
  sedes: [
    { id: "parque-venezuela", nombre: "Parque Venezuela", aparatos: 0 },
    { id: "plaza-de-la-paz", nombre: "Plaza de la Paz", aparatos: 0 },
  ],
  barberos: ["Ana", "Beto", "Caro", "Dani", "Eli", "Fede"].map((n, i) => ({
    id: String(i),
    nombre: `${n} Prueba`,
    aparatos: 0,
    correo: true,
    acceso: true,
  })),
  agendas: { sinAgenda: [], sinCompartir: ["Ana Prueba", "Beto Prueba", "Caro Prueba", "Dani Prueba", "Eli Prueba", "Fede Prueba"] },
  cobros7d: { total: 26, sinCorreo: 25 },
  tocaCorte: { activo: false, elegibles: 1 },
};
const hoy = armarPuesta(auditoria);
assert.deepEqual(
  hoy.map((p) => p.clave),
  [
    "correo-dueno",
    "mostrador-parque-venezuela",
    "mostrador-plaza-de-la-paz",
    "celular-dueno",
    "barberos-sin-celular",
    "agendas-google",
    "cobros-sin-cliente",
    "toca-corte",
  ],
  "faltas primero, después sugerencias, cada grupo en su orden",
);
const tono = Object.fromEntries(hoy.map((p) => [p.clave, p.tono]));
assert.equal(tono["correo-dueno"], "falta");
assert.equal(tono["mostrador-plaza-de-la-paz"], "falta", "un mostrador sin avisos: la caja abierta no le llega a nadie");
assert.equal(tono["celular-dueno"], "sugerencia", "con correo o sin él, el push del dueño es un plus");
assert.equal(tono["toca-corte"], "sugerencia");
const mostrador = hoy.find((p) => p.clave === "mostrador-plaza-de-la-paz")!;
assert.match(mostrador.titulo, /Plaza de la Paz/);
assert.match(mostrador.detalle, /PIN de la sede/, "dice el paso en el aparato del local: el dueño no puede activarlo por otro");
assert.match(hoy.find((p) => p.clave === "barberos-sin-celular")!.titulo, /^6 barberos/);
assert.match(hoy.find((p) => p.clave === "agendas-google")!.detalle, /Ana Prueba, Beto Prueba, Caro Prueba y 3 más/);
assert.match(hoy.find((p) => p.clave === "agendas-google")!.detalle, /Compartir con los barberos/);
assert.doesNotMatch(hoy.find((p) => p.clave === "agendas-google")!.detalle, /Crear las agendas/, "si ya existen, no manda a crearlas");
assert.equal(hoy.find((p) => p.clave === "cobros-sin-cliente")!.titulo, "25 de 26 cobros de la semana sin cliente con correo");
assert.match(hoy.find((p) => p.clave === "toca-corte")!.detalle, /1 cliente /);
for (const p of hoy) {
  assert.ok(p.href.startsWith("/admin"), `${p.clave}: el botón lleva a una pantalla del panel`);
  assert.ok(p.titulo && p.detalle && p.boton, `${p.clave}: título, detalle y botón`);
  // Tuteo: nada de voseo en lo que lee el dueño.
  assert.doesNotMatch(`${p.titulo} ${p.detalle} ${p.boton}`, /\b(podés|tenés|querés|poné|activá|tocá|escribí|avisale|escribinos)\b/i, `${p.clave}: tuteo`);
}

// (4) Barberos: una persona se nombra por su nombre; varias, por cuántas.
const unoSinCorreo: DatosPuesta = {
  ...sano,
  barberos: [
    { id: "a", nombre: "Andrés Gómez", aparatos: 1, correo: false, acceso: true },
    { id: "b", nombre: "Luis Pérez", aparatos: 1, correo: true, acceso: true },
  ],
};
const p1 = armarPuesta(unoSinCorreo);
assert.deepEqual(p1.map((p) => p.clave), ["barberos-sin-correo"]);
assert.equal(p1[0].titulo, "Andrés no tiene correo de avisos");
assert.match(p1[0].detalle, /en su ficha/);
assert.equal(p1[0].boton, "Poner correo");

// Sin acceso a la app: falta, y no se le pide activar el celular (no puede entrar).
const sinAcceso: DatosPuesta = {
  ...sano,
  barberos: [
    { id: "a", nombre: "Andrés Gómez", aparatos: 0, correo: true, acceso: false },
    { id: "b", nombre: "Luis Pérez", aparatos: 0, correo: true, acceso: false },
  ],
};
assert.deepEqual(claves(sinAcceso), ["barberos-sin-acceso"], "sin acceso no se le pide activar avisos");
assert.match(armarPuesta(sinAcceso)[0].detalle, /Andrés Gómez y Luis Pérez: les falta/);
assert.match(armarPuesta(sinAcceso)[0].detalle, /soporte/);

// Un dato desconocido de un barbero no lo acusa.
const dudoso: DatosPuesta = {
  ...sano,
  barberos: [{ id: "a", nombre: "Andrés", aparatos: null, correo: null, acceso: null }],
};
assert.deepEqual(armarPuesta(dudoso), [], "null = no se sabe: no se dice nada de ese barbero");

// (5) Google: si falta crear agendas, se dice; si el servidor no tiene Google, nada.
const sinCrear: DatosPuesta = { ...sano, agendas: { sinAgenda: ["Luis Pérez"], sinCompartir: [] } };
assert.equal(armarPuesta(sinCrear)[0].titulo, "Luis no ve sus citas en Google Calendar");
assert.match(armarPuesta(sinCrear)[0].detalle, /Crear las agendas/);
assert.deepEqual(armarPuesta({ ...sano, agendas: null }), [], "Google sin configurar: no es reproche");

// (6) Cobros sin cliente: solo con semana de verdad y más de la mitad.
assert.deepEqual(claves({ ...sano, cobros7d: { total: COBROS_MINIMOS - 1, sinCorreo: COBROS_MINIMOS - 1 } }), [], "pocos cobros: no hay tendencia");
assert.deepEqual(claves({ ...sano, cobros7d: { total: 10, sinCorreo: 5 } }), [], "la mitad justa no alcanza");
assert.deepEqual(claves({ ...sano, cobros7d: { total: 10, sinCorreo: 6 } }), ["cobros-sin-cliente"]);

// (7) El dueño: solo correo o solo celular.
assert.deepEqual(claves({ ...sano, correosDueno: 0 }), ["correo-dueno"]);
assert.deepEqual(claves({ ...sano, aparatosDueno: 0 }), ["celular-dueno"]);
assert.deepEqual(claves({ ...sano, tocaCorte: { activo: false, elegibles: 0 } }), ["toca-corte"]);
assert.doesNotMatch(armarPuesta({ ...sano, tocaCorte: { activo: false, elegibles: 0 } })[0].detalle, /Hoy le escribiría a 0/);

// (7b) «Todo al día» solo depende de las faltas: una sugerencia que el dueño
//      decidió ignorar ("Te toca corte" apagado) no se lo quita para siempre.
assert.equal(hayFaltas(armarPuesta(sano)), false);
assert.equal(hayFaltas(armarPuesta({ ...sano, tocaCorte: { activo: false, elegibles: 3 } })), false, "solo sugerencias");
assert.equal(hayFaltas(armarPuesta({ ...sano, aparatosDueno: 0 })), false, "el celular del dueño es sugerencia");
assert.equal(hayFaltas(armarPuesta({ ...sano, correosDueno: 0 })), true, "sin correo del dueño no le llega nada");
assert.equal(hayFaltas(armarPuesta(auditoria)), true);

// (7c) Lo que el pendiente promete tiene que existir: el PIN de la sede se guarda
//      cifrado y en Equipo NO se puede ver, solo cambiar.
const pendienteLocal = armarPuesta({ ...sano, sedes: [{ id: "x", nombre: "Plaza", aparatos: 0 }] })[0];
assert.equal(pendienteLocal.clave, "mostrador-x");
assert.doesNotMatch(pendienteLocal.boton, /ver el pin/i);
assert.match(pendienteLocal.detalle, /no se puede ver/);
assert.match(pendienteLocal.detalle, /bloqueados/, "si el permiso está bloqueado, la tarjeta lo explica");

// (8) Las listas de nombres se leen como español.
assert.equal(listaNombres([]), "");
assert.equal(listaNombres(["Ana"]), "Ana");
assert.equal(listaNombres(["Ana", "Luis"]), "Ana y Luis");
assert.equal(listaNombres(["Ana", "Luis", "Pedro"]), "Ana, Luis y Pedro");
assert.equal(listaNombres(["Ana", "Luis", "Pedro", "Caro"]), "Ana, Luis, Pedro y 1 más");

console.log(`check-puesta OK — ${hoy.length} pendientes el día de la auditoría, 0 con todo en orden, nada inventado sin datos`);

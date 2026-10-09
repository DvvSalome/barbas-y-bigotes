// Chequeo ejecutable de "cubre hoy en la otra sede" (0081).
//
//   node scripts/check-cobertura.ts
//
// Si el que cubre no aparece en el mostrador de la sede que cubre, no se le puede
// anotar nada; si sigue apareciendo en su sede de siempre, le anotan clientes a
// alguien que no está.
import assert from "node:assert/strict";
import { equipoDelDia, visitasDelDia } from "../src/lib/cobertura.ts";

const barberos = [
  { id: "meyer", nombre: "Meyer", sede: "parque" },
  { id: "jhon", nombre: "Jhon", sede: "parque" },
  { id: "kevin", nombre: "Kevin", sede: "plaza" },
];
const cob = [{ barberoId: "meyer", fecha: "2026-10-09", sede: "plaza" }];
const de = (lista: { id: string; sede: string }[], sede: string) => lista.filter((b) => b.sede === sede).map((b) => b.id);

// (a) El día de la cobertura: Meyer cuenta en Plaza y deja de contar en Parque.
const hoy = equipoDelDia(barberos, cob, "2026-10-09");
assert.deepEqual(de(hoy, "plaza"), ["meyer", "kevin"]);
assert.deepEqual(de(hoy, "parque"), ["jhon"]);
assert.equal(hoy.find((b) => b.id === "meyer")?.nombre, "Meyer"); // el resto de la ficha, intacto
assert.deepEqual(visitasDelDia(barberos, cob, "2026-10-09"), { meyer: "parque" });

// (b) Otro día: todos en su sede de siempre.
const manana = equipoDelDia(barberos, cob, "2026-10-10");
assert.deepEqual(de(manana, "plaza"), ["kevin"]);
assert.deepEqual(de(manana, "parque"), ["meyer", "jhon"]);
assert.deepEqual(visitasDelDia(barberos, cob, "2026-10-10"), {});

// (c) Una "cobertura" en su propia sede no es visita.
assert.deepEqual(visitasDelDia(barberos, [{ barberoId: "kevin", fecha: "2026-10-09", sede: "plaza" }], "2026-10-09"), {});

// (d) No muta la lista original.
assert.equal(barberos[0].sede, "parque");

console.log("check-cobertura: ok");

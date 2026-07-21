// Self-check de los tokens de tema (globals.css).
//   node scripts/check-tema.ts
//
// Nace de dos bugs reales del tema claro del staff (jul/2026), los dos del mismo
// tipo: una rampa de color escrita al revés. Ninguno lo cazaba tsc ni el build,
// porque son valores válidos; solo se veían mirando la pantalla.
//
//   1) --elevated era MÁS OSCURO que --bg y --panel, así que todo lo que debía
//      "flotar" se veía hundido, y la pastilla activa de los segmentados parecía
//      deshabilitada.
//   2) El CTA usaba accent-soft -> accent como degradado, pero en claro
//      accent-soft se redefinió más oscuro (es color de texto), y el botón
//      quedaba iluminado desde abajo.
//
// Este check lee el CSS de verdad y afirma las invariantes que ordenan esas
// rampas, para que no vuelvan a invertirse sin que alguien se entere.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

// Luminancia relativa (WCAG). Solo hex de 6 dígitos: los tokens de rampa lo son.
function lum(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contraste = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/** Cuerpo del bloque CSS cuyo selector es exactamente `sel`. */
function bloque(sel: string): string {
  const i = css.indexOf(sel + " {");
  assert.notEqual(i, -1, `no encontré el bloque ${sel} en globals.css`);
  const desde = css.indexOf("{", i);
  const hasta = css.indexOf("}", desde);
  return css.slice(desde, hasta);
}

/** Valor hex de una custom property dentro de un bloque. null si no está. */
function token(sel: string, nombre: string): string | null {
  const m = bloque(sel).match(new RegExp(`--${nombre}\\s*:\\s*(#[0-9a-fA-F]{6})`));
  return m ? m[1] : null;
}

const avisos: string[] = [];

const TEMAS = [
  { sel: ":root", nombre: "público (oscuro)" },
  { sel: "[data-staff]", nombre: "staff oscuro" },
  { sel: '[data-staff][data-theme="light"]', nombre: "staff claro" },
];

for (const { sel, nombre } of TEMAS) {
  // ---- 1) La rampa de elevación SIEMPRE sube: bg < panel < elevated ----
  // Es lo que hace que una card se lea "encima" del fondo. Da igual si el tema
  // es claro u oscuro: lo que flota tiene que ser más luminoso que su base.
  const bg = token(sel, "bg");
  const panel = token(sel, "panel");
  const elevated = token(sel, "elevated");
  assert.ok(bg && panel && elevated, `${nombre}: faltan tokens de la rampa`);
  assert.ok(
    lum(bg!) < lum(panel!),
    `${nombre}: --panel (${panel}) debe ser MÁS CLARO que --bg (${bg}); si no, las cards se ven hundidas`,
  );
  assert.ok(
    lum(panel!) < lum(elevated!),
    `${nombre}: --elevated (${elevated}) debe ser MÁS CLARO que --panel (${panel}); si no, lo que flota se ve hundido (bug de jul/2026)`,
  );

  // ---- 2) El degradado del CTA se ilumina desde ARRIBA: cta-1 más claro ----
  const c1 = token(sel, "cta-1");
  const c2 = token(sel, "cta-2");
  assert.ok(c1 && c2, `${nombre}: faltan --cta-1/--cta-2`);
  assert.ok(
    lum(c1!) > lum(c2!),
    `${nombre}: --cta-1 (${c1}) debe ser MÁS CLARO que --cta-2 (${c2}); al revés el botón se ve iluminado desde abajo`,
  );

  // ---- 3) El texto sobre el rojo se mantiene legible ----
  // El piso duro es 3.0 (mínimo WCAG para texto grande y componentes de UI, que
  // es lo que son estos botones). Se AVISA de lo que no llega a 4.5 en vez de
  // romper el build: el rojo de marca #d23f34 mide 4.37:1 con el hueso, y
  // subirlo es una decisión de marca del dueño, no algo que deba forzar un test.
  const onAccent = token(sel, "on-accent");
  const accent = token(sel, "accent");
  assert.ok(onAccent && accent, `${nombre}: faltan --on-accent/--accent`);
  for (const fondo of [accent!, c1!, c2!]) {
    const r = contraste(onAccent!, fondo);
    assert.ok(
      r >= 3,
      `${nombre}: --on-accent (${onAccent}) sobre ${fondo} da ${r.toFixed(2)}:1, ilegible (piso 3.0)`,
    );
    if (r < 4.5) avisos.push(`${nombre}: texto sobre ${fondo} = ${r.toFixed(2)}:1 (AA pide 4.5)`);
  }
}

// ---- 4) El staff claro es de verdad claro y el oscuro de verdad oscuro ----
// Un despiste al copiar bloques podría dejar los dos iguales; entonces el toggle
// de tema no haría nada visible y nadie se daría cuenta desde el código.
const bgOscuro = token("[data-staff]", "bg")!;
const bgClaro = token('[data-staff][data-theme="light"]', "bg")!;
assert.ok(
  lum(bgClaro) > 0.5 && lum(bgOscuro) < 0.1,
  `los dos temas del staff deben diferenciarse: claro ${bgClaro} (L=${lum(bgClaro).toFixed(2)}) vs oscuro ${bgOscuro} (L=${lum(bgOscuro).toFixed(2)})`,
);

for (const a of avisos) console.log("  aviso · " + a);
console.log("check-tema OK — rampas de elevación y degradados del CTA en el sentido correcto");

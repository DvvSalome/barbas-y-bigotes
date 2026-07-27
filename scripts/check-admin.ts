// Chequeo ejecutable de las reglas del back-office (src/lib/admin-reglas.ts).
//
//   node scripts/check-admin.ts
//
// Cubre lo que un QA manual no vuelve a mirar nunca: el admin toca precios,
// comisiones, fotos y perfiles a mano y un dato malo acá se multiplica por cada
// venta. Cada bloque nombra el bug real que evita.
import assert from "node:assert/strict";
import {
  sanearCop,
  sanearCantidad,
  sanearComisionPct,
  sanearNombre,
  partirEspecialidades,
  sanearEspecialidades,
  MAX_ESPECIALIDADES,
  slugCombo,
  resolverColisionSlug,
  esComboValido,
  extDeMime,
  variantesObsoletas,
  sanearPrevioHoras,
  fechaLabel,
  esDomingo,
} from "../src/lib/admin-reglas.ts";

// ---------- (a) Dinero: addProducto no validaba NADA y productos no tiene CHECK ----------
// Un precio negativo se guardaba tal cual y el cobro lo lee de la base: un
// producto en -5000 le RESTA plata a la venta.
assert.equal(sanearCop(25000), 25000, "un precio normal pasa");
assert.equal(sanearCop(0), 0, "gratis es válido (producto de cortesía)");
assert.equal(sanearCop(-500), null, "precio negativo se rechaza");
assert.equal(sanearCop(19.99), null, "el negocio no usa centavos: se rechaza, no se trunca");
assert.equal(sanearCop("30000"), 30000, "string numérico del form se acepta");
assert.equal(sanearCop(""), null, "vacío no es 0 (Number('') es 0: el bug clásico)");
assert.equal(sanearCop("abc"), null, "basura se rechaza");
assert.equal(sanearCop(null), null, "null se rechaza");
assert.equal(sanearCop(NaN), null, "NaN se rechaza");
assert.equal(sanearCop(Infinity), null, "Infinity se rechaza");
assert.equal(sanearCantidad(-3), null, "stock negativo se rechaza");

// ---------- (b) Comisión: se multiplica por cada venta del barbero ----------
assert.equal(sanearComisionPct(50), 50, "50% pasa");
assert.equal(sanearComisionPct(0), 0, "0% es válido (arriendo de silla)");
assert.equal(sanearComisionPct(100), 100, "100% es el tope");
assert.equal(sanearComisionPct(250), null, "más de 100% se rechaza");
assert.equal(sanearComisionPct(-10), null, "comisión negativa se rechaza");
assert.equal(sanearComisionPct(33.333), 33.33, "se redondea a 2 decimales (numeric(5,2))");

// ---------- (c) Nombre ----------
assert.equal(sanearNombre("  Cera mate  "), "Cera mate", "recorta");
assert.equal(sanearNombre("Cera   mate"), "Cera mate", "colapsa espacios internos");
assert.equal(sanearNombre("   "), null, "solo espacios no es nombre");
assert.equal(sanearNombre(""), null, "vacío no es nombre");
assert.equal(sanearNombre("x".repeat(200))?.length, 80, "corta al máximo");

// ---------- (d) Especialidades: se descartaban en silencio ----------
// El admin escribía 8, veía "Perfil guardado" y se publicaban 6. Y varios
// barberos YA tienen 7-8 cargadas: abrir su perfil para tocar la bio se las
// recortaba sin avisar. Ahora el saneo dice qué descartó.
const ocho = sanearEspecialidades(["A", "B", "C", "D", "E", "F", "G", "H"]);
assert.equal(ocho.especialidades.length, MAX_ESPECIALIDADES, "guarda 6");
assert.equal(ocho.descartadas.length, 2, "y REPORTA las 2 que descartó");
assert.deepEqual(ocho.descartadas.map((d) => d.valor), ["G", "H"], "descarta las últimas, no las primeras");
assert.ok(ocho.descartadas.every((d) => d.motivo === "excede-maximo"), "con el motivo correcto");

const dup = sanearEspecialidades(["Fade", "fade", "  FADE  "]);
assert.deepEqual(dup.especialidades, ["Fade"], "dedup case-insensitive, conserva la primera");
assert.equal(dup.descartadas.length, 2, "y reporta las 2 duplicadas");
assert.equal(dup.descartadas[0].motivo, "duplicada", "con motivo duplicada");

assert.deepEqual(sanearEspecialidades(["  Barbas  ", "", "   "]).especialidades, ["Barbas"], "ignora vacíos");
assert.deepEqual(sanearEspecialidades(null).especialidades, [], "null → lista vacía, no explota");
assert.deepEqual(sanearEspecialidades(["ok", 42, null]).especialidades, ["ok"], "ignora lo que no es string");
// Un duplicado NO debe gastar cupo del máximo.
const seisConDup = sanearEspecialidades(["A", "a", "B", "C", "D", "E", "F"]);
assert.deepEqual(seisConDup.especialidades, ["A", "B", "C", "D", "E", "F"], "el duplicado no roba un lugar");

// El cliente y el server tienen que partir el texto IGUAL o el admin ve una cosa
// y se guarda otra.
assert.deepEqual(partirEspecialidades("Fades, Barba\nColor"), ["Fades", "Barba", "Color"], "coma y salto de línea");
assert.deepEqual(partirEspecialidades(" , ,\n "), [], "separadores sueltos no generan vacíos");

// ---------- (e) Combos ----------
assert.equal(slugCombo("Corte + Barba"), "corte-barba", "espacios y símbolos a guiones");
assert.equal(slugCombo("Diseño Ñandú"), "diseno-nandu", "acentos y ñ");
assert.equal(slugCombo("   "), "combo", "sin nada útil cae al fallback");
assert.equal(slugCombo("!!!"), "combo", "solo símbolos cae al fallback");
assert.ok(!slugCombo("x".repeat(80)).endsWith("-"), "nunca termina en guion tras cortar a 60");
assert.equal(resolverColisionSlug("corte", []), "corte", "sin colisión usa la base");
assert.equal(resolverColisionSlug("corte", ["corte"]), "corte-2", "primera colisión");
assert.equal(resolverColisionSlug("corte", ["corte", "corte-2", "corte-3"]), "corte-4", "sigue hasta libre");
assert.equal(esComboValido(["corte", "barba"], false), true, "2 partes vale");
assert.equal(esComboValido(["corte"], true), true, "1 parte + bebida vale");
assert.equal(esComboValido(["corte"], false), false, "1 parte sola no vale");
assert.equal(esComboValido([], true), false, "solo bebida no es combo");

// ---------- (f) Fotos: el bucket es público y el path lleva la extensión ----------
assert.equal(extDeMime("image/jpeg"), "jpg", "jpeg → jpg");
assert.equal(extDeMime("image/png"), "png");
assert.equal(extDeMime("image/webp"), "webp");
assert.equal(extDeMime("image/avif"), "avif");
assert.equal(extDeMime("image/svg+xml"), "jpg", "un MIME fuera de la allowlist no inventa extensión");
assert.equal(extDeMime(""), "jpg", "vacío cae al default");
// Re-subir en otro formato debe barrer el archivo viejo: si no, la foto anterior
// del producto queda servida para siempre en un bucket público.
const obsoletas = variantesObsoletas("abc-123", "webp");
assert.deepEqual(obsoletas.sort(), ["abc-123.avif", "abc-123.jpg", "abc-123.png"].sort(), "borra las otras 3");
assert.ok(!obsoletas.includes("abc-123.webp"), "NO borra la que acaba de subir");

// ---------- (g) Antelación del aviso previo ----------
assert.equal(sanearPrevioHoras(2), 2, "2 horas pasa");
assert.equal(sanearPrevioHoras(0.5), 0.5, "media hora es el piso");
assert.equal(sanearPrevioHoras(12), 12, "12 horas es el techo");
assert.equal(sanearPrevioHoras(0.7), 0.5, "redondea a la media hora (y la UI lo muestra)");
assert.equal(sanearPrevioHoras(0.2), null, "por debajo del piso tras redondear se rechaza");
assert.equal(sanearPrevioHoras(48), null, "arriba del techo se rechaza (igual que el CHECK 0038)");
assert.equal(sanearPrevioHoras("abc"), null, "basura se rechaza");

// ---------- (h) Fechas: el bug de timezone que corre el día ----------
// new Date("2026-07-18") se parsea como UTC y en Bogotá (UTC-5) daría el 17.
assert.ok(fechaLabel("2026-07-18").includes("18"), "muestra el día correcto, no el anterior");
assert.ok(fechaLabel("2026-01-01").includes("1"), "primero de año");
assert.equal(fechaLabel(""), "", "vacío no explota");
assert.equal(esDomingo("2026-07-26"), true, "26-jul-2026 es domingo");
assert.equal(esDomingo("2026-07-27"), false, "27-jul-2026 es lunes");
assert.equal(esDomingo("basura"), false, "entrada inválida no explota");

console.log("check-admin OK — reglas del back-office (dinero, comisión, especialidades, combos, fotos, fechas)");

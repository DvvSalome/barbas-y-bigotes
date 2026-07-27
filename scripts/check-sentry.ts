// Chequeo ejecutable del filtro de ruido de Sentry (instrumentation-client.ts).
//
//   node scripts/check-sentry.ts
//
// Un filtro de errores es peligroso en las dos direcciones: si deja pasar todo,
// el ruido entierra el aviso que importa; si filtra de más, un bug real
// desaparece y nadie se entera nunca. Acá se fija dónde está la línea.
import assert from "node:assert/strict";
import { esRuidoDeExtension } from "../src/lib/sentry-filtro.ts";

// --- Extensiones: se descartan ---
// Caso real del 2026-07-27: "Cannot read properties of undefined (reading
// 'waiting')" en la home. El mensaje es de lo más común —ignoreErrors no lo
// agarra— y la extensión solo aparece en el stack. Verificado en un navegador
// limpio que el sitio NO lanza ese error por su cuenta.
assert.equal(esRuidoDeExtension(["ext:core/01_core.js", "<script>", "<script>"]), true, "el caso real se descarta");
assert.equal(esRuidoDeExtension(["chrome-extension://abc/inject.js"]), true, "extensión de Chrome");
assert.equal(esRuidoDeExtension(["moz-extension://xyz/content.js"]), true, "extensión de Firefox");
assert.equal(esRuidoDeExtension(["safari-web-extension://a/b.js"]), true, "extensión de Safari");
assert.equal(esRuidoDeExtension(["webkit-masked-url://hidden/script.js"]), true, "url enmascarada de WebKit");
// Basta con que la extensión esté en CUALQUIER punto de la pila.
assert.equal(
  esRuidoDeExtension(["https://barbasybigotes.com/_next/static/chunks/main.js", "ext:core/01_core.js"]),
  true,
  "si una extensión toca la pila, no hay nada que podamos arreglar",
);

// --- Errores REALES: tienen que pasar ---
// Esto es lo que protege el chequeo: que un bug de verdad no se filtre por error.
assert.equal(
  esRuidoDeExtension(["https://barbasybigotes.com/_next/static/chunks/4bd1b696.js"]),
  false,
  "un error de nuestro bundle SIEMPRE llega",
);
assert.equal(
  esRuidoDeExtension(["https://barbasybigotes.com/"]),
  false,
  "un error de un script inline nuestro llega",
);
assert.equal(esRuidoDeExtension([]), false, "sin stack no se descarta nada (mejor ruido que ceguera)");
assert.equal(esRuidoDeExtension([""]), false, "un frame sin nombre no alcanza para descartar");
assert.equal(esRuidoDeExtension(["<anonymous>"]), false, "anónimo tampoco: puede ser código nuestro");
// Trampa: un dominio que EMPIEZA parecido no es una extensión.
assert.equal(
  esRuidoDeExtension(["https://extension-tips.com/a.js"]),
  false,
  "el esquema se ancla al principio, no matchea un dominio cualquiera",
);

console.log("check-sentry OK — el ruido de extensiones se descarta y los errores reales pasan");

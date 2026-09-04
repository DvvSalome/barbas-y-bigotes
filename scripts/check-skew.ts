// Self-check de skew.ts: la recarga por "deploy viejo" se dispara UNA vez por
// ventana, nunca sin conexión y nunca sin sessionStorage (sin cómo frenar un
// bucle, mejor no recargar). Es la red que evita que una pestaña huérfana tras
// un deploy siga reventando (21 errores en 6 s en Sentry, 4-sep-2026).
//   node scripts/check-skew.ts
import assert from "node:assert/strict";
import { recargarSiDeployViejo } from "../src/lib/skew.ts";

let recargas = 0;
const memoria = new Map<string, string>();
const storageOk = {
  getItem: (k: string) => memoria.get(k) ?? null,
  setItem: (k: string, v: string) => void memoria.set(k, v),
};
const storageRoto = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("SecurityError");
  },
};
const g = globalThis as unknown as Record<string, unknown>;
function escenario(o: { online?: boolean; storage?: unknown; sinWindow?: boolean }) {
  if (o.sinWindow) delete g.window;
  else
    g.window = {
      location: {
        reload: () => {
          recargas++;
        },
      },
    };
  Object.defineProperty(globalThis, "navigator", { value: { onLine: o.online ?? true }, configurable: true, writable: true });
  Object.defineProperty(globalThis, "sessionStorage", { value: o.storage ?? storageOk, configurable: true, writable: true });
}

escenario({});
assert.equal(recargarSiDeployViejo(), true, "primera vez: recarga");
assert.equal(recargas, 1, "una recarga");
assert.equal(recargarSiDeployViejo(), false, "enseguida otra vez: NO recarga (misma ventana)");
assert.equal(recargas, 1, "sigue en una");

memoria.set("bb-recarga-deploy", String(Date.now() - 11 * 60_000));
assert.equal(recargarSiDeployViejo(), true, "pasados 10 min: puede recargar de nuevo");
assert.equal(recargas, 2, "dos recargas en total");

memoria.clear();
escenario({ online: false });
assert.equal(recargarSiDeployViejo(), false, "sin conexión: nunca recarga (caería en /~offline)");
assert.equal(recargas, 2, "sin conexión no sumó recarga");

escenario({ storage: storageRoto });
assert.equal(recargarSiDeployViejo(), false, "sin sessionStorage: no recarga (no habría cómo frenar un bucle)");
assert.equal(recargas, 2, "sin storage no sumó recarga");

escenario({ sinWindow: true });
assert.equal(recargarSiDeployViejo(), false, "en el servidor: no hace nada");

console.log("check-skew OK — recarga una vez por ventana, nunca offline ni sin storage");

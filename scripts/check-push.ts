// Smoke del emisor de push (Bloque 3). Valida que las llaves VAPID del entorno
// sean coherentes (formato base64url y largo correcto) SIN enviar nada real:
// si webpush.setVapidDetails no lanza, la config del emisor está OK.
//
//   node scripts/check-push.ts
//
// (Node ≥23.6 corre TypeScript directo con type stripping; no requiere build.
//  Carga .env.local por sí solo para no depender de dotenv ni de flags.)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import webpush from "web-push";

// Carga mínima de .env.local (solo pares NOMBRE=valor; el env real tiene prioridad).
try {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const linea of raw.split(/\r?\n/)) {
    const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
} catch {
  // Sin .env.local (p.ej. CI): se valida contra el entorno del proceso.
}

const subject = process.env.VAPID_SUBJECT;
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

assert.ok(subject, "VAPID_SUBJECT faltante en el entorno");
assert.ok(publicKey, "NEXT_PUBLIC_VAPID_PUBLIC_KEY faltante en el entorno");
assert.ok(privateKey, "VAPID_PRIVATE_KEY faltante en el entorno");

// setVapidDetails valida subject (mailto:/https:) y el largo/base64url de las
// llaves. No lanza = el emisor puede firmar pushes con este entorno.
webpush.setVapidDetails(subject, publicKey, privateKey);

console.log("check-push OK — VAPID válido (subject + llaves), no se envió nada.");

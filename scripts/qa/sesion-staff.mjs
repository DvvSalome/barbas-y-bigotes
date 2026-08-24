// Deja una SESIÓN de staff lista para Playwright, sin usar la contraseña de nadie:
// enlace de un solo uso con la llave de servicio → canje → cookie de @supabase/ssr.
// Es el mismo mecanismo que barbero-auth.ts usa para el login por PIN.
//
//   ROL=admin node scripts/qa/sesion-staff.mjs   → qa-out/cookies-admin.json
//   ROL=sede  node scripts/qa/sesion-staff.mjs   → qa-out/cookies-sede.json
//   ROL=barbero node scripts/qa/sesion-staff.mjs → qa-out/cookies-barbero.json
//
// La carpeta qa-out/ está en .gitignore: la cookie es una sesión real y vence en
// una hora, pero no tiene por qué quedar versionada.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..") + "/";
const SP = process.env.SALIDA ? process.env.SALIDA + "/" : RAIZ + "qa-out/";
const ROL = process.env.ROL || "admin";

const env = Object.fromEntries(
  readFileSync(RAIZ + ".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const U = env.NEXT_PUBLIC_SUPABASE_URL;
const SRV = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const H = { apikey: SRV, Authorization: `Bearer ${SRV}`, "Content-Type": "application/json" };

const perfiles = await (await fetch(`${U}/rest/v1/profiles?select=auth_id,nombre,rol,sede_id&rol=eq.${ROL}`, { headers: H })).json();
const prof = perfiles[0];
if (!prof?.auth_id) {
  console.log(`No hay perfil con rol "${ROL}" que tenga usuario.`);
  process.exit(1);
}
const users = await (await fetch(`${U}/auth/v1/admin/users?per_page=200`, { headers: H })).json();
const user = (users.users || users).find((u) => u.id === prof.auth_id);

const gen = await (await fetch(`${U}/auth/v1/admin/generate_link`, {
  method: "POST",
  headers: H,
  body: JSON.stringify({ type: "magiclink", email: user.email }),
})).json();
const hashed = gen.hashed_token || gen.properties?.hashed_token;

// El canje va con la llave ANÓNIMA: es un login normal, no una operación de admin.
const vr = await fetch(`${U}/auth/v1/verify`, {
  method: "POST",
  redirect: "manual",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ type: "magiclink", token_hash: hashed }),
});
const ses = await vr.json().catch(() => null);
if (!vr.ok || !ses?.access_token) {
  console.log("No se pudo canjear:", vr.status, JSON.stringify(ses).slice(0, 200));
  process.exit(1);
}

// La cookie que espera @supabase/ssr: "base64-" + el JSON de la sesión, partido en
// trozos si se pasa del límite que aguanta un navegador.
const ref = new URL(U).hostname.split(".")[0];
const valor = "base64-" + Buffer.from(JSON.stringify({
  access_token: ses.access_token,
  refresh_token: ses.refresh_token,
  expires_at: ses.expires_at,
  expires_in: ses.expires_in,
  token_type: ses.token_type,
  user: ses.user,
})).toString("base64");

const LIMITE = 3180;
const trozos = [];
for (let i = 0; i < valor.length; i += LIMITE) trozos.push(valor.slice(i, i + LIMITE));
const galletas = trozos.length === 1
  ? [{ name: `sb-${ref}-auth-token`, value: valor }]
  : trozos.map((t, i) => ({ name: `sb-${ref}-auth-token.${i}`, value: t }));

mkdirSync(SP, { recursive: true });
const salida = SP + `cookies-${ROL}.json`;
writeFileSync(salida, JSON.stringify(galletas.map((g) => ({
  ...g, domain: "barbasybigotes.com", path: "/", httpOnly: false, secure: true, sameSite: "Lax", expires: ses.expires_at,
})), null, 2));
console.log(`[${prof.nombre}] rol=${prof.rol} sede=${prof.sede_id ?? "—"} · ${galletas.length} cookie(s) · vence en ${Math.round(ses.expires_in / 60)} min`);

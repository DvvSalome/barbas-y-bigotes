import { createSign } from "node:crypto";
import { getVercelOidcToken } from "@vercel/functions/oidc";

// Cliente mínimo de Google Calendar con la CUENTA DE SERVICIO barbas-calendar@…
// SIN llaves: el proyecto de Google (sin organización) prohíbe crear llaves de
// cuenta de servicio, así que la app se identifica con el token OIDC que Vercel
// le da a cada función (Workload Identity Federation): STS lo cambia por una
// credencial federada y con ella se pide un access token de la cuenta de
// servicio para Calendar. Nada que guardar, nada que rotar.
//
// Variables (no secretas): GOOGLE_CALENDAR_SA (correo de la cuenta de servicio) y
// GOOGLE_WIF_AUDIENCE (//iam.googleapis.com/projects/…/providers/vercel).
// Alternativa con llave, si algún día se permite: GOOGLE_CALENDAR_SA_JSON (base64).
// Server-only: nunca importar desde un componente cliente.

const SCOPE = "https://www.googleapis.com/auth/calendar";
const API = "https://www.googleapis.com/calendar/v3";

type CuentaServicio = { client_email: string; private_key: string };

function credencialesLlave(): CuentaServicio | null {
  const raw = process.env.GOOGLE_CALENDAR_SA_JSON;
  if (!raw) return null;
  try {
    const texto = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const j = JSON.parse(texto) as Partial<CuentaServicio>;
    return j.client_email && j.private_key ? (j as CuentaServicio) : null;
  } catch {
    return null;
  }
}

const federado = () => !!(process.env.GOOGLE_CALENDAR_SA && process.env.GOOGLE_WIF_AUDIENCE);

export const calendarConfigurado = (): boolean => federado() || credencialesLlave() !== null;

/** Correo de la cuenta de servicio (es quien "comparte" los calendarios). */
export const calendarCuenta = (): string | null => process.env.GOOGLE_CALENDAR_SA ?? credencialesLlave()?.client_email ?? null;

// Un token dura una hora; se reutiliza mientras le queden más de 60 s. Es por
// instancia (serverless): en el peor caso se pide uno nuevo, no pasa nada.
let cache: { token: string; expira: number } | null = null;

async function tokenConLlave(sa: CuentaServicio): Promise<{ token: string; expira: number }> {
  const ahora = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const sinFirma = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email,
    scope: SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: ahora,
    exp: ahora + 3600,
  })}`;
  const firma = createSign("RSA-SHA256").update(sinFirma).sign(sa.private_key, "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${sinFirma}.${firma}` }),
    cache: "no-store",
  });
  const j = (await r.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!r.ok || !j.access_token) throw new Error(`Token de Google (llave): ${j.error_description ?? j.error ?? r.status}`);
  return { token: j.access_token, expira: Date.now() + (j.expires_in ?? 3600) * 1000 };
}

async function tokenFederado(): Promise<{ token: string; expira: number }> {
  const oidc = await getVercelOidcToken();
  // 1) El token de Vercel → credencial federada de Google (STS).
  const sts = await fetch("https://sts.googleapis.com/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grantType: "urn:ietf:params:oauth:grant-type:token-exchange",
      audience: process.env.GOOGLE_WIF_AUDIENCE,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      requestedTokenType: "urn:ietf:params:oauth:token-type:access_token",
      subjectToken: oidc,
      subjectTokenType: "urn:ietf:params:oauth:token-type:jwt",
    }),
    cache: "no-store",
  });
  const s = (await sts.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!sts.ok || !s.access_token) throw new Error(`STS de Google: ${s.error_description ?? s.error ?? sts.status}`);
  // 2) Con la credencial federada, un access token de la cuenta de servicio para Calendar.
  const sa = encodeURIComponent(process.env.GOOGLE_CALENDAR_SA ?? "");
  const gen = await fetch(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${sa}:generateAccessToken`, {
    method: "POST",
    headers: { Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ scope: [SCOPE], lifetime: "3600s" }),
    cache: "no-store",
  });
  const g = (await gen.json()) as { accessToken?: string; expireTime?: string; error?: { message?: string } };
  if (!gen.ok || !g.accessToken) throw new Error(`Impersonación de la cuenta de servicio: ${g.error?.message ?? gen.status}`);
  return { token: g.accessToken, expira: g.expireTime ? new Date(g.expireTime).getTime() : Date.now() + 3300_000 };
}

async function accessToken(): Promise<string> {
  if (cache && cache.expira > Date.now() + 60_000) return cache.token;
  const llave = credencialesLlave();
  if (llave) cache = await tokenConLlave(llave);
  else if (federado()) cache = await tokenFederado();
  else throw new Error("Falta GOOGLE_CALENDAR_SA + GOOGLE_WIF_AUDIENCE (o GOOGLE_CALENDAR_SA_JSON)");
  return cache.token;
}

async function api<T>(method: string, ruta: string, body?: unknown, toleraNoExiste = false): Promise<T | null> {
  const r = await fetch(`${API}${ruta}`, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (toleraNoExiste && (r.status === 404 || r.status === 410)) return null;
  if (r.status === 204) return null;
  const texto = await r.text();
  if (!r.ok) {
    let msg = texto.slice(0, 300);
    try {
      msg = (JSON.parse(texto) as { error?: { message?: string } }).error?.message ?? msg;
    } catch {
      /* texto plano */
    }
    throw new Error(`Google Calendar ${method} ${ruta} → ${r.status}: ${msg}`);
  }
  return texto ? (JSON.parse(texto) as T) : null;
}

export async function crearCalendario(nombre: string, descripcion: string): Promise<string> {
  const c = await api<{ id: string }>("POST", "/calendars", { summary: nombre, description: descripcion, timeZone: "America/Bogota" });
  if (!c?.id) throw new Error("Google no devolvió el id del calendario");
  return c.id;
}

export type RolCalendario = "reader" | "writer" | "owner";

/** Comparte un calendario con un correo. Google le manda el aviso de "compartieron contigo". */
export async function compartirCalendario(calendarId: string, email: string, rol: RolCalendario): Promise<void> {
  await api("POST", `/calendars/${encodeURIComponent(calendarId)}/acl?sendNotifications=true`, {
    role: rol,
    scope: { type: "user", value: email },
  });
}

export type EventoCalendar = {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  colorId?: string;
  extendedProperties?: { private: Record<string, string> };
  reminders?: { useDefault: boolean };
};

/** Crea o corrige el evento. Si el id guardado ya no existe (lo borraron a mano), crea uno nuevo. */
export async function guardarEvento(calendarId: string, eventId: string | null, evento: EventoCalendar): Promise<string> {
  const cal = encodeURIComponent(calendarId);
  if (eventId) {
    const e = await api<{ id: string }>("PATCH", `/calendars/${cal}/events/${encodeURIComponent(eventId)}`, evento, true);
    if (e?.id) return e.id;
  }
  const nuevo = await api<{ id: string }>("POST", `/calendars/${cal}/events`, evento);
  if (!nuevo?.id) throw new Error("Google no devolvió el id del evento");
  return nuevo.id;
}

export async function borrarEvento(calendarId: string, eventId: string): Promise<void> {
  await api("DELETE", `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, undefined, true);
}

/** Para diagnóstico y pruebas: los eventos de un calendario en una ventana. */
export async function listarEventos(calendarId: string, desdeISO: string, hastaISO: string) {
  const q = new URLSearchParams({ timeMin: desdeISO, timeMax: hastaISO, singleEvents: "true", maxResults: "50" });
  const r = await api<{ items?: { id: string; summary?: string; start?: { dateTime?: string }; status?: string }[] }>(
    "GET",
    `/calendars/${encodeURIComponent(calendarId)}/events?${q}`,
  );
  return r?.items ?? [];
}

# Login del barbero con PIN de 6 dígitos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un barbero entre a `/barbero` tecleando un PIN de 6 dígitos (con bloqueo por intentos), sin romper el modelo de RLS.

**Architecture:** El PIN se guarda hasheado (bcrypt/pgcrypto) en una tabla `barbero_pin` service_role-only. Una server action verifica el PIN vía una función DB con bloqueo por intentos, y en éxito **mina la sesión real de Supabase** del barbero con `admin.generateLink` + `verifyOtp` (server-side, sin email) → `auth.uid()` y la RLS siguen intactos. El `/login` email+contraseña queda para el admin.

**Tech Stack:** Next.js 16.2.6 (App Router, webpack), React 19, TypeScript, Supabase (`@supabase/supabase-js` ^2.106.1, Auth admin API), Postgres + pgcrypto.

## Global Constraints
- **Next.js 16 tiene breaking changes.** Antes de tocar server actions / `verifyOtp` / cookies de sesión, leer `node_modules/next/dist/docs/` (regla de `AGENTS.md`).
- **No hay test runner.** Verificación de cada task de código = `npx tsc --noEmit` + `npm run build`. **No agregar** framework de tests.
- **La migración corre contra el Supabase de PROD** (`wvmdsxznujklgfezqtfy`); la aplica el humano en el SQL Editor (como el seed). Es aditiva, no toca datos existentes.
- Copy en **español**.
- El PIN va **hasheado** (bcrypt vía pgcrypto); **nunca** en texto ni en logs, **nunca** en la tabla pública `barberos` (va en `barbero_pin`, service_role-only).
- **Bloqueo:** 5 intentos → 5 minutos (en la función DB).
- **PINs triviales rechazados** al setear: 6 dígitos, no de una lista trivial.
- El PIN debe terminar creando una **sesión real de Supabase** del barbero (no un login paralelo) para no romper RLS.
- La página de login por PIN va en **`/entrar`** (segmento propio) — NO bajo `/barbero/*`, que tiene un layout que redirige a `/login` sin sesión.
- Trabajar en la rama `spec/pin-barbero` (ya creada, con el spec). Commits frecuentes.

---

### Task 1: Migración — tabla `barbero_pin` + funciones

**Files:**
- Create: `supabase/migrations/0015_pin_barbero.sql`

**Interfaces:**
- Produces (consumido por Task 2): RPCs `verificar_pin_barbero(p_barbero_id uuid, p_pin text) → text` (`'ok'|'bad'|'locked'`), `set_pin_barbero(p_barbero_id uuid, p_pin text) → void`, `desbloquear_barbero(p_barbero_id uuid) → void`; tabla `barbero_pin(barbero_id, pin_hash, intentos, bloqueado_hasta, actualizado_en)`.

> Contexto de ejecución: en este entorno NO hay DB en vivo. Tu entregable es **crear el archivo SQL** y **commitear**. Verificá por inspección (sintaxis, que los `grant`/`revoke` estén, que las funciones sean `security definer`). La aplicación en la DB la hace el humano después.

- [ ] **Step 1: Escribir `supabase/migrations/0015_pin_barbero.sql`**

```sql
-- 0015_pin_barbero.sql — Login del barbero por PIN de 6 dígitos (hasheado, con bloqueo).
create extension if not exists pgcrypto;

-- Tabla separada (NO en 'barberos', que es de lectura pública). RLS sin policies:
-- ni anon ni authenticated acceden; solo service_role / funciones SECURITY DEFINER.
create table if not exists public.barbero_pin (
  barbero_id       uuid primary key references public.barberos(id) on delete cascade,
  pin_hash         text not null,
  intentos         int not null default 0,
  bloqueado_hasta  timestamptz,
  actualizado_en   timestamptz not null default now()
);
alter table public.barbero_pin enable row level security;

-- Setear/rotar PIN. search_path incluye extensions para resolver crypt/gen_salt
-- esté pgcrypto en 'public' o 'extensions'.
create or replace function public.set_pin_barbero(p_barbero_id uuid, p_pin text)
  returns void language plpgsql security definer set search_path = public, extensions
as $$
begin
  insert into public.barbero_pin (barbero_id, pin_hash, intentos, bloqueado_hasta, actualizado_en)
  values (p_barbero_id, crypt(p_pin, gen_salt('bf')), 0, null, now())
  on conflict (barbero_id) do update
    set pin_hash = excluded.pin_hash, intentos = 0, bloqueado_hasta = null, actualizado_en = now();
end $$;
revoke all on function public.set_pin_barbero(uuid, text) from anon, authenticated, public;
grant execute on function public.set_pin_barbero(uuid, text) to service_role;

-- Verificar PIN con bloqueo por intentos (atómico con FOR UPDATE). Devuelve 'ok'|'bad'|'locked'.
create or replace function public.verificar_pin_barbero(p_barbero_id uuid, p_pin text)
  returns text language plpgsql security definer set search_path = public, extensions
as $$
declare
  r public.barbero_pin%rowtype;
begin
  select * into r from public.barbero_pin where barbero_id = p_barbero_id for update;
  if not found then
    return 'bad';  -- sin PIN configurado
  end if;
  if r.bloqueado_hasta is not null and r.bloqueado_hasta > now() then
    return 'locked';
  end if;
  if r.pin_hash = crypt(p_pin, r.pin_hash) then
    update public.barbero_pin set intentos = 0, bloqueado_hasta = null where barbero_id = p_barbero_id;
    return 'ok';
  else
    update public.barbero_pin
      set intentos = r.intentos + 1,
          bloqueado_hasta = case when r.intentos + 1 >= 5 then now() + interval '5 minutes' else bloqueado_hasta end
      where barbero_id = p_barbero_id;
    return case when r.intentos + 1 >= 5 then 'locked' else 'bad' end;
  end if;
end $$;
revoke all on function public.verificar_pin_barbero(uuid, text) from anon, authenticated, public;
grant execute on function public.verificar_pin_barbero(uuid, text) to service_role;

-- Desbloquear (admin).
create or replace function public.desbloquear_barbero(p_barbero_id uuid)
  returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.barbero_pin set intentos = 0, bloqueado_hasta = null where barbero_id = p_barbero_id;
end $$;
revoke all on function public.desbloquear_barbero(uuid) from anon, authenticated, public;
grant execute on function public.desbloquear_barbero(uuid) to service_role;
```

- [ ] **Step 2: Inspección (sin DB)**

Verificá leyendo el archivo: (a) `barbero_pin` tiene RLS habilitada y NINGUNA policy (service_role-only); (b) las 3 funciones son `security definer` con `search_path` fijo; (c) cada función hace `revoke ... from anon, authenticated, public` + `grant execute ... to service_role`; (d) `verificar_pin_barbero` usa `for update` y devuelve exactamente `'ok'|'bad'|'locked'`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0015_pin_barbero.sql
git commit -m "feat(pin): migración barbero_pin + funciones set/verificar/desbloquear"
```

---

### Task 2: Server actions — `src/lib/barbero-auth.ts`

**Files:**
- Create: `src/lib/barbero-auth.ts`

**Interfaces:**
- Consumes: RPCs de Task 1; `supabaseServerAuth`, `supabaseAdmin` (`@/lib/supabase/server`); `getStaffContext` (`@/lib/data/queries`).
- Produces (consumido por Tasks 3 y 4):
  - `loginBarberoPin(barberoId: string, pin: string): Promise<{ ok: boolean; error?: string }>`
  - `setearPinBarbero(barberoId: string, pin: string): Promise<{ ok: boolean; error?: string }>`
  - `desbloquearBarbero(barberoId: string): Promise<{ ok: boolean; error?: string }>`
  - `getBarberosPinEstado(): Promise<Record<string, { tienePin: boolean; bloqueado: boolean }>>`

- [ ] **Step 1: Crear `src/lib/barbero-auth.ts`**

```ts
"use server";

import { supabaseServerAuth, supabaseAdmin } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/data/queries";

const PINS_TRIVIALES = new Set([
  "000000", "111111", "222222", "333333", "444444", "555555", "666666",
  "777777", "888888", "999999", "123456", "654321", "012345", "121212",
]);

function esPinValido(pin: string): boolean {
  return /^\d{6}$/.test(pin) && !PINS_TRIVIALES.has(pin);
}

// Login del barbero por PIN. Verifica (con bloqueo) y mina la sesión real de Supabase.
export async function loginBarberoPin(
  barberoId: string,
  pin: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!/^\d{6}$/.test(pin)) return { ok: false, error: "El PIN son 6 dígitos." };

  const admin = supabaseAdmin();
  const { data: estado, error: vErr } = await admin.rpc("verificar_pin_barbero", {
    p_barbero_id: barberoId,
    p_pin: pin,
  });
  if (vErr) return { ok: false, error: "No se pudo verificar el PIN." };
  if (estado === "locked") return { ok: false, error: "Demasiados intentos. Esperá unos minutos." };
  if (estado !== "ok") return { ok: false, error: "PIN incorrecto." };

  // Resolver el email de auth del barbero y minar su sesión.
  const { data: prof } = await admin
    .from("profiles")
    .select("auth_id")
    .eq("barbero_id", barberoId)
    .eq("rol", "barbero")
    .maybeSingle();
  const authId = (prof as { auth_id?: string } | null)?.auth_id;
  if (!authId) return { ok: false, error: "Este barbero no tiene acceso configurado. Avisá al admin." };

  const { data: userData } = await admin.auth.admin.getUserById(authId);
  const email = userData?.user?.email;
  if (!email) return { ok: false, error: "Este barbero no tiene acceso configurado. Avisá al admin." };

  const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = (link as { properties?: { hashed_token?: string } } | null)?.properties?.hashed_token;
  if (lErr || !tokenHash) return { ok: false, error: "No se pudo iniciar sesión. Intentá de nuevo." };

  const sb = await supabaseServerAuth();
  const { error: oErr } = await sb.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (oErr) return { ok: false, error: "No se pudo iniciar sesión. Intentá de nuevo." };

  return { ok: true };
}

async function esAdmin(): Promise<boolean> {
  const staff = await getStaffContext();
  return staff.rol === "admin";
}

export async function setearPinBarbero(
  barberoId: string,
  pin: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await esAdmin())) return { ok: false, error: "Requiere permiso de administrador" };
  if (!esPinValido(pin)) return { ok: false, error: "PIN inválido (6 dígitos, no triviales como 123456 o 000000)." };
  const admin = supabaseAdmin();
  const { error } = await admin.rpc("set_pin_barbero", { p_barbero_id: barberoId, p_pin: pin });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function desbloquearBarbero(barberoId: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await esAdmin())) return { ok: false, error: "Requiere permiso de administrador" };
  const admin = supabaseAdmin();
  const { error } = await admin.rpc("desbloquear_barbero", { p_barbero_id: barberoId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Estado de PIN por barbero (para la pantalla admin).
export async function getBarberosPinEstado(): Promise<Record<string, { tienePin: boolean; bloqueado: boolean }>> {
  if (!(await esAdmin())) return {};
  const admin = supabaseAdmin();
  const { data } = await admin.from("barbero_pin").select("barbero_id,pin_hash,bloqueado_hasta");
  const now = Date.now();
  const out: Record<string, { tienePin: boolean; bloqueado: boolean }> = {};
  for (const r of (data ?? []) as { barbero_id: string; pin_hash: string; bloqueado_hasta: string | null }[]) {
    out[r.barbero_id] = {
      tienePin: !!r.pin_hash,
      bloqueado: !!r.bloqueado_hasta && new Date(r.bloqueado_hasta).getTime() > now,
    };
  }
  return out;
}
```

- [ ] **Step 2: Verificar tipos y build**

Run: `npx tsc --noEmit` → sin errores.
Run: `npm run build` → build OK.

> Nota: `verifyOtp({ type: "magiclink", token_hash })` sobre un `hashed_token` de `generateLink` es el patrón de "login programático" de Supabase. Si al probar en runtime (tras aplicar la migración) el `type` diera error con `@supabase/supabase-js` ^2.106.1, probar `type: "email"` — la firma acepta ambos `EmailOtpType`. Esto NO bloquea el build (tsc acepta ambos literales).

- [ ] **Step 3: Commit**

```bash
git add src/lib/barbero-auth.ts
git commit -m "feat(pin): server actions login/setear/desbloquear + estado de PIN"
```

---

### Task 3: UI de login por PIN — `/entrar`

**Files:**
- Create: `src/app/entrar/page.tsx`
- Create: `src/components/barbero/BarberoPinLogin.tsx`

**Interfaces:**
- Consumes: `getBarberos`, `getSedes` (`@/lib/data/queries`); `loginBarberoPin` (`@/lib/barbero-auth`); tipos `Barbero`, `Sede` (`@/lib/data/types`).

- [ ] **Step 1: Crear `src/app/entrar/page.tsx`**

```tsx
import type { Metadata } from "next";
import { getBarberos, getSedes } from "@/lib/data/queries";
import { BarberoPinLogin } from "@/components/barbero/BarberoPinLogin";

export const metadata: Metadata = { title: "Entrar · Barbas & Bigotes" };

export default async function EntrarPage() {
  const [barberos, sedes] = await Promise.all([getBarberos(), getSedes()]);
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-10">
      <BarberoPinLogin barberos={barberos} sedes={sedes} />
    </main>
  );
}
```

- [ ] **Step 2: Crear `src/components/barbero/BarberoPinLogin.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { loginBarberoPin } from "@/lib/barbero-auth";
import type { Barbero, Sede } from "@/lib/data/types";

export function BarberoPinLogin({ barberos, sedes }: { barberos: Barbero[]; sedes: Sede[] }) {
  const router = useRouter();
  const [barbero, setBarbero] = useState<Barbero | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(nuevoPin: string) {
    if (!barbero) return;
    setBusy(true);
    setErr(null);
    const res = await loginBarberoPin(barbero.id, nuevoPin);
    setBusy(false);
    if (res.ok) {
      router.push("/barbero");
      router.refresh();
    } else {
      setErr(res.error ?? "No se pudo entrar");
      setPin("");
    }
  }

  function tecla(d: string) {
    if (busy || pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    setErr(null);
    if (next.length === 6) submit(next);
  }

  if (!barbero) {
    return (
      <div className="w-full max-w-md">
        <div className="text-center text-[10px] uppercase tracking-[0.3em] text-accent">App del barbero</div>
        <h1 className="mt-2 text-center font-display text-3xl font-semibold uppercase">¿Quién sos?</h1>
        {sedes.map((s) => {
          const list = barberos.filter((b) => b.sede === s.id);
          if (!list.length) return null;
          return (
            <div key={s.id} className="mt-6">
              <div className="mb-2 text-xs uppercase tracking-[0.2em] text-muted">{s.nombre}</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {list.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => { setBarbero(b); setPin(""); setErr(null); }}
                    className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-panel p-4 transition hover:border-accent/50"
                  >
                    <span className="relative h-16 w-16 overflow-hidden rounded-full border border-line bg-bg">
                      {b.fotoUrl ? (
                        <Image src={b.fotoUrl} alt={b.nombre} fill className="object-cover" sizes="64px" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center font-display text-2xl text-muted">
                          {b.nombre.charAt(0)}
                        </span>
                      )}
                    </span>
                    <span className="text-sm font-semibold">{b.nombre}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <Link href="/login" className="mt-8 block text-center text-xs text-muted transition hover:text-ink">
          Soy admin (entrar con contraseña) →
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xs text-center">
      <button onClick={() => { setBarbero(null); setPin(""); setErr(null); }} className="text-xs text-muted transition hover:text-ink">
        ← Cambiar barbero
      </button>
      <h1 className="mt-3 font-display text-2xl font-semibold">Hola, {barbero.nombre}</h1>
      <p className="mt-1 text-sm text-muted">Ingresá tu PIN de 6 dígitos</p>

      <div className="mt-6 flex justify-center gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className={`h-3 w-3 rounded-full border ${i < pin.length ? "border-accent bg-accent" : "border-line"}`} />
        ))}
      </div>
      {err && <div className="mt-4 text-sm text-accent-soft">{err}</div>}

      <div className="mt-6 grid grid-cols-3 gap-3">
        {["1","2","3","4","5","6","7","8","9"].map((d) => (
          <button key={d} onClick={() => tecla(d)} disabled={busy}
            className="rounded-xl border border-line bg-panel py-4 font-display text-2xl transition hover:border-accent/50 disabled:opacity-50">
            {d}
          </button>
        ))}
        <span />
        <button onClick={() => tecla("0")} disabled={busy}
          className="rounded-xl border border-line bg-panel py-4 font-display text-2xl transition hover:border-accent/50 disabled:opacity-50">
          0
        </button>
        <button onClick={() => { if (!busy) { setPin(pin.slice(0, -1)); setErr(null); } }} disabled={busy}
          className="rounded-xl border border-line py-4 text-sm text-muted transition hover:text-ink disabled:opacity-50">
          ←
        </button>
      </div>
      {busy && <div className="mt-4 text-sm text-muted">Entrando…</div>}
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos y build**

Run: `npx tsc --noEmit` → sin errores.
Run: `npm run build` → build OK.
(El recorrido real en navegador queda para después de aplicar la migración + setear un PIN — es un paso gated en el humano.)

- [ ] **Step 4: Commit**

```bash
git add src/app/entrar/page.tsx src/components/barbero/BarberoPinLogin.tsx
git commit -m "feat(pin): pantalla /entrar con lista de barberos + PIN pad"
```

---

### Task 4: UI admin — `/admin/equipo` (setear/rotar/desbloquear PIN)

**Files:**
- Create: `src/app/admin/equipo/page.tsx`
- Create: `src/components/admin/EquipoPinAdmin.tsx`
- Modify: `src/components/admin/AdminNav.tsx` (agregar link a `/admin/equipo`)

**Interfaces:**
- Consumes: `getBarberos`, `getSedes` (`@/lib/data/queries`); `getBarberosPinEstado`, `setearPinBarbero`, `desbloquearBarbero` (`@/lib/barbero-auth`); `SectionHeader` (`@/components/admin/SectionHeader`).

- [ ] **Step 1: Crear `src/app/admin/equipo/page.tsx`**

El layout `/admin` ya exige rol admin, así que la página no re-chequea.
```tsx
import type { Metadata } from "next";
import { getBarberos, getSedes } from "@/lib/data/queries";
import { getBarberosPinEstado } from "@/lib/barbero-auth";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { EquipoPinAdmin } from "@/components/admin/EquipoPinAdmin";

export const metadata: Metadata = { title: "Equipo · Admin" };

export default async function EquipoPage() {
  const [barberos, sedes, estado] = await Promise.all([getBarberos(), getSedes(), getBarberosPinEstado()]);
  return (
    <div className="max-w-3xl">
      <SectionHeader
        eyebrow="Acceso"
        title="Equipo"
        description="Asigná el PIN de 6 dígitos con el que cada barbero entra a su app desde /entrar."
      />
      <div className="mt-5">
        <EquipoPinAdmin barberos={barberos} sedes={sedes} estado={estado} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Crear `src/components/admin/EquipoPinAdmin.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setearPinBarbero, desbloquearBarbero } from "@/lib/barbero-auth";
import type { Barbero, Sede } from "@/lib/data/types";

type Estado = Record<string, { tienePin: boolean; bloqueado: boolean }>;

export function EquipoPinAdmin({ barberos, sedes, estado }: { barberos: Barbero[]; sedes: Sede[]; estado: Estado }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  async function guardar(barberoId: string) {
    setBusy(true);
    setMsg(null);
    const res = await setearPinBarbero(barberoId, pin);
    setBusy(false);
    if (res.ok) {
      setEditing(null);
      setPin("");
      setMsg({ id: barberoId, text: "PIN guardado", ok: true });
      router.refresh();
    } else {
      setMsg({ id: barberoId, text: res.error ?? "Error", ok: false });
    }
  }

  async function desbloquear(barberoId: string) {
    setBusy(true);
    setMsg(null);
    const res = await desbloquearBarbero(barberoId);
    setBusy(false);
    setMsg({ id: barberoId, text: res.ok ? "Desbloqueado" : res.error ?? "Error", ok: res.ok });
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-6">
      {sedes.map((s) => {
        const list = barberos.filter((b) => b.sede === s.id);
        if (!list.length) return null;
        return (
          <section key={s.id}>
            <h2 className="mb-3 text-xs uppercase tracking-[0.3em] text-accent">{s.nombre}</h2>
            <div className="space-y-2">
              {list.map((b) => {
                const e = estado[b.id];
                return (
                  <div key={b.id} className="rounded-xl border border-line bg-panel p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{b.nombre}</div>
                        <div className="text-xs text-muted">
                          {e?.tienePin ? "PIN configurado" : "Sin PIN"}
                          {e?.bloqueado ? " · 🔒 bloqueado" : ""}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {e?.bloqueado && (
                          <button onClick={() => desbloquear(b.id)} disabled={busy}
                            className="rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:text-ink disabled:opacity-50">
                            Desbloquear
                          </button>
                        )}
                        <button onClick={() => { setEditing(editing === b.id ? null : b.id); setPin(""); setMsg(null); }}
                          className="rounded-full bg-accent px-4 py-1.5 text-xs font-semibold uppercase text-on-accent transition hover:bg-accent-soft">
                          {e?.tienePin ? "Cambiar PIN" : "Setear PIN"}
                        </button>
                      </div>
                    </div>
                    {editing === b.id && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          value={pin}
                          onChange={(ev) => setPin(ev.target.value.replace(/\D/g, "").slice(0, 6))}
                          inputMode="numeric"
                          placeholder="6 dígitos"
                          className="w-32 rounded-lg border border-line bg-bg px-3 py-2 text-center tracking-[0.3em] text-ink placeholder:text-muted placeholder:tracking-normal focus:border-accent focus:outline-none"
                        />
                        <button onClick={() => guardar(b.id)} disabled={busy || pin.length !== 6}
                          className="rounded-full bg-accent px-4 py-2 text-xs font-semibold uppercase text-on-accent transition hover:bg-accent-soft disabled:opacity-50">
                          {busy ? "…" : "Guardar"}
                        </button>
                        <button onClick={() => { setEditing(null); setPin(""); }} className="text-xs text-muted transition hover:text-ink">
                          Cancelar
                        </button>
                      </div>
                    )}
                    {msg?.id === b.id && (
                      <div className={`mt-2 text-xs ${msg.ok ? "text-emerald-400" : "text-accent-soft"}`}>{msg.text}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Agregar link en `AdminNav.tsx`**

Leé `src/components/admin/AdminNav.tsx` y agregá una entrada nueva siguiendo el mismo patrón que las existentes (mismo componente de link/estilo), con:
- **href:** `/admin/equipo`
- **label:** `Equipo`

Ubicala junto a las demás secciones del panel (p.ej. después de "Inventario" o "Cupones").

- [ ] **Step 4: Verificar tipos y build**

Run: `npx tsc --noEmit` → sin errores.
Run: `npm run build` → build OK.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/equipo/page.tsx src/components/admin/EquipoPinAdmin.tsx src/components/admin/AdminNav.tsx
git commit -m "feat(pin): pantalla admin /admin/equipo para setear/rotar/desbloquear PIN"
```

---

## Verificación end-to-end (gated en el humano, tras aplicar la migración)
1. Aplicar `supabase/migrations/0015_pin_barbero.sql` en el SQL Editor de Supabase.
2. En `/admin/equipo` (logueado como admin), setear un PIN a un barbero.
3. En `/entrar`, elegir ese barbero, teclear el PIN → debe entrar a `/barbero` con su sesión (ve solo su agenda por RLS).
4. PIN incorrecto 5 veces → "Demasiados intentos"; el admin lo desbloquea desde `/admin/equipo`.
5. PIN trivial (123456) al setear → rechazado.

## Notas / límites conocidos
- El minado de sesión (`generateLink`+`verifyOtp`) es la parte a confirmar en runtime; si el `type` diera problema, ver la nota de Task 2.
- Cada barbero debe tener una cuenta Supabase con `profiles.barbero_id` + `rol='barbero'` y un email; si no, el login por PIN devuelve "sin acceso configurado" (lo resuelve el admin creando/enlazando la cuenta).

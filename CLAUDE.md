# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

**Next.js 16.2.6 — breaking changes.** Per AGENTS.md, this is not the Next.js in your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing App Router / server-action / caching code. Note the build uses the **`--webpack`** flag (not Turbopack).

## Commands

```bash
npm run dev      # next dev --webpack  (port 3100 per env)
npm run build    # next build --webpack
npm run lint     # eslint
npx tsc --noEmit # typecheck (CI gate; run before committing)
```

There is no test runner — verification is `tsc --noEmit` + `npm run build` + manual/browser walkthrough. CI (`.github/workflows/ci.yml`) runs `npm install` (**not `npm ci`** — the Windows-generated lockfile omits cross-platform optionals `npm ci` rejects on Linux) → `tsc --noEmit` → `lint` → `build`.

## Deploy

Push to `main` → Vercel deploys **production** automatically (Git integration; do **not** `vercel --prod` by hand). PRs get preview deploys. Live at `https://barbasybigotes.com` (+ the `.vercel.app`). Env vars (3 Supabase keys) live in Vercel and as GitHub Actions secrets; source of truth is `.env.local` (gitignored).

## Architecture

Spanish-language barbershop app (Barranquilla, Colombia): public marketing site + booking wizard, a client portal, a barber agenda, and an admin back-office. Next.js App Router + Supabase (Postgres/Auth/RLS/Edge Functions) + Tailwind 4 + Three.js/GSAP for the hero.

### Supabase access — three clients, pick by trust level (`src/lib/supabase/server.ts`)

- `supabaseServer()` — anon key, no session. Public catalog reads (sedes, servicios, barberos).
- `supabaseServerAuth()` — session via cookies (`@supabase/ssr`). Authenticated reads/writes; **RLS applies**. Use for anything acting as the logged-in user.
- `supabaseAdmin()` — **service_role, bypasses RLS**. Server-only. Used for public-origin writes with no session (booking from the site) and trusted admin operations. Never expose to the client; never use to dodge an authz check that RLS should enforce.

`src/lib/supabase/client.ts` is the browser client (auth session + realtime).

### Security model (migrations `0008`, `0010`, `0013`)

RLS is the real barrier; server actions re-check the role as defense-in-depth (a server action is a directly-invokable POST endpoint — see `requireAdmin`/`requireStaff` in `src/lib/actions.ts`). Key SQL helpers: `is_admin()`, `is_staff()`, `current_barbero_id()`, `current_cliente_id()`. Controlled RLS bypasses are `SECURITY DEFINER` functions with `search_path = ''` and schema-qualified calls (`extensions.crypt`, `public.<table>`) — follow this convention for any new definer function (avoids search_path injection). Public booking uses `supabaseAdmin()` and bypasses all RLS by design.

### Server actions (the write layer)

Mutations live in `src/lib/*-actions.ts`, not in route handlers:
- `actions.ts` — admin/staff: cobro, cupones, caja, inventario (`decrement_stock`, `bump_cupon_uso` RPCs).
- `cliente-actions.ts` — client portal: cancel/reschedule own reservation. Cancel/reschedule enforce a **2-hour minimum window** (`CANCELACION_MIN_HORAS` in `slots.ts`); within the window the UI falls back to WhatsApp.
- `barbero-auth.ts` — 6-digit PIN login for barbers (see below).
- `ai-actions.ts` — AI-assisted flows.

### Booking / slots (`src/lib/slots.ts`)

Plain module (no `"use client"`/`"use server"`) shared by the public wizard (`components/BookingWizard.tsx`) and the portal reschedule modal (`components/cuenta/CitaAcciones.tsx`). Business-rule constants live here: `OPEN` 9:00, `CLOSE` 20:00, `STEP` 30min, `CANCELACION_MIN_HORAS`. Import slot math from here — do not re-derive hours. DB guards double-booking via a `reservas_no_overlap` EXCLUDE/GiST constraint.

### Route groups (`src/app`)

- `/` , `/nosotros`, `/barberos` — public marketing (Hero uses Three.js + GSAP; 3D lives in `components/home`).
- `/reservar` — public booking wizard (service_role writes).
- `/cuenta` — client portal (Google OAuth login; web-push via `PushManager`).
- `/barbero` — barber agenda (realtime refresh on reservas).
- `/entrar` — barber PIN login gateway (`force-dynamic` — the barber list must be fresh).
- `/admin/*` — back-office (clientes/CRM, inventario, comisiones, cuadre de caja, cupones, precios, equipo/PIN). `/admin/equipo` sets/rotates/unblocks barber PINs.

### Barber PIN login (migration `0015`, `barbero-auth.ts`, branch `spec/pin-barbero`)

Per-barber 6-digit PIN in `barbero_pin` (RLS deny-all + `revoke all … from anon, authenticated`). bcrypt via pgcrypto (`extensions.crypt` / `gen_salt('bf',10)`). `verificar_pin_barbero` locks 5min after 5 bad attempts. Login mints a real Supabase session via `admin.generateLink({type:'magiclink'})` → `verifyOtp` (so RLS stays intact), then **asserts `user.id === authId`** before trusting it. The PIN hash is never sent to the client.

### Migrations (`supabase/migrations`)

Applied **manually by the user** in the Supabase SQL Editor — Claude cannot run prod DDL. Numbered `0001`–`0039`; note there are **two `0002_*`** files (`live_sync` and `push_subscriptions`). Demo seed: `supabase/seed/demo.sql` (idempotent, rows tagged `origen='demo'`). Email/push avisos (recordatorio, cupo libre, confirmación) run through Supabase views + n8n, which hit the `src/lib/push.ts` web-push emitter via `POST /api/push` — there is **no** Edge Function (`supabase/functions/` no longer exists).

## Conventions

- Code, comments, UI copy, and commit messages are in **Spanish** — match the surrounding style.
- Data-access reads are centralized in `src/lib/data/queries.ts` (snake_case DB → camelCase domain types in `data/types.ts`). Add new reads there rather than querying Supabase inline in components.

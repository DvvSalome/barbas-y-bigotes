# Spec 3 — Login del barbero con PIN de 6 dígitos

**Fecha:** 2026-07-03
**Estado:** Diseño aprobado, pendiente de revisión del spec escrito
**Alcance:** Login rápido para barberos con PIN de 6 dígitos (con bloqueo por intentos), sin romper el modelo de seguridad actual. El login email+contraseña de `/login` queda intacto.

## Contexto
El staff entra hoy en `/login` con **email + contraseña** (`supabase.auth.signInWithPassword`, ver `src/app/login/page.tsx`). Toda la RLS de la app (`is_staff()`, `current_barbero_id()`, scoping por barbero) depende de una **sesión real de Supabase Auth**. Por eso el PIN **no** puede ser un login paralelo: debe terminar creando la sesión de Supabase del barbero. Cada barbero ya tiene una cuenta Supabase enlazada vía `profiles` (`profiles.barbero_id = barberos.id`, `rol='barbero'`, `auth_id`).

## Arquitectura (PIN → verificación → sesión de Supabase)
El PIN se guarda **hasheado** (bcrypt vía `pgcrypto`), aparte de la contraseña de la cuenta. Al ingresarlo:
1. El servidor verifica el PIN (hash) y aplica el bloqueo por intentos.
2. En éxito, **mina la sesión real de Supabase** del barbero con `auth.admin.generateLink({ type:'magiclink' })` + `verifyOtp(token_hash)` — **sin** enviar ningún email; todo server-side. El barbero queda logueado en su cuenta → RLS intacta.

Descartados: (B) usar el PIN como contraseña de la cuenta (débil, sin control propio del bloqueo); (C) sesión propia por fuera de Supabase (rompe `auth.uid()` → rompe RLS).

## Modelo de datos (migración nueva)
Tabla **separada** `barbero_pin` (NO en `barberos`, que es de lectura pública — el hash nunca debe exponerse):
```
barbero_pin (
  barbero_id        uuid primary key references barberos(id) on delete cascade,
  pin_hash          text not null,
  intentos          int not null default 0,
  bloqueado_hasta   timestamptz,
  actualizado_en    timestamptz not null default now()
)
```
RLS habilitada **sin policies** para anon/authenticated → solo service_role / funciones SECURITY DEFINER la tocan. Requiere `create extension if not exists pgcrypto`.

## Funciones DB (SECURITY DEFINER, el PIN plano vive solo adentro)
- `set_pin_barbero(p_barbero_id uuid, p_pin text)` → upsert `pin_hash = crypt(p_pin, gen_salt('bf'))`, resetea intentos/bloqueo. Grant execute a service_role.
- `verificar_pin_barbero(p_barbero_id uuid, p_pin text) returns text` → atómica (con row lock): si `bloqueado_hasta > now` devuelve `'locked'`; si `crypt(p_pin, pin_hash) = pin_hash` resetea intentos y devuelve `'ok'`; si no, `intentos++`, y a los **5** setea `bloqueado_hasta = now + interval '5 minutes'`, devuelve `'bad'` (o `'locked'` si ese intento gatilló el bloqueo). Grant execute a service_role.
- Constante de negocio (en la función): `MAX_INTENTOS = 5`, `BLOQUEO = 5 min`.

## Flujo de login (`/barbero/login`)
1. Pantalla: **lista de barberos por sede** (nombre + foto, `getBarberos`). El barbero toca el suyo.
2. **PIN pad** de 6 dígitos (teclado numérico propio, `inputMode` numérico; no expone el PIN en un `<input type=text>`).
3. Server action `loginBarberoPin(barberoId: string, pin: string)` en un archivo nuevo `src/lib/barbero-auth.ts` (auth del barbero, separado de las acciones de negocio). **Debe ser server action** (no server component) para poder setear las cookies de sesión con `verifyOtp`:
   - Llama `verificar_pin_barbero` vía `supabaseAdmin()`.
   - `'locked'` → `{ ok:false, error:"Demasiados intentos. Esperá unos minutos." }`.
   - `'bad'` → `{ ok:false, error:"PIN incorrecto." }`.
   - `'ok'` → resuelve el **email de auth** del barbero: `profiles` where `barbero_id = X` → `auth_id` → `supabaseAdmin().auth.admin.getUserById(auth_id)` → email. Luego `admin.generateLink({ type:'magiclink', email })` → `properties.hashed_token` → en el cliente SSR (`supabaseServerAuth`) `verifyOtp({ type:'magiclink', token_hash })` (setea cookies de sesión) → `{ ok:true }`. El componente redirige a `/barbero`.
   - Si el barbero no tiene cuenta/perfil enlazado → `{ ok:false, error:"Este barbero no tiene acceso configurado. Avisá al admin." }`.

## Pantalla admin (setear/rotar/desbloquear)
Nueva sección en `/admin` (p.ej. `/admin/equipo`): por cada barbero, **"Setear PIN"** (input de 6 dígitos → `setearPinBarbero(barberoId, pin)` → `set_pin_barbero`) y **"Desbloquear"** (resetea intentos/bloqueo). Server actions con `requireAdmin`. Muestra si el barbero tiene PIN configurado y si está bloqueado.

## Qué NO cambia
- `/login` (email+contraseña) **permanece** — lo usa el admin y es fallback para barberos.
- La RLS, `getStaffContext`, y el resto del auth quedan igual (el PIN solo produce una sesión Supabase estándar).

## Seguridad / bordes
- PIN **hasheado** (bcrypt), nunca en texto ni en logs. El hash vive en tabla service_role-only (no en `barberos`, que es público).
- **Bloqueo:** 5 intentos → 5 min (constante tuneable en la función DB).
- **PINs triviales:** `set_pin_barbero` rechaza `000000`, `123456`, `111111`, `654321` y repetidos (validación en la action antes de guardar).
- La lista de barberos revela nombres (ya públicos); el secreto es el PIN.
- El `generateLink`+`verifyOtp` corre solo tras verificar el PIN; nunca se expone el link ni el token al cliente más allá de setear la sesión.

## Fuera de alcance
- Cambiar el login del **admin** a PIN (sigue con email+contraseña).
- PIN para clientes (el portal cliente sigue con Google).
- 2FA / biométrico.
- Resetear las contraseñas existentes (eso lo hace el admin en el dashboard de Supabase).

## Decomposición (para el plan)
1. Migración: `pgcrypto` + tabla `barbero_pin` + funciones `set_pin_barbero` / `verificar_pin_barbero`.
2. Server actions: `loginBarberoPin` (verificar + minar sesión), `setearPinBarbero`, `desbloquearBarbero`.
3. UI `/barbero/login`: lista de barberos + PIN pad.
4. UI admin `/admin/equipo`: setear/rotar/desbloquear PIN.

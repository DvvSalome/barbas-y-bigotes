-- 0044 — Perfil de sede: columna, helper, PIN y RLS por sede.
-- ADITIVA A PROPÓSITO: los 6 logins de barbero SIGUEN funcionando después de
-- aplicarla (las policies aceptan barbero O sede). Así no hay ventana en la que
-- el local se quede sin poder entrar. Los logins viejos se retiran en una
-- migración posterior, recién cuando los 2 PINes de sede estén probados.

-- ── 1. A qué sede pertenece el perfil ──────────────────────────────────
alter table public.profiles
  add column if not exists sede_id text references public.sedes(id);
create index if not exists idx_profiles_sede_id on public.profiles (sede_id);

-- Un perfil de sede DEBE tener sede; uno de barbero, barbero. Se valida acá y no
-- solo en el código: es la clase de invariante que la app olvida en un refactor.
alter table public.profiles drop constraint if exists profiles_rol_coherente;
alter table public.profiles add constraint profiles_rol_coherente check (
  (rol = 'sede' and sede_id is not null)
  or (rol = 'barbero' and barbero_id is not null)
  or rol in ('admin', 'cliente')
);

-- ── 2. Helper: la sede del que está logueado ───────────────────────────
-- Mismo patrón que current_barbero_id (SECURITY DEFINER + search_path vacío +
-- llamadas calificadas), para no exponer profiles vía RLS.
create or replace function public.current_sede_id()
  returns text language sql stable security definer set search_path = '' as $$
  select sede_id from public.profiles where auth_id = auth.uid();
$$;
revoke all on function public.current_sede_id() from public, anon;
grant execute on function public.current_sede_id() to authenticated, service_role;

-- ── 3. is_staff ahora incluye al administrador de sede ─────────────────
create or replace function public.is_staff()
  returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where auth_id = auth.uid() and rol in ('admin', 'barbero', 'sede')
  );
$$;

-- ── 4. RLS: el perfil de sede ve y opera SU sede ───────────────────────
-- Se conserva la rama de barbero (transición sin bloqueo) y se suma la de sede.
drop policy if exists staff_reservas on public.reservas;
create policy staff_reservas on public.reservas for all to authenticated
  using (public.is_admin() or barbero_id = public.current_barbero_id() or sede_id = public.current_sede_id())
  with check (public.is_admin() or barbero_id = public.current_barbero_id() or sede_id = public.current_sede_id());

drop policy if exists staff_ventas on public.ventas;
create policy staff_ventas on public.ventas for all to authenticated
  using (public.is_admin() or barbero_id = public.current_barbero_id() or sede_id = public.current_sede_id())
  with check (public.is_admin() or barbero_id = public.current_barbero_id() or sede_id = public.current_sede_id());

-- El cliente es visible para quien lo atendió (barbero) o para la sede donde
-- tuvo cita o compra. Sin esto, el mostrador de sede no vería a sus clientes.
drop policy if exists clientes_barbero_select on public.clientes;
create policy clientes_barbero_select on public.clientes for select to authenticated
  using (
    exists (select 1 from public.reservas r
            where r.cliente_ref = clientes.id
              and (r.barbero_id = public.current_barbero_id() or r.sede_id = public.current_sede_id()))
    or exists (select 1 from public.ventas v
               where v.cliente_ref = clientes.id
                 and (v.barbero_id = public.current_barbero_id() or v.sede_id = public.current_sede_id()))
  );

-- ── 5. PIN por sede ────────────────────────────────────────────────────
-- Misma forma que barbero_pin (0015): deny-all + bcrypt vía pgcrypto, y el hash
-- jamás sale de la base. Se accede solo por la función definer de abajo.
create table if not exists public.sede_pin (
  sede_id text primary key references public.sedes(id) on delete cascade,
  pin_hash text not null,
  intentos int not null default 0,
  bloqueado_hasta timestamptz,
  actualizado_en timestamptz not null default now()
);
alter table public.sede_pin enable row level security;
revoke all on public.sede_pin from anon, authenticated;

-- Verifica el PIN de una sede. Mismo contrato que verificar_pin_barbero:
-- 'ok' | 'malo' | 'bloqueado' | 'sin_pin'. Bloquea 5 min tras 5 intentos.
create or replace function public.verificar_pin_sede(p_sede_id text, p_pin text)
  returns text language plpgsql security definer set search_path = '' as $$
declare r public.sede_pin%rowtype;
begin
  select * into r from public.sede_pin where sede_id = p_sede_id;
  if not found then return 'sin_pin'; end if;
  if r.bloqueado_hasta is not null and r.bloqueado_hasta > now() then return 'bloqueado'; end if;
  if r.pin_hash = extensions.crypt(p_pin, r.pin_hash) then
    update public.sede_pin set intentos = 0, bloqueado_hasta = null where sede_id = p_sede_id;
    return 'ok';
  end if;
  update public.sede_pin
    set intentos = r.intentos + 1,
        bloqueado_hasta = case when r.intentos + 1 >= 5 then now() + interval '5 minutes' else null end
    where sede_id = p_sede_id;
  return case when r.intentos + 1 >= 5 then 'bloqueado' else 'malo' end;
end $$;
revoke all on function public.verificar_pin_sede(text, text) from public, anon, authenticated;
grant execute on function public.verificar_pin_sede(text, text) to service_role;

-- Fija o rota el PIN de una sede (lo llama el admin desde /admin/equipo).
create or replace function public.setear_pin_sede(p_sede_id text, p_pin text)
  returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.sede_pin (sede_id, pin_hash, intentos, bloqueado_hasta, actualizado_en)
  values (p_sede_id, extensions.crypt(p_pin, extensions.gen_salt('bf', 10)), 0, null, now())
  on conflict (sede_id) do update
    set pin_hash = excluded.pin_hash, intentos = 0, bloqueado_hasta = null, actualizado_en = now();
end $$;
revoke all on function public.setear_pin_sede(text, text) from public, anon, authenticated;
grant execute on function public.setear_pin_sede(text, text) to service_role;

-- ── 6. Atribución de la plata a una persona ────────────────────────────
-- Con un login por sede se perdería quién cerró la caja o registró un gasto (hoy
-- se sabía por el PIN de cada barbero). El mostrador va a preguntarlo con un
-- toque sobre la foto; acá queda dónde guardarlo.
alter table public.caja_sesiones
  add column if not exists cerrada_por_barbero uuid references public.barberos(id),
  add column if not exists abierta_por_barbero uuid references public.barberos(id);
create index if not exists idx_caja_sesiones_cerrada_por_barbero on public.caja_sesiones (cerrada_por_barbero);
alter table public.gastos
  add column if not exists registrado_por_barbero uuid references public.barberos(id);
create index if not exists idx_gastos_registrado_por_barbero on public.gastos (registrado_por_barbero);

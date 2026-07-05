-- 0015_pin_barbero.sql — Login del barbero por PIN de 6 dígitos (hasheado, con bloqueo).
-- pgcrypto en el schema 'extensions' (convención Supabase) para calificar crypt/gen_salt y
-- usar search_path='' en las funciones DEFINER (blindaje contra search_path injection).
create extension if not exists pgcrypto with schema extensions;

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

-- Setear/rotar PIN.
create or replace function public.set_pin_barbero(p_barbero_id uuid, p_pin text)
  returns void language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.barbero_pin (barbero_id, pin_hash, intentos, bloqueado_hasta, actualizado_en)
  values (p_barbero_id, extensions.crypt(p_pin, extensions.gen_salt('bf')), 0, null, now())
  on conflict (barbero_id) do update
    set pin_hash = excluded.pin_hash, intentos = 0, bloqueado_hasta = null, actualizado_en = now();
end $$;
revoke all on function public.set_pin_barbero(uuid, text) from anon, authenticated, public;
grant execute on function public.set_pin_barbero(uuid, text) to service_role;

-- Verificar PIN con bloqueo por intentos (atómico con FOR UPDATE). Devuelve 'ok'|'bad'|'locked'.
create or replace function public.verificar_pin_barbero(p_barbero_id uuid, p_pin text)
  returns text language plpgsql security definer set search_path = ''
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
  if r.pin_hash = extensions.crypt(p_pin, r.pin_hash) then
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
  returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.barbero_pin set intentos = 0, bloqueado_hasta = null where barbero_id = p_barbero_id;
end $$;
revoke all on function public.desbloquear_barbero(uuid) from anon, authenticated, public;
grant execute on function public.desbloquear_barbero(uuid) to service_role;

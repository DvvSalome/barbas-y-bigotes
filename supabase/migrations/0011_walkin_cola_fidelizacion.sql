-- 0011 — Fase 2: walk-in → cola + cliente con perfil walk-in + opción de fidelización.
-- Todo aditivo (IF NOT EXISTS / defaults), no cambia comportamiento existente.

-- Perfil del cliente + enrolamiento en fidelidad.
alter table public.clientes add column if not exists origen     text    default 'registrado'; -- 'app' | 'walkin' | 'registrado'
alter table public.clientes add column if not exists fidelizado boolean default true;

-- La entrada de cola puede apuntar a su cliente (el walk-in encolado ya es un cliente).
alter table public.lista_espera add column if not exists cliente_ref uuid references public.clientes(id);

-- upsert_cliente ahora setea origen + fidelizado al CREAR (no pisa los de un cliente existente).
drop function if exists public.upsert_cliente(text, text, text);
create or replace function public.upsert_cliente(
  p_nombre text,
  p_telefono text,
  p_email text,
  p_origen text default 'registrado',
  p_fidelizado boolean default true
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_tel  text := nullif(trim(p_telefono), '');
  v_mail text := nullif(trim(p_email), '');
begin
  if v_tel is not null then
    select id into v_id from public.clientes where telefono = v_tel limit 1;
    if v_id is not null then
      if v_mail is not null then
        update public.clientes set email = coalesce(email, v_mail) where id = v_id;
      end if;
      return v_id;
    end if;
  end if;
  insert into public.clientes (nombre, telefono, email, origen, fidelizado)
    values (coalesce(nullif(trim(p_nombre), ''), 'Cliente'), v_tel, v_mail,
            coalesce(p_origen, 'registrado'), coalesce(p_fidelizado, true))
    returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.upsert_cliente(text, text, text, text, boolean) from anon, public;
grant execute on function public.upsert_cliente(text, text, text, text, boolean) to authenticated, service_role;

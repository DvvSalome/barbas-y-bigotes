-- 0025_dedup_cliente_por_correo.sql — Barbas & Bigotes
-- El wizard de reserva v2 ya no pide teléfono (solo correo), pero upsert_cliente
-- de-duplicaba SOLO por teléfono (0011): sin teléfono, cada reserva anónima creaba
-- un cliente duplicado y los puntos/historial nunca se consolidaban.
-- Fix: si no hay teléfono, de-duplicar por correo (case-insensitive). El teléfono
-- sigue teniendo prioridad cuando viene (walk-ins del barbero).
-- NO ejecutar acá: se versiona el .sql y lo aplica el proceso de migración.
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
  v_mail text := nullif(lower(trim(p_email)), '');
begin
  -- 1) Dedup por teléfono (prioridad: walk-ins con celular).
  if v_tel is not null then
    select id into v_id from public.clientes where telefono = v_tel limit 1;
    if v_id is not null then
      if v_mail is not null then
        update public.clientes set email = coalesce(email, v_mail) where id = v_id;
      end if;
      return v_id;
    end if;
  end if;
  -- 2) Dedup por correo (reservas online sin teléfono), case-insensitive.
  if v_mail is not null then
    select id into v_id from public.clientes where lower(trim(email)) = v_mail limit 1;
    if v_id is not null then
      if v_tel is not null then
        update public.clientes set telefono = coalesce(telefono, v_tel) where id = v_id;
      end if;
      return v_id;
    end if;
  end if;
  -- 3) No existe: crear.
  insert into public.clientes (nombre, telefono, email, origen, fidelizado)
    values (coalesce(nullif(trim(p_nombre), ''), 'Cliente'), v_tel, v_mail,
            coalesce(p_origen, 'registrado'), coalesce(p_fidelizado, true))
    returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.upsert_cliente(text, text, text, text, boolean) from anon, public;
grant execute on function public.upsert_cliente(text, text, text, text, boolean) to authenticated, service_role;

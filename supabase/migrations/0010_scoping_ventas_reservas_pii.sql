-- 0010 — Scoping por barbero de ventas/reservas/venta_items + PII de clientes.
-- Complementa 0008 (que dejó estas tablas en is_staff a propósito, hasta tener el
-- barbero_id derivado en el servidor, que ahora ya está en actions.ts).
--
-- Resultado: un barbero (con su JWT + anon key) vía PostgREST directo ya solo ve/edita
--   * sus propias ventas/reservas/venta_items (no las de otros barberos),
--   * solo los clientes que atendió (cita o venta), no toda la base de PII.
-- El admin (is_admin) sigue viendo todo. El booking público (service_role) bypassa RLS.
--
-- Reservas con barbero_id NULL (citas "sin barbero") quedan solo-admin: el admin las ve
-- y asigna. Hoy son 0 en producción.

-- barbero_id del usuario logueado (null para admin/no-barbero).
create or replace function public.current_barbero_id()
  returns uuid language sql stable security definer set search_path = '' as $$
  select barbero_id from public.profiles where auth_id = auth.uid();
$$;
revoke execute on function public.current_barbero_id() from anon, public;
grant execute on function public.current_barbero_id() to authenticated;

-- Dedup de cliente por teléfono SIN exponer la tabla clientes al barbero (que ahora
-- por RLS solo ve los suyos). DEFINER: el lookup+insert corre como owner.
create or replace function public.upsert_cliente(p_nombre text, p_telefono text, p_email text)
  returns uuid language plpgsql security definer set search_path = '' as $$
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
  insert into public.clientes (nombre, telefono, email)
    values (coalesce(nullif(trim(p_nombre), ''), 'Cliente'), v_tel, v_mail)
    returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.upsert_cliente(text, text, text) from anon, public;
grant execute on function public.upsert_cliente(text, text, text) to authenticated, service_role;

-- ventas / reservas: el barbero solo ve y escribe lo suyo; el admin todo.
do $$
declare t text; r record;
begin
  foreach t in array array['ventas','reservas']
  loop
    for r in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', r.policyname, t);
    end loop;
    execute format(
      'create policy staff_%s on public.%I for all to authenticated '
      || 'using (public.is_admin() or barbero_id = public.current_barbero_id()) '
      || 'with check (public.is_admin() or barbero_id = public.current_barbero_id())',
      t, t);
  end loop;
end $$;

-- venta_items: vía la venta padre (no tiene barbero_id propio).
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'venta_items' loop
    execute format('drop policy if exists %I on public.venta_items', r.policyname);
  end loop;
end $$;
create policy staff_venta_items on public.venta_items for all to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.ventas v
      where v.id = venta_items.venta_id and v.barbero_id = public.current_barbero_id()
    )
  )
  with check (
    public.is_admin() or exists (
      select 1 from public.ventas v
      where v.id = venta_items.venta_id and v.barbero_id = public.current_barbero_id()
    )
  );

-- clientes (PII): admin todo; el barbero solo SELECT de los clientes que atendió
-- (cita o venta suya). El dedup/alta lo hace upsert_cliente (DEFINER), no acceso directo.
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'clientes' loop
    execute format('drop policy if exists %I on public.clientes', r.policyname);
  end loop;
end $$;
create policy clientes_admin on public.clientes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy clientes_barbero_select on public.clientes for select to authenticated
  using (
    exists (select 1 from public.reservas r where r.cliente_ref = clientes.id and r.barbero_id = public.current_barbero_id())
    or exists (select 1 from public.ventas v where v.cliente_ref = clientes.id and v.barbero_id = public.current_barbero_id())
  );

-- Índices para el scoping (barbero_id) y los EXISTS de la policy de clientes.
create index if not exists ventas_barbero_idx   on public.ventas (barbero_id);
create index if not exists reservas_barbero_idx on public.reservas (barbero_id);

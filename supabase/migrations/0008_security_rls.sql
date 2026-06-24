-- 0008 — RLS por rol (cierra parte del hueco crítico: un barbero, con su JWT + el
-- anon key público, podía leer/alterar TODA la plata y config vía PostgREST directo).
--
-- Alcance SEGURO (revisado adversarialmente — no rompe el cobro del barbero):
--   * is_admin() -> rol = 'admin'.
--   * Tablas SOLO-ADMIN (el barbero no las toca en ningún flujo):
--       gastos, adelantos, caja_sesiones, cliente_notas, cliente_wallet_mov, cliente_resenas
--   * cupones  -> SELECT para staff (validarCupon), escritura SOLO admin
--                 (el barbero suma usos vía la RPC bump_cupon_uso, SECURITY DEFINER).
--   * productos -> SELECT público (sin cambio), escritura SOLO admin
--                 (el barbero baja stock vía decrement_stock, ahora SECURITY DEFINER).
--
-- NO se tocan (siguen is_staff, requieren refactor de app antes de scopear — ver follow-up):
--   ventas, reservas, venta_items  -> scopear a barbero_id rompe el cobro de citas sin
--      barbero asignado y de walk-ins (la app pasa barbero_id desde el cliente). Pendiente:
--      derivar barbero_id en el servidor + manejar NULL, luego scopear.
--   clientes (PII), puntos_mov, lista_espera (PII) -> pendiente (el barbero los usa con su sesión).
-- El booking público (createReserva/getDisponibilidad) usa service_role y bypassa toda RLS.

create or replace function public.is_admin()
  returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles where auth_id = auth.uid() and rol = 'admin'
  );
$$;
revoke execute on function public.is_admin() from anon, public;
grant execute on function public.is_admin() to authenticated;

-- decrement_stock ahora SECURITY DEFINER: el barbero baja stock aunque productos sea
-- de escritura solo-admin (bypassa RLS de forma controlada; solo resta por id).
create or replace function public.decrement_stock(p_id uuid, p_qty integer)
  returns void language sql security definer set search_path = '' as $$
  update public.productos set stock = greatest(0, stock - p_qty) where id = p_id;
$$;
revoke execute on function public.decrement_stock(uuid, integer) from anon, public;
grant execute on function public.decrement_stock(uuid, integer) to authenticated;

-- bump_cupon_uso: incremento atómico (respeta el tope, sin carrera). DEFINER para que
-- el barbero sume el uso aunque cupones sea de escritura solo-admin. Devuelve true si incrementó.
create or replace function public.bump_cupon_uso(p_codigo text)
  returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.cupones set usos = usos + 1
   where codigo = p_codigo and (usos_max is null or usos < usos_max);
  return found;
end;
$$;
revoke execute on function public.bump_cupon_uso(text) from anon, public;
grant execute on function public.bump_cupon_uso(text) to authenticated;

-- Tablas solo-admin: borra TODA policy existente (los nombres viejos varían) y crea la admin-only.
do $$
declare t text; r record;
begin
  foreach t in array array['gastos','adelantos','caja_sesiones','cliente_notas','cliente_wallet_mov','cliente_resenas']
  loop
    for r in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', r.policyname, t);
    end loop;
    execute format(
      'create policy admin_all_%s on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t, t);
  end loop;
end $$;

-- cupones: lectura para staff (validarCupon); escritura solo admin.
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'cupones' loop
    execute format('drop policy if exists %I on public.cupones', r.policyname);
  end loop;
end $$;
create policy cupones_select on public.cupones for select to authenticated using (public.is_staff());
create policy cupones_write_admin on public.cupones for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- productos: lectura pública (sin cambio); escritura solo admin (el barbero baja stock por RPC).
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'productos' loop
    execute format('drop policy if exists %I on public.productos', r.policyname);
  end loop;
end $$;
create policy public_read_productos on public.productos for select using (true);
create policy productos_write_admin on public.productos for all to authenticated using (public.is_admin()) with check (public.is_admin());

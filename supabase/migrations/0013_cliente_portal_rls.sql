-- 0013 — Rol "cliente" para el portal (login con Gmail).
-- El cliente logueado (clientes.auth_id = auth.uid()) solo PUEDE LEER lo suyo.
-- Aditivo: NO toca las policies de staff/admin. Un barbero/admin no tiene fila en
-- clientes con su auth_id, así que current_cliente_id() les da null → estas policies
-- no les aplican (y las suyas siguen igual).

create or replace function public.current_cliente_id()
  returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.clientes where auth_id = auth.uid();
$$;
revoke execute on function public.current_cliente_id() from anon, public;
grant execute on function public.current_cliente_id() to authenticated;

-- SELECT-only de lo propio, por tabla.
drop policy if exists cliente_select_self on public.clientes;
create policy cliente_select_self on public.clientes for select to authenticated
  using (id = public.current_cliente_id());

drop policy if exists cliente_select_reservas on public.reservas;
create policy cliente_select_reservas on public.reservas for select to authenticated
  using (cliente_ref is not null and cliente_ref = public.current_cliente_id());

drop policy if exists cliente_select_ventas on public.ventas;
create policy cliente_select_ventas on public.ventas for select to authenticated
  using (cliente_ref is not null and cliente_ref = public.current_cliente_id());

drop policy if exists cliente_select_venta_items on public.venta_items;
create policy cliente_select_venta_items on public.venta_items for select to authenticated
  using (exists (
    select 1 from public.ventas v
    where v.id = venta_items.venta_id and v.cliente_ref = public.current_cliente_id()
  ));

drop policy if exists cliente_select_puntos on public.puntos_mov;
create policy cliente_select_puntos on public.puntos_mov for select to authenticated
  using (cliente_ref is not null and cliente_ref = public.current_cliente_id());

drop policy if exists cliente_select_espera on public.lista_espera;
create policy cliente_select_espera on public.lista_espera for select to authenticated
  using (cliente_ref is not null and cliente_ref = public.current_cliente_id());

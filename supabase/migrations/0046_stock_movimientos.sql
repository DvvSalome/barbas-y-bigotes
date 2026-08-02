-- 0046 — Historial de inventario: poder SUBIR el stock y saber cuándo entró.
-- Hasta acá el stock solo BAJABA (decrement_stock en cada venta): no existía
-- ninguna forma de registrar mercancía que llega, así que el inventario caía a 0
-- y se quedaba ahí. Y como productos.stock guarda solo el número actual, no se
-- podía responder "¿qué día entró?" ni cuadrar "vendí 10 y quedan 3".

create table if not exists public.stock_movimientos (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  -- Positivo = entra mercancía; negativo = ajuste a la baja o venta.
  cantidad int not null,
  motivo text not null check (motivo in ('entrada', 'ajuste', 'venta', 'merma')),
  nota text,
  -- Quién lo registró. Se guarda el barbero (no el perfil) porque el mostrador
  -- es compartido: interesa la persona, no la cuenta con la que entró.
  barbero_id uuid references public.barberos(id),
  creado_en timestamptz not null default now()
);
create index if not exists idx_stock_mov_producto on public.stock_movimientos (producto_id, creado_en desc);

alter table public.stock_movimientos enable row level security;
revoke all on public.stock_movimientos from anon;
-- El staff ve el historial de su operación; solo el admin lo escribe a mano
-- (las ventas lo escriben por la función de abajo, que corre como definer).
drop policy if exists stock_mov_staff_select on public.stock_movimientos;
create policy stock_mov_staff_select on public.stock_movimientos
  for select to authenticated using (public.is_staff());
drop policy if exists stock_mov_admin_write on public.stock_movimientos;
create policy stock_mov_admin_write on public.stock_movimientos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Suma mercancía y deja el rastro, en UNA transacción. Se suma (no se pisa el
-- número) para no perder una venta que ocurra entre que se lee y se guarda:
-- en el local venden mientras el dueño registra el pedido que acaba de llegar.
create or replace function public.ingresar_stock(
  p_producto_id uuid,
  p_cantidad int,
  p_motivo text default 'entrada',
  p_nota text default null,
  p_barbero_id uuid default null
) returns int language plpgsql security definer set search_path = '' as $$
declare v_nuevo int;
begin
  if p_cantidad = 0 then
    raise exception 'La cantidad no puede ser cero';
  end if;
  if p_motivo not in ('entrada', 'ajuste', 'venta', 'merma') then
    raise exception 'Motivo inválido';
  end if;

  update public.productos
    set stock = greatest(0, stock + p_cantidad)
    where id = p_producto_id
    returning stock into v_nuevo;
  if not found then
    raise exception 'Producto inexistente';
  end if;

  insert into public.stock_movimientos (producto_id, cantidad, motivo, nota, barbero_id)
  values (p_producto_id, p_cantidad, p_motivo, nullif(trim(p_nota), ''), p_barbero_id);

  return v_nuevo;
end $$;
revoke all on function public.ingresar_stock(uuid, int, text, text, uuid) from public, anon, authenticated;
grant execute on function public.ingresar_stock(uuid, int, text, text, uuid) to service_role;

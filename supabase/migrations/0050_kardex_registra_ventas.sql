-- 0050 — El kardex (stock_movimientos) ahora SÍ registra las ventas (auditoría #03).
--
-- decrement_stock (0008) solo hacía `update productos set stock = greatest(0, ...)`
-- y NO insertaba movimiento, así que stock_movimientos —creada en 0046 justo para
-- poder auditar "vendí 10, quedan 3"— nunca veía una salida por venta: el motivo
-- 'venta' del CHECK estaba muerto y el historial no cuadraba.
--
-- Se redefine con el MISMO nombre y firma (uuid, integer) → es un REPLACE de verdad
-- (no un overload) y conserva los GRANT de EXECUTE existentes. Ahora:
--   1) calcula cuánto sale REALMENTE (sin bajar de 0, igual que el greatest de antes),
--   2) descuenta ese monto,
--   3) registra la salida como movimiento 'venta' (cantidad negativa).
-- SECURITY DEFINER + search_path='' + llamadas schema-cualificadas, como el resto.
-- Aplicar manualmente en el SQL Editor. Es retro-compatible: el código que llama
-- decrement_stock(p_id, p_qty) sigue igual.

create or replace function public.decrement_stock(p_id uuid, p_qty integer)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_antes int;
  v_baja  int;
begin
  select stock into v_antes from public.productos where id = p_id for update;
  if not found then
    return;  -- producto inexistente: no romper el cobro
  end if;
  -- Lo que realmente sale del cajón de stock: nunca deja el stock negativo.
  v_baja := least(greatest(p_qty, 0), greatest(v_antes, 0));
  update public.productos set stock = v_antes - v_baja where id = p_id;
  if v_baja > 0 then
    insert into public.stock_movimientos (producto_id, cantidad, motivo)
    values (p_id, -v_baja, 'venta');
  end if;
end;
$$;

notify pgrst, 'reload schema';

-- 0051 — La sobreventa queda VISIBLE en el kardex (auditoría #12). Amplía 0050.
--
-- 0050 hizo que decrement_stock registrara la salida por venta, pero con la cantidad
-- RECORTADA a lo que el contador tenía (least(p_qty, stock)). Si el contador estaba
-- por debajo de lo que realmente se vendió (típico: se repuso la bebida sin registrar
-- la 'entrada'), el excedente vendido se perdía sin rastro: la sobreventa era invisible.
--
-- Ahora se registra el movimiento con la cantidad REAL vendida (-p_qty), aunque el
-- contador de productos.stock siga clampeado a 0 (requisito: nunca negativo). Así:
--   • productos.stock = greatest(0, ...) → nunca negativo, la alerta de bajo mínimo
--     sigue avisando que ese producto necesita reponerse/ajustarse.
--   • stock_movimientos registra lo que DE VERDAD se vendió → si se vendió más de lo
--     que el contador sabía, el kardex lo muestra (la sobreventa deja de ser invisible;
--     se reconcilia cuando el admin hace el 'ajuste' del recuento real).
-- Retro-compatible: misma firma (uuid, integer), es un REPLACE. Aplicar en el SQL Editor.

create or replace function public.decrement_stock(p_id uuid, p_qty integer)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_antes int;
begin
  select stock into v_antes from public.productos where id = p_id for update;
  if not found then
    return;  -- producto inexistente: no romper el cobro
  end if;
  -- El contador nunca queda negativo...
  update public.productos set stock = greatest(0, v_antes - p_qty) where id = p_id;
  -- ...pero el kardex registra la cantidad REAL vendida (aunque supere lo que el
  -- contador tenía), para que la sobreventa quede visible y auditable.
  if p_qty > 0 then
    insert into public.stock_movimientos (producto_id, cantidad, motivo)
    values (p_id, -p_qty, 'venta');
  end if;
end;
$$;

notify pgrst, 'reload schema';

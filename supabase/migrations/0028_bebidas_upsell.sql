-- 0028 — Bebidas del upsell de reserva, configurables por sede desde el inventario.
-- Antes: las 4 bebidas del paso "¿le sumás una bebida?" estaban hardcodeadas en
-- BookingWizard.tsx (precio fijo, iguales para toda sede). Ahora salen de productos
-- marcados con en_upsell, así el dueño edita precio/disponibilidad por sede desde
-- /admin/inventario (mismo flujo que ya usa) y de paso quedan atadas a stock.

alter table public.productos
  add column if not exists en_upsell boolean not null default false;

-- Índice parcial: el wizard filtra productos activos marcados para el upsell.
create index if not exists productos_en_upsell_idx
  on public.productos (sede_id) where en_upsell;

-- Seed idempotente de las 4 bebidas del menú (precios del prototipo) en cada sede.
-- No toca la "Bebida (gaseosa / energizante)" que ya exista (queda como ítem POS
-- de stock; el dueño puede borrarla si prefiere llevar stock por bebida).
insert into public.productos (nombre, sede_id, precio, stock, stock_minimo, comision_pct, en_upsell)
select b.nombre, s.id, b.precio, 24, 6, 0, true
from public.sedes s
cross join (values
  ('Gaseosa', 5000),
  ('Agua', 3000),
  ('Energizante', 8000),
  ('Cerveza', 7000)
) as b(nombre, precio)
where not exists (
  select 1 from public.productos p
  where p.nombre = b.nombre and p.sede_id = s.id
);

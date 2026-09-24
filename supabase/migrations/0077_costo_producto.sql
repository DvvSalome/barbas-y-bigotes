-- 0077 · Lo que le CUESTA al local cada producto.
--
-- El dueño lleva el inventario en un Excel con VALOR C (costo), VALOR V (venta),
-- GANANCIA y PLATA INVERTIDA por producto. La app solo sabía el precio de venta,
-- así que de las cuatro columnas podía dar una. Con el costo salen las otras tres:
-- ganancia por unidad = precio − costo, plata invertida = stock × costo.
--
-- TABLA APARTE y cerrada, no una columna en `productos`: `productos` la lee el
-- público sin sesión (política public_read_productos = true, porque la reserva
-- ofrece bebidas al final), y una columna `costo` ahí quedaría expuesta a
-- cualquiera con ?select=costo. El margen del negocio no es dato público. Es el
-- mismo esquema que barbero_contacto (0066): RLS prendida, sin políticas, y solo
-- service_role lee y escribe, siempre DESPUÉS del gate de admin de la action.
create table if not exists public.producto_costo (
  producto_id uuid primary key references public.productos(id) on delete cascade,
  -- Pesos enteros, como el precio. Cero vale (una muestra regalada por el
  -- proveedor); negativo no.
  costo integer not null check (costo >= 0),
  actualizado_en timestamptz not null default now()
);

alter table public.producto_costo enable row level security;
revoke all on public.producto_costo from anon, authenticated;
-- Sin políticas a propósito: nadie con sesión la lee ni la escribe.

notify pgrst, 'reload schema';

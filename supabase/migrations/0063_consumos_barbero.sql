-- 0063 · Lo que se toman los barberos, para poder descontárselo.
--
-- Lo pidió el dueño (20-ago) como parte del consolidado semanal: "las bebidas o
-- MECATOS consumidos por ellos pendientes a descontar". Hoy no existe en ningún
-- lado: el barbero saca un Gatorade de la nevera y eso no baja del stock ni queda
-- anotado, así que al liquidar la semana el dueño lo lleva de memoria y el
-- inventario nunca cuadra.
--
-- Dos escrituras por consumo, cada una con su motivo:
--   · `consumos_barbero` — la PLATA: qué se tomó, cuánto vale y a quién se le
--     descuenta. Guarda el precio del momento porque el de hoy no sirve para
--     liquidar una semana vieja.
--   · `stock_movimientos` con motivo 'consumo' — el INVENTARIO, en el mismo kardex
--     donde ya viven las entradas, las ventas y las mermas. Sin esto el conteo
--     físico sigue sin cuadrar, que es la mitad del problema.

-- El kardex (0046) no contemplaba este motivo y su CHECK rechazaba la fila.
alter table public.stock_movimientos
  drop constraint if exists stock_movimientos_motivo_check;
alter table public.stock_movimientos
  add constraint stock_movimientos_motivo_check
  check (motivo in ('entrada', 'ajuste', 'venta', 'merma', 'consumo'));

create table if not exists public.consumos_barbero (
  id uuid primary key default gen_random_uuid(),
  barbero_id uuid not null references public.barberos(id),
  producto_id uuid not null references public.productos(id),
  cantidad int not null check (cantidad > 0),
  -- Precio unitario del momento. Congelado a propósito: si el dueño sube la
  -- gaseosa el mes que viene, la liquidación de esta semana no puede cambiar.
  precio_unitario int not null check (precio_unitario >= 0),
  -- Día civil (Bogotá) al que se imputa, para que la semana de liquidación no
  -- dependa del huso del servidor.
  fecha date not null default (now() at time zone 'America/Bogota')::date,
  nota text,
  creado_en timestamptz not null default now()
);

-- La liquidación siempre pregunta lo mismo: qué se tomó ESTE barbero en ESTE rango.
create index if not exists idx_consumos_barbero_barbero_fecha
  on public.consumos_barbero (barbero_id, fecha);

alter table public.consumos_barbero enable row level security;

-- Mismo criterio que `adelantos`, que es el otro descuento de la liquidación:
-- staff. Sin scoping por barbero a propósito — el mostrador es compartido y el
-- que registra el consumo no siempre es el que se lo tomó.
drop policy if exists staff_all_consumos_barbero on public.consumos_barbero;
create policy staff_all_consumos_barbero on public.consumos_barbero
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

revoke all on public.consumos_barbero from anon;

notify pgrst, 'reload schema';

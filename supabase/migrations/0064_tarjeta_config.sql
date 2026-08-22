-- 0064 · La tarjeta de fidelidad la configura el dueño, no el código.
--
-- Lo pidió el 20-ago: "ver cómo se hace con la tarjeta de fidelidad, para poder
-- modificarla, ya que las barbas no cuentan, y el descuento se da sobre la
-- mayoría de servicios realizados".
--
-- Tres cosas estaban quemadas en src/lib/tarjeta.ts y cambiarlas era un deploy:
-- el tamaño (10), los hitos (regalo al 5º, 50% al 10º) y qué servicios suman
-- sello (una lista de ids escrita a mano). Ahora las tres se tocan desde el panel.

create table if not exists public.ajustes_tarjeta (
  -- Singleton, igual que ajustes_avisos (0038): una sola tarjeta para el negocio.
  id int primary key default 1 check (id = 1),
  tamano int not null default 10 check (tamano between 3 and 20),
  -- [{"posicion":5,"tipo":"regalo","valor":0},{"posicion":10,"tipo":"porcentaje","valor":50}]
  -- jsonb y no una tabla aparte: son dos o tres filas que se leen SIEMPRE juntas
  -- con su tarjeta y nunca por separado. La forma la valida el server action
  -- (sanearConfigTarjeta), que es quien puede dar un error entendible.
  hitos jsonb not null default '[{"posicion":5,"tipo":"regalo","valor":0},{"posicion":10,"tipo":"porcentaje","valor":50}]'::jsonb,
  actualizado_en timestamptz not null default now()
);

-- La fila arranca con lo que hoy está quemado en el código: aplicar esta migración
-- no cambia el comportamiento de la tarjeta, solo lo vuelve editable.
insert into public.ajustes_tarjeta (id) values (1) on conflict (id) do nothing;

alter table public.ajustes_tarjeta enable row level security;

-- La LEE cualquiera del staff (el mostrador la necesita para el total en vivo) y
-- también el portal del cliente, que dibuja su tarjeta. La ESCRIBE solo el admin:
-- cambiar los hitos cambia lo que se le regala a la gente.
drop policy if exists lee_ajustes_tarjeta on public.ajustes_tarjeta;
create policy lee_ajustes_tarjeta on public.ajustes_tarjeta
  for select to authenticated using (true);

drop policy if exists admin_escribe_ajustes_tarjeta on public.ajustes_tarjeta;
create policy admin_escribe_ajustes_tarjeta on public.ajustes_tarjeta
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.ajustes_tarjeta from anon;

-- Qué suma sello: la columna `cuenta_corte` existe desde 0027 pero solo la
-- llenaba el armador de combos. Los cerquillos estaban excluidos con un Set
-- escrito a mano en el código; pasa a ser dato, y el panel lo puede cambiar.
update public.servicios
   set cuenta_corte = false
 where id in ('cerquillo', 'cerquillos', 'cerquillo-barba')
   and cuenta_corte is distinct from false;

notify pgrst, 'reload schema';

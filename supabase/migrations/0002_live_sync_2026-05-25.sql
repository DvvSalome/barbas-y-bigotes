-- 0002_live_sync_2026-05-25.sql — Barbas & Bigotes
-- Consolida TODAS las migraciones aplicadas a la nube vía Supabase MCP después de
-- 0001_init.sql, que no estaban versionadas en el repo. Aplicar 0001 + 0002 reproduce
-- el esquema live. Cada bloque conserva el nombre/version original de Supabase.
-- Orden cronológico (las políticas/funciones se redefinen más abajo a propósito).

-- ===========================================================================
-- 20260525035053_writes_inventory_and_barber
-- ===========================================================================
alter table ventas add column if not exists cliente_nombre text;
alter table ventas add column if not exists llegada text;

create or replace function decrement_stock(p_id uuid, p_qty integer)
returns void language sql as $$
  update productos set stock = greatest(0, stock - p_qty) where id = p_id;
$$;

-- DEV (luego endurecido): escrituras abiertas vía anon.
create policy "dev_insert_productos" on productos for insert with check (true);
create policy "dev_update_productos" on productos for update using (true) with check (true);
create policy "dev_delete_productos" on productos for delete using (true);
create policy "dev_read_ventas" on ventas for select using (true);
create policy "dev_insert_ventas" on ventas for insert with check (true);
create policy "dev_read_venta_items" on venta_items for select using (true);
create policy "dev_insert_venta_items" on venta_items for insert with check (true);

-- ===========================================================================
-- 20260525051240_harden_writes_authenticated
-- ===========================================================================
drop policy if exists "dev_insert_productos" on productos;
drop policy if exists "dev_update_productos" on productos;
drop policy if exists "dev_delete_productos" on productos;
drop policy if exists "dev_read_ventas" on ventas;
drop policy if exists "dev_insert_ventas" on ventas;
drop policy if exists "dev_read_venta_items" on venta_items;
drop policy if exists "dev_insert_venta_items" on venta_items;

create policy "auth_write_productos" on productos for all to authenticated using (true) with check (true);
create policy "auth_all_ventas" on ventas for all to authenticated using (true) with check (true);
create policy "auth_all_venta_items" on venta_items for all to authenticated using (true) with check (true);

-- ===========================================================================
-- 20260525052238_clientes_and_agenda
-- ===========================================================================
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text unique,
  email text,
  auth_id uuid unique,
  notas text,
  creado_en timestamptz not null default now()
);

alter table ventas add column if not exists cliente_ref uuid references clientes(id);
alter table reservas add column if not exists cliente_ref uuid references clientes(id);
alter table reservas add column if not exists llegada text;

alter table clientes enable row level security;
create policy "auth_all_clientes" on clientes for all to authenticated using (true) with check (true);
create policy "auth_all_reservas" on reservas for all to authenticated using (true) with check (true);

-- ===========================================================================
-- 20260525053759_rls_gastos_adelantos
-- ===========================================================================
create policy "auth_all_gastos" on gastos for all to authenticated using (true) with check (true);
create policy "auth_all_adelantos" on adelantos for all to authenticated using (true) with check (true);

-- ===========================================================================
-- 20260525054400_reservas_reminder_sent
-- ===========================================================================
alter table reservas add column if not exists reminder_sent boolean not null default false;

-- ===========================================================================
-- 20260525055708_reservas_no_overlap_constraint
-- ===========================================================================
create extension if not exists btree_gist;

alter table reservas
  add constraint reservas_no_overlap
  exclude using gist (
    barbero_id with =,
    tstzrange(inicio, fin) with &&
  ) where (estado not in ('cancelada','no_show'));

-- ===========================================================================
-- 20260525060551_harden_decrement_stock_search_path
-- ===========================================================================
create or replace function public.decrement_stock(p_id uuid, p_qty integer)
returns void
language sql
set search_path = ''
as $function$
  update public.productos set stock = greatest(0, stock - p_qty) where id = p_id;
$function$;

-- ===========================================================================
-- 20260525060629_rls_por_rol_is_staff
-- ===========================================================================
-- Nota: el INSERT del perfil admin del entorno live usa un auth_id concreto;
-- en un entorno nuevo se crea al provisionar el primer admin (omitido aquí).

create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles
    where auth_id = auth.uid() and rol in ('admin','barbero')
  );
$$;
revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;

drop policy if exists auth_all_ventas on public.ventas;
create policy staff_all_ventas on public.ventas
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists auth_all_venta_items on public.venta_items;
create policy staff_all_venta_items on public.venta_items
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists auth_all_gastos on public.gastos;
create policy staff_all_gastos on public.gastos
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists auth_all_adelantos on public.adelantos;
create policy staff_all_adelantos on public.adelantos
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists auth_all_reservas on public.reservas;
create policy staff_all_reservas on public.reservas
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists auth_all_clientes on public.clientes;
create policy staff_all_clientes on public.clientes
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists auth_write_productos on public.productos;
create policy staff_write_productos on public.productos
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ===========================================================================
-- 20260525060840_revoke_is_staff_from_anon
-- ===========================================================================
revoke execute on function public.is_staff() from anon;

-- ===========================================================================
-- 20260525182012_lista_espera_columns_and_rls
-- ===========================================================================
alter table public.lista_espera
  add column if not exists cliente_nombre text,
  add column if not exists telefono text,
  add column if not exists nota text;

drop policy if exists staff_all_lista_espera on public.lista_espera;
create policy staff_all_lista_espera on public.lista_espera
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ===========================================================================
-- 20260525182314_profiles_barbero_link_and_own_select
-- ===========================================================================
alter table public.profiles
  add column if not exists barbero_id uuid references public.barberos(id) on delete set null;

drop policy if exists own_profile_select on public.profiles;
create policy own_profile_select on public.profiles
  for select to authenticated using (auth_id = auth.uid());

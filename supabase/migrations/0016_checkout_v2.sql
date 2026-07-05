-- 0016_checkout_v2.sql — Barbas & Bigotes
-- Checkout barbero v2: medios de pago administrables (tabla en vez del enum
-- cerrado), propina + nota en la venta, candado anti doble cobro por reserva
-- y snapshot por medio en el cierre de caja.
-- Se aplica A MANO en el SQL Editor de Supabase (convención del repo).

-- ---------- Medios de pago administrables ----------
-- Reemplaza el enum cerrado medio_pago: el admin agrega/apaga medios sin deploy.
create table if not exists public.medios_pago (
  slug   text primary key,
  nombre text not null,
  activo boolean not null default true,
  orden  int not null default 100
);
insert into public.medios_pago (slug, nombre, orden) values
  ('efectivo','Efectivo',1),
  ('datafono','Datáfono',2),
  ('nequi','Nequi',3),
  ('transferencia','Transferencia',4),
  ('daviplata','Daviplata',5)
on conflict (slug) do nothing;

alter table public.medios_pago enable row level security;
-- Lectura pública: getMedios usa el cliente anónimo del server, igual que los
-- catálogos (sedes/servicios); los nombres de los medios no son sensibles.
-- Escritura solo admin.
drop policy if exists medios_select on public.medios_pago;
create policy medios_select on public.medios_pago for select using (true);
drop policy if exists medios_write_admin on public.medios_pago;
create policy medios_write_admin on public.medios_pago for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- ventas.medio: enum -> text con FK a medios_pago ----------
-- Los valores existentes ('efectivo'/'datafono') matchean los slugs del seed.
alter table public.ventas alter column medio type text using medio::text;
alter table public.ventas drop constraint if exists ventas_medio_fk;
alter table public.ventas add constraint ventas_medio_fk
  foreign key (medio) references public.medios_pago(slug);
-- Verificado con grep en supabase/: ninguna otra columna ni función usa el tipo.
-- (supabase/seed/demo.sql castea ::medio_pago — es un seed de demo, no un objeto
-- de la DB; queda obsoleto tras esta migración y no se corre en producción.)
drop type if exists public.medio_pago;

-- ---------- Propina y nota del cierre ----------
-- La propina NO entra en ventas.total (neto): va aparte, en su columna.
alter table public.ventas add column if not exists propina integer not null default 0;
alter table public.ventas add column if not exists nota text;

-- ---------- Anti doble cobro: una venta por reserva ----------
create unique index if not exists ventas_reserva_unica
  on public.ventas (reserva_id) where reserva_id is not null;

-- ---------- Snapshot por medio en el cierre de caja ----------
-- Record<slug, { total, propina }>. Los cierres viejos quedan con las 2 columnas
-- legacy (total_efectivo/total_datafono), que se siguen poblando por compat.
alter table public.caja_sesiones add column if not exists totales jsonb;

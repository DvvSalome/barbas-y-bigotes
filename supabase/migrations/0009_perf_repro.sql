-- 0009 — Reproducibilidad del repo + performance. Sin cambios de comportamiento.
-- (En la nube estas columnas/índices ya pueden existir; todo es IF NOT EXISTS / NOT VALID.)

-- Drift: columnas que la app usa (queries.ts getBarberos) y que solo existían en la
-- nube. Con esto un clon desde cero (0001..0009) corre sin romper en runtime.
alter table public.barberos add column if not exists rating  numeric default 0;
alter table public.barberos add column if not exists resenas integer default 0;
alter table public.barberos add column if not exists orden   integer default 0;
alter table public.barberos add column if not exists bio     text;

-- Índices en FKs calientes (filtros/joins reales sin índice → seq scan).
create index if not exists ventas_cliente_ref_fecha_idx on public.ventas (cliente_ref, creado_en desc);
create index if not exists venta_items_venta_id_idx      on public.venta_items (venta_id);
create index if not exists reservas_cliente_ref_idx      on public.reservas (cliente_ref, inicio desc);

-- Cupones: no superar el tope de usos. NOT VALID para no fallar con data legada;
-- igual se enforced en toda escritura nueva.
alter table public.cupones drop constraint if exists cupones_usos_max_chk;
alter table public.cupones add constraint cupones_usos_max_chk
  check (usos_max is null or usos <= usos_max) not valid;

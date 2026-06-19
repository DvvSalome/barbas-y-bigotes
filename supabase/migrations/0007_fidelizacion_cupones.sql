-- 0007_fidelizacion_cupones.sql — Barbas & Bigotes
-- Fidelización (puntos por compra) + cupones de descuento aplicados en el cobro.
-- No toca pagos reales: el cupón solo ajusta el total registrado; los puntos son
-- un ledger de fidelidad.

-- Trazabilidad del descuento en la venta.
alter table public.ventas add column if not exists descuento integer not null default 0;
alter table public.ventas add column if not exists cupon_codigo text;

-- Cupones.
create table public.cupones (
  id          uuid primary key default gen_random_uuid(),
  codigo      text unique not null,
  descripcion text,
  tipo        text not null,                 -- 'porcentaje' | 'monto'
  valor       integer not null,              -- % (1-100) o monto en COP
  activo      boolean not null default true,
  usos        integer not null default 0,
  usos_max    integer,                       -- null = ilimitado
  vence_en    date,
  creado_en   timestamptz not null default now()
);
alter table public.cupones enable row level security;
create policy staff_all_cupones on public.cupones for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Puntos de fidelidad (ledger por cliente).
create table public.puntos_mov (
  id          uuid primary key default gen_random_uuid(),
  cliente_ref uuid not null references public.clientes(id) on delete cascade,
  tipo        text not null,                 -- 'ganado' | 'canjeado'
  puntos      integer not null,              -- siempre positivo; el signo lo da el tipo
  venta_id    uuid references public.ventas(id) on delete set null,
  nota        text,
  creado_en   timestamptz not null default now()
);
create index puntos_mov_ref on public.puntos_mov (cliente_ref, creado_en desc);
alter table public.puntos_mov enable row level security;
create policy staff_all_puntos on public.puntos_mov for all to authenticated using (public.is_staff()) with check (public.is_staff());

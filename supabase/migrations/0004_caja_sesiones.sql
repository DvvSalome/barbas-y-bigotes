-- 0004_caja_sesiones.sql — Barbas & Bigotes
-- Sesiones de caja (abrir/cerrar) por sede, estilo WeiBook: meta del día,
-- snapshot de cierre y diferencia de efectivo. Historial = sesiones cerradas.

create table public.caja_sesiones (
  id               uuid primary key default gen_random_uuid(),
  sede_id          text not null references public.sedes(id),
  estado           text not null default 'abierta',   -- 'abierta' | 'cerrada'
  meta_dia         integer not null default 0,
  monto_apertura   integer not null default 0,
  -- snapshot calculado al cerrar:
  total_efectivo   integer,
  total_datafono   integer,
  total_gastos     integer,
  citas            integer,
  efectivo_contado integer,                            -- lo que el cajero contó
  diferencia       integer,                            -- contado - esperado en efectivo
  nota             text,
  abierta_en       timestamptz not null default now(),
  cerrada_en       timestamptz,
  abierta_por      uuid references public.profiles(id)
);

-- Solo una caja abierta por sede a la vez.
create unique index caja_una_abierta_por_sede on public.caja_sesiones (sede_id) where (estado = 'abierta');
create index caja_sede_fecha on public.caja_sesiones (sede_id, abierta_en desc);

alter table public.caja_sesiones enable row level security;
create policy staff_all_caja_sesiones on public.caja_sesiones
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- 0006_crm_cliente.sql — Barbas & Bigotes
-- Ficha de cliente estilo WeiBook: notas, wallet (saldo a favor manual, sin
-- pasarela) y reseñas del cliente (calificar al cliente). Todo gestionado por staff.

create table public.cliente_notas (
  id          uuid primary key default gen_random_uuid(),
  cliente_ref uuid not null references public.clientes(id) on delete cascade,
  nota        text not null,
  creado_en   timestamptz not null default now(),
  creado_por  uuid references public.profiles(id)
);
create index cliente_notas_ref on public.cliente_notas (cliente_ref, creado_en desc);

-- Wallet = saldo a favor del cliente. Registro MANUAL (no hay cobro real en la app).
-- recarga = +monto (el cliente deja saldo), consumo = -monto (se aplica a un servicio).
create table public.cliente_wallet_mov (
  id          uuid primary key default gen_random_uuid(),
  cliente_ref uuid not null references public.clientes(id) on delete cascade,
  tipo        text not null,                 -- 'recarga' | 'consumo'
  monto       integer not null,              -- siempre positivo; el signo lo da el tipo
  nota        text,
  creado_en   timestamptz not null default now(),
  creado_por  uuid references public.profiles(id)
);
create index cliente_wallet_ref on public.cliente_wallet_mov (cliente_ref, creado_en desc);

-- Reseña DEL cliente (el barbero/staff lo califica: puntualidad, trato, etc.).
create table public.cliente_resenas (
  id          uuid primary key default gen_random_uuid(),
  cliente_ref uuid not null references public.clientes(id) on delete cascade,
  barbero_id  uuid references public.barberos(id),
  score       integer not null check (score between 1 and 5),
  nota        text,
  creado_en   timestamptz not null default now()
);
create index cliente_resenas_ref on public.cliente_resenas (cliente_ref, creado_en desc);

alter table public.cliente_notas      enable row level security;
alter table public.cliente_wallet_mov enable row level security;
alter table public.cliente_resenas    enable row level security;

create policy staff_all_cliente_notas  on public.cliente_notas      for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all_cliente_wallet on public.cliente_wallet_mov for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_all_cliente_resenas on public.cliente_resenas   for all to authenticated using (public.is_staff()) with check (public.is_staff());

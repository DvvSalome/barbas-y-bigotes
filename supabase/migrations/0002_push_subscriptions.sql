create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  cliente_ref uuid not null references public.clientes(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.push_subscriptions enable row level security;

create policy "Clientes pueden ver sus propias suscripciones"
  on public.push_subscriptions for select
  using (cliente_ref in (select id from public.clientes where auth_id = auth.uid()));

create policy "Clientes pueden insertar sus propias suscripciones"
  on public.push_subscriptions for insert
  with check (cliente_ref in (select id from public.clientes where auth_id = auth.uid()));

create policy "Clientes pueden borrar sus propias suscripciones"
  on public.push_subscriptions for delete
  using (cliente_ref in (select id from public.clientes where auth_id = auth.uid()));

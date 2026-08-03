-- 0047 — Avisos al BARBERO en el celular (web push del staff).
--
-- Hasta acá push_subscriptions era solo de clientes (cliente_ref not null): al
-- barbero no le llegaba NADA cuando entraba una reserva. Lo único que había era
-- el ding dentro del mostrador, que exige tener la app abierta en pantalla; con
-- el celular bloqueado la reserva entraba en silencio.
--
-- Se reusa la misma tabla en vez de crear otra: el emisor (src/lib/push.ts) ya
-- sabe leer de acá, y las suscripciones muertas se limpian en un solo lugar.
-- Cada fila pertenece a UNO de los dos: un cliente o un barbero, nunca ambos.
--
-- NO ejecutar desde la app: se aplica en el SQL Editor de Supabase.

alter table public.push_subscriptions
  add column if not exists barbero_id uuid references public.barberos(id) on delete cascade;

alter table public.push_subscriptions
  alter column cliente_ref drop not null;

-- Dueño único y obligatorio. Sin esto podría entrar una fila huérfana (a nadie)
-- o una atada a un cliente Y un barbero, y el emisor mandaría el aviso al que no es.
alter table public.push_subscriptions
  drop constraint if exists push_sub_dueno_unico;
alter table public.push_subscriptions
  add constraint push_sub_dueno_unico
  check (num_nonnulls(cliente_ref, barbero_id) = 1);

-- El emisor filtra por barbero_id.
create index if not exists push_subs_barbero_idx
  on public.push_subscriptions (barbero_id);

-- RLS: cada barbero administra las suyas y NO ve las de nadie más. La escritura
-- real la hace el server con service role (igual que la del cliente); estas
-- policies son el piso, no el camino feliz.
drop policy if exists "Barbero ve sus suscripciones" on public.push_subscriptions;
create policy "Barbero ve sus suscripciones"
  on public.push_subscriptions for select
  using (barbero_id is not null and barbero_id = public.current_barbero_id());

drop policy if exists "Barbero borra sus suscripciones" on public.push_subscriptions;
create policy "Barbero borra sus suscripciones"
  on public.push_subscriptions for delete
  using (barbero_id is not null and barbero_id = public.current_barbero_id());

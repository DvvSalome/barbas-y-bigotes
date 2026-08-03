-- 0047 — Avisos de cita al STAFF en el celular (web push del equipo).
--
-- Hasta acá push_subscriptions era solo de clientes (cliente_ref not null): al
-- local no le llegaba NADA cuando entraba una reserva. Lo único que había era el
-- ding del mostrador, que exige tener la app abierta en pantalla; con el celular
-- bloqueado la reserva entraba en silencio.
--
-- El destinatario natural es la SEDE, no la persona: el modelo del producto es
-- un perfil por sede (0043/0044, rol `sede`) operando un mostrador compartido, y
-- ahí el aviso tiene que sonar en el aparato del local sin importar quién esté
-- parado enfrente. Se acepta también `barbero_id` porque hoy siguen existiendo
-- los 6 logins por barbero; cuando se retiren, esas filas simplemente dejan de
-- crearse (nada que migrar).
--
-- Se reusa la tabla en vez de crear otra: el emisor (src/lib/push.ts) ya sabe
-- leer de acá y las suscripciones muertas se limpian en un solo lugar.
--
-- NO ejecutar desde la app: se aplica en el SQL Editor de Supabase.

alter table public.push_subscriptions
  add column if not exists barbero_id uuid references public.barberos(id) on delete cascade;

alter table public.push_subscriptions
  add column if not exists sede_id text references public.sedes(id) on delete cascade;

alter table public.push_subscriptions
  alter column cliente_ref drop not null;

-- Dueño único y obligatorio. Sin esto podría entrar una fila huérfana (a nadie)
-- o atada a dos dueños, y el aviso le llegaría a quien no es.
alter table public.push_subscriptions
  drop constraint if exists push_sub_dueno_unico;
alter table public.push_subscriptions
  add constraint push_sub_dueno_unico
  check (num_nonnulls(cliente_ref, barbero_id, sede_id) = 1);

-- El emisor filtra por dueño.
create index if not exists push_subs_barbero_idx on public.push_subscriptions (barbero_id);
create index if not exists push_subs_sede_idx    on public.push_subscriptions (sede_id);

-- RLS: cada quien administra las suyas y no ve las de nadie más. La escritura
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

drop policy if exists "Sede ve sus suscripciones" on public.push_subscriptions;
create policy "Sede ve sus suscripciones"
  on public.push_subscriptions for select
  using (sede_id is not null and sede_id = public.current_sede_id());

drop policy if exists "Sede borra sus suscripciones" on public.push_subscriptions;
create policy "Sede borra sus suscripciones"
  on public.push_subscriptions for delete
  using (sede_id is not null and sede_id = public.current_sede_id());

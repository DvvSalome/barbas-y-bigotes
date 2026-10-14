-- 0083 — El aviso de cita nueva también le llega al celular del dueño (14-oct).
--
-- Al reservar alguien por la web, el push iba al mostrador (sede) y al barbero.
-- El dueño (perfil admin) no tiene sede ni ficha de barbero, así que no había a
-- quién atar la suscripción de su celular: guardarPushStaff lo rechazaba y nunca
-- se enteraba. Ahora la suscripción puede ser de un admin, por su usuario.

alter table public.push_subscriptions
  add column if not exists admin_auth uuid references auth.users (id) on delete cascade;

-- Sigue siendo UN dueño por suscripción, ahora con cuatro opciones.
alter table public.push_subscriptions drop constraint if exists push_sub_dueno_unico;
alter table public.push_subscriptions
  add constraint push_sub_dueno_unico check (num_nonnulls(cliente_ref, barbero_id, sede_id, admin_auth) = 1);

create index if not exists push_subscriptions_admin on public.push_subscriptions (admin_auth)
  where admin_auth is not null;

-- Sin políticas nuevas: las del admin se escriben y leen solo con service role
-- (guardarPushStaff / pushAAdmins), igual que las del staff.

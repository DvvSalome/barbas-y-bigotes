-- 0074 — Qué ve un barbero de su propia plata.
--
-- Singleton con id fijo en 1, igual que ajustes_avisos (0038) y ajustes_tarjeta
-- (0064): es una política del negocio, no algo por sede. Si algún día hace falta
-- por sede, se migra.
--
-- Lo de HOY el barbero lo ve siempre y no se configura: es lo que acaba de hacer
-- con sus propias manos y no tiene nada de secreto. Lo de la SEMANA es distinto,
-- porque es lo que va a cobrar el sábado: hay locales donde tenerlo a la vista
-- baja las preguntas a cero y otros donde abre discusiones a mitad de jornada.
-- Por eso arranca APAGADO y lo prende el dueño en Admin → Equipo.
create table if not exists public.ajustes_equipo (
  id                int primary key default 1,
  barbero_ve_semana boolean not null default false,
  actualizado_en    timestamptz not null default now(),
  constraint ajustes_equipo_singleton check (id = 1)
);

insert into public.ajustes_equipo (id) values (1) on conflict (id) do nothing;

alter table public.ajustes_equipo enable row level security;

-- Leer: cualquier staff (el mostrador necesita saber si mostrar el bloque).
-- Escribir: solo el dueño.
drop policy if exists ajustes_equipo_sel on public.ajustes_equipo;
create policy ajustes_equipo_sel on public.ajustes_equipo
  for select using (public.is_staff());

drop policy if exists ajustes_equipo_admin on public.ajustes_equipo;
create policy ajustes_equipo_admin on public.ajustes_equipo
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.ajustes_equipo to authenticated;
grant all on public.ajustes_equipo to service_role;

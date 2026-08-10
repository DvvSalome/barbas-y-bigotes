-- 0048 — Horario base semanal por sede (editable desde el admin).
--
-- Hasta ahora el horario (9:00-20:00, lun-sáb, domingo cerrado) estaba QUEMADO en
-- el código (OPEN/CLOSE en slots.ts). El dueño cambia horarios seguido y no había
-- forma de tocarlos sin desplegar. Esta tabla lo vuelve dato: una fila por día de
-- la semana y sede. Junto con sede_dias_especiales (0034, excepciones por fecha),
-- el horario real de un día se resuelve en cascada: excepción → semana → respaldo.
--
-- dow = día de la semana estilo Postgres/JS: 0=domingo … 6=sábado.
-- abre_min/cierra_min = minutos desde medianoche (540 = 9:00, 1200 = 20:00).
--
-- NO ejecutar desde la app: se aplica en el SQL Editor de Supabase.

create table if not exists public.sede_horario_semanal (
  sede_id     text not null references public.sedes(id) on delete cascade,
  dow         smallint not null check (dow between 0 and 6),
  abierta     boolean not null default true,
  abre_min    int not null default 540,
  cierra_min  int not null default 1200,
  actualizado_en timestamptz not null default now(),
  primary key (sede_id, dow),
  constraint horario_semanal_coherente check (
    abre_min >= 0 and cierra_min <= 1440 and abre_min < cierra_min
  )
);

alter table public.sede_horario_semanal enable row level security;

-- Lectura pública: el wizard arma el calendario con esto (no expone PII).
drop policy if exists sede_horario_sel on public.sede_horario_semanal;
create policy sede_horario_sel on public.sede_horario_semanal for select using (true);

-- Escritura solo admin.
drop policy if exists sede_horario_admin on public.sede_horario_semanal;
create policy sede_horario_admin on public.sede_horario_semanal
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.sede_horario_semanal to anon, authenticated;

-- Seed: EXACTAMENTE el comportamiento actual, para que el deploy no cambie nada.
-- lun-sáb (dow 1-6) abierto 9:00-20:00; domingo (dow 0) cerrado. Ambas sedes.
-- on conflict do nothing: idempotente y no pisa un horario ya ajustado por el dueño.
insert into public.sede_horario_semanal (sede_id, dow, abierta, abre_min, cierra_min)
select s.id, d.dow, (d.dow <> 0), 540, 1200
from public.sedes s
cross join (select generate_series(0, 6) as dow) d
on conflict (sede_id, dow) do nothing;

-- Que PostgREST vea la tabla nueva de una (si no, la API la da por inexistente
-- hasta que recargue el cache del esquema por su cuenta).
notify pgrst, 'reload schema';

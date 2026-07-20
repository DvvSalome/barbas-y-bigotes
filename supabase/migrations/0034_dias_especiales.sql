-- 0034 — Días especiales por sede: abrir un domingo/festivo, o cerrar un día hábil.
-- Hasta ahora "domingo cerrado" y el horario 9-20 estaban quemados en el código, así
-- que si el dueño abría un domingo NADIE podía reservar (plata perdida) y si cerraba
-- por un festivo la app seguía tomando citas.
--
-- Regla: el default sigue siendo lun-sáb 9:00-20:00. Esta tabla son EXCEPCIONES:
--   abierta = true  → ese día se atiende aunque sea domingo/festivo.
--   abierta = false → ese día NO se atiende aunque sea hábil.
-- Quién trabaja ese día especial se resuelve con barbero_ausencias (0030): el dueño
-- abre la sede y marca ausente a quien no vaya.
create table if not exists public.sede_dias_especiales (
  id         uuid primary key default gen_random_uuid(),
  sede_id    text not null references public.sedes(id) on delete cascade,
  fecha      date not null,
  abierta    boolean not null,
  motivo     text,
  -- Horario propio del día (minutos desde medianoche). NULL = el de siempre.
  abre_min   int,
  cierra_min int,
  creado_en  timestamptz not null default now(),
  unique (sede_id, fecha),
  constraint horario_coherente check (
    (abre_min is null and cierra_min is null)
    or (abre_min is not null and cierra_min is not null and abre_min < cierra_min
        and abre_min >= 0 and cierra_min <= 1440)
  )
);

alter table public.sede_dias_especiales enable row level security;

-- Lectura pública: el wizard arma el calendario con esto (no expone PII).
drop policy if exists sede_dias_sel on public.sede_dias_especiales;
create policy sede_dias_sel on public.sede_dias_especiales for select using (true);

-- Escritura solo admin.
drop policy if exists sede_dias_admin on public.sede_dias_especiales;
create policy sede_dias_admin on public.sede_dias_especiales
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.sede_dias_especiales to anon, authenticated;
grant all on public.sede_dias_especiales to service_role;

create index if not exists sede_dias_fecha_idx
  on public.sede_dias_especiales (fecha, sede_id);

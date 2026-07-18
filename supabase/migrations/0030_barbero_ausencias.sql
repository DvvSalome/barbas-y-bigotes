-- 0030 — Ausencias de barbero: el admin marca que un barbero no atiende una fecha.
-- El booking público deja de ofrecer/permitir reservas con él ese día (sus horarios
-- se bloquean; "cualquier barbero" lo excluye solo). No toca las citas ya creadas
-- de ese día (el admin las maneja a mano desde la agenda). MVP del bloque F4.
create table if not exists public.barbero_ausencias (
  id         uuid primary key default gen_random_uuid(),
  barbero_id uuid not null references public.barberos(id) on delete cascade,
  fecha      date not null,
  motivo     text,
  creado_en  timestamptz not null default now(),
  unique (barbero_id, fecha)
);

alter table public.barbero_ausencias enable row level security;

-- Lectura pública (catálogo, como barberos/sedes): el wizard público filtra al
-- barbero ausente. No expone PII (solo barbero + fecha).
drop policy if exists barbero_ausencias_sel on public.barbero_ausencias;
create policy barbero_ausencias_sel on public.barbero_ausencias
  for select using (true);

-- Escritura solo admin (is_admin() del modelo RLS, migración 0008).
drop policy if exists barbero_ausencias_admin on public.barbero_ausencias;
create policy barbero_ausencias_admin on public.barbero_ausencias
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.barbero_ausencias to anon, authenticated;
grant all on public.barbero_ausencias to service_role;

create index if not exists barbero_ausencias_fecha_idx
  on public.barbero_ausencias (fecha, barbero_id);

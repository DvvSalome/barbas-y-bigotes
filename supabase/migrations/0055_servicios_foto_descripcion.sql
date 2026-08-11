-- 0055 — Foto y descripción REALES del servicio (el cliente decide viéndolas).
-- Antes el wizard rotaba 4 fotos genéricas por posición (a "Cejas" le tocaba un
-- corte) y no había ni una línea de qué incluye cada servicio.

alter table public.servicios
  add column if not exists foto_url text,
  add column if not exists descripcion text;

-- Bucket público de fotos de servicios (mismo modelo que 'productos' en 0019:
-- lectura pública; escritura solo service role tras server action con requireAdmin).
insert into storage.buckets (id, name, public) values ('servicios', 'servicios', true)
on conflict (id) do nothing;

notify pgrst, 'reload schema';

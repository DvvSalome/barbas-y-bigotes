-- 0058 — Foto propia por sede (la fachada que ve el cliente al elegir dónde).
-- Antes las dos fotos vivían hardcodeadas en el wizard y una sede NUEVA salía
-- con un bloque neutro (y antes de eso, con la fachada de Parque Venezuela).
-- Mismo modelo que productos (0019) y servicios (0055): bucket público de
-- lectura; escritura solo service role tras server action con requireAdmin.

alter table public.sedes add column if not exists foto_url text;

insert into storage.buckets (id, name, public) values ('sedes', 'sedes', true)
on conflict (id) do nothing;

notify pgrst, 'reload schema';

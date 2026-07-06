-- 0019 — Fotos de productos del inventario (POS con foto real, como WeiBook).
-- NO ejecutada todavía: se aplica junto con el deploy del Bloque 6.

alter table public.productos add column if not exists foto_url text;

-- Bucket público de fotos de productos (lectura pública; escritura solo service role,
-- el upload pasa por server action con requireAdmin).
insert into storage.buckets (id, name, public) values ('productos', 'productos', true)
on conflict (id) do nothing;

-- 0040 — Codifica en el repo la policy de lectura pública de `barberos`.
-- La auditoría (AUD-C-001) señaló que ninguna migración creaba una policy de
-- SELECT para barberos aunque la tabla tiene RLS. Al revisar prod SÍ existe
-- (`public_read_barberos`, PERMISSIVE, `for select to public using (true)`), y
-- por eso el sitio público muestra el equipo — pero se aplicó a mano, nunca se
-- versionó. Sin esto, reconstruir la DB desde las migraciones dejaría el
-- catálogo público de barberos VACÍO (RLS on + sin policy = deny-all).
--
-- Idempotente y SIN ventana de riesgo en prod: NO dropea la policy viva (eso
-- dejaría `barberos` deny-all por un instante y el sitio mostraría 0 barberos);
-- solo la crea si falta. USING(true) = el listado es público, como ya lo es en
-- la web. La lectura es solo del catálogo (nombre, foto, especialidades); la PII
-- sensible vive en otras tablas con su propia RLS.
-- Aplicar manualmente en el SQL Editor (Claude no corre DDL en prod).

alter table public.barberos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'barberos'
      and policyname = 'public_read_barberos'
  ) then
    create policy public_read_barberos
      on public.barberos
      for select
      to public
      using (true);
  end if;
end $$;

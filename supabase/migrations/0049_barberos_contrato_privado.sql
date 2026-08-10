-- 0049 — Cierra la fuga de datos del contrato de barberos (auditoría, hallazgo #01).
--
-- La policy public_read_barberos (0040) es `for select to public using(true)`, y la
-- RLS de Postgres es por FILA, no por columna: cualquiera con la anon key podía leer
-- tipo_contrato, comision_pct y arriendo_mensual de TODAS las sedes por el REST
-- (GET /rest/v1/barberos?select=comision_pct,arriendo_mensual). Esas 3 columnas son
-- el reparto de plata del local: dato confidencial de negocio.
--
-- OJO (esto se aprendió aplicando la 1ª versión): un `revoke select (col) ... from`
-- NO sirve cuando existe un GRANT de SELECT a nivel de TABLA (el default de Supabase
-- `grant all on all tables to anon, authenticated` lo tiene), porque el grant de
-- tabla ya cubre TODA columna y el revoke de columna es un no-op silencioso. La única
-- forma de ocultar columnas es: REVOCAR el SELECT de tabla y volver a GRANTear SELECT
-- SOLO en las columnas públicas.
--
-- El catálogo público (nombre, foto, especialidades, rating, bio) sigue abierto. El
-- admin lee el contrato por service_role (getBarberosContrato, que antes verifica
-- rol='admin') y lo edita con actualizarContratoBarbero (que solo hace .select('id')).
-- postgres y service_role no se tocan. Aplicar manualmente en el SQL Editor.
--
-- REQUISITO DE ORDEN: aplicar SOLO después de desplegar el código que quita esas
-- columnas de getBarberos; si no, el getBarberos viejo (que las pide con la anon key)
-- daría "permission denied for column" y rompería la web.

revoke select on public.barberos from anon, authenticated;

grant select (id, profile_id, nombre, sede_id, foto_url, destacado, activo, orden, rating, resenas, creado_en, bio)
  on public.barberos to anon, authenticated;

-- Que PostgREST recargue los privilegios de columna.
notify pgrst, 'reload schema';

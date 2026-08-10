-- 0049 — Cierra la fuga de datos del contrato de barberos (auditoría, hallazgo #01).
--
-- La policy public_read_barberos (0040) es `for select to public using(true)`, y la
-- RLS de Postgres es por FILA, no por columna: cualquiera con la anon key podía leer
-- tipo_contrato, comision_pct y arriendo_mensual de TODAS las sedes por el REST
-- (GET /rest/v1/barberos?select=comision_pct,arriendo_mensual). Esas 3 columnas son
-- el reparto de plata del local: dato confidencial de negocio.
--
-- Fix a nivel de COLUMNA (lo único que Postgres puede hacer para ocultar columnas):
-- se revoca su SELECT a anon y authenticated. El catálogo público (nombre, foto,
-- especialidades, rating, bio) sigue abierto. El admin las lee por service_role
-- (getBarberosContrato, que ANTES verifica rol='admin') y las edita con
-- actualizarContratoBarbero (que solo hace .select('id'), no lee estas columnas).
--
-- No toca la policy viva (sin ventana deny-all). Idempotente: REVOKE de un permiso
-- ya ausente no falla. Aplicar manualmente en el SQL Editor.

revoke select (tipo_contrato, comision_pct, arriendo_mensual)
  on public.barberos from anon, authenticated;

-- Que PostgREST recargue los privilegios de columna.
notify pgrst, 'reload schema';

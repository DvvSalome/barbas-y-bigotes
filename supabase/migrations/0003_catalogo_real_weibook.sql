-- 0003_catalogo_real_weibook.sql — Barbas & Bigotes
-- Alinea el catálogo a los datos REALES extraídos de la cuenta WeiBook del cliente
-- (2026-06-18). Decisión de Adrián: son 2 sedes, WeiBook solo tiene cargada una
-- (Plaza de la Paz = cra 45 #53-130, barberos Brayan/Kevin/Abel). Parque Venezuela
-- es la 2ª sede, su data real queda PENDIENTE del cliente (acá se espeja la de Plaza
-- como placeholder).

-- ---------- columna bio para el perfil público del barbero ----------
alter table public.barberos add column if not exists bio text;

-- ---------- 1) ocultar el catálogo inventado (no se borra por las FK de pruebas) ----------
update public.servicios set activo = false;

-- ---------- 2) upsert de los 9 servicios reales de WeiBook ----------
insert into public.servicios (id, nombre, categoria, duracion_min, es_combo, desde, activo) values
  ('corte',                        'Corte',                          'cortes',  30, false, false, true),
  ('corte-barba',                  'Corte y barba',                  'combos',  45, true,  false, true),
  ('perfilamiento-barba',          'Perfilamiento de barba',         'barba',   20, false, false, true),
  ('corte-cejas',                  'Corte y cejas',                  'combos',  40, true,  false, true),
  ('corte-barba-cejas',            'Corte + barba + cejas',          'combos',  50, true,  false, true),
  ('cerquillo',                    'Cerquillo',                      'cortes',  15, false, false, true),
  ('cerquillo-barba',              'Cerquillo + barba',              'combos',  35, true,  false, true),
  ('limpieza-facial-silver',       'Limpieza facial silver',         'faciales',30, false, false, true),
  ('corte-limpieza-facial-silver', 'Corte + limpieza facial silver', 'combos',  60, true,  false, true)
on conflict (id) do update set
  nombre       = excluded.nombre,
  categoria    = excluded.categoria,
  duracion_min = excluded.duracion_min,
  es_combo     = excluded.es_combo,
  desde        = excluded.desde,
  activo       = true;

-- ---------- 3) precios por sede ----------
-- Plaza de la Paz = precios reales de WeiBook. Parque Venezuela = espejo (placeholder
-- hasta tener la data real de la 2ª sede).
insert into public.servicio_sede (servicio_id, sede_id, precio, disponible) values
  ('corte',                        'plaza-de-la-paz', 30000, true),
  ('corte-barba',                  'plaza-de-la-paz', 40000, true),
  ('perfilamiento-barba',          'plaza-de-la-paz', 20000, true),
  ('corte-cejas',                  'plaza-de-la-paz', 35000, true),
  ('corte-barba-cejas',            'plaza-de-la-paz', 45000, true),
  ('cerquillo',                    'plaza-de-la-paz', 10000, true),
  ('cerquillo-barba',              'plaza-de-la-paz', 30000, true),
  ('limpieza-facial-silver',       'plaza-de-la-paz', 20000, true),
  ('corte-limpieza-facial-silver', 'plaza-de-la-paz', 50000, true),
  ('corte',                        'parque-venezuela', 30000, true),
  ('corte-barba',                  'parque-venezuela', 40000, true),
  ('perfilamiento-barba',          'parque-venezuela', 20000, true),
  ('corte-cejas',                  'parque-venezuela', 35000, true),
  ('corte-barba-cejas',            'parque-venezuela', 45000, true),
  ('cerquillo',                    'parque-venezuela', 10000, true),
  ('cerquillo-barba',              'parque-venezuela', 30000, true),
  ('limpieza-facial-silver',       'parque-venezuela', 20000, true),
  ('corte-limpieza-facial-silver', 'parque-venezuela', 50000, true)
on conflict (servicio_id, sede_id) do update set
  precio = excluded.precio,
  disponible = true;

-- ---------- 4) roster real de Plaza de la Paz (coincide con WeiBook) ----------
update public.barberos set nombre = 'Bryan García', destacado = true,
  bio = 'Especialista en cortes clásicos y degradados, perfilamiento de barba y diseños.'
  where id = 'affeca61-4c92-4598-9491-2d3d0cb98cdd';

update public.barberos set nombre = 'Kevin Valencia', destacado = true,
  bio = '4 años de experiencia, realiza todo tipo de cortes de cabello y perfilamientos de barba.'
  where id = '58e9c8bb-03b1-44d1-a4a8-1a911f3f3150';

update public.barberos set nombre = 'Abel Barbers',
  bio = 'Cortes, barba y limpieza facial. Atención detallista de principio a fin.'
  where id = 'cbbe0ee9-1b89-4c40-8d14-2cc92f039b7d';

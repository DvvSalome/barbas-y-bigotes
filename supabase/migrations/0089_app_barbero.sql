-- 0089 — La app PROPIA de cada barbero: barberos.slug → /equipo/<slug>.
--
-- Pedido del dueño (17-oct): "que los barberos tengan la aplicación en su
-- celular: que si le dan a «agregar al inicio», tengan su ruta dedicada para que
-- se abran sus cuentas". Cada barbero tiene una ruta fija (/equipo/meyer) con su
-- propio manifiesto; lo que se instala desde ahí abre en SU teclado de PIN.
--
-- El slug es FIJO: no cambia aunque el dueño le cambie el nombre en la ficha,
-- porque es la dirección de la app que el barbero ya instaló. Por eso va en una
-- columna y no se calcula del nombre cada vez.
--
-- Regla (la MISMA que slugBase() en src/lib/app-personal.ts, con su chequeo en
-- scripts/check-app-personal.ts): sin tildes, minúsculas, guiones, 40 letras
-- como mucho; vacío → "barbero"; si empieza por "mostrador" va con "barbero-"
-- delante (/equipo/mostrador-<sede> es de los mostradores). Si choca: -2, -3…
-- El backfill asigna en el mismo orden que el código usa ANTES de esta
-- migración (activos primero, el más antiguo primero, después por id): un
-- enlace mandado antes de aplicarla sigue siendo el mismo después.
--
-- Hoy (18-oct) da: meyer, jhon, junior, bryan-garcia, kevin-valencia, abel-barbers.
--
-- ORDEN RESPECTO AL DEPLOY: cualquiera. El código vive sin la columna (calcula el
-- mismo slug desde el nombre) y esta migración no rompe el código viejo (el
-- alta vieja no manda slug y el trigger lo pone). Recomendado: aplicarla ANTES
-- de mandar los enlaces por WhatsApp, para que un cambio de nombre posterior no
-- los mueva.
--
-- Idempotente. Funciones con search_path = '' y todo calificado con esquema.

alter table public.barberos add column if not exists slug text;

-- La base del slug para un nombre.
create or replace function public.slug_barbero_base(p_nombre text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when s.v like 'mostrador%' then 'barbero-' || s.v else s.v end
  from (
    select coalesce(nullif(trim(both '-' from left(trim(both '-' from
      regexp_replace(lower(translate(coalesce(p_nombre, ''),
        'áàäâãåÁÀÄÂÃÅéèëêÉÈËÊíìïîÍÌÏÎóòöôõÓÒÖÔÕúùüûÚÙÜÛñÑçÇýÿÝŸ',
        'aaaaaaaaaaaaeeeeeeeeiiiiiiiioooooooooouuuuuuuunnccyyyy')), '[^a-z0-9]+', '-', 'g')), 40)), ''), 'barbero') as v
  ) s
$$;

-- El primer slug libre para ese nombre: base, base-2, base-3… (sin contar la fila p_id).
create or replace function public.slug_barbero_libre(p_nombre text, p_id uuid default null)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_base text := public.slug_barbero_base(p_nombre);
  v_slug text := v_base;
  v_n int := 2;
begin
  while exists (select 1 from public.barberos b where b.slug = v_slug and b.id is distinct from p_id) loop
    v_slug := v_base || '-' || v_n;
    v_n := v_n + 1;
  end loop;
  return v_slug;
end
$$;

-- Red de seguridad: una ficha creada sin slug (SQL a mano, o el alta de antes
-- de este deploy) lo recibe sola. El alta nueva (crearBarbero) ya lo manda.
create or replace function public.barberos_slug_por_defecto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := public.slug_barbero_libre(new.nombre, new.id);
  end if;
  return new;
end
$$;

drop trigger if exists barberos_slug_por_defecto on public.barberos;
create trigger barberos_slug_por_defecto
  before insert on public.barberos
  for each row execute function public.barberos_slug_por_defecto();

-- Backfill, en el orden de asignarSlugs() (src/lib/app-personal.ts).
do $$
declare
  r record;
begin
  for r in
    select id, nombre from public.barberos
    where slug is null or btrim(slug) = ''
    order by (activo is not false) desc, creado_en asc nulls last, id asc
  loop
    update public.barberos set slug = public.slug_barbero_libre(r.nombre, r.id) where id = r.id;
  end loop;
end
$$;

alter table public.barberos alter column slug set not null;
create unique index if not exists barberos_slug_key on public.barberos (slug);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'barberos_slug_formato') then
    alter table public.barberos
      add constraint barberos_slug_formato check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60);
  end if;
end
$$;

-- El slug es público (va en la URL de su app): anon lo lee igual que el nombre.
-- 0049 dejó el SELECT de barberos por COLUMNA: sin esto, getDestinoApp no lo ve.
grant select (slug) on public.barberos to anon, authenticated;

notify pgrst, 'reload schema';

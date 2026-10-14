-- 0084 · Avisos para el DUEÑO, que él mismo configura (14-oct).
--
-- Hasta acá el dueño no tenía dónde poner su correo: el resumen del cierre de
-- caja iba a un Gmail de FourG escrito a mano en n8n (workflow rruRsSSVLGnVguZF,
-- vista v_cierres_caja_pendientes) y desde septiembre ni siquiera quedaba
-- marcado; "la caja sigue abierta" solo iba al aparato de la sede, y una
-- calificación de 1 estrella no le llegaba a nadie. Cambiar el destinatario
-- era trabajo de un desarrollador.
--
-- Ahora:
--   · avisos_dueno      — los correos del dueño (hasta 5, lo frena la action) y
--                          qué recibe cada uno. Lo edita él en /admin/avisos.
--   · aviso_dueno_cola  — lo que hay que avisarle. La llenan la app (cita nueva,
--                          calificación baja, caja abierta, prueba) y el trigger
--                          de abajo (cierre de caja).
--   · tomar_avisos_dueno() — n8n toma y marca en UNA sentencia (sin el nodo
--                          "Marcar avisado" que ya falló) y recibe una fila por
--                          aviso × destinatario que lo tiene prendido.
--
-- Las dos tablas son de service role: RLS prendida, sin políticas, y sin
-- privilegios para anon/authenticated. La app las lee y escribe con
-- supabaseAdmin() SOLO después de confirmar que quien pide es admin.
--
-- La cola lleva datos de clientes (nombre, teléfono, nota, comentario): se borra
-- a los 7 días y eliminar_cuenta_cliente (0072, reemplazada al final) borra las
-- filas del cliente que pide eliminar su cuenta.
--
-- Idempotente: se puede correr dos veces.

-- 1 · A quién le llegan los avisos del dueño ---------------------------------

create table if not exists public.avisos_dueno (
  id uuid primary key default gen_random_uuid(),
  -- Guardado en minúsculas y sin espacios: el unique no deja meter el mismo
  -- correo dos veces escrito distinto.
  email text not null unique
    constraint avisos_dueno_email_limpio check (email = lower(btrim(email)) and position('@' in email) > 1),
  recibe_citas   boolean not null default true,  -- cada cliente que reserva por la web
  recibe_cierres boolean not null default true,  -- el resumen de cada cierre de caja
  recibe_alertas boolean not null default true,  -- caja abierta y calificaciones bajas
  creado_en timestamptz not null default now()
);

alter table public.avisos_dueno enable row level security;
revoke all on public.avisos_dueno from anon, authenticated;

-- 2 · La cola ------------------------------------------------------------------

create table if not exists public.aviso_dueno_cola (
  id bigint generated always as identity primary key,
  tipo text not null
    constraint aviso_dueno_cola_tipo check (tipo in ('cita', 'cierre', 'caja_abierta', 'resena_baja', 'prueba')),
  -- Lo que necesita el correo, ya resuelto (nombres, montos, fechas ISO): el
  -- nodo Code de n8n no vuelve a consultar nada.
  datos jsonb not null default '{}'::jsonb,
  -- Solo para 'prueba': el correo que el dueño escribió y quiere probar (puede
  -- no estar guardado todavía, igual que la prueba del correo del barbero).
  solo_email text,
  -- El cliente del que habla el aviso ('cita', 'resena_baja'): `datos` lleva su
  -- nombre, teléfono, nota o comentario, y eliminar_cuenta_cliente (más abajo)
  -- tiene que poder encontrar y borrar esas filas. Sin FK a propósito: no debe
  -- frenar ni el unir_clientes de 0078 ni ningún borrado de clientes.
  cliente_ref uuid,
  creado_en timestamptz not null default now(),
  tomado_en timestamptz,
  constraint aviso_dueno_cola_prueba_con_correo check (tipo <> 'prueba' or solo_email is not null)
);
alter table public.aviso_dueno_cola add column if not exists cliente_ref uuid;

alter table public.aviso_dueno_cola enable row level security;
revoke all on public.aviso_dueno_cola from anon, authenticated;
revoke all on sequence public.aviso_dueno_cola_id_seq from anon, authenticated;

-- Lo que mira n8n en cada vuelta: solo lo pendiente.
create index if not exists aviso_dueno_cola_pendientes
  on public.aviso_dueno_cola (creado_en) where tomado_en is null;
-- El freno de "una prueba por correo por minuto" busca por correo.
create index if not exists aviso_dueno_cola_prueba
  on public.aviso_dueno_cola (solo_email, creado_en) where solo_email is not null;

-- La cola NO es un archivo: lleva nombre, teléfono, nota y comentario de clientes
-- en `datos`. A los 7 días (tomado o no) se borra. Lo hacen dos lados para que no
-- dependa de que n8n esté corriendo: tomar_avisos_dueno() en cada vuelta y un
-- trigger por sentencia en cada encolado.
create or replace function public.purgar_aviso_dueno_cola()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.aviso_dueno_cola
   where coalesce(tomado_en, creado_en) < now() - interval '7 days';
  return null;
end $$;

revoke all on function public.purgar_aviso_dueno_cola() from public, anon, authenticated;

drop trigger if exists trg_aviso_dueno_cola_purga on public.aviso_dueno_cola;
create trigger trg_aviso_dueno_cola_purga
  after insert on public.aviso_dueno_cola
  for each statement
  execute function public.purgar_aviso_dueno_cola();

-- 3 · n8n toma y marca --------------------------------------------------------
--
-- Una fila por (aviso × destinatario que tiene ese tipo prendido):
--   cita          → recibe_citas
--   cierre        → recibe_cierres
--   caja_abierta  → recibe_alertas
--   resena_baja   → recibe_alertas
--   prueba        → SOLO solo_email (el correo que se está probando)
-- Un aviso sin nadie que lo quiera se marca igual: no se acumula esperando a que
-- aparezca un correo días después.
--
-- Lo que tiene más de un día ya no se manda (una "cita nueva" de anteayer es
-- ruido). Las alertas no despiertan a nadie: de 9:30 pm a 7 am esperan; la cita,
-- el cierre y la prueba salen apenas n8n pasa.

create or replace function public.tomar_avisos_dueno()
returns table (aviso_id bigint, tipo text, datos jsonb, email text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hora time := (now() at time zone 'America/Bogota')::time;
begin
  -- Retención (ver purgar_aviso_dueno_cola): lo de más de 7 días se va.
  delete from public.aviso_dueno_cola
   where coalesce(tomado_en, creado_en) < now() - interval '7 days';

  return query
  with tomados as (
    update public.aviso_dueno_cola c
       set tomado_en = now()
     where c.tomado_en is null
       and c.creado_en > now() - interval '1 day'
       and (c.tipo in ('cita', 'cierre', 'prueba') or v_hora between time '07:00' and time '21:30')
    returning c.id, c.tipo, c.datos, c.solo_email
  )
  select t.id, t.tipo, t.datos, t.solo_email
    from tomados t
   where t.tipo = 'prueba'
  union all
  select t.id, t.tipo, t.datos, d.email
    from tomados t
    join public.avisos_dueno d
      on case t.tipo
           when 'cita'         then d.recibe_citas
           when 'cierre'       then d.recibe_cierres
           when 'caja_abierta' then d.recibe_alertas
           when 'resena_baja'  then d.recibe_alertas
           else false
         end
   where t.tipo <> 'prueba';
end $$;

revoke all on function public.tomar_avisos_dueno() from public, anon, authenticated;
grant execute on function public.tomar_avisos_dueno() to service_role;

-- 4 · El cierre de caja se encola solo ------------------------------------------
--
-- Cualquier cierre (el del mostrador, el del barbero o el del panel) pasa por el
-- update a estado 'cerrada' de ejecutarCierreCaja: el trigger lo ve ahí y deja en
-- la cola todo lo que el correo necesita, con los nombres de los medios de pago
-- ya resueltos. Si algo falla al encolar, el cierre NO se cae: se deja un warning
-- y la caja queda cerrada igual (el aviso vale menos que el cuadre).

create or replace function public.encolar_cierre_para_dueno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if NEW.estado = 'cerrada' and OLD.estado is distinct from 'cerrada' then
    begin
      insert into public.aviso_dueno_cola (tipo, datos)
      select 'cierre',
             jsonb_build_object(
               'sesion_id',        NEW.id,
               'sede_id',          NEW.sede_id,
               'sede',             coalesce(s.nombre, NEW.sede_id),
               'abierta_en',       NEW.abierta_en,
               'cerrada_en',       coalesce(NEW.cerrada_en, now()),
               'monto_apertura',   NEW.monto_apertura,
               'total_efectivo',   NEW.total_efectivo,
               'total_datafono',   NEW.total_datafono,
               'totales',          coalesce(NEW.totales, '{}'::jsonb),
               -- El desglose con el NOMBRE de cada medio ("Nequi", no "nequi"),
               -- en el orden en que salen en el cobro.
               'medios', (
                 select coalesce(jsonb_agg(jsonb_build_object(
                          'medio',   e.key,
                          'nombre',  coalesce(m.nombre, e.key),
                          'total',   coalesce((e.value ->> 'total')::numeric, 0),
                          'propina', coalesce((e.value ->> 'propina')::numeric, 0))
                          order by coalesce(m.orden, 999), e.key), '[]'::jsonb)
                   from jsonb_each(
                          case when jsonb_typeof(NEW.totales) = 'object' then NEW.totales else '{}'::jsonb end
                        ) e
                   left join public.medios_pago m on m.slug = e.key
               ),
               'total_gastos',     NEW.total_gastos,
               'citas',            NEW.citas,
               'efectivo_contado', NEW.efectivo_contado,
               'diferencia',       NEW.diferencia,
               'nota',             nullif(btrim(coalesce(NEW.nota, '')), ''),
               -- Quién cerró: el perfil (mostrador o barbero con su login) o la
               -- ficha del barbero. El cierre desde el panel no lo guarda: null.
               'cerrada_por',      coalesce(p.nombre, b.nombre)
             )
        from (select 1) uno
        left join public.sedes s    on s.id = NEW.sede_id
        left join public.profiles p on p.id = NEW.cerrada_por
        left join public.barberos b on b.id = NEW.cerrada_por_barbero;
    exception when others then
      raise warning 'encolar_cierre_para_dueno: % (%)', sqlerrm, sqlstate;
    end;
  end if;
  return null;
end $$;

revoke all on function public.encolar_cierre_para_dueno() from public, anon, authenticated;

drop trigger if exists trg_cierre_para_dueno on public.caja_sesiones;
create trigger trg_cierre_para_dueno
  after update of estado on public.caja_sesiones
  for each row
  when (NEW.estado = 'cerrada' and OLD.estado is distinct from 'cerrada')
  execute function public.encolar_cierre_para_dueno();

-- 5 · «Eliminar mi cuenta» también borra lo que la cola dice del cliente ---------
--
-- Definición vigente en producción (14-oct = 0072, leída con pg_get_functiondef)
-- con UNA línea más: el delete de aviso_dueno_cola por cliente_ref. La cita nueva
-- y la calificación baja guardan ahí su nombre, teléfono, nota y comentario, y la
-- función promete borrar justamente eso (Ley 1581, Google Play).

create or replace function public.eliminar_cuenta_cliente(p_auth_id uuid)
returns table (cliente_id uuid, citas_canceladas integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_canceladas int := 0;
begin
  select c.id into v_id from public.clientes c where c.auth_id = p_auth_id;
  if v_id is null then
    -- Sin ficha (nunca reservó): no hay nada que anonimizar; la app borra el Auth igual.
    return;
  end if;

  update public.reservas r
     set estado = 'cancelada', nota = null
   where r.cliente_ref = v_id
     and r.estado in ('pendiente', 'confirmada')
     and r.inicio > now();
  get diagnostics v_canceladas = row_count;

  update public.reservas r set nota = null
   where r.cliente_ref = v_id and r.nota is not null;

  update public.ventas v set cliente_nombre = null
   where v.cliente_ref = v_id and v.cliente_nombre is not null;

  delete from public.cliente_notas where cliente_ref = v_id;
  delete from public.push_subscriptions where cliente_ref = v_id;
  -- 0084: los avisos al dueño que hablan de este cliente.
  delete from public.aviso_dueno_cola where cliente_ref = v_id;

  delete from public.lista_espera
   where cliente_ref = v_id and estado in ('esperando', 'notificado');
  update public.lista_espera
     set cliente_nombre = null, telefono = null, nota = null
   where cliente_ref = v_id;

  update public.cliente_resenas set nota = null where cliente_ref = v_id and nota is not null;
  update public.resenas_servicio set comentario = null where cliente_ref = v_id and comentario is not null;

  update public.clientes c
     set nombre = 'Cliente eliminado',
         telefono = null,
         email = null,
         auth_id = null,
         notas = null,
         acepta_marketing = false,
         baja_en = coalesce(c.baja_en, now()),
         -- Se rota para que los enlaces de baja viejos dejen de apuntar a alguien.
         marketing_token = gen_random_uuid()
   where c.id = v_id;

  update public.profiles p
     set nombre = 'Cliente eliminado', telefono = null, email = null, auth_id = null
   where p.auth_id = p_auth_id and p.rol = 'cliente';

  return query select v_id, v_canceladas;
end;
$$;

revoke all on function public.eliminar_cuenta_cliente(uuid) from public, anon, authenticated;
grant execute on function public.eliminar_cuenta_cliente(uuid) to service_role;

notify pgrst, 'reload schema';

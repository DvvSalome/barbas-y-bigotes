-- 0087 · Alta y baja de barberos desde la app (14-oct).
--
-- El dueño pidió que "todo sea autogestionable, por si más adelante tienen otros
-- barberos". La app ya crea y da de baja barberos (src/lib/equipo-actions.ts);
-- esto es lo que la base tiene que poner de su parte:
--
--   1. UN BARBERO DADO DE BAJA NO VE NADA. Hasta acá ninguna barrera miraba
--      barberos.activo: is_staff() solo pedía el rol (0044) y current_barbero_id()
--      leía profiles sin más (0010). Con la sesión que le quedaba viva en el
--      celular seguía leyendo, por RLS, el nombre y el teléfono de todos los
--      clientes que atendió (clientes_barbero_select), sus ventas y la lista de
--      espera. Ahora las dos exigen que su ficha esté ACTIVA. El admin y el
--      mostrador de cada sede (rol 'sede') no cambian.
--      Las definiciones de abajo son las vigentes en producción (leídas con
--      pg_get_functiondef el 14-oct) con ese único agregado.
--
--   2. CERRARLE LAS SESIONES. Supabase no tiene "cerrar las sesiones de un
--      usuario" en su API de admin (signOut pide el token del propio usuario).
--      La app lo banea —así no renueva el token ni vuelve a entrar— y además
--      llama a esta función para borrar sus sesiones: el token que le quedaba deja
--      de valer en la siguiente lectura en vez de vivir hasta una hora más.
--      Solo sirve para un barbero YA dado de baja: no se puede usar para sacar al
--      dueño, a un mostrador ni a un barbero activo.
--
--   3. LA FOTO. Bucket público 'barberos', igual que productos (0019), servicios
--      (0055) y sedes (0058): lectura pública, escritura solo con service role
--      desde la server action, después de requireAdmin.
--
--   4. UN PERFIL POR BARBERO. profiles.barbero_id no tenía índice único: dos
--      "Crear acceso" casi a la vez dejaban dos usuarios de Auth para el mismo
--      barbero, y desde ahí loginBarberoPin (.maybeSingle) fallaba y la baja no
--      encontraba a quién banear. Leído en prod el 14-oct: no hay repetidos.
--
--   5. LA BAJA NO DISPARA "SE LIBERÓ UN CUPO" CON ALGUIEN QUE YA NO ESTÁ.
--      Cancelar las citas del que se va pasaba TODA la lista de espera de la sede
--      a 'notificado' con su nombre (0086), por un cupo que nadie puede reservar.
--      Y "te toca corte" (0069) no propone a un barbero dado de baja: va sin
--      barbero ("cualquiera"). Definiciones vigentes en prod (pg_get_functiondef,
--      14-oct) con ese único agregado.
--
--   6. EL MOSTRADOR. El que se va conoce el PIN del aparato del local. La baja
--      ofrece cambiarlo y cerrar las sesiones del mostrador (el aparato del local
--      vuelve a pedir el PIN, el nuevo).
--
-- ORDEN: se puede aplicar ANTES del deploy y conviene hacerlo así. Con el código
-- de hoy no cambia nada (los 6 barberos están activos, así que las funciones
-- devuelven lo mismo) y el deploy encuentra listo el bucket y las funciones. Si va
-- después, la app igual funciona: la foto avisa que no se puede guardar todavía,
-- la baja banea, corta la pantalla y las acciones (getStaffContext y requireStaff
-- miran barberos.activo), y deja como pendiente lo que espera a esta migración:
-- que la RLS le cierre los datos al instante, que las sesiones se borren en vez de
-- vencer en máximo una hora, y que la lista de espera no reciba un cupo falso.
--
-- Idempotente.

-- 1 · Las barreras exigen barbero activo ---------------------------------------

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.profiles p
     where p.auth_id = auth.uid()
       and (
         p.rol in ('admin', 'sede')
         -- Un barbero cuenta como equipo mientras su ficha esté activa.
         or (p.rol = 'barbero'
             and exists (select 1 from public.barberos b where b.id = p.barbero_id and b.activo))
       )
  );
$$;

create or replace function public.current_barbero_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  -- null para un barbero dado de baja: las políticas que comparan
  -- barbero_id = current_barbero_id() dejan de devolverle filas.
  select p.barbero_id
    from public.profiles p
    join public.barberos b on b.id = p.barbero_id
   where p.auth_id = auth.uid()
     and b.activo;
$$;

-- 2 · Cerrar las sesiones de un barbero dado de baja ------------------------------

create or replace function public.cerrar_sesiones_barbero(p_barbero_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer := 0;
begin
  -- Solo los usuarios de un barbero DADO DE BAJA (activo = false). Nunca un
  -- cliente, el dueño, un mostrador ni un barbero que sigue trabajando. Todos sus
  -- perfiles, no "el" perfil: si por un arreglo a mano quedó más de uno, un
  -- SELECT INTO de una fila dejaba vivo al otro.
  -- Los refresh tokens cuelgan de la sesión (on delete cascade).
  delete from auth.sessions s
   where s.user_id in (
     select p.auth_id
       from public.profiles p
       join public.barberos b on b.id = p.barbero_id
      where p.barbero_id = p_barbero_id
        and p.rol = 'barbero'
        and p.auth_id is not null
        and not b.activo
   );
  get diagnostics v_n = row_count;
  return v_n;
end
$$;

revoke all on function public.cerrar_sesiones_barbero(uuid) from public, anon, authenticated;
grant execute on function public.cerrar_sesiones_barbero(uuid) to service_role;

-- Las del MOSTRADOR de una sede (rol 'sede'): después de cambiarle el PIN en la
-- baja de un barbero, para que el que se va no siga adentro con una sesión vieja
-- del aparato compartido. El aparato del local vuelve a pedir el PIN (el nuevo).
create or replace function public.cerrar_sesiones_sede(p_sede_id text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer := 0;
begin
  delete from auth.sessions s
   where s.user_id in (
     select p.auth_id
       from public.profiles p
      where p.rol = 'sede'
        and p.sede_id = p_sede_id
        and p.auth_id is not null
   );
  get diagnostics v_n = row_count;
  return v_n;
end
$$;

revoke all on function public.cerrar_sesiones_sede(text) from public, anon, authenticated;
grant execute on function public.cerrar_sesiones_sede(text) to service_role;

-- 2b · Un solo perfil de barbero por ficha ---------------------------------------------

create unique index if not exists profiles_barbero_unico
  on public.profiles (barbero_id)
  where rol = 'barbero';

-- 2c · La lista de espera no recibe un cupo de alguien que ya no trabaja aquí -----------

create or replace function public.notificar_cola_al_cancelar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if NEW.estado in ('cancelada', 'no_show')
     and OLD.estado is distinct from NEW.estado
     and NEW.inicio > now()
     -- 0087: si el barbero ya no trabaja aquí (la baja cancela sus citas), ese
     -- cupo no se puede reservar: no se le promete a nadie de la espera.
     and (NEW.barbero_id is null
          or exists (select 1 from public.barberos b where b.id = NEW.barbero_id and b.activo)) then
    update public.lista_espera
      set estado = 'notificado',
          cupo_inicio = NEW.inicio,
          cupo_barbero_id = NEW.barbero_id
      where sede_id = NEW.sede_id and estado = 'esperando';
  end if;
  return NEW;
end $$;

-- 2d · "Te toca corte" no propone a un barbero dado de baja ---------------------------

create or replace function public.tomar_avisos_corte()
returns table(aviso_id uuid, cliente_ref uuid, cliente text, email text, dias integer, sede_id text, sede text, barbero_id uuid, barbero text, barbero_foto text, servicio_id text, servicio text, baja_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_activo boolean;
begin
  select a.corte_activo into v_activo from public.ajustes_avisos a where a.id = 1;
  if not coalesce(v_activo, false) then
    return;
  end if;
  if (now() at time zone 'America/Bogota')::time not between '09:00' and '21:00' then
    return;
  end if;

  return query
  with elegibles as (
    select e.cliente_ref, e.cliente, e.email, e.dias, e.marketing_token
      from public.v_toca_corte_elegibles e
     order by e.ultima_visita
     limit 8
  ),
  habitual as (
    select e.cliente_ref,
           coalesce(r.sede_id, v.sede_id)       as sede_id,
           -- 0087: su barbero de siempre, solo si sigue trabajando aquí; si no,
           -- sin barbero (la reserva abre con "cualquiera").
           case
             when exists (select 1 from public.barberos bb
                           where bb.id = coalesce(r.barbero_id, v.barbero_id) and bb.activo)
             then coalesce(r.barbero_id, v.barbero_id)
           end                                  as barbero_id,
           r.servicio_id
      from elegibles e
      left join lateral (
        select r.sede_id, r.barbero_id, r.servicio_id
          from public.reservas r
         where r.cliente_ref = e.cliente_ref and r.estado = 'completada'
         order by r.inicio desc limit 1
      ) r on true
      left join lateral (
        select v.sede_id, v.barbero_id
          from public.ventas v
         where v.cliente_ref = e.cliente_ref
         order by v.creado_en desc limit 1
      ) v on true
  ),
  marcadas as (
    insert into public.avisos_marketing as am (cliente_ref, tipo, sede_id, barbero_id, servicio_id)
    select h.cliente_ref, 'toca_corte', h.sede_id, h.barbero_id, h.servicio_id from habitual h
    returning am.id, am.cliente_ref, am.sede_id, am.barbero_id, am.servicio_id
  )
  select m.id,
         m.cliente_ref,
         e.cliente,
         e.email,
         e.dias,
         m.sede_id,
         sd.nombre,
         m.barbero_id,
         b.nombre,
         b.foto_url,
         m.servicio_id,
         s.nombre,
         e.marketing_token
    from marcadas m
    join elegibles e on e.cliente_ref = m.cliente_ref
    left join public.sedes sd on sd.id = m.sede_id
    left join public.barberos b on b.id = m.barbero_id
    left join public.servicios s on s.id = m.servicio_id;
end;
$$;

-- 3 · La foto del barbero ------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('barberos', 'barberos', true)
on conflict (id) do nothing;

notify pgrst, 'reload schema';

-- supabase/seed/demo.sql
-- Seed de demo idempotente para Barbas & Bigotes.
-- Todas las filas quedan tageadas con clientes.origen='demo'.
-- Re-ejecutar este archivo = RESET (borra lo demo y vuelve a sembrar).
-- Corre contra el proyecto actual (prod sin datos reales). NUNCA borra filas no-demo.
-- Auto-fechado: las reservas caen SIEMPRE "hoy" (current_date) en hora local Bogotá.

begin;

-- 1) RESET — borrar SOLO lo demo, en orden de dependencias (FK).
delete from public.puntos_mov         where cliente_ref in (select id from public.clientes where origen = 'demo');
delete from public.venta_items        where venta_id in (
  select v.id from public.ventas v join public.clientes c on c.id = v.cliente_ref where c.origen = 'demo');
delete from public.ventas             where cliente_ref in (select id from public.clientes where origen = 'demo');
delete from public.lista_espera       where cliente_ref in (select id from public.clientes where origen = 'demo');
delete from public.reservas           where cliente_ref in (select id from public.clientes where origen = 'demo');
delete from public.cliente_notas      where cliente_ref in (select id from public.clientes where origen = 'demo');
delete from public.cliente_wallet_mov where cliente_ref in (select id from public.clientes where origen = 'demo');
delete from public.cliente_resenas    where cliente_ref in (select id from public.clientes where origen = 'demo');
delete from public.clientes           where origen = 'demo';

-- 2) CLIENTES demo (~30) — nombres colombianos, teléfono/email únicos, tag origen='demo'.
insert into public.clientes (nombre, telefono, email, origen, fidelizado)
select n.nombre,
       '+57 30' || lpad((10000000 + (row_number() over ()))::text, 8, '0'),
       lower(replace(n.nombre, ' ', '.')) || '@demo.test',
       'demo',
       (row_number() over ()) % 4 <> 0   -- ~75% fidelizados
from (values
  ('Andrés Gómez'),('Camila Rojas'),('Julián Torres'),('Valentina Díaz'),
  ('Sebastián Ruiz'),('Mariana López'),('Santiago Peña'),('Daniela Castro'),
  ('Mateo Herrera'),('Sofía Vargas'),('Nicolás Mora'),('Isabella Ramírez'),
  ('Samuel Ortiz'),('Gabriela Silva'),('Alejandro Niño'),('Laura Jiménez'),
  ('Emmanuel Pardo'),('Antonia Rincón'),('Tomás Guerrero'),('Salomé Cárdenas'),
  ('David Quintero'),('Manuela Suárez'),('Simón Beltrán'),('Juana Acosta'),
  ('Martín Cabrera'),('Emma Villalba'),('Felipe Naranjo'),('Renata Osorio'),
  ('Joaquín Prieto'),('Elena Fuentes')
) as n(nombre);

-- 3) RESERVAS de hoy: por cada barbero activo, 8 citas cubriendo todos los estados.
--    Servicios ≤ 60 min en slots horarios back-to-back → tstzrange '[)' no se solapa
--    (respeta reservas_no_overlap). Hora local Bogotá vía "at time zone".
do $$
declare
  b      record;
  cli    uuid[];
  ncli   int;
  serv   record;
  base   date := current_date;
  estados text[] := array['completada','completada','en_curso','confirmada','confirmada','pendiente','cancelada','no_show'];
  horas   int[]  := array[9,10,11,13,14,15,16,17];
  i      int;
  idx    int := 0;
begin
  select array_agg(id order by creado_en) into cli from public.clientes where origen = 'demo';
  ncli := coalesce(array_length(cli,1), 0);
  if ncli = 0 then return; end if;

  for b in select id, sede_id from public.barberos where activo = true loop
    for i in 1 .. array_length(estados,1) loop
      -- servicio ≤60min disponible en la sede del barbero, elegido deterministamente
      select s.id as sid, s.duracion_min as dur
        into serv
      from public.servicios s
      join public.servicio_sede ss on ss.servicio_id = s.id and ss.sede_id = b.sede_id
      where s.activo and s.duracion_min <= 60
      order by md5(b.id::text || i::text)
      limit 1;
      continue when serv.sid is null;

      idx := idx + 1;
      insert into public.reservas (sede_id, barbero_id, cliente_ref, servicio_id, inicio, fin, estado, canal)
      values (
        b.sede_id, b.id, cli[1 + (idx % ncli)], serv.sid,
        (base + make_time(horas[i],0,0)) at time zone 'America/Bogota',
        ((base + make_time(horas[i],0,0)) at time zone 'America/Bogota') + (serv.dur || ' minutes')::interval,
        estados[i]::estado_reserva,
        (case when i % 3 = 0 then 'walkin' else 'app' end)::canal_reserva
      );
    end loop;
  end loop;
end $$;

-- 4) VENTAS + venta_items + puntos para las reservas 'completada' de hoy (demo).
insert into public.ventas (sede_id, barbero_id, cliente_ref, reserva_id, medio, total, descuento)
select r.sede_id, r.barbero_id, r.cliente_ref, r.id,
       (case when (row_number() over ()) % 2 = 0 then 'efectivo' else 'datafono' end)::medio_pago,
       coalesce(ss.precio, 25000), 0
from public.reservas r
join public.clientes c on c.id = r.cliente_ref and c.origen = 'demo'
left join public.servicio_sede ss on ss.servicio_id = r.servicio_id and ss.sede_id = r.sede_id
where r.estado = 'completada';

insert into public.venta_items (venta_id, tipo, ref_id, descripcion, cantidad, precio_unitario, comision_pct)
select v.id, 'servicio', r.servicio_id, coalesce(s.nombre,'Servicio'), 1, v.total, 50
from public.ventas v
join public.reservas r on r.id = v.reserva_id
join public.clientes c on c.id = v.cliente_ref and c.origen = 'demo'
left join public.servicios s on s.id = r.servicio_id;

insert into public.puntos_mov (cliente_ref, tipo, puntos, venta_id, nota)
select v.cliente_ref, 'ganado', floor(v.total / 1000.0)::int, v.id, 'Compra (demo)'
from public.ventas v
join public.clientes c on c.id = v.cliente_ref and c.origen = 'demo'
where floor(v.total / 1000.0)::int > 0;

-- 5) LISTA DE ESPERA: 3 clientes demo 'esperando' en parque-venezuela
--    (esa sede tiene cancelaciones → sirve para probar la promoción a 'notificado').
insert into public.lista_espera (sede_id, barbero_id, servicio_id, cliente_ref, cliente_nombre, telefono, estado)
select 'parque-venezuela', null, null, c.id, c.nombre, c.telefono, 'esperando'
from public.clientes c
where c.origen = 'demo'
order by c.creado_en desc
limit 3;

commit;

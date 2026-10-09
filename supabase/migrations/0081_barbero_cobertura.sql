-- 0081: un barbero cubre HOY en la otra sede (9-oct).
--
-- El dueño vio que un barbero se fue a la otra sede a reemplazar a uno que no
-- vino, y la app no lo dejaba anotar: cada acción del mostrador rechazaba "Ese
-- barbero es de otra sede". Con esta tabla, por un día, el barbero cuenta como
-- de la sede que cubre: aparece en su mostrador y su calendario, se le anotan
-- walk-ins y ventas allí (la plata entra a esa caja; la comisión, a él), y se le
-- pueden pasar las citas del que faltó. En su sede de siempre ese día no se
-- reserva con él por la web.
--
-- Lectura: solo staff. Escritura: solo el servidor (service role) después de
-- validar quién la pide (marcarCobertura / quitarCobertura en actions.ts).

create table if not exists public.barbero_cobertura (
  id uuid primary key default gen_random_uuid(),
  barbero_id uuid not null references public.barberos (id) on delete cascade,
  fecha date not null,
  sede_id text not null references public.sedes (id),
  creado_en timestamptz not null default now(),
  unique (barbero_id, fecha)
);

alter table public.barbero_cobertura enable row level security;

drop policy if exists barbero_cobertura_staff on public.barbero_cobertura;
create policy barbero_cobertura_staff on public.barbero_cobertura
  for select to authenticated using (public.is_staff());

-- Los mostradores de las DOS sedes se refrescan solos cuando alguien no vino o
-- se va a cubrir (RealtimeRefresh); antes solo escuchaban reservas y la espera.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'barbero_cobertura') then
    alter publication supabase_realtime add table public.barbero_cobertura;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'barbero_ausencias') then
    alter publication supabase_realtime add table public.barbero_ausencias;
  end if;
end $$;

-- El aviso público (0080) también sale cuando un barbero empieza o deja de
-- cubrir: el público de su sede lo ve "en la otra sede" al instante. Se avisa a
-- las dos sedes.
create or replace function public.avisar_disponibilidad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sede text;
  v_otra text;
  v_barbero uuid;
begin
  if tg_table_name = 'reservas' then
    if tg_op = 'UPDATE'
       and new.estado is not distinct from old.estado
       and new.inicio is not distinct from old.inicio
       and new.fin is not distinct from old.fin
       and new.barbero_id is not distinct from old.barbero_id
       and new.sede_id is not distinct from old.sede_id then
      return null;
    end if;
    begin
      if tg_op in ('INSERT', 'UPDATE') then
        perform realtime.send(
          jsonb_build_object('sede', new.sede_id, 'barbero', new.barbero_id),
          'cambio', 'disponibilidad:' || new.sede_id, false);
      end if;
      if tg_op = 'DELETE'
         or (tg_op = 'UPDATE' and (new.sede_id is distinct from old.sede_id or new.barbero_id is distinct from old.barbero_id)) then
        perform realtime.send(
          jsonb_build_object('sede', old.sede_id, 'barbero', old.barbero_id),
          'cambio', 'disponibilidad:' || old.sede_id, false);
      end if;
    exception when others then
      null;
    end;
    return null;
  end if;

  -- barbero_ausencias y barbero_cobertura: la sede de siempre del barbero, y en
  -- la cobertura también la que cubre.
  -- Todo dentro del bloque protegido: un fallo acá nunca tumba la escritura.
  begin
    if tg_op = 'DELETE' then
      v_barbero := old.barbero_id;
    else
      v_barbero := new.barbero_id;
    end if;
    select b.sede_id into v_sede from public.barberos b where b.id = v_barbero;
    if v_sede is not null then
      perform realtime.send(
        jsonb_build_object('sede', v_sede, 'barbero', v_barbero),
        'cambio', 'disponibilidad:' || v_sede, false);
    end if;
    if tg_table_name = 'barbero_cobertura' then
      if tg_op = 'DELETE' then
        v_otra := old.sede_id;
      else
        v_otra := new.sede_id;
      end if;
      if v_otra is not null and v_otra is distinct from v_sede then
        perform realtime.send(
          jsonb_build_object('sede', v_otra, 'barbero', v_barbero),
          'cambio', 'disponibilidad:' || v_otra, false);
      end if;
    end if;
  exception when others then
    null;
  end;
  return null;
end;
$$;

revoke all on function public.avisar_disponibilidad() from public, anon, authenticated;

drop trigger if exists trg_avisar_disponibilidad on public.barbero_cobertura;
create trigger trg_avisar_disponibilidad
  after insert or update or delete on public.barbero_cobertura
  for each row execute function public.avisar_disponibilidad();

-- 0054: bloquear HORAS, no solo días (almuerzo/diligencia desde el calendario).
-- barbero_ausencias gana un rango opcional en minutos-del-día (Bogotá):
--   desde_min/hasta_min NULL  = ausencia de día completo (compat: todas las filas viejas).
--   desde_min/hasta_min datos = bloqueo parcial (p.ej. 720-780 = 12:00-13:00).
-- Se suelta el unique (barbero, fecha): un día puede tener almuerzo + diligencia.

alter table public.barbero_ausencias
  add column if not exists desde_min int,
  add column if not exists hasta_min int;

alter table public.barbero_ausencias
  drop constraint if exists barbero_ausencias_barbero_id_fecha_key;

alter table public.barbero_ausencias
  drop constraint if exists barbero_ausencias_rango_chk;
alter table public.barbero_ausencias
  add constraint barbero_ausencias_rango_chk check (
    (desde_min is null and hasta_min is null)
    or (desde_min >= 0 and hasta_min <= 1440 and desde_min < hasta_min)
  );

create index if not exists barbero_ausencias_dia_idx
  on public.barbero_ausencias (barbero_id, fecha);

notify pgrst, 'reload schema';

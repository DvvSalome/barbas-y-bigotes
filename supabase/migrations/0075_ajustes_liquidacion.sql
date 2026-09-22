-- 0075 — Ajustar a mano la liquidación de un barbero.
--
-- Pedido del administrador (20-sep): "en esta parte de liquidación de cada uno,
-- me gustaría si me deja editarla acá SOLO A MÍ, por si le sumo o le resto algo".
--
-- Pasa todas las semanas y hoy no tiene dónde anotarse: se le presta plata fuera
-- del adelanto formal, se le descuenta un daño, se le suma un domicilio que hizo,
-- se corrige una comisión que quedó mal. Hasta ahora eso se arreglaba de palabra
-- y el número de la pantalla no era el número que se pagaba.
--
-- Por qué una TABLA de movimientos y no una columna "ajuste" en `barberos`:
--   1. Un ajuste es de UNA semana, no del barbero para siempre.
--   2. Puede haber varios en la misma semana, y cada uno con su motivo.
--   3. Queda el rastro: quién lo puso y cuándo. Un número suelto que alguien
--      cambió sin dejar razón es exactamente lo que hace que el barbero
--      desconfíe del descuento.
--
-- `monto` es un ENTERO CON SIGNO en pesos: positivo suma a lo que se le paga,
-- negativo resta. No se parte en dos columnas porque en la cabeza del dueño es
-- una sola cosa ("le sumo o le resto"), y dos columnas obligan a elegir antes de
-- escribir el número.
--
-- `fecha` es un día, no una semana: así cualquier rango que lo contenga lo
-- recoge, y la liquidación se puede mirar por semana, por quincena o por mes sin
-- que el ajuste se pierda o se cuente dos veces.
create table if not exists public.ajustes_liquidacion (
  id          uuid primary key default gen_random_uuid(),
  barbero_id  uuid not null references public.barberos(id) on delete cascade,
  fecha       date not null default (now() at time zone 'America/Bogota')::date,
  monto       integer not null,
  nota        text not null,
  creado_por  uuid references auth.users(id) on delete set null,
  creado_en   timestamptz not null default now(),
  -- Un ajuste de $0 no es un ajuste, es ruido en la pantalla del barbero.
  constraint ajustes_liquidacion_monto_no_cero check (monto <> 0),
  -- La nota NO es opcional: es la mitad del punto. Sin ella, el barbero ve que
  -- le restaron $30.000 y no sabe por qué.
  constraint ajustes_liquidacion_nota_no_vacia check (length(btrim(nota)) > 0)
);

-- La liquidación siempre se pide por rango de fechas y casi siempre de un solo
-- barbero o de una sede; este índice cubre las dos lecturas.
create index if not exists ajustes_liquidacion_fecha_idx
  on public.ajustes_liquidacion (fecha, barbero_id);

alter table public.ajustes_liquidacion enable row level security;

-- Leer: cualquier staff. El barbero TIENE que poder verlo — si el ajuste le
-- cambia lo que cobra el sábado y no lo ve, la cuenta no le va a cuadrar y con
-- razón. Lo que es solo del dueño es PONERLO, no verlo.
drop policy if exists ajustes_liquidacion_sel on public.ajustes_liquidacion;
create policy ajustes_liquidacion_sel on public.ajustes_liquidacion
  for select using (public.is_staff());

-- Escribir, cambiar y borrar: solo el dueño. Esto es "solo a mí" del pedido.
drop policy if exists ajustes_liquidacion_admin on public.ajustes_liquidacion;
create policy ajustes_liquidacion_admin on public.ajustes_liquidacion
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.ajustes_liquidacion to authenticated;
grant all on public.ajustes_liquidacion to service_role;

notify pgrst, 'reload schema';

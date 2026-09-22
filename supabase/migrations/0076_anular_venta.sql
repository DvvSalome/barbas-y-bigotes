-- 0076 — Anular una venta mal registrada.
--
-- Pedido del administrador (20-sep): "estaba metiendo ejemplo lo que iba hoy, y
-- me equivoqué en dos, necesito borrarlos y no me deja borrarlo; debería haber
-- como un historial de lo vendido para poder eliminar o modificar en su caso".
--
-- SE MARCA, NO SE BORRA. Un DELETE deja la caja del día sin explicación: el
-- efectivo esperado baja y nadie sabe por qué. Marcada, la venta sigue en el
-- historial diciendo "anulada" y con el motivo, que es literalmente lo que él
-- pidió ("un historial de lo vendido"). Además `ventas` es la fuente de la
-- liquidación, de las comisiones y del cuadre: borrar filas de ahí es reescribir
-- la contabilidad de la semana pasada.
--
-- Todas las lecturas de `ventas` filtran `anulada_en is null` — son 19 y están
-- una por una en queries.ts. Una que se olvide deja una venta anulada contando
-- en algún total, que es peor que no tener la función.
alter table public.ventas
  add column if not exists anulada_en     timestamptz,
  add column if not exists anulada_por    uuid references auth.users(id) on delete set null,
  add column if not exists anulada_motivo text;

-- El motivo no es opcional cuando se anula: "por qué desapareció esta plata" es
-- la pregunta que alguien va a hacer en dos semanas. Se valida a nivel de fila
-- para que ni una action ni el SQL Editor puedan dejar una anulación muda.
alter table public.ventas
  drop constraint if exists ventas_anulada_con_motivo;
alter table public.ventas
  add constraint ventas_anulada_con_motivo
  check (anulada_en is null or length(btrim(coalesce(anulada_motivo, ''))) > 0);

-- Casi toda lectura de ventas es "las vivas de un rango": el índice parcial las
-- deja juntas y no pesa, porque las anuladas son la excepción.
create index if not exists ventas_vivas_idx
  on public.ventas (creado_en) where anulada_en is null;

-- Deshacer el uso de un cupón cuando su venta se anula. Es el espejo exacto de
-- bump_cupon_uso (0008): SECURITY DEFINER con search_path vacío y todo
-- esquema-calificado, igual que el resto de los definers del proyecto.
--
-- `greatest(0, ...)` porque un cupón puede haber sido devuelto ya por otra vía y
-- un contador de usos en negativo rompería el tope `usos < usos_max`.
create or replace function public.unbump_cupon_uso(p_codigo text)
returns void
language sql
security definer
set search_path = ''
as $function$
  update public.cupones set usos = greatest(0, usos - 1) where codigo = p_codigo;
$function$;

revoke all on function public.unbump_cupon_uso(text) from public, anon, authenticated;
grant execute on function public.unbump_cupon_uso(text) to service_role;

notify pgrst, 'reload schema';

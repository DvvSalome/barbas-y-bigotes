-- 0088 · La reseña con chips (18-oct).
--
-- El dueño: "si invito a la gente a escribir la reseña no lo van a hacer, les
-- parece aburrido, y si lo hacen a mano ponen 'bien' u 'ok'". Ahora el cliente
-- toca estrellas, marca lo que le gustó (o lo que falló) en chips y recibe un
-- texto ya escrito que puede cambiar (src/lib/resena-texto.ts; con IA si hay
-- ANTHROPIC_API_KEY). Esta migración guarda lo que marcó.
--
--   etiquetas       ids de los chips ('como_pedi', 'espera'…). Solo ids del
--                   catálogo: la action los valida (etiquetasValidas), así que
--                   nunca trae texto libre ni datos personales y
--                   eliminar_cuenta_cliente (0072/0084) no tiene que borrarla.
--   texto_generado  el comentario salió del texto que le armamos con esos
--                   chips (aunque lo haya retocado). Para que el dueño no lea
--                   esas palabras como escritas de cero por el cliente.
--
-- ORDEN: puede ir antes o después del deploy. La app de antes no conoce las
-- columnas (los defaults las llenan); la app nueva, sin la migración, guarda la
-- calificación sin ellas (reintenta el insert) y lee con select("*").
--
-- Política de Google (0035), sin cambios: el ofrecimiento de publicar en Google
-- es el mismo para todas las notas. Nada acá filtra por calificación.

alter table public.resenas_servicio
  add column if not exists etiquetas text[] not null default '{}';
alter table public.resenas_servicio
  add column if not exists texto_generado boolean not null default false;

-- Tope de cordura: más de 12 chips no es una reseña (la action ya corta en 12).
alter table public.resenas_servicio drop constraint if exists resenas_servicio_etiquetas_tope;
alter table public.resenas_servicio
  add constraint resenas_servicio_etiquetas_tope check (cardinality(etiquetas) <= 12);

notify pgrst, 'reload schema';

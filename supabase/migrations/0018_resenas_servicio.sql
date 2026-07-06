-- 0018 — Calificación post-servicio (Bloque 5): el CLIENTE califica la atención.
-- OJO: es lo contrario de cliente_resenas (0006), donde el staff califica al cliente;
-- esa tabla NO se toca. Tipos verificados contra 0001/0002: sedes.id text (slug),
-- reservas.id uuid, clientes.id uuid, barberos.id uuid.

-- Link de reseña de Google por sede (writereview con place id). Nullable:
-- el botón solo aparece cuando esté configurado.
alter table public.sedes add column if not exists google_review_url text;

-- Calificación DEL SERVICIO por el cliente (postventa). Una por reserva.
create table if not exists public.resenas_servicio (
  id          uuid primary key default gen_random_uuid(),
  reserva_id  uuid not null unique references public.reservas(id) on delete cascade,
  cliente_ref uuid not null references public.clientes(id) on delete cascade,
  barbero_id  uuid references public.barberos(id),
  sede_id     text not null references public.sedes(id),
  score       integer not null check (score between 1 and 5),
  comentario  text,
  creado_en   timestamptz not null default now()
);
create index resenas_servicio_sede on public.resenas_servicio (sede_id, creado_en desc);
create index resenas_servicio_barbero on public.resenas_servicio (barbero_id, creado_en desc);

alter table public.resenas_servicio enable row level security;
-- Lectura para staff: el admin ve todo (is_admin); el barbero, solo las suyas
-- (current_barbero_id, 0010). Mismo estilo de scoping que ventas/reservas.
create policy resenas_servicio_staff_select on public.resenas_servicio
  for select to authenticated
  using (public.is_admin() or barbero_id = public.current_barbero_id());
-- El cliente escribe vía server action con service role (ownership verificado en el
-- server); sin policy de insert para authenticated (deny by default).

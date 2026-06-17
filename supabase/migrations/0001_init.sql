-- 0001_init.sql — Barbas & Bigotes Barbershop
-- Schema base multi-sede. RLS se habilita aquí; las políticas detalladas van
-- en una migración posterior junto con la autenticación (ver ADR-0012).

-- ---------- enums ----------
create type tipo_contrato as enum ('porcentaje', 'arriendo');
create type medio_pago as enum ('efectivo', 'datafono');
create type rol_usuario as enum ('admin', 'barbero', 'cliente');
create type estado_reserva as enum ('pendiente','confirmada','en_curso','completada','cancelada','no_show');
create type canal_reserva as enum ('link', 'app', 'walkin');
create type estado_espera as enum ('esperando','notificado','asignado','vencido','cancelado');

-- ---------- catálogos ----------
create table sedes (
  id          text primary key,           -- 'parque-venezuela' | 'plaza-de-la-paz'
  nombre      text not null,
  direccion   text,
  activa      boolean not null default true,
  creado_en   timestamptz not null default now()
);

create table servicios (
  id            text primary key,
  nombre        text not null,
  categoria     text not null,
  duracion_min  integer not null,
  es_combo      boolean not null default false,
  desde         boolean not null default false,   -- precio "desde $X"
  activo        boolean not null default true
);

-- precio por sede: el mismo servicio cuesta distinto en cada sede
create table servicio_sede (
  servicio_id  text not null references servicios(id) on delete cascade,
  sede_id      text not null references sedes(id) on delete cascade,
  precio       integer not null,          -- COP
  disponible   boolean not null default true,
  primary key (servicio_id, sede_id)
);

create table productos (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  sede_id       text not null references sedes(id),
  precio        integer not null,
  stock         integer not null default 0,
  stock_minimo  integer not null default 0,
  comision_pct  numeric(5,2) not null default 0,
  activo        boolean not null default true
);

-- ---------- personas ----------
create table profiles (
  id         uuid primary key default gen_random_uuid(),
  auth_id    uuid unique,                 -- -> auth.users.id
  rol        rol_usuario not null default 'cliente',
  nombre     text not null,
  telefono   text,
  email      text,
  creado_en  timestamptz not null default now()
);

create table barberos (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid references profiles(id) on delete set null,
  nombre           text not null,
  sede_id          text not null references sedes(id),
  tipo_contrato    tipo_contrato not null default 'porcentaje',
  comision_pct     numeric(5,2),          -- cuando tipo_contrato = 'porcentaje'
  arriendo_mensual integer,               -- cuando tipo_contrato = 'arriendo' (COP)
  foto_url         text,
  destacado        boolean not null default false,
  activo           boolean not null default true,
  creado_en        timestamptz not null default now()
);

create table barbero_especialidades (
  barbero_id    uuid not null references barberos(id) on delete cascade,
  especialidad  text not null,
  primary key (barbero_id, especialidad)
);

-- ---------- operación ----------
create table reservas (
  id          uuid primary key default gen_random_uuid(),
  sede_id     text not null references sedes(id),
  barbero_id  uuid references barberos(id),
  cliente_id  uuid references profiles(id),
  servicio_id text references servicios(id),
  inicio      timestamptz not null,
  fin         timestamptz not null,
  estado      estado_reserva not null default 'pendiente',
  canal       canal_reserva not null default 'app',
  nota        text,
  creado_en   timestamptz not null default now()
);
create index reservas_sede_inicio_idx on reservas (sede_id, inicio);
create index reservas_barbero_inicio_idx on reservas (barbero_id, inicio);

-- lista de espera: motor de la "notificación alternativa"
create table lista_espera (
  id          uuid primary key default gen_random_uuid(),
  sede_id     text not null references sedes(id),
  barbero_id  uuid references barberos(id),
  servicio_id text references servicios(id),
  cliente_id  uuid references profiles(id),
  estado      estado_espera not null default 'esperando',
  creado_en   timestamptz not null default now()
);

create table ventas (
  id          uuid primary key default gen_random_uuid(),
  sede_id     text not null references sedes(id),
  barbero_id  uuid references barberos(id),
  cliente_id  uuid references profiles(id),
  reserva_id  uuid references reservas(id),
  medio       medio_pago not null,        -- efectivo | datafono
  total       integer not null,
  creado_en   timestamptz not null default now()
);
create index ventas_sede_fecha_idx on ventas (sede_id, creado_en);

-- items de la venta: servicios, productos y consumos (gaseosa, etc.)
create table venta_items (
  id               uuid primary key default gen_random_uuid(),
  venta_id         uuid not null references ventas(id) on delete cascade,
  tipo             text not null,         -- 'servicio' | 'producto'
  ref_id           text,                  -- servicio_id o producto_id
  descripcion      text not null,
  cantidad         integer not null default 1,
  precio_unitario  integer not null,
  comision_pct     numeric(5,2) not null default 0
);

create table gastos (
  id             uuid primary key default gen_random_uuid(),
  sede_id        text not null references sedes(id),
  categoria      text not null,
  descripcion    text,
  monto          integer not null,
  registrado_por uuid references profiles(id),
  fecha          date not null default current_date,
  creado_en      timestamptz not null default now()
);

create table adelantos (
  id          uuid primary key default gen_random_uuid(),
  barbero_id  uuid not null references barberos(id),
  monto       integer not null,
  saldo       integer not null,
  nota        text,
  fecha       date not null default current_date,
  creado_en   timestamptz not null default now()
);

create table calificaciones_cliente (
  id          uuid primary key default gen_random_uuid(),
  barbero_id  uuid not null references barberos(id),
  cliente_id  uuid not null references profiles(id),
  score       integer not null check (score between 1 and 5),
  nota        text,
  creado_en   timestamptz not null default now()
);

-- ---------- RLS ----------
-- Catálogos (sedes, servicios, servicio_sede, productos) = lectura pública.
-- Datos sensibles con RLS activada; políticas por rol/sede en la migración de auth.
alter table profiles               enable row level security;
alter table barberos               enable row level security;
alter table reservas               enable row level security;
alter table lista_espera           enable row level security;
alter table ventas                 enable row level security;
alter table venta_items            enable row level security;
alter table gastos                 enable row level security;
alter table adelantos              enable row level security;
alter table calificaciones_cliente enable row level security;

# Barbas & Bigotes — Barbershop (Barranquilla)

Sitio público + panel de gestión para la barbería. **Next.js 16** (App Router, Turbopack, React 19) + **Supabase** (Postgres + Auth + RLS).

> ⚠️ Esta versión de Next.js trae breaking changes vs. lo conocido. Ver `AGENTS.md` antes de tocar APIs/convenciones.

---

## Arrancar en local

```bash
npm install
cp .env.example .env.local   # pedir los valores reales (no están en el repo)
npm run dev                  # http://localhost:3000
```

`.env.local` (Supabase + n8n) **nunca** se commitea. Variables en `.env.example`:

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente Supabase (browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Acciones server-side que saltan RLS |
| `N8N_BASE_URL` / `N8N_API_KEY` | Recordatorios + avisos de cola/lista de espera |

Proyecto Supabase: `wvmdsxznujklgfezqtfy` · admin: `admin@barbasybigotes.com`.

---

## Mapa del repo

```
src/
  app/                    # Rutas (App Router)
    page.tsx              # Landing pública (hero 3D + servicios)
    barberos/             # Roster público de barberos          [estático]
    reservar/             # Flujo de reserva de cita            [dinámico]
    login/  auth/         # Auth (Supabase) + callback OAuth
    cuenta/               # Portal del cliente
    barbero/              # Vista del barbero (su agenda/comisiones)
    admin/                # Panel de gestión:
      clientes/  comisiones/  cuadre/  cupones/  inventario/  precios/
  components/
    home/                 # Secciones de la landing (Hero3D, ScrollReveal3D…)
    three/                # react-three-fiber (escena 3D del hero)
    motion/  ui/          # Animación + primitivas de UI
    admin/ barbero/ cuenta/  # UI por sección del producto
  lib/
    supabase/             # Clientes Supabase (browser/server)
    data/queries.ts       # Lecturas a la BD
    actions.ts            # Server actions (reservas, ventas, comisiones…)
supabase/migrations/      # Esquema versionado (0001…0014). Source of truth del schema.
public/scroll/            # Frames webp del hero scroll-3D (desktop/mobile)
```

---

## Flujo de trabajo (para colaboradores)

`main` está protegido por convención (branch protection no está disponible en repos privados free):

1. Rama desde `main`: `git checkout -b feat/lo-que-sea`
2. Commit + push de la rama.
3. Abrir **PR contra `main`** → CI corre solo.
4. Merge cuando CI pase (verde).

**No pushear directo a `main`.**

### CI

`.github/workflows/ci.yml` corre en cada push/PR a `main`:

```
tsc --noEmit   →   eslint   →   next build
```

Los secrets de Supabase viven en **GitHub → Settings → Secrets and variables → Actions**
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).

> Nota: `npm run lint` usa `eslint` directo. El código r3f en `src/components/three/`
> está eximido de `react-hooks/purity` e `immutability` (r3f muta el scene graph por diseño).

### CD (deploy)

Deploy vía **Vercel** (team `fourgsolutions-fgs`): auto-deploy en push a `main` + preview por PR.
Si la conexión Vercel↔GitHub aún no está hecha, se enlaza desde el dashboard de Vercel
(Add New → Project → importar este repo).

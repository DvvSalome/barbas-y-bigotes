# DESIGN — Barbas & Bigotes

Sistema de diseño. Tokens viven en `src/app/globals.css` (`@theme inline`, Tailwind v4).

## Tema
**Dark carbón** (cohesión con el sitio público inmersivo). El staff dashboard es un dark SaaS refinado (referencia de oficio: Linear/Vercel), no un dashboard claro genérico. Light queda como decisión explícita pendiente, no default.

## Color (actual)
- `bg #0c0b0a` · `panel #151311` · `elevated #211d19` · `ink #f2ede4` · `muted #9c958a` · `line rgba(242,237,228,.1)`
- Acento **rojo barbero**: `accent #d23f34` · `accent-soft #e8675c` · `on-accent #fbf7f0`
- Estrategia: **Restrained** — neutros tintados (cálidos) + un acento (rojo) ≤10%. El rojo es para acción/estado, no decoración.
- Pendiente de pulir: definir escala de neutros en OKLCH con tinte cálido consistente; un verde/ámbar sobrios solo para estados (ok/alerta) en caja e inventario.

## Tipografía
- Display: **Barlow Condensed** (`--font-display`) — títulos, horas, números grandes.
- Texto/UI: **Inter** (`--font-sans`).
- Jerarquía por escala+peso (ratio ≥1.25). Moneda y números tabulares (`tabular-nums`).

## Elevación
- Superficies: bg → panel → elevated. Bordes 1px `line` (full borders, nunca side-stripe).
- Sombras suaves y tintadas al carbón (no negras puras), sutiles. Glass solo puntual.

## Componentes (estándar a unificar en el pase pro)
- **Shell staff**: sidebar oscuro con secciones + topbar (usuario/sede/cerrar sesión). Hoy `/admin` ya tiene sidebar; `/barbero` no — unificar el shell.
- **Botones**: primario (rojo, texto on-accent), secundario (borde line), ghost. Tamaño cómodo para el barbero. Estados hover/disabled/loading.
- **Cards/paneles**: panel + borde line + radio 1rem-1.25rem. Sin cards anidadas. No abusar (usar solo donde es la mejor affordance).
- **Tablas/listas densas**: filas legibles, `tabular-nums`, hover sutil, chips de estado.
- **Chips de estado**: pendiente/confirmada/en curso/completada/no llegó · esperando/avisado — color y forma consistentes (no inventar por pantalla).
- **Inputs/select**: estilo único `fld` ya existe; consolidar foco con `accent`.
- **Empty states**: diseñados (ícono + mensaje + acción), no texto suelto.
- **Foto real por servicio** en el POS (como WeiBook) cuando estén las imágenes.

## Motion
- Ease-out exponencial, sutil. No animar layout. Transiciones de estado (entra reserva/cola) discretas.

## Prohibido (slop)
- Side-stripe borders, gradient text, glass por default, hero-métrica template, grids de cards idénticas, modal como primer recurso, em dashes en copy, alert()/confirm().

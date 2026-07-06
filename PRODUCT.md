# PRODUCT — Barbas & Bigotes

register: product

## Product Purpose
App de gestión de una barbería real de 2 sedes (Barranquilla). Tres frentes en una sola web (Next.js 16 + Supabase, RLS por rol, deploy Vercel):
- **Dueño/Admin** (`/admin`): caja/cuadre, precios por sede, inventario, comisiones, CRM de clientes, cupones/fidelización.
- **Barbero** (`/barbero`): agenda del día, walk-ins, lista de espera (cola), cobrar y completar atención.
- **Cliente** (`/`, `/reservar`, `/barberos`): landing + reserva online.

FourG Solutions es el constructor; la marca y los datos son del cliente.

## Users
- **Dueño**: mira plata y operación, muchas veces desde el celular, en la barbería. Quiere claridad y control financiero.
- **Barbero**: usa la app entre cliente y cliente, rápido, una mano, pantalla chica. Necesita acciones grandes y obvias (Llegó / Completar / Cobrar).
- **Cliente final**: reserva desde el celular; primer contacto con la marca.

## Brand
Barbería clásica, masculina, cálida. **Carbón + hueso + rojo barbero.** Tipografía **Barlow Condensed** (display) + **Inter** (texto). Nada de dorado champagne ni Cormorant (esa es identidad de FourG, prohibida acá). Tono: directo, de barrio, profesional sin ser frío. Español colombiano.

## Reference / North Star
**WeiBook** (weibook.co) — el SaaS de barbería que usa el cliente: pulido, denso pero legible, foto real por servicio en el POS, chips de estado, cuadre claro. Queremos ESE nivel de pulido SaaS **en layout y oficio**, con NUESTRA marca (no copiar su look genérico claro).

## Anti-references (lo que NO queremos)
- Plantilla SaaS genérica clara (azul/gris, cards idénticas, hero-métrica). Es el reflejo de categoría: evitarlo.
- La identidad FourG (espresso/dorado/Cormorant). Prohibida en apps de cliente.
- "Dashboard de analytics" (Grafana/KPI). Esto es una herramienta operativa, no un tablero de métricas.
- alert()/confirm() del browser, estados vacíos sin diseñar, números sin formato de moneda.

## Strategic principles
- **El dueño no opera casi nada** (regla del dueño, 2026-07-06): los barberos registran TODO (llegadas, cobros, consumos, walk-ins) y el sistema automatiza el resto. El panel admin es para MIRAR y decidir; toda tarea diaria que recaiga en el dueño es un defecto de diseño. Feature nueva → primero preguntarse si la registra el barbero o se automatiza.
- **Registro doble**: lo público (landing/reserva) es MARCA (dark inmersivo, vende). El staff (`/admin`,`/barbero`) es PRODUCTO (sirve al trabajo: legible, denso, accionable).
- **Móvil primero para el barbero**: acciones grandes, una columna, toque cómodo.
- **El dato manda**: dinero y agenda bien formateados, jerarquía clara, sin adornos que estorben.
- Mantener cohesión con el sitio público (dark carbón) salvo decisión explícita.

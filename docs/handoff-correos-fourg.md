# Handoff · correo saliente en FourG (de Barbas & Bigotes al CRM)

**Para:** la sesión que trabaja en `fourg-crm-live`.
**De:** la sesión de `barbas-y-bigotes`, 6-sep-2026.
**Por qué existe:** en Barbas ya pasamos por todo el ciclo de correo transaccional
(tres suspensiones del buzón incluidas). Esto es lo aprendido, lo que está montado
hoy y lo que conviene hacer si el CRM va a mandar correo — o si FourG quiere
ofrecer "su propio Resend" a sus clientes.

---

## 1. Qué hay montado hoy (Barbas & Bigotes)

Dos caminos de salida, a propósito separados:

| Camino | Qué manda | Cómo | Estado |
|---|---|---|---|
| **Buzón Hostinger** `reservas@barbasybigotes.com` | Los 6 correos de citas: confirmación, recordatorio, "cupo libre", reseña de Google, cambio/cancelación, aviso al barbero | SMTP `smtp.hostinger.com:465` desde **n8n**, con contraseña de aplicación | En producción |
| **Resend** (remitente `avisos@barbasybigotes.com`) | Marketing: el aviso "te toca corte" cada X días | API `POST api.resend.com/emails` desde **n8n** | Listo, apagado hasta que el dueño lo active |

**Piezas y credenciales** (ninguna en el repo; todas en archivos del scratchpad de
la sesión, que se poda — si no están, hay que pedirlas de nuevo):

- Resend: dominio `barbasybigotes.com` verificado (id `40e09566-1c36-47d6-9c74-8cd9658d3f4e`),
  DKIM en `resend._domainkey`, Return-Path en el subdominio `send.` (MX + SPF de Amazon SES).
  El dominio `fourgsolutions.com` también está verificado en la misma cuenta.
- n8n: instancia `n8n.fourgsolutions.com`. Workflows de Barbas: confirmación
  `JJiAjBoc9NBQbky1` (con la rama del aviso al barbero colgada), avisos de cita
  `x8B5l6NbG2supIbH`, cupo `Psk61KioW7QM0tdA`, reseña `3Y5sa4e6ve1PuwpK`, cambios
  `ewEj02L804hbgR1a`, **te toca corte `VAy4Qg34Hnv58UZX`** (cron cada hora).
- La cuenta de Resend es de FourG; **el cliente nunca ve a FourG**: el remitente,
  el DKIM y el Reply-To son del dominio del cliente.

---

## 2. Lo que costó caro (no repetirlo en el CRM)

1. **El buzón de correo NO es un servicio de envío.** Mandar campañas por el buzón
   comprado en Hostinger nos costó **tres suspensiones** en agosto. La causa real
   no fue volumen: fueron **rebotes duros** a direcciones inexistentes
   (`demo-agenda@qa.local`, `jhon@barbasybigotes.com`), que hicieron que
   **MailChannels** —el relay de salida de Hostinger— bloqueara al remitente con
   `550 5.7.1 [ESA] Sender blocked`. Cada rebote disparaba una suspensión nueva a
   los pocos segundos. Reactivar el buzón sin destrabar el relay repite el ciclo.
2. **Filtrar direcciones antes de guardarlas.** En Barbas vive en `src/lib/email.ts`
   (`esEmailEnviable` / `emailGuardable`): rechaza TLD reservados (.local, .test,
   .invalid), dominios de ejemplo y buzones del propio dominio que no existen. Se
   aplica en el único punto por donde entran clientes (`upsertClienteId`) y hay un
   check en CI. **Copiar este archivo al CRM tal cual.**
3. **Patrón "toma-y-marca", nunca "manda y después marca".** Si el envío marca el
   registro en un segundo paso y ese paso falla, el cron reenvía el mismo correo
   para siempre (nos pasó con "cupo libre": se reenviaba cada 10 minutos). La
   solución: un RPC `security definer` que **selecciona y marca en la misma
   transacción** (`tomar_avisos_corte`, `tomar_confirmaciones_pendientes`, etc.),
   más un techo de tiempo en la vista (si algo falla, la fila deja de ofrecerse a
   los 30 minutos). Contrapartida asumida: un fallo del SMTP pierde ese correo en
   vez de reintentarlo. Es preferible.
4. **En n8n, el HTML de la plantilla se parsea como expresión.** Unas llaves dobles
   vacías o un signo peso suelto —incluso dentro de un comentario HTML— tiran
   `invalid syntax` y **el correo no sale**, en silencio. Nos rompió tres envíos.
   Regla: **todo el formato se calcula en un nodo Code** y el HTML no lleva
   expresiones. Hay una guardia en CI (`scripts/check-correos.ts`).
5. **Apagar `appendAttribution`** en los nodos de correo de n8n: por defecto agrega
   "This email was sent automatically with n8n" al pie de cada correo.
6. **La zona horaria de la instancia n8n es `America/New_York`.** Los workflows con
   hora fija necesitan `settings.timezone = "America/Bogota"` y un ciclo de
   desactivar/reactivar (el cron se registra al activar).

---

## 3. Bandeja Principal vs Promociones (medido, no supuesto)

El dueño reportó que el correo de Resend le llega a **Promociones**. Se verificó
consultando su propio Gmail por categoría:

| Origen | Correos | Categoría en Gmail |
|---|---|---|
| Hostinger (`reservas@`, los 6 de citas) | 16 mensajes | **Principal**, y Gmail los marca "importante" |
| Resend (`avisos@` y `reservas@`, el de marketing) | 3 mensajes | **Promociones** |

Mismo dominio, misma plantilla de diseño, distinto resultado. Los sospechosos, en
orden de peso:

1. **La cabecera `List-Unsubscribe` / `List-Unsubscribe-Post`.** Es la señal más
   documentada de "correo masivo" para Gmail. Los de Hostinger no la llevan.
2. **El camino de envío es nuevo.** Resend sale por IP compartidas de Amazon SES y
   el par dominio+camino no tiene historial; el buzón de Hostinger lleva meses
   entregando a esa misma bandeja.
3. **El contenido es marketing de verdad** ("ya te toca", botón grande, foto de
   fondo, enlaces sociales). Para ese correo, Promociones no es un error de Gmail.

**Lo que sí mueve la aguja** (y lo que no):

- Sí: menos imágenes y un solo enlace; una versión en texto plano real; asunto sin
  tono de promoción; `Reply-To` a un buzón que contesta; que el destinatario
  responda, marque como importante o arrastre a Principal (Gmail aprende **por
  destinatario**).
- Sí, con matices: quitar `List-Unsubscribe` sube la chance de Principal, pero le
  quita al cliente la baja de un clic → suben las marcas de spam, que es mucho peor.
  **Recomendación: conservar el enlace de baja en el cuerpo siempre; el header, solo
  en los correos que son marketing de verdad.**
- No: el nombre del buzón (`avisos@` vs `reservas@` dieron lo mismo), las etiquetas
  internas del proveedor, ni "pedirle" a Gmail que no lo clasifique.
- **Regla práctica:** lo transaccional (confirmaciones, recordatorios, avisos de
  cuenta) **nunca** lleva cabeceras de baja ni diseño de campaña. Lo de marketing
  las lleva y se asume que puede caer en Promociones — que además es donde el
  usuario de Gmail busca ofertas.

> Resultados del experimento controlado (3 variantes a la bandeja real): ver el
> anexo al final de este documento.

---

## 4. ¿Se puede tener "nuestro propio Resend"? Sí, con una advertencia

Hay que separar dos cosas que se confunden:

- **El software** (API, panel, dominios con DKIM, plantillas, webhooks de rebotes)
  es la parte fácil y hay opciones libres muy buenas.
- **La reputación de envío** (que Gmail y Outlook confíen en tu IP) es la parte
  difícil, y es exactamente lo que se paga al contratar Resend o SES.

### Opciones reales

| Camino | Qué es | Costo | Cuándo tiene sentido |
|---|---|---|---|
| **Resend / proveedor SaaS** (hoy) | API, dominios verificados, reputación resuelta | Gratis hasta 3.000/mes, 100/día; ~20 USD por 50.000 | Hasta que FourG tenga varios clientes mandando |
| **Postal** en el VPS + **Amazon SES** como salida | Postal da API, panel, dominios, webhooks (es "tu Resend"); SES pone la reputación | VPS que ya existe + ~0,10 USD por 1.000 correos | **El camino recomendado** cuando haya 3+ clientes o >5.000/mes |
| **Listmonk** en el VPS + SES | Igual pero orientado a campañas y listas (suscriptores, segmentos, bajas) | Lo mismo | Si el CRM va a hacer campañas, no solo transaccional |
| **Postal con IP propia** (sin SES) | Control total, cero costo por correo | VPS con IP dedicada + semanas de calentamiento | Solo con decenas de miles de correos/mes |

### Lo que exige el camino con IP propia (por eso no lo recomiendo todavía)

- IP fija con **PTR (DNS inverso)** que coincida con el hostname del servidor.
- **Puerto 25 saliente abierto**: los VPS lo traen bloqueado y hay que pedirlo
  explícitamente al proveedor, que puede negarlo.
- **Calentamiento**: subir el volumen de a poco durante 2-4 semanas.
- Procesar **rebotes y quejas** (bucle de retroalimentación con los proveedores) y
  vigilar listas negras (Spamhaus y compañía).
- Sin todo eso, el correo se va a spam y arrastra la reputación del dominio del
  cliente.

### ¿Y "local", en un computador de la oficina?

**Para entregar correo, no.** Las IP residenciales están en listas de bloqueo por
política en Gmail y Outlook, y el proveedor de internet cierra el puerto 25. Local
sí sirve para dos cosas legítimas:

- **Desarrollo y pruebas**: `Mailpit` o `MailHog` en Docker atrapan todo lo que la
  app envía y lo muestran en un panel, sin que salga nada a internet. Es lo correcto
  para el CRM en desarrollo.
- **Correr la lógica** (colas, plantillas, panel) en el VPS y que solo la *entrega*
  salga por SES o por el proveedor.

---

## 5. Arquitectura sugerida para el CRM (si va a mandar correo)

```
CRM (Next.js)                     Postgres
  └─ escribe la intención  ──►  tabla `avisos_pendientes`
                                    │
                                    ▼  RPC toma-y-marca (una transacción)
                                 n8n (o un cron del propio CRM)
                                    │
                                    ▼
                        Proveedor de salida (Resend hoy · Postal+SES mañana)
                                    │
                                    ▼  webhook de entregas/rebotes  ──► tabla `entregas`
```

Reglas que valen para cualquier proveedor:

1. **Un dominio (o subdominio) por cliente**, con su propio DKIM. Nunca mandar en
   nombre de un cliente desde el dominio de FourG.
2. **Separar transaccional de marketing**: dominio raíz para lo transaccional,
   subdominio (`news.` o `avisos.`) para campañas. Así una campaña con quejas no
   arrastra las confirmaciones.
3. **Guardar qué se mandó** (destinatario, tipo, fecha, id del proveedor) para poder
   responder "¿le llegó?" sin adivinar. En Barbas eso es la tabla `avisos_marketing`.
4. **Consentimiento y baja** para todo lo que no sea transaccional: casilla al
   registrar, marca de cuándo aceptó, token de baja por persona y enlace en cada
   correo (Ley 1581 de 2012). En Barbas: columnas `acepta_marketing`, `marketing_en`,
   `baja_en`, `marketing_token` en la tabla de clientes, más las rutas `/baja/[token]`
   y `POST /api/baja/[token]` (baja de un clic para Gmail).
5. **Rate limit y techo de reintentos** desde el día uno.

### Lo reutilizable de Barbas (copiar, no reinventar)

| Pieza | Archivo en `barbas-y-bigotes` |
|---|---|
| Filtro de direcciones que rebotan | `src/lib/email.ts` + `scripts/check-email.ts` |
| Cola toma-y-marca (SQL de referencia) | `supabase/migrations/0068_toca_corte.sql` |
| Consentimiento, baja y baja de un clic | `src/lib/marketing-actions.ts`, `src/app/baja/[token]/`, `src/app/api/baja/[token]/route.ts` |
| Plantilla de correo + guardia de llaves vacías | `docs/emails/*.html` + `scripts/check-correos.ts` |
| Workflow n8n que arma el correo en un nodo Code | script `n8n-toca-corte.mjs` (scratchpad; el patrón está descrito arriba) |
| Ping para que el envío salga al instante | `src/lib/n8n.ts` (webhook + cron como red) |

---

## 6. Decisiones que hay que tomar (para el CRM)

1. ¿El CRM manda correo **a nombre de FourG** o **a nombre de cada cliente**? Si es
   lo segundo, cada cliente necesita su dominio verificado y su remitente.
2. ¿Solo transaccional (avisos internos, notificaciones) o también campañas? Si hay
   campañas, entra Listmonk o el módulo de campañas propio, y el subdominio aparte.
3. ¿Volumen estimado por mes? Menos de 3.000: Resend gratis alcanza. Más: SES.
4. ¿Se quiere vender esto como servicio de FourG? Ahí sí vale montar Postal + SES en
   el VPS, con un dominio por cliente y el panel como producto.

**Mi recomendación:** empezar con Resend por dominio de cliente (cero infraestructura,
reputación resuelta) y montar Postal + SES cuando haya tres clientes mandando o se
pasen los 5.000 correos al mes. Local, solo Mailpit para desarrollo.

---

## 7. Anexo · experimento de bandeja (6-sep-2026)

Ocho variantes enviadas por Resend a la misma bandeja en ~35 minutos, consultando
después la categoría real en Gmail (`category:primary` vs `category:promotions`):

| # | Plantilla | Baja de un clic | Resultado |
|---|---|---|---|
| A | oscura, foto de fondo, botón degradado | sí | Promociones |
| B | oscura, foto de fondo, botón degradado | **no** | Promociones |
| C | carta clara, enlace de texto, con texto plano | no | **Principal** |
| D | carta clara, enlace de texto, con texto plano | sí | **Principal** |
| E | carta clara + logo + **botón sólido** | sí | Promociones |
| F | carta clara + **botón sólido**, sin logo | sí | Promociones |
| PROD | carta clara de producción (enlace de texto) | sí | Promociones |
| REP | **el cuerpo exacto de C/D, reenviado 10 min después** | sí | Promociones |

**Lo que esto enseña, sin adornos:**

1. **La cabecera `List-Unsubscribe` no decide nada** (A vs B, C vs D). Se puede
   conservar la baja de un clic, que es lo correcto para el cliente.
2. **El diseño sí pesa**: la plantilla pesada (foto de fondo, botón degradado) cayó
   en Promociones siempre; el botón sólido también la empuja para allá (E, F).
3. **Pero no alcanza, y es el hallazgo importante**: el cuerpo idéntico que había
   caído en Principal (C, D) cayó en Promociones al reenviarlo diez minutos después
   (REP). Gmail **aprende del comportamiento del remitente**: nueve correos casi
   iguales en media hora desde un camino de envío nuevo es, para el clasificador,
   exactamente un remitente masivo.
4. **Conclusión operativa:** no se puede "programar" la pestaña Principal. Lo que sí
   se controla es (a) no mandar lo transaccional por el mismo camino que el
   marketing, (b) mantener el volumen bajo y el contenido útil, (c) que el correo
   invite a responder — la interacción real del destinatario es lo que más mueve la
   clasificación, y es **por destinatario**.
5. Para un aviso de marketing, **Promociones no es un fracaso**: es donde el usuario
   de Gmail busca ofertas. La pelea que sí hay que ganar es que lo **transaccional**
   siga en Principal, y hoy lo está (16 de 16 correos de citas por el buzón de
   Hostinger).

**Decisión tomada en Barbas:** el "te toca corte" queda como **carta clara con
enlace de texto y versión en texto plano** (`docs/emails/toca-corte.html`). No por
la pestaña —que no está garantizada— sino porque se lee como un mensaje del barbero,
pesa un tercio, funciona en cualquier cliente de correo y no depende de imágenes.
Los seis correos de citas **no se tocan**: siguen por Hostinger, donde llevan meses
entrando a Principal.

**Método reutilizable** (para medir esto en el CRM sin adivinar): mandar la variante,
esperar un minuto y consultar el Gmail del destinatario con las herramientas de
Gmail usando `subject:<marca> category:primary` y `category:promotions`. La etiqueta
de categoría no viene en `labelIds`; hay que preguntarla en la consulta. Scripts de
referencia en el scratchpad de esta sesión: `prueba-bandeja.mjs`, `prueba-final.mjs`,
`resend-prueba.mjs`.

# Plantillas de correo

Las plantillas HTML que le llegan al cliente, el aviso al barbero y los avisos al
DUEÑO. Diseño: `.superpowers/design/correos.md` (§2 a §5 del prototipo).

| Archivo | Asunto | Workflow n8n | Cron | Datos |
|---|---|---|---|---|
| `confirmacion.html` | ¡Tu reserva en Barbas & Bigotes está confirmada! | `JJiAjBoc9NBQbky1` | cada 1 min | vista `v_confirmaciones_pendientes` |
| `recordatorio.html` | Recordatorio de tu cita 🔔 | `x8B5l6NbG2supIbH` | varias veces al día | RPC `tomar_avisos_pendientes()` (mañana + un rato antes; 0086 le pasó el filtro de 0057: no al que reservó hoy) |
| `cupo.html` | ¡Se liberó un cupo! 🎉 | `Psk61KioW7QM0tdA` | cada 10 min | vista `v_avisos_cola_pendientes` |
| `resena.html` | ¿Cómo te quedó? Califica tu visita ✂️ | `3Y5sa4e6ve1PuwpK` | cada 30 min | RPC `tomar_resenas_pendientes()` (con `resena_token` desde 0082; tarjeta real y `proximo_premio` desde 0086) |
| `aviso-barbero.html` | 💈 Nueva cita: (cliente) · (cuándo) — al BARBERO | `JJiAjBoc9NBQbky1` (rama) | cada 5 min + webhook al reservar | RPC `tomar_avisos_barbero()`; la renderiza el nodo Code (ver cabecera del archivo) |
| `aviso-dueno.js` | Nueva cita / Cierre de caja / Caja abierta / Calificación baja / Prueba — al DUEÑO | `JJiAjBoc9NBQbky1` (rama nueva, junto a la del barbero) | cada 5 min + webhook al reservar y al «Probar» | RPC `tomar_avisos_dueno()` (0084). Es el cuerpo del nodo Code: arma asunto, HTML y texto por fila. Vista previa: `node scripts/qa/preview-aviso-dueno.mjs <carpeta>` |

El cierre de caja ya NO sale del workflow `rruRsSSVLGnVguZF` (vista
`v_cierres_caja_pendientes`, destinatario escrito a mano en el nodo Gmail): lo
encola el trigger `trg_cierre_para_dueno` de 0084 y sale por la rama del dueño a
los correos que él puso en Ajustes → Avisos. Ese workflow se apaga, pero AL FINAL
(ver el orden de abajo).

### La rama del dueño: en qué orden y con qué cuidados

Comparte el workflow `JJiAjBoc9NBQbky1` con la confirmación al cliente y el aviso
al barbero. En n8n el primer nodo que falla corta la ejecución entera, así que un
error en esta rama puede dejar sin confirmación al cliente. Por eso:

1. **Primero se aplica 0084.** Antes de eso `tomar_avisos_dueno` no existe, el
   HTTP responde 404 en cada vuelta del cron y en cada webhook «Al reservar».
2. **Los tres nodos nuevos llevan Settings → On Error → «Continue (regular
   output)»**: «Avisos al dueño» (HTTP al RPC), «Filas aviso dueño» (Code, cuerpo
   = `aviso-dueno.js`) y «Enviar aviso al dueño» (emailSend). Un SMTP caído para
   un correo del dueño no puede tumbar la confirmación de un cliente.
3. **La rama va ABAJO de las otras en el lienzo** (con el orden de ejecución v1,
   las ramas corren según su posición): la confirmación y el aviso al barbero
   salen primero.
4. **El workflow viejo del cierre (`rruRsSSVLGnVguZF`) se apaga solo cuando** la
   rama ya está corriendo **y** hay al menos un correo en Avisos con «Cierre de
   caja» prendido que haya recibido su «Probar». Antes de eso, los cierres que se
   encolan y nadie toma vencen a las 24 h (`tomar_avisos_dueno` solo toma lo del
   último día) y no le llegarían ni al Gmail que hoy los recibe.

La cola guarda datos de clientes (nombre, teléfono, nota, comentario): se borra
sola a los 7 días y «Eliminar mi cuenta» borra las filas de ese cliente (0084).

**`options.appendAttribution: false` en todos los nodos de correo.** Por defecto n8n
mete "This email was sent automatically with n8n" al pie. Son correos de cara al
cliente de la barbería: si se crea un workflow nuevo, apagarlo también.

## Esto es una copia, no la fuente

Lo que se ejecuta vive dentro de n8n, en el nodo `emailSend` de cada workflow.
Estos archivos son la copia versionada para no depender de que esa instancia siga
viva. **Si editas una, edita la otra.** `resena.html` y `aviso-dueno.js` son la
excepción: nacieron acá y se suben a n8n desde el repo.

## Trampas de n8n (aprendidas a los golpes)

- Las `{{ }}` son expresiones de n8n. **No pongas llaves dobles ni en los comentarios
  HTML**, las evalúa igual y revienta el envío.
- Backticks anidados dentro de una expresión rompen el parser. Si necesitas armar
  HTML en un bucle, hazlo en el nodo Code y pásalo como una variable más.
- Los nodos "marcar enviado" que referencian `$('otro nodo').item` **después** de un
  `emailSend` pueden devolver 2xx sin marcar nada. Eso provocó que el correo de cupo
  se reenviara cada 10 minutos al mismo cliente. Mejor filtros por estado, o que la
  base marque sola (lo que hacen los RPC de reseñas, del barbero y del dueño).
- Tema oscuro: hace falta el `<meta name="color-scheme" content="dark">` **y**
  `bgcolor` en los `td`, o Gmail en modo claro invierte los fondos.

## Por qué no está el JSON de los workflows

Porque los nodos HTTP llevan la `service_role` de Supabase embebida en las cabeceras.
Exportar el workflow completo metería esa llave al repo. Si necesitas recrear uno,
duplica otro desde la interfaz de n8n: así hereda las credenciales sin que nadie las
tenga que copiar y pegar.

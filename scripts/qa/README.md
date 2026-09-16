# QA de navegador (manual)

Recorridos con Playwright que simulan a un cliente real. **No corren en CI**: usan
un navegador de verdad contra un build levantado, y una reserva completa escribe
en la base de producción. Se corren a mano cuando se toca el wizard o el footer.

Lo que sí corre en CI son los self-checks puros de `scripts/check-*.ts`
(`npm test`), que no necesitan navegador.

## Cómo correrlos

```bash
npm run build && npm start          # deja el sitio en localhost:3000
pip install playwright && playwright install chromium   # solo la primera vez
python scripts/qa/recorrido-movil.py
python scripts/qa/areas-tactiles.py
python scripts/qa/vuelta-de-google.py
python scripts/qa/turnos-encadenados.py
python scripts/qa/latencia-confirmacion.py     # contra producción por defecto
node   scripts/qa/carreras.mjs                # no necesita navegador
```

## Qué mide cada uno

**`recorrido-movil.py`** — recorre el wizard completo en 320, 360 y 390px de
ancho. 360px es el más común del público (Android de gama media en Barranquilla);
320px es el piso. Busca desbordes horizontales, textos apretados y botones por
debajo de 44px de alto. Salida esperada: `TOTAL con problema: 0`.

**`areas-tactiles.py`** — mide el área táctil REAL de los enlaces chicos del
sitio público con `elementFromPoint`, no con `getBoundingClientRect`. La
diferencia importa: varios enlaces agrandan su zona de toque con un `::before`,
que no cambia el rectángulo del elemento. Midiendo el rect parecerían rotos
aunque funcionen bien. Salida esperada: los cuatro casos en `OK` (>=44px).

**`vuelta-de-google.py`** — el cliente llega al paso 5, entra con Google y vuelve.
Si el snapshot de `sessionStorage` falla, pierde sede, servicio, barbero, día y
hora, y tiene que rehacer todo. Corta el salto a Google (interceptando la
petición) y recarga `/reservar` para simular el regreso. Comprueba tres cosas:
que restaure idéntico en el paso 5, que el snapshot se consuma después de usarlo
(una segunda carga arranca limpia) y que uno de hace más de 30 minutos no
restaure. Este no escribe nada en la base.

**`turnos-encadenados.py`** — el recorrido que valida el cambio de agenda de
ago-2026 (grilla de 15 minutos + turnos pegados al fin de la cita anterior) y la
hoja de confirmación con cuenta atrás. Siembra una cita que termina **2:40 pm**
—una hora que NO cae en la grilla— y comprueba que el wizard ofrezca ese 2:40,
que el turno que la pisa esté tomado, que "Editar" frene la reserva sin crear
nada, que la cuenta atrás reserve sola y que la cita quede guardada con la hora
EXACTA. Ese último punto es el que prueba que el servidor dejó de exigir la
grilla: la pantalla podía ofrecer 2:40 y el POST rebotarlo. Escribe en producción
y limpia todo lo que crea (incluida la ficha del cliente QA) en un `finally`.

Ojo al escribir asserts sobre este wizard: varios títulos y CTAs van en
`uppercase` por CSS y `inner_text` devuelve el texto RENDERIZADO — comparar contra
"Confirmando" tal cual falla aunque la pantalla esté perfecta. Van con `re.I`.

**`latencia-confirmacion.py`** — reserva de verdad en el sitio y cronometra los
segundos hasta que sale el correo de confirmación (`confirm_sent` se marca DESPUÉS
de enviar). Vigila el empujón a n8n de `src/lib/n8n.ts`: sin él, el correo sale en
la vuelta del cron —hasta 60 s— y el check falla al pasar de 25. Si un día alguien
borra la variable `N8N_WEBHOOK_CONFIRMACION` o el webhook deja de estar registrado
en n8n, esto lo canta. Manda un correo real: por defecto a four4gsolutions@gmail.com
(`DESTINO=` para cambiarlo). Medido el 22-ago: **2 segundos**.

**`carreras.mjs`** — dispara carreras reales contra producción para comprobar que
**dos clientes no se quedan con el mismo turno** y que **una cita no se cobra dos
veces**: 8 reservas simultáneas al mismo cupo, una cita que se pisa 15 minutos con
otra, cancelar y volver a reservar, 6 cobros simultáneos de la misma cita y 4 clics
del mismo botón.

Existe porque esas reglas **no viven en el código, viven en la base** (un `EXCLUDE`
de Postgres para el solape, `ventas_reserva_unica` y `ventas_idem_unica` para el
cobro). Eso es lo correcto —la pantalla puede mentir, la base no— pero tiene un
costo: si una migración borra un índice, **nada falla**. La app sigue andando y un
día aparecen dos clientes a la misma hora o una cita cobrada dos veces, sin error y
sin log. Correr esto después de cualquier migración que toque `reservas` o `ventas`.

No necesita navegador. Limpia todo lo que crea, incluso si algo revienta a mitad.

**`sesion-staff.mjs`** — la llave que faltaba para poder probar el **panel y el
mostrador**, que están detrás de login. Deja una sesión real de staff lista para
Playwright **sin usar la contraseña de nadie**: pide un enlace de un solo uso con
la llave de servicio, lo canjea y escribe la cookie que espera `@supabase/ssr`.
Es el mismo mecanismo que `barbero-auth.ts` usa para el login por PIN.

```bash
ROL=admin   node scripts/qa/sesion-staff.mjs   # dueño: /admin
ROL=sede    node scripts/qa/sesion-staff.mjs   # mostrador de una sede: /barbero
ROL=barbero node scripts/qa/sesion-staff.mjs   # un barbero
```

Deja `qa-out/cookies-<rol>.json` (ignorado por git) para cargarlo con
`context.add_cookies(...)`. La sesión vence en una hora.

Ojo con **qué ve cada rol**: el admin no tiene sede, así que en el mostrador ve las
dos y **no** le aparecen el cierre de caja ni el registro de consumos —esos cuelgan
de una sede—. Para probar esa parte hay que entrar con `ROL=sede`.

**`vista-staff.py`** — el arnés de **diseño** del staff: mide las 16 pantallas del
panel más las 5 del mostrador, en 375 y 1280 px, con los tres roles, y deja un
`metricas.json` comparable antes/después de cada tanda.

```bash
npm run build && npm start                      # el sitio en localhost:3000
ROL=admin node scripts/qa/sesion-staff.mjs      # y lo mismo con sede y barbero
python scripts/qa/vista-staff.py                # -> docs/auditoria-visual/antes-tanda2/
SALIDA=docs/auditoria-visual/despues-tanda2 python scripts/qa/vista-staff.py
SOLO=horarios CAPTURAS=0 python scripts/qa/vista-staff.py   # una pantalla, sin PNG
```

Existe porque el script que cerró la tanda 1 con números **no quedó versionado**, y
`docs/auditoria-visual/despues/metricas.json` cubre solo admin: la corrida móvil de
`/admin` murió con `ERR_NETWORK_CHANGED` y el mostrador no aparece ni una vez. Sin
esto, "no retrocede la tanda 1" no se podía probar.

Por pantalla mide alto, cromo, interactivos, controles < 40 px **con su lista**,
texto < 12 px, familias/tamaños/pesos/colores, contraste AA real (sabe leer
`oklab`/`oklch`, no solo `rgb`), emoji en la interfaz, firmas de botón, radios,
imágenes deformadas o sin `alt`, desborde horizontal, y dos medidas propias de la
tanda 2: **`solapados`** (controles que algo TAPA, medido con `elementFromPoint` como
`areas-tactiles.py`, porque una barra fija no cambia el rect de lo que cubre) y
**`yPrimerDato`**.

Va contra un build **local**, no contra producción: producción fue justamente lo que
rompió la corrida anterior. No escribe nada en la base.

`solapados` cuenta solo lo que queda tapado **para siempre**: se mide al final del
scroll y solo si el que tapa cuelga de algo `fixed`/`sticky` anclado en la mitad de
abajo. La primera versión contaba también lo que pasa por debajo de la cabecera
pegajosa al scrollear —y eso no es un defecto, se destapa scrolleando—: de los
"tapados" que reportó, 25 eran el buscador Ctrl-K del topbar. Con ese ruido adentro el
número no servía para comparar antes y después.

El **punto ciego del arnés viejo**, encontrado al validar este contra aquel: de 2.779
colores de texto, el viejo **no pudo leer 587** (el 21 %) y los contaba como "sin medir".
Su "AA 0" era en realidad "AA 0 entre el 79 % que supo interpretar". Este lee los 3.124,
incluidos `oklab` y `oklch`, que es donde estaban escondidos los fallos que quedaban.
Los controles < 40 px, en cambio, dan **idénticos en las 31 pantallas comunes**: por ahí
se validó que el instrumento nuevo mide lo mismo que el viejo.

WCAG 1.4.3 exime el texto de un control **inactivo**, así que el contraste no se le exige
a nada que esté `disabled`, `aria-disabled` o sea un enlace/botón con `pointer-events:
none`; esos se cuentan aparte en `contrasteInactivos` para que la exención quede a la
vista y no sea un descuento silencioso.

**Tres números no pueden subir nunca:** `nContrasteMal`, `textoChico` y `emojiUI`, los
tres en cero desde la tanda 1. Y ojo: `cromo` se calcula acá como la distancia al
primer hijo de `<main>`; la fórmula vieja no se conserva, así que se compara
**antes-tanda2 contra después-tanda2**, nunca contra el archivo de la tanda 1.

## Ojo con los datos

Un recorrido que llega al final **crea una reserva de verdad** (las variables de
entorno apuntan a la base de producción, no hay ambiente aparte). Si lo corrés
hasta confirmar, después borrá la reserva y el cliente de prueba.

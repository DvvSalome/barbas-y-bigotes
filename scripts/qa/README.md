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

## Ojo con los datos

Un recorrido que llega al final **crea una reserva de verdad** (las variables de
entorno apuntan a la base de producción, no hay ambiente aparte). Si lo corrés
hasta confirmar, después borrá la reserva y el cliente de prueba.

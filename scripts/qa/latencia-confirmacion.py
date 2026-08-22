"""Cronometra cuanto tarda la confirmacion desde que el cliente toca reservar.

    python scripts/qa/latencia-confirmacion.py                 # contra produccion
    BASE=http://localhost:3000 python scripts/qa/latencia-confirmacion.py

Reserva DE VERDAD en el sitio (wizard completo) y mide los segundos hasta que
n8n marca confirm_sent — el flag se pone DESPUES de enviar, asi que mide el
correo saliendo, no la intencion de mandarlo.

Existe para vigilar el empujon a n8n (src/lib/n8n.ts): sin el, el correo sale en
la vuelta del cron (hasta 60 s). Si un dia alguien borra la variable de entorno o
el webhook deja de estar registrado, esto lo canta: los segundos se van a 60.

ESCRIBE EN PRODUCCION y manda un correo de verdad al destinatario de abajo. Borra
la cita y la ficha al terminar, siempre (finally).
"""

import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone

from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "https://barbasybigotes.com")
RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BOGOTA = timezone(timedelta(hours=-5))

# A donde llega el correo de prueba. Tiene que ser una direccion REAL: mandar a
# una muerta es justo lo que hizo que bloquearan el remitente en agosto.
DESTINO = os.environ.get("DESTINO", "four4gsolutions@gmail.com")
MARCA = "QA latencia"
SEDE_TXT = "Parque Venezuela"

# Umbral: con el empujon, el correo sale en segundos. Si tarda mas que esto, o el
# webhook no esta llegando o n8n lo ignora, y volvimos al cron.
LIMITE_S = int(os.environ.get("LIMITE_S", "25"))


def env():
    out = {}
    with open(os.path.join(RAIZ, ".env.local"), encoding="utf-8") as f:
        for linea in f:
            if "=" in linea and not linea.startswith("#"):
                k, _, v = linea.partition("=")
                out[k.strip()] = v.strip()
    return out


E = env()
U, SRV = E["NEXT_PUBLIC_SUPABASE_URL"], E["SUPABASE_SERVICE_ROLE_KEY"]


def rest(metodo, path, cuerpo=None, prefer=None):
    req = urllib.request.Request(f"{U}/rest/v1/{path}", method=metodo)
    req.add_header("apikey", SRV)
    req.add_header("Authorization", f"Bearer {SRV}")
    req.add_header("Content-Type", "application/json")
    if prefer:
        req.add_header("Prefer", prefer)
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    try:
        with urllib.request.urlopen(req, datos) as r:
            txt = r.read().decode()
            return r.status, (json.loads(txt) if txt.strip() else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def main():
    reserva_id = None
    cliente_id = None
    try:
        with sync_playwright() as p:
            nav = p.chromium.launch()
            pag = nav.new_page(viewport={"width": 390, "height": 844})
            pag.goto(f"{BASE}/reservar", wait_until="networkidle")

            pag.get_by_role("button", name=re.compile(SEDE_TXT)).first.click()
            pag.get_by_role("button", name="Continuar").click()

            # Primer servicio que se pueda elegir de la categoria que este abierta.
            tarjeta = pag.locator("button:has-text('$')").first
            tarjeta.click()
            pag.get_by_role("button", name="Continuar").click()

            sin_bebida = pag.get_by_role("button", name=re.compile("gracias|Seguir sin|No,", re.I))
            if sin_bebida.count() > 0:
                sin_bebida.first.click()

            # Cualquier barbero: se salta la eleccion.
            pag.get_by_role("button", name="Continuar").click()

            pag.get_by_role("button", name=re.compile("Mañana")).first.click()
            pag.get_by_role("button", name=re.compile(r"^\d{1,2}:\d{2} (am|pm)")).first.wait_for(timeout=20000)
            libre = pag.get_by_role("button", name=re.compile(r"^\d{1,2}:\d{2} (am|pm)")).filter(
                has_not=pag.locator("[disabled]")
            )
            libre.first.click()
            pag.get_by_role("button", name="Continuar").click()

            pag.get_by_placeholder("Como quieres que te digamos").first.fill(MARCA)
            pag.get_by_placeholder("nombre@correo.com").first.fill(DESTINO)
            pag.get_by_role("button", name="Confirmar").click()

            invitado = pag.get_by_role("button", name=re.compile("como invitado", re.I))
            try:
                invitado.first.wait_for(timeout=2500)
                invitado.first.click()
            except Exception:
                pass

            # La hoja de confirmacion corre 5 s sola; se toca el boton para no
            # meter esa espera dentro de la medicion.
            ok = pag.get_by_role("button", name=re.compile(r"confirmar \(\ds\)", re.I))
            ok.first.wait_for(timeout=8000)
            ok.first.click()
            t0 = time.time()

            pag.wait_for_timeout(1500)
            nav.close()

        # Buscar la cita recien creada y cronometrar hasta que salga el correo.
        st, filas = rest("GET", f"clientes?select=id&email=eq.{DESTINO}&order=creado_en.desc&limit=1")
        cliente_id = filas[0]["id"] if st == 200 and filas else None
        if not cliente_id:
            print("No se creo la ficha del cliente: el wizard no llego a reservar.")
            return 1
        st, r = rest("GET", f"reservas?select=id,confirm_sent&cliente_ref=eq.{cliente_id}&order=creado_en.desc&limit=1")
        reserva_id = r[0]["id"] if st == 200 and r else None
        print(f"Reserva creada. Esperando la confirmacion a {DESTINO}…")

        enviado_en = None
        for _ in range(60):
            st, r = rest("GET", f"reservas?select=confirm_sent&id=eq.{reserva_id}")
            if st == 200 and r and r[0]["confirm_sent"]:
                enviado_en = time.time() - t0
                break
            time.sleep(2)

        if enviado_en is None:
            print("FALLA: pasaron 2 minutos y la confirmacion no salio.")
            return 1
        print(f"Confirmacion enviada a los {enviado_en:.0f} segundos de reservar.")
        if enviado_en > LIMITE_S:
            print(f"FALLA: mas de {LIMITE_S}s — el empujon a n8n no esta llegando (volvio al cron).")
            return 1
        print("OK: el correo sale al instante, no en la vuelta del cron.")
        return 0
    finally:
        if reserva_id:
            rest("DELETE", f"reservas?id=eq.{reserva_id}")
        if cliente_id:
            rest("DELETE", f"clientes?id=eq.{cliente_id}")
        print("Limpieza hecha.")


if __name__ == "__main__":
    sys.exit(main())

"""Recorrido de cliente real que valida el cambio de agenda (STEP 15 + encadenado)
y la hoja de confirmacion con cuenta atras.

    npm run build && npm start          # deja el sitio en localhost:3000
    python scripts/qa/turnos-encadenados.py

Que prueba, y por que importa cada cosa:

  1. La grilla es de 15 minutos (antes 30).
  2. ENCADENADO: se siembra una cita que termina 2:40 pm — una hora que NO cae en
     la grilla — y el wizard tiene que ofrecer ese 2:40. Es el cambio que le
     devuelve silla al local: sin el, ese cliente se iba a las 2:45.
  3. El turno que pisa la cita sembrada aparece tomado (no se puede reservar
     encima).
  4. La hoja de confirmacion sale con su cuenta atras, y "Editar" NO crea nada:
     esa es toda la razon de ser de la hoja.
  5. Reservar de verdad a las 2:40 escribe la cita con esa hora EXACTA. Es la
     prueba de que el servidor dejo de exigir la grilla (slotEnVentana) — la
     pantalla podia ofrecer 2:40 y el POST rebotarlo.

ESCRIBE EN LA BASE DE PRODUCCION (igual que recorrido-movil.py). Todo lo que crea
lo borra al final, incluida la ficha del cliente de prueba; si el script muere a
mitad, la limpieza igual corre en el `finally`.
"""

import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BOGOTA = timezone(timedelta(hours=-5))  # Colombia no tiene horario de verano

# Marca del cliente de prueba: hace la limpieza inequivoca y evita confundirlo con
# un cliente real si algo queda a medias.
MARCA = "QA turnos encadenados"
EMAIL_QA = "qa-turnos@barbasybigotes.com"

SEDE = "parque-venezuela"
BARBERO = "Meyer"
FIN_SEMBRADO_MIN = 14 * 60 + 40  # 2:40 pm: NO cae en la grilla de 15 desde las 9:00


def env():
    ruta = os.path.join(RAIZ, ".env.local")
    out = {}
    with open(ruta, encoding="utf-8") as f:
        for linea in f:
            if "=" in linea and not linea.startswith("#"):
                k, _, v = linea.partition("=")
                out[k.strip()] = v.strip()
    return out


E = env()
URL = E["NEXT_PUBLIC_SUPABASE_URL"]
SRV = E["SUPABASE_SERVICE_ROLE_KEY"]


def rest(metodo, path, cuerpo=None, prefer=None):
    """PostgREST con service_role. Devuelve (status, json|texto)."""
    req = urllib.request.Request(f"{URL}/rest/v1/{path}", method=metodo)
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


fallos = []


def ok(cond, msg):
    print(("  OK   " if cond else "  FALLA ") + msg)
    if not cond:
        fallos.append(msg)


def instante(fecha_ymd, minuto):
    h, m = divmod(minuto, 60)
    return datetime(
        int(fecha_ymd[0:4]), int(fecha_ymd[5:7]), int(fecha_ymd[8:10]), h, m, tzinfo=BOGOTA
    )


def fmt_hora(minuto):
    """Mismo formato que fmtTime() del front: '2:40 pm'."""
    h, m = divmod(minuto, 60)
    ap = "am" if h < 12 else "pm"
    hh = ((h + 11) % 12) + 1
    return f"{hh}:{m:02d} {ap}"


def main():
    hoy = datetime.now(BOGOTA)
    manana = hoy + timedelta(days=1)
    ymd = manana.strftime("%Y-%m-%d")

    # --- Datos reales del catalogo -------------------------------------------
    st, barberos = rest("GET", f"barberos?select=id,nombre&sede_id=eq.{SEDE}&nombre=eq.{BARBERO}")
    if st != 200 or not barberos:
        print(f"No encontre al barbero {BARBERO} en {SEDE}: {barberos}")
        return 1
    barbero_id = barberos[0]["id"]

    st, servs = rest(
        "GET",
        f"servicio_sede?select=servicio_id,servicios(nombre,duracion_min,activo)&sede_id=eq.{SEDE}&limit=60",
    )
    servicio = next(
        (
            s
            for s in servs
            if s.get("servicios")
            and s["servicios"].get("activo") is not False
            and s["servicios"]["duracion_min"] <= 30
        ),
        None,
    )
    if not servicio:
        print("No hay un servicio corto con precio en la sede para la prueba.")
        return 1
    servicio_id = servicio["servicio_id"]
    servicio_nombre = servicio["servicios"]["nombre"]
    dur = servicio["servicios"]["duracion_min"]
    print(f"Servicio de prueba: {servicio_nombre} ({dur} min) · barbero {BARBERO} · {ymd}")

    sembrada_id = None
    creada_id = None
    cliente_qa_id = None
    try:
        # --- 1) Sembrar la cita que termina 2:40 pm --------------------------
        ini = instante(ymd, FIN_SEMBRADO_MIN - 20)
        fin = instante(ymd, FIN_SEMBRADO_MIN)
        st, filas = rest(
            "POST",
            "reservas",
            {
                "sede_id": SEDE,
                "barbero_id": barbero_id,
                "servicio_id": servicio_id,
                "inicio": ini.isoformat(),
                "fin": fin.isoformat(),
                "estado": "confirmada",
                "canal": "walkin",
                "nota": MARCA,
            },
            prefer="return=representation",
        )
        if st not in (200, 201):
            print(f"No pude sembrar la cita: {st} {filas}")
            return 1
        sembrada_id = filas[0]["id"]
        print(f"Cita sembrada {fmt_hora(FIN_SEMBRADO_MIN - 20)}–{fmt_hora(FIN_SEMBRADO_MIN)}")

        with sync_playwright() as p:
            navegador = p.chromium.launch()
            pagina = navegador.new_page(viewport={"width": 390, "height": 844})
            pagina.goto(f"{BASE}/reservar", wait_until="networkidle")

            # --- Paso 1: sede
            pagina.get_by_role("button", name=re.compile("Parque Venezuela")).first.click()
            pagina.get_by_role("button", name="Continuar").click()

            # --- Paso 2: servicio (las categorias son chips; se busca en todas)
            elegido = False
            for _ in range(9):
                tarjeta = pagina.get_by_role("button", name=re.compile(re.escape(servicio_nombre)))
                if tarjeta.count() > 0:
                    tarjeta.first.click()
                    elegido = True
                    break
                # Siguiente categoria de la fila de chips.
                chips = pagina.locator("button:has(span.font-display)")
                chips.nth(min(chips.count() - 1, 1)).click()
            ok(elegido, f"se puede elegir el servicio '{servicio_nombre}'")
            if not elegido:
                navegador.close()
                return 1
            pagina.get_by_role("button", name="Continuar").click()

            # El upsell de bebida puede interponerse: se rechaza si aparece.
            no_gracias = pagina.get_by_role("button", name=re.compile("gracias|Seguir sin|No,"))
            if no_gracias.count() > 0:
                no_gracias.first.click()

            # --- Paso 3: barbero
            pagina.get_by_role("button", name=re.compile(BARBERO)).first.click()
            pagina.get_by_role("button", name="Continuar").click()

            # --- Paso 4: horario (manana)
            pagina.get_by_role("button", name=re.compile("Mañana")).first.click()
            # Esperar la CONDICION, no un tiempo: la disponibilidad del barbero
            # llega por red y mientras tanto se dibuja un esqueleto. Con un
            # wait_for_timeout fijo, un servidor frio hacia fallar los asserts de
            # la grilla aunque los turnos estuvieran perfectos (y el propio click
            # de mas abajo, que SI espera, funcionaba: sintoma de test flaky).
            pagina.get_by_role("button", name=re.compile(r"^\d{1,2}:\d{2} (am|pm)")).first.wait_for(timeout=20000)

            texto = pagina.inner_text("body")
            ok("2:15 pm" in texto and "2:45 pm" in texto, "la grilla ofrece turnos cada 15 minutos")
            ok(
                fmt_hora(FIN_SEMBRADO_MIN) in texto,
                f"ENCADENADO: ofrece {fmt_hora(FIN_SEMBRADO_MIN)}, justo cuando se desocupa la silla",
            )

            pisado = pagina.get_by_role("button", name=re.compile(r"^2:30 pm")).first
            ok(
                pisado.count() == 0 or pisado.is_disabled(),
                "el turno que pisa la cita sembrada esta tomado",
            )

            # --- Reservar en el turno encadenado
            pagina.get_by_role("button", name=re.compile(rf"^{re.escape(fmt_hora(FIN_SEMBRADO_MIN))}")).first.click()
            pagina.get_by_role("button", name="Continuar").click()

            # --- Paso 5: datos
            pagina.get_by_placeholder("Como quieres que te digamos").first.fill(MARCA)
            pagina.get_by_placeholder("nombre@correo.com").first.fill(EMAIL_QA)
            # El CTA se habilita con los dos campos validos; si sigue apagado, algo
            # cambio en el form y es mejor fallar claro que esperar 30 segundos.
            cta = pagina.get_by_role("button", name="Confirmar")
            ok(not cta.is_disabled(), "con nombre y correo el boton Confirmar se habilita")
            cta.click()

            # El nudge de Google sale UNA vez para invitados y tapa la hoja: hay que
            # esperarlo de verdad, no preguntar por el en el mismo tick del click.
            invitado = pagina.get_by_role("button", name=re.compile("como invitado", re.I))
            try:
                invitado.first.wait_for(timeout=2500)
                invitado.first.click()
            except Exception:
                pass  # no salio (ya se habia visto en este flujo)
            pagina.wait_for_timeout(400)

            # --- 4) La hoja de confirmacion
            # OJO: el titulo y el CTA van en `uppercase` por CSS, y inner_text
            # devuelve el texto RENDERIZADO — comparar contra "Confirmando" tal cual
            # falla aunque la hoja este perfecta. Todo lo de acá va sin distinguir
            # mayusculas por eso.
            cuerpo = pagina.inner_text("body")
            ok(
                re.search("confirmando tu cita", cuerpo, re.I) is not None,
                "sale la hoja de confirmacion antes de reservar",
            )
            ok(
                re.search(r"confirmar \(\ds\)", cuerpo, re.I) is not None,
                "el boton muestra la cuenta atras",
            )
            ok("Editar" in cuerpo, "se puede volver a editar")

            # Editar NO puede haber creado nada.
            pagina.get_by_role("button", name="Editar").click()
            pagina.wait_for_timeout(300)
            st, previas = rest(
                "GET", f"reservas?select=id&barbero_id=eq.{barbero_id}&nota=eq.{MARCA.replace(' ', '%20')}"
            )
            ok(
                st == 200 and len(previas) == 1,
                "'Editar' frena la reserva: no se creo nada (solo sigue la sembrada)",
            )

            # --- 5) Ahora si: confirmar y dejar que corra la cuenta atras
            pagina.get_by_role("button", name="Confirmar").click()
            pagina.wait_for_timeout(8000)  # 5s de cuenta atras + el viaje al servidor
            cuerpo = pagina.inner_text("body")
            ok(
                re.search("listo", cuerpo, re.I) is not None,
                "la cuenta atras reserva sola, sin tocar el boton",
            )

            navegador.close()

        # --- La cita quedo con la hora EXACTA (el servidor acepto el 2:40) -----
        st, nuevas = rest(
            "GET",
            f"reservas?select=id,inicio,fin,cliente_ref&barbero_id=eq.{barbero_id}&id=neq.{sembrada_id}"
            f"&inicio=gte.{instante(ymd, 0).isoformat()}&inicio=lt.{instante(ymd, 1439).isoformat()}",
        )
        creada = nuevas[0] if st == 200 and nuevas else None
        ok(creada is not None, "la reserva quedo guardada")
        if creada:
            creada_id = creada["id"]
            cliente_qa_id = creada.get("cliente_ref")
            minuto = datetime.fromisoformat(creada["inicio"]).astimezone(BOGOTA)
            minuto = minuto.hour * 60 + minuto.minute
            ok(
                minuto == FIN_SEMBRADO_MIN,
                f"el servidor guardo la hora exacta ({fmt_hora(minuto)}), sin empujarla a la grilla",
            )
    finally:
        # Limpieza: lo de prueba no se queda en la base del local.
        for rid in (creada_id, sembrada_id):
            if rid:
                rest("DELETE", f"reservas?id=eq.{rid}")
        if cliente_qa_id:
            rest("DELETE", f"clientes?id=eq.{cliente_qa_id}")
        print("Limpieza hecha (citas de prueba y ficha del cliente QA borradas).")

    print()
    if fallos:
        print(f"FALLARON {len(fallos)}:")
        for f in fallos:
            print(f"  · {f}")
        return 1
    print("turnos-encadenados OK — grilla de 15, encadenado, hoja de confirmacion y hora exacta.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

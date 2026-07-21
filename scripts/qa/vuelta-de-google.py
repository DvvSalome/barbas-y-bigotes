"""Volver del login de Google a mitad de reserva. Si el snapshot falla, el cliente
pierde sede + servicio + barbero + dia + hora. Dispara el guardado REAL (boton
'Continuar con Google'), corta el salto a Google y recarga como si volviera."""
import re
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
MEYER = "9d3b8b07-86ff-45b9-8d08-b23f951f95b9"
PIE = "() => { const f = document.querySelector('footer'); return f ? f.innerText.replace(/\\s+/g,' ').trim() : ''; }"


def paso_de(pg):
    m = re.search(r"Paso (\d) de 5", pg.inner_text("body"))
    return m.group(1) if m else "?"


def cont(pg):
    b = pg.get_by_role("button", name=re.compile("^continuar$", re.I))
    if b.count() and b.first.is_visible() and b.first.is_enabled():
        b.first.click(); pg.wait_for_timeout(1000)


with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={"width": 375, "height": 720}, is_mobile=True,
                         has_touch=True, timezone_id="America/Bogota", locale="es-CO")
    ctx.route(re.compile(r"accounts\.google\.com|/auth/v1/authorize"), lambda r: r.abort())
    pg = ctx.new_page()

    pg.goto(f"{BASE}/reservar?barbero={MEYER}", wait_until="load", timeout=45000)
    pg.wait_for_timeout(2400)
    pg.get_by_text("Corte y barba", exact=False).first.click(); pg.wait_for_timeout(400); cont(pg)
    for t in ["no, gracias", "sin bebida", "seguir"]:
        b = pg.get_by_role("button", name=re.compile(t, re.I))
        if b.count() and b.first.is_visible():
            b.first.click(); pg.wait_for_timeout(900); break
    cont(pg); pg.wait_for_timeout(1300)
    slots = pg.get_by_role("button", name=re.compile(r"^\d{1,2}:\d{2} (am|pm)$"))
    elegido = None
    for i in range(slots.count() - 1, -1, -1):
        if slots.nth(i).is_enabled():
            elegido = slots.nth(i).inner_text().strip()
            slots.nth(i).scroll_into_view_if_needed(); pg.wait_for_timeout(200)
            slots.nth(i).click(); break
    pg.wait_for_timeout(400); cont(pg); pg.wait_for_timeout(900)

    antes = pg.evaluate(PIE)
    print("ANTES de ir a Google:  paso", paso_de(pg), "|", antes[:80])

    g = pg.get_by_role("button", name=re.compile("continuar con google", re.I))
    if not g.count():
        print("!! no aparecio el boton de Google"); br.close(); raise SystemExit(1)
    g.first.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
    g.first.click()
    pg.wait_for_timeout(2500)

    # volver de Google = cargar /reservar de nuevo
    pg.goto(f"{BASE}/reservar", wait_until="load", timeout=45000)
    pg.wait_for_timeout(3000)
    despues = pg.evaluate(PIE)
    print("DESPUES de volver:     paso", paso_de(pg), "(esperado 5) |", despues[:80])
    print("  restauro identico:", antes == despues)
    print("  conserva la hora:  ", (elegido or "") in despues, f"({elegido})")
    pg.screenshot(path="./qa-out/google_vuelta.png")

    # el snapshot no debe sobrevivir a un segundo regreso (se consume al usarlo)
    pg.goto(f"{BASE}/reservar", wait_until="load", timeout=45000)
    pg.wait_for_timeout(2500)
    print("  segunda carga:     paso", paso_de(pg), "(esperado 1: el snapshot ya se consumio)")

    # y un snapshot vencido (>30 min) tampoco debe restaurar
    pg.evaluate("""() => sessionStorage.setItem('bb-reserva-reanudar', JSON.stringify({
        t: Date.now() - 45*60000, sedeId: 'parque-venezuela', servicioId: 'corte',
        barberoId: null, dayISO: new Date().toISOString(), slot: 600 }))""")
    pg.goto(f"{BASE}/reservar", wait_until="load", timeout=45000)
    pg.wait_for_timeout(2500)
    print("  vencido 45 min:    paso", paso_de(pg), "(esperado 1: no debe restaurar)")
    br.close()

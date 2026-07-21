"""El publico real (Barranquilla) usa Android de gama media: 360px es el ancho
mas comun, y todavia hay 320px. Recorre el wizard en varios anchos y busca
overflow, textos apretados y elementos que se pisan."""
import re, sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"  # el build local (npm start)
OUT = "./qa-out"
ANCHOS = [(320, "iPhone SE 1g / Android viejo"), (360, "Android gama media (el mas comun)"), (390, "iPhone moderno")]

AUDIT = """() => {
  const de = document.documentElement;
  const over = de.scrollWidth - de.clientWidth;
  const culpables = [];
  if (over > 0) {
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.right > de.clientWidth + 1 && r.width > 24) {
        culpables.push((el.tagName + '.' + (el.className||'').toString().slice(0,48)).slice(0,70) + ' w=' + Math.round(r.width));
        if (culpables.length > 3) break;
      }
    }
  }
  // texto que se desborda de su caja (apretado)
  const apretados = [];
  for (const el of document.querySelectorAll('button, span, div')) {
    if (el.children.length) continue;
    const t = (el.innerText||'').trim();
    if (!t) continue;
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 30) apretados.push(t.slice(0,34));
  }
  const chicos = [];
  for (const b of document.querySelectorAll('button, a[href], input')) {
    const r = b.getBoundingClientRect();
    if (r.width && r.height && r.height < 44) chicos.push(((b.innerText||b.tagName)+'').trim().slice(0,24)+' h='+Math.round(r.height));
  }
  return { over, culpables, apretados: [...new Set(apretados)].slice(0,5), chicos: [...new Set(chicos)].slice(0,4) };
}"""


def cont(pg):
    b = pg.get_by_role("button", name=re.compile("^continuar", re.I))
    if b.count() and b.first.is_visible() and b.first.is_enabled():
        b.first.click(); pg.wait_for_timeout(950); return True
    return False


def chequear(pg, w, paso):
    d = pg.evaluate(AUDIT)
    msg = []
    if d["over"] > 0:
        msg.append(f"OVERFLOW {d['over']}px -> {d['culpables']}")
    if d["apretados"]:
        msg.append(f"apretado {d['apretados']}")
    if d["chicos"]:
        msg.append(f"tap<44 {d['chicos']}")
    print(f"    {paso:<10} " + ("  ".join(msg) if msg else "ok"))
    if d["over"] > 0 or d["chicos"]:
        pg.screenshot(path=f"{OUT}/w{w}_{paso}.png")
    return bool(d["over"]) or bool(d["chicos"])


with sync_playwright() as p:
    br = p.chromium.launch()
    problemas = 0
    for w, etiqueta in ANCHOS:
        print(f"\n=== {w}px · {etiqueta} ===")
        ctx = br.new_context(viewport={"width": w, "height": 720}, device_scale_factor=2,
                             is_mobile=True, has_touch=True,
                             timezone_id="America/Bogota", locale="es-CO")
        pg = ctx.new_page()
        pg.goto(f"{BASE}/reservar", wait_until="networkidle"); pg.wait_for_timeout(1300)
        problemas += chequear(pg, w, "1sede")
        pg.get_by_text("Parque Venezuela", exact=False).first.click(); pg.wait_for_timeout(400); cont(pg)
        problemas += chequear(pg, w, "2servicio")
        pg.get_by_text("Corte (clásico", exact=False).first.click(); pg.wait_for_timeout(400); cont(pg)
        for t in ["no, gracias", "sin bebida", "seguir"]:
            b = pg.get_by_role("button", name=re.compile(t, re.I))
            if b.count() and b.first.is_visible():
                b.first.click(); pg.wait_for_timeout(900); break
        problemas += chequear(pg, w, "3barbero")
        pg.get_by_role("button").filter(has_text="MEYER").first.click(); pg.wait_for_timeout(400); cont(pg)
        pg.wait_for_timeout(1200)
        problemas += chequear(pg, w, "4horario")
        slots = pg.get_by_role("button", name=re.compile(r"^\d{1,2}:\d{2} (am|pm)$"))
        for i in range(slots.count() - 1, -1, -1):
            if slots.nth(i).is_enabled():
                slots.nth(i).scroll_into_view_if_needed(); pg.wait_for_timeout(150); slots.nth(i).click(); break
        pg.wait_for_timeout(400); cont(pg); pg.wait_for_timeout(700)
        problemas += chequear(pg, w, "5datos")
        ctx.close()
    print(f"\nTOTAL con problema: {problemas}")
    br.close()

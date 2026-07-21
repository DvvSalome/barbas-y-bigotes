"""Mide el area TACTIL real (no el tamano del elemento): desde cuantos px arriba
y abajo del centro sigue respondiendo el enlace. El ::before no cambia el rect."""
from playwright.sync_api import sync_playwright
BASE="http://localhost:3000"

MEDIR = """(sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cx = Math.round(r.left + r.width/2), cy = Math.round(r.top + r.height/2);
  const pega = (y) => { const e = document.elementFromPoint(cx, y); return !!(e && (e===el || el.contains(e) || e.closest && e.closest(sel)===el)); };
  let arriba=0, abajo=0;
  for (let d=1; d<40; d++) { if (pega(cy-d)) arriba=d; else break; }
  for (let d=1; d<40; d++) { if (pega(cy+d)) abajo=d; else break; }
  return { alto_visible: Math.round(r.height), alto_tactil: arriba+abajo+1, texto: (el.innerText||'').trim().slice(0,26) };
}"""

CASOS = [
  ("/",           'header a[href="/cuenta"]',      "Entrar (header)"),
  ("/nosotros",   'a[href^="tel:"]',               "Telefono (tap para llamar)"),
  ("/nosotros",   'footer a[href="/privacidad"]',  "Privacidad"),
  ("/terminos",   'main a[href="/"]',              "Volver al inicio"),
]

with sync_playwright() as p:
    br=p.chromium.launch()
    ctx=br.new_context(viewport={"width":360,"height":720},device_scale_factor=2,is_mobile=True,
                       has_touch=True,timezone_id="America/Bogota",locale="es-CO")
    pg=ctx.new_page()
    ult=None
    for ruta, sel, nombre in CASOS:
        if ruta!=ult:
            pg.goto(BASE+ruta, wait_until="load", timeout=45000); pg.wait_for_timeout(2500); ult=ruta
        el = pg.query_selector(sel)
        if el: el.scroll_into_view_if_needed(); pg.wait_for_timeout(400)
        d = pg.evaluate(MEDIR, sel)
        if not d: print(f"  {nombre:<28} no encontrado ({sel})"); continue
        ok = "OK" if d["alto_tactil"]>=44 else "SIGUE CHICO"
        print(f"  {nombre:<28} visible {d['alto_visible']:>2}px -> tactil {d['alto_tactil']:>2}px  {ok}")
    br.close()

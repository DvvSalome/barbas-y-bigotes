"""E2E contra PRODUCCION, de solo lectura.

NO completa reservas: el paso final del wizard tiene cuenta atras que reserva
sola, asi que se bloquean las peticiones de server action antes de llegar.
NO cobra, NO cierra caja, NO manda avisos. Abre formularios y los cancela.
"""
import json, os, re, sys
from playwright.sync_api import sync_playwright

BASE = "https://barbasybigotes.com"
SAL = os.environ["SAL"]
os.makedirs(SAL, exist_ok=True)

def ck(rol):
    return json.load(open(f"qa-out/cookies-{rol}.json", encoding="utf8"))

SONDA = """() => {
  const vis = el => { const s=getComputedStyle(el);
    if(s.display==='none'||s.visibility==='hidden') return false;
    const r=el.getBoundingClientRect(); return r.width>0&&r.height>0; };
  const imgs=[...document.images].filter(vis);
  const inter=[...document.querySelectorAll('a[href],button,input,select,textarea')].filter(vis);
  let tapados=0;
  for(const el of inter){ const r=el.getBoundingClientRect();
    if(r.bottom<0||r.top>window.innerHeight) continue;
    const cx=Math.round(r.left+r.width/2), cy=Math.round(r.top+r.height/2);
    if(cx<0||cy<0||cx>window.innerWidth||cy>window.innerHeight) continue;
    const a=document.elementFromPoint(cx,cy);
    if(!a||a===el||el.contains(a)||a.contains(el)) continue;
    let p=a, fijo=false;
    while(p&&p.nodeType===1){ const s=getComputedStyle(p);
      if(s.position==='fixed'||s.position==='sticky'){ const pr=p.getBoundingClientRect();
        if(pr.top>window.innerHeight/2){fijo=true;break;} } p=p.parentElement; }
    if(fijo) tapados++; }
  const txt=document.body.innerText||'';
  return {
    rotas: imgs.filter(i=>i.complete && i.naturalWidth===0).length,
    desborde: document.documentElement.scrollWidth > window.innerWidth+1,
    tapados,
    basura: (txt.match(/undefined|NaN|\\[object |Invalid Date/g)||[]).length,
    h1: document.querySelectorAll('h1').length,
    alto: Math.round(document.documentElement.scrollHeight),
  };
}"""

fallos = []
def chequear(nombre, d, http, consola, red, http_esperado=200):
    problemas = []
    if http and http != http_esperado: problemas.append(f"http {http}")
    if d["rotas"]: problemas.append(f"{d['rotas']} img rotas")
    if d["desborde"]: problemas.append("desborde horizontal")
    if d["tapados"]: problemas.append(f"{d['tapados']} tapados")
    if d["basura"]: problemas.append(f"{d['basura']} textos rotos")
    if consola: problemas.append(f"{len(consola)} err consola")
    if red: problemas.append(f"red: {', '.join(red[:2])}")
    estado = "FALLA" if problemas else "ok"
    if problemas: fallos.append((nombre, problemas))
    print(f"  {nombre:<38} {estado:<6} {'; '.join(problemas)}")

def abrir(ctx, ruta, nombre, esperar=2500, bloquear_acciones=False, http_esperado=200):
    pg = ctx.new_page()
    consola, red = [], []
    pg.on("console", lambda m: consola.append(m.text[:70]) if m.type == "error" else None)
    pg.on("response", lambda r: red.append(f"{r.status} {r.url.split('?')[0][-38:]}")
          if r.status >= 400 and "/_next/image" not in r.url and r.status != http_esperado else None)
    if bloquear_acciones:
        # Nada de reservas reales: se aborta cualquier server action.
        pg.route("**/*", lambda route: route.abort()
                 if route.request.method == "POST" and "next-action" in str(route.request.headers).lower()
                 else route.continue_())
    try:
        res = pg.goto(BASE + ruta, wait_until="load", timeout=45000)
        pg.wait_for_timeout(esperar)
        # Al FINAL del scroll: ahi el contenido ya no puede correrse, asi que
        # lo que sigue tapado queda tapado. Medirlo al abrir marcaba como
        # defecto todo lo que simplemente pasa por debajo de la barra.
        pg.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
        pg.wait_for_timeout(400)
        d = pg.evaluate(SONDA)
        pg.evaluate("window.scrollTo(0,0)")
        pg.wait_for_timeout(200)
        chequear(nombre, d, res.status if res else None, consola, red, http_esperado)
        pg.screenshot(path=f"{SAL}/{re.sub(r'[^a-z0-9]+','-',nombre.lower())}.png")
    except Exception as e:
        print(f"  {nombre:<38} ERROR  {str(e)[:60]}")
        fallos.append((nombre, [str(e)[:60]]))
    finally:
        pg.close()

with sync_playwright() as p:
    br = p.chromium.launch()

    print("PUBLICO (celular 390)")
    pub = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                         is_mobile=True, has_touch=True, locale="es-CO", timezone_id="America/Bogota")
    for ruta, nombre, esperado in [("/", "publico/portada", 200), ("/barberos", "publico/barberos", 200),
                         ("/nosotros", "publico/nosotros", 200), ("/privacidad", "publico/privacidad", 200),
                         ("/terminos", "publico/terminos", 200), ("/cuenta", "publico/cuenta sin sesion", 200),
                         ("/entrar", "publico/entrar", 200), ("/no-existe-xyz", "publico/404 (debe dar 404)", 404)]:
        abrir(pub, ruta, nombre, http_esperado=esperado)
    abrir(pub, "/reservar", "publico/wizard (sin confirmar)", 3500, bloquear_acciones=True)
    pub.close()

    print("\nPANEL DEL DUENO (celular 390)")
    adm = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                         is_mobile=True, has_touch=True, locale="es-CO", timezone_id="America/Bogota")
    adm.add_cookies(ck("admin"))
    for ruta, nombre in [("/admin", "admin/inicio"), ("/admin/agenda", "admin/agenda"),
                         ("/admin/cuadre", "admin/caja"), ("/admin/clientes", "admin/clientes"),
                         ("/admin/ajustes", "admin/ajustes (hub)"), ("/admin/equipo", "admin/equipo"),
                         ("/admin/precios", "admin/precios"), ("/admin/metricas", "admin/metricas"),
                         ("/admin/liquidacion", "admin/liquidacion"), ("/admin/horarios", "admin/horarios")]:
        abrir(adm, ruta, nombre)
    adm.close()

    print("\nMOSTRADOR (tablet 768)")
    sede = br.new_context(viewport={"width": 768, "height": 1024}, device_scale_factor=2,
                          locale="es-CO", timezone_id="America/Bogota")
    sede.add_cookies(ck("sede"))
    for tab in ["turnos", "calendario", "espera", "cierre"]:
        abrir(sede, f"/barbero?tab={tab}", f"mostrador/{tab}")
    sede.close()

    print("\nBARBERO (celular 390)")
    bar = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                         is_mobile=True, has_touch=True, locale="es-CO", timezone_id="America/Bogota")
    bar.add_cookies(ck("barbero"))
    abrir(bar, "/barbero", "barbero/mi dia")
    bar.close()
    br.close()

print(f"\n{'SIN FALLOS' if not fallos else str(len(fallos)) + ' PANTALLAS CON ALGO'}")
for n, ps in fallos:
    print(f"  {n}: {'; '.join(ps)}")
sys.exit(0)

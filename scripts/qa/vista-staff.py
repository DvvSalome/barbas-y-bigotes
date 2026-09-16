"""Mide el panel (/admin) y el mostrador (/barbero) pantalla por pantalla y deja
un metricas.json comparable antes/despues de cada tanda de diseno.

POR QUE EXISTE: la tanda 1 se cerro con numeros (AA 52 -> 0, texto <12 px 20 % -> 0 %,
controles <40 px 110 -> 33) pero el script que los produjo NO quedo versionado, y
docs/auditoria-visual/despues/metricas.json cubre solo admin: la corrida movil de
/admin murio con ERR_NETWORK_CHANGED y el mostrador no aparece ni una vez. O sea
que tres de las pantallas que la tanda 2 rehace enteras no tenian linea base.

DIFERENCIAS A PROPOSITO con aquella corrida:
  - Va contra un build LOCAL (npm run build && npm start), no contra produccion.
    Produccion fue justamente lo que rompio la corrida anterior.
  - Suma el mostrador (Turnos, Agenda, Espera, Cierre) y el dia del barbero.
  - Suma dos medidas que la tanda 2 necesita: `solapados` (controles que algo tapa,
    medido con elementFromPoint como areas-tactiles.py, no con el rect) y
    `yPrimerDato` (a que altura aparece el primer dato util de la pantalla).

OJO: `cromo` se calcula aca como la distancia del borde superior al primer hijo de
<main> con scrollY=0. La formula de la corrida vieja no se conserva, asi que los
numeros pueden no coincidir al px con docs/auditoria-visual/despues/metricas.json.
Comparar SIEMPRE antes-tanda2 contra despues-tanda2, no contra el archivo viejo.

USO:
    npm run build && npm start                 # deja el sitio en localhost:3000
    ROL=admin   node scripts/qa/sesion-staff.mjs
    ROL=sede    node scripts/qa/sesion-staff.mjs
    ROL=barbero node scripts/qa/sesion-staff.mjs
    python scripts/qa/vista-staff.py           # -> docs/auditoria-visual/antes-tanda2/

    SALIDA=docs/auditoria-visual/despues-tanda2 python scripts/qa/vista-staff.py
    CAPTURAS=0 python scripts/qa/vista-staff.py    # sin PNG (mas rapido)
    SOLO=horarios python scripts/qa/vista-staff.py # una sola pantalla, para depurar

Las sesiones vencen en 1 hora: si la corrida completa tarda, volver a emitirlas.
No escribe NADA en la base: solo abre pantallas y mide.
"""
import json
import os
import re
import sys
import unicodedata
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "http://localhost:3000")
SALIDA = Path(os.environ.get("SALIDA", "docs/auditoria-visual/antes-tanda2"))
CAPTURAS = os.environ.get("CAPTURAS", "1") != "0"
SOLO = os.environ.get("SOLO", "")

VIEWPORTS = [("movil", 375, 812, True), ("escritorio", 1280, 800, False)]

# area, pantalla, ruta, rol, selector del "primer dato util" (o None)
PANTALLAS = [
    ("admin", "Hoy", "/admin", "admin", None),
    ("admin", "Agenda dia", "/admin/agenda", "admin", None),
    ("admin", "Agenda semana", "/admin/agenda?vista=semana", "admin", None),
    ("admin", "Caja (cuadre)", "/admin/cuadre", "admin", None),
    ("admin", "Clientes", "/admin/clientes", "admin", "input[placeholder*=Buscar i]"),
    ("admin", "Servicios y precios", "/admin/precios", "admin", None),
    ("admin", "Productos y stock", "/admin/inventario", "admin", None),
    ("admin", "Equipo", "/admin/equipo", "admin", None),
    ("admin", "Liquidacion", "/admin/liquidacion", "admin", None),
    ("admin", "Metricas", "/admin/metricas", "admin", None),
    ("admin", "Avisos", "/admin/avisos", "admin", None),
    ("admin", "Horarios", "/admin/horarios", "admin", None),
    ("admin", "Cupones", "/admin/cupones", "admin", None),
    ("admin", "Comisiones", "/admin/comisiones", "admin", None),
    ("admin", "Tarjeta de fidelidad", "/admin/tarjeta", "admin", None),
    ("admin", "Ayuda", "/admin/ayuda", "admin", None),
    ("mostrador", "Turnos", "/barbero?tab=turnos", "sede", None),
    ("mostrador", "Agenda", "/barbero?tab=calendario", "sede", None),
    ("mostrador", "Espera", "/barbero?tab=espera", "sede", None),
    ("mostrador", "Cierre", "/barbero?tab=cierre", "sede", None),
    ("barbero", "Mi dia", "/barbero", "barbero", None),
]

MEDIR = r"""
(datoSel) => {
  // ---------- color ----------
  const srgb = (x) => x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  function oklabARgb(L, a, b) {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    const lin = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ];
    return lin.map((v) => Math.max(0, Math.min(255, Math.round(srgb(v) * 255))));
  }
  function parseColor(c) {
    if (!c || c === "transparent" || c === "none") return null;
    let m = c.match(/^rgba?\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
      if (p.length >= 3 && p.slice(0, 3).every((n) => !isNaN(n)))
        return [p[0], p[1], p[2], p.length > 3 && !isNaN(p[3]) ? p[3] : 1];
      return null;
    }
    m = c.match(/^oklab\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(/[\s\/]+/).filter(Boolean);
      const L = parseFloat(p[0]) * (p[0].indexOf("%") >= 0 ? 0.01 : 1);
      const rgb = oklabARgb(L, parseFloat(p[1]), parseFloat(p[2]));
      let al = 1;
      if (p[3] !== undefined) { al = parseFloat(p[3]) * (p[3].indexOf("%") >= 0 ? 0.01 : 1); }
      return [rgb[0], rgb[1], rgb[2], isNaN(al) ? 1 : al];
    }
    m = c.match(/^oklch\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(/[\s\/]+/).filter(Boolean);
      const L = parseFloat(p[0]) * (p[0].indexOf("%") >= 0 ? 0.01 : 1);
      const C = parseFloat(p[1]), H = parseFloat(p[2]) * Math.PI / 180;
      const rgb = oklabARgb(L, C * Math.cos(H), C * Math.sin(H));
      let al = 1;
      if (p[3] !== undefined) { al = parseFloat(p[3]) * (p[3].indexOf("%") >= 0 ? 0.01 : 1); }
      return [rgb[0], rgb[1], rgb[2], isNaN(al) ? 1 : al];
    }
    return null;
  }
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const ratio = (a, b) => {
    const L1 = lum(a), L2 = lum(b);
    const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
    return (hi + 0.05) / (lo + 0.05);
  };
  const sobre = (fg, bg) => fg[3] >= 1 ? [fg[0], fg[1], fg[2]]
    : [0, 1, 2].map((i) => Math.round(fg[i] * fg[3] + bg[i] * (1 - fg[3])));
  function fondoDe(el) {
    const capas = [];
    let n = el;
    while (n && n.nodeType === 1) {
      const c = parseColor(getComputedStyle(n).backgroundColor);
      if (c && c[3] > 0) { capas.push(c); if (c[3] >= 1) break; }
      n = n.parentElement;
    }
    if (!capas.length) return [12, 11, 10];
    let base = capas[capas.length - 1].slice(0, 3);
    for (let i = capas.length - 2; i >= 0; i--) base = sobre(capas[i], base);
    return base;
  }

  // ---------- recorrido ----------
  const main = document.querySelector("main") || document.body;
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || parseFloat(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const txt = (el) => (el.textContent || "").trim();
  const cuenta = (arr) => Object.entries(arr.reduce((a, v) => { a[v] = (a[v] || 0) + 1; return a; }, {}))
    .sort((a, b) => b[1] - a[1]);

  const nodosTexto = Array.from(document.body.querySelectorAll("*")).filter((el) => {
    if (["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "PATH"].indexOf(el.tagName) >= 0) return false;
    if (!visible(el)) return false;
    return Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
  });

  // WCAG 1.4.3 exime el texto de un control INACTIVO. Sin esto, el "Siguiente"
  // apagado de Liquidacion (pointer-events-none + text-muted/40, 1,97:1) contaba
  // como fallo de contraste y el numero mentia.
  const inactivo = (el) => {
    let n = el;
    while (n && n.nodeType === 1) {
      if (n.hasAttribute("disabled") || n.getAttribute("aria-disabled") === "true") return true;
      if ((n.tagName === "A" || n.tagName === "BUTTON")
        && getComputedStyle(n).pointerEvents === "none") return true;
      n = n.parentElement;
    }
    return false;
  };

  const sizes = [], weights = [], fams = [], tcolors = [], eyebrows = [];
  let textoChico = 0, contrasteMedidos = 0, contrasteSinMedir = 0, contrasteInactivos = 0;
  const contrasteMal = [];
  for (const el of nodosTexto) {
    const s = getComputedStyle(el);
    const fs = Math.round(parseFloat(s.fontSize) * 10) / 10;
    sizes.push(String(fs));
    weights.push(s.fontWeight);
    fams.push((s.fontFamily.split(",")[0] || "").replace(/["']/g, ""));
    tcolors.push(s.color);
    if (fs < 12) textoChico++;
    if (parseFloat(s.letterSpacing) > 1 && s.textTransform === "uppercase") eyebrows.push(String(fs));
    const fg = parseColor(s.color);
    if (!fg) { contrasteSinMedir++; continue; }
    if (inactivo(el)) { contrasteInactivos++; continue; }
    const bg = fondoDe(el);
    const r = ratio(sobre(fg, bg), bg);
    contrasteMedidos++;
    const grande = fs >= 24 || (fs >= 18.66 && parseInt(s.fontWeight, 10) >= 700);
    if (r < (grande ? 3 : 4.5)) contrasteMal.push({ t: txt(el).slice(0, 26), fs: fs, ratio: Math.round(r * 100) / 100 });
  }

  const inter = Array.from(document.querySelectorAll(
    "a[href],button,input,select,textarea,[role=button],[tabindex]:not([tabindex='-1'])")).filter(visible);
  const chicos = [];
  for (const el of inter) {
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 40)
      chicos.push({ t: (el.getAttribute("aria-label") || txt(el)).slice(0, 26), w: Math.round(r.width), h: Math.round(r.height) });
  }

  const botones = inter.filter((el) => {
    if (el.tagName === "BUTTON" || el.getAttribute("role") === "button") return true;
    if (el.tagName !== "A") return false;
    const s = getComputedStyle(el);
    return ["inline-flex", "flex", "inline-block", "block"].indexOf(s.display) >= 0
      && s.backgroundColor !== "rgba(0, 0, 0, 0)";
  });
  const firmas = botones.map((el) => {
    const s = getComputedStyle(el);
    return [s.backgroundColor, s.borderColor + " " + s.borderWidth, s.borderRadius, s.padding, s.fontSize].join(" | ");
  });

  const todos = Array.from(document.body.querySelectorAll("*")).filter(visible);
  const bgs = todos.map((el) => getComputedStyle(el).backgroundColor).filter((c) => c && c !== "rgba(0, 0, 0, 0)");
  const borders = todos.map((el) => {
    const s = getComputedStyle(el);
    return parseFloat(s.borderTopWidth) > 0 ? s.borderTopColor + " " + s.borderTopWidth : null;
  }).filter(Boolean);
  const radii = todos.map((el) => getComputedStyle(el).borderRadius).filter((v) => v && v !== "0px");
  const pads = botones.map((el) => getComputedStyle(el).padding);

  const reEmoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/u;
  const emojiUI = nodosTexto.filter((el) => reEmoji.test(txt(el))).length;

  const imgs = Array.from(document.images).filter(visible);
  const imgDeformadas = imgs.filter((i) => {
    if (!i.naturalWidth || !i.naturalHeight) return false;
    const s = getComputedStyle(i);
    if (s.objectFit === "cover" || s.objectFit === "contain") return false;
    const rn = i.naturalWidth / i.naturalHeight, rr = i.clientWidth / i.clientHeight;
    return rr > 0 && Math.abs(rn - rr) / rn > 0.08;
  }).length;
  const imgSinAlt = imgs.filter((i) => !i.hasAttribute("alt")).length;

  const hijo = Array.from(main.children).filter(visible)[0];
  const cromo = hijo ? Math.round(hijo.getBoundingClientRect().top + window.scrollY) : null;

  let yPrimerDato = null;
  if (datoSel) {
    const d = document.querySelector(datoSel);
    if (d && visible(d)) yPrimerDato = Math.round(d.getBoundingClientRect().top + window.scrollY);
  }

  return {
    sw: window.innerWidth,
    vw: document.documentElement.clientWidth,
    alto: Math.round(document.documentElement.scrollHeight),
    cromo: cromo,
    yPrimerDato: yPrimerDato,
    desbordeH: document.documentElement.scrollWidth > window.innerWidth + 1,
    interactivos: inter.length,
    nChicos: chicos.length,
    chicos: chicos.slice(0, 40),
    textoTotal: nodosTexto.length,
    textoChico: textoChico,
    nSizes: new Set(sizes).size,
    sizes: cuenta(sizes).slice(0, 14),
    nWeights: new Set(weights).size,
    weights: cuenta(weights),
    fams: cuenta(fams),
    nTextColors: new Set(tcolors).size,
    tcolors: cuenta(tcolors).slice(0, 10),
    nEyebrowSizes: new Set(eyebrows).size,
    eyebrows: cuenta(eyebrows),
    emojiUI: emojiUI,
    nBgs: new Set(bgs).size,
    bgs: cuenta(bgs).slice(0, 10),
    nBorders: new Set(borders).size,
    nRadii: new Set(radii).size,
    radii: cuenta(radii).slice(0, 10),
    nPads: new Set(pads).size,
    nBotones: botones.length,
    nFirmasBoton: new Set(firmas).size,
    firmas: cuenta(firmas).slice(0, 10),
    contrasteMedidos: contrasteMedidos,
    contrasteSinMedir: contrasteSinMedir,
    contrasteInactivos: contrasteInactivos,
    nContrasteMal: contrasteMal.length,
    contrasteMal: contrasteMal.slice(0, 20),
    imgDeformadas: imgDeformadas,
    imgSinAlt: imgSinAlt,
    h1: document.querySelectorAll("h1").length,
  };
}
"""

# Controles tapados PARA SIEMPRE: se mide con elementFromPoint y no con el rect,
# porque una barra fija o un boton flotante no cambian el rect de lo que cubren.
#
# Solo cuenta lo que tapa algo anclado ABAJO (la barra inferior de la tanda 2, el
# FAB) y solo al final del scroll, que es donde el contenido ya no puede correrse.
# La primera version contaba tambien lo que pasa por debajo de la cabecera
# pegajosa al scrollear, y eso no es un defecto: se destapa scrolleando. Medido,
# 25 de los "tapados" eran el buscador Ctrl-K del topbar. Un numero con ese ruido
# adentro no sirve para comparar antes y despues.
SOLAPADOS = r"""
() => {
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // ¿El que tapa cuelga de algo fijo/pegajoso anclado en la mitad de ABAJO?
  const anclaAbajo = (el) => {
    let n = el;
    while (n && n.nodeType === 1) {
      const s = getComputedStyle(n);
      if (s.position === "fixed" || s.position === "sticky") {
        const r = n.getBoundingClientRect();
        if (r.top > window.innerHeight / 2) return n;
      }
      n = n.parentElement;
    }
    return null;
  };
  const inter = Array.from(document.querySelectorAll(
    "a[href],button,input,select,textarea,[role=button]")).filter(visible);
  const tapados = [];
  for (const el of inter) {
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) continue;
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
    if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) continue;
    const arriba = document.elementFromPoint(cx, cy);
    if (!arriba) continue;
    if (arriba === el || el.contains(arriba) || arriba.contains(el)) continue;
    const ancla = anclaAbajo(arriba);
    if (!ancla) continue;
    tapados.push({
      t: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 26),
      lo_tapa: (ancla.getAttribute("aria-label") || ancla.textContent || ancla.tagName).trim().slice(0, 26),
    });
  }
  return tapados;
}
"""


def cookies_de(rol):
    f = Path("qa-out") / ("cookies-" + rol + ".json")
    if not f.exists():
        sys.exit("Falta " + str(f) + ". Corre:  ROL=" + rol + " node scripts/qa/sesion-staff.mjs")
    crudas = json.loads(f.read_text(encoding="utf8"))
    # sesion-staff.mjs las emite para produccion; aca se reapuntan al build local.
    for c in crudas:
        c["domain"] = "localhost"
        c["path"] = c.get("path", "/")
        c["secure"] = False
        c.pop("sameSite", None)
    return crudas


def limpio(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main():
    pantallas = [p for p in PANTALLAS if not SOLO or SOLO.lower() in (p[1] + p[2]).lower()]
    if not pantallas:
        sys.exit("SOLO=" + SOLO + " no coincide con ninguna pantalla")
    SALIDA.mkdir(parents=True, exist_ok=True)
    filas = []
    with sync_playwright() as p:
        br = p.chromium.launch()
        for vp, w, h, movil in VIEWPORTS:
            ctxs = {}
            for area, pantalla, ruta, rol, datoSel in pantallas:
                if rol not in ctxs:
                    ctxs[rol] = br.new_context(
                        viewport={"width": w, "height": h}, device_scale_factor=2,
                        is_mobile=movil, has_touch=movil,
                        timezone_id="America/Bogota", locale="es-CO")
                    ctxs[rol].add_cookies(cookies_de(rol))
                pg = ctxs[rol].new_page()
                fila = {"area": area, "pantalla": pantalla, "ruta": ruta, "rol": rol, "vp": vp}
                try:
                    res = pg.goto(BASE + ruta, wait_until="networkidle", timeout=45000)
                    fila["http"] = res.status if res else None
                    fila["url"] = pg.url
                    if res and res.status >= 400:
                        raise RuntimeError("HTTP " + str(res.status))
                    if "/login" in pg.url or "/cuenta" in pg.url:
                        raise RuntimeError("sesion rechazada, termino en " + pg.url)
                    pg.wait_for_timeout(1800)
                    pg.evaluate("window.scrollTo(0,0)")
                    fila.update(pg.evaluate(MEDIR, datoSel))
                    # Al FINAL del scroll: ahi el contenido ya no puede correrse mas,
                    # asi que lo que sigue tapado, queda tapado.
                    tapados = []
                    for frac in (1,):
                        pg.evaluate("window.scrollTo(0, document.documentElement.scrollHeight*" + str(frac) + ")")
                        pg.wait_for_timeout(350)
                        tapados += pg.evaluate(SOLAPADOS)
                    unicos = {}
                    for t in tapados:
                        unicos[t["t"] + "|" + t["lo_tapa"]] = t
                    fila["solapados"] = len(unicos)
                    fila["solapadosDetalle"] = list(unicos.values())[:10]
                    pg.evaluate("window.scrollTo(0,0)")
                    if CAPTURAS:
                        cap = SALIDA / ("vis-" + area + "-" + limpio(pantalla) + "-" + vp + ".png")
                        pg.screenshot(path=str(cap))
                        fila["captura"] = cap.name
                    marca = "{:>5}px  cromo {:>4}  <40px {:>3}  AA {:>2}  tapados {:>2}".format(
                        fila["alto"], str(fila["cromo"]), fila["nChicos"], fila["nContrasteMal"], fila["solapados"])
                except Exception as e:
                    fila["error"] = str(e)[:200]
                    marca = "ERROR  " + str(e)[:60].replace("\n", " ")
                finally:
                    pg.close()
                print("  {:<11} {}/{:<22} {}".format(vp, area, pantalla, marca))
                filas.append(fila)
            for c in ctxs.values():
                c.close()
        br.close()

    (SALIDA / "metricas.json").write_text(json.dumps(filas, ensure_ascii=False, indent=1), encoding="utf8")

    ok = [f for f in filas if not f.get("error")]
    print("\n{}/{} pantallas medidas -> {}".format(len(ok), len(filas), SALIDA / "metricas.json"))
    for vp, _, _, _ in VIEWPORTS:
        g = [f for f in ok if f["vp"] == vp]
        if not g:
            continue
        print("  {:<11} <40px {:>4} | AA mal {:>3} | texto<12 {:>3} | emoji {:>3} | tapados {:>3} | desborde {:>2}".format(
            vp,
            sum(f["nChicos"] for f in g), sum(f["nContrasteMal"] for f in g),
            sum(f["textoChico"] for f in g), sum(f["emojiUI"] for f in g),
            sum(f["solapados"] for f in g), sum(1 for f in g if f["desbordeH"])))
    malas = [f for f in filas if f.get("error")]
    if malas:
        print("\n  SIN MEDIR:")
        for f in malas:
            print("    {:<11} {}/{}: {}".format(f["vp"], f["area"], f["pantalla"], f["error"][:90]))
    return 0 if not malas else 1


if __name__ == "__main__":
    sys.exit(main())

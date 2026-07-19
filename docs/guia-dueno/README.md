# Guía de visibilidad en Google (para el dueño)

Entregable FourG `FGS-2026-047`. Explica las 4 tareas que solo el dueño puede
hacer (viven en sus cuentas de Google e Instagram) para que la barbería aparezca
en buscadores. El SEO técnico del sitio ya está hecho; esto es lo que falta.

- `guia-visibilidad-google.html` — fuente editable (formato cream/warm de FourG).
- `guia-visibilidad-google.pdf` — el que se le manda al dueño (5 páginas A4).
- `img/` — capturas reales de las pantallas de entrada de cada herramienta.

## Regenerar el PDF tras editar el HTML

```powershell
powershell -File "<kit>/plugins/fourg-skills/skills/fourg-document-template/scripts/html-to-pdf.ps1" `
  -InputHtml "docs/guia-dueno/guia-visibilidad-google.html" `
  -OutputPdf "docs/guia-dueno/guia-visibilidad-google.pdf"
```

## Antes de exportar, verificar dos cosas

1. **Cero guiones largos** (regla FourG): `sum(t.count(c) for c in '—–−')` debe dar 0.
2. **Que ninguna página se desborde**: cada `.page` es A4 fija, y si el contenido
   pasa de 297mm el navegador lo parte y aparece una hoja casi vacía. Medirlo con
   Playwright en vez de adivinar:

```python
pg.evaluate("""() => {const mm=96/25.4;
  return [...document.querySelectorAll('.page')].map((el,i)=>
    ({n:i+1, sobra: Math.round((el.scrollHeight-297*mm)/mm)}))}""")
```

Si alguna `sobra > 0`, mover una sección a la página siguiente (no achicar la
tipografía). Nota: el `.copybox` dentro de `.step` necesita `grid-column: 2`,
si no cae en la columna de 20px y la URL se parte una letra por línea.

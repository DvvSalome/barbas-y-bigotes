# Pendientes de responsive / fidelidad mobile (feedback del dueño, jul 2026)

Regla dura: la UI mobile va 1:1 con el prototipo de Claude Design. Ver
[[fidelidad-diseno-handoff]] en memoria.

## Reportado desde celular (barbasybigotes.com)
1. **/reservar NO es responsive** — el wizard de reserva se ve roto en mobile.
   Recrearlo 1:1 con `publico-reservar.md` (5 pasos, mobile-first). BLOQUE C.
2. **Solape botón de reserva ↔ widget/favicon** en la home mobile. El
   `ContactoWidget` ya soporta `sobreCtaMovil` (bottom-[88px], arriba del CTA
   sticky). Verificar que la home nueva lo monte con esa prop, y /cuenta sin ella.
3. La home vieja (hero glass de desktop) NO es responsive en mobile — se
   reemplaza por la home mobile-first del Bloque B (en curso).

## Al integrar cada pantalla
- Probar SIEMPRE el ancho de 390px (iPhone) además de desktop.
- El widget de contacto: solo home + /cuenta; nunca staff ni durante el wizard.

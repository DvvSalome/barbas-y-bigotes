import type { Metadata } from "next";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { GRUPOS_HUB, HOJAS } from "@/components/admin/nav-mapa";
import { Fila, Grupo } from "@/components/ui/ListaAgrupada";

export const metadata: Metadata = { title: "Ajustes" };

/*
  El hub de Ajustes (tanda 2, paso 3). Acá vive todo lo que dejó de tener
  pestaña propia: lo que se configura de vez en cuando, no lo que se mira todos
  los días. Las cinco cosas de todos los días están en la barra de abajo.

  Es una lista agrupada y no una parrilla de tarjetas porque se lee de arriba
  abajo en un celular y cada fila puede decir QUÉ hay adentro, que es justo lo
  que faltaba: "Comisiones" no dice nada, "cuánto se lleva cada uno" sí.

  NINGUNA ruta cambió: los marcadores viejos y los enlaces de los correos
  siguen entrando directo a su pantalla.
*/
export default function AjustesPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <SectionHeader
        eyebrow="Configuración"
        title="Ajustes"
        description={
          <>
            Todo lo que se configura de vez en cuando. Lo del día a día —hoy, la agenda, la caja y los
            clientes— está en la barra de abajo.
          </>
        }
      />
      <div className="mt-5 grid gap-5">
        {GRUPOS_HUB.map((g) => {
          const filas = HOJAS.filter((h) => h.grupo === g);
          if (!filas.length) return null;
          return (
            <Grupo key={g} eyebrow={g}>
              {filas.map((h) => {
                const Icono = h.icono;
                return (
                  <Fila
                    key={h.href}
                    href={h.href}
                    icono={<Icono />}
                    tinte={h.tinte}
                    titulo={h.label}
                    subtitulo={h.sub}
                  />
                );
              })}
            </Grupo>
          );
        })}
      </div>
    </div>
  );
}

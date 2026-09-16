"use client";

import { useSyncExternalStore } from "react";
import { leerTema, ponerTema, suscribirTema, temaServidor, type TemaStaff } from "@/lib/tema";
import { Segmentado } from "@/components/ui/Segmentado";

/*
  Claro u oscuro, a la vista.

  El interruptor ya existía, pero vivía dentro del menú del avatar: el dueño
  preguntó dónde estaba, que es la prueba de que no se encontraba. Es lo primero
  que alguien busca cuando la pantalla le molesta —de día en el local entra sol
  y el tema oscuro se lava—, así que va en Ajustes, arriba, donde se busca.

  El menú del avatar lo conserva: quien ya lo aprendió ahí no lo pierde, y los
  dos escriben la misma cookie y el mismo atributo, así que no pueden discrepar.
*/
export function TemaSelector() {
  // Del lugar común: si el tema se toca desde el botón de la cabecera o desde
  // el menú del avatar, este selector se entera y no queda marcando el viejo.
  const tema = useSyncExternalStore(suscribirTema, leerTema, temaServidor);
  const cambiar = (v: TemaStaff) => ponerTema(v);

  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-ink">Cómo se ve la pantalla</p>
          <p className="mt-0.5 text-[13px] text-muted">
            Se guarda en este aparato. La tablet del local y tu celular pueden estar distintos.
          </p>
        </div>
        <Segmentado
          etiqueta="Tema de la pantalla"
          valor={tema}
          onCambio={cambiar}
          opciones={[
            { valor: "dark", texto: "Oscuro" },
            { valor: "light", texto: "Claro" },
          ]}
          className="max-w-[220px]"
        />
      </div>
    </div>
  );
}

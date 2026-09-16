"use client";

import { useSyncExternalStore } from "react";
import { alternarTema, leerTema, suscribirTema, temaServidor } from "@/lib/tema";
import { MoonIcon, SunIcon } from "@/components/icons";

/*
  Claro u oscuro a UN toque, desde la cabecera.

  Estaba en el menú del avatar y lo bajamos a Ajustes, pero eso sigue siendo
  navegar. Es un ajuste de accesibilidad: de día entra sol al local y el tema
  oscuro se lava, de noche el claro encandila. Quien lo necesita lo necesita
  AHORA, no después de entrar a una pantalla de configuración.

  Alterna directo, sin menú ni confirmación: hay dos opciones y el resultado se
  ve al instante, así que preguntar sobraría. El ícono muestra A DÓNDE va —sol
  si va a pasar a claro— y el nombre accesible lo dice con palabras, porque un
  ícono solo es ambiguo justo para quien más necesita este botón.

  Los tres lugares (este, Ajustes y el avatar) leen del mismo sitio con
  useSyncExternalStore: tocar uno actualiza los otros dos en el acto.
*/
export function TemaBoton({ className = "" }: { className?: string }) {
  const tema = useSyncExternalStore(suscribirTema, leerTema, temaServidor);
  const vaAClaro = tema === "dark";

  return (
    <button
      type="button"
      onClick={() => alternarTema()}
      aria-label={vaAClaro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={vaAClaro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-panel text-ink transition hover:border-ink/25 ${className}`}
    >
      {vaAClaro ? <SunIcon className="h-[18px] w-[18px]" /> : <MoonIcon className="h-[18px] w-[18px]" />}
    </button>
  );
}

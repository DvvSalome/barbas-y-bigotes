"use client";

import { useState } from "react";
import { botonClases } from "@/components/ui/Boton";
import { enlaceAbsoluto, linkWhatsAppTexto, mensajeApp, tituloApp } from "@/lib/app-personal";

/*
  "Su app en el celular", en la ficha de cada barbero y en el PIN del mostrador
  (/admin/equipo). El enlace de SU app (/equipo/<slug>), para copiarlo o
  mandarlo por WhatsApp con los pasos ya escritos. Instalada, la app abre
  directo en su teclado de PIN, sin buscarse en la lista de todos.

  Si ya la instaló no se puede saber desde el servidor (el celular no le avisa a
  nadie), así que acá no se dice. Lo que sí se sabe —si alguna vez entró— está en
  el checklist de arriba.
*/
export function AppDelCelular({
  tipo,
  nombre,
  ruta,
  compacto = false,
}: {
  tipo: "barbero" | "sede";
  /** El barbero, o la sede del mostrador. */
  nombre: string;
  /** /equipo/<slug>; null = todavía no tiene enlace fijo (antes de 0089) o no se pudo leer. */
  ruta: string | null;
  /** Dentro de una tarjeta angosta (el mostrador): sin el párrafo de explicación. */
  compacto?: boolean;
}) {
  const [copia, setCopia] = useState<"ok" | "error" | null>(null);

  if (!ruta) {
    // Sin enlace FIJO no se ofrece ninguno: uno calculado del nombre podía
    // pasarle a otro la app ya instalada.
    return <p className="text-[12.5px] text-muted">Su enlace todavía no está listo. Aparece aquí apenas quede activo.</p>;
  }

  const enlace = enlaceAbsoluto(ruta);
  const whatsapp = linkWhatsAppTexto(mensajeApp({ tipo, nombre, enlace }));

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopia("ok");
    } catch {
      setCopia("error");
    }
    setTimeout(() => setCopia(null), 2500);
  }

  return (
    <div>
      {!compacto && (
        <p className="text-[12.5px] leading-relaxed text-muted">
          {tipo === "sede"
            ? "Para dejarla instalada en la tablet o el celular del local: abre directo en el PIN del mostrador."
            : `Su propia app, «${tituloApp({ tipo, nombre })}»: abre directo en su PIN, sin buscarse en la lista. Mándasela y que la agregue a la pantalla de inicio.`}
        </p>
      )}
      <p className={`${compacto ? "" : "mt-2.5 "}break-all rounded-xl border border-line bg-bg px-3 py-2 text-[12.5px] text-ink`}>
        {enlace.replace(/^https:\/\//, "")}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={botonClases("secundario", compacto ? "sm" : "md")}>
          Enviar por WhatsApp
        </a>
        <button type="button" onClick={copiar} className={botonClases("secundario", compacto ? "sm" : "md")}>
          {copia === "ok" ? "Copiado" : "Copiar enlace"}
        </button>
      </div>
      <p role="status" className={`mt-2 text-[12px] ${copia === "error" ? "font-semibold text-warn" : "text-muted"}`}>
        {copia === "error"
          ? "No se pudo copiar: mantén presionado el enlace y cópialo a mano."
          : tipo === "sede"
            ? "Entra con el PIN del local. El enlace no cambia."
            : "Entra con su PIN. El enlace no cambia aunque le cambies el nombre."}
      </p>
    </div>
  );
}

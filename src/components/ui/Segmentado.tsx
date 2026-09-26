"use client";

/*
  Segmentado del staff: 2 a 4 opciones EXCLUYENTES en un riel. Para cambiar de
  vista (Día | Semana) o de pestaña dentro de una hoja (Información |
  Colaboradores), no para filtrar —eso son chips— ni para elegir de una lista
  larga —eso es un select.

  Activo = invertir tinta y fondo, el mismo gesto que ya usan chipFiltro y el
  "hoy" del calendario. Cada opción mide 44 px de alto.
*/
export function Segmentado<T extends string>({
  opciones,
  valor,
  onCambio,
  etiqueta,
  className = "",
}: {
  opciones: readonly { valor: T; texto: string }[];
  valor: T;
  onCambio: (v: T) => void;
  /** Nombre del grupo para lectores de pantalla ("Vista del calendario"). */
  etiqueta: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={etiqueta}
      className={`inline-flex w-full gap-1 rounded-full border border-line bg-panel p-1 ${className}`}
    >
      {opciones.map((o) => {
        const act = o.valor === valor;
        return (
          // type="button": dentro de un <form>, un botón sin tipo ENVÍA el
          // formulario — tocar una sede mandaba el "Nuevo producto" a medio llenar.
          <button
            key={o.valor}
            type="button"
            role="tab"
            aria-selected={act}
            onClick={() => onCambio(o.valor)}
            className={`inline-flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-full px-3 text-[13px] font-semibold transition ${
              act ? "bg-elevated text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {o.texto}
          </button>
        );
      })}
    </div>
  );
}

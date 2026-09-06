"use client";

// El ÚNICO interruptor del panel. La auditoría del 6-sep encontró tres
// distintos (pill "Sí/No" de 32 px, switch verde de Avisos sin nombre, pill
// "Suma sello"). Este: 44 px de objetivo táctil, nombre accesible, y el estado
// se lee por color Y por posición (no solo por color).
export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  /** Qué prende: es el nombre que lee un lector de pantalla. */
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center disabled:opacity-50"
    >
      <span
        className={`relative inline-block h-[30px] w-[54px] rounded-full border transition ${
          checked ? "border-ok/50 bg-ok/25" : "border-line bg-elevated"
        }`}
      >
        <span
          className={`absolute top-[3px] h-[22px] w-[22px] rounded-full transition-all ${
            checked ? "left-[28px] bg-ok" : "left-[3px] bg-muted"
          }`}
        />
      </span>
    </button>
  );
}

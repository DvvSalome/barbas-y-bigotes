"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { subirFotoBarbero, quitarFotoBarbero } from "@/lib/equipo-actions";
import { achicarFoto } from "@/lib/imagen-cliente";
import { botonClases } from "@/components/ui/Boton";
import { CaraBarbero } from "@/components/staff/Elegir";
import { CamIcon } from "@/components/icons";

// La foto del barbero, desde su ficha. Es la cara que ve el cliente en la web y al
// elegir con quién reservar; antes eran archivos del repo y un barbero nuevo salía
// con la silueta hasta que un desarrollador subiera la suya y desplegara.
// Mismo camino que FotoSede: se achica en el navegador y la action la valida.
export function FotoBarbero({
  barberoId,
  nombre,
  fotoUrl,
  onMensaje,
}: {
  barberoId: string;
  nombre: string;
  fotoUrl: string | null;
  onMensaje: (m: { text: string; ok: boolean }) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [quitando, setQuitando] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.set("barberoId", barberoId);
      fd.set("foto", await achicarFoto(file));
      const res = await subirFotoBarbero(fd);
      onMensaje({ text: res.ok ? (res.aviso ?? "Foto guardada.") : (res.error ?? "No se pudo subir la foto."), ok: res.ok });
      if (res.ok) router.refresh();
    } catch {
      onMensaje({ text: "No se pudo subir la foto. Prueba con otra imagen.", ok: false });
    } finally {
      setSubiendo(false);
    }
  }

  async function quitar() {
    if (!confirmando) {
      setConfirmando(true);
      return;
    }
    setQuitando(true);
    const res = await quitarFotoBarbero(barberoId).catch(() => null);
    setQuitando(false);
    setConfirmando(false);
    onMensaje({ text: res?.ok ? (res.aviso ?? "Foto quitada.") : (res?.error ?? "No se pudo quitar la foto."), ok: !!res?.ok });
    if (res?.ok) router.refresh();
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={subiendo}
        aria-label={fotoUrl ? `Cambiar la foto de ${nombre}` : `Subir la foto de ${nombre}`}
        className={`relative shrink-0 rounded-full transition ${subiendo ? "opacity-50" : "hover:opacity-90"}`}
      >
        <CaraBarbero b={{ id: barberoId, nombre, fotoUrl }} size={76} aro />
        <span
          aria-hidden
          className="absolute -bottom-0.5 -right-0.5 grid h-7 w-7 place-items-center rounded-full border-2 border-bg bg-accent text-on-accent"
        >
          <CamIcon className="h-3.5 w-3.5" />
        </span>
      </button>
      <input ref={inputRef} type="file" accept="image/*" onChange={onChange} className="hidden" />
      <div className="min-w-0">
        <p className="text-[12.5px] leading-snug text-muted">
          {fotoUrl
            ? "La ve el cliente en la web y al elegir con quién reservar."
            : "Sin foto, en la web y al reservar sale con una foto genérica que no es él. Mejor una de frente, con la cara bien visible."}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={subiendo} className={botonClases("secundario", "sm")}>
            {subiendo ? "Subiendo…" : fotoUrl ? "Cambiar foto" : "Subir foto"}
          </button>
          {fotoUrl && !subiendo && (
            <button
              type="button"
              onClick={quitar}
              onBlur={() => setConfirmando(false)}
              disabled={quitando}
              className={botonClases(confirmando ? "peligro" : "terciario", "sm")}
            >
              {quitando ? "Quitando…" : confirmando ? "¿Seguro? Toca otra vez" : "Quitar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

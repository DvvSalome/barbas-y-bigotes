"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckoutForm, HojaInferior } from "@/components/barbero/AgendaList";

// "Cobrar directo sin crear servicio" también desde el cuadre del admin (5-sep):
// el MISMO formulario del mostrador (servicios sueltos y/o productos, medio,
// propina, cupón), con elección de sede y barbero porque el dueño no tiene una.
type Props = Omit<React.ComponentProps<typeof CheckoutForm>, "reserva" | "onDone" | "onCancel" | "elegirBarbero">;

export function CobroDirectoAdmin(props: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="min-h-11 rounded-full bg-accent px-5 text-[13px] font-bold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft"
      >
        Cobrar directo (sin cita)
      </button>
      {abierto && (
        <HojaInferior titulo="Cobrar directo (sin cita)" onCerrar={() => setAbierto(false)}>
          <CheckoutForm
            {...props}
            reserva={null}
            elegirBarbero
            onDone={() => {
              setAbierto(false);
              router.refresh();
            }}
            onCancel={() => setAbierto(false)}
          />
        </HojaInferior>
      )}
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import { actualizarAjusteVerSemana } from "@/lib/actions";
import { Switch } from "@/components/admin/Switch";

/*
  ¿El barbero ve, en su celular, lo que lleva acumulado de la SEMANA?

  Lo de HOY lo ve siempre y no se configura: es lo que acaba de hacer con sus
  manos. Lo de la semana es lo que va a cobrar el sábado, y ahí no hay una
  respuesta única: en unos locales tenerlo a la vista baja las preguntas a cero,
  y en otros abre discusiones a mitad de jornada. Arranca apagado.
*/
export function VerSemanaToggle({ inicial }: { inicial: boolean }) {
  const [activo, setActivo] = useState(inicial);
  const [guardando, empezar] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function cambiar(v: boolean) {
    setActivo(v); // optimista: el interruptor no se queda pensando
    setMsg(null);
    empezar(async () => {
      const res = await actualizarAjusteVerSemana(v);
      if (!res.ok) {
        setActivo(!v); // se revierte solo si falló, y se dice por qué
        setMsg(res.error ?? "No se pudo guardar.");
        return;
      }
      setMsg(v ? "Listo: ahora lo ven." : "Listo: ya no lo ven.");
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-ink">Que cada barbero vea lo suyo de la semana</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            En su celular, cada uno vería cuánto lleva facturado esta semana y cuánto le queda por cobrar, ya
            descontados adelantos y consumos. Es la misma cuenta con la que se liquida, así que no puede dar
            distinto. Cada uno ve <span className="font-semibold text-ink">solo lo suyo</span>, nunca lo de un
            compañero.
          </p>
          <p className="mt-2 text-[12.5px] text-muted">
            Lo de <span className="font-semibold text-ink">hoy</span> lo ven siempre, esté esto prendido o
            apagado: es lo que acaban de hacer.
          </p>
          {msg && <p className="mt-2 text-[12.5px] font-semibold text-ok">{msg}</p>}
        </div>
        <Switch
          checked={activo}
          onChange={cambiar}
          disabled={guardando}
          label="Que cada barbero vea lo suyo de la semana"
        />
      </div>
    </div>
  );
}

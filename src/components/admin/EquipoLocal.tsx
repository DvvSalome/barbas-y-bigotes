"use client";

import { useState } from "react";
import { Hoja } from "@/components/ui/Hoja";
import { Grupo, Fila } from "@/components/ui/ListaAgrupada";
import { SedePinAdmin } from "@/components/admin/SedePinAdmin";
import { VerSemanaToggle } from "@/components/admin/VerSemanaToggle";
import { CalendarGoogle } from "@/components/admin/CalendarGoogle";
import { AusenciasAdmin } from "@/components/admin/AusenciasAdmin";
import { PinIcon, ChartIcon, CalendarIcon, ClockIcon } from "@/components/icons";
import type { Barbero, Sede } from "@/lib/data/types";
import type { AusenciaAdmin, CalendarEstado } from "@/lib/data/queries";

/*
  Lo que NO es de ningún barbero en particular: el PIN del mostrador, qué ve el
  equipo de su plata, las agendas de Google y quién falta qué día.

  Cuatro filas y cuatro hojas. Antes eran cuatro secciones abiertas, una debajo
  de otra, y entre todas ponían casi tres mil píxeles de scroll para cosas que se
  tocan una vez al mes (el PIN del mostrador) o una vez en la vida (las agendas).
*/
type Abierta = null | "pin" | "semana" | "calendar" | "ausencias";

export function EquipoLocal({
  sedes,
  estadoSedes,
  barberoVeSemana,
  calendar,
  barberos,
  emails,
  ausencias,
}: {
  sedes: Sede[];
  estadoSedes: Record<string, { tienePin: boolean; bloqueado: boolean }>;
  barberoVeSemana: boolean;
  calendar: CalendarEstado;
  barberos: Barbero[];
  emails: Record<string, string>;
  ausencias: AusenciaAdmin[];
}) {
  const [abierta, setAbierta] = useState<Abierta>(null);
  const cerrar = () => setAbierta(null);

  const sinPin = sedes.filter((s) => !estadoSedes[s.id]?.tienePin).length;
  const conAgenda = barberos.filter((b) => calendar.agendas[b.id]).length;

  return (
    <>
      <Grupo eyebrow="El local" className="mt-6">
        <Fila
          onClick={() => setAbierta("pin")}
          icono={<PinIcon />}
          tinte="local"
          titulo="PIN del mostrador"
          subtitulo="Uno por sede, para el celular del local"
          badge={sinPin || undefined}
          valor={sinPin ? undefined : "listo"}
        />
        <Fila
          onClick={() => setAbierta("semana")}
          icono={<ChartIcon />}
          tinte="plata"
          titulo="Qué ve el equipo"
          subtitulo="Si cada barbero ve lo suyo de la semana"
          valor={barberoVeSemana ? "lo ven" : "no lo ven"}
        />
        <Fila
          onClick={() => setAbierta("calendar")}
          icono={<CalendarIcon />}
          tinte="marca"
          titulo="Google Calendar"
          subtitulo={
            calendar.configurado
              ? `${conAgenda} de ${barberos.length} con agenda${calendar.pendientes ? ` · ${calendar.pendientes} por sincronizar` : ""}`
              : "Falta la credencial de Google en el servidor"
          }
          badge={calendar.configurado ? undefined : 1}
        />
        <Fila
          onClick={() => setAbierta("ausencias")}
          icono={<ClockIcon />}
          tinte="equipo"
          titulo="Ausencias y bloqueos"
          subtitulo="Quién no viene, y los ratos tapados"
          valor={ausencias.length ? `${ausencias.length}` : undefined}
        />
      </Grupo>

      {abierta === "pin" && (
        <Hoja titulo="PIN del mostrador" onCerrar={cerrar} ancho="max-w-lg">
          <p className="mb-3 text-[13px] text-muted">
            Es el que usa el celular del local, uno por sede. El PIN personal de cada barbero se pone en su ficha.
          </p>
          <SedePinAdmin sedes={sedes} estado={estadoSedes} />
        </Hoja>
      )}

      {abierta === "semana" && (
        <Hoja titulo="Qué ve el equipo" onCerrar={cerrar} ancho="max-w-lg">
          <VerSemanaToggle inicial={barberoVeSemana} />
        </Hoja>
      )}

      {abierta === "calendar" && (
        <Hoja titulo="Google Calendar" onCerrar={cerrar}>
          <p className="mb-3 text-[13px] text-muted">
            Cada barbero tiene una agenda de Google que la app llena sola con sus citas (altas, cambios y
            cancelaciones). Se comparte al correo de avisos de su ficha; el barbero la acepta una vez y la ve en su
            Google Calendar, con recordatorios en el celular.
          </p>
          <CalendarGoogle estado={calendar} barberos={barberos} emails={emails} />
        </Hoja>
      )}

      {abierta === "ausencias" && (
        <Hoja titulo="Ausencias y bloqueos" onCerrar={cerrar}>
          <p className="mb-3 text-[13px] text-muted">
            Si un barbero no va un día, márcalo acá: deja de aparecer para reservar esa fecha. Los bloqueos por horas
            (almuerzo) se crean desde el calendario y también se listan abajo.
          </p>
          <AusenciasAdmin barberos={barberos} sedes={sedes} ausencias={ausencias} />
        </Hoja>
      )}
    </>
  );
}

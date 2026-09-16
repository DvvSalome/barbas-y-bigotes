"use client";

import { useState, type ReactNode } from "react";
import { Grupo, Fila } from "@/components/ui/ListaAgrupada";
import { Hoja } from "@/components/ui/Hoja";
import { AlertIcon, ScissorsIcon, UsersIcon, StarIcon, BoxIcon, CashIcon } from "@/components/icons";
import { TarjetaCaja, HojaCerrarCaja, DesgloseBarberos, type CierreHecho } from "@/components/barbero/CierreCaja";
import { cop } from "@/lib/format";
import type { CajaSedeEstado, CajaDesglose } from "@/lib/data/queries";

/*
  La pestaña CIERRE como hub (paso 6 de la tanda 2).

  Antes era una sola columna con TODO apilado y todo abierto a la vez: cobros
  pendientes, qué se llevó cada cliente, la caja con su desglose de barberos y
  sus totales, el consumo del equipo y el gasto del local. Cinco bloques, cada
  uno con su tarjeta, su título y su propio tamaño de letra; el cierre —que es
  lo único que se hace SÍ O SÍ todos los días— quedaba en la mitad.

  Ahora hay una cosa arriba y una lista debajo, que es el patrón de WeiBook y el
  mismo de Ajustes: la caja con el número grande y su botón, y después filas de
  72 px agrupadas por PENDIENTE / HOY / REGISTRAR. Lo que antes estaba desplegado
  ahora vive detrás de la fila que lo nombra, en una Hoja.

  Cada fila dice en el subtítulo QUÉ hay adentro (cuántos cobros, cuánta plata),
  así que no hay que abrirla para saber si vale la pena.

  «Cobro sin cita» NO está en REGISTRAR aunque el plano lo pedía: desde el paso 4
  la barra de abajo tiene «Cobrar» a la vista en las cuatro pestañas, y hace
  exactamente eso. Ponerlo también acá serían dos caminos al mismo sitio a
  cuatro centímetros de distancia.
*/

type Cual = "pendientes" | "cobrados" | "barberos" | "consumo" | "gasto" | "cerrar";

export function CierreHub({
  caja,
  desglose,
  miBarberoId,
  resumen,
  pendientes,
  cobrados,
  consumo,
  gasto,
}: {
  caja: CajaSedeEstado;
  desglose: CajaDesglose;
  miBarberoId: string | null;
  resumen: {
    nPendientes: number;
    montoPendientes: number;
    nCobros: number;
    totalCobrado: number;
  };
  /** Cobro exprés de las citas de hoy sin registrar. null cuando no hay sede fija. */
  pendientes: ReactNode;
  cobrados: ReactNode;
  consumo: ReactNode;
  gasto: ReactNode;
}) {
  const [hoja, setHoja] = useState<Cual | null>(null);
  const [hecho, setHecho] = useState<CierreHecho | null>(null);
  const cerrar = () => setHoja(null);

  const mia = desglose?.barberos.find((b) => b.barberoId === miBarberoId) ?? null;
  const topBarberos = (desglose?.barberos ?? [])
    .slice()
    .sort((a, b) => b.ventas - a.ventas)
    .slice(0, 2)
    .map((b) => `${b.nombre.split(" ")[0]} ${cop(b.ventas)}`)
    .join(" · ");

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <TarjetaCaja caja={caja} desglose={desglose} hecho={hecho} onCerrarCaja={() => setHoja("cerrar")} />

      {/* Lo que FALTA por hacer va primero y solo aparece si falta algo: un grupo
          vacío que dice "0 pendientes" es ruido todos los días para avisar de
          algo que casi nunca pasa. */}
      {pendientes && resumen.nPendientes > 0 && (
        <Grupo eyebrow="Pendiente">
          <Fila
            onClick={() => setHoja("pendientes")}
            icono={<AlertIcon />}
            tinte="plata"
            titulo="Pendientes por cobrar"
            subtitulo={`${resumen.nPendientes} ${resumen.nPendientes === 1 ? "cita" : "citas"} de hoy · ${cop(resumen.montoPendientes)}`}
            badge={resumen.nPendientes}
          />
        </Grupo>
      )}

      <Grupo eyebrow="Hoy">
        <Fila
          onClick={() => setHoja("cobrados")}
          icono={<ScissorsIcon />}
          tinte="marca"
          titulo="Qué se llevó cada cliente"
          subtitulo={
            resumen.nCobros > 0
              ? `${resumen.nCobros} ${resumen.nCobros === 1 ? "cobro" : "cobros"} · ${cop(resumen.totalCobrado)}`
              : "Todavía no se cierra nada hoy"
          }
        />
        <Fila
          onClick={() => setHoja("barberos")}
          icono={<UsersIcon />}
          tinte="equipo"
          titulo="Por barbero"
          subtitulo={topBarberos || "Sin ventas registradas todavía"}
        />
        {/* Sin chevron: no lleva a ningún lado, es el número. Solo cuando el que
            entró ES un barbero; el mostrador y el dueño no tienen comisión. */}
        {mia && (
          <Fila
            icono={<StarIcon />}
            tinte="plata"
            titulo="Mi comisión"
            subtitulo="sobre mis ventas de esta caja"
            valor={cop(mia.comision)}
          />
        )}
      </Grupo>

      {(consumo || gasto) && (
        <Grupo eyebrow="Registrar">
          {consumo && (
            <Fila
              onClick={() => setHoja("consumo")}
              icono={<BoxIcon />}
              tinte="local"
              titulo="Consumo del equipo"
              subtitulo="Una bebida o un mecato que se tomó alguien"
            />
          )}
          {gasto && (
            <Fila
              onClick={() => setHoja("gasto")}
              icono={<CashIcon />}
              tinte="plata"
              titulo="Gasto del local"
              subtitulo="Agua, aseo, un arreglo… se descuenta del cajón si fue en efectivo"
            />
          )}
        </Grupo>
      )}

      {hoja === "cerrar" && caja && (
        <HojaCerrarCaja
          caja={caja}
          onCerrar={cerrar}
          onHecho={(h) => {
            setHecho(h);
            cerrar();
          }}
        />
      )}
      {hoja === "pendientes" && (
        <Hoja titulo="Pendientes por cobrar" onCerrar={cerrar}>
          {pendientes}
        </Hoja>
      )}
      {hoja === "cobrados" && (
        <Hoja titulo="Qué se llevó cada cliente" onCerrar={cerrar}>
          {cobrados}
        </Hoja>
      )}
      {hoja === "barberos" && (
        <Hoja titulo="Por barbero" onCerrar={cerrar} ancho="max-w-md">
          <DesgloseBarberos desglose={desglose} miBarberoId={miBarberoId} />
        </Hoja>
      )}
      {hoja === "consumo" && (
        <Hoja titulo="Consumo del equipo" onCerrar={cerrar} ancho="max-w-md">
          {consumo}
        </Hoja>
      )}
      {hoja === "gasto" && (
        <Hoja titulo="Gasto del local" onCerrar={cerrar} ancho="max-w-md">
          {gasto}
        </Hoja>
      )}
    </div>
  );
}

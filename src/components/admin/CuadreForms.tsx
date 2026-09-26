"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registrarGasto, registrarAdelanto } from "@/lib/actions";
import { sanearCop } from "@/lib/admin-reglas";
import { Campo, CampoSelect } from "@/components/ui/Campo";
import { Hoja, PieHoja, primarioDeHoja } from "@/components/ui/Hoja";
import { Grupo, Fila } from "@/components/ui/ListaAgrupada";
import { Segmentado } from "@/components/ui/Segmentado";
import { ElegirBarbero } from "@/components/staff/Elegir";
import { MedioLogo } from "@/components/staff/MedioLogo";
import { CheckoutForm } from "@/components/barbero/AgendaList";
import { MediosPago } from "@/components/admin/MediosPago";
import { TagIcon, PercentIcon, CashIcon, WalletIcon, PlusIcon } from "@/components/icons";
import { iconoDeGasto } from "@/components/admin/iconos-gasto";
import { cop, plataEnCampo, digitosDePlata } from "@/lib/format";
import type { Sede, Barbero } from "@/lib/data/types";
import type { MedioPago } from "@/lib/data/queries";

/*
  REGISTRAR: el grupo de acciones de la caja (paso 14 de la tanda 2).

  ANTES eran dos formularios enteros SIEMPRE abiertos en la columna derecha, más
  un botón suelto de "Cobrar directo" y la tarjeta de medios de pago debajo. En
  un celular eso son cuatro bloques desplegados que el dueño scrollea cada vez
  que entra a la caja, y que usa —con suerte— una vez al día. La pantalla medía
  4.024 px.

  AHORA son cuatro filas de 72 px y cada una abre su hoja. Es el mismo patrón
  con el que se rehizo el Cierre del mostrador (paso 6), y el mismo motivo: la
  caja se ENTRA a mirar, no a llenar formularios.

  Los cuatro viven en UN componente y no en cuatro: así el grupo es una sola
  tarjeta con sus divisiones, y las hojas se dibujan fuera de ella (una hoja es
  `fixed`, y colgarla dentro del `divide-y` del grupo le pintaba una raya
  encima).
*/

// Categorías frecuentes del gasto: con texto libre cada quien escribía distinto
// ("papeleria"/"Papelería"/"aseo") y la lista quedaba inagrupable.
// Exportada: el mostrador registra gastos con las MISMAS categorías (GastoRapido).
export const CATS_GASTO = ["Insumos", "Aseo", "Papelería", "Servicios", "Comida", "Arreglos"];

// Las cuentas del mes, sacadas del Excel del dueño (CONCEPTO GASTO de septiembre:
// ARRIENDO, RECIBO LUZ, RECIBO AGUA, PAGO IMPUESTO, ADMINISTRACIÓN, PUBLICIDAD,
// CLARO, y "ALEGRA, CANVA, YOU, NUBE, OFFI"). Solo en el panel: el mostrador no
// paga el arriendo.
const CATS_CUENTA = [
  "Arriendo",
  "Luz",
  "Agua",
  "Internet y teléfono",
  "Impuestos",
  "Administración",
  "Publicidad",
  "Suscripciones",
];

// El icono de cada categoría vive en iconos-gasto.ts (lo usa también el reporte
// del mes). El elegido se INVIERTE, el mismo gesto que los chips y el segmentado.

type PropsCobro = Omit<React.ComponentProps<typeof CheckoutForm>, "reserva" | "onDone" | "elegirBarbero">;

type Abierta = null | "gasto" | "adelanto" | "cobro" | "medios";

export function CuadreForms({
  sedes,
  barberos,
  medios = [],
  mediosTodos,
  cobro,
}: {
  sedes: Sede[];
  barberos: Barbero[];
  /** Medios de pago ACTIVOS (0067): con qué se pagó el gasto / el adelanto. */
  medios?: { slug: string; nombre: string }[];
  /** Todos, activos y apagados: es lo que administra la hoja "Medios de pago". */
  mediosTodos: MedioPago[];
  /** Lo que necesita el cobro sin cita (el mismo formulario del mostrador). */
  cobro: PropsCobro;
}) {
  const [abierta, setAbierta] = useState<Abierta>(null);
  const cerrar = () => setAbierta(null);
  const activos = mediosTodos.filter((m) => m.activo).length;

  return (
    <>
      <Grupo eyebrow="Registrar">
        <Fila
          onClick={() => setAbierta("cobro")}
          icono={<CashIcon />}
          tinte="plata"
          titulo="Cobrar sin cita"
          subtitulo="El que llegó y no estaba agendado"
          destacada
        />
        <Fila
          onClick={() => setAbierta("gasto")}
          icono={<TagIcon />}
          tinte="plata"
          titulo="Gastos"
          subtitulo="Caja menor, o cuentas del mes: arriendo, luz, agua"
        />
        <Fila
          onClick={() => setAbierta("adelanto")}
          icono={<PercentIcon />}
          tinte="equipo"
          titulo="Adelanto a un barbero"
          subtitulo="Se le descuenta en la liquidación del domingo"
        />
        <Fila
          onClick={() => setAbierta("medios")}
          icono={<WalletIcon />}
          tinte="neutro"
          titulo="Medios de pago"
          subtitulo="Con qué se cobra en el mostrador"
          valor={`${activos} activos`}
        />
      </Grupo>

      {abierta === "cobro" && (
        <Hoja titulo="Cobrar sin cita" onCerrar={cerrar}>
          <CheckoutForm {...cobro} reserva={null} elegirBarbero onDone={cerrar} />
        </Hoja>
      )}
      {abierta === "gasto" && <HojaGasto sedes={sedes} medios={medios} onCerrar={cerrar} />}
      {abierta === "adelanto" && <HojaAdelanto barberos={barberos} medios={medios} onCerrar={cerrar} />}
      {abierta === "medios" && (
        <Hoja titulo="Medios de pago" onCerrar={cerrar}>
          <MediosPago medios={mediosTodos} />
        </Hoja>
      )}
    </>
  );
}

/**
 * Las categorías como mosaico de iconos: tres por fila en el celular, cada una
 * de 78 px de alto. Con chips de texto había que LEER ocho palabras para dar con
 * "Luz"; con iconos el ojo va directo al rayo. La última es "Otra", que abre el
 * campo de texto — antes el campo estaba siempre a la vista, repitiendo lo que
 * uno acababa de tocar.
 */
function Mosaico({
  opciones,
  valor,
  otra,
  onElegir,
  onOtra,
}: {
  opciones: string[];
  valor: string;
  otra: boolean;
  onElegir: (c: string) => void;
  onOtra: () => void;
}) {
  const tile = (activo: boolean) =>
    `flex min-h-[78px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-1.5 py-2 text-center transition ${
      activo ? "border-ink/70 bg-elevated text-ink" : "border-line text-muted hover:border-ink/30 hover:text-ink"
    }`;
  const circulo = (activo: boolean) =>
    `grid h-9 w-9 place-items-center rounded-full transition ${activo ? "bg-ink text-bg" : "bg-elevated text-ink"}`;
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {opciones.map((c) => {
        const Icono = iconoDeGasto(c);
        const activo = !otra && valor === c;
        return (
          <button key={c} type="button" aria-pressed={activo} onClick={() => onElegir(c)} className={tile(activo)}>
            <span className={circulo(activo)}>
              <Icono className="h-[18px] w-[18px]" />
            </span>
            <span className="text-[12.5px] font-semibold leading-tight">{c}</span>
          </button>
        );
      })}
      <button type="button" aria-pressed={otra} onClick={onOtra} className={tile(otra)}>
        <span className={circulo(otra)}>
          <PlusIcon className="h-[18px] w-[18px]" />
        </span>
        <span className="text-[12.5px] font-semibold leading-tight">Otra</span>
      </button>
    </div>
  );
}

/** El medio de pago con su logo (el mismo MedioLogo del cobro): Nequi se
 *  reconoce por su morado antes de leer la palabra. */
function Medios({
  medios,
  valor,
  onElegir,
}: {
  medios: { slug: string; nombre: string }[];
  valor: string;
  onElegir: (slug: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {medios.map((m) => {
        const activo = valor === m.slug;
        return (
          <button
            key={m.slug}
            type="button"
            aria-pressed={activo}
            onClick={() => onElegir(m.slug)}
            className={`flex min-h-12 items-center gap-2.5 rounded-xl border px-3 text-left transition ${
              activo ? "border-ink/70 bg-elevated text-ink" : "border-line text-muted hover:border-ink/30 hover:text-ink"
            }`}
          >
            <MedioLogo slug={m.slug} nombre={m.nombre} size={28} />
            <span className="min-w-0 truncate text-[13px] font-semibold">{m.nombre}</span>
          </button>
        );
      })}
    </div>
  );
}

function HojaGasto({
  sedes,
  medios,
  onCerrar,
}: {
  sedes: Sede[];
  medios: { slug: string; nombre: string }[];
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [sede, setSede] = useState(sedes[0]?.id ?? "");
  const [cat, setCat] = useState("");
  // "Otra" abre el campo de texto; con una categoría conocida no hace falta.
  const [otra, setOtra] = useState(false);
  const [monto, setMonto] = useState("");
  const [desc, setDesc] = useState("");
  const [medio, setMedio] = useState("efectivo");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // "Del día" (caja menor) o "Cuenta del mes" (arriendo, luz, agua…). Cambia las
  // categorías, el medio por defecto y deja escoger el día en que se pagó.
  const [tipo, setTipo] = useState<"dia" | "mes">("dia");
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const [fecha, setFecha] = useState(hoy);

  function cambiarTipo(t: "dia" | "mes") {
    setTipo(t);
    setCat("");
    setOtra(false);
    setFecha(hoy);
    // Las cuentas del mes casi nunca salen del cajón: arriendo y servicios se
    // pagan por transferencia. Arrancar en efectivo las descontaría del cuadre.
    if (t === "mes" && medios.some((m) => m.slug === "transferencia")) setMedio("transferencia");
    if (t === "dia") setMedio("efectivo");
  }

  // El monto tiene que ser un entero en pesos > 0: vacío o negativo guardaba un
  // gasto de $0 (o restaba plata) sin avisar. Se valida ACÁ para que el botón
  // del pie esté apagado hasta que el formulario sirva de verdad.
  const montoOk = (sanearCop(monto) ?? 0) > 0;

  async function guardar() {
    const n = sanearCop(monto);
    if (n === null || n <= 0) {
      setError("Pon un monto válido en pesos (mayor a $0, sin decimales).");
      return;
    }
    setError("");
    setSaving(true);
    const res = await registrarGasto({
      sede,
      categoria: cat || "Otro",
      monto: n,
      descripcion: desc,
      medio,
      fecha: tipo === "mes" ? fecha : undefined,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo guardar el gasto.");
      return;
    }
    onCerrar();
    router.refresh();
  }

  return (
    <Hoja
      titulo={tipo === "mes" ? "Cuenta del mes" : "Gasto del día"}
      onCerrar={onCerrar}
      ancho="max-w-lg"
      pie={
        <PieHoja onCancelar={onCerrar}>
          <button type="button" onClick={guardar} disabled={saving || !montoOk} className={primarioDeHoja}>
            {saving ? "Guardando…" : montoOk ? `Guardar ${cop(sanearCop(monto) ?? 0)}` : "Guardar"}
          </button>
        </PieHoja>
      }
    >
      <div className="space-y-4 pb-2">
        <Segmentado
          etiqueta="Tipo de gasto"
          opciones={[
            { valor: "dia", texto: "Del día" },
            { valor: "mes", texto: "Cuenta del mes" },
          ]}
          valor={tipo}
          onCambio={cambiarTipo}
        />
        {/* La sede: con dos sedes son dos botones con el nombre a la vista, no
            un desplegable que hay que abrir para ver en cuál quedó. Con más de
            tres, vuelve el select. */}
        {sedes.length > 1 &&
          (sedes.length <= 3 ? (
            <Segmentado
              etiqueta="Sede"
              opciones={sedes.map((x) => ({ valor: x.id, texto: x.nombre }))}
              valor={sede}
              onCambio={(v) => setSede(v as typeof sede)}
            />
          ) : (
            <CampoSelect id="gasto-sede" etiqueta="¿En qué sede?" value={sede} onChange={(e) => setSede(e.target.value as typeof sede)}>
              {sedes.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombre}
                </option>
              ))}
            </CampoSelect>
          ))}

        <div>
          <p className="eyebrow mb-2">{tipo === "mes" ? "Qué cuenta" : "En qué se fue"}</p>
          <Mosaico
            opciones={tipo === "mes" ? CATS_CUENTA : CATS_GASTO}
            valor={cat}
            otra={otra}
            onElegir={(c) => {
              setOtra(false);
              setCat(cat === c ? "" : c);
            }}
            onOtra={() => {
              setOtra(true);
              setCat("");
            }}
          />
          {otra && (
            <Campo
              id="gasto-cat"
              etiqueta="¿Qué fue?"
              className="mt-2.5"
              autoFocus
              maxLength={40}
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              ayuda="Así queda escrito en el cuadre y en el reporte del mes."
            />
          )}
        </div>

        <Campo
          id="gasto-monto"
          etiqueta="¿Cuánto?"
          obligatorio
          type="text"
          inputMode="numeric"
          value={plataEnCampo(monto)}
          onChange={(e) => {
            setMonto(digitosDePlata(e.target.value));
            if (error) setError("");
          }}
          error={error || undefined}
          ayuda={montoOk ? `Son ${cop(sanearCop(monto) ?? 0)}` : undefined}
        />

        {/* Con qué se pagó (0067): solo el efectivo descuenta del cajón. */}
        {medios.length > 0 && (
          <div>
            <p className="eyebrow mb-2">Con qué se pagó</p>
            <Medios medios={medios} valor={medio} onElegir={setMedio} />
            <p className="mt-2 text-[12px] text-muted">
              {medio === "efectivo"
                ? "Sale del cajón: se descuenta del cuadre de hoy."
                : "No sale del cajón: el cuadre del efectivo no cambia."}
            </p>
          </div>
        )}

        {/* Solo en las cuentas del mes: el recibo de la luz se paga el 20 y a
            veces se anota el 2 del mes siguiente. Sin fecha caería en otro mes. */}
        {tipo === "mes" && (
          <Campo
            id="gasto-fecha"
            etiqueta="¿Qué día se pagó?"
            type="date"
            value={fecha}
            max={hoy}
            onChange={(e) => setFecha(e.target.value || hoy)}
            ayuda="Cuenta para el mes de esa fecha, no el de hoy."
          />
        )}

        <Campo id="gasto-desc" etiqueta="Nota (opcional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
      </div>
    </Hoja>
  );
}

function HojaAdelanto({
  barberos,
  medios,
  onCerrar,
}: {
  barberos: Barbero[];
  medios: { slug: string; nombre: string }[];
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [barbero, setBarbero] = useState("");
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");
  const [medio, setMedio] = useState("efectivo");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const listo = !!barbero && (sanearCop(monto) ?? 0) > 0;

  async function guardar() {
    const n = sanearCop(monto);
    if (!barbero) {
      setError("Elige el barbero.");
      return;
    }
    if (n === null || n <= 0) {
      setError("Pon un monto válido en pesos (mayor a $0, sin decimales).");
      return;
    }
    setError("");
    setSaving(true);
    const res = await registrarAdelanto({ barberoId: barbero, monto: n, nota, medio });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo guardar el adelanto.");
      return;
    }
    onCerrar();
    router.refresh();
  }

  const nombre = barberos.find((b) => b.id === barbero)?.nombre.split(" ")[0] ?? "";

  return (
    <Hoja
      titulo="Adelanto a un barbero"
      onCerrar={onCerrar}
      ancho="max-w-lg"
      pie={
        <PieHoja onCancelar={onCerrar}>
          <button type="button" onClick={guardar} disabled={saving || !listo} className={primarioDeHoja}>
            {saving ? "Guardando…" : listo ? `Darle ${cop(sanearCop(monto) ?? 0)} a ${nombre}` : "Guardar"}
          </button>
        </PieHoja>
      }
    >
      <div className="space-y-4 pb-2">
        {/* Con foto: el adelanto es plata que se le descuenta a una persona, y
            elegirla de una lista de nombres sueltos es fácil de errar. */}
        <div>
          <p className="eyebrow mb-2">¿A quién se le adelanta?</p>
          <ElegirBarbero
            barberos={barberos.map((b) => ({ id: b.id, nombre: b.nombre, fotoUrl: b.fotoUrl }))}
            value={barbero}
            onChange={setBarbero}
            placeholder="¿A quién se le adelanta?"
          />
        </div>

        <Campo
          id="adelanto-monto"
          etiqueta="Monto del adelanto"
          obligatorio
          type="text"
          inputMode="numeric"
          value={plataEnCampo(monto)}
          onChange={(e) => {
            setMonto(digitosDePlata(e.target.value));
            if (error) setError("");
          }}
          error={error || undefined}
          ayuda="Se le resta de lo que se le paga el domingo."
        />
        <Campo id="adelanto-nota" etiqueta="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} />

        {/* Cómo se le entregó la plata: queda en la bitácora del cuadre. */}
        {medios.length > 0 && (
          <div>
            <p className="eyebrow mb-2">Cómo se le entregó</p>
            <Medios medios={medios} valor={medio} onElegir={setMedio} />
          </div>
        )}
      </div>
    </Hoja>
  );
}

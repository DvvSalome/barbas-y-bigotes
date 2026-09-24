"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registrarGasto, registrarAdelanto } from "@/lib/actions";
import { sanearCop } from "@/lib/admin-reglas";
import { chipFiltroClases } from "@/components/ui/Chip";
import { Campo, CampoSelect } from "@/components/ui/Campo";
import { Hoja, PieHoja, primarioDeHoja } from "@/components/ui/Hoja";
import { Grupo, Fila } from "@/components/ui/ListaAgrupada";
import { ElegirBarbero } from "@/components/staff/Elegir";
import { CheckoutForm } from "@/components/barbero/AgendaList";
import { MediosPago } from "@/components/admin/MediosPago";
import { TagIcon, PercentIcon, CashIcon, WalletIcon } from "@/components/icons";
import { cop } from "@/lib/format";
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
          titulo="Gasto del día"
          subtitulo="Insumos, aseo, arreglos… sale del cuadre"
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

/** Chips de una sola elección (categoría del gasto, medio de pago). */
function Chips({
  opciones,
  valor,
  onElegir,
}: {
  opciones: { k: string; t: string }[];
  valor: string;
  onElegir: (k: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opciones.map((o) => (
        <button key={o.k} type="button" onClick={() => onElegir(o.k)} className={chipFiltroClases(valor === o.k)}>
          {o.t}
        </button>
      ))}
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
  const [monto, setMonto] = useState("");
  const [desc, setDesc] = useState("");
  const [medio, setMedio] = useState("efectivo");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
    const res = await registrarGasto({ sede, categoria: cat || "Otro", monto: n, descripcion: desc, medio });
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
      titulo="Gasto del día"
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
        <CampoSelect
          id="gasto-sede"
          etiqueta="¿En qué sede?"
          value={sede}
          onChange={(e) => setSede(e.target.value as typeof sede)}
        >
          {sedes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </CampoSelect>

        <div>
          <p className="eyebrow mb-2">En qué se fue</p>
          <Chips opciones={CATS_GASTO.map((c) => ({ k: c, t: c }))} valor={cat} onElegir={(c) => setCat(cat === c ? "" : c)} />
          <Campo
            id="gasto-cat"
            etiqueta="Otra categoría"
            className="mt-2.5"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            ayuda="Si no encaja en ninguna de arriba, escríbela."
          />
        </div>

        <Campo
          id="gasto-monto"
          etiqueta="Monto"
          obligatorio
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={monto}
          onChange={(e) => {
            setMonto(e.target.value);
            if (error) setError("");
          }}
          error={error || undefined}
        />
        <Campo id="gasto-desc" etiqueta="Descripción (opcional)" value={desc} onChange={(e) => setDesc(e.target.value)} />

        {/* Con qué se pagó (0067): solo el efectivo descuenta del cajón. */}
        {medios.length > 0 && (
          <div>
            <p className="eyebrow mb-2">Con qué se pagó</p>
            <Chips opciones={medios.map((m) => ({ k: m.slug, t: m.nombre }))} valor={medio} onElegir={setMedio} />
            <p className="mt-2 text-[12px] text-muted">Del cajón solo se descuenta lo que se pagó en efectivo.</p>
          </div>
        )}
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
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={monto}
          onChange={(e) => {
            setMonto(e.target.value);
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
            <Chips opciones={medios.map((m) => ({ k: m.slug, t: m.nombre }))} valor={medio} onElegir={setMedio} />
          </div>
        )}
      </div>
    </Hoja>
  );
}

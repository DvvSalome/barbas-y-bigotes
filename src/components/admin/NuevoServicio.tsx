"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearServicio } from "@/lib/actions";
import { sanearCop, sanearNombreServicio, NOMBRE_SERVICIO_MAX, CATEGORIAS_SERVICIO } from "@/lib/admin-reglas";
import { Hoja, PieHoja, primarioDeHoja } from "@/components/ui/Hoja";
import { Campo, CampoArea, CampoSelect } from "@/components/ui/Campo";
import { Segmentado } from "@/components/ui/Segmentado";
import { Switch } from "@/components/admin/Switch";
import type { Sede } from "@/lib/data/types";
import { plataEnCampo, digitosDePlata } from "@/lib/format";

/*
  "+ Nuevo servicio" (pedido del administrador, 26-sep: "no me deja crear nuevos
  servicios"; los combos ya tenían su armador, los servicios sueltos no tenían
  nada). En una sede o en las dos, con el mismo precio o uno por sede — "sería
  ideal igual que el otro, que se deje crear para ambas sedes".

  Sin <form>: la hoja guarda con su pie pegado, y así ningún botón de adentro
  (las sedes, la categoría) puede enviar nada por accidente.
*/
export function NuevoServicio({
  sedes,
  sedeInicial,
  etiquetas,
}: {
  sedes: Sede[];
  /** La sede elegida arriba, o "todas". */
  sedeInicial: string;
  etiquetas: Record<string, string>;
}) {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const [ok, setOk] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOk(null);
          setAbierta(true);
        }}
        className="min-h-11 rounded-full bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] px-5 text-[13px] font-bold uppercase tracking-wide text-on-accent transition hover:brightness-105"
      >
        + Nuevo servicio
      </button>
      {ok && (
        <p role="status" className="mt-2 text-[13px] text-ok">
          {ok}
        </p>
      )}
      {abierta && (
        <HojaNuevoServicio
          sedes={sedes}
          sedeInicial={sedeInicial}
          etiquetas={etiquetas}
          onCerrar={() => setAbierta(false)}
          onListo={(nombre) => {
            setAbierta(false);
            setOk(`“${nombre}” quedó creado. Búscalo en la lista para ponerle foto y descripción.`);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function HojaNuevoServicio({
  sedes,
  sedeInicial,
  etiquetas,
  onCerrar,
  onListo,
}: {
  sedes: Sede[];
  sedeInicial: string;
  etiquetas: Record<string, string>;
  onCerrar: () => void;
  onListo: (nombre: string) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [duracion, setDuracion] = useState(30);
  const [donde, setDonde] = useState(sedeInicial);
  const [mismoPrecio, setMismoPrecio] = useState(true);
  const [precio, setPrecio] = useState("");
  const [porSede, setPorSede] = useState<Record<string, string>>({});
  const [desde, setDesde] = useState(false);
  const [descripcion, setDescripcion] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const elegidas = donde === "todas" ? sedes : sedes.filter((s) => s.id === donde);
  const unPrecio = elegidas.length === 1 || mismoPrecio;
  const precios: Record<string, number | null> = Object.fromEntries(
    elegidas.map((s) => [s.id, sanearCop(unPrecio ? precio : (porSede[s.id] ?? ""))]),
  );
  const nombreOk = sanearNombreServicio(nombre);
  const valido =
    !!nombreOk &&
    !!categoria &&
    elegidas.length > 0 &&
    Object.values(precios).every((p) => p !== null && p > 0);

  async function crear() {
    if (!valido || busy) return;
    setBusy(true);
    setErr(null);
    const res = await crearServicio({
      nombre,
      categoria,
      duracionMin: duracion,
      precios: precios as Record<string, number>,
      desde,
      descripcion,
    });
    setBusy(false);
    if (res.ok) onListo(nombreOk ?? nombre);
    else setErr(res.error ?? "No se pudo crear el servicio.");
  }

  return (
    <Hoja
      titulo="Nuevo servicio"
      onCerrar={onCerrar}
      ancho="max-w-lg"
      pie={
        <PieHoja onCancelar={onCerrar}>
          <button type="button" disabled={!valido || busy} onClick={crear} className={primarioDeHoja}>
            {busy ? "Creando…" : "Crear servicio"}
          </button>
        </PieHoja>
      }
    >
      <div className="grid gap-4 pb-4">
        <Campo
          id="ns-nombre"
          etiqueta="Nombre del servicio"
          obligatorio
          value={nombre}
          maxLength={NOMBRE_SERVICIO_MAX}
          onChange={(e) => setNombre(e.target.value)}
          ayuda="Como lo va a leer el cliente al reservar."
        />

        <CampoSelect
          id="ns-categoria"
          etiqueta="Categoría"
          obligatorio
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          ayuda="Los combos no van acá: se arman en el armador de combos."
        >
          <option value="" disabled>
            Elige una…
          </option>
          {CATEGORIAS_SERVICIO.filter((c) => c !== "combos").map((c) => (
            <option key={c} value={c}>
              {etiquetas[c] ?? c}
            </option>
          ))}
        </CampoSelect>

        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink">¿Cuánto dura?</p>
          <div className="inline-flex items-center rounded-full border border-line bg-elevated" role="group" aria-label="Duración">
            <button
              type="button"
              aria-label="Cinco minutos menos"
              disabled={duracion <= 5}
              onClick={() => setDuracion((d) => Math.max(5, d - 5))}
              className="grid h-11 w-11 place-items-center text-lg text-muted transition hover:text-ink disabled:opacity-40"
            >
              −
            </button>
            <span className="min-w-[84px] text-center font-display text-[17px] font-extrabold tabular-nums text-ink">
              {duracion} min
            </span>
            <button
              type="button"
              aria-label="Cinco minutos más"
              disabled={duracion >= 480}
              onClick={() => setDuracion((d) => Math.min(480, d + 5))}
              className="grid h-11 w-11 place-items-center text-lg text-muted transition hover:text-ink disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>

        {sedes.length > 1 && (
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-ink">¿Dónde se hace?</p>
            <Segmentado
              etiqueta="Sedes del servicio"
              valor={donde}
              onCambio={setDonde}
              opciones={[
                ...sedes.map((s) => ({ valor: s.id, texto: s.nombre.split(" ")[0] })),
                { valor: "todas", texto: "Las dos" },
              ]}
            />
          </div>
        )}

        {elegidas.length > 1 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-ink">Mismo precio en las dos</span>
            <Switch checked={mismoPrecio} onChange={setMismoPrecio} label="Mismo precio en las dos sedes" />
          </div>
        )}

        {unPrecio ? (
          <Campo
            id="ns-precio"
            etiqueta={elegidas.length > 1 ? "Precio en las dos" : `Precio en ${elegidas[0]?.nombre ?? ""}`}
            obligatorio
            type="text"
            inputMode="numeric"
            value={plataEnCampo(precio)}
            onChange={(e) => setPrecio(digitosDePlata(e.target.value))}
            ayuda="En pesos, sin puntos ni decimales."
          />
        ) : (
          elegidas.map((s) => (
            <Campo
              key={s.id}
              id={`ns-precio-${s.id}`}
              etiqueta={`Precio en ${s.nombre}`}
              obligatorio
              type="text"
              inputMode="numeric"
              value={plataEnCampo(porSede[s.id] ?? "")}
              onChange={(e) => setPorSede((prev) => ({ ...prev, [s.id]: digitosDePlata(e.target.value) }))}
            />
          ))
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-ink">
            El precio es “desde”
            <span className="block text-[12px] text-muted">Cuando depende del largo del cabello o del trabajo</span>
          </span>
          <Switch checked={desde} onChange={setDesde} label="El precio es desde" />
        </div>

        <CampoArea
          id="ns-descripcion"
          etiqueta="Descripción (opcional)"
          value={descripcion}
          maxLength={200}
          onChange={(e) => setDescripcion(e.target.value)}
          ayuda="Lo que el cliente lee al reservar. La foto se sube después, desde la lista."
        />

        {err && <p className="text-[13px] text-accent-soft">{err}</p>}
      </div>
    </Hoja>
  );
}

"use client";

import { botonClases } from "@/components/ui/Boton";
import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { crearCombo } from "@/lib/actions";
import { cop, plataEnCampo, digitosDePlata } from "@/lib/format";
import { normNombre } from "@/lib/admin-reglas";
import { SearchIcon, CheckIcon, ScissorsIcon } from "@/components/icons";
import { Segmentado } from "@/components/ui/Segmentado";
import type { Categoria, Sede, Servicio } from "@/lib/data/types";

// Armador de combos (proto §7.1). Las partes se eligen de la MISMA forma que se
// leen los precios arriba: buscador + grupos por categoría (antes era una nube
// plana de ~30 chips mezclados). Nombre/duración/precio se autocompletan al
// tocar partes, pero SOLO mientras el dueño no los haya editado a mano: lo
// escrito no se pisa (antes agregar una parte borraba el nombre puesto).
//
// 26-sep (pedido del administrador): el combo se arma para UNA sede o para LAS
// DOS, con su precio en cada una. Antes solo funcionaba con una sede elegida
// arriba, y para tenerlo en las dos había que armarlo dos veces.

const BEBIDA = 5000; // proto §7.1: "Incluye bebida · +$5.000"
const PISO = 5000; // piso de precio del combo (proto §7.3)

const inputCls =
  "w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-[14px] text-ink placeholder:text-muted focus:border-accent focus:outline-none";

const shortName = (n: string) => n.split("(")[0].trim();
const capitalizar = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const sugeridoDe = (suelto: number) => Math.max(PISO, Math.round((suelto * 0.9) / 1000) * 1000);

function BotonMasMenos({ onClick, disabled, label, children }: { onClick: () => void; disabled?: boolean; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-11 items-center justify-center text-lg text-muted transition hover:text-ink disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function ComboBuilder({
  servicios,
  sedes,
  sedeInicial,
  etiquetas,
}: {
  /** Los servicios sueltos y activos: las partes posibles. */
  servicios: Servicio[];
  sedes: Sede[];
  /** La sede elegida arriba, o "todas". */
  sedeInicial: string;
  etiquetas: Record<Categoria, string>;
}) {
  const router = useRouter();
  const [donde, setDonde] = useState(sedeInicial);
  const [partes, setPartes] = useState<Set<string>>(new Set());
  const [conBebida, setConBebida] = useState(false);
  const [q, setQ] = useState("");
  const [nombre, setNombre] = useState("");
  const [duracion, setDuracion] = useState(0);
  // Un precio por sede: una misma parte cuesta distinto en cada una.
  const [precios, setPrecios] = useState<Record<string, number>>({});
  // Qué editó el dueño a mano: esos campos dejan de autocompletarse.
  const [manual, setManual] = useState<{ nombre: boolean; duracion: boolean; precio: Record<string, boolean> }>({
    nombre: false,
    duracion: false,
    precio: {},
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const elegidas = useMemo(() => (donde === "todas" ? sedes : sedes.filter((s) => s.id === donde)), [donde, sedes]);
  // Solo lo que se hace en TODAS las sedes del combo: si no, en una se vendería
  // algo que ahí no se hace (el servidor lo vuelve a revisar).
  const partesDisponibles = useMemo(
    () => servicios.filter((p) => elegidas.every((s) => p.precios[s.id] != null)),
    [servicios, elegidas],
  );
  const noEnTodas = servicios.length - partesDisponibles.length;

  // Partes agrupadas por categoría (el orden de `etiquetas`), con el buscador
  // filtrando en TODO el catálogo — mismo criterio que la lista de arriba.
  const grupos = useMemo(() => {
    const t = normNombre(q);
    const visibles = t ? partesDisponibles.filter((p) => normNombre(p.nombre).includes(t)) : partesDisponibles;
    return (Object.keys(etiquetas) as Categoria[])
      .map((c) => ({ cat: c, items: visibles.filter((p) => p.categoria === c) }))
      .filter((g) => g.items.length > 0);
  }, [partesDisponibles, q, etiquetas]);

  // Selección en el orden de la lista (estable, no depende del orden de tap).
  const seleccion = partesDisponibles.filter((p) => partes.has(p.id));
  const sueltoEn = (sedeId: Sede["id"], sel = seleccion, bebida = conBebida) =>
    sel.reduce((a, p) => a + (p.precios[sedeId] ?? 0), 0) + (bebida ? BEBIDA : 0);
  const durSugerida = seleccion.reduce((a, p) => a + p.duracionMin, 0);

  // Al tocar partes, bebida o sedes se re-sugieren SOLO los campos aún en automático.
  function aplicar(nuevas: Set<string>, bebida: boolean, sedesCombo = elegidas) {
    setOk(null);
    setPartes(nuevas);
    setConBebida(bebida);
    const sel = servicios.filter((p) => nuevas.has(p.id));
    if (!manual.nombre) {
      const nombres = sel.map((p) => shortName(p.nombre));
      if (bebida) nombres.push("bebida");
      setNombre(capitalizar(nombres.join(" + ")));
    }
    if (!manual.duracion) setDuracion(sel.reduce((a, p) => a + p.duracionMin, 0));
    setPrecios((prev) =>
      Object.fromEntries(
        sedesCombo.map((s) => [s.id, manual.precio[s.id] ? (prev[s.id] ?? PISO) : sugeridoDe(sueltoEn(s.id, sel, bebida))]),
      ),
    );
  }

  function togglePart(id: string) {
    const n = new Set(partes);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    aplicar(n, conBebida);
  }

  function cambiarDonde(v: string) {
    setDonde(v);
    const nuevas = v === "todas" ? sedes : sedes.filter((s) => s.id === v);
    // Lo elegido que no se hace en las sedes nuevas se suelta, a la vista.
    const quedan = new Set([...partes].filter((id) => {
      const p = servicios.find((x) => x.id === id);
      return !!p && nuevas.every((s) => p.precios[s.id] != null);
    }));
    aplicar(quedan, conBebida, nuevas);
  }

  const cantidad = seleccion.length;
  const preciosOk = elegidas.every((s) => (precios[s.id] ?? 0) > 0);
  const valido =
    (cantidad >= 2 || (cantidad >= 1 && conBebida)) &&
    nombre.trim() !== "" &&
    !(!conBebida && /bebida/i.test(nombre)) &&
    preciosOk &&
    duracion > 0;
  const dondeTexto = elegidas.length > 1 ? "las dos sedes" : (elegidas[0]?.nombre ?? "");

  async function submit() {
    if (!valido || saving) return;
    setErr(null);
    setOk(null);
    setSaving(true);
    const res = await crearCombo({
      partes: seleccion.map((p) => p.id),
      conBebida,
      nombre: nombre.trim(),
      duracionMin: duracion,
      precios: Object.fromEntries(elegidas.map((s) => [s.id, precios[s.id]])),
    });
    setSaving(false);
    if (res.ok) {
      setPartes(new Set());
      setConBebida(false);
      setNombre("");
      setDuracion(0);
      setPrecios({});
      setManual({ nombre: false, duracion: false, precio: {} });
      setQ("");
      setOk(`Combo creado en ${dondeTexto} ✓${res.aviso ? ` ${res.aviso}` : ""} Ya aparece en el catálogo.`);
      router.refresh();
    } else {
      setErr(res.error ?? "No se pudo crear el combo.");
    }
  }

  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 sm:p-5">
      <div className="eyebrow">Arma el combo · toca lo que incluye</div>

      {sedes.length > 1 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[12.5px] font-semibold text-ink">¿Para qué sede?</p>
          <Segmentado
            etiqueta="Sedes del combo"
            valor={donde}
            onCambio={cambiarDonde}
            opciones={[
              ...sedes.map((s) => ({ valor: s.id, texto: s.nombre.split(" ")[0] })),
              { valor: "todas", texto: "Las dos" },
            ]}
          />
          {elegidas.length > 1 && noEnTodas > 0 && (
            <p className="mt-1.5 text-[12px] text-muted">
              {noEnTodas} {noEnTodas === 1 ? "servicio no se hace" : "servicios no se hacen"} en las dos sedes y no salen acá.
            </p>
          )}
        </div>
      )}

      {/* Buscador de partes: mismo gesto que la lista de precios de arriba */}
      <div className="relative mt-3 max-w-md">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar servicio para el combo…"
          aria-label="Buscar servicio para el combo"
          className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 pl-10 text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </div>

      {/* Partes por categoría como TARJETAS CON FOTO (las mismas de "Servicios
          y precios" / el wizard): las píldoras de texto pelado se sentían de
          hoja de cálculo. Sin foto subida → placeholder neutro con tijera. */}
      {grupos.length === 0 && (
        <p className="mt-3 text-sm text-muted">
          {q ? `Nada coincide con “${q}”. Prueba con otro nombre.` : "No hay servicios que se hagan en esa sede."}
        </p>
      )}
      {grupos.map((g) => (
        <div key={g.cat} className="mt-4">
          <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.12em] text-muted">{etiquetas[g.cat]}</div>
          {/* 2 columnas fijas: el armador vive en un panel angosto a la derecha
              (escritorio) o a lo ancho (móvil); 2 siempre caben bien. */}
          <div className="grid grid-cols-2 gap-2">
            {g.items.map((p) => {
              const on = partes.has(p.id);
              const preciosParte = [...new Set(elegidas.map((s) => p.precios[s.id] ?? 0))];
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => togglePart(p.id)}
                  className={`overflow-hidden rounded-xl border text-left transition ${
                    on ? "border-accent bg-accent/10 shadow-[0_0_0_1px_var(--accent)]" : "border-line bg-bg hover:border-accent/40"
                  }`}
                >
                  <span className="relative block aspect-[5/3] w-full overflow-hidden">
                    {p.fotoUrl ? (
                      <Image src={p.fotoUrl} alt="" fill sizes="(max-width:640px) 50vw, 190px" className="object-cover" />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center bg-elevated text-2xl text-muted/35" aria-hidden>
                        <ScissorsIcon className="h-5 w-5" />
                      </span>
                    )}
                    {on && (
                      <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[12px] font-extrabold text-on-accent">
                        <CheckIcon className="h-4 w-4" />
                      </span>
                    )}
                  </span>
                  <span className="block px-2.5 py-2">
                    <span className="block truncate text-[12.5px] font-semibold leading-tight text-ink">{shortName(p.nombre)}</span>
                    <span className="mt-0.5 flex items-baseline justify-between gap-1">
                      {/* Con las dos sedes y precios distintos, los dos: "+$35.000 · $30.000". */}
                      <span className="truncate text-[12px] font-bold tabular-nums text-accent-soft">
                        +{preciosParte.map((x) => cop(x)).join(" · ")}
                      </span>
                      <span className="shrink-0 text-[12px] text-muted">{p.duracionMin} min</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Bebida */}
      <button
        type="button"
        aria-pressed={conBebida}
        onClick={() => aplicar(partes, !conBebida)}
        className={`mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 py-1.5 text-[12.5px] font-bold transition ${
          conBebida ? "border-ok/50 bg-ok/10 text-ok" : "border-line text-muted hover:text-ink"
        }`}
      >
        {conBebida ? "✓ " : ""}Incluye bebida · +{cop(BEBIDA)}
      </button>

      {/* Tu combo: lo elegido siempre a la vista (con las categorías colapsadas
          por el scroll, lo seleccionado quedaba lejos); tocar una ficha la quita. */}
      {cantidad >= 1 && (
        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-muted">
            Tu combo · {cantidad} {cantidad === 1 ? "servicio" : "servicios"}
            {conBebida ? " + bebida" : ""} · toca una ficha para quitarla
          </div>
          <div className="flex flex-wrap gap-1.5">
            {seleccion.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePart(p.id)}
                title={`Quitar ${shortName(p.nombre)}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-accent/50 bg-accent/10 py-1 pl-1 pr-3 text-xs font-semibold text-ink transition hover:bg-accent/20"
              >
                <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full">
                  {p.fotoUrl ? (
                    <Image src={p.fotoUrl} alt="" fill sizes="32px" className="object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-elevated text-[13px] text-muted/50" aria-hidden>
                      <ScissorsIcon className="h-5 w-5" />
                    </span>
                  )}
                </span>
                {shortName(p.nombre)}
                <span aria-hidden className="text-muted">×</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Resumen (cuando hay al menos una parte) */}
      {cantidad >= 1 && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="text-[12.5px] font-bold text-ink">{nombre || "Combo"}</div>
          {elegidas.map((s) => (
            <p key={s.id} className="mt-0.5 text-xs text-muted">
              {elegidas.length > 1 ? `${s.nombre}: ` : ""}por separado costaría{" "}
              <span className="tabular-nums text-ink">{cop(sueltoEn(s.id))}</span> · combo sugerido{" "}
              <span className="font-bold tabular-nums text-ok">{cop(sugeridoDe(sueltoEn(s.id)))}</span> (10% menos)
            </p>
          ))}
          <p className="mt-0.5 text-xs text-muted">{durSugerida} min sumando las partes</p>
        </div>
      )}

      {/* Editables */}
      <div className="mt-3 grid gap-3">
        <label className="block">
          <span className="mb-1 block eyebrow">Nombre del combo</span>
          <input
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              // Vaciarlo devuelve el campo al modo automático.
              setManual((m) => ({ ...m, nombre: e.target.value.trim() !== "" }));
              setOk(null);
            }}
            placeholder="Nombre del combo"
            className={inputCls}
          />
          {conBebida && nombre.trim() !== "" && !/bebida/i.test(nombre) && (
            <span className="mt-1 block text-[12px] text-muted">Se guarda con “+ bebida” al final: así al reservar no se cobra aparte.</span>
          )}
          {!conBebida && /bebida/i.test(nombre) && (
            <span className="mt-1 block text-[12px] text-warn">
              El nombre dice “bebida” pero el combo no la incluye: al reservar saldría gratis. Quita la palabra o marca la bebida.
            </span>
          )}
        </label>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <span className="mb-1 block eyebrow">Duración (min)</span>
            <div className="inline-flex items-center rounded-full border border-line bg-elevated" role="group" aria-label="duración">
              <BotonMasMenos
                label="Bajar duración"
                disabled={duracion <= 5}
                onClick={() => {
                  setDuracion(Math.max(5, duracion - 5));
                  setManual((m) => ({ ...m, duracion: true }));
                }}
              >
                −
              </BotonMasMenos>
              <span className="min-w-[64px] text-center font-display text-[17px] font-extrabold tabular-nums text-ink">{duracion}</span>
              <BotonMasMenos
                label="Subir duración"
                onClick={() => {
                  setDuracion(duracion + 5);
                  setManual((m) => ({ ...m, duracion: true }));
                }}
              >
                +
              </BotonMasMenos>
            </div>
          </div>
          {elegidas.map((s) => {
            const precio = precios[s.id] ?? PISO;
            const sugerido = sugeridoDe(sueltoEn(s.id));
            const marcar = () => setManual((m) => ({ ...m, precio: { ...m.precio, [s.id]: true } }));
            return (
              <div key={s.id}>
                <span className="mb-1 block eyebrow">
                  {elegidas.length > 1 ? `Precio en ${s.nombre.split(" ")[0]}` : "Precio (COP) — toca el número para escribirlo"}
                </span>
                <div className="inline-flex items-center rounded-full border border-line bg-elevated" role="group" aria-label={`precio en ${s.nombre}`}>
                  <BotonMasMenos
                    label={`Bajar precio en ${s.nombre}`}
                    disabled={precio <= PISO}
                    onClick={() => {
                      setPrecios((p) => ({ ...p, [s.id]: Math.max(PISO, precio - 1000) }));
                      marcar();
                    }}
                  >
                    −
                  </BotonMasMenos>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={plataEnCampo(precio)}
                    onChange={(e) => {
                      setPrecios((p) => ({ ...p, [s.id]: Number(digitosDePlata(e.target.value)) || 0 }));
                      marcar();
                    }}
                    aria-label={`Precio del combo en ${s.nombre}, en pesos`}
                    className="h-11 w-[108px] border-0 bg-transparent text-center font-display text-[17px] font-extrabold tabular-nums text-ink focus:outline-none"
                  />
                  <BotonMasMenos
                    label={`Subir precio en ${s.nombre}`}
                    onClick={() => {
                      setPrecios((p) => ({ ...p, [s.id]: precio + 1000 }));
                      marcar();
                    }}
                  >
                    +
                  </BotonMasMenos>
                </div>
                {manual.precio[s.id] && precio !== sugerido && cantidad >= 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPrecios((p) => ({ ...p, [s.id]: sugerido }));
                      setManual((m) => ({ ...m, precio: { ...m.precio, [s.id]: false } }));
                    }}
                    className="mt-1.5 block min-h-11 text-[12px] font-semibold text-accent-soft transition hover:text-accent"
                  >
                    Usar el sugerido ({cop(sugerido)})
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {err && <div className="mt-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">{err}</div>}
      {ok && <div className="mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">{ok}</div>}

      <button type="button" disabled={!valido || saving} onClick={submit} className={botonClases("primario", "md", "mt-4 w-full")}>
        {saving ? "Creando…" : elegidas.length > 1 ? "Crear combo en las dos sedes" : "Crear combo"}
      </button>
      {!valido && (
        <p className="mt-2 text-center text-[12px] text-muted">
          {cantidad === 0
            ? "Toca al menos 2 servicios (o 1 servicio + la bebida) para armar el combo."
            : cantidad === 1 && !conBebida
              ? "Falta 1: agrega otro servicio o la bebida."
              : nombre.trim() === ""
                ? "Ponle nombre al combo."
                : "Revisa que el precio y la duración sean mayores a cero."}
        </p>
      )}
    </div>
  );
}

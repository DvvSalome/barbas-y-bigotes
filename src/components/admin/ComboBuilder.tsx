"use client";

import { botonClases } from "@/components/ui/Boton";
import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { crearCombo } from "@/lib/actions";
import { cop } from "@/lib/format";
import { SearchIcon, CheckIcon, ScissorsIcon } from "@/components/icons";
import type { Categoria, SedeId, Servicio } from "@/lib/data/types";

// Armador de combos (proto §7.1). Las partes se eligen de la MISMA forma que se
// leen los precios arriba: buscador + grupos por categoría (antes era una nube
// plana de ~30 chips mezclados). Nombre/duración/precio se autocompletan al
// tocar partes, pero SOLO mientras el dueño no los haya editado a mano: lo
// escrito no se pisa (antes agregar una parte borraba el nombre puesto).
// El combo se crea SOLO en la sede activa (decisión del dueño).

const BEBIDA = 5000; // proto §7.1: "Incluye bebida · +$5.000"
const PISO = 5000; // piso de precio del combo (proto §7.3)

const inputCls =
  "w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-[14px] text-ink placeholder:text-muted focus:border-accent focus:outline-none";

const shortName = (n: string) => n.split("(")[0].trim();
const capitalizar = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const sugeridoDe = (suelto: number) => Math.max(PISO, Math.round((suelto * 0.9) / 1000) * 1000);
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

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
  partesDisponibles,
  sedeActiva,
  sedeNombre,
  etiquetas,
}: {
  partesDisponibles: Servicio[];
  sedeActiva: SedeId;
  sedeNombre: string;
  etiquetas: Record<Categoria, string>;
}) {
  const router = useRouter();
  const [partes, setPartes] = useState<Set<string>>(new Set());
  const [conBebida, setConBebida] = useState(false);
  const [q, setQ] = useState("");
  const [nombre, setNombre] = useState("");
  const [duracion, setDuracion] = useState(0);
  const [precio, setPrecio] = useState(PISO);
  // Qué editó el dueño a mano: esos campos dejan de autocompletarse.
  const [manual, setManual] = useState({ nombre: false, duracion: false, precio: false });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  // Partes agrupadas por categoría (el orden de `etiquetas`), con el buscador
  // filtrando en TODO el catálogo — mismo criterio que la lista de arriba.
  const grupos = useMemo(() => {
    const t = norm(q.trim());
    const visibles = t ? partesDisponibles.filter((p) => norm(p.nombre).includes(t)) : partesDisponibles;
    return (Object.keys(etiquetas) as Categoria[])
      .map((c) => ({ cat: c, items: visibles.filter((p) => p.categoria === c) }))
      .filter((g) => g.items.length > 0);
  }, [partesDisponibles, q, etiquetas]);

  // Selección en el orden de la lista (estable, no depende del orden de tap).
  const seleccion = useMemo(
    () => partesDisponibles.filter((p) => partes.has(p.id)),
    [partesDisponibles, partes],
  );
  const sumaPartes = seleccion.reduce((a, p) => a + (p.precios[sedeActiva] ?? 0), 0);
  const suelto = sumaPartes + (conBebida ? BEBIDA : 0);
  const durSugerida = seleccion.reduce((a, p) => a + p.duracionMin, 0);
  const sugerido = sugeridoDe(suelto);

  // Al tocar partes/bebida se re-sugieren SOLO los campos aún en automático.
  function aplicar(nuevas: Set<string>, bebida: boolean) {
    setOk(false);
    setPartes(nuevas);
    setConBebida(bebida);
    const sel = partesDisponibles.filter((p) => nuevas.has(p.id));
    const suma = sel.reduce((a, p) => a + (p.precios[sedeActiva] ?? 0), 0) + (bebida ? BEBIDA : 0);
    if (!manual.nombre) {
      const nombres = sel.map((p) => shortName(p.nombre));
      if (bebida) nombres.push("bebida");
      setNombre(capitalizar(nombres.join(" + ")));
    }
    if (!manual.duracion) setDuracion(sel.reduce((a, p) => a + p.duracionMin, 0));
    if (!manual.precio) setPrecio(sugeridoDe(suma));
  }

  function togglePart(id: string) {
    const n = new Set(partes);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    aplicar(n, conBebida);
  }

  const cantidad = partes.size;
  const valido =
    (cantidad >= 2 || (cantidad >= 1 && conBebida)) && nombre.trim() !== "" && precio > 0 && duracion > 0;

  async function submit() {
    if (!valido || saving) return;
    setErr(null);
    setOk(false);
    setSaving(true);
    const res = await crearCombo({
      sede: sedeActiva,
      partes: [...partes],
      conBebida,
      nombre: nombre.trim(),
      duracionMin: duracion,
      precio,
    });
    setSaving(false);
    if (res.ok) {
      setPartes(new Set());
      setConBebida(false);
      setNombre("");
      setDuracion(0);
      setPrecio(PISO);
      setManual({ nombre: false, duracion: false, precio: false });
      setQ("");
      setOk(true);
      router.refresh();
    } else {
      setErr(res.error ?? "No se pudo crear el combo.");
    }
  }

  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 sm:p-5">
      <div className="eyebrow">
        Arma el combo · toca lo que incluye
      </div>
      <p className="mt-1 text-xs text-muted">
        Se crea en <span className="font-semibold text-ink">{sedeNombre}</span> · queda disponible solo en esta sede.
      </p>

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
        <p className="mt-3 text-sm text-muted">Nada coincide con “{q}”. Prueba con otro nombre.</p>
      )}
      {grupos.map((g) => (
        <div key={g.cat} className="mt-4">
          <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.12em] text-muted">
            {etiquetas[g.cat]}
          </div>
          {/* 2 columnas fijas: el armador ahora vive en un panel angosto a la
              derecha (escritorio) o a lo ancho (móvil); 2 siempre caben bien. */}
          <div className="grid grid-cols-2 gap-2">
            {g.items.map((p) => {
              const on = partes.has(p.id);
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
                    <span className="block truncate text-[12.5px] font-semibold leading-tight text-ink">
                      {shortName(p.nombre)}
                    </span>
                    <span className="mt-0.5 flex items-baseline justify-between gap-1">
                      <span className="text-[12px] font-bold tabular-nums text-accent-soft">
                        +{cop(p.precios[sedeActiva] ?? 0)}
                      </span>
                      <span className="text-[12px] text-muted">{p.duracionMin} min</span>
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
                className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-accent/50 bg-accent/10 py-1 pl-1 pr-3 text-xs font-semibold text-ink transition hover:bg-accent/20"
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
          <p className="mt-0.5 text-xs text-muted">
            Por separado costaría <span className="tabular-nums text-ink">{cop(suelto)}</span> · {durSugerida} min ·
            combo sugerido <span className="font-bold tabular-nums text-ok">{cop(sugerido)}</span> (10% menos)
          </p>
        </div>
      )}

      {/* Editables */}
      <div className="mt-3 grid gap-3">
        <label className="block">
          <span className="mb-1 block eyebrow">
            Nombre del combo
          </span>
          <input
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              // Vaciarlo devuelve el campo al modo automático.
              setManual((m) => ({ ...m, nombre: e.target.value.trim() !== "" }));
              setOk(false);
            }}
            placeholder="Nombre del combo"
            className={inputCls}
          />
        </label>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <span className="mb-1 block eyebrow">
              Duración (min)
            </span>
            <div className="inline-flex items-center rounded-full border border-line bg-elevated" role="group" aria-label="duración">
              <BotonMasMenos label="Bajar duración" disabled={duracion <= 5} onClick={() => { setDuracion(Math.max(5, duracion - 5)); setManual((m) => ({ ...m, duracion: true })); }}>
                −
              </BotonMasMenos>
              <span className="min-w-[64px] text-center font-display text-[17px] font-extrabold tabular-nums text-ink">
                {duracion}
              </span>
              <BotonMasMenos label="Subir duración" onClick={() => { setDuracion(duracion + 5); setManual((m) => ({ ...m, duracion: true })); }}>
                +
              </BotonMasMenos>
            </div>
          </div>
          <div>
            <span className="mb-1 block eyebrow">
              Precio (COP) — toca el número para escribirlo
            </span>
            <div className="inline-flex items-center rounded-full border border-line bg-elevated" role="group" aria-label="precio">
              <BotonMasMenos label="Bajar precio" disabled={precio <= PISO} onClick={() => { setPrecio(Math.max(PISO, precio - 1000)); setManual((m) => ({ ...m, precio: true })); }}>
                −
              </BotonMasMenos>
              <input
                type="number"
                min={PISO}
                step={500}
                value={precio}
                onChange={(e) => {
                  setPrecio(Number(e.target.value) || 0);
                  setManual((m) => ({ ...m, precio: true }));
                }}
                aria-label="Precio del combo en pesos"
                className="w-[92px] border-0 bg-transparent text-center font-display text-[17px] font-extrabold tabular-nums text-ink focus:outline-none"
              />
              <BotonMasMenos label="Subir precio" onClick={() => { setPrecio(precio + 1000); setManual((m) => ({ ...m, precio: true })); }}>
                +
              </BotonMasMenos>
            </div>
            {manual.precio && precio !== sugerido && cantidad >= 1 && (
              <button
                type="button"
                onClick={() => {
                  setPrecio(sugerido);
                  setManual((m) => ({ ...m, precio: false }));
                }}
                className="mt-1.5 block text-[12px] font-semibold text-accent-soft transition hover:text-accent"
              >
                Usar el sugerido ({cop(sugerido)})
              </button>
            )}
          </div>
        </div>
      </div>

      {err && (
        <div className="mt-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">
          {err}
        </div>
      )}
      {ok && (
        <div className="mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">
          Combo creado en {sedeNombre} ✓ — ya aparece en el catálogo de arriba.
        </div>
      )}

      <button
        type="button"
        disabled={!valido || saving}
        onClick={submit}
        className={botonClases("primario", "md", "mt-4 w-full")}
      >
        {saving ? "Creando…" : "Crear combo"}
      </button>
      {!valido && (
        <p className="mt-2 text-center text-[12px] text-muted">
          {cantidad === 0
            ? "Toca al menos 2 servicios (o 1 servicio + la bebida) para armar el combo."
            : cantidad === 1 && !conBebida
              ? "Falta 1: agrega otro servicio o la bebida."
              : nombre.trim() === ""
                ? "Ponele nombre al combo."
                : "Revisa que el precio y la duración sean mayores a cero."}
        </p>
      )}
    </div>
  );
}

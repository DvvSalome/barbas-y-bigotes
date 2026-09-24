"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import Image from "next/image";
import { cop } from "@/lib/format";
import { buscarClientesMostrador, type ClienteSugerido } from "@/lib/actions";

// Selectores del staff. Un <select> nativo no busca ni muestra fotos: con 45
// servicios el barbero tenía que scrollear la lista entera de pie y con el
// cliente enfrente, y al elegir barbero solo veía nombres sueltos.
// Estos dos abren un panel con buscador y cierran al elegir, con teclado
// (Escape cierra) y clic afuera.

const iniciales = (n: string) =>
  (n || "?").trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("");

/** Cierra el panel al hacer clic afuera o con Escape. */
function useCerrarAfuera(abierto: boolean, cerrar: () => void) {
  const caja = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) cerrar();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto, cerrar]);
  return caja;
}

const BOTON =
  "flex min-h-11 w-full items-center gap-2.5 rounded-lg border border-line bg-bg px-3 py-2 text-left text-ink transition hover:border-accent/50";
const PANEL =
  "absolute z-30 mt-1 max-h-[300px] w-full overflow-y-auto rounded-xl border border-accent/40 bg-panel shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)]";

export type OpcionBarbero = { id: string; nombre: string; fotoUrl?: string | null };

/** Cara del barbero (foto o iniciales). Exportada: el admin la usa en equipo,
 *  ausencias y comisiones — una sola cara para todo el staff.
 *  Fuera del componente: definirla adentro la recrea en cada render y React la
 *  remonta. */
export function CaraBarbero({
  b,
  size = 26,
  aro,
}: {
  b: OpcionBarbero;
  size?: number;
  /** Anillo alrededor de la foto (tarjetas grandes). */
  aro?: boolean;
}) {
  return b.fotoUrl ? (
    <Image
      src={b.fotoUrl}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-full object-cover object-top ${aro ? "ring-2 ring-line" : ""}`}
      style={{ height: size, width: size }}
    />
  ) : (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-elevated font-bold text-ink ${
        aro ? "ring-2 ring-line" : ""
      }`}
      style={{ height: size, width: size, fontSize: Math.max(10, Math.round(size * 0.34)) }}
    >
      {iniciales(b.nombre)}
    </span>
  );
}

/** Barbero con su foto. El nombre suelto no se reconoce tan rápido como la cara. */
export function ElegirBarbero({
  barberos,
  value,
  onChange,
  placeholder = "¿Quién atiende?",
  permitirVacio,
  etiquetaVacio = "El primero que se desocupe",
  extra,
}: {
  barberos: OpcionBarbero[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  permitirVacio?: boolean;
  etiquetaVacio?: string;
  /** Una opción que no es una persona y va al FINAL, para que no se elija por
   *  inercia: hoy la usa "El local (sin comisión)" de la venta rápida. */
  extra?: { id: string; etiqueta: string };
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useCerrarAfuera(abierto, () => setAbierto(false));
  const sel = barberos.find((b) => b.id === value) ?? null;
  const esExtra = !!extra && value === extra.id;

  return (
    <div ref={caja} className="relative">
      <button type="button" onClick={() => setAbierto((v) => !v)} className={BOTON} aria-expanded={abierto}>
        {sel ? (
          <>
            <CaraBarbero b={sel} />
            <span className="flex-1 truncate text-[13.5px] font-semibold">{sel.nombre}</span>
          </>
        ) : esExtra ? (
          <span className="flex-1 truncate text-[13.5px] font-semibold">{extra.etiqueta}</span>
        ) : (
          <span className="flex-1 truncate text-[13.5px] text-muted">{placeholder}</span>
        )}
        <span aria-hidden className="text-[12px] text-muted">▾</span>
      </button>

      {abierto && (
        <div className={PANEL} role="listbox">
          {permitirVacio && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setAbierto(false);
              }}
              className="flex w-full items-center gap-2.5 border-b border-line/60 px-3 py-2.5 text-left text-[13px] text-muted transition hover:bg-elevated"
            >
              {etiquetaVacio}
            </button>
          )}
          {barberos.map((b) => (
            <button
              key={b.id}
              type="button"
              role="option"
              aria-selected={b.id === value}
              onClick={() => {
                onChange(b.id);
                setAbierto(false);
              }}
              className={`flex w-full items-center gap-2.5 border-b border-line/60 px-3 py-2.5 text-left transition last:border-b-0 hover:bg-elevated ${
                b.id === value ? "bg-accent/10" : ""
              }`}
            >
              <CaraBarbero b={b} size={30} />
              <span className="flex-1 truncate text-[13.5px] font-semibold text-ink">{b.nombre}</span>
              {b.id === value && <span className="text-[12px] text-accent-soft">✓</span>}
            </button>
          ))}
          {extra && (
            <button
              type="button"
              role="option"
              aria-selected={esExtra}
              onClick={() => {
                onChange(extra.id);
                setAbierto(false);
              }}
              className={`flex w-full items-center gap-2.5 border-t border-line px-3 py-2.5 text-left text-[13px] transition hover:bg-elevated ${
                esExtra ? "bg-accent/10 text-ink" : "text-muted"
              }`}
            >
              {extra.etiqueta}
              {esExtra && <span className="ml-auto text-[12px] text-accent-soft">✓</span>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export type OpcionServicio = { id: string; nombre: string; precio?: number | null; duracionMin?: number };

/** Servicio con BUSCADOR: 45 servicios no se recorren a mano. */
export function ElegirServicio({
  servicios,
  value,
  onChange,
  placeholder = "Buscar servicio…",
  etiquetaVacio,
}: {
  servicios: OpcionServicio[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  /** Si viene, se ofrece una opción para dejarlo sin elegir. */
  etiquetaVacio?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const caja = useCerrarAfuera(abierto, () => setAbierto(false));
  const sel = servicios.find((s) => s.id === value) ?? null;

  // Sin acentos ni mayúsculas: "depilacion" tiene que encontrar "Depilación".
  const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const lista = useMemo(() => {
    const t = norm(q.trim());
    return t ? servicios.filter((s) => norm(s.nombre).includes(t)) : servicios;
  }, [q, servicios]);

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={() => {
          setAbierto((v) => !v);
          setQ("");
        }}
        className={BOTON}
        aria-expanded={abierto}
      >
        <span className={`flex-1 truncate text-[13.5px] ${sel ? "font-semibold" : "text-muted"}`}>
          {sel ? sel.nombre : (etiquetaVacio ?? placeholder)}
        </span>
        {sel?.precio != null && (
          <span className="shrink-0 text-[12.5px] font-bold tabular-nums text-accent-soft">{cop(sel.precio)}</span>
        )}
        <span aria-hidden className="text-[12px] text-muted">▾</span>
      </button>

      {abierto && (
        <div className={PANEL}>
          <div className="sticky top-0 border-b border-line bg-panel p-2">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg border border-line bg-bg px-2.5 py-1.5 text-[13px] text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>

          {etiquetaVacio && !q && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setAbierto(false);
              }}
              className="flex w-full border-b border-line/60 px-3 py-2.5 text-left text-[13px] text-muted transition hover:bg-elevated"
            >
              {etiquetaVacio}
            </button>
          )}

          {lista.length === 0 && (
            <p className="px-3 py-4 text-center text-[12.5px] text-muted">Nada con “{q}”.</p>
          )}

          {lista.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onChange(s.id);
                setAbierto(false);
              }}
              className={`flex w-full items-center gap-2 border-b border-line/60 px-3 py-2.5 text-left transition last:border-b-0 hover:bg-elevated ${
                s.id === value ? "bg-accent/10" : ""
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] text-ink">{s.nombre}</span>
                {s.duracionMin != null && <span className="block text-[12px] text-muted">{s.duracionMin} min</span>}
              </span>
              {s.precio != null && (
                <span className="shrink-0 text-[12.5px] font-bold tabular-nums text-ink">{cop(s.precio)}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Qué cliente es, tal como sale del selector:
 *  - "paso": no da nombre. NO se guarda nada en la base de clientes.
 *  - "existente": ya estaba registrado; se eligió de lo que se buscó.
 *  - "nuevo": se escribe el nombre (y el teléfono, si lo da) y se crea.
 */
export type ClienteElegido =
  | { tipo: "paso" }
  | { tipo: "existente"; id: string; nombre: string; telFinal: string | null }
  | { tipo: "nuevo"; nombre: string; telefono: string };

type Sugerido = ClienteSugerido & { hace: string };

/** "hoy", "ayer", "hace 5 días", "hace 2 meses". Se calcula al LLEGAR la
 *  respuesta, no al dibujar: la hora actual en el render es impura. */
function haceCuanto(iso: string | null, ahora: number): string {
  if (!iso) return "";
  const dias = Math.floor((ahora - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 45) return `hace ${dias} días`;
  const meses = Math.round(dias / 30);
  return `hace ${meses} ${meses === 1 ? "mes" : "meses"}`;
}

/**
 * El cliente del mostrador, pedido por el administrador: "selector fácil para
 * clientes que no ponen nombre, y si escribe el nombre que salgan los clientes
 * ya registrados".
 *
 * Dos cosas que arregla:
 *  1. El que no da nombre tiene su botón, "Cliente de paso", y no crea nada. Sin
 *     él los barberos inventaban uno ("BARBAS Y BIGOTES" con 000000000,
 *     "INCOGNITO"…) y la base de clientes se llenaba de gente que no existe.
 *  2. Al escribir aparecen los que YA están, con sus 4 últimos dígitos y cuándo
 *     vinieron. Elegido uno, la venta queda ligada a SU historial y a su tarjeta
 *     de cortes; escrito a mano, "Juan" se volvía un Juan nuevo cada vez.
 */
export function ElegirCliente({
  valor,
  onCambio,
  pedirTelefono = true,
}: {
  valor: ClienteElegido;
  onCambio: (c: ClienteElegido) => void;
  /** El walk-in pide teléfono al cliente nuevo; el cobro rápido no hace falta. */
  pedirTelefono?: boolean;
}) {
  const [sugeridos, setSugeridos] = useState<Sugerido[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pedido = useRef(0);
  const caja = useCerrarAfuera(abierto, () => setAbierto(false));

  const texto = valor.tipo === "nuevo" ? valor.nombre : "";
  const tel = valor.tipo === "nuevo" ? valor.telefono : "";

  function escribir(t: string) {
    onCambio({ tipo: "nuevo", nombre: t, telefono: tel });
    if (timer.current) clearTimeout(timer.current);
    if (t.trim().length < 2) {
      setSugeridos([]);
      setAbierto(false);
      return;
    }
    const n = ++pedido.current;
    setBuscando(true);
    // 250 ms: se busca cuando la persona para de teclear, no en cada letra.
    timer.current = setTimeout(async () => {
      const r = await buscarClientesMostrador(t).catch(() => [] as ClienteSugerido[]);
      if (n !== pedido.current) return; // llegó tarde: ya se escribió otra cosa
      const ahora = Date.now();
      setSugeridos(r.map((c) => ({ ...c, hace: haceCuanto(c.ultima, ahora) })));
      setBuscando(false);
      setAbierto(true);
    }, 250);
  }

  // ── Ya elegido: una tarjeta con "Cambiar" ────────────────────────────────
  if (valor.tipo === "paso" || valor.tipo === "existente") {
    return (
      <div className="flex min-h-14 items-center gap-3 rounded-xl border border-ink/40 bg-elevated px-3.5 py-2.5">
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink font-bold text-bg"
        >
          {valor.tipo === "paso" ? "?" : iniciales(valor.nombre)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-ink">
            {valor.tipo === "paso" ? "Cliente de paso" : valor.nombre}
          </span>
          <span className="block truncate text-[12px] text-muted">
            {valor.tipo === "paso"
              ? "No dio nombre: no se guarda en la base de clientes"
              : `Cliente registrado${valor.telFinal ? ` · ···${valor.telFinal}` : ""} · la visita suma a su historial`}
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            onCambio({ tipo: "nuevo", nombre: "", telefono: "" });
            setSugeridos([]);
          }}
          className="inline-flex min-h-11 shrink-0 items-center px-2 text-[13px] font-semibold text-muted underline decoration-line underline-offset-4 transition hover:text-ink"
        >
          Cambiar
        </button>
      </div>
    );
  }

  // ── Buscando o escribiendo uno nuevo ─────────────────────────────────────
  const exacto = sugeridos.some((c) => c.nombre.trim().toLowerCase() === texto.trim().toLowerCase());
  return (
    <div ref={caja} className="relative space-y-2">
      <div className="flex gap-2">
        <input
          value={texto}
          onChange={(e) => escribir(e.target.value)}
          onFocus={() => sugeridos.length && setAbierto(true)}
          placeholder="Nombre o teléfono"
          aria-label="Nombre o teléfono del cliente"
          autoComplete="off"
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3.5 text-[15px] text-ink placeholder:text-muted focus:border-ink/60 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => {
            if (timer.current) clearTimeout(timer.current);
            pedido.current++;
            setAbierto(false);
            onCambio({ tipo: "paso" });
          }}
          className="inline-flex min-h-12 shrink-0 items-center rounded-xl border border-line px-3.5 text-[13px] font-semibold text-ink transition hover:border-ink/40"
        >
          De paso
        </button>
      </div>

      {abierto && (texto.trim().length >= 2) && (
        <div className={`${PANEL} mt-0`} role="listbox">
          {sugeridos.map((c) => (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => {
                setAbierto(false);
                onCambio({ tipo: "existente", id: c.id, nombre: c.nombre, telFinal: c.telFinal });
              }}
              className="flex min-h-14 w-full items-center gap-3 border-b border-line/60 px-3 py-2 text-left transition hover:bg-elevated"
            >
              <span
                aria-hidden
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-elevated text-[13px] font-bold text-ink"
              >
                {iniciales(c.nombre)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-ink">{c.nombre}</span>
                <span className="block truncate text-[12px] text-muted">
                  {[
                    c.telFinal ? `···${c.telFinal}` : null,
                    c.visitas ? `${c.visitas} ${c.visitas === 1 ? "visita" : "visitas"}` : "sin visitas",
                    c.hace || null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </button>
          ))}
          {!buscando && sugeridos.length === 0 && (
            <p className="px-3 py-3 text-[12.5px] text-muted">Nadie registrado con “{texto.trim()}”.</p>
          )}
          {!exacto && (
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="flex min-h-12 w-full items-center gap-2 px-3 text-left text-[13px] font-semibold text-accent-soft transition hover:bg-elevated"
            >
              + Cliente nuevo: “{texto.trim()}”
            </button>
          )}
        </div>
      )}

      {/* El teléfono SOLO para el cliente nuevo: al que ya existe no hay que
          volvérselo a pedir, y el de paso no deja datos. */}
      {pedirTelefono && texto.trim().length >= 2 && !abierto && (
        <input
          value={tel}
          onChange={(e) => onCambio({ tipo: "nuevo", nombre: texto, telefono: e.target.value })}
          placeholder="Teléfono (opcional)"
          aria-label="Teléfono del cliente nuevo"
          inputMode="tel"
          className="min-h-12 w-full rounded-xl border border-line bg-bg px-3.5 text-[15px] text-ink placeholder:text-muted focus:border-ink/60 focus:outline-none"
        />
      )}
    </div>
  );
}

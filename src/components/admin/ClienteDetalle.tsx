"use client";

import { Estrellas } from "@/components/ui/Estrellas";
import {
  BookIcon,
  CalendarIcon,
  ChevronRightIcon,
  PencilIcon,
  ReceiptIcon,
  ScissorsIcon,
  StarIcon,
  StoreIcon,
  TicketIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/icons";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cop } from "@/lib/format";
import { bogotaYmd } from "@/lib/slots";
import { linkWhatsApp, telefonoWhatsApp } from "@/lib/whatsapp";
import {
  agregarNotaCliente,
  editarNotaCliente,
  borrarNotaCliente,
  actualizarNotaFicha,
  agregarMovWallet,
  agregarResenaCliente,
  borrarResenaCliente,
  canjearPuntos,
} from "@/lib/actions";
import { Grupo, Fila } from "@/components/ui/ListaAgrupada";
import { Hoja } from "@/components/ui/Hoja";
import { IconTile } from "@/components/ui/IconTile";
import { EstadoVacio } from "@/components/ui/EstadoVacio";
import { botonClases } from "@/components/ui/Boton";
import { CaraBarbero, ElegirBarbero } from "@/components/staff/Elegir";
import { MedioLogo } from "@/components/staff/MedioLogo";
import { tono } from "@/app/admin/clientes/ClientesLista";
import type { ClienteDetalle as Detalle, MedioPago } from "@/lib/data/queries";
import type { Barbero } from "@/lib/data/types";

const fld = "w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink placeholder:text-muted focus:border-accent focus:outline-none";
const btn = "rounded-full bg-accent px-5 py-2 text-xs font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-50";

const ESTADO: Record<string, string> = {
  pendiente: "Pendiente", confirmada: "Confirmada", en_curso: "En curso",
  completada: "Completada", cancelada: "Cancelada", no_show: "No llegó",
};
const TONO_ESTADO: Record<string, string> = {
  pendiente: "bg-elevated text-muted",
  confirmada: "bg-elevated text-ink",
  en_curso: "bg-ok/10 text-ok",
  completada: "bg-ok/10 text-ok",
  cancelada: "bg-warn/10 text-warn",
  no_show: "bg-warn/10 text-warn",
};

// Antes eran 8 pestañas en scroll horizontal: en un celular se veían 3 y media, y
// lo que el dueño viene a mirar (qué pide, con quién, cada cuánto) no estaba en
// ninguna. Ahora arriba va lo que se lee de un vistazo y cada sección es una fila
// que abre su hoja — con el MISMO cuerpo que tenía la pestaña, sin perder nada.
type Seccion = "historial" | "reservas" | "fidelidad" | "wallet" | "notas" | "resenas" | "calificaciones";
const TITULO: Record<Seccion, string> = {
  historial: "Historial",
  reservas: "Reservas",
  fidelidad: "Fidelidad",
  wallet: "Wallet",
  notas: "Bitácora",
  // Ojo con los nombres: "resenas" = el staff califica AL cliente; "calificaciones" = el
  // cliente opina de su visita. Los títulos los distinguen; los keys internos no cambian.
  resenas: "Nota del staff",
  calificaciones: "Su opinión",
};

// Todas las fechas en hora de Bogotá: el servidor de Vercel corre en UTC, y un
// cobro de las 8 pm salía con la fecha de mañana en el primer render.
const ZONA = "America/Bogota";

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", { timeZone: ZONA, day: "numeric", month: "short", year: "2-digit" });
}

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", { timeZone: ZONA, day: "numeric", month: "short" });
}

/** "Corte (clásico, degradado, tijera o niño)" → "Corte": lo de adentro describe,
 *  no distingue (igual que las tarjetas del walk-in). */
const corto = (nombre: string) => nombre.split(" (")[0];

function cuando(iso: string) {
  const f = new Date(iso);
  const dia = f.toLocaleDateString("es-CO", { timeZone: ZONA, weekday: "short", day: "numeric", month: "short" });
  const hora = f.toLocaleTimeString("es-CO", { timeZone: ZONA, hour: "numeric", minute: "2-digit" });
  return `${dia} · ${hora}`;
}

/** Días de a hasta b, dos fechas civiles YYYY-MM-DD. */
function diasEntre(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

function haceTexto(dias: number) {
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 60) return `hace ${dias} días`;
  return `hace ${Math.round(dias / 30)} meses`;
}

/** Lo que más se repite y cuántas veces. En empate gana el más reciente (la lista viene de nueva a vieja). */
function elMasRepetido(xs: string[]): { valor: string; veces: number } | null {
  const n = new Map<string, number>();
  for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1);
  let top: { valor: string; veces: number } | null = null;
  for (const [valor, veces] of n) if (!top || veces > top.veces) top = { valor, veces };
  return top;
}

const iniciales = (n: string) =>
  n.trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("") || "?";

export type TarjetaClienteView = {
  cortesTotales: number;
  sellos: number;
  tarjetasCompletas: number;
  /** "regalo" o el porcentaje ("50%"), según lo que el dueño configuró (0064). */
  proximo: { tipo: string; faltan: number; posicion: number } | null;
  tamano: number;
};

export function ClienteDetalle({
  detalle,
  barberos,
  tarjeta,
  medios,
  hoy,
}: {
  detalle: Detalle;
  barberos: Barbero[];
  tarjeta: TarjetaClienteView;
  medios: MedioPago[];
  /** YYYY-MM-DD en Bogotá, calculado en el servidor. */
  hoy: string;
}) {
  const d = detalle;
  const h = d.historial;
  const [abierta, setAbierta] = useState<Seccion | null>(null);

  // El medio se guarda como slug ("nequi"); acá va el nombre que se lee en el mostrador.
  const nombreMedio = (slug: string) =>
    medios.find((m) => m.slug === slug)?.nombre ?? (slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : "—");

  // Lo de siempre: con quién se corta, qué pide y con qué paga.
  const barbero = elMasRepetido(h.filter((v) => v.barbero).map((v) => v.barbero));
  const fotoDe = (nombre: string) => h.find((v) => v.barbero === nombre)?.barberoFoto ?? null;
  const servicios = h.flatMap((v) => v.items.filter((i) => i.tipo === "servicio").map((i) => i.nombre));
  const pide = elMasRepetido(servicios.length ? servicios : h.flatMap((v) => v.items.map((i) => i.nombre)));
  const medio = elMasRepetido(h.map((v) => v.medio).filter(Boolean));
  const deVisitas = (veces: number) =>
    veces >= d.visitas ? (d.visitas === 1 ? "su única visita" : "todas las veces") : `${veces} de ${d.visitas} veces`;

  // Cada cuánto viene: por DÍAS distintos (un corte y una cera comprada aparte el
  // mismo día no son dos visitas).
  const dias = [...new Set(h.map((v) => bogotaYmd(new Date(v.fecha))))].sort();
  const cada = dias.length >= 2 ? Math.round(diasEntre(dias[0], dias[dias.length - 1]) / (dias.length - 1)) : null;
  const ultimaDias = d.ultima ? diasEntre(bogotaYmd(new Date(d.ultima)), hoy) : null;

  const proxima =
    d.reservas
      .filter((r) => (r.estado === "pendiente" || r.estado === "confirmada") && bogotaYmd(new Date(r.inicio)) >= hoy)
      .sort((a, b) => a.inicio.localeCompare(b.inicio))[0] ?? null;

  const tel = telefonoWhatsApp(d.telefono);
  const wa = linkWhatsApp(d.telefono, `Hola ${d.nombre.trim().split(/\s+/)[0]}! Te escribimos de Barbas & Bigotes ✂️`);
  const desde = new Date(d.creadoEn).toLocaleDateString("es-CO", { timeZone: ZONA, month: "short", year: "numeric" });
  const promCalif = d.calificaciones.length
    ? Math.round((d.calificaciones.reduce((a, c) => a + c.score, 0) / d.calificaciones.length) * 10) / 10
    : null;

  return (
    <div>
      {/* Quién es: el mismo color de avatar que en la lista. */}
      <div className="mt-4 flex items-center gap-4">
        <span
          aria-hidden
          className="grid h-14 w-14 shrink-0 place-items-center rounded-full font-display text-[22px] font-bold text-[#0c0b0a]"
          style={{ background: tono(d.nombre) }}
        >
          {iniciales(d.nombre)}
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-[28px] font-semibold leading-tight sm:text-4xl">{d.nombre}</h1>
          <p className="mt-0.5 text-sm text-muted">
            {d.telefono || "Sin teléfono"} · cliente desde {desde}
          </p>
          {d.email && <p className="truncate text-sm text-muted">{d.email}</p>}
        </div>
      </div>

      {tel && wa && (
        <div className="mt-4 flex gap-2">
          <a href={wa} target="_blank" rel="noopener noreferrer" className={botonClases("secundario", "sm")}>
            WhatsApp
          </a>
          <a href={`tel:+${tel}`} className={botonClases("secundario", "sm")}>
            Llamar
          </a>
        </div>
      )}

      {/* Las cifras en UNA tarjeta, con línea fina entre celdas. */}
      <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
        <Cifra etiqueta="Facturado" valor={cop(d.facturado)} plata />
        <Cifra
          etiqueta="Visitas"
          valor={String(d.visitas)}
          pie={cada !== null ? `viene cada ~${cada} ${cada === 1 ? "día" : "días"}` : undefined}
        />
        <Cifra etiqueta="Por visita" valor={d.visitas ? cop(Math.round(d.facturado / d.visitas)) : "—"} plata />
        <Cifra
          etiqueta="Última"
          valor={d.ultima ? fechaCorta(d.ultima) : "—"}
          pie={ultimaDias !== null ? haceTexto(ultimaDias) : undefined}
        />
      </div>

      {h.length > 0 && (
        <section className="mt-6">
          <p className="eyebrow mb-2">Lo de siempre</p>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line">
            <Siempre
              titulo="Su barbero"
              visual={
                barbero ? (
                  <CaraBarbero b={{ id: barbero.valor, nombre: barbero.valor, fotoUrl: fotoDe(barbero.valor) }} size={44} />
                ) : (
                  <IconTile tinte="local">
                    <StoreIcon />
                  </IconTile>
                )
              }
              valor={barbero?.valor ?? "El local"}
              pie={barbero ? deVisitas(barbero.veces) : "sin barbero"}
            />
            <Siempre
              titulo="Lo que pide"
              visual={
                <IconTile tinte="marca">
                  <ScissorsIcon />
                </IconTile>
              }
              valor={pide ? corto(pide.valor) : "—"}
              pie={pide ? `${pide.veces} ${pide.veces === 1 ? "vez" : "veces"}` : undefined}
            />
            <Siempre
              titulo="Paga con"
              visual={
                medio ? (
                  <MedioLogo slug={medio.valor} nombre={nombreMedio(medio.valor)} size={44} />
                ) : (
                  <IconTile tinte="plata">
                    <WalletIcon />
                  </IconTile>
                )
              }
              valor={medio ? nombreMedio(medio.valor) : "—"}
              pie={medio ? deVisitas(medio.veces) : undefined}
            />
          </div>
        </section>
      )}

      <section className="mt-6">
        <p className="eyebrow mb-2">Últimas visitas</p>
        {h.length ? (
          <ul className="divide-y divide-line/60 overflow-hidden rounded-2xl border border-line bg-panel">
            {h.slice(0, 3).map((v) => (
              <Visita key={v.id} v={v} nombreMedio={nombreMedio} hoy={hoy} />
            ))}
            {h.length > 3 && (
              <li>
                <button
                  type="button"
                  onClick={() => setAbierta("historial")}
                  className="flex min-h-12 w-full items-center justify-center gap-1 text-[13.5px] font-semibold text-accent-soft transition hover:bg-elevated/60"
                >
                  Ver las {h.length} visitas <ChevronRightIcon className="h-4 w-4" />
                </button>
              </li>
            )}
          </ul>
        ) : (
          <div className="rounded-2xl border border-line bg-panel">
            <EstadoVacio
              icono={<ReceiptIcon />}
              tinte="plata"
              titulo="Todavía no tiene visitas"
              texto="Cuando se le cobre con su nombre, aquí sale qué pidió, con quién y cuánto pagó."
            />
          </div>
        )}
      </section>

      {/* En escritorio, dos columnas de alto parejo: Agenda + Notas | Fidelidad + Opiniones. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="grid gap-6">
          <Grupo eyebrow="Agenda">
            <Fila
              icono={<CalendarIcon />}
              tinte="marca"
              titulo="Reservas"
              subtitulo={
                proxima
                  ? `Próxima: ${cuando(proxima.inicio)}`
                  : d.reservas.length
                    ? `${d.reservas.length} ${d.reservas.length === 1 ? "reserva" : "reservas"}, ninguna pendiente`
                    : "Nunca ha reservado"
              }
              onClick={() => setAbierta("reservas")}
            />
          </Grupo>

          <Grupo eyebrow="Notas">
            <NotaFicha clienteRef={d.id} nota={d.notasFicha} />
            <Fila
              icono={<BookIcon />}
              titulo="Bitácora"
              subtitulo={
                d.notas.length
                  ? `${d.notas.length} ${d.notas.length === 1 ? "nota" : "notas"} · la última del ${fecha(d.notas[0].fecha)}`
                  : "Notas con fecha: qué se habló, qué pidió"
              }
              onClick={() => setAbierta("notas")}
            />
          </Grupo>
        </div>

        <div className="grid gap-6">
          <Grupo eyebrow="Fidelidad">
            <Fila
              icono={<TicketIcon />}
              tinte="marca"
              titulo="Tarjeta de cortes"
              subtitulo={`${tarjeta.sellos} de ${tarjeta.tamano} sellos · ${d.puntosBalance} pts`}
              onClick={() => setAbierta("fidelidad")}
            />
            <Fila
              icono={<WalletIcon />}
              tinte="plata"
              titulo="Wallet"
              subtitulo={
                d.wallet.length
                  ? `${d.wallet.length} ${d.wallet.length === 1 ? "movimiento" : "movimientos"}`
                  : "Saldo que el cliente deja a favor"
              }
              valor={cop(d.walletBalance)}
              onClick={() => setAbierta("wallet")}
            />
          </Grupo>

          <Grupo eyebrow="Opiniones">
            <Fila
              icono={<UsersIcon />}
              tinte="equipo"
              titulo="Nota del staff"
              subtitulo={
                d.ratingProm !== null
                  ? `${d.ratingProm} de 5 · ${d.resenas.length} ${d.resenas.length === 1 ? "nota" : "notas"}`
                  : "Cómo es de cliente: puntualidad, trato"
              }
              onClick={() => setAbierta("resenas")}
            />
            <Fila
              icono={<StarIcon />}
              tinte="marca"
              titulo="Su opinión"
              subtitulo={
                promCalif !== null
                  ? `${promCalif} de 5 · ${d.calificaciones.length} ${d.calificaciones.length === 1 ? "visita calificada" : "visitas calificadas"}`
                  : "Todavía no califica sus visitas"
              }
              onClick={() => setAbierta("calificaciones")}
            />
          </Grupo>
        </div>
      </div>

      {abierta && (
        <Hoja titulo={TITULO[abierta]} onCerrar={() => setAbierta(null)}>
          <div className="pb-4">
            {abierta === "historial" && <HistorialTab d={d} nombreMedio={nombreMedio} hoy={hoy} />}
            {abierta === "reservas" && <ReservasTab d={d} />}
            {abierta === "fidelidad" && <FidelidadTab d={d} tarjeta={tarjeta} />}
            {abierta === "wallet" && <WalletTab d={d} />}
            {abierta === "notas" && <NotasTab d={d} />}
            {abierta === "resenas" && <ResenasTab d={d} barberos={barberos} />}
            {abierta === "calificaciones" && <CalificacionesTab d={d} />}
          </div>
        </Hoja>
      )}
    </div>
  );
}

function Cifra({ etiqueta, valor, pie, plata }: { etiqueta: string; valor: string; pie?: string; plata?: boolean }) {
  return (
    <div className="min-w-0 bg-panel px-4 py-3">
      <div className="eyebrow">{etiqueta}</div>
      <div className={`mt-1 font-display text-2xl font-semibold tabular-nums leading-tight text-ink ${plata ? "bb-monto" : ""}`}>
        {valor}
      </div>
      {pie && <div className="mt-0.5 text-[12px] text-muted">{pie}</div>}
    </div>
  );
}

function Siempre({ titulo, visual, valor, pie }: { titulo: string; visual: React.ReactNode; valor: string; pie?: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 bg-panel px-2 py-4 text-center">
      {visual}
      <span className="eyebrow mt-1.5">{titulo}</span>
      <span className="line-clamp-2 text-[14px] font-semibold leading-snug text-ink">{valor}</span>
      {pie && <span className="text-[12px] text-muted">{pie}</span>}
    </div>
  );
}

/** Una visita: el día en un cuadro, lo que se llevó (servicios rellenos, productos
 *  con borde), la cara de quién lo atendió y el logo de con qué pagó. */
function Visita({
  v,
  nombreMedio,
  hoy,
}: {
  v: Detalle["historial"][number];
  nombreMedio: (slug: string) => string;
  hoy: string;
}) {
  const f = new Date(v.fecha);
  const dia = f.toLocaleDateString("es-CO", { timeZone: ZONA, day: "numeric" });
  const mes = f.toLocaleDateString("es-CO", { timeZone: ZONA, month: "short" }).replace(".", "");
  const anio = bogotaYmd(f).slice(0, 4);
  const items = [...v.items].sort((a, b) => Number(b.tipo === "servicio") - Number(a.tipo === "servicio"));
  return (
    <li className="flex items-start gap-3 px-4 py-3.5">
      <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-elevated leading-none">
        <span className="font-display text-[20px] font-bold text-ink">{dia}</span>
        <span className="mt-1 text-[12px] font-semibold uppercase text-muted">
          {mes}
          {anio !== hoy.slice(0, 4) ? ` ${anio.slice(2)}` : ""}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <ul className="flex min-w-0 flex-wrap gap-1.5">
            {items.length ? (
              items.map((i, k) => (
                <li
                  key={k}
                  className={`rounded-full px-2.5 py-1 text-[12.5px] font-semibold leading-tight ${
                    i.tipo === "servicio" ? "bg-accent/12 text-ink" : "border border-line text-muted"
                  }`}
                >
                  {corto(i.nombre)}
                  {i.cantidad > 1 ? ` ×${i.cantidad}` : ""}
                </li>
              ))
            ) : (
              <li className="text-[13px] text-muted">Sin detalle</li>
            )}
          </ul>
          <span className="bb-monto shrink-0 font-display text-[17px] font-bold tabular-nums text-ink">{cop(v.total)}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted">
          {v.barbero && (
            <span className="inline-flex items-center gap-1.5">
              <CaraBarbero b={{ id: v.barbero, nombre: v.barbero, fotoUrl: v.barberoFoto }} size={22} />
              {v.barbero}
            </span>
          )}
          {v.medio && (
            <span className="inline-flex items-center gap-1.5">
              <MedioLogo slug={v.medio} nombre={nombreMedio(v.medio)} size={22} />
              {nombreMedio(v.medio)}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-line bg-panel px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

/** Nota FIJA de la ficha (clientes.notas): editable donde se lee. Distinta de la
 *  Bitácora (notas con fecha); acá va lo permanente (alergias, gustos). */
function NotaFicha({ clienteRef, nota }: { clienteRef: string; nota: string | null }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nota ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function guardar() {
    setBusy(true);
    setErr(null);
    const res = await actualizarNotaFicha({ clienteRef, nota: texto });
    setBusy(false);
    if (res.ok) {
      setEditando(false);
      router.refresh();
    } else setErr(res.error ?? "No se pudo guardar.");
  }

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => {
          setTexto(nota ?? "");
          setErr(null);
          setEditando(true);
        }}
        className="flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-elevated/60"
      >
        <IconTile>
          <PencilIcon />
        </IconTile>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">Nota de la ficha</span>
          {nota ? (
            <span className="mt-0.5 block whitespace-pre-line text-[13px] text-ink/85">{nota}</span>
          ) : (
            <span className="mt-0.5 block text-[13px] text-accent-soft">+ Agregar alergias, gustos, cómo le gusta el corte</span>
          )}
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-2 px-4 py-3">
      <p className="text-[15px] font-semibold text-ink">Nota de la ficha</p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={2}
        maxLength={500}
        autoFocus
        aria-label="Nota de la ficha"
        className={fld}
      />
      <p className="text-[12px] text-muted">Lo permanente (alergias, gustos). Lo del día a día va en la Bitácora.</p>
      {err && <p className="text-[12px] text-accent-soft">{err}</p>}
      <div className="flex gap-1.5">
        <button type="button" onClick={guardar} disabled={busy} className={btn}>
          {busy ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditando(false);
            setErr(null);
          }}
          className="rounded-full border border-line px-4 py-2 text-xs text-muted transition hover:text-ink"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function HistorialTab({
  d,
  nombreMedio,
  hoy,
}: {
  d: Detalle;
  nombreMedio: (slug: string) => string;
  hoy: string;
}) {
  if (!d.historial.length) return <Empty>Sin visitas registradas todavía.</Empty>;
  return (
    <ul className="divide-y divide-line/60 overflow-hidden rounded-2xl border border-line bg-panel">
      {d.historial.map((v) => (
        <Visita key={v.id} v={v} nombreMedio={nombreMedio} hoy={hoy} />
      ))}
    </ul>
  );
}

function ReservasTab({ d }: { d: Detalle }) {
  if (!d.reservas.length) return <Empty>Sin reservas registradas.</Empty>;
  return (
    <ul className="divide-y divide-line/60 overflow-hidden rounded-2xl border border-line bg-panel">
      {d.reservas.map((r) => (
        <li key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm">
          <CaraBarbero b={{ id: r.barbero, nombre: r.barbero, fotoUrl: r.barberoFoto }} size={36} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-ink">{r.servicio}</div>
            <div className="text-[13px] text-muted">
              {cuando(r.inicio)} · {r.barbero}
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide ${
              TONO_ESTADO[r.estado] ?? "bg-elevated text-muted"
            }`}
          >
            {ESTADO[r.estado] ?? r.estado}
          </span>
        </li>
      ))}
    </ul>
  );
}

function NotasTab({ d }: { d: Detalle }) {
  const router = useRouter();
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setOk(false);
    const res = await agregarNotaCliente({ clienteRef: d.id, nota });
    setBusy(false);
    if (res.ok) {
      setNota("");
      setOk(true);
      router.refresh();
    } else setErr(res.error ?? "Error");
  }

  return (
    <div>
      <form onSubmit={add} className="mb-5 space-y-2 rounded-2xl border border-line bg-panel p-4">
        {err && <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">{err}</div>}
        {ok && <div className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">Nota guardada ✓ — quedó abajo en la lista.</div>}
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Nota interna sobre el cliente (preferencias, alergias, etc.)"
          rows={2}
          className={fld}
        />
        <button disabled={busy} className={btn}>{busy ? "Guardando…" : "Agregar nota"}</button>
      </form>
      {!d.notas.length ? (
        <Empty>Sin notas todavía.</Empty>
      ) : (
        <div className="space-y-2">
          {d.notas.map((n) => (
            <NotaFila key={n.id} clienteRef={d.id} id={n.id} nota={n.nota} fechaTxt={fecha(n.fecha)} />
          ))}
        </div>
      )}
    </div>
  );
}

function WalletTab({ d }: { d: Detalle }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<"recarga" | "consumo">("recarga");
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setOk(null);
    const res = await agregarMovWallet({ clienteRef: d.id, tipo, monto: Number(monto) || 0, nota });
    setBusy(false);
    if (res.ok) {
      setOk(`${tipo === "recarga" ? "Recarga" : "Consumo"} de ${cop(Number(monto) || 0)} registrado ✓`);
      setMonto("");
      setNota("");
      router.refresh();
    } else setErr(res.error ?? "Error");
  }

  return (
    <div>
      <div className="mb-5 rounded-2xl border border-line bg-panel p-5">
        <div className="text-xs uppercase tracking-wide text-muted">Saldo a favor</div>
        <div className="bb-monto font-display text-3xl tabular-nums text-ink">{cop(d.walletBalance)}</div>
        <p className="mt-1 text-xs text-muted">Registro manual. No es un cobro: refleja el saldo que el cliente dejó a favor.</p>

        <form onSubmit={add} className="mt-4 space-y-2">
          {err && <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">{err}</div>}
          {ok && <div className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">{ok}</div>}
          <div className="flex gap-2">
            {(["recarga", "consumo"] as const).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setTipo(t)}
                className={`min-h-11 rounded-lg border px-3 text-xs transition ${tipo === t ? "border-accent bg-accent/10 text-ink" : "border-line text-muted"}`}
              >
                {t === "recarga" ? "Recarga (+)" : "Consumo (−)"}
              </button>
            ))}
          </div>
          <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Monto" className={fld} />
          <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional)" className={fld} />
          <button disabled={busy} className={btn}>{busy ? "Guardando…" : "Registrar movimiento"}</button>
        </form>
      </div>

      {!d.wallet.length ? (
        <Empty>Sin movimientos de wallet.</Empty>
      ) : (
        <div className="space-y-2">
          {d.wallet.map((w) => (
            <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-panel px-4 py-3 text-sm">
              <div className="min-w-0">
                <span className="capitalize">{w.tipo}</span>
                {w.nota ? <span className="text-muted"> · {w.nota}</span> : null}
                <div className="text-xs text-muted">{fecha(w.fecha)}</div>
              </div>
              <span className={`bb-monto shrink-0 ${w.tipo === "recarga" ? "text-ok" : "text-warn"}`}>
                {w.tipo === "recarga" ? "+" : "−"}{cop(w.monto)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FidelidadTab({ d, tarjeta }: { d: Detalle; tarjeta: TarjetaClienteView }) {
  const router = useRouter();
  const [puntos, setPuntos] = useState("");
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function canjear(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setOk(null);
    const res = await canjearPuntos({ clienteRef: d.id, puntos: Number(puntos) || 0, nota });
    setBusy(false);
    if (res.ok) {
      setOk(`Canje de ${Number(puntos) || 0} puntos registrado ✓`);
      setPuntos("");
      setNota("");
      router.refresh();
    } else setErr(res.error ?? "Error");
  }

  return (
    <div>
      {/* Tarjeta de cortes (solo lectura): sellos derivados de las ventas. */}
      <div className="mb-5 rounded-2xl border border-line bg-panel p-5">
        <div className="text-xs uppercase tracking-wide text-muted">Tarjeta de cortes</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          <span className="font-display text-3xl font-bold tabular-nums text-accent-soft">
            {tarjeta.sellos}/{tarjeta.tamano}
          </span>
          <span className="text-xs text-muted">
            · {tarjeta.tarjetasCompletas} completada{tarjeta.tarjetasCompletas === 1 ? "" : "s"}
            {tarjeta.proximo && (
              <>
                {" "}· próximo: {tarjeta.proximo.tipo === "regalo" ? "regalo" : tarjeta.proximo.tipo} en{" "}
                {tarjeta.proximo.faltan}
              </>
            )}
          </span>
        </div>
        {/* Los sellos como en la tarjeta de papel: lleno el que ya tiene. */}
        <div aria-hidden className="mt-3 flex flex-wrap gap-1.5">
          {Array.from({ length: tarjeta.tamano }, (_, i) => (
            <span key={i} className={`h-3.5 w-3.5 rounded-full ${i < tarjeta.sellos ? "bg-accent" : "bg-line"}`} />
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          {/* La regla ya no se escribe acá: la pone el dueño en Marketing → Tarjeta,
              y repetirla a mano garantizaba que un día dijera algo distinto. */}
          {tarjeta.cortesTotales} corte{tarjeta.cortesTotales === 1 ? "" : "s"} en total. Los premios se
          aplican solos al cobrar.
        </p>
      </div>

      <div className="mb-5 rounded-2xl border border-line bg-panel p-5">
        <div className="text-xs uppercase tracking-wide text-muted">Puntos de fidelidad</div>
        <div className="font-display text-3xl text-accent-soft">{d.puntosBalance} pts</div>
        <p className="mt-1 text-xs text-muted">Se ganan automáticamente al cobrar (1 punto por cada $1.000). Canjéalos por el premio que defina el negocio.</p>

        <form onSubmit={canjear} className="mt-4 space-y-2">
          {err && <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">{err}</div>}
          {ok && <div className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">{ok}</div>}
          <input type="number" value={puntos} onChange={(e) => setPuntos(e.target.value)} placeholder="Puntos a canjear" className={fld} />
          <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Premio / nota (ej. servicio gratis)" className={fld} />
          <button disabled={busy || d.puntosBalance <= 0} className={btn}>{busy ? "Guardando…" : "Canjear puntos"}</button>
        </form>
      </div>

      {!d.puntos.length ? (
        <Empty>Todavía no acumuló puntos.</Empty>
      ) : (
        <div className="space-y-2">
          {d.puntos.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-panel px-4 py-3 text-sm">
              <div className="min-w-0">
                <span className="capitalize">{p.tipo}</span>
                {p.nota ? <span className="text-muted"> · {p.nota}</span> : null}
                <div className="text-xs text-muted">{fecha(p.fecha)}</div>
              </div>
              <span className={`shrink-0 ${p.tipo === "ganado" ? "text-ok" : "text-muted"}`}>
                {p.tipo === "ganado" ? "+" : "−"}{p.puntos} pts
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Postventa: lo que EL CLIENTE opinó del servicio ("Su opinión", al revés de
// "Nota del staff", donde el staff califica al cliente). Solo lectura — se crea desde /cuenta.
function CalificacionesTab({ d }: { d: Detalle }) {
  if (!d.calificaciones.length) return <Empty>Este cliente todavía no calificó ninguna visita.</Empty>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">Cómo calificó el cliente sus visitas (postventa, últimas 10).</p>
      {d.calificaciones.map((c) => (
        <div key={c.id} className="rounded-xl border border-line bg-panel px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <Estrellas score={c.score} />
            <span className="text-xs text-muted">{fecha(c.fecha)}</span>
          </div>
          {c.comentario ? <div className="mt-1">{c.comentario}</div> : null}
          <div className="mt-1 text-xs text-muted">{c.barbero} · {c.sede}</div>
        </div>
      ))}
    </div>
  );
}

function ResenasTab({ d, barberos }: { d: Detalle; barberos: Barbero[] }) {
  const router = useRouter();
  const [score, setScore] = useState(5);
  const [barberoId, setBarberoId] = useState("");
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setOk(false);
    const res = await agregarResenaCliente({ clienteRef: d.id, barberoId, score, nota });
    setBusy(false);
    if (res.ok) {
      setNota("");
      setScore(5);
      setOk(true);
      router.refresh();
    } else setErr(res.error ?? "Error");
  }

  return (
    <div>
      <form onSubmit={add} className="mb-5 space-y-3 rounded-2xl border border-line bg-panel p-4">
        {err && <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">{err}</div>}
        {ok && <div className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">Reseña guardada ✓ — quedó abajo en la lista.</div>}
        <div className="text-xs uppercase tracking-wide text-muted">Calificar al cliente</div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => setScore(n)}
              aria-label={`${n} estrella${n === 1 ? "" : "s"}`}
              aria-pressed={score === n}
              className={`flex min-h-11 min-w-11 items-center justify-center p-1.5 text-2xl transition ${n <= score ? "text-accent" : "text-line"}`}
            >
              <StarIcon className="h-4 w-4 fill-current" />
            </button>
          ))}
        </div>
        {/* Con la cara de cada uno, como en el resto del staff. */}
        <ElegirBarbero
          barberos={barberos}
          value={barberoId}
          onChange={setBarberoId}
          placeholder="Barbero que atendió (opcional)"
          permitirVacio
          etiquetaVacio="Ninguno en particular"
        />
        <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Comentario (puntualidad, trato…)" className={fld} />
        <button disabled={busy} className={btn}>{busy ? "Guardando…" : "Guardar reseña"}</button>
      </form>

      {!d.resenas.length ? (
        <Empty>Sin reseñas todavía.</Empty>
      ) : (
        <div className="space-y-2">
          {d.resenas.map((r) => (
            <div key={r.id} className="rounded-xl border border-line bg-panel px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <Estrellas score={r.score} />
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted">{fecha(r.fecha)}</span>
                  <BorrarChico
                    label="reseña"
                    onBorrar={() => borrarResenaCliente({ id: r.id, clienteRef: d.id })}
                  />
                </span>
              </div>
              {r.nota ? <div className="mt-1">{r.nota}</div> : null}
              {r.barbero ? <div className="mt-1 text-xs text-muted">por {r.barbero}</div> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Borrar con confirmación de dos toques (patrón "Quitar foto"): el primero
 *  pregunta en warn, el segundo ejecuta. Al perder el foco se desarma. */
function BorrarChico({ label, onBorrar }: { label: string; onBorrar: () => Promise<{ ok: boolean; error?: string }> }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function click() {
    if (!confirmando) {
      setConfirmando(true);
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await onBorrar();
    setBusy(false);
    setConfirmando(false);
    if (res.ok) router.refresh();
    else setErr(res.error ?? "No se pudo borrar.");
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {err && <span className="text-[12px] text-accent-soft">{err}</span>}
      <button
        type="button"
        onClick={click}
        onBlur={() => setConfirmando(false)}
        disabled={busy}
        className={`min-h-8 rounded-full border px-2.5 text-[12px] font-semibold transition disabled:opacity-50 ${
          confirmando ? "border-warn/50 text-warn" : "border-line text-muted hover:text-ink"
        }`}
      >
        {busy ? "Borrando…" : confirmando ? "¿Seguro? Toca de nuevo" : `Borrar ${label}`}
      </button>
    </span>
  );
}

/** Fila de nota interna con editar inline + borrar: un tipeo mal ya no queda
 *  para siempre en la ficha. */
function NotaFila({ clienteRef, id, nota, fechaTxt }: { clienteRef: string; id: string; nota: string; fechaTxt: string }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nota);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function guardar() {
    setBusy(true);
    setErr(null);
    const res = await editarNotaCliente({ id, clienteRef, nota: texto });
    setBusy(false);
    if (res.ok) {
      setEditando(false);
      router.refresh();
    } else setErr(res.error ?? "No se pudo guardar.");
  }

  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3 text-sm">
      {editando ? (
        <div className="space-y-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={2}
            autoFocus
            className={fld}
          />
          {err && <p className="text-[12px] text-accent-soft">{err}</p>}
          <div className="flex gap-1.5">
            <button type="button" onClick={guardar} disabled={busy} className={btn}>
              {busy ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditando(false);
                setTexto(nota);
                setErr(null);
              }}
              className="rounded-full border border-line px-4 py-2 text-xs text-muted transition hover:text-ink"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <div>{nota}</div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="text-xs text-muted">{fechaTxt}</span>
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="min-h-8 rounded-full border border-line px-2.5 text-[12px] font-semibold text-muted transition hover:text-ink"
              >
                Editar <PencilIcon className="h-3.5 w-3.5" />
              </button>
              <BorrarChico label="nota" onBorrar={() => borrarNotaCliente({ id, clienteRef })} />
            </span>
          </div>
        </>
      )}
    </div>
  );
}

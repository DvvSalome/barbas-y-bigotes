"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setearPinBarbero, desbloquearBarbero } from "@/lib/barbero-auth";
import { actualizarPerfilBarbero, guardarEmailBarbero, probarCorreoBarbero } from "@/lib/actions";
import { crearAccesoBarbero, actualizarFichaBarbero, cargarResumenBaja, reactivarBarbero, terminarBajaBarbero } from "@/lib/equipo-actions";
import { compartirAgendaDeBarbero, quitarAgendaDeExBarbero } from "@/lib/calendar-actions";
import { partirEspecialidades, MAX_ESPECIALIDADES } from "@/lib/admin-reglas";
import {
  checklistBarbero,
  resumenChecklist,
  encabezadoFicha,
  etiquetaInsignia,
  esPinValido,
  ERROR_PIN,
  type DatosChecklist,
  type PuntoChecklist,
} from "@/lib/equipo-reglas";
import { fechaCortaBogota } from "@/lib/format";
import { botonClases } from "@/components/ui/Boton";
import { Campo, CampoArea } from "@/components/ui/Campo";
import { Hoja, PieHoja, primarioDeHoja } from "@/components/ui/Hoja";
import { Grupo, Fila } from "@/components/ui/ListaAgrupada";
import { Segmentado } from "@/components/ui/Segmentado";
import { Plegable } from "@/components/ui/Plegable";
import { Switch } from "@/components/admin/Switch";
import { ContratoEditable } from "@/components/admin/ContratoEditable";
import { FotoBarbero } from "@/components/admin/FotoBarbero";
import { PasarCitas } from "@/components/admin/PasarCitas";
import { BajaBarbero } from "@/components/admin/BajaBarbero";
import { AgregarBarbero } from "@/components/admin/AgregarBarbero";
import { CaraBarbero } from "@/components/staff/Elegir";
import { CheckIcon, AlertIcon } from "@/components/icons";
import type { Sede } from "@/lib/data/types";
import type { CalendarEstado, FichaBarbero, ResumenBaja } from "@/lib/data/queries";

/*
  UNA FICHA POR BARBERO (paso 20 de la tanda 2), ahora con su alta y su baja
  (pedido del dueño, 14-oct: "que todo sea autogestionable, por si más adelante
  tienen otros barberos").

  · La fila de cada uno dice "Listo" o "Le faltan N: …" con el checklist entero
    (acceso, PIN, foto, contrato, correo, agenda, avisos en el celular, primer
    ingreso), no solo PIN/correo/agenda como antes.
  · En su hoja, arriba, ese checklist con el botón que lo arregla; debajo, cada
    cosa editable: datos (nombre, sede, posición, destacado), foto, PIN, correo,
    agenda, contrato y perfil. Al final, "Dar de baja", en tres pasos.
  · Abajo de todo, plegado, «Ya no trabajan aquí» con "Reactivar".

  Las cosas del LOCAL (el PIN del mostrador, lo que ve el equipo, las agendas de
  Google, las ausencias) siguen en su propio grupo, arriba (EquipoLocal).
*/

type EstadoPin = Record<string, { tienePin: boolean; bloqueado: boolean }>;

/** Lo que mide el checklist para un barbero, con lo que llega a la página. */
function datosDe(b: FichaBarbero, estado: EstadoPin, email: string | undefined, calendar: CalendarEstado): DatosChecklist {
  const e = estado[b.id];
  return {
    acceso: b.acceso,
    pin: { tiene: !!e?.tienePin, bloqueado: !!e?.bloqueado },
    foto: !!b.fotoUrl,
    contrato: b.contrato,
    correo: email || null,
    correoProbado: b.correoProbado,
    // Sin Google configurado, "sin agenda" sería un reproche que nadie puede arreglar desde acá.
    agenda: calendar.configurado
      ? { creada: !!calendar.agendas[b.id], compartidaCon: calendar.agendas[b.id]?.compartidoCon ?? null }
      : null,
    aparatos: b.aparatos,
    ultimoIngreso: b.ultimoIngreso,
  };
}

export function EquipoFichas({
  barberos,
  inactivos,
  sedes,
  estado,
  emails,
  calendar,
  ausentesHoy = [],
  fichaInicial = null,
}: {
  barberos: FichaBarbero[];
  inactivos: FichaBarbero[];
  sedes: Sede[];
  estado: EstadoPin;
  emails: Record<string, string>;
  calendar: CalendarEstado;
  /** Ids de los que NO vienen hoy: se marca en su fila. */
  ausentesHoy?: string[];
  /** ?ficha=<id>: el Inicio manda directo a la ficha del que le falta algo. */
  fichaInicial?: string | null;
}) {
  const router = useRouter();
  const [abiertoId, setAbiertoId] = useState<string | null>(fichaInicial);
  // La baja y la reactivación guardan una FOTO del barbero, no su id: al terminar
  // se refresca la página y el barbero cambia de lista; si se buscara por id, la
  // hoja desaparecería justo cuando dice qué se hizo.
  const [bajaDe, setBajaDe] = useState<FichaBarbero | null>(null);
  const [aReactivar, setAReactivar] = useState<FichaBarbero | null>(null);
  const abierto = barberos.find((b) => b.id === abiertoId) ?? null;
  const sedeNombre = (id: string) => sedes.find((s) => s.id === id)?.nombre ?? id;
  const posicionDe = (b: FichaBarbero) => barberos.filter((x) => x.sede === b.sede).findIndex((x) => x.id === b.id) + 1;

  function cerrarFicha() {
    setAbiertoId(null);
    // Si vino del Inicio con ?ficha=, se limpia: si no, al refrescar se abría sola.
    if (fichaInicial) router.replace("/admin/equipo", { scroll: false });
  }

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Barberos</p>
          <p className="mt-1 text-[12.5px] text-muted">
            {barberos.length === 1 ? "1 trabajando" : `${barberos.length} trabajando`}
            {inactivos.length ? ` · ${inactivos.length} ya no ${inactivos.length === 1 ? "trabaja" : "trabajan"} aquí` : ""}
          </p>
        </div>
        <AgregarBarbero sedes={sedes} onCreado={(id) => setAbiertoId(id)} />
      </div>

      {sedes.map((s) => {
        const lista = barberos.filter((b) => b.sede === s.id);
        if (!lista.length) return null;
        return (
          <Grupo key={s.id} eyebrow={s.nombre} className="mt-4">
            {lista.map((b) => {
              const r = resumenChecklist(checklistBarbero(datosDe(b, estado, emails[b.id], calendar)));
              return (
                <Fila
                  key={b.id}
                  onClick={() => setAbiertoId(b.id)}
                  icono={<CaraBarbero b={b} size={44} />}
                  titulo={b.nombre}
                  subtitulo={ausentesHoy.includes(b.id) ? `Hoy no viene · ${r.subtitulo}` : r.subtitulo}
                  // En ámbar solo lo que le impide trabajar hoy (no entra o no se
                  // entera de sus citas): si contara todo, las seis filas
                  // saldrían en ámbar y taparía al que de verdad está bloqueado.
                  // La etiqueta dice qué cuenta: al lado de "Le faltan 4", un "1"
                  // suelto no se entendía.
                  badge={r.bloquean || undefined}
                  badgeEtiqueta={r.bloquean ? etiquetaInsignia(r.bloquean) : undefined}
                />
              );
            })}
          </Grupo>
        );
      })}

      {inactivos.length > 0 && (
        <Plegable
          titulo="Ya no trabajan aquí"
          subtitulo={`${inactivos.length} · no salen en la web ni pueden entrar. Si alguno vuelve, reactívalo.`}
          className="mt-8"
        >
          <div className="overflow-hidden rounded-2xl border border-line bg-panel divide-y divide-line/60">
            {inactivos.map((b) => (
              <Fila
                key={b.id}
                onClick={() => setAReactivar(b)}
                icono={
                  <span className="grayscale opacity-70">
                    <CaraBarbero b={b} size={44} />
                  </span>
                }
                titulo={b.nombre}
                subtitulo={
                  calendar.agendas[b.id]?.compartidoCon
                    ? "Todavía ve su agenda de Google · toca para quitársela"
                    : `Era de ${sedeNombre(b.sede)} · toca para reactivarlo`
                }
                badge={calendar.agendas[b.id]?.compartidoCon ? 1 : undefined}
                badgeEtiqueta={calendar.agendas[b.id]?.compartidoCon ? "Todavía ve su agenda de Google" : undefined}
              />
            ))}
          </div>
        </Plegable>
      )}

      {abierto && (
        <HojaBarbero
          key={abierto.id}
          b={abierto}
          posicionActual={posicionDe(abierto)}
          sedes={sedes}
          porSede={Object.fromEntries(sedes.map((s) => [s.id, barberos.filter((x) => x.sede === s.id).length]))}
          estado={estado[abierto.id]}
          email={emails[abierto.id] ?? ""}
          calendar={calendar}
          puntos={checklistBarbero(datosDe(abierto, estado, emails[abierto.id], calendar), fechaCortaBogota)}
          onCerrar={cerrarFicha}
          onBaja={() => {
            setBajaDe(abierto);
            setAbiertoId(null);
          }}
        />
      )}

      {bajaDe && (
        <BajaBarbero
          barberoId={bajaDe.id}
          nombre={bajaDe.nombre}
          sedeNombre={sedeNombre(bajaDe.sede)}
          onCerrar={() => {
            setBajaDe(null);
            if (fichaInicial) router.replace("/admin/equipo", { scroll: false });
          }}
        />
      )}

      {aReactivar && (
        <HojaReactivar
          b={aReactivar}
          sedeNombre={sedeNombre(aReactivar.sede)}
          email={emails[aReactivar.id] ?? ""}
          agendaCon={calendar.configurado ? (calendar.agendas[aReactivar.id]?.compartidoCon ?? null) : null}
          onCerrar={() => setAReactivar(null)}
        />
      )}
    </>
  );
}

function Bloque({ id, titulo, children }: { id?: string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-5 scroll-mt-4 border-t border-line/60 pt-4 first:mt-0 first:border-t-0 first:pt-0">
      <p className="eyebrow mb-2.5">{titulo}</p>
      {children}
    </section>
  );
}

/** Lo que respondió una acción, en el bloque que la generó (con un solo aviso arriba, a ~1.100 px, no se veía). */
type MsgBloque = { bloque: string; text: string; ok: boolean } | null;

function Mensaje({ msg, bloque }: { msg: MsgBloque; bloque: string }) {
  if (!msg || msg.bloque !== bloque) return null;
  return (
    <p
      role={msg.ok ? "status" : "alert"}
      className={`mt-2.5 rounded-xl border px-3 py-2 text-[12.5px] ${
        msg.ok ? "border-ok/40 bg-ok/10 text-ok" : "border-warn/40 bg-warn/[0.08] font-semibold text-warn"
      }`}
    >
      {msg.text}
    </p>
  );
}

/** A qué bloque de la hoja lleva cada punto del checklist. */
const BLOQUE: Partial<Record<PuntoChecklist["clave"], string>> = {
  pin: "ficha-pin",
  foto: "ficha-foto",
  contrato: "ficha-contrato",
  correo: "ficha-correo",
  agenda: "ficha-agenda",
};

function HojaBarbero({
  b,
  posicionActual,
  sedes,
  porSede,
  estado,
  email,
  calendar,
  puntos,
  onCerrar,
  onBaja,
}: {
  b: FichaBarbero;
  /** Su lugar HOY en la web dentro de su sede (1 = primero). */
  posicionActual: number;
  sedes: Sede[];
  /** Cuántos activos hay en cada sede (para la posición en la web). */
  porSede: Record<string, number>;
  estado: { tienePin: boolean; bloqueado: boolean } | undefined;
  email: string;
  calendar: CalendarEstado;
  puntos: PuntoChecklist[];
  onCerrar: () => void;
  onBaja: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<MsgBloque>(null);
  const lugar = Math.max(1, posicionActual);

  // Datos
  const [nombre, setNombre] = useState(b.nombre);
  const [sedeId, setSedeId] = useState<string>(b.sede);
  const [posicion, setPosicion] = useState(String(lugar));
  const [destacado, setDestacado] = useState(!!b.destacado);
  const [citasSede, setCitasSede] = useState<ResumenBaja | null>(null);
  const cambiaSede = sedeId !== b.sede;
  const totalEnSede = (porSede[sedeId] ?? 0) + (cambiaSede ? 1 : 0);
  const datosCambiados =
    nombre.trim() !== b.nombre || cambiaSede || Number(posicion) !== lugar || destacado !== !!b.destacado;

  // PIN
  const [pin, setPin] = useState("");
  const [editandoPin, setEditandoPin] = useState(false);

  // Correo de avisos
  const [correo, setCorreo] = useState(email);
  const correoCambiado = correo.trim() !== email;

  // Perfil
  const [bio, setBio] = useState(b.bio ?? "");
  const [esp, setEsp] = useState(b.especialidades.join("\n"));
  const perfilCambiado = bio !== (b.bio ?? "") || esp !== b.especialidades.join("\n");

  const agenda = calendar.agendas[b.id];
  const encabezado = encabezadoFicha(puntos);
  const primero = b.nombre.split(" ")[0];

  async function correr(id: string, bloque: string, fn: () => Promise<{ ok: boolean; error?: string; aviso?: string }>) {
    setBusy(id);
    setMsg(null);
    const res = await fn().catch(() => null);
    setBusy(null);
    if (res?.ok) {
      setMsg({ bloque, text: res.aviso ?? "Listo.", ok: true });
      router.refresh();
    } else {
      setMsg({ bloque, text: res?.error ?? "No se pudo. Revisa la conexión.", ok: false });
    }
    return res;
  }

  const ir = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  async function verCitasSede() {
    const r = await cargarResumenBaja(b.id).catch(() => null);
    if (r?.ok) setCitasSede(r.resumen);
    else setMsg({ bloque: "datos", text: r && !r.ok ? r.error : "No se pudieron leer sus citas.", ok: false });
  }

  return (
    <Hoja titulo={b.nombre} onCerrar={onCerrar} ancho="max-w-lg">
      <div className="flex items-center gap-4 pb-4">
        <CaraBarbero b={b} size={64} aro />
        <div className="min-w-0">
          {/* Por lo que le IMPIDE trabajar, no por todo lo que falta: "le faltan 3
              cosas para trabajar" a quien ya atiende con la app asustaba de más. */}
          <p
            className={`text-[13.5px] font-semibold ${
              encabezado.tono === "bloquea" ? "text-warn" : encabezado.tono === "listo" ? "text-ok" : "text-ink"
            }`}
          >
            {encabezado.texto}
          </p>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {sedes.find((s) => s.id === b.sede)?.nombre}
            {b.especialidades.length ? ` · ${b.especialidades.slice(0, 3).join(" · ")}` : ""}
          </p>
        </div>
      </div>

      <Bloque titulo="Para trabajar con la app">
        <ul className="overflow-hidden rounded-2xl border border-line bg-panel divide-y divide-line/60">
          {puntos.map((p) => (
            <li key={p.clave} className="flex items-start gap-3 px-3 py-2.5">
              <span
                aria-hidden
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                  p.estado === "ok" ? "bg-ok/15 text-ok" : p.estado === "falta" ? "bg-warn/15 text-warn" : "bg-elevated text-muted"
                }`}
              >
                {p.estado === "ok" ? <CheckIcon className="h-3 w-3" /> : <AlertIcon className="h-3 w-3" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[13.5px] font-semibold ${p.estado === "ok" ? "text-ink/80" : "text-ink"}`}>
                  <span className="sr-only">{p.estado === "ok" ? "Listo: " : p.estado === "falta" ? "Falta: " : "Ojo: "}</span>
                  {p.titulo}
                </span>
                {p.estado !== "ok" && <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">{p.detalle}</span>}
                {p.estado !== "ok" && p.clave === "acceso" && (
                  <button
                    type="button"
                    onClick={() => correr("acceso", "checklist", () => crearAccesoBarbero(b.id))}
                    disabled={busy !== null}
                    className={`${botonClases("primario", "sm")} mt-2`}
                  >
                    {busy === "acceso" ? "Creando…" : "Crear acceso"}
                  </button>
                )}
                {p.estado !== "ok" && p.clave === "agenda" && email && (
                  <button
                    type="button"
                    onClick={() => correr("agenda", "checklist", () => compartirAgendaDeBarbero(b.id))}
                    disabled={busy !== null}
                    className={`${botonClases("secundario", "sm")} mt-2`}
                  >
                    {busy === "agenda" ? "Compartiendo…" : "Compartir su agenda"}
                  </button>
                )}
                {p.estado !== "ok" && BLOQUE[p.clave] && !(p.clave === "agenda" && email) && (
                  <button
                    type="button"
                    // Sin correo, la agenda no tiene a quién compartirse: va al correo.
                    onClick={() => ir(p.clave === "agenda" ? "ficha-correo" : (BLOQUE[p.clave] as string))}
                    className="mt-1 inline-flex min-h-10 items-center text-[12.5px] font-semibold text-ink/85 underline decoration-line underline-offset-4 hover:text-ink"
                  >
                    {p.clave === "agenda" ? "Poner su correo" : "Arreglarlo aquí abajo"}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
        <Mensaje msg={msg} bloque="checklist" />
      </Bloque>

      <Bloque id="ficha-datos" titulo="Sus datos">
        <div className="grid gap-3">
          <Campo
            id={`nombre-${b.id}`}
            etiqueta="Nombre"
            value={nombre}
            maxLength={60}
            onChange={(e) => setNombre(e.target.value)}
            ayuda="Como lo conocen los clientes: sale así en la web, al reservar y en su app."
          />
          <div>
            <p className="mb-1.5 px-1 text-[12px] font-medium text-muted">Sede de siempre</p>
            <Segmentado
              etiqueta="Sede de siempre"
              opciones={sedes.map((s) => ({ valor: s.id as string, texto: s.nombre }))}
              valor={sedeId}
              onCambio={(v) => {
                setSedeId(v);
                setCitasSede(null);
                // En la sede nueva entra al final; en la suya, vuelve a su lugar.
                setPosicion(String(v === b.sede ? lugar : (porSede[v] ?? 0) + 1));
              }}
            />
            {cambiaSede && (
              <p className="mt-1.5 px-1 text-[12px] text-muted">
                Para cubrir solo un día no hace falta cambiarlo: eso se hace en el mostrador, en «Equipo de hoy».
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor={`posicion-${b.id}`} className="text-[13px] text-ink">
              Lugar en la web
            </label>
            <select
              id={`posicion-${b.id}`}
              value={posicion}
              onChange={(e) => setPosicion(e.target.value)}
              className="min-h-11 rounded-xl border border-line bg-bg px-3 text-[14px] text-ink focus:border-ink/60 focus:outline-none"
            >
              {Array.from({ length: Math.max(1, totalEnSede) }, (_, i) => (
                <option key={i + 1} value={String(i + 1)}>
                  {i === 0 ? "1 · el primero" : String(i + 1)}
                </option>
              ))}
            </select>
            <span className="text-[12px] text-muted">de {Math.max(1, totalEnSede)} en su sede</span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-panel px-3 py-2">
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold text-ink">Destacado en la web</span>
              <span className="block text-[12px] text-muted">Sale con la marca «Top» en la web y al reservar.</span>
            </span>
            <Switch checked={destacado} onChange={setDestacado} label={`Destacar a ${primero} en la web`} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                const r = await correr("datos", "datos", () =>
                  actualizarFichaBarbero({ barberoId: b.id, nombre, sedeId, posicion: Number(posicion), destacado }),
                );
                if (r && !r.ok && "citasEnSedeVieja" in r && r.citasEnSedeVieja) await verCitasSede();
              }}
              disabled={busy !== null || !datosCambiados || nombre.trim().length < 2}
              className={botonClases("primario", "md")}
            >
              {busy === "datos" ? "…" : "Guardar datos"}
            </button>
            {datosCambiados && <span className="text-[12px] text-warn">sin guardar</span>}
          </div>
          <Mensaje msg={msg} bloque="datos" />
          {citasSede && citasSede.citas.length > 0 && (
            <div className="rounded-2xl border border-warn/35 bg-warn/[0.05] p-3">
              <p className="mb-2 text-[13px] font-semibold text-ink">Sus citas por delante en {sedes.find((s) => s.id === b.sede)?.nombre}</p>
              <PasarCitas
                citas={citasSede.citas}
                destinos={citasSede.destinos}
                sedeNombre={sedes.find((s) => s.id === b.sede)?.nombre ?? ""}
                onCambio={() => void verCitasSede()}
                salida="Pásala a otro de allá o cámbiale la hora en la Agenda; después vuelve a cambiar la sede."
              />
            </div>
          )}
          {citasSede && citasSede.citas.length === 0 && (
            <p className="text-[12.5px] text-ok">Ya no tiene citas por delante allá: vuelve a tocar «Guardar datos».</p>
          )}
        </div>
      </Bloque>

      <Bloque id="ficha-foto" titulo="Su foto">
        <FotoBarbero barberoId={b.id} nombre={b.nombre} fotoUrl={b.fotoUrl ?? null} onMensaje={(m) => setMsg({ bloque: "foto", ...m })} />
        <Mensaje msg={msg} bloque="foto" />
      </Bloque>

      <Bloque id="ficha-pin" titulo="Su PIN para entrar">
        {!editandoPin ? (
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide ${
                estado?.bloqueado ? "bg-warn/15 text-warn" : estado?.tienePin ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn"
              }`}
            >
              {estado?.bloqueado ? "Bloqueado" : estado?.tienePin ? "PIN listo" : "Sin PIN"}
            </span>
            <button
              type="button"
              onClick={() => {
                setEditandoPin(true);
                setPin("");
                setMsg(null);
              }}
              className={botonClases(estado?.tienePin ? "secundario" : "primario", "md")}
            >
              {estado?.tienePin ? "Cambiar PIN" : "Poner PIN"}
            </button>
            {estado?.bloqueado && (
              <button
                type="button"
                onClick={() => correr("desbloquear", "pin", () => desbloquearBarbero(b.id))}
                disabled={busy !== null}
                className={botonClases("secundario", "md")}
              >
                {busy === "desbloquear" ? "…" : "Desbloquear"}
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={pin}
              onChange={(ev) => setPin(ev.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoFocus
              placeholder="6 dígitos"
              aria-label="Nuevo PIN de 6 dígitos"
              className="min-h-11 w-36 rounded-xl border border-accent/60 bg-bg px-3 text-center text-[15px] tracking-[0.3em] text-ink placeholder:text-muted placeholder:tracking-normal focus:outline-none"
            />
            <button
              type="button"
              onClick={async () => {
                const r = await correr("pin", "pin", () => setearPinBarbero(b.id, pin));
                if (r?.ok) {
                  setEditandoPin(false);
                  setPin("");
                }
              }}
              // La MISMA regla que el alta y la reactivación: un PIN fácil no se
              // deja ni intentar (antes el servidor lo rechazaba y el aviso salía
              // arriba, fuera de la vista: el dueño le daba un PIN que no se guardó).
              disabled={busy !== null || !esPinValido(pin)}
              className={botonClases("primario", "md")}
            >
              {busy === "pin" ? "…" : "Guardar PIN"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditandoPin(false);
                setPin("");
              }}
              className="inline-flex min-h-11 items-center px-2 text-[13px] text-muted transition hover:text-ink"
            >
              Cancelar
            </button>
          </div>
        )}
        {editandoPin && pin.length === 6 && !esPinValido(pin) && <p className="mt-2 text-[12px] text-warn">{ERROR_PIN}</p>}
        <Mensaje msg={msg} bloque="pin" />
        <p className="mt-2 text-[12px] text-muted">El PIN no se puede ver, solo cambiar. Díselo en persona.</p>
      </Bloque>

      <Bloque id="ficha-correo" titulo="Correo de avisos">
        <Campo
          id={`correo-${b.id}`}
          etiqueta="Correo del barbero"
          type="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          ayuda={email ? "Le llega un correo apenas un cliente le reserva." : "Sin correo no le llega ningún aviso de cita."}
        />
        {/* Probar ANTES de guardar (pedido del dueño, 8-sep): manda el aviso de
            prueba por el mismo camino del real, sin tocar lo guardado. */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => correr("probar", "correo", () => probarCorreoBarbero(b.id, correo.trim()))}
            disabled={busy !== null || !correo.trim()}
            className={botonClases("secundario", "md")}
          >
            {busy === "probar" ? "Enviando…" : "Probar"}
          </button>
          <button
            type="button"
            onClick={() => correr("correo", "correo", () => guardarEmailBarbero(b.id, correo.trim()))}
            disabled={busy !== null || !correoCambiado}
            className={botonClases("primario", "md")}
          >
            {busy === "correo" ? "…" : "Guardar correo"}
          </button>
          {correoCambiado && <span className="text-[12px] text-warn">sin guardar</span>}
        </div>
        <Mensaje msg={msg} bloque="correo" />
      </Bloque>

      {calendar.configurado && (
        <Bloque id="ficha-agenda" titulo="Su agenda de Google">
          <p className="text-[13px] text-muted">
            {agenda?.compartidoCon
              ? `Compartida con ${agenda.compartidoCon}. La ve en su Google Calendar, con recordatorios.`
              : email
                ? `${agenda ? "Creada, falta compartirla" : "Todavía no tiene"}. Se le comparte a ${email}: le llega un correo de Google para aceptarla.`
                : "Sin correo de avisos no hay con quién compartirla. Pon el correo aquí arriba."}
          </p>
          {!agenda?.compartidoCon && email && (
            <button
              type="button"
              onClick={() => correr("agenda", "agenda", () => compartirAgendaDeBarbero(b.id))}
              disabled={busy !== null}
              className={`${botonClases("secundario", "md")} mt-2.5`}
            >
              {busy === "agenda" ? "Compartiendo…" : "Compartir su agenda"}
            </button>
          )}
          <Mensaje msg={msg} bloque="agenda" />
        </Bloque>
      )}

      <Bloque id="ficha-contrato" titulo="Su contrato">
        <ContratoEditable
          barberoId={b.id}
          nombre={b.nombre}
          tipo={b.contrato.tipo}
          comisionPct={b.contrato.comisionPct ?? undefined}
          arriendoMensual={b.contrato.arriendoMensual ?? undefined}
        />
        <p className="mt-1.5 text-[12px] text-muted">Aplica desde el próximo cobro; lo ya cobrado no se recalcula.</p>
      </Bloque>

      <Bloque titulo="Perfil que ve el cliente">
        <CampoArea
          id={`bio-${b.id}`}
          etiqueta="Bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          ayuda="Sale en su ficha del sitio público. Opcional."
        />
        <CampoArea
          id={`esp-${b.id}`}
          etiqueta="Especialidades"
          className="mt-3"
          value={esp}
          onChange={(e) => setEsp(e.target.value)}
          placeholder={"Fade\nBarba\nDiseños"}
          ayuda={`Una por línea o separadas por coma · máximo ${MAX_ESPECIALIDADES}.`}
        />
        <button
          type="button"
          onClick={() =>
            // El MISMO partido que usa el servidor (admin-reglas): si el cliente
            // separara distinto, el admin vería una cosa y se guardaría otra.
            correr("perfil", "perfil", () => actualizarPerfilBarbero({ barberoId: b.id, bio, especialidades: partirEspecialidades(esp) }))
          }
          disabled={busy !== null || !perfilCambiado}
          className={`${botonClases("primario", "md")} mt-3`}
        >
          {busy === "perfil" ? "…" : "Guardar perfil"}
        </button>
        <Mensaje msg={msg} bloque="perfil" />
      </Bloque>

      <Bloque titulo="Si deja de trabajar aquí">
        <p className="text-[12.5px] leading-relaxed text-muted">
          Se le cierra todo: la web, su PIN, su sesión en el celular, sus avisos y su agenda. Antes te muestra sus citas por delante para
          pasárselas a otro, y lo que se le debe de la semana. Su plata y su historial se quedan.
        </p>
        <button type="button" onClick={onBaja} className={`${botonClases("peligro", "md")} mt-3`}>
          Dar de baja a {primero}
        </button>
      </Bloque>
      <div className="h-4" />
    </Hoja>
  );
}

function HojaReactivar({
  b,
  sedeNombre,
  email,
  agendaCon,
  onCerrar,
}: {
  b: FichaBarbero;
  sedeNombre: string;
  /** El correo de avisos que tenía: se conserva al reactivarlo, salvo que el dueño lo quite. */
  email: string;
  /** Si al darlo de baja Google no dejó quitarle la agenda, sigue compartida con este correo. */
  agendaCon: string | null;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [quitarCorreo, setQuitarCorreo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const [agenda, setAgenda] = useState<{ busy: boolean; msg: string | null; ok: boolean }>({ busy: false, msg: null, ok: false });
  const [cierre, setCierre] = useState<{ busy: boolean; msg: string | null; ok: boolean }>({ busy: false, msg: null, ok: false });

  // Si al darlo de baja algo quedó abierto (Google, Auth o la red fallaron), el
  // aviso de ese momento se cerró: acá queda el mismo "reintentar" para siempre.
  async function cerrarDeNuevo() {
    setCierre({ busy: true, msg: null, ok: false });
    const r = await terminarBajaBarbero(b.id).catch(() => null);
    const quedan = r?.pendientes ?? [];
    setCierre({
      busy: false,
      ok: !!r?.ok && !quedan.length,
      msg: !r?.ok ? (r?.error ?? "No se pudo. Revisa la conexión.") : quedan.length ? `Todavía falta: ${quedan.join(" ")}` : "Listo: no le queda nada abierto.",
    });
    if (r?.ok) router.refresh();
  }
  const primero = b.nombre.split(" ")[0];

  async function quitarAgenda() {
    setAgenda({ busy: true, msg: null, ok: false });
    const r = await quitarAgendaDeExBarbero(b.id).catch(() => null);
    setAgenda({ busy: false, msg: r?.ok ? (r.aviso ?? "Listo.") : (r?.error ?? "No se pudo."), ok: !!r?.ok });
    if (r?.ok) router.refresh();
  }

  async function reactivar() {
    setEnviando(true);
    setError(null);
    const r = await reactivarBarbero({ barberoId: b.id, pin, quitarCorreo }).catch(() => null);
    setEnviando(false);
    if (r?.ok) {
      setHecho(r.aviso ?? `${primero} volvió.`);
      router.refresh();
    } else setError(r?.error ?? "No se pudo. Revisa la conexión e intenta de nuevo.");
  }

  // Mientras corre en el servidor, cerrar no la frena: la hoja no se deja cerrar.
  const cerrar = () => {
    if (!enviando) onCerrar();
  };

  return (
    <Hoja
      titulo={hecho ? `${primero} volvió` : `Reactivar a ${primero}`}
      onCerrar={cerrar}
      ancho="max-w-md"
      pie={
        hecho ? (
          <PieHoja onCancelar={cerrar} textoCancelar="Cerrar">
            <button type="button" onClick={cerrar} className={primarioDeHoja}>
              Listo
            </button>
          </PieHoja>
        ) : (
          <PieHoja onCancelar={cerrar} bloqueado={enviando}>
            <button type="button" onClick={reactivar} disabled={!esPinValido(pin) || enviando} className={primarioDeHoja}>
              {enviando ? "Reactivando…" : "Reactivar"}
            </button>
          </PieHoja>
        )
      }
    >
      {hecho ? (
        <p className="pb-4 text-[14px] leading-relaxed text-ink">{hecho}</p>
      ) : (
        <div className="grid gap-3 pb-4">
          <div className="flex items-center gap-3">
            <span className="grayscale">
              <CaraBarbero b={b} size={52} aro />
            </span>
            <p className="text-[13px] leading-relaxed text-muted">
              Vuelve a salir en la web en {sedeNombre} y entra con un PIN nuevo (el anterior se borró al darlo de baja). Su historial está
              intacto.
            </p>
          </div>
          <p className="text-[12.5px] leading-relaxed text-muted">
            Si es otra persona con el mismo nombre, no lo reactives: heredaría las calificaciones, el historial y el correo de avisos del
            anterior. Agrégalo como barbero nuevo.
          </p>
          {email && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-line bg-panel px-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-ink">Quitar su correo de avisos</span>
                <span className="mt-0.5 block break-all text-[12px] leading-relaxed text-muted">
                  Hoy es {email}: ahí le llega cada reserva, con el nombre del cliente. Quítalo si ya no es suyo o lo cambió.
                </span>
              </span>
              <Switch checked={quitarCorreo} onChange={setQuitarCorreo} label={`Quitar el correo de avisos ${email}`} />
            </div>
          )}
          {agendaCon && !agenda.ok && (
            <div className="rounded-xl border border-warn/40 bg-warn/[0.08] px-3 py-2.5">
              <p className="text-[12.5px] font-semibold text-warn">
                Todavía ve su agenda de Google ({agendaCon}), con el nombre y el teléfono de tus clientes.
              </p>
              <button
                type="button"
                onClick={quitarAgenda}
                disabled={agenda.busy}
                className={`${botonClases("peligro", "sm")} mt-2`}
              >
                {agenda.busy ? "Quitando…" : "Quitarle el acceso"}
              </button>
            </div>
          )}
          {agenda.msg && <p className={`text-[12.5px] ${agenda.ok ? "text-ok" : "font-semibold text-warn"}`}>{agenda.msg}</p>}
          <div className="rounded-xl border border-line bg-panel px-3 py-2.5">
            <p className="text-[12px] leading-relaxed text-muted">
              ¿Al darlo de baja algo quedó sin cerrar (su sesión, sus avisos o su agenda)? Vuelve a cerrárselo sin reactivarlo.
            </p>
            <button type="button" onClick={cerrarDeNuevo} disabled={cierre.busy || enviando} className={`${botonClases("secundario", "sm")} mt-2`}>
              {cierre.busy ? "Cerrando…" : "Volver a cerrarle todo"}
            </button>
            {cierre.msg && <p className={`mt-2 text-[12.5px] ${cierre.ok ? "text-ok" : "font-semibold text-warn"}`}>{cierre.msg}</p>}
          </div>
          <Campo
            id={`reactivar-pin-${b.id}`}
            etiqueta="PIN nuevo (6 dígitos)"
            value={pin}
            inputMode="numeric"
            autoComplete="off"
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            error={pin.length === 6 && !esPinValido(pin) ? ERROR_PIN : undefined}
            ayuda={`Díselo en persona. ${email && !quitarCorreo ? "Su correo de avisos se conserva; l" : "L"}a agenda de Google y los avisos del celular hay que activarlos otra vez.`}
          />
          {error && <p className="rounded-xl border border-warn/40 bg-warn/[0.08] px-3 py-2 text-[12.5px] font-semibold text-warn">{error}</p>}
        </div>
      )}
    </Hoja>
  );
}

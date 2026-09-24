"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setearPinBarbero, desbloquearBarbero } from "@/lib/barbero-auth";
import { actualizarPerfilBarbero, guardarEmailBarbero, probarCorreoBarbero } from "@/lib/actions";
import { partirEspecialidades, MAX_ESPECIALIDADES } from "@/lib/admin-reglas";
import { botonClases } from "@/components/ui/Boton";
import { Campo, CampoArea } from "@/components/ui/Campo";
import { Hoja } from "@/components/ui/Hoja";
import { Grupo, Fila } from "@/components/ui/ListaAgrupada";
import { CaraBarbero } from "@/components/staff/Elegir";
import type { Barbero, Sede } from "@/lib/data/types";
import type { CalendarEstado } from "@/lib/data/queries";

/*
  UNA FICHA POR BARBERO (paso 20 de la tanda 2).

  ANTES el mismo barbero salía TRES VECES en esta pantalla: una tarjeta en "PIN
  de cada barbero", una fila en "Correo de avisos" y otra en "Google Calendar".
  Seis barberos × tres listas = dieciocho bloques, y la pantalla medía 5.269 px
  a 390 px — la más larga del panel. Para dejar listo a un barbero nuevo había
  que bajar tres veces a tres sitios distintos.

  AHORA hay una fila de 72 px por persona, con su cara, y todo lo suyo vive en su
  hoja: PIN, correo de avisos, agenda de Google y perfil. El subtítulo dice lo
  que le FALTA, que es lo que el dueño viene a buscar; si no falta nada, lo dice
  también y se acabó.

  Las cosas del LOCAL (el PIN del mostrador, lo que ve el equipo, las agendas de
  Google, las ausencias) no son de nadie en particular: viven en su propio grupo,
  arriba, cada una en su hoja.
*/

type EstadoPin = Record<string, { tienePin: boolean; bloqueado: boolean }>;

export function EquipoFichas({
  barberos,
  sedes,
  estado,
  emails,
  calendar,
  ausentesHoy = [],
}: {
  barberos: Barbero[];
  sedes: Sede[];
  estado: EstadoPin;
  emails: Record<string, string>;
  calendar: CalendarEstado;
  /** Ids de los que NO vienen hoy: se marca en su fila. */
  ausentesHoy?: string[];
}) {
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const abierto = barberos.find((b) => b.id === abiertoId) ?? null;

  return (
    <>
      {sedes.map((s) => {
        const lista = barberos.filter((b) => b.sede === s.id);
        if (!lista.length) return null;
        return (
          <Grupo key={s.id} eyebrow={s.nombre} className="mt-6">
            {lista.map((b) => {
              const e = estado[b.id];
              const falta = pendientes(b, e, emails[b.id], calendar);
              return (
                <Fila
                  key={b.id}
                  onClick={() => setAbiertoId(b.id)}
                  icono={<CaraBarbero b={b} size={44} />}
                  titulo={b.nombre}
                  subtitulo={
                    ausentesHoy.includes(b.id)
                      ? `Hoy no viene${falta.length ? ` · ${falta.join(" · ")}` : ""}`
                      : falta.length
                        ? falta.join(" · ")
                        : "Listo para trabajar"
                  }
                  badge={bloqueantes(e, emails[b.id]) || undefined}
                />
              );
            })}
          </Grupo>
        );
      })}

      {abierto && (
        <HojaBarbero
          b={abierto}
          estado={estado[abierto.id]}
          email={emails[abierto.id] ?? ""}
          agenda={calendar.agendas[abierto.id]}
          onCerrar={() => setAbiertoId(null)}
        />
      )}
    </>
  );
}

/** Cuántas de las cosas que le FALTAN le impiden trabajar hoy: sin PIN no entra
 *  a la app y sin correo no se entera de sus citas. Lo de la agenda de Google no
 *  cuenta acá — es una tarea del dueño, y pintarla en ámbar en las seis filas
 *  tapaba justo al barbero que sí está bloqueado. */
function bloqueantes(e: { tienePin: boolean; bloqueado: boolean } | undefined, email: string | undefined) {
  return (e?.bloqueado || !e?.tienePin ? 1 : 0) + (email ? 0 : 1);
}

/** Lo que le falta a este barbero para estar completo, en palabras cortas. */
function pendientes(
  b: Barbero,
  e: { tienePin: boolean; bloqueado: boolean } | undefined,
  email: string | undefined,
  calendar: CalendarEstado,
): string[] {
  const falta: string[] = [];
  if (e?.bloqueado) falta.push("PIN bloqueado");
  else if (!e?.tienePin) falta.push("sin PIN");
  if (!email) falta.push("sin correo");
  // La agenda solo se echa de menos si Google está configurado: si no lo está,
  // "sin agenda" sería un reproche por algo que nadie puede arreglar desde acá.
  if (calendar.configurado && !calendar.agendas[b.id]) falta.push("sin agenda");
  else if (calendar.configurado && !calendar.agendas[b.id]?.compartidoCon) falta.push("agenda sin compartir");
  return falta;
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 border-t border-line/60 pt-4 first:mt-0 first:border-t-0 first:pt-0">
      <p className="eyebrow mb-2.5">{titulo}</p>
      {children}
    </section>
  );
}

function HojaBarbero({
  b,
  estado,
  email,
  agenda,
  onCerrar,
}: {
  b: Barbero;
  estado: { tienePin: boolean; bloqueado: boolean } | undefined;
  email: string;
  agenda: { calendarId: string; compartidoCon: string | null } | undefined;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

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

  async function correr(id: string, fn: () => Promise<{ ok: boolean; error?: string; aviso?: string }>) {
    setBusy(id);
    setMsg(null);
    const res = await fn().catch(() => null);
    setBusy(null);
    if (res?.ok) {
      setMsg({ text: res.aviso ?? "Listo.", ok: true });
      router.refresh();
    } else {
      setMsg({ text: res?.error ?? "No se pudo. Revisa la conexión.", ok: false });
    }
    return !!res?.ok;
  }

  return (
    <Hoja titulo={b.nombre} onCerrar={onCerrar} ancho="max-w-lg">
      <div className="flex items-center gap-4 pb-4">
        <CaraBarbero b={b} size={64} aro />
        <div className="min-w-0">
          <p className="text-[13px] text-muted">
            {b.especialidades.length
              ? b.especialidades.slice(0, 3).join(" · ")
              : "Sin especialidades cargadas"}
          </p>
          {estado?.bloqueado && (
            <p className="mt-1 text-[12.5px] font-semibold text-warn">
              Se equivocó 5 veces con el PIN: no puede entrar hasta desbloquearlo.
            </p>
          )}
        </div>
      </div>

      {msg && (
        <p className={`mb-3 rounded-xl border px-3 py-2 text-[12.5px] ${
          msg.ok ? "border-ok/40 bg-ok/10 text-ok" : "border-warn/40 bg-warn/[0.08] font-semibold text-warn"
        }`}>
          {msg.text}
        </p>
      )}

      <Bloque titulo="Su PIN para entrar">
        {!editandoPin ? (
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide ${
                estado?.tienePin ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn"
              }`}
            >
              {estado?.tienePin ? "PIN listo" : "Sin PIN"}
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
                onClick={() => correr("desbloquear", () => desbloquearBarbero(b.id))}
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
                const ok = await correr("pin", () => setearPinBarbero(b.id, pin));
                if (ok) {
                  setEditandoPin(false);
                  setPin("");
                }
              }}
              disabled={busy !== null || pin.length !== 6}
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
      </Bloque>

      <Bloque titulo="Correo de avisos">
        <Campo
          id={`correo-${b.id}`}
          etiqueta="Correo del barbero"
          type="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          ayuda={
            email
              ? "Le llega un correo apenas un cliente le reserva."
              : "Sin correo no le llega ningún aviso de cita."
          }
        />
        {/* Probar ANTES de guardar (pedido del dueño, 8-sep): manda el aviso de
            prueba por el mismo camino del real, sin tocar lo guardado. */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => correr("probar", () => probarCorreoBarbero(b.id, correo.trim()))}
            disabled={busy !== null || !correo.trim()}
            className={botonClases("secundario", "md")}
          >
            {busy === "probar" ? "Enviando…" : "Probar"}
          </button>
          <button
            type="button"
            onClick={() => correr("correo", () => guardarEmailBarbero(b.id, correo.trim()))}
            disabled={busy !== null || !correoCambiado}
            className={botonClases("primario", "md")}
          >
            {busy === "correo" ? "…" : "Guardar correo"}
          </button>
          {correoCambiado && <span className="text-[12px] text-warn">sin guardar</span>}
        </div>
      </Bloque>

      <Bloque titulo="Su agenda de Google">
        <p className="text-[13px] text-muted">
          {!agenda
            ? "Todavía no tiene agenda. Se crean todas de una en El local → Google Calendar."
            : agenda.compartidoCon
              ? `Compartida con ${agenda.compartidoCon}. La ve en su Google Calendar, con recordatorios.`
              : email
                ? `Agenda creada, falta compartirla con ${email}. Se comparten todas de una en El local → Google Calendar.`
                : "Agenda creada, pero sin correo no hay con quién compartirla. Pon el correo aquí arriba."}
        </p>
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
          onClick={async () => {
            // El MISMO partido que usa el servidor (admin-reglas): si el cliente
            // separara distinto, el admin vería una cosa y se guardaría otra.
            const ok = await correr("perfil", () =>
              actualizarPerfilBarbero({ barberoId: b.id, bio, especialidades: partirEspecialidades(esp) }),
            );
            if (ok) router.refresh();
          }}
          disabled={busy !== null || !perfilCambiado}
          className={`${botonClases("primario", "md")} mt-3`}
        >
          {busy === "perfil" ? "…" : "Guardar perfil"}
        </button>
      </Bloque>
    </Hoja>
  );
}

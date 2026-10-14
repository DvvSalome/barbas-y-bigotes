"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cargarResumenBaja, darDeBajaBarbero, terminarBajaBarbero, cambiarPinMostrador, type ResultadoBaja } from "@/lib/equipo-actions";
import { actualizarReserva } from "@/lib/actions";
import { motivoParaNoDarDeBaja, avisoAClientes, esPinValido, ERROR_PIN } from "@/lib/equipo-reglas";
import { cop, fechaCortaBogota, horaBogota } from "@/lib/format";
import { MON, bogotaYmd } from "@/lib/slots";
import { Hoja, PieHoja, primarioDeHoja } from "@/components/ui/Hoja";
import { botonClases } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { Switch } from "@/components/admin/Switch";
import { CaraBarbero } from "@/components/staff/Elegir";
import { PasarCitas } from "@/components/admin/PasarCitas";
import { CheckIcon, AlertIcon } from "@/components/icons";
import type { ResumenBaja, SemanaBaja, CitaFutura } from "@/lib/data/queries";

/*
  DAR DE BAJA A UN BARBERO, en tres pasos (pedido del dueño, 14-oct).

  Antes no había botón: un activo=false por SQL lo sacaba de la web pero le dejaba
  el PIN, la sesión abierta en el celular (y con ella, por RLS, los teléfonos de
  sus clientes), las citas que tenía por delante invisibles en la agenda y su
  plata de la semana borrada de la liquidación.

    1 · Sus citas: las que ya pasaron sin cobrar (se cobran o se marcan "no vino"
        antes: sin su columna en el mostrador nadie las cobraría) y las que vienen
        (se pasan a otro de su sede o se cancelan; a quien no dejó correo hay que
        llamarlo, y la hoja dice a quién y a qué número).
    2 · Lo que se le debe: su liquidación de esta semana y, si tuvo algo, de la
        anterior. NO se borra.
    3 · Qué pasa al confirmar, en palabras del dueño, el PIN del mostrador (que
        él conoce) y el botón (dos toques, con pausa).

  Al terminar: lo que salió en verde y lo que falló aparte, en ámbar, con
  "Reintentar lo que faltó". Mientras corre, la hoja no se cierra: cerrarla no
  frena la baja y el dueño no vería el resultado.
*/

const PASOS = ["Sus citas", "Su plata", "Confirmar"] as const;

/** Un segundo toque más rápido que esto es un doble clic, no una decisión. */
const PAUSA_MS = 700;

const fechaCorta = (ymd: string) => {
  const [, m, d] = ymd.split("-").map(Number);
  return `${d} ${MON[m - 1] ?? ""}`;
};

const cuando = (iso: string) => `${fechaCortaBogota(iso)} · ${horaBogota(iso)}`;

export function BajaBarbero({
  barberoId,
  nombre,
  sedeNombre,
  onCerrar,
}: {
  barberoId: string;
  nombre: string;
  sedeNombre: string;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [resumen, setResumen] = useState<ResumenBaja | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [paso, setPaso] = useState(0);
  const [cancelar, setCancelar] = useState(false);
  const [armado, setArmado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoBaja | null>(null);
  const [reintentando, setReintentando] = useState(false);
  // Cuándo cambió el pie por última vez (paso nuevo o botón armado): el botón del
  // pie es el MISMO nodo en los tres pasos, así que un doble clic sobre
  // "Siguiente" llegaba a armar y confirmar sin leer el paso 3.
  const ultimoCambio = useRef(0);
  const primero = nombre.split(" ")[0];

  const cargar = useCallback(async () => {
    const r = await cargarResumenBaja(barberoId).catch(() => null);
    if (!r) setErrorCarga("No se pudo leer su ficha. Revisa la conexión.");
    else if (!r.ok) setErrorCarga(r.error);
    else {
      setErrorCarga(null);
      setResumen(r.resumen);
    }
  }, [barberoId]);

  useEffect(() => {
    // Lectura inicial desde el servidor (server action), no estado derivado.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, [cargar]);

  const citas = resumen?.citas ?? [];
  const sinCobrar = resumen?.sinCobrar ?? [];
  const motivo = resumen
    ? motivoParaNoDarDeBaja({ citasFuturas: citas.length, cancelarCitas: cancelar, enSilla: resumen.enSilla, sinCobrar: sinCobrar.length })
    : null;
  // Mientras corre en el servidor, cerrar no la frena: la hoja no se deja cerrar.
  const cerrar = () => {
    if (!enviando) onCerrar();
  };

  function irA(n: number) {
    ultimoCambio.current = Date.now();
    setArmado(false);
    setPaso(n);
  }

  async function confirmar() {
    if (Date.now() - ultimoCambio.current < PAUSA_MS) return;
    if (!armado) {
      ultimoCambio.current = Date.now();
      setArmado(true);
      return;
    }
    setEnviando(true);
    setError(null);
    const r = await darDeBajaBarbero({ barberoId, cancelarCitas: cancelar }).catch(() => null);
    setEnviando(false);
    setArmado(false);
    if (r?.ok) {
      setResultado(r);
      router.refresh();
    } else {
      setError(r?.error ?? "No se pudo. Revisa la conexión e intenta de nuevo.");
      void cargar();
    }
  }

  async function reintentar() {
    setReintentando(true);
    const r = await terminarBajaBarbero(barberoId).catch(() => null);
    setReintentando(false);
    setResultado((prev) => {
      const base: ResultadoBaja = prev ?? { ok: true };
      if (!r?.ok) return { ...base, pendientes: [r?.error ?? "No se pudo. Revisa la conexión e intenta de nuevo."] };
      const quedan = r.pendientes ?? [];
      return {
        ...base,
        pendientes: quedan,
        hecho: quedan.length ? base.hecho : [...(base.hecho ?? []), "Listo: ya se le cerró lo que faltaba."],
      };
    });
    if (r?.ok) router.refresh();
  }

  // --- Terminado ---------------------------------------------------------------
  if (resultado) {
    const hecho = resultado.hecho?.length ? resultado.hecho : [resultado.aviso ?? `${primero} quedó dado de baja.`];
    const pendientes = resultado.pendientes ?? [];
    const llamar = resultado.llamar ?? [];
    return (
      <Hoja
        titulo={`Baja de ${primero}`}
        onCerrar={cerrar}
        ancho="max-w-lg"
        pie={
          <PieHoja onCancelar={cerrar} textoCancelar="Cerrar" bloqueado={reintentando}>
            <button type="button" onClick={cerrar} disabled={reintentando} className={primarioDeHoja}>
              Listo
            </button>
          </PieHoja>
        }
      >
        <ul className="grid gap-2 pb-4">
          {hecho.map((t) => (
            <li key={t} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-ink">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ok/15 text-ok">
                <CheckIcon className="h-3 w-3" />
              </span>
              <span>{t}</span>
            </li>
          ))}
        </ul>

        {llamar.length > 0 && (
          <div className="mb-4 rounded-xl border border-warn/40 bg-warn/[0.08] px-3 py-2.5">
            <p className="text-[13px] font-semibold text-warn">
              {llamar.length === 1 ? "Llama a este cliente: no dejó correo y no se enteró" : "Llama a estos clientes: no dejaron correo y no se enteraron"}
            </p>
            <ul className="mt-1.5 grid gap-1 text-[12.5px] text-ink">
              {llamar.map((c) => (
                <li key={`${c.inicio}-${c.cliente}`}>
                  {cuando(c.inicio)} · {c.cliente || "Cliente"}
                  {c.telefono ? (
                    <>
                      {" · "}
                      <a href={`tel:${c.telefono}`} className="font-semibold underline underline-offset-2">
                        {c.telefono}
                      </a>
                    </>
                  ) : (
                    " · sin teléfono"
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {pendientes.length > 0 && (
          <div className="mb-4 rounded-xl border border-warn/40 bg-warn/[0.08] px-3 py-2.5" role="alert">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-warn">
              <AlertIcon className="h-4 w-4 shrink-0" />
              Esto no se pudo hacer
            </p>
            <ul className="mt-1.5 grid gap-1 text-[12.5px] leading-relaxed text-ink">
              {pendientes.map((t) => (
                <li key={t}>· {t}</li>
              ))}
            </ul>
            <button type="button" onClick={reintentar} disabled={reintentando} className={`${botonClases("peligro", "sm")} mt-2.5`}>
              {reintentando ? "Reintentando…" : "Reintentar lo que faltó"}
            </button>
          </div>
        )}

        <p className="pb-4 text-[12.5px] text-muted">
          Si vuelve, lo encuentras al final de Equipo, en «Ya no trabajan aquí», con el botón Reactivar.
        </p>
      </Hoja>
    );
  }

  const ultimo = paso === PASOS.length - 1;
  const pie = (
    <PieHoja
      onCancelar={paso === 0 ? cerrar : () => irA(paso - 1)}
      textoCancelar={paso === 0 ? "Cancelar" : "Atrás"}
      bloqueado={enviando}
    >
      {ultimo ? (
        <button
          type="button"
          onClick={confirmar}
          onBlur={() => setArmado(false)}
          disabled={!resumen || !!motivo || enviando}
          // La acción que NO tiene vuelta atrás fácil va con el contorno de peligro,
          // no con el degradado del primario ("lo que se quiere que pase").
          className={botonClases("peligro", "md", `min-w-[46%] ${armado ? "ring-2 ring-warn" : ""}`)}
        >
          {enviando ? "Dando de baja…" : armado ? "Toca otra vez para confirmar" : `Dar de baja a ${primero}`}
        </button>
      ) : (
        <button type="button" onClick={() => irA(paso + 1)} disabled={!resumen} className={primarioDeHoja}>
          Siguiente
        </button>
      )}
    </PieHoja>
  );

  return (
    <Hoja titulo={`Dar de baja a ${primero}`} onCerrar={cerrar} ancho="max-w-lg" pie={pie}>
      {/* Paso a paso: dónde está y cuánto falta. */}
      <ol className="mb-4 grid grid-cols-3 gap-1.5" aria-label="Pasos de la baja">
        {PASOS.map((t, i) => (
          <li key={t} aria-current={i === paso ? "step" : undefined}>
            <span className={`block h-1 rounded-full ${i <= paso ? "bg-accent" : "bg-line"}`} />
            <span className={`mt-1.5 block text-[12px] font-semibold ${i === paso ? "text-ink" : "text-muted"}`}>
              {i + 1} · {t}
            </span>
          </li>
        ))}
      </ol>

      {errorCarga && (
        <p className="mb-3 rounded-xl border border-warn/40 bg-warn/[0.08] px-3 py-2 text-[12.5px] font-semibold text-warn">{errorCarga}</p>
      )}
      {error && (
        <p role="alert" className="mb-3 rounded-xl border border-warn/40 bg-warn/[0.08] px-3 py-2 text-[12.5px] font-semibold text-warn">
          {error}
        </p>
      )}
      {!resumen && !errorCarga && <p className="pb-6 text-[13px] text-muted">Revisando sus citas, su plata y sus accesos…</p>}

      {resumen && paso === 0 && (
        <section className="grid gap-3 pb-4">
          <p className="text-[13px] leading-relaxed text-muted">
            Lo primero son sus clientes: si se va con citas por delante, llegan y no hay quién los atienda.
          </p>
          {resumen.enSilla && (
            <p className="rounded-xl border border-warn/40 bg-warn/[0.08] px-3 py-2.5 text-[12.5px] font-semibold text-warn">
              Está atendiendo a alguien ahora mismo. Cobra esa cita en el mostrador antes de darlo de baja.
            </p>
          )}

          {sinCobrar.length > 0 && (
            <SinCobrar citas={sinCobrar} sedeId={resumen.barbero.sedeId} onCambio={() => void cargar()} />
          )}

          {citas.length === 0 ? (
            <p className="flex items-center gap-2 rounded-xl border border-ok/35 bg-ok/10 px-3 py-2.5 text-[13px] text-ok">
              <CheckIcon className="h-4 w-4 shrink-0" />
              No tiene citas por delante.
            </p>
          ) : (
            <>
              <p className="text-[13.5px] font-semibold text-ink">
                Tiene {citas.length === 1 ? "1 cita" : `${citas.length} citas`} por delante. Pásalas a otro barbero de {sedeNombre}, a la misma hora:
              </p>
              <PasarCitas
                citas={citas}
                destinos={resumen.destinos}
                sedeNombre={sedeNombre}
                onCambio={() => void cargar()}
                salida="Pásala a otro, márcala para cancelar aquí abajo o cámbiale la hora en la Agenda."
              />
              <div className="mt-1 flex items-start justify-between gap-3 rounded-xl border border-line bg-panel px-3 py-2.5">
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-ink">Cancelarlas</span>
                  <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">
                    Para las que no pases. {avisoAClientes(citas.filter((c) => c.conCorreo).length, citas.filter((c) => !c.conCorreo).length)}{" "}
                    Si tiene la app, también le llega el aviso al celular.
                  </span>
                </span>
                <Switch checked={cancelar} onChange={setCancelar} label="Cancelar sus citas por delante" />
              </div>
              {cancelar && citas.some((c) => !c.conCorreo) && <ParaLlamar citas={citas.filter((c) => !c.conCorreo)} />}
            </>
          )}
        </section>
      )}

      {resumen && paso === 1 && <PasoPlata resumen={resumen} primero={primero} />}

      {resumen && paso === 2 && (
        <section className="grid gap-3 pb-4">
          <div className="flex items-center gap-3">
            <CaraBarbero b={{ id: barberoId, nombre, fotoUrl: resumen.barbero.fotoUrl }} size={48} aro />
            <p className="text-[13.5px] font-semibold text-ink">Al confirmar, a {primero}:</p>
          </div>
          <ul className="grid gap-2 text-[13px] leading-relaxed text-ink">
            <Punto>Deja de salir en la web y en la reserva. Nadie le puede reservar.</Punto>
            {citas.length > 0 && cancelar && (
              <Punto>
                Se {citas.length === 1 ? "cancela su cita" : `cancelan sus ${citas.length} citas`}.{" "}
                {avisoAClientes(citas.filter((c) => c.conCorreo).length, citas.filter((c) => !c.conCorreo).length)}
              </Punto>
            )}
            <Punto>
              {resumen.accesos.pin || resumen.accesos.usuario
                ? "Su PIN deja de servir y se le cierra la sesión en todos sus aparatos: su app ya no le muestra nada."
                : "No tenía PIN ni acceso a la app: no hay nada que cerrarle."}
            </Punto>
            {resumen.accesos.aparatos > 0 && (
              <Punto>
                Se borran sus avisos en {resumen.accesos.aparatos === 1 ? "1 celular" : `${resumen.accesos.aparatos} aparatos`}.
              </Punto>
            )}
            {resumen.accesos.agendaCompartida && (
              <Punto>
                Se le quita el acceso a su agenda de Google ({resumen.accesos.agendaCompartida}): los eventos tienen el nombre y el teléfono
                de tus clientes.
              </Punto>
            )}
          </ul>
          <PinMostrador sedeId={resumen.barbero.sedeId} sedeNombre={sedeNombre} primero={primero} />
          <p className="rounded-xl border border-line bg-panel px-3 py-2.5 text-[12.5px] leading-relaxed text-muted">
            <b className="text-ink">No se borra nada de plata:</b> sus cobros, adelantos e historial se quedan, y sigue saliendo en
            Liquidación las semanas en que tuvo movimientos. Si vuelve, lo reactivas desde «Ya no trabajan aquí».
          </p>
          {motivo && (
            <p className="rounded-xl border border-warn/40 bg-warn/[0.08] px-3 py-2.5 text-[12.5px] font-semibold text-warn">{motivo}</p>
          )}
        </section>
      )}
    </Hoja>
  );
}

function Punto({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
      <span>{children}</span>
    </li>
  );
}

/** A quién hay que llamar: sin correo no le llega ningún aviso. */
function ParaLlamar({ citas }: { citas: CitaFutura[] }) {
  return (
    <div className="rounded-xl border border-warn/40 bg-warn/[0.08] px-3 py-2.5">
      <p className="text-[12.5px] font-semibold text-warn">
        {citas.length === 1 ? "A este no le llega nada: llámalo" : "A estos no les llega nada: llámalos"}
      </p>
      <ul className="mt-1 grid gap-1 text-[12.5px] text-ink">
        {citas.map((c) => (
          <li key={c.id}>
            {cuando(c.inicio)} · {c.cliente || "Cliente"}
            {c.telefono ? (
              <>
                {" · "}
                <a href={`tel:${c.telefono}`} className="font-semibold underline underline-offset-2">
                  {c.telefono}
                </a>
              </>
            ) : (
              " · sin teléfono"
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Las que ya pasaron y nadie cerró. Al darlo de baja su columna sale del
 * mostrador: si no se cobran o se marcan "no vino" antes, ese corte no entra
 * nunca a caja ni a su liquidación.
 */
function SinCobrar({ citas, sedeId, onCambio }: { citas: CitaFutura[]; sedeId: string; onCambio: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function noVino(id: string) {
    setBusy(id);
    setMsg(null);
    const r = await actualizarReserva(id, { estado: "no_show" }).catch(() => null);
    setBusy(null);
    if (!r?.ok) setMsg(r?.error ?? "No se pudo. Revisa la conexión.");
    onCambio();
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-warn/40 bg-warn/[0.05] p-3">
      <p className="text-[13px] font-semibold text-ink">
        {citas.length === 1 ? "1 cita ya pasó y no se ha cobrado" : `${citas.length} citas ya pasaron y no se han cobrado`}
      </p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
        Cóbralas en la Agenda o márcalas «No vino» antes de seguir: después de la baja nadie las podría cobrar.
      </p>
      {msg && <p className="mt-2 text-[12.5px] font-semibold text-warn">{msg}</p>}
      <ul className="mt-2 grid gap-2">
        {citas.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-panel px-3 py-2">
            <span className="min-w-0 basis-full sm:flex-1 sm:basis-[170px]">
              <span className="block text-[13.5px] font-bold tabular-nums text-accent-soft">{cuando(c.inicio)}</span>
              <span className="block truncate text-[13px] text-ink">
                {c.cliente || "Cliente"} · {c.servicio || "Servicio"}
              </span>
            </span>
            <Link
              href={`/admin/agenda?sede=${encodeURIComponent(sedeId)}&fecha=${bogotaYmd(new Date(c.inicio))}`}
              className={botonClases("secundario", "sm")}
            >
              Cobrarla
            </Link>
            <button type="button" onClick={() => noVino(c.id)} disabled={busy !== null} className={botonClases("terciario", "sm")}>
              {busy === c.id ? "…" : "No vino"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * El PIN del mostrador de su sede: el que se va lo conoce. Con él entra como
 * "mostrador" y ve la agenda, la caja y los clientes de toda la sede. Cambiarlo es
 * opcional (lo decide el dueño), pero se dice sin vueltas.
 */
function PinMostrador({ sedeId, sedeNombre, primero }: { sedeId: string; sedeNombre: string; primero: string }) {
  const [abierto, setAbierto] = useState(false);
  const [pin, setPin] = useState("");
  const [cerrarSesiones, setCerrarSesiones] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function cambiar() {
    setBusy(true);
    setMsg(null);
    const r = await cambiarPinMostrador({ sedeId, pin, cerrarSesiones }).catch(() => null);
    setBusy(false);
    setMsg({ ok: !!r?.ok, text: r?.ok ? (r.aviso ?? "Listo.") : (r?.error ?? "No se pudo. Revisa la conexión.") });
    if (r?.ok) setPin("");
  }

  return (
    <div className="rounded-xl border border-warn/40 bg-warn/[0.05] px-3 py-2.5">
      <p className="text-[13px] font-semibold text-ink">El PIN del mostrador de {sedeNombre} lo sigue sabiendo</p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
        Con ese PIN {primero} entra como mostrador y ve la agenda, la caja y los clientes de toda la sede. La baja no lo cambia: si no
        quieres que siga entrando, cámbialo aquí y dale el nuevo al equipo en persona.
      </p>
      {msg && <p className={`mt-2 text-[12.5px] ${msg.ok ? "text-ok" : "font-semibold text-warn"}`}>{msg.text}</p>}
      {!abierto ? (
        <button type="button" onClick={() => setAbierto(true)} className={`${botonClases("secundario", "sm")} mt-2`}>
          Cambiar el PIN del mostrador
        </button>
      ) : (
        <div className="mt-2.5 grid gap-2.5">
          <Campo
            id={`pin-mostrador-${sedeId}`}
            etiqueta="PIN nuevo del mostrador (6 dígitos)"
            value={pin}
            inputMode="numeric"
            autoComplete="off"
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            error={pin.length === 6 && !esPinValido(pin) ? ERROR_PIN : undefined}
          />
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-0 text-[12px] leading-relaxed text-muted">
              <b className="text-ink">Sacar a todos del mostrador.</b> Si {primero} entró al mostrador desde su celular, esa sesión sigue
              abierta hasta que la cierres. El aparato del local también se sale y pide el PIN nuevo.
            </span>
            <Switch checked={cerrarSesiones} onChange={setCerrarSesiones} label="Cerrar las sesiones del mostrador en todos los aparatos" />
          </div>
          <button type="button" onClick={cambiar} disabled={busy || !esPinValido(pin)} className={botonClases("primario", "sm")}>
            {busy ? "Cambiando…" : "Cambiar PIN del mostrador"}
          </button>
        </div>
      )}
    </div>
  );
}

function PasoPlata({ resumen, primero }: { resumen: ResumenBaja; primero: string }) {
  const semanas = [resumen.semanaAnterior, resumen.semana].filter((s): s is SemanaBaja => !!s);
  return (
    <section className="grid gap-3 pb-4">
      <p className="text-[13px] leading-relaxed text-muted">
        Con la misma cuenta de Liquidación. Págale o descuéntale lo que corresponda: darlo de baja no borra nada de esto.
      </p>
      {semanas.map((s, i) => (
        <SemanaPlata key={s.desdeYmd} s={s} anterior={!!resumen.semanaAnterior && i === 0} />
      ))}
      <p className="text-[12px] leading-relaxed text-muted">
        En Liquidación {primero} sale con la marca «Ya no trabaja aquí» las semanas en que tuvo movimientos, y ahí mismo le puedes sumar o
        restar un ajuste. La fila no desaparece cuando le pagas: llevar la cuenta de lo pagado sigue siendo tuyo.
      </p>
    </section>
  );
}

function SemanaPlata({ s, anterior }: { s: SemanaBaja; anterior: boolean }) {
  const { desdeYmd, hastaYmd, fila } = s;
  const arriendo = fila?.tipoContrato === "arriendo";
  const titulo = `${anterior ? "Semana anterior" : "Esta semana"} (${fechaCorta(desdeYmd)} – ${fechaCorta(hastaYmd)})`;
  const vacia = !fila || (fila.cobros === 0 && fila.adelantos === 0 && fila.consumos === 0 && fila.ajustes === 0);
  return (
    <div className="grid gap-2">
      <p className="text-[12px] font-bold uppercase tracking-wide text-muted">{titulo}</p>
      {vacia ? (
        <p className="rounded-xl border border-line bg-panel px-3 py-2.5 text-[13px] text-muted">
          No tuvo cobros, adelantos ni consumos: no se le debe nada de esta semana.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-panel">
          <div className="grid grid-cols-2 gap-px bg-line/40">
            {[
              { l: "Facturó", v: cop(fila.facturado), sub: `${fila.cobros} ${fila.cobros === 1 ? "cobro" : "cobros"}` },
              arriendo
                ? { l: "Arriendo", v: cop(fila.arriendo), sub: "al mes, no semanal" }
                : { l: "Su parte", v: cop(fila.comision), sub: "comisión de la semana" },
              { l: "Adelantos", v: fila.adelantos ? `−${cop(fila.adelantos)}` : "—", sub: "ya se los llevó" },
              { l: "Consumos", v: fila.consumos ? `−${cop(fila.consumos)}` : "—", sub: "bebidas y mecatos" },
            ].map((k) => (
              <div key={k.l} className="bg-panel px-3 py-2.5">
                <div className="text-[12px] font-bold uppercase tracking-wide text-muted">{k.l}</div>
                <div className="font-display text-[18px] font-bold tabular-nums text-ink">{k.v}</div>
                <div className="text-[12px] leading-tight text-muted">{k.sub}</div>
              </div>
            ))}
          </div>
          {fila.ajustes !== 0 && (
            <p className="border-t border-line/60 px-3 py-2 text-[12px] text-muted">
              Ajustes a mano: {fila.ajustes > 0 ? "+" : "−"}
              {cop(Math.abs(fila.ajustes))}
            </p>
          )}
          <div className="flex items-baseline justify-between gap-3 border-t border-line bg-elevated/40 px-3 py-3">
            <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-muted">{arriendo ? "Le queda a él" : "A pagarle"}</span>
            <span className={`font-display text-[24px] font-extrabold leading-none tabular-nums ${fila.neto < 0 && !arriendo ? "text-warn" : "text-accent-soft"}`}>
              {arriendo ? cop(fila.facturado) : cop(fila.neto)}
            </span>
          </div>
          {!arriendo && fila.neto < 0 && (
            <p className="px-3 pb-3 text-[12px] text-warn">Se llevó más de lo que produjo: queda debiendo {cop(-fila.neto)}.</p>
          )}
        </div>
      )}
      <Link
        href={`/admin/liquidacion?semana=${desdeYmd}`}
        className="inline-flex min-h-11 items-center text-[13px] font-semibold text-ink/85 underline decoration-line underline-offset-4 transition hover:text-ink"
      >
        Abrir Liquidación, semana del {fechaCorta(desdeYmd)} →
      </Link>
    </div>
  );
}

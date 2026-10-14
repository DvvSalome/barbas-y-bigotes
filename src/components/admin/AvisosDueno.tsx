"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/admin/Switch";
import { botonClases } from "@/components/ui/Boton";
import { Campo } from "@/components/ui/Campo";
import { AvisosBarbero } from "@/components/barbero/AvisosBarbero";
import {
  agregarCorreoDueno,
  quitarCorreoDueno,
  cambiarAvisoDueno,
  probarCorreoDueno,
  type CampoAvisoDueno,
} from "@/lib/actions";
import type { CorreoDueno } from "@/lib/data/queries";

/*
  "Avisos para ti" (0084): lo que le llega AL DUEÑO, y lo configura él.

  Antes no había dónde poner su correo: el cierre de caja iba a un Gmail de FourG
  escrito a mano en n8n, y cambiar a quién le llegaba algo era trabajo de un
  desarrollador. Ahora hay hasta 5 correos (él, un socio, el administrador
  nuevo…), cada uno con sus tres interruptores, y un "Probar" que manda el aviso
  por el mismo camino que los reales.

  Pensado para 360 px: cada correo es una tarjeta con sus interruptores en filas
  de 44 px (texto a la izquierda, interruptor a la derecha) y los botones abajo.
*/

const MAX_CORREOS = 5;

const INTERRUPTORES: { campo: CampoAvisoDueno; titulo: string; detalle: string }[] = [
  { campo: "citas", titulo: "Citas nuevas", detalle: "Cada cliente que reserva por la web." },
  {
    campo: "cierres",
    titulo: "Cierre de caja",
    detalle: "El resumen de cada cierre: lo que entró por medio de pago, los gastos y si cuadró el efectivo.",
  },
  {
    campo: "alertas",
    titulo: "Alertas",
    detalle: "Una caja que sigue abierta en la noche y las calificaciones de 3 estrellas o menos.",
  },
];

// La respuesta se pinta JUNTO a lo que la pidió (`donde` = id del correo, o
// "nuevo" para el formulario de abajo): a 360 px un mensaje al pie de la tarjeta
// quedaba 700 px más abajo y el dueño creía que «Probar» no había hecho nada.
type Msg = { donde: string; ok: boolean; texto: string } | null;

export function AvisosDueno({ disponible, correos }: { disponible: boolean; correos: CorreoDueno[] }) {
  const router = useRouter();
  const [nuevo, setNuevo] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [confirmarQuitar, setConfirmarQuitar] = useState<string | null>(null);
  // Interruptores con respuesta inmediata: se mueven al tocar y vuelven atrás si
  // el servidor dice que no.
  const [local, setLocal] = useState<Record<string, Partial<Record<CampoAvisoDueno, boolean>>>>({});

  async function correr(
    id: string,
    donde: string,
    fn: () => Promise<{ ok: boolean; error?: string; aviso?: string }>,
  ) {
    setOcupado(id);
    setMsg(null);
    const res = await fn().catch(() => null);
    setOcupado(null);
    setMsg(
      res?.ok
        ? { donde, ok: true, texto: res.aviso ?? "Listo." }
        : { donde, ok: false, texto: res?.error ?? "No se pudo. Revisa la conexión." },
    );
    return !!res?.ok;
  }

  async function cambiar(c: CorreoDueno, campo: CampoAvisoDueno, valor: boolean) {
    setLocal((l) => ({ ...l, [c.id]: { ...l[c.id], [campo]: valor } }));
    setMsg(null);
    const res = await cambiarAvisoDueno(c.id, campo, valor).catch(() => null);
    if (!res?.ok) {
      setLocal((l) => ({ ...l, [c.id]: { ...l[c.id], [campo]: !valor } }));
      setMsg({ donde: c.id, ok: false, texto: res?.error ?? "No se pudo guardar. Revisa la conexión." });
      return;
    }
    router.refresh();
  }

  async function agregar() {
    const ok = await correr("agregar", "nuevo", () => agregarCorreoDueno(nuevo.trim()));
    if (ok) {
      setNuevo("");
      router.refresh();
    }
  }

  const lleno = correos.length >= MAX_CORREOS;

  return (
    <section aria-labelledby="avisos-para-ti" className="space-y-4">
      <div>
        <h2 id="avisos-para-ti" className="font-display text-xl">
          Avisos para ti
        </h2>
        <p className="mt-1 max-w-[56ch] text-[12.5px] leading-relaxed text-muted">
          Lo que te avisamos a ti: cada cita que reservan por la web, cada cierre de caja y si una caja se queda
          abierta o un cliente califica mal. Puedes poner otros correos (un socio, el administrador) y elegir qué le llega a cada uno.
        </p>
      </div>

      {/* El celular de ESTE aparato (0083). La tarjeta sabe si los avisos llegan
          a este perfil, a quién más le avisa el aparato y cómo desbloquearlos. */}
      <AvisosBarbero dueno />

      <div className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <h3 className="font-display text-lg">Por correo</h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          Salen desde reservas@barbasybigotes.com. Si no los ves, revisa Spam la primera vez y márcalos como «No es spam».
        </p>

        {!disponible ? (
          <p className="mt-4 rounded-xl border border-warn/40 bg-warn/[0.08] px-3.5 py-2.5 text-[12.5px] text-warn">
            Todavía no se pueden guardar correos: falta un paso técnico en la base de datos (la migración 0084). Pídeselo a
            soporte de FourG.
          </p>
        ) : (
          <>
            {correos.length === 0 && (
              <p className="mt-4 rounded-xl border border-warn/40 bg-warn/[0.08] px-3.5 py-2.5 text-[12.5px] text-warn">
                <b>Todavía no hay ningún correo.</b> Hoy no te llega ni la cita nueva ni el cierre de caja.
              </p>
            )}

            <ul className="mt-4 grid gap-3">
              {correos.map((c) => (
                <li key={c.id} className="rounded-xl border border-line bg-bg/40 px-3.5 pb-2 pt-3">
                  <p className="break-all text-[14px] font-semibold text-ink">{c.email}</p>
                  <div className="mt-1 divide-y divide-line/60">
                    {INTERRUPTORES.map((i) => {
                      const valor = local[c.id]?.[i.campo] ?? c[i.campo];
                      return (
                        <div key={i.campo} className="flex items-center justify-between gap-3 py-1.5">
                          <span className="min-w-0">
                            <span className="block text-[13px] font-semibold text-ink">{i.titulo}</span>
                            <span className="block text-[12px] leading-snug text-muted">{i.detalle}</span>
                          </span>
                          <Switch
                            checked={valor}
                            onChange={(v) => cambiar(c, i.campo, v)}
                            label={`${i.titulo} a ${c.email}`}
                            disabled={ocupado !== null}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-line/60 pt-2">
                    <button
                      type="button"
                      onClick={() => correr(`probar-${c.id}`, c.id, () => probarCorreoDueno(c.email))}
                      disabled={ocupado !== null}
                      aria-label={`Probar ${c.email}`}
                      className={botonClases("secundario", "sm")}
                    >
                      {ocupado === `probar-${c.id}` ? "Enviando…" : "Probar"}
                    </button>
                    {confirmarQuitar === c.id ? (
                      <>
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await correr(`quitar-${c.id}`, c.id, () => quitarCorreoDueno(c.id));
                            setConfirmarQuitar(null);
                            if (ok) router.refresh();
                          }}
                          disabled={ocupado !== null}
                          aria-label={`Sí, quitar ${c.email}`}
                          className={botonClases("peligro", "sm")}
                        >
                          {ocupado === `quitar-${c.id}` ? "Quitando…" : "Sí, quitar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmarQuitar(null)}
                          className={botonClases("terciario", "sm")}
                        >
                          No
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmarQuitar(c.id)}
                        disabled={ocupado !== null}
                        aria-label={`Quitar ${c.email}`}
                        className={botonClases("terciario", "sm")}
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                  {msg?.donde === c.id && <Aviso msg={msg} />}
                </li>
              ))}
            </ul>

            {lleno ? (
              <p className="mt-4 text-[12px] text-muted">
                Ya tienes {MAX_CORREOS} correos, el máximo. Quita uno para poner otro.
              </p>
            ) : (
              <form
                className="mt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (nuevo.trim() && ocupado === null) agregar();
                }}
              >
                <Campo
                  id="correo-dueno-nuevo"
                  etiqueta={correos.length ? "Agregar otro correo" : "Tu correo"}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={nuevo}
                  onChange={(e) => setNuevo(e.target.value)}
                  ayuda="Usa un correo que leas seguido (Gmail, Outlook…). Primero toca «Probar»; cuando te llegue (mira también en Spam), toca «Agregar». Le llegan los tres avisos; después eliges cuáles."
                />
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {/* Probar ANTES de guardar, y obligatorio (agregarCorreoDueno lo
                      exige): un correo mal escrito rebota una vez en la prueba y
                      no cada día con cada cita y cada cierre. */}
                  <button
                    type="button"
                    onClick={() => correr("probar-nuevo", "nuevo", () => probarCorreoDueno(nuevo.trim()))}
                    disabled={ocupado !== null || !nuevo.trim()}
                    className={botonClases("secundario", "md")}
                  >
                    {ocupado === "probar-nuevo" ? "Enviando…" : "1 · Probar"}
                  </button>
                  <button
                    type="submit"
                    disabled={ocupado !== null || !nuevo.trim()}
                    className={botonClases("primario", "md")}
                  >
                    {ocupado === "agregar" ? "Guardando…" : "2 · Agregar"}
                  </button>
                </div>
              </form>
            )}
            {msg?.donde === "nuevo" && <Aviso msg={msg} />}
          </>
        )}
      </div>
    </section>
  );
}

function Aviso({ msg }: { msg: NonNullable<Msg> }) {
  return (
    <p
      role="status"
      className={`mt-2.5 rounded-xl border px-3 py-2 text-[12.5px] ${
        msg.ok ? "border-ok/40 bg-ok/10 text-ok" : "border-warn/40 bg-warn/[0.08] font-semibold text-warn"
      }`}
    >
      {msg.texto}
    </p>
  );
}

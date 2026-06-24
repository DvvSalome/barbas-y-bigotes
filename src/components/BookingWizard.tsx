"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { categorias } from "@/lib/data/seed";
import { createReserva, getDisponibilidad } from "@/lib/actions";
import type { Sede, SedeId, Servicio, Barbero, Categoria } from "@/lib/data/types";
import { cop } from "@/lib/format";

const OPEN = 9 * 60; // 09:00
const CLOSE = 20 * 60; // 20:00
const STEP = 30; // minutos entre inicios de slot

const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MON = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

type Step = "sede" | "barbero" | "servicio" | "horario" | "datos" | "ok";

function fmtTime(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ap = h < 12 ? "am" : "pm";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m.toString().padStart(2, "0")} ${ap}`;
}

function fmtDur(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

// Foto por servicio (rota las fotos reales de cortes del cliente, estable por id).
// Provisional hasta tener foto propia por servicio (ver WeiBook cuando reactiven).
function fotoServicio(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `/cortes/corte-${(h % 7) + 1}.jpg`;
}

function nextDays(n: number) {
  const out: Date[] = [];
  const base = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push(d);
  }
  return out;
}

const STEPS: { id: Step; label: string }[] = [
  { id: "sede", label: "Sede" },
  { id: "barbero", label: "Barbero" },
  { id: "servicio", label: "Servicio" },
  { id: "horario", label: "Horario" },
  { id: "datos", label: "Datos" },
];

export function BookingWizard({
  sedes,
  barberos,
  servicios,
  initialBarberoId,
}: {
  sedes: Sede[];
  barberos: Barbero[];
  servicios: Servicio[];
  initialBarberoId?: string;
}) {
  const initialBarbero = barberos.find((b) => b.id === initialBarberoId) ?? null;

  const [step, setStep] = useState<Step>(initialBarbero ? "servicio" : "sede");
  const [sedeId, setSedeId] = useState<SedeId | null>(initialBarbero?.sede ?? null);
  const [barbero, setBarbero] = useState<Barbero | null>(initialBarbero);
  const [servicio, setServicio] = useState<Servicio | null>(null);
  const [day, setDay] = useState<Date | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [ocupados, setOcupados] = useState<{ inicio: string; fin: string }[]>([]);
  const [cargandoSlots, setCargandoSlots] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sedeBarberos = useMemo(
    () => barberos.filter((b) => b.sede === sedeId),
    [barberos, sedeId],
  );
  const days = useMemo(() => nextDays(7), []);
  const slots = useMemo(() => {
    if (!servicio) return [] as number[];
    const out: number[] = [];
    for (let t = OPEN; t + servicio.duracionMin <= CLOSE; t += STEP) out.push(t);
    return out;
  }, [servicio]);

  // Disponibilidad real: trae los rangos ocupados del barbero ese día.
  useEffect(() => {
    if (!day || !barbero) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset async-fetched availability when inputs are cleared
      setOcupados([]);
      return;
    }
    let cancel = false;
    const fetchSlots = () =>
      getDisponibilidad({ barberoId: barbero.id, fechaISO: day.toISOString() }).then((r) => {
        if (!cancel) setOcupados(r);
      });
    setCargandoSlots(true);
    fetchSlots().finally(() => {
      if (!cancel) setCargandoSlots(false);
    });
    // Disponibilidad "casi en vivo": re-consulta cada 15s mientras el cliente elige (sin spinner).
    const poll = setInterval(fetchSlots, 15000);
    return () => {
      cancel = true;
      clearInterval(poll);
    };
  }, [day, barbero]);

  const taken = useMemo(() => {
    const s = new Set<number>();
    if (!day) return s;
    const dur = servicio?.duracionMin ?? STEP;
    for (const o of ocupados) {
      const oi = new Date(o.inicio);
      const of = new Date(o.fin);
      const startMin = oi.getHours() * 60 + oi.getMinutes();
      const endMin = of.getHours() * 60 + of.getMinutes();
      for (const t of slots) {
        if (t < endMin && t + dur > startMin) s.add(t);
      }
    }
    // Bloquea horarios ya pasados cuando el día elegido es hoy.
    const now = new Date();
    if (day.toDateString() === now.toDateString()) {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      for (const t of slots) if (t <= nowMin) s.add(t);
    }
    return s;
  }, [day, ocupados, slots, servicio]);

  const sinCupos = slots.length > 0 && taken.size >= slots.length;

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const sedeNombre = sedes.find((s) => s.id === sedeId)?.nombre ?? "—";

  function reset() {
    setStep(initialBarbero ? "servicio" : "sede");
    setServicio(null);
    setDay(null);
    setSlot(null);
    setNombre("");
    setTelefono("");
    setEmail("");
    setErrorMsg(null);
  }

  async function confirmar() {
    if (!servicio || !day || slot === null || !sedeId) return;
    setSaving(true);
    setErrorMsg(null);
    const inicio = new Date(day);
    inicio.setHours(Math.floor(slot / 60), slot % 60, 0, 0);
    const res = await createReserva({
      sede: sedeId,
      barberoId: barbero?.id ?? "",
      servicioId: servicio.id,
      clienteNombre: nombre,
      telefono,
      email,
      inicioISO: inicio.toISOString(),
    });
    setSaving(false);
    if (res.ok) {
      setStep("ok");
      return;
    }
    // Si el cupo se tomó mientras llenaba los datos, vuelve a elegir horario.
    setErrorMsg(res.error ?? "No se pudo reservar");
    setSlot(null);
    setStep("horario");
  }

  const cats = Object.keys(categorias) as Categoria[];

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-center font-display text-5xl font-semibold uppercase">Reservar cita</h1>

      {step !== "ok" && (
        <div className="mx-auto mt-8 flex max-w-xl items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs ${
                    i <= stepIndex ? "border-accent bg-accent text-on-accent" : "border-line text-muted"
                  }`}
                >
                  {i + 1}
                </div>
                <span className={`mt-1.5 text-[10px] uppercase tracking-wide ${i <= stepIndex ? "text-ink" : "text-muted"}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`mx-1 h-px flex-1 ${i < stepIndex ? "bg-accent" : "bg-line"}`} />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-10">
        {step === "sede" && (
          <Section title="¿En qué sede?">
            <div className="grid gap-4 sm:grid-cols-2">
              {sedes.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSedeId(s.id);
                    setStep("barbero");
                  }}
                  className="rounded-2xl border border-line bg-panel p-7 text-left transition hover:border-accent/50"
                >
                  <div className="text-xs uppercase tracking-[0.3em] text-accent">Sede</div>
                  <div className="mt-2 font-display text-2xl">{s.nombre}</div>
                </button>
              ))}
            </div>
          </Section>
        )}

        {step === "barbero" && (
          <Section title="Elegí tu barbero" onBack={() => setStep("sede")}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {sedeBarberos.map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    setBarbero(b);
                    setStep("servicio");
                  }}
                  className="group overflow-hidden rounded-2xl border border-line bg-panel text-left transition hover:border-accent/50"
                >
                  <div className="relative aspect-[4/5] w-full overflow-hidden">
                    {b.fotoUrl ? (
                      <Image
                        src={b.fotoUrl}
                        alt={b.nombre}
                        fill
                        sizes="(max-width:640px) 50vw, 33vw"
                        className="object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-elevated to-panel">
                        <span className="font-display text-6xl text-accent/30">{b.nombre.charAt(0)}</span>
                      </div>
                    )}
                    {b.destacado && (
                      <span className="absolute left-2.5 top-2.5 rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-on-accent">
                        ★ Top
                      </span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-display text-xl text-white">{b.nombre}</span>
                        {b.rating ? (
                          <span className="text-xs text-accent-soft">★ {b.rating.toFixed(1)}</span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 line-clamp-1 text-[11px] text-white/70">
                        {b.especialidades.slice(0, 3).join(" · ")}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Section>
        )}

        {step === "servicio" && (
          <Section
            title="¿Qué servicio?"
            onBack={() => setStep(initialBarbero ? "servicio" : "barbero")}
            hideBack={!!initialBarbero}
          >
            <div className="max-h-[60vh] space-y-6 overflow-y-auto pr-1">
              {cats.map((cat) => {
                const list = servicios.filter((s) => s.categoria === cat);
                if (!list.length) return null;
                return (
                  <div key={cat}>
                    <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-accent">{categorias[cat]}</div>
                    <div className="space-y-2">
                      {list.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => {
                            setServicio(s);
                            setStep("horario");
                          }}
                          className="flex w-full items-center gap-3 rounded-xl border border-line bg-panel p-2.5 pr-4 text-left transition hover:border-accent/50"
                        >
                          <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                            <Image
                              src={fotoServicio(s.id)}
                              alt=""
                              fill
                              sizes="56px"
                              className="object-cover"
                            />
                          </span>
                          <span className="flex-1 pr-3 text-sm">{s.nombre}</span>
                          <span className="flex shrink-0 items-center gap-3 text-sm">
                            <span className="text-muted">{fmtDur(s.duracionMin)}</span>
                            <span className="text-accent-soft">
                              {s.desde ? "desde " : ""}
                              {cop(sedeId ? s.precios[sedeId] : s.precios["parque-venezuela"])}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {step === "horario" && servicio && (
          <Section title="Fecha y hora" onBack={() => setStep("servicio")}>
            <p className="mb-5 text-sm text-muted">
              {servicio.nombre} · dura <b className="text-ink">{fmtDur(servicio.duracionMin)}</b> · horario 9:00 am – 8:00 pm
            </p>

            {errorMsg && (
              <div className="mb-5 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent-soft">
                {errorMsg}
              </div>
            )}

            <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
              {days.map((d) => {
                const active = day?.toDateString() === d.toDateString();
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => {
                      setDay(d);
                      setSlot(null);
                      setErrorMsg(null);
                    }}
                    className={`flex shrink-0 flex-col items-center rounded-xl border px-4 py-2.5 ${
                      active ? "border-accent bg-accent/10" : "border-line hover:border-accent/40"
                    }`}
                  >
                    <span className="text-[11px] uppercase text-muted">{DOW[d.getDay()]}</span>
                    <span className="font-display text-xl">{d.getDate()}</span>
                    <span className="text-[10px] text-muted">{MON[d.getMonth()]}</span>
                  </button>
                );
              })}
            </div>

            {!day ? (
              <p className="text-sm text-muted">Elegí un día para ver los horarios disponibles.</p>
            ) : cargandoSlots ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg border border-line/50 bg-panel" />
                ))}
              </div>
            ) : sinCupos ? (
              <p className="rounded-xl border border-line bg-panel px-4 py-3 text-sm text-muted">
                No quedan horarios disponibles este día. Probá con otra fecha
                {barbero ? " u otro barbero" : ""}.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((t) => {
                  const isTaken = taken.has(t);
                  const active = slot === t;
                  return (
                    <button
                      key={t}
                      disabled={isTaken}
                      onClick={() => {
                        setSlot(t);
                        setErrorMsg(null);
                      }}
                      className={`rounded-lg border py-2.5 text-sm transition ${
                        isTaken
                          ? "cursor-not-allowed border-line/50 text-muted/40 line-through"
                          : active
                            ? "border-accent bg-accent text-on-accent"
                            : "border-line hover:border-accent/50"
                      }`}
                    >
                      {fmtTime(t)}
                    </button>
                  );
                })}
              </div>
            )}

            {slot !== null && (
              <div className="mt-7 text-right">
                <button
                  onClick={() => setStep("datos")}
                  className="rounded-full bg-accent px-7 py-3 text-sm font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft"
                >
                  Continuar
                </button>
              </div>
            )}
          </Section>
        )}

        {step === "datos" && servicio && day && slot !== null && (
          <Section title="Tus datos" onBack={() => setStep("horario")}>
            <Resumen
              barberoNombre={barbero?.nombre ?? "Cualquiera disponible"}
              servicio={servicio}
              sedeId={sedeId}
              sedeNombre={sedeNombre}
              day={day}
              slot={slot}
            />
            <div className="mt-6 space-y-3">
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Tu nombre"
                className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-ink placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Tu celular (WhatsApp)"
                inputMode="tel"
                className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-ink placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="Tu correo (para recordatorios)"
                className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-ink placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </div>
            <button
              disabled={!nombre.trim() || !telefono.trim() || saving}
              onClick={confirmar}
              className="mt-6 w-full rounded-full bg-accent py-3.5 text-sm font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Confirmando…" : "Confirmar reserva"}
            </button>
          </Section>
        )}

        {step === "ok" && servicio && day && slot !== null && (
          <div className="mx-auto max-w-md text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-accent text-3xl text-accent">
              ✓
            </div>
            <h2 className="font-display text-4xl font-semibold">¡Cita confirmada!</h2>
            <p className="mt-2 text-muted">Gracias, {nombre.split(" ")[0]}. Te esperamos.</p>
            <div className="mt-7 text-left">
              <Resumen
                barberoNombre={barbero?.nombre ?? "Cualquiera disponible"}
                servicio={servicio}
                sedeId={sedeId}
                sedeNombre={sedeNombre}
                day={day}
                slot={slot}
              />
            </div>
            <p className="mt-5 text-xs text-muted">
              Te esperamos. Si no podés asistir, avisanos: liberamos el cupo para el siguiente.
            </p>
            <div className="mt-7 flex justify-center gap-3">
              <button onClick={reset} className="rounded-full border border-line px-6 py-3 text-sm transition hover:border-accent/50">
                Reservar otra
              </button>
              <Link href="/" className="rounded-full border border-accent/50 px-6 py-3 text-sm text-accent-soft transition hover:bg-accent/10">
                Volver al inicio
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  onBack,
  hideBack,
}: {
  title: string;
  children: React.ReactNode;
  onBack?: () => void;
  hideBack?: boolean;
}) {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        {onBack && !hideBack && (
          <button onClick={onBack} className="text-sm text-muted transition hover:text-ink">
            ←
          </button>
        )}
        <h2 className="font-display text-2xl italic">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Resumen({
  barberoNombre,
  servicio,
  sedeId,
  sedeNombre,
  day,
  slot,
}: {
  barberoNombre: string;
  servicio: Servicio;
  sedeId: SedeId | null;
  sedeNombre: string;
  day: Date;
  slot: number;
}) {
  const precio = sedeId ? servicio.precios[sedeId] : null;
  return (
    <div className="rounded-2xl border border-line bg-panel p-5 text-sm">
      <Row k="Servicio" v={servicio.nombre} />
      <Row k="Barbero" v={barberoNombre} />
      <Row k="Sede" v={sedeNombre} />
      <Row k="Fecha" v={`${DOW[day.getDay()]} ${day.getDate()} ${MON[day.getMonth()]}`} />
      <Row k="Hora" v={`${fmtTime(slot)} – ${fmtTime(slot + servicio.duracionMin)} (${fmtDur(servicio.duracionMin)})`} />
      {precio !== null && (
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <span className="text-muted">Total</span>
          <span className="font-display text-2xl text-accent-soft">{cop(precio)}</span>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-muted">{k}</span>
      <span className="text-right text-ink">{v}</span>
    </div>
  );
}

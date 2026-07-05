"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { categorias } from "@/lib/data/seed";
import { createReserva, getDisponibilidad, getLiveBarberStatuses } from "@/lib/actions";
import { chatConAsistente } from "@/lib/ai-actions";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Sede, SedeId, Servicio, Barbero, Categoria } from "@/lib/data/types";
import { cop } from "@/lib/format";
import { BarberCard } from "@/components/BarberCard";
import { PhotoLightbox } from "@/components/ui/PhotoLightbox";
import { AnimatePresence, motion } from "motion/react";
import { OPEN, CLOSE, STEP, DOW, MON, fmtTime, fmtDur, buildSlots, computeTaken, nextDays } from "@/lib/slots";

const sedeFotoFrente: Record<string, string> = {
  "parque-venezuela": "/sedes/parque-venezuela-frente.jpg",
  "plaza-de-la-paz": "/sedes/plaza-de-la-paz-frente.jpg",
};

const sedeFotoInterior: Record<string, string> = {
  "parque-venezuela": "/sedes/parque-venezuela-interior.jpg",
  "plaza-de-la-paz": "/sedes/plaza-de-la-paz-interior.jpg",
};

const categoriaFotos: Record<Categoria, string> = {
  cortes: "/cortes/corte-3.jpg",
  barba: "/cortes/corte-2.jpg",
  "cejas-disenos": "/cortes/corte-4.jpg",
  faciales: "/cortes/corte-1.jpg",
  capilar: "/cortes/corte-5.jpg",
  depilacion: "/cortes/corte-6.jpg",
  combos: "/cortes/corte-7.jpg",
};


type Step = "sede" | "barbero" | "servicio" | "horario" | "datos" | "ok";

// Foto por servicio (rota las fotos reales de cortes del cliente, estable por id).
// Provisional hasta tener foto propia por servicio (ver WeiBook cuando reactiven).
function fotoServicio(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `/cortes/corte-${(h % 7) + 1}.jpg`;
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
  initialSedeId,
}: {
  sedes: Sede[];
  barberos: Barbero[];
  servicios: Servicio[];
  initialBarberoId?: string;
  initialSedeId?: SedeId;
}) {
  const initialBarbero = barberos.find((b) => b.id === initialBarberoId) ?? null;
  // La sede de un barbero preseleccionado manda sobre ?sede= si llegan ambos.
  const initialSede = initialBarbero?.sede ?? initialSedeId ?? null;

  const [step, setStep] = useState<Step>(initialBarbero ? "servicio" : initialSede ? "barbero" : "sede");
  const [sedeId, setSedeId] = useState<SedeId | null>(initialSede);
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
  const [selectedCat, setSelectedCat] = useState<Categoria | null>("cortes");
  const [liveStatuses, setLiveStatuses] = useState<Record<string, any>>({});

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: "¡Ajá, bro! Todo bien. Soy el asistente virtual de Barbas & Bigotes. ¿Con qué sede, barbero o servicio te gustaría empezar hoy?" }
  ]);
  const [userInput, setUserInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  async function sendChatMessage() {
    if (!userInput.trim() || chatLoading) return;
    const userMsg = userInput.trim();
    setUserInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);

    try {
      const chatHistory = chatMessages.map((m) => ({
        role: m.role,
        content: m.content
      }));
      chatHistory.push({ role: "user", content: userMsg });

      const res = await chatConAsistente(chatHistory as any);

      let cleanedText = res.text;
      const match = cleanedText.match(/ACTION_CONFIRM:\s*(\{.*\})/);
      if (match) {
        try {
          const actionObj = JSON.parse(match[1]);
          if (actionObj.sedeId) setSedeId(actionObj.sedeId);
          if (actionObj.barberoId) {
            const b = barberos.find((x) => x.id === actionObj.barberoId || x.nombre.toLowerCase().includes(actionObj.barberoId.toLowerCase()));
            if (b) setBarbero(b);
          }
          if (actionObj.servicioId) {
            const s = servicios.find((x) => x.id === actionObj.servicioId);
            if (s) setServicio(s);
          }
          if (actionObj.fecha) {
            const d = new Date(actionObj.fecha);
            const foundDay = days.find((x) => x.toDateString() === d.toDateString());
            if (foundDay) setDay(foundDay);
          }
          if (actionObj.hora !== undefined) {
            // El asistente puede mandar cualquier cosa: solo aceptamos minutos
            // válidos (dentro del horario y alineados al paso); si no, se ignora
            // en vez de terminar en setHours(NaN) al confirmar.
            const h = Number(actionObj.hora);
            if (Number.isFinite(h) && h >= OPEN && h < CLOSE && h % STEP === 0) {
              setSlot(h);
            }
          }

          setStep("datos");
          setChatOpen(false);
          setErrorMsg("✨ ¡El asistente de IA pre-llenó tus opciones! Verifica tus datos para confirmar.");
        } catch (err) {
          console.error("Error parsing AI action JSON:", err);
        }
        cleanedText = cleanedText.replace(/ACTION_CONFIRM:\s*\{.*\}/g, "").trim();
      }

      setChatMessages((prev) => [...prev, { role: "assistant", content: cleanedText }]);
    } catch (err) {
      console.error(err);
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Uy bro, se me cayó la red. Inténtalo de nuevo en un momento." }]);
    } finally {
      setChatLoading(false);
    }
  }

  const sedeBarberos = useMemo(
    () => barberos.filter((b) => b.sede === sedeId),
    [barberos, sedeId],
  );
  const days = useMemo(() => nextDays(7), []);
  const slots = useMemo(() => (servicio ? buildSlots(servicio.duracionMin) : ([] as number[])), [servicio]);

  // Cargar estados en vivo de los barberos
  useEffect(() => {
    const fetchLiveStatuses = async () => {
      try {
        const statuses = await getLiveBarberStatuses();
        const record: Record<string, typeof statuses[0]> = {};
        statuses.forEach((s) => {
          record[s.id] = s;
        });
        setLiveStatuses(record);
      } catch (err) {
        console.error("Error fetching live statuses in wizard:", err);
      }
    };

    fetchLiveStatuses();

    const sb = supabaseBrowser();
    const sub = sb
      .channel("wizard-live-statuses")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservas" },
        () => {
          fetchLiveStatuses();
        }
      )
      .subscribe();

    const interval = setInterval(fetchLiveStatuses, 60000);

    return () => {
      sb.removeChannel(sub);
      clearInterval(interval);
    };
  }, []);

  // Disponibilidad real: trae los rangos ocupados del barbero ese día y se suscribe en tiempo real.
  useEffect(() => {
    if (!day || !barbero) {
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

    // Suscripción en tiempo real a las reservas de este barbero
    const sb = supabaseBrowser();
    const sub = sb
      .channel(`wizard-reservas-${barbero.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservas", filter: `barbero_id=eq.${barbero.id}` },
        () => {
          fetchSlots();
        }
      )
      .subscribe();

    // Fallback de re-consulta periódica cada 30 segundos
    const poll = setInterval(fetchSlots, 30000);
    return () => {
      cancel = true;
      sb.removeChannel(sub);
      clearInterval(poll);
    };
  }, [day, barbero]);

  const taken = useMemo(() => {
    if (!day) return new Set<number>();
    return computeTaken({ slots, ocupados, day, duracionMin: servicio?.duracionMin ?? STEP });
  }, [day, ocupados, slots, servicio]);

  const currentActiveBooking = useMemo(() => {
    const now = new Date();
    if (!day || day.toDateString() !== now.toDateString() || !ocupados.length) return null;
    return ocupados.find((o) => {
      const start = new Date(o.inicio).getTime();
      const end = new Date(o.fin).getTime();
      const cur = now.getTime();
      return cur >= start && cur <= end;
    });
  }, [day, ocupados]);

  const sinCupos = slots.length > 0 && taken.size >= slots.length;

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const sedeNombre = sedes.find((s) => s.id === sedeId)?.nombre ?? "—";

  function reset() {
    setStep(initialBarbero ? "servicio" : initialSede ? "barbero" : "sede");
    setServicio(null);
    setSelectedCat("cortes");
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
    <div className={`mx-auto px-6 py-6 sm:py-8 transition-all duration-500 ${
      step === "servicio" ? "max-w-5xl" : "max-w-3xl"
    }`}>
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      
      {/* Encabezado Principal / Sede Seleccionada Banner (En la parte superior) */}
      {sedeId && step !== "sede" && step !== "ok" ? (
        <div className="mx-auto mb-5 max-w-xl overflow-hidden rounded-2xl border border-line bg-panel shadow-lg">
          <div className="relative h-20 w-full sm:h-24">
            <Image
              src={sedeFotoFrente[sedeId] || "/sedes/parque-venezuela-frente.jpg"}
              alt={sedeNombre}
              fill
              className="object-cover opacity-55"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-panel via-panel/30 to-transparent" />
            <div className="absolute inset-x-5 bottom-3 flex items-end justify-between z-10">
              <div>
                <span className="text-[9px] uppercase tracking-[0.2em] text-accent-soft">Sede seleccionada</span>
                <h3 className="font-display text-xl font-semibold uppercase leading-tight text-white">{sedeNombre}</h3>
              </div>
              <PhotoLightbox
                src={sedeFotoInterior[sedeId] || "/sedes/parque-venezuela-interior.jpg"}
                alt={`Interior sede ${sedeNombre}`}
                title={sedeNombre}
                id={`modal-${sedeId}`}
              >
                {(open) => (
                  <button
                    onClick={open}
                    className="rounded-full bg-white/10 hover:bg-white/20 transition border border-white/20 px-3 py-1 text-[10px] font-semibold text-white backdrop-blur-sm"
                  >
                    Ver local 📷
                  </button>
                )}
              </PhotoLightbox>
            </div>
          </div>
        </div>
      ) : (
        <h1 className="text-center font-display text-4xl sm:text-5xl font-semibold uppercase mb-5">Reservar cita</h1>
      )}

      {/* Barra de progreso de los pasos */}
      {step !== "ok" && (
        <div className="mx-auto mt-0 mb-6 flex max-w-xl items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border text-xs ${
                    i <= stepIndex ? "border-accent bg-accent text-on-accent" : "border-line text-muted"
                  }`}
                >
                  {i + 1}
                </div>
                <span className={`mt-1.5 text-[9px] sm:text-[10px] uppercase tracking-wide ${i <= stepIndex ? "text-ink" : "text-muted"}`}>
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

      <div className="mt-6 sm:mt-8">
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
          <Section title={`Elegí tu barbero · ${sedeNombre}`} onBack={() => setStep("sede")}>
            {sedeBarberos.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 items-start">
                {sedeBarberos.map((b) => (
                  <BarberCard
                    key={b.id}
                    barbero={b}
                    liveStatus={liveStatuses[b.id]}
                    onSelect={(elegido) => {
                      setBarbero(elegido);
                      setStep("servicio");
                    }}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-line bg-panel px-4 py-3 text-sm text-muted">
                Esta sede no tiene barberos cargados todavía.
              </p>
            )}
          </Section>
        )}

        {step === "servicio" && (
          <Section
            title="¿Qué servicio?"
            hideBack={true}
          >
            {/* Custom Back Nav Bar */}
            <div className="mb-5 flex items-center gap-3">
              {/* Back to barbero (Desktop) */}
              {!initialBarbero && (
                <button
                  type="button"
                  onClick={() => setStep("barbero")}
                  className="hidden md:flex items-center gap-1 text-xs text-accent-soft hover:text-accent transition uppercase tracking-wider"
                >
                  ← Volver a Barberos
                </button>
              )}
              
              {/* Back to barbero (Mobile, when selectedCat is null) */}
              {!initialBarbero && !selectedCat && (
                <button
                  type="button"
                  onClick={() => setStep("barbero")}
                  className="flex md:hidden items-center gap-1 text-xs text-accent-soft hover:text-accent transition uppercase tracking-wider"
                >
                  ← Volver a Barberos
                </button>
              )}

              {/* Back to categories (Mobile, when selectedCat is set) */}
              {selectedCat && (
                <button
                  type="button"
                  onClick={() => setSelectedCat(null)}
                  className="flex md:hidden items-center gap-1 text-xs text-accent-soft hover:text-accent transition uppercase tracking-wider"
                >
                  ← Volver a Categorías
                </button>
              )}
            </div>

            {/* Split layout container */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-6 items-start h-[430px] md:h-[480px] overflow-hidden">
              
              {/* Category selector column */}
              <div className={`md:col-span-4 space-y-2 h-full overflow-y-auto no-scrollbar pb-6 ${selectedCat ? "hidden md:block" : "block"}`}>
                <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-accent-soft">Categorías</div>
                <div className="grid grid-cols-2 gap-2 md:flex md:flex-col md:space-y-2">
                  {cats.map((cat) => {
                    const list = servicios.filter((s) => s.categoria === cat);
                    if (!list.length) return null;
                    const isActive = selectedCat === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCat(cat)}
                        className={`group relative flex h-11 md:h-12 w-full items-center justify-between overflow-hidden rounded-xl border transition-all duration-300 text-left ${
                          isActive 
                            ? "border-accent bg-accent/10 shadow-[0_0_15px_rgba(210,63,52,0.2)]" 
                            : "border-line bg-panel hover:border-accent/40"
                        }`}
                      >
                        <Image
                          src={categoriaFotos[cat] || "/cortes/corte-3.jpg"}
                          alt=""
                          fill
                          sizes="(max-width: 768px) 50vw, 33vw"
                          className={`object-cover transition-transform duration-500 group-hover:scale-105 ${
                            isActive ? "opacity-60" : "opacity-35 group-hover:opacity-50"
                          }`}
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
                        
                        <div className="relative z-10 flex w-full items-center justify-between px-3.5">
                          <span className="font-display text-xs md:text-[13px] font-semibold uppercase tracking-wider text-white">
                            {categorias[cat]}
                          </span>
                          <span className="text-[10px] text-accent-soft hidden md:inline">
                            {list.length} {list.length === 1 ? "serv" : "servs"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Services list column */}
              <div className={`md:col-span-8 space-y-3 h-full flex flex-col ${selectedCat ? "block" : "hidden md:block"}`}>
                {selectedCat ? (
                  <>
                    <div className="flex items-center justify-between border-b border-line/40 pb-2">
                      <div>
                        <span className="text-[9px] uppercase tracking-[0.2em] text-accent-soft md:inline hidden">Servicios disponibles</span>
                        <h3 className="font-display text-lg md:text-xl font-bold uppercase text-white leading-none">
                          {categorias[selectedCat]}
                        </h3>
                      </div>
                      <span className="text-xs text-muted">
                        {servicios.filter((s) => s.categoria === selectedCat).length} opciones
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 overflow-y-auto no-scrollbar flex-1 content-start pb-8">
                      {servicios
                        .filter((s) => s.categoria === selectedCat)
                        .map((s) => {
                          const nameParts = s.nombre.split(": ");
                          const title = nameParts[0];
                          const desc = nameParts.slice(1).join(": ");
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setServicio(s);
                                setStep("horario");
                              }}
                              className="group flex flex-col overflow-hidden rounded-xl border border-line bg-panel text-left transition hover:border-accent/50 hover:bg-accent/[0.01] hover:-translate-y-1 duration-300 shadow-md"
                            >
                              {/* Imagen del Servicio */}
                              <div className="relative aspect-[16/10] w-full overflow-hidden bg-ink/10">
                                <Image
                                  src={fotoServicio(s.id)}
                                  alt={title}
                                  fill
                                  sizes="(max-width: 768px) 50vw, 33vw"
                                  className="object-cover transition duration-700 ease-out group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
                                
                                {/* Badge de Duración flotante */}
                                <span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
                                  {fmtDur(s.duracionMin)}
                                </span>
                              </div>

                              {/* Contenido */}
                              <div className="flex flex-1 flex-col justify-between p-3.5">
                                <div>
                                  <h4 className="font-display text-[12.5px] sm:text-[13.5px] font-semibold text-white leading-snug group-hover:text-accent-soft transition duration-300">
                                    {title}
                                  </h4>
                                  {desc && (
                                    <p className="mt-1.5 text-[9.5px] sm:text-[10px] text-muted/70 leading-relaxed line-clamp-2">
                                      {desc}
                                    </p>
                                  )}
                                </div>
                                
                                <div className="mt-4 flex items-center justify-between border-t border-line/45 pt-2.5">
                                  <span className="text-[9.5px] uppercase tracking-wider text-muted">Precio</span>
                                  <span className="text-[11.5px] sm:text-[12.5px] font-bold text-accent-soft">
                                    {s.desde ? "Desde " : ""}
                                    {cop(sedeId ? s.precios[sedeId] : s.precios["parque-venezuela"])}
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </>
                ) : (
                  <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-line p-6 text-center text-muted hidden md:flex">
                    <svg className="h-8 w-8 opacity-40 mb-2" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21m0 0l-.813-5.096L9 21zm0 0h4.991m-4.99m3.853-5.61a3.5 3.5 0 11-4.823-4.824 3.5 3.5 0 014.823 4.824z" />
                    </svg>
                    Selecciona una categoría de la izquierda para ver sus servicios.
                  </div>
                )}
              </div>
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
            ) : (
              <>
                {/* Live barber status indicator for today */}
                {day.toDateString() === new Date().toDateString() && barbero && (
                  <div className="mb-4 flex items-center gap-2 rounded-xl border border-line bg-panel p-3">
                    <span className={`h-2 w-2 rounded-full ${currentActiveBooking ? "bg-accent animate-pulse" : "bg-emerald-500"}`} />
                    <span className="text-[11px] font-semibold text-ink/90">
                      {currentActiveBooking
                        ? `En vivo: ${barbero.nombre} está actualmente atendiendo una cita (libre aprox. ${new Date(currentActiveBooking.fin).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })})`
                        : `En vivo: ${barbero.nombre} se encuentra libre y listo para atender en este momento.`}
                    </span>
                  </div>
                )}

                {cargandoSlots ? (
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
              </>
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

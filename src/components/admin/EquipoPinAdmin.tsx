"use client";

import { botonClases } from "@/components/ui/Boton";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setearPinBarbero, desbloquearBarbero } from "@/lib/barbero-auth";
import { actualizarPerfilBarbero } from "@/lib/actions";
import type { Barbero, Sede } from "@/lib/data/types";
import { partirEspecialidades, MAX_ESPECIALIDADES } from "@/lib/admin-reglas";
import { CaraBarbero } from "@/components/staff/Elegir";

type Estado = Record<string, { tienePin: boolean; bloqueado: boolean }>;

export function EquipoPinAdmin({
  barberos,
  sedes,
  estado,
  ausentesHoy = [],
}: {
  barberos: Barbero[];
  sedes: Sede[];
  estado: Estado;
  /** Ids de los que NO vienen hoy: se marca en su tarjeta. */
  ausentesHoy?: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);
  // Editor de perfil (bio + especialidades), independiente del editor de PIN.
  const [perfilEditing, setPerfilEditing] = useState<string | null>(null);
  const [bioDraft, setBioDraft] = useState("");
  const [espDraft, setEspDraft] = useState("");

  function abrirPerfil(b: Barbero) {
    if (perfilEditing === b.id) {
      setPerfilEditing(null);
      return;
    }
    setPerfilEditing(b.id);
    setBioDraft(b.bio ?? "");
    setEspDraft(b.especialidades.join("\n"));
    setEditing(null);
    setMsg(null);
  }

  async function guardarPerfil(barberoId: string) {
    setBusy(true);
    setMsg(null);
    // Mismo partido que usa el server (admin-reglas): si el cliente separa
    // distinto, el admin ve una cosa y se guarda otra.
    const especialidades = partirEspecialidades(espDraft);
    const res = await actualizarPerfilBarbero({ barberoId, bio: bioDraft, especialidades });
    setBusy(false);
    if (res.ok) {
      setPerfilEditing(null);
      // El server avisa si descartó algo (máximo, repetidas). Antes respondía
      // "Perfil guardado" a secas y el recorte pasaba inadvertido.
      setMsg({ id: barberoId, text: res.aviso ?? "Perfil guardado", ok: true });
      router.refresh();
    } else {
      setMsg({ id: barberoId, text: res.error ?? "Error", ok: false });
    }
  }

  async function guardar(barberoId: string) {
    setBusy(true);
    setMsg(null);
    const res = await setearPinBarbero(barberoId, pin);
    setBusy(false);
    if (res.ok) {
      setEditing(null);
      setPin("");
      setMsg({ id: barberoId, text: "PIN guardado", ok: true });
      router.refresh();
    } else {
      setMsg({ id: barberoId, text: res.error ?? "Error", ok: false });
    }
  }

  async function desbloquear(barberoId: string) {
    setBusy(true);
    setMsg(null);
    const res = await desbloquearBarbero(barberoId);
    setBusy(false);
    setMsg({ id: barberoId, text: res.ok ? "Desbloqueado" : res.error ?? "Error", ok: res.ok });
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-6">
      {sedes.map((s) => {
        const list = barberos.filter((b) => b.sede === s.id);
        if (!list.length) return null;
        return (
          <section key={s.id}>
            <h2 className="mb-3 eyebrow">{s.nombre}</h2>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {list.map((b) => {
                const e = estado[b.id];
                const ausente = ausentesHoy.includes(b.id);
                const abierto = editing === b.id || perfilEditing === b.id;
                return (
                  <div
                    key={b.id}
                    className={`rounded-2xl border bg-panel p-4 transition ${
                      abierto ? "border-accent/50 sm:col-span-2" : "border-line"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <CaraBarbero b={b} size={52} aro />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-display text-[17px] font-bold uppercase leading-tight">
                          {b.nombre}
                        </div>
                        {/* Estado en señales, no en una línea de texto corrida:
                            el dueño busca "¿quién no tiene PIN?" y antes tenía
                            que leer seis frases iguales para encontrarlo. */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide ${
                              e?.tienePin ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn"
                            }`}
                          >
                            {e?.tienePin ? "PIN listo" : "Sin PIN"}
                          </span>
                          {e?.bloqueado && (
                            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide text-accent-soft">
                              Bloqueado
                            </span>
                          )}
                          {ausente && (
                            <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide text-muted">
                              Hoy no viene
                            </span>
                          )}
                          <span className="text-[12px] text-muted">
                            {b.especialidades.length
                              ? `${b.especialidades.length} especialidades`
                              : "sin especialidades"}
                            {b.bio ? " · con bio" : ""}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {e?.bloqueado && (
                        <button onClick={() => desbloquear(b.id)} disabled={busy}
                          className="min-h-9 rounded-full border border-accent/40 bg-accent/[0.07] px-3 text-[12px] font-semibold text-accent-soft transition hover:bg-accent/15 disabled:opacity-50">
                          Desbloquear
                        </button>
                      )}
                      <button onClick={() => abrirPerfil(b)}
                        className={botonClases("secundario", "sm")}>
                        {perfilEditing === b.id ? "Cerrar perfil" : "Perfil y especialidades"}
                      </button>
                      {/* Cambiar el PIN es raro (una vez por barbero): no merece el
                          botón rojo de acción principal repetido seis veces. */}
                      <button onClick={() => { setEditing(editing === b.id ? null : b.id); setPin(""); setPerfilEditing(null); setMsg(null); }}
                        className={botonClases(e?.tienePin ? "secundario" : "primario", "sm")}>
                        {e?.tienePin ? "Cambiar PIN" : "Poner PIN"}
                      </button>
                    </div>
                    {editing === b.id && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          value={pin}
                          onChange={(ev) => setPin(ev.target.value.replace(/\D/g, "").slice(0, 6))}
                          inputMode="numeric"
                          placeholder="6 dígitos"
                          className="w-32 rounded-lg border border-line bg-bg px-3 py-2 text-center tracking-[0.3em] text-ink placeholder:text-muted placeholder:tracking-normal focus:border-accent focus:outline-none"
                        />
                        <button onClick={() => guardar(b.id)} disabled={busy || pin.length !== 6}
                          className="rounded-full bg-accent px-4 py-2 text-xs font-semibold uppercase text-on-accent transition hover:bg-accent-soft disabled:opacity-50">
                          {busy ? "…" : "Guardar"}
                        </button>
                        <button onClick={() => { setEditing(null); setPin(""); }} className="text-xs text-muted transition hover:text-ink">
                          Cancelar
                        </button>
                      </div>
                    )}
                    {perfilEditing === b.id && (
                      <div className="mt-3 space-y-3 border-t border-line pt-3">
                        <label className="block">
                          <span className="mb-1 block text-[12px] uppercase tracking-[0.2em] text-muted">Bio</span>
                          <textarea
                            value={bioDraft}
                            onChange={(ev) => setBioDraft(ev.target.value)}
                            rows={3}
                            placeholder="Cuenta quién es este barbero (opcional)."
                            className="w-full resize-y rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[12px] uppercase tracking-[0.2em] text-muted">
                            Especialidades <span className="normal-case tracking-normal text-muted/70">(una por línea o separadas por coma · máx {MAX_ESPECIALIDADES})</span>
                          </span>
                          <textarea
                            value={espDraft}
                            onChange={(ev) => setEspDraft(ev.target.value)}
                            rows={3}
                            placeholder={"Fade\nBarba\nDiseños"}
                            className="w-full resize-y rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
                          />
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                          <button onClick={() => guardarPerfil(b.id)} disabled={busy}
                            className="rounded-full bg-accent px-4 py-2 text-xs font-semibold uppercase text-on-accent transition hover:bg-accent-soft disabled:opacity-50">
                            {busy ? "…" : "Guardar perfil"}
                          </button>
                          <button onClick={() => setPerfilEditing(null)} className="text-xs text-muted transition hover:text-ink">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                    {msg?.id === b.id && (
                      <div className={`mt-2 text-xs ${msg.ok ? "text-ok" : "text-accent-soft"}`}>{msg.text}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

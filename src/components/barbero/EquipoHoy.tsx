"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Hoja } from "@/components/ui/Hoja";
import { Boton } from "@/components/ui/Boton";
import { bloquearHoras, quitarBloqueo, marcarCobertura, quitarCobertura, moverCita, type ActionResult } from "@/lib/actions";
import { horaBogota } from "@/lib/format";
import type { AgendaItem } from "@/lib/data/queries";

/*
  "Equipo de hoy" del mostrador (pedido del dueño, 9-oct: "que haya funcionalidades
  por si un barbero no va; hace poquito uno se fue a la otra sede y lo reemplazó").
  Todo lo de acá vale SOLO por hoy:
    · No vino → bloqueo de día entero (el mismo del calendario): la web deja de
      ofrecerlo y el mostrador no lo muestra libre.
    · Sus citas de hoy → se pasan a otro barbero (a la misma hora), una por una o
      todas de un toque. Cada cita que no cabe dice por qué.
    · Traer de la otra sede → cobertura del día (0081): aparece acá para walk-ins,
      ventas y citas; en su sede, ese día, no se le reserva por la web.
*/

export type PersonaEquipo = { id: string; nombre: string; fotoUrl: string | null };

export type EquipoHoy = {
  sede: string;
  sedeNombre: string;
  /** Trabajan hoy acá: los de siempre que vinieron + los que vienen a cubrir (con su sede). */
  presentes: (PersonaEquipo & { visitaDe: string | null })[];
  /** No vinieron hoy (bloqueo de día entero). */
  ausentes: (PersonaEquipo & { bloqueoId: string })[];
  /** De esta sede, cubriendo hoy en la otra. */
  fuera: (PersonaEquipo & { sedeNombre: string })[];
  /** De la otra sede, que se pueden traer hoy. */
  traibles: (PersonaEquipo & { sedeNombre: string })[];
  hoy: string;
};

const ACTIVAS = ["pendiente", "confirmada"];

function Cara({ p, gris = false }: { p: PersonaEquipo; gris?: boolean }) {
  return p.fotoUrl ? (
    <Image
      src={p.fotoUrl}
      alt=""
      width={44}
      height={44}
      className={`h-11 w-11 shrink-0 rounded-full object-cover object-top ring-2 ring-line ${gris ? "grayscale" : ""}`}
    />
  ) : (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-elevated text-[14px] font-bold text-ink ring-2 ring-line">
      {p.nombre.charAt(0).toUpperCase()}
    </span>
  );
}

const nombreCorto = (n: string) => n.split(" ")[0];
const select =
  "min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 text-[14px] text-ink focus:border-accent focus:outline-none";

export function EquipoHoyHoja({ equipo, agenda, onCerrar }: { equipo: EquipoHoy; agenda: AgendaItem[]; onCerrar: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  // "No vino" tapa la agenda del día: dos toques, como "No llegó" en Recepción.
  const [armado, setArmado] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; txt: string } | null>(null);
  const [destino, setDestino] = useState<Record<string, string>>({});

  async function correr(llave: string, fn: () => Promise<ActionResult>, okTxt?: string) {
    setBusy(llave);
    setMsg(null);
    const r = await fn().catch(() => ({ ok: false, error: "No se pudo. Revisa la conexión e intenta de nuevo." }) as ActionResult);
    setBusy(null);
    setArmado(null);
    if (!r.ok) setMsg({ ok: false, txt: r.error ?? "No se pudo." });
    else {
      if (r.aviso || okTxt) setMsg({ ok: true, txt: r.aviso ?? okTxt ?? "" });
      router.refresh();
    }
    return r;
  }

  const pendientesDe = (id: string) =>
    agenda
      .filter((r) => r.barberoId === id && ACTIVAS.includes(r.estado))
      .sort((a, b) => a.inicio.localeCompare(b.inicio));

  // Pasar citas a otro barbero, a la MISMA hora. Una por una para poder decir
  // cuál no cupo (el otro ya tenía a alguien a esa hora) sin frenar las demás.
  async function pasar(citas: AgendaItem[], a: string, llave: string) {
    if (!a) return setMsg({ ok: false, txt: "Elige a quién se las pasas." });
    setBusy(llave);
    setMsg(null);
    const fallas: string[] = [];
    for (const r of citas) {
      const res = await moverCita({ reservaId: r.id, inicioISO: r.inicio, barberoId: a }).catch(
        () => ({ ok: false, error: "sin conexión" }) as ActionResult,
      );
      if (!res.ok) fallas.push(`${horaBogota(r.inicio)} (${r.cliente || "cliente"}): ${res.error}`);
    }
    setBusy(null);
    const quien = nombreCorto(equipo.presentes.find((p) => p.id === a)?.nombre ?? "");
    const pasadas = citas.length - fallas.length;
    setMsg(
      fallas.length
        ? { ok: false, txt: `${pasadas ? `${pasadas} pasaron a ${quien}. ` : ""}No se pudo: ${fallas.join(" · ")}` }
        : { ok: true, txt: `${pasadas === 1 ? "La cita pasó" : `Las ${pasadas} citas pasaron`} a ${quien}. Avísale al cliente si hace falta.` },
    );
    router.refresh();
  }

  const opcionesPara = (sin: string) => equipo.presentes.filter((p) => p.id !== sin);

  return (
    <Hoja titulo={`Equipo de hoy · ${equipo.sedeNombre}`} onCerrar={onCerrar} ancho="max-w-xl">
      <div className="grid gap-6 pb-4">
        <p className="text-[13px] leading-relaxed text-muted">
          Lo que cambies acá vale solo por hoy. Mañana cada uno vuelve a su sede y a su agenda.
        </p>

        {msg && (
          <p
            role="status"
            className={`rounded-xl border px-3.5 py-2.5 text-[13.5px] ${
              msg.ok ? "border-ok/40 bg-ok/10 text-ok" : "border-accent/40 bg-accent/10 text-accent-soft"
            }`}
          >
            {msg.txt}
          </p>
        )}

        {/* ── En el local ── */}
        <section>
          <h3 className="mb-2 font-display text-[18px] font-bold uppercase leading-none text-ink">En el local</h3>
          {equipo.presentes.length === 0 && <p className="text-[13px] text-muted">Nadie marcado como presente.</p>}
          <ul className="divide-y divide-line/60">
            {equipo.presentes.map((p) => {
              const llave = `novino:${p.id}`;
              return (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <Cara p={p} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-ink">{p.nombre}</span>
                    <span className="block text-[12.5px] text-muted">{p.visitaDe ? `Vino de ${p.visitaDe} a cubrir` : "Trabajando hoy"}</span>
                  </span>
                  {p.visitaDe ? (
                    <Boton
                      tam="sm"
                      disabled={busy === `quitar:${p.id}`}
                      onClick={() => correr(`quitar:${p.id}`, () => quitarCobertura(p.id), `${nombreCorto(p.nombre)} volvió a su sede.`)}
                    >
                      Ya no cubre
                    </Boton>
                  ) : (
                    <Boton
                      tam="sm"
                      variante={armado === llave ? "peligro" : "secundario"}
                      disabled={busy === llave}
                      onBlur={() => setArmado((a) => (a === llave ? null : a))}
                      onClick={() =>
                        armado === llave
                          ? correr(llave, () => bloquearHoras({ barberoId: p.id, fecha: equipo.hoy, motivo: "No vino" }))
                          : setArmado(llave)
                      }
                    >
                      {armado === llave ? "¿Seguro? Toca de nuevo" : "No vino hoy"}
                    </Boton>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── No vinieron ── */}
        {equipo.ausentes.length > 0 && (
          <section>
            <h3 className="mb-2 font-display text-[18px] font-bold uppercase leading-none text-warn">No vinieron hoy</h3>
            <ul className="grid gap-3">
              {equipo.ausentes.map((p) => {
                const citas = pendientesDe(p.id);
                const llaveTodas = `todas:${p.id}`;
                return (
                  <li key={p.id} className="rounded-2xl border border-warn/30 bg-warn/[0.05] p-3">
                    <div className="flex items-center gap-3">
                      <Cara p={p} gris />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold text-ink">{p.nombre}</span>
                        <span className="block text-[12.5px] text-warn">
                          {citas.length ? `${citas.length === 1 ? "1 cita" : `${citas.length} citas`} por pasar a otro barbero` : "Sin citas hoy"}
                        </span>
                      </span>
                      <Boton
                        tam="sm"
                        disabled={busy === `vino:${p.id}`}
                        onClick={() => correr(`vino:${p.id}`, () => quitarBloqueo(p.bloqueoId), `${nombreCorto(p.nombre)} quedó como presente.`)}
                      >
                        Sí vino
                      </Boton>
                    </div>

                    {citas.length > 0 && (
                      <div className="mt-3 grid gap-2 border-t border-warn/20 pt-3">
                        {citas.length > 1 && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[13px] font-semibold text-ink">Pasar todas a</span>
                            <select
                              aria-label={`Pasar todas las citas de ${p.nombre} a`}
                              value={destino[llaveTodas] ?? ""}
                              onChange={(e) => setDestino((d) => ({ ...d, [llaveTodas]: e.target.value }))}
                              className={select}
                            >
                              <option value="">Elige…</option>
                              {opcionesPara(p.id).map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.nombre}
                                  {o.visitaDe ? ` (de ${o.visitaDe})` : ""}
                                </option>
                              ))}
                            </select>
                            <Boton tam="sm" variante="primario" disabled={busy === llaveTodas} onClick={() => pasar(citas, destino[llaveTodas] ?? "", llaveTodas)}>
                              {busy === llaveTodas ? "Pasando…" : "Pasar todas"}
                            </Boton>
                          </div>
                        )}
                        {citas.map((r) => {
                          const llave = `cita:${r.id}`;
                          return (
                            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-panel px-3 py-2">
                              <span className="min-w-0 flex-1 basis-[180px]">
                                <span className="block text-[14px] font-bold tabular-nums text-accent-soft">{horaBogota(r.inicio)}</span>
                                <span className="block truncate text-[13px] text-ink">
                                  {r.cliente || "Cliente"} · {r.servicio || "Servicio"}
                                </span>
                              </span>
                              <select
                                aria-label={`Pasar la cita de las ${horaBogota(r.inicio)} a`}
                                value={destino[llave] ?? ""}
                                onChange={(e) => setDestino((d) => ({ ...d, [llave]: e.target.value }))}
                                className={select}
                              >
                                <option value="">Pasar a…</option>
                                {opcionesPara(p.id).map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {o.nombre}
                                    {o.visitaDe ? ` (de ${o.visitaDe})` : ""}
                                  </option>
                                ))}
                              </select>
                              <Boton tam="sm" disabled={busy === llave} onClick={() => pasar([r], destino[llave] ?? "", llave)}>
                                Pasar
                              </Boton>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ── Cubriendo en la otra sede ── */}
        {equipo.fuera.length > 0 && (
          <section>
            <h3 className="mb-2 font-display text-[18px] font-bold uppercase leading-none text-ink">Cubriendo en la otra sede</h3>
            <ul className="divide-y divide-line/60">
              {equipo.fuera.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <Cara p={p} gris />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-ink">{p.nombre}</span>
                    <span className="block text-[12.5px] text-muted">Hoy está en {p.sedeNombre}</span>
                  </span>
                  <Boton
                    tam="sm"
                    disabled={busy === `volver:${p.id}`}
                    onClick={() => correr(`volver:${p.id}`, () => quitarCobertura(p.id), `${nombreCorto(p.nombre)} volvió a esta sede.`)}
                  >
                    Que vuelva
                  </Boton>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Traer de la otra sede ── */}
        {equipo.traibles.length > 0 && (
          <section>
            <h3 className="mb-1 font-display text-[18px] font-bold uppercase leading-none text-ink">Traer de la otra sede</h3>
            <p className="mb-2 text-[12.5px] text-muted">Para cubrir a quien faltó: hoy aparece acá para walk-ins, ventas y citas.</p>
            <ul className="divide-y divide-line/60">
              {equipo.traibles.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <Cara p={p} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-ink">{p.nombre}</span>
                    <span className="block text-[12.5px] text-muted">De {p.sedeNombre}</span>
                  </span>
                  <Boton
                    tam="sm"
                    variante="primario"
                    disabled={busy === `traer:${p.id}`}
                    onClick={() =>
                      correr(`traer:${p.id}`, () => marcarCobertura({ barberoId: p.id, sede: equipo.sede }), `${nombreCorto(p.nombre)} cubre hoy en ${equipo.sedeNombre}.`)
                    }
                  >
                    Traer hoy
                  </Boton>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Hoja>
  );
}

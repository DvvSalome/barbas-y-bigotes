"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { loginBarberoPin, loginSedePin } from "@/lib/barbero-auth";
import type { Barbero, Sede } from "@/lib/data/types";

/** Quién está entrando: el mostrador de una sede o un barbero puntual. */
type Destino = { tipo: "sede"; id: string; nombre: string } | { tipo: "barbero"; id: string; nombre: string };

export function BarberoPinLogin({
  barberos,
  sedes,
  onAdmin,
  onVolver,
}: {
  barberos: Barbero[];
  sedes: Sede[];
  /** Cambiar al login de admin (dentro del gateway unificado /login). */
  onAdmin?: () => void;
  /** Volver al selector de perfil. */
  onVolver?: () => void;
}) {
  const router = useRouter();
  const [destino, setDestino] = useState<Destino | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const elegir = (d: Destino) => {
    setDestino(d);
    setPin("");
    setErr(null);
  };

  async function submit(nuevoPin: string) {
    if (!destino) return;
    setBusy(true);
    setErr(null);
    const res =
      destino.tipo === "sede"
        ? await loginSedePin(destino.id, nuevoPin)
        : await loginBarberoPin(destino.id, nuevoPin);
    setBusy(false);
    if (res.ok) {
      router.push("/barbero");
      router.refresh();
    } else {
      setErr(res.error ?? "No se pudo entrar");
      setPin("");
    }
  }

  function tecla(d: string) {
    if (busy || pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    setErr(null);
    if (next.length === 6) submit(next);
  }

  if (!destino) {
    return (
      <div className="w-full max-w-md">
        {onVolver && (
          <button onClick={onVolver} className="mb-3 text-xs text-muted transition hover:text-ink">
            ← Volver
          </button>
        )}
        <div className="text-center text-[10px] uppercase tracking-[0.3em] text-accent">App del mostrador</div>
        <h1 className="mt-2 text-center font-display text-3xl font-semibold uppercase">¿Quién eres?</h1>
        {sedes.map((s) => {
          const list = barberos.filter((b) => b.sede === s.id);
          return (
            <div key={s.id} className="mt-6">
              <div className="mb-2 text-xs uppercase tracking-[0.2em] text-muted">{s.nombre}</div>

              {/* El mostrador de la sede va PRIMERO y ancho: es el aparato
                  compartido del local, la forma normal de entrar. Los barberos
                  siguen abajo mientras se retiran sus 6 logins. */}
              <button
                onClick={() => elegir({ tipo: "sede", id: s.id, nombre: s.nombre })}
                className="flex w-full items-center gap-3 rounded-2xl border border-accent/40 bg-accent/[0.07] p-4 text-left transition hover:bg-accent/15"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-accent/40 text-accent">
                  {/* Persiana de local: dice "el mostrador", no "una persona". */}
                  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
                    <path d="M3 9h18M4 9V6l2-2h12l2 2v3M5 9v11h14V9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-ink">Mostrador de {s.nombre}</span>
                  <span className="block text-xs text-muted">La pantalla del local · un PIN para todo el equipo</span>
                </span>
              </button>

              {list.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {list.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => elegir({ tipo: "barbero", id: b.id, nombre: b.nombre })}
                      className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-panel p-4 transition hover:border-accent/50"
                    >
                      <span className="relative h-16 w-16 overflow-hidden rounded-full border border-line bg-bg">
                        {b.fotoUrl ? (
                          <Image src={b.fotoUrl} alt={b.nombre} fill className="object-cover" sizes="64px" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center font-display text-2xl text-muted">
                            {b.nombre.charAt(0)}
                          </span>
                        )}
                      </span>
                      <span className="text-sm font-semibold">{b.nombre}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {onAdmin ? (
          <button
            onClick={onAdmin}
            className="mt-8 block w-full text-center text-xs text-muted transition hover:text-ink"
          >
            Soy admin (entrar con contraseña) →
          </button>
        ) : (
          <Link href="/login" className="mt-8 block text-center text-xs text-muted transition hover:text-ink">
            Soy admin (entrar con contraseña) →
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-xs text-center">
      <button onClick={() => { setDestino(null); setPin(""); setErr(null); }} className="text-xs text-muted transition hover:text-ink">
        ← Cambiar
      </button>
      <h1 className="mt-3 font-display text-2xl font-semibold">
        {destino.tipo === "sede" ? `Mostrador · ${destino.nombre}` : `Hola, ${destino.nombre}`}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {destino.tipo === "sede" ? "PIN del local (6 dígitos)" : "Ingresa tu PIN de 6 dígitos"}
      </p>

      <div className="mt-6 flex justify-center gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className={`h-3 w-3 rounded-full border ${i < pin.length ? "border-accent bg-accent" : "border-line"}`} />
        ))}
      </div>
      {err && <div className="mt-4 text-sm text-accent-soft">{err}</div>}

      <div className="mt-6 grid grid-cols-3 gap-3">
        {["1","2","3","4","5","6","7","8","9"].map((d) => (
          <button key={d} onClick={() => tecla(d)} disabled={busy}
            className="rounded-xl border border-line bg-panel py-4 font-display text-2xl transition hover:border-accent/50 disabled:opacity-50">
            {d}
          </button>
        ))}
        <span />
        <button onClick={() => tecla("0")} disabled={busy}
          className="rounded-xl border border-line bg-panel py-4 font-display text-2xl transition hover:border-accent/50 disabled:opacity-50">
          0
        </button>
        <button onClick={() => { if (!busy) { setPin(pin.slice(0, -1)); setErr(null); } }} disabled={busy}
          className="rounded-xl border border-line py-4 text-sm text-muted transition hover:text-ink disabled:opacity-50">
          ←
        </button>
      </div>
      {busy && <div className="mt-4 text-sm text-muted">Entrando…</div>}
    </div>
  );
}

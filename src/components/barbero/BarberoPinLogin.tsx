"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { loginBarberoPin } from "@/lib/barbero-auth";
import type { Barbero, Sede } from "@/lib/data/types";

export function BarberoPinLogin({ barberos, sedes }: { barberos: Barbero[]; sedes: Sede[] }) {
  const router = useRouter();
  const [barbero, setBarbero] = useState<Barbero | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(nuevoPin: string) {
    if (!barbero) return;
    setBusy(true);
    setErr(null);
    const res = await loginBarberoPin(barbero.id, nuevoPin);
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

  if (!barbero) {
    return (
      <div className="w-full max-w-md">
        <div className="text-center text-[10px] uppercase tracking-[0.3em] text-accent">App del barbero</div>
        <h1 className="mt-2 text-center font-display text-3xl font-semibold uppercase">¿Quién sos?</h1>
        {sedes.map((s) => {
          const list = barberos.filter((b) => b.sede === s.id);
          if (!list.length) return null;
          return (
            <div key={s.id} className="mt-6">
              <div className="mb-2 text-xs uppercase tracking-[0.2em] text-muted">{s.nombre}</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {list.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => { setBarbero(b); setPin(""); setErr(null); }}
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
            </div>
          );
        })}
        <Link href="/login" className="mt-8 block text-center text-xs text-muted transition hover:text-ink">
          Soy admin (entrar con contraseña) →
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xs text-center">
      <button onClick={() => { setBarbero(null); setPin(""); setErr(null); }} className="text-xs text-muted transition hover:text-ink">
        ← Cambiar barbero
      </button>
      <h1 className="mt-3 font-display text-2xl font-semibold">Hola, {barbero.nombre}</h1>
      <p className="mt-1 text-sm text-muted">Ingresá tu PIN de 6 dígitos</p>

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

// SFX del mostrador/panel por Web Audio: CERO archivos de audio (nada que
// cargar ni licenciar), tonos cortos generados al vuelo. Nació del ding de
// RealtimeRefresh; acá vive la familia completa con una sola AudioContext.
// Si el navegador bloquea el audio (sin gesto previo), todo falla en silencio.
//
// Filosofía: el sonido es para lo que pasa CUANDO NO ESTÁS MIRANDO (entró una
// reserva, se cobró) o para veredictos de plata (cuadró/faltó). Los guardados
// comunes ya confirman visualmente; sonorizarlos sería ruido en el local.

type Nota = { freq: number; en: number; dur?: number; vol?: number };

function tocar(notas: Nota[], vibrar?: number | number[]) {
  try {
    const w = window as Window & { __bbSfx?: AudioContext };
    w.__bbSfx ??= new AudioContext();
    const ctx = w.__bbSfx;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    for (const n of notas) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = n.freq;
      const dur = n.dur ?? 0.4;
      const vol = n.vol ?? 0.14;
      g.gain.setValueAtTime(0.0001, t + n.en);
      g.gain.exponentialRampToValueAtTime(vol, t + n.en + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + n.en + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t + n.en);
      o.stop(t + n.en + dur + 0.05);
    }
    if (vibrar) navigator.vibrate?.(vibrar);
  } catch {
    // AudioContext no disponible o bloqueado: no pasa nada.
  }
}

/** Entró una reserva nueva (el ding clásico de dos notas del mostrador). */
export function sfxNuevaReserva() {
  tocar(
    [
      { freq: 880, en: 0 },
      { freq: 1174.66, en: 0.13 },
    ],
    120,
  );
}

/** Cobro registrado: arpegio corto y brillante (la caja sonó). */
export function sfxCobro() {
  tocar(
    [
      { freq: 1318.51, en: 0, dur: 0.18, vol: 0.12 },
      { freq: 1567.98, en: 0.09, dur: 0.18, vol: 0.12 },
      { freq: 2093, en: 0.18, dur: 0.35, vol: 0.14 },
    ],
    80,
  );
}

/** Veredicto bueno (la caja cuadró): dos notas suaves hacia arriba. */
export function sfxExito() {
  tocar([
    { freq: 659.25, en: 0, dur: 0.25, vol: 0.1 },
    { freq: 987.77, en: 0.12, dur: 0.35, vol: 0.12 },
  ]);
}

/** Atención (faltó plata, algo requiere mirar): dos notas graves hacia abajo. */
export function sfxAlerta() {
  tocar(
    [
      { freq: 493.88, en: 0, dur: 0.3, vol: 0.13 },
      { freq: 369.99, en: 0.18, dur: 0.45, vol: 0.13 },
    ],
    [80, 60, 80], // patrón corto de vibración
  );
}

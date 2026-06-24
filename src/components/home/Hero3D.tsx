'use client';
import { useEffect } from 'react';
import { BarberScene } from '@/components/three/BarberScene';

export function Hero3D() {
  useEffect(() => {
    // Placeholder: scroll integration can happen here if needed
    // For now, the OrbitControls auto-rotate in the scene
  }, []);

  return (
    <section className="relative w-full h-screen bg-black overflow-hidden">
      {/* 3D Canvas */}
      <div className="absolute inset-0">
        <BarberScene />
      </div>

      {/* Overlay content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-2xl">
          <h1 className="font-display text-6xl md:text-7xl font-black text-white mb-6 leading-tight">
            Barbas & Bigotes
          </h1>
          <p className="text-lg md:text-xl text-zinc-300 mb-10 font-sans">
            Barbería clásica en Barranquilla. Estilo, precisión y tradición.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <a
              href="/reservar"
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-8 py-3 rounded transition"
            >
              Reservar Cita
            </a>
            <a
              href="#servicios"
              className="inline-flex items-center gap-2 border border-zinc-600 hover:border-zinc-400 text-white px-8 py-3 rounded transition"
            >
              Explorar
            </a>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 animate-bounce">
        <svg
          className="w-6 h-6 text-zinc-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </div>
    </section>
  );
}

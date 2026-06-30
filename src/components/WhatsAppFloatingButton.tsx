"use client";

import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";
import Image from "next/image";

export function WhatsAppFloatingButton() {
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    // Show tooltip after 3 seconds, hide after 12 seconds
    const timerShow = setTimeout(() => setShowTooltip(true), 3000);
    const timerHide = setTimeout(() => setShowTooltip(false), 12000);
    return () => {
      clearTimeout(timerShow);
      clearTimeout(timerHide);
    };
  }, []);

  const whatsappUrl = "https://wa.me/573006734799?text=Hola%20Barbas%20%26%20Bigotes%2C%20quisiera%20saber%20m%C3%A1s%20informaci%C3%B3n%20sobre%20sus%20servicios%20y%20reservas.";

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
      {/* Tooltip Chat Bubble */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: 20 }}
            className="hidden md:flex relative rounded-xl border border-line bg-panel px-4 py-2.5 shadow-2xl backdrop-blur-md max-w-xs text-left"
          >
            {/* Arrow */}
            <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 rotate-45 h-3.5 w-3.5 border-t border-r border-line bg-panel" />
            
            <div className="relative z-10">
              <p className="text-[10px] uppercase tracking-wider text-accent font-semibold leading-none">Contacto</p>
              <p className="text-xs text-white/90 font-medium leading-tight mt-1">¿Alguna duda, bro? Escríbenos.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contactar por WhatsApp"
        onMouseEnter={() => setShowTooltip(true)}
        className="group relative flex h-[60px] w-[60px] items-center justify-center rounded-full bg-black shadow-[0_8px_30px_rgba(0,0,0,0.5)] hover:shadow-[0_0_25px_rgba(210,63,52,0.3)] hover:scale-105 active:scale-95 transition-all duration-300 overflow-hidden border border-line/30"
      >
        {/* Pulse effect */}
        <span className="absolute inset-0 rounded-full bg-accent opacity-20 group-hover:animate-ping pointer-events-none" />

        {/* Brand Logo Face with True Transparent Background */}
        <Image 
          src="/brand/logo-face-transparent.png" 
          alt="Barbas & Bigotes" 
          width={120} 
          height={120} 
          className="relative z-10 h-10 w-10 object-contain drop-shadow-md transition-transform duration-300 group-hover:scale-110 -ml-1"
        />
      </a>
    </div>
  );
}

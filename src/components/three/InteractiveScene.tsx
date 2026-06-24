'use client';
import { useEffect, useRef } from 'react';
import Script from 'next/script';

export function InteractiveScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const initDoneRef = useRef(false);

  useEffect(() => {
    const checkAndInit = () => {
      if (initDoneRef.current) return;
      if (typeof window !== 'undefined' && (window as any).THREE && (window as any).BarberScene) {
        initDoneRef.current = true;
        initScene();
      } else {
        setTimeout(checkAndInit, 50);
      }
    };

    checkAndInit();

    return () => {
      const scene = (window as any).BarberScene;
      if (scene) scene.setPaused(true);
    };
  }, []);

  const initScene = () => {
    if (!canvasRef.current) return;

    const scene = (window as any).BarberScene;
    scene.init(canvasRef.current);

    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = window.scrollY / scrollHeight;
      scene.setProgress(scrolled);
    };

    let scrollTimeout: NodeJS.Timeout;
    const handleScrollEvent = () => {
      scene.setPaused(false);
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        scene.setPaused(true);
      }, 100);
      handleScroll();
    };

    window.addEventListener('scroll', handleScrollEvent, { passive: true });
    window.addEventListener('resize', () => {
      handleScroll();
    });

    const observer = new IntersectionObserver(([entry]) => {
      scene.setPaused(!entry.isIntersecting);
    });
    if (canvasRef.current) observer.observe(canvasRef.current);

    return () => {
      window.removeEventListener('scroll', handleScrollEvent);
      observer.disconnect();
    };
  };

  return (
    <>
      {/* Three.js via CDN */}
      <Script
        src="https://cdn.jsdelivr.net/npm/three@r128/build/three.min.js"
        strategy="beforeInteractive"
      />
      {/* Scene script — load after Three.js */}
      <Script
        src="/scene.js"
        strategy="afterInteractive"
      />

      {/* Canvas container */}
      <div className="fixed inset-0 z-0 w-screen h-screen overflow-hidden">
        <canvas
          ref={canvasRef}
          id="bg-canvas"
          className="block w-full h-full"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
          }}
        />

        {/* Scene veil (radial gradient overlay) */}
        <div
          id="scene-veil"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 0%, rgba(12, 11, 10, 0.7) 100%)',
          }}
        />
      </div>
    </>
  );
}

'use client';
import { useEffect, useRef } from 'react';
import Script from 'next/script';

export function InteractiveScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load scene.js when Three.js is available
  useEffect(() => {
    const loadSceneScript = () => {
      if ((window as any).THREE) {
        // Three.js loaded, now load scene.js
        const script = document.createElement('script');
        script.src = '/scene.js';
        script.async = true;
        document.body.appendChild(script);
      } else {
        // Wait and try again
        setTimeout(loadSceneScript, 100);
      }
    };

    loadSceneScript();
  }, []);

  // Initialize scene when both THREE and BarberScene are available
  useEffect(() => {
    const initScene = () => {
      if (!canvasRef.current) return;
      if (!(window as any).BarberScene) {
        setTimeout(initScene, 100);
        return;
      }

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

    initScene();
  }, []);

  return (
    <>
      {/* Three.js via unpkg CDN — loads first */}
      <Script
        src="https://unpkg.com/three@r128/build/three.min.js"
        strategy="beforeInteractive"
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

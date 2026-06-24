'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Inline BarberScene — imported directly, no CDN needed
const BarberScene = (() => {
  let scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer;
  let progress = 0;
  let paused = false;
  let mouseX = 0;
  let mouseY = 0;
  let targetCameraRotX = 0;
  let targetCameraRotY = 0;

  const config = {
    canvas: null as HTMLCanvasElement | null,
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
    fov: 75,
    near: 0.1,
    far: 5000,
    colors: {
      bg: 0x0c0b0a,
      accent: 0xd23f34,
      particle: 0xf2ede4,
      line: 0x9c958a,
    },
    zones: { z1: -500, z2: -1500, z3: -2500 },
  };

  const init = (canvas: HTMLCanvasElement) => {
    config.canvas = canvas;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(config.colors.bg);

    camera = new THREE.PerspectiveCamera(
      config.fov,
      config.width / config.height,
      config.near,
      config.far
    );
    (camera as any).position.set(0, 0, 100);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(config.width, config.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    buildZone1();
    buildZone2();
    buildZone3();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(config.colors.accent, 1, 500);
    (pointLight.position as any).set(100, 100, 100);
    scene.add(pointLight);

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);

    animate();
  };

  const buildZone1 = () => {
    const nodeCount = 20;
    const nodes: any[] = [];
    const positions: number[] = [];
    for (let i = 0; i < nodeCount; i++) {
      const x = (Math.random() - 0.5) * 400;
      const y = (Math.random() - 0.5) * 400;
      const z = config.zones.z1 + Math.random() * 200;
      positions.push(x, y, z);
      nodes.push({ x, y, z });
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    const material = new THREE.PointsMaterial({
      color: config.colors.accent,
      size: 5,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const linePositions: number[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (Math.random() < 0.3) {
          linePositions.push(nodes[i].x, nodes[i].y, nodes[i].z);
          linePositions.push(nodes[j].x, nodes[j].y, nodes[j].z);
        }
      }
    }
    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3));
    const lineMaterial = new THREE.LineBasicMaterial({
      color: config.colors.line,
      transparent: true,
      opacity: 0.4,
    });
    const lines = new THREE.LineSegments(lineGeom, lineMaterial);
    scene.add(lines);
  };

  const buildZone2 = () => {
    const gridSize = 6;
    const spacing = 100;
    const nodes: any[] = [];
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        const posX = (x - gridSize / 2) * spacing;
        const posY = (y - gridSize / 2) * spacing;
        nodes.push({ x: posX, y: posY, z: config.zones.z2 });
      }
    }

    const positions = nodes.map((n) => [n.x, n.y, n.z]).flat();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    const material = new THREE.PointsMaterial({
      color: config.colors.particle,
      size: 3,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const linePositions: number[] = [];
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        const idx = x * gridSize + y;
        if (y < gridSize - 1) {
          const idx2 = x * gridSize + (y + 1);
          linePositions.push(nodes[idx].x, nodes[idx].y, nodes[idx].z);
          linePositions.push(nodes[idx2].x, nodes[idx2].y, nodes[idx2].z);
        }
        if (x < gridSize - 1) {
          const idx2 = (x + 1) * gridSize + y;
          linePositions.push(nodes[idx].x, nodes[idx].y, nodes[idx].z);
          linePositions.push(nodes[idx2].x, nodes[idx2].y, nodes[idx2].z);
        }
      }
    }
    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3));
    const lineMaterial = new THREE.LineBasicMaterial({
      color: config.colors.accent,
      transparent: true,
      opacity: 0.6,
    });
    const lines = new THREE.LineSegments(lineGeom, lineMaterial);
    scene.add(lines);
  };

  const buildZone3 = () => {
    const gridSize = 20;
    const cellSize = 100;
    const linePositions: number[] = [];
    for (let i = -gridSize; i <= gridSize; i++) {
      linePositions.push(-gridSize * cellSize, i * cellSize, config.zones.z3);
      linePositions.push(gridSize * cellSize, i * cellSize, config.zones.z3);
      linePositions.push(i * cellSize, -gridSize * cellSize, config.zones.z3);
      linePositions.push(i * cellSize, gridSize * cellSize, config.zones.z3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3));
    const material = new THREE.LineBasicMaterial({
      color: config.colors.line,
      transparent: true,
      opacity: 0.3,
    });
    const lines = new THREE.LineSegments(geometry, material);
    scene.add(lines);
  };

  const animate = () => {
    requestAnimationFrame(animate);
    if (!paused) {
      const targetZ = 100 + progress * -2600;
      (camera.position as any).z += (targetZ - (camera.position as any).z) * 0.05;
      (camera.rotation as any).x += (targetCameraRotX - (camera.rotation as any).x) * 0.1;
      (camera.rotation as any).y += (targetCameraRotY - (camera.rotation as any).y) * 0.1;
    }
    renderer.render(scene, camera as any);
  };

  const onWindowResize = () => {
    config.width = window.innerWidth;
    config.height = window.innerHeight;
    (camera as any).aspect = config.width / config.height;
    (camera as any).updateProjectionMatrix();
    renderer.setSize(config.width, config.height);
  };

  const onMouseMove = (e: MouseEvent) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    const maxRotX = 0.1;
    const maxRotY = 0.1;
    targetCameraRotX = (mouseY / window.innerHeight - 0.5) * maxRotX;
    targetCameraRotY = (mouseX / window.innerWidth - 0.5) * maxRotY;
  };

  return { init, setProgress: (v: number) => { progress = Math.max(0, Math.min(1, v)); }, setPaused: (b: boolean) => { paused = b; } };
})();

export function InteractiveScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    BarberScene.init(canvasRef.current);

    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = window.scrollY / scrollHeight;
      BarberScene.setProgress(scrolled);
    };

    let scrollTimeout: NodeJS.Timeout;
    const handleScrollEvent = () => {
      BarberScene.setPaused(false);
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        BarberScene.setPaused(true);
      }, 100);
      handleScroll();
    };

    window.addEventListener('scroll', handleScrollEvent, { passive: true });
    window.addEventListener('resize', handleScroll);

    const observer = new IntersectionObserver(([entry]) => {
      BarberScene.setPaused(!entry.isIntersecting);
    });
    if (canvasRef.current) observer.observe(canvasRef.current);

    return () => {
      window.removeEventListener('scroll', handleScrollEvent);
      observer.disconnect();
    };
  }, []);

  return (
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
      <div
        id="scene-veil"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, rgba(12, 11, 10, 0.7) 100%)',
        }}
      />
    </div>
  );
}

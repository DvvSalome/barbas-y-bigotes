'use client';
import { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { BarberPole3D } from './BarberPole3D';

function BarberChair({ position }: { position: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null);

  return (
    <group ref={groupRef} position={position}>
      {/* Base pedestal (polished chrome) */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.3, 0.35, 0.3, 16]} />
        <meshStandardMaterial color="#cccccc" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.2, 8]} />
        <meshStandardMaterial color="#cccccc" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Seat (Barber Red leather) */}
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.4, 0.42, 0.18, 32]} />
        <meshStandardMaterial color="#d23f34" metalness={0.1} roughness={0.7} />
      </mesh>

      {/* Backrest (Barber Red leather) */}
      <mesh position={[0, 1.15, -0.2]}>
        <boxGeometry args={[0.45, 0.7, 0.12]} />
        <meshStandardMaterial color="#d23f34" metalness={0.1} roughness={0.7} />
      </mesh>

      {/* Metal frame for backrest */}
      <mesh position={[0, 1.15, -0.27]}>
        <boxGeometry args={[0.48, 0.74, 0.04]} />
        <meshStandardMaterial color="#cccccc" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Armrests (Dark leather + chrome supports) */}
      {[-0.43, 0.43].map((x, i) => (
        <group key={i} position={[x, 0.75, 0]}>
          {/* Support */}
          <mesh position={[0, -0.15, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.3, 8]} />
            <meshStandardMaterial color="#cccccc" metalness={0.9} roughness={0.1} />
          </mesh>
          {/* Arm pad */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.07, 0.06, 0.45]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.2} roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Footrest */}
      <mesh position={[0, 0.25, 0.35]}>
        <boxGeometry args={[0.3, 0.04, 0.25]} />
        <meshStandardMaterial color="#cccccc" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}

function FloatingParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 120;

  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 8; // X
    positions[i * 3 + 1] = Math.random() * 4;     // Y
    positions[i * 3 + 2] = (Math.random() - 0.5) * 6; // Z
    speeds[i] = 0.1 + Math.random() * 0.2;
  }

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    const geo = pointsRef.current.geometry;
    const pos = geo.attributes.position.array as Float32Array;

    for (let i = 0; i < count; i++) {
      // Float particles upwards
      pos[i * 3 + 1] += speeds[i] * delta;
      // Reset if too high
      if (pos[i * 3 + 1] > 4) {
        pos[i * 3 + 1] = -0.5;
        pos[i * 3] = (Math.random() - 0.5) * 8;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 6;
      }
    }
    geo.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#f2ede4"
        size={0.035}
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function CameraController() {
  const { camera } = useThree();
  const mouse = useRef({ x: 0, y: 0 });
  const scroll = useRef(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) - 0.5;
      mouse.current.y = (e.clientY / window.innerHeight) - 0.5;
    };

    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      scroll.current = scrollHeight > 0 ? window.scrollY / scrollHeight : 0;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useFrame((state, delta) => {
    // ScrollTravel path:
    // Scroll = 0: Camera at [0, 1.2, 3.8] (Wide hero view of chairs & pole)
    // Scroll = 1: Camera at [1.5, 0.7, -1.8] (Deep close-up on the spinning pole)
    const targetX = THREE.MathUtils.lerp(0, 1.5, scroll.current);
    const targetY = THREE.MathUtils.lerp(1.2, 0.7, scroll.current);
    const targetZ = THREE.MathUtils.lerp(3.8, -1.8, scroll.current);

    // Mouse parallax offsets
    const parallaxX = mouse.current.x * 0.4;
    const parallaxY = -mouse.current.y * 0.3;

    // Smooth camera transition (lerp)
    camera.position.x += (targetX + parallaxX - camera.position.x) * 0.08;
    camera.position.y += (targetY + parallaxY - camera.position.y) * 0.08;
    camera.position.z += (targetZ - camera.position.z) * 0.08;

    // Camera target focus shifting with scroll
    const lookTargetX = THREE.MathUtils.lerp(0, 1.8, scroll.current);
    const lookTargetY = THREE.MathUtils.lerp(0.8, 0.6, scroll.current);
    const lookTargetZ = THREE.MathUtils.lerp(0, -0.5, scroll.current);
    camera.lookAt(lookTargetX, lookTargetY, lookTargetZ);
  });

  return null;
}

export function InteractiveHeroScene() {
  return (
    <Canvas
      gl={{ antialias: true, alpha: true }}
      style={{ pointerEvents: 'none' }}
    >
      <PerspectiveCamera makeDefault position={[0, 1.2, 3.8]} fov={45} />
      <CameraController />

      {/* High-quality lighting */}
      <ambientLight intensity={0.25} color="#f2ede4" />
      
      {/* Warm key light */}
      <directionalLight position={[5, 6, 4]} intensity={1.5} color="#ffeedd" castShadow />
      
      {/* Red neon accent light */}
      <pointLight position={[2, 1, 0.5]} intensity={1.8} distance={6} color="#d23f34" />
      <pointLight position={[-2, 1.5, -1]} intensity={0.8} distance={5} color="#d23f34" />

      {/* Floating grooming dust/embers */}
      <FloatingParticles />

      {/* Stylized Chairs */}
      <BarberChair position={[-0.85, -0.6, 0]} />
      <BarberChair position={[0.85, -0.6, -0.5]} />

      {/* Spinning Barber Pole */}
      <BarberPole3D position={[1.8, 0.4, -0.5]} scale={0.9} />

      {/* Clean Charcoal backdrop */}
      <mesh position={[0, 1.5, -2.5]}>
        <planeGeometry args={[12, 6]} />
        <meshStandardMaterial color="#0c0b0a" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Wood & Steel Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.62, 0]}>
        <planeGeometry args={[12, 8]} />
        <meshStandardMaterial color="#110f0d" roughness={0.8} metalness={0.2} />
      </mesh>
    </Canvas>
  );
}

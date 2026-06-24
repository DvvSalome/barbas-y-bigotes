'use client';
import { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

function BarberChair({ position }: { position: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null);

  return (
    <group ref={groupRef} position={position}>
      {/* Base pedestal */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.3, 0.35, 0.3, 8]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Seat */}
      <mesh position={[0, 0.65, 0]}>
        <cylinderGeometry args={[0.4, 0.42, 0.15, 32]} />
        <meshStandardMaterial color="#d23f34" metalness={0.4} roughness={0.5} />
      </mesh>

      {/* Backrest */}
      <mesh position={[0, 1.3, -0.15]}>
        <boxGeometry args={[0.45, 0.8, 0.15]} />
        <meshStandardMaterial color="#d23f34" metalness={0.4} roughness={0.5} />
      </mesh>

      {/* Armrests */}
      {[-0.35, 0.35].map((x, i) => (
        <mesh key={i} position={[x, 0.7, 0]}>
          <boxGeometry args={[0.08, 0.4, 0.5]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}

      {/* Headrest */}
      <mesh position={[0, 1.65, -0.3]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#d23f34" metalness={0.3} roughness={0.6} />
      </mesh>
    </group>
  );
}

function Mirror() {
  return (
    <mesh position={[0, 1, 1.5]}>
      <planeGeometry args={[1.2, 1.6]} />
      <meshStandardMaterial
        color="#0f0e0d"
        metalness={0.8}
        roughness={0.1}
        envMapIntensity={0.5}
      />
    </mesh>
  );
}

function Lights() {
  return (
    <>
      {/* Warm key light (barbershop classic) */}
      <directionalLight position={[3, 4, 2]} intensity={1.2} color="#f5d5a8" />

      {/* Red accent light */}
      <pointLight position={[-2, 2, 1]} intensity={0.6} color="#d23f34" />

      {/* Ambient */}
      <ambientLight intensity={0.4} color="#e8dcc8" />

      {/* Fill light */}
      <directionalLight position={[-4, 2, -3]} intensity={0.5} color="#c8b8a8" />
    </>
  );
}

function Scene() {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 1, 3.5]} fov={50} />
      <OrbitControls
        autoRotate
        autoRotateSpeed={2}
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={(2 * Math.PI) / 3}
      />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[5, 5]} />
        <meshStandardMaterial color="#0c0b0a" />
      </mesh>

      {/* Chairs */}
      <BarberChair position={[-0.8, 0, 0]} />
      <BarberChair position={[0.8, 0, 0]} />

      {/* Mirror */}
      <Mirror />

      {/* Lights */}
      <Lights />

      {/* Backdrop */}
      <mesh position={[0, 1.2, -2]}>
        <planeGeometry args={[3, 2.5]} />
        <meshStandardMaterial color="#151311" />
      </mesh>
    </>
  );
}

export function BarberScene() {
  return (
    <Canvas gl={{ antialias: true, alpha: true }}>
      <color attach="background" args={['#0c0b0a']} />
      <Scene />
    </Canvas>
  );
}

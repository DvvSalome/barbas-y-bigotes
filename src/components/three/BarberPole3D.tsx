'use client';
import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function BarberPole3D({
  position = [0, 0, 0],
  scale = 1
}: {
  position?: [number, number, number];
  scale?: number;
}) {
  const innerRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);

  // Generate the barber pole stripe texture procedurally
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Brand Colors
    const red = '#d23f34';
    const charcoal = '#0c0b0a';
    const bone = '#f2ede4';

    const colors = [charcoal, bone, red, bone];
    const stripeWidth = canvas.width / colors.length;

    // Draw repeating diagonal bands
    // When wrapped around a cylinder, diagonal bands become helixes.
    for (let x = -canvas.width; x < canvas.width * 2; x += stripeWidth * colors.length) {
      colors.forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        const startX = x + i * stripeWidth;
        ctx.moveTo(startX, 0);
        ctx.lineTo(startX + stripeWidth, 0);
        ctx.lineTo(startX + stripeWidth - canvas.height, canvas.height);
        ctx.lineTo(startX - canvas.height, canvas.height);
        ctx.closePath();
        ctx.fill();
      });
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    // Set repeat values to look nice
    texture.repeat.set(2, 2);
    textureRef.current = texture;

    if (innerRef.current) {
      const mat = innerRef.current.material as THREE.MeshStandardMaterial;
      mat.map = texture;
      mat.needsUpdate = true;
    }

    return () => {
      texture.dispose();
    };
  }, []);

  useFrame((state, delta) => {
    // Scroll the texture downwards to make the spiral look like it is spinning upwards
    if (textureRef.current) {
      textureRef.current.offset.y += delta * 0.8;
    }

    // Add a slight hover wave rotation to the entire pole group
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
  });

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* Wall Bracket / Mount */}
      <mesh position={[-0.45, 0.6, 0]}>
        <boxGeometry args={[0.3, 0.08, 0.2]} />
        <meshStandardMaterial color="#222" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[-0.45, -0.6, 0]}>
        <boxGeometry args={[0.3, 0.08, 0.2]} />
        <meshStandardMaterial color="#222" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[-0.5, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 1.3, 8]} />
        <meshStandardMaterial color="#222" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Main Spinning Inner Cylinder */}
      <mesh ref={innerRef} position={[0, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 1.2, 32]} />
        <meshStandardMaterial metalness={0.1} roughness={0.6} />
      </mesh>

      {/* Outer Glass Cylinder */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 1.22, 32, 1, true]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.2}
          roughness={0.1}
          metalness={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Top Metallic Cap */}
      <mesh position={[0, 0.68, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.14, 32]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.1} /> {/* Gold-like brass */}
      </mesh>
      <mesh position={[0, 0.82, 0]}>
        <sphereGeometry args={[0.26, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Bottom Metallic Cap */}
      <mesh position={[0, -0.68, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.14, 32]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0, -0.82, 0]} rotation={[Math.PI, 0, 0]}>
        <sphereGeometry args={[0.26, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
}

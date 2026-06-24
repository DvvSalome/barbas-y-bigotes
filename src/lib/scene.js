// BarberScene — Interactive 3D background with scroll-driven camera
// Exposed as window.BarberScene with API: .init(canvas), .setProgress(0-1), .setPaused(bool)

const BarberScene = (() => {
  let scene, camera, renderer;
  let progress = 0;
  let paused = false;
  let mouseX = 0;
  let mouseY = 0;
  let targetCameraRotX = 0;
  let targetCameraRotY = 0;

  // Config
  const config = {
    canvas: null,
    width: window.innerWidth,
    height: window.innerHeight,
    fov: 75,
    near: 0.1,
    far: 5000,
    colors: {
      bg: 0x0c0b0a,        // carbón
      accent: 0xd23f34,      // rojo barbero
      particle: 0xf2ede4,    // hueso
      line: 0x9c958a,        // muted
    },
    zones: {
      z1: -500,   // zona 1: nodos/sillas
      z2: -1500,  // zona 2: red neuronal
      z3: -2500,  // zona 3: rejilla infinita
    },
  };

  const prefersReducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ─────────────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────────────
  const init = (canvas) => {
    config.canvas = canvas;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(config.colors.bg);

    // Camera
    camera = new THREE.PerspectiveCamera(
      config.fov,
      config.width / config.height,
      config.near,
      config.far
    );
    camera.position.set(0, 0, 100);

    // Renderer
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    renderer.setSize(config.width, config.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Build scenes
    buildZone1();
    buildZone2();
    buildZone3();

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(config.colors.accent, 1, 500);
    pointLight.position.set(100, 100, 100);
    scene.add(pointLight);

    // Resize listener
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);

    // Start RAF loop
    animate();
  };

  // ─────────────────────────────────────────────────────────────
  // ZONE 1: Nube de nodos/sillas conectadas (grafo)
  // ─────────────────────────────────────────────────────────────
  const buildZone1 = () => {
    const nodeCount = prefersReducedMotion() ? 5 : 20;
    const nodes = [];

    // Crear nodos
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    for (let i = 0; i < nodeCount; i++) {
      const x = (Math.random() - 0.5) * 400;
      const y = (Math.random() - 0.5) * 400;
      const z = config.zones.z1 + Math.random() * 200;
      positions.push(x, y, z);
      nodes.push({ x, y, z });
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));

    const material = new THREE.PointsMaterial({
      color: config.colors.accent,
      size: 5,
      sizeAttenuation: true,
      emissive: config.colors.accent,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // Líneas conectoras
    const linePositions = [];
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

  // ─────────────────────────────────────────────────────────────
  // ZONE 2: Red neuronal con pulsos de energía
  // ─────────────────────────────────────────────────────────────
  const buildZone2 = () => {
    const gridSize = prefersReducedMotion() ? 3 : 6;
    const spacing = 100;
    const nodes = [];

    // Grid de nodos
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        const posX = (x - gridSize / 2) * spacing;
        const posY = (y - gridSize / 2) * spacing;
        const posZ = config.zones.z2;
        nodes.push({ x: posX, y: posY, z: posZ });
      }
    }

    // Renderizar nodos
    const geometry = new THREE.BufferGeometry();
    const positions = nodes.map((n) => [n.x, n.y, n.z]).flat();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));

    const material = new THREE.PointsMaterial({
      color: config.colors.particle,
      size: 3,
      emissive: config.colors.particle,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // Aristas horizontales y verticales
    const linePositions = [];
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        const idx = x * gridSize + y;
        // Horizontal
        if (y < gridSize - 1) {
          const idx2 = x * gridSize + (y + 1);
          linePositions.push(nodes[idx].x, nodes[idx].y, nodes[idx].z);
          linePositions.push(nodes[idx2].x, nodes[idx2].y, nodes[idx2].z);
        }
        // Vertical
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

  // ─────────────────────────────────────────────────────────────
  // ZONE 3: Rejilla infinita con perspectiva
  // ─────────────────────────────────────────────────────────────
  const buildZone3 = () => {
    const gridSize = prefersReducedMotion() ? 10 : 20;
    const cellSize = 100;

    const linePositions = [];

    // Líneas horizontales
    for (let i = -gridSize; i <= gridSize; i++) {
      linePositions.push(-gridSize * cellSize, i * cellSize, config.zones.z3);
      linePositions.push(gridSize * cellSize, i * cellSize, config.zones.z3);
    }

    // Líneas verticales
    for (let i = -gridSize; i <= gridSize; i++) {
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

  // ─────────────────────────────────────────────────────────────
  // ANIMATION LOOP
  // ─────────────────────────────────────────────────────────────
  const animate = () => {
    requestAnimationFrame(animate);

    if (!paused) {
      // Move camera along Z based on progress
      const targetZ = 100 + progress * -2600;
      camera.position.z += (targetZ - camera.position.z) * 0.05; // LERP

      // Mouse-based camera rotation (parallax)
      const maxRotX = 0.1;
      const maxRotY = 0.1;
      targetCameraRotX = (mouseY / window.innerHeight - 0.5) * maxRotX;
      targetCameraRotY = (mouseX / window.innerWidth - 0.5) * maxRotY;

      camera.rotation.x += (targetCameraRotX - camera.rotation.x) * 0.1;
      camera.rotation.y += (targetCameraRotY - camera.rotation.y) * 0.1;
    }

    renderer.render(scene, camera);
  };

  // ─────────────────────────────────────────────────────────────
  // EVENT HANDLERS
  // ─────────────────────────────────────────────────────────────
  const onWindowResize = () => {
    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;
    config.width = newWidth;
    config.height = newHeight;

    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(newWidth, newHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  };

  const onMouseMove = (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  };

  // ─────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────
  return {
    init,
    setProgress: (value) => {
      progress = Math.max(0, Math.min(1, value));
    },
    setPaused: (bool) => {
      paused = bool;
    },
    getProgress: () => progress,
    isPaused: () => paused,
  };
})();

// Expose globally
window.BarberScene = BarberScene;

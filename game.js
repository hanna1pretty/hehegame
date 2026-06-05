import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

(() => {
  'use strict';

  const els = {
    canvas: document.getElementById('gameCanvas'),
    startScreen: document.getElementById('startScreen'),
    startButton: document.getElementById('startButton'),
    pauseMenu: document.getElementById('pauseMenu'),
    resumeButton: document.getElementById('resumeButton'),
    resetButton: document.getElementById('resetButton'),
    blockLabel: document.getElementById('blockLabel'),
    blockBar: document.getElementById('blockBar'),
    jumpButton: document.getElementById('jumpButton'),
    breakButton: document.getElementById('breakButton'),
    placeButton: document.getElementById('placeButton'),
    tiltButton: document.getElementById('tiltButton'),
    toast: document.getElementById('toast'),
    errorBox: document.getElementById('errorBox')
  };

  const isTouchDevice = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  const WORLD_RADIUS = 17;
  const MAX_HEIGHT = 6;
  const BLOCK_SIZE = 1;
  const EYE_HEIGHT = 1.72;
  const GRAVITY = 18;
  const MOVE_SPEED = isTouchDevice ? 5.0 : 6.0;
  const JUMP_SPEED = 7.2;
  const LOOK_SPEED = isTouchDevice ? 0.0065 : 0.0025;

  const blockTypes = [
    { id: 'grass', name: 'Grass', color: 0x42c756 },
    { id: 'dirt', name: 'Dirt', color: 0x8a5524 },
    { id: 'stone', name: 'Stone', color: 0x8c9297 },
    { id: 'sand', name: 'Sand', color: 0xe8d06a },
    { id: 'wood', name: 'Wood', color: 0x8b5a2b },
    { id: 'leaf', name: 'Leaf', color: 0x2f9f45 },
    { id: 'water', name: 'Water', color: 0x3da4ff, opacity: 0.62 },
    { id: 'flower', name: 'Flower', color: 0xff5ad6 }
  ];

  const materials = new Map();
  const blocks = new Map();
  const pickables = [];
  const keys = new Set();
  const virtualMove = { forward: false, back: false, left: false, right: false };
  let selectedIndex = 0;
  let running = false;
  let paused = false;
  let yaw = 0;
  let pitch = -0.18;
  let tiltIndex = 0;
  let lastTime = performance.now();
  let toastTimer = null;
  let lookPointerId = null;
  let lastLook = null;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x7dd2f1);
  scene.fog = new THREE.Fog(0x9bdcf2, 20, 62);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 120);
  const renderer = new THREE.WebGLRenderer({ canvas: els.canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const raycaster = new THREE.Raycaster();
  const pointerCenter = new THREE.Vector2(0, 0);
  const player = {
    position: new THREE.Vector3(0, 6, 7),
    velocity: new THREE.Vector3(0, 0, 0),
    grounded: false
  };

  function showError(error) {
    const message = error instanceof Error ? `${error.message}\n${error.stack || ''}` : String(error);
    els.errorBox.textContent = message;
    els.errorBox.classList.remove('hidden');
  }
  window.addEventListener('error', e => showError(e.error || e.message));
  window.addEventListener('unhandledrejection', e => showError(e.reason));

  function materialFor(typeId) {
    if (materials.has(typeId)) return materials.get(typeId);
    const type = blockTypes.find(b => b.id === typeId) || blockTypes[0];
    const material = new THREE.MeshStandardMaterial({
      color: type.color,
      roughness: 0.86,
      metalness: 0.02,
      transparent: Boolean(type.opacity),
      opacity: type.opacity ?? 1
    });
    materials.set(typeId, material);
    return material;
  }

  const cubeGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

  function keyOf(x, y, z) { return `${x},${y},${z}`; }
  function parseKey(key) { return key.split(',').map(Number); }

  function addBlock(x, y, z, typeId, fixed = false) {
    const key = keyOf(x, y, z);
    if (blocks.has(key)) return null;
    const mesh = new THREE.Mesh(cubeGeometry, materialFor(typeId));
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    mesh.castShadow = typeId !== 'water';
    mesh.receiveShadow = true;
    mesh.userData = { x, y, z, typeId, fixed };
    scene.add(mesh);
    blocks.set(key, mesh);
    pickables.push(mesh);
    return mesh;
  }

  function removeBlock(mesh) {
    if (!mesh || mesh.userData.fixed) return false;
    const { x, y, z } = mesh.userData;
    blocks.delete(keyOf(x, y, z));
    const idx = pickables.indexOf(mesh);
    if (idx >= 0) pickables.splice(idx, 1);
    scene.remove(mesh);
    return true;
  }

  function heightAt(x, z) {
    const hill = Math.sin(x * 0.42) * 1.1 + Math.cos(z * 0.37) * 1.05 + Math.sin((x + z) * 0.21) * 1.2;
    return Math.max(1, Math.min(MAX_HEIGHT, Math.round(2.8 + hill)));
  }

  function isPond(x, z) {
    const dx = x + 7;
    const dz = z - 4;
    return dx * dx / 18 + dz * dz / 10 < 1;
  }

  function isBeach(x, z) {
    return Math.abs(x) > WORLD_RADIUS - 3 || Math.abs(z) > WORLD_RADIUS - 3 || (x < -4 && z > 2 && z < 8);
  }

  function addTree(x, y, z) {
    for (let i = 0; i < 4; i++) addBlock(x, y + i, z, 'wood');
    for (let lx = -2; lx <= 2; lx++) {
      for (let lz = -2; lz <= 2; lz++) {
        for (let ly = 2; ly <= 4; ly++) {
          const d = Math.abs(lx) + Math.abs(lz) + Math.max(0, ly - 3);
          if (d <= 3 && !(lx === 0 && lz === 0 && ly < 4)) addBlock(x + lx, y + ly, z + lz, 'leaf');
        }
      }
    }
  }

  function buildWorld() {
    for (const mesh of pickables.splice(0)) scene.remove(mesh);
    blocks.clear();

    for (let x = -WORLD_RADIUS; x <= WORLD_RADIUS; x++) {
      for (let z = -WORLD_RADIUS; z <= WORLD_RADIUS; z++) {
        const h = heightAt(x, z);
        const pond = isPond(x, z);
        for (let y = 0; y < h; y++) {
          let type = y === h - 1 ? 'grass' : (y > h - 4 ? 'dirt' : 'stone');
          if (isBeach(x, z) && y === h - 1) type = 'sand';
          if (pond && y >= h - 1) continue;
          addBlock(x, y, z, type);
        }
        if (pond) {
          const waterY = 2;
          for (let y = 0; y < waterY; y++) addBlock(x, y, z, y === waterY - 1 ? 'sand' : 'stone');
          addBlock(x, waterY, z, 'water');
        }
      }
    }

    const trees = [[-10, -8], [-4, -11], [6, -9], [10, 3], [-12, 6], [3, 10], [12, -5]];
    for (const [x, z] of trees) addTree(x, heightAt(x, z), z);

    for (let x = -14; x <= 14; x += 4) {
      for (let z = -14; z <= 14; z += 5) {
        if (((x * 13 + z * 7) % 5) === 0 && !isPond(x, z)) addBlock(x, heightAt(x, z), z, 'flower');
      }
    }

    player.position.set(0.5, heightAt(0, 6) + 2.5, 6.5);
    player.velocity.set(0, 0, 0);
  }

  function addSkyObjects() {
    const hemi = new THREE.HemisphereLight(0xbfefff, 0x5f7d45, 2.1);
    scene.add(hemi);

    const sunLight = new THREE.DirectionalLight(0xfff4b8, 2.15);
    sunLight.position.set(18, 32, 12);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.left = -32;
    sunLight.shadow.camera.right = 32;
    sunLight.shadow.camera.top = 32;
    sunLight.shadow.camera.bottom = -32;
    scene.add(sunLight);

    const sun = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff176 }));
    sun.position.copy(sunLight.position).multiplyScalar(1.5);
    scene.add(sun);

    const cloudMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    function makeCloud(x, y, z, scale = 1) {
      const group = new THREE.Group();
      const parts = [
        [0, 0, 0, 2.8, .65, 1.2], [1.8, .1, .15, 2.2, .7, 1.1], [-1.8, .05, -.05, 2.1, .6, 1.0], [.2, .45, 0, 1.6, .7, 1.2]
      ];
      for (const [px, py, pz, sx, sy, sz] of parts) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), cloudMaterial);
        mesh.position.set(px, py, pz);
        group.add(mesh);
      }
      group.position.set(x, y, z);
      group.scale.setScalar(scale);
      group.userData.cloud = true;
      scene.add(group);
    }
    makeCloud(-14, 18, -10, 1.2);
    makeCloud(2, 20, -16, 1.5);
    makeCloud(16, 17, -3, 1.0);
    makeCloud(-5, 21, 13, 1.35);
  }

  function updateCamera() {
    const tilt = [0, -0.16, 0.16][tiltIndex] || 0;
    camera.position.copy(player.position).add(new THREE.Vector3(0, EYE_HEIGHT, 0));
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    camera.rotation.z = tilt;
  }

  function resize() {
    const width = innerWidth;
    const height = innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }

  function toast(text) {
    els.toast.textContent = text;
    els.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.add('hidden'), 900);
  }

  function selectBlock(index) {
    selectedIndex = ((index % blockTypes.length) + blockTypes.length) % blockTypes.length;
    const type = blockTypes[selectedIndex];
    els.blockLabel.textContent = type.name;
    document.querySelectorAll('.block-btn').forEach((btn, i) => btn.classList.toggle('active', i === selectedIndex));
    toast(`Block: ${type.name}`);
  }

  function buildBlockBar() {
    els.blockBar.textContent = '';
    blockTypes.forEach((type, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'block-btn';
      button.textContent = type.name;
      button.style.borderBottom = `5px solid #${type.color.toString(16).padStart(6, '0')}`;
      button.addEventListener('pointerdown', stopUiPointer, { passive: false });
      button.addEventListener('click', event => { event.preventDefault(); selectBlock(index); });
      els.blockBar.appendChild(button);
    });
    selectBlock(0);
  }

  function stopUiPointer(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  function aimedBlock() {
    raycaster.setFromCamera(pointerCenter, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    return hits.find(hit => hit.distance < 7.2) || null;
  }

  function breakBlock() {
    const hit = aimedBlock();
    if (!hit) return toast('Tidak ada block dekat');
    if (hit.object.userData.typeId === 'water') return toast('Air tidak bisa dihancurkan');
    if (removeBlock(hit.object)) toast('Block dihancurkan');
  }

  function placeBlock() {
    const hit = aimedBlock();
    if (!hit) return toast('Arahkan ke block');
    const normal = hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).round();
    const { x, y, z } = hit.object.userData;
    const nx = x + normal.x;
    const ny = y + normal.y;
    const nz = z + normal.z;
    if (ny < 0 || ny > 18) return;
    const px = Math.floor(player.position.x);
    const py = Math.floor(player.position.y);
    const pz = Math.floor(player.position.z);
    if (Math.abs(nx - px) <= 1 && Math.abs(nz - pz) <= 1 && ny >= py && ny <= py + 2) return toast('Terlalu dekat');
    const type = blockTypes[selectedIndex].id;
    addBlock(nx, ny, nz, type);
    toast(`${blockTypes[selectedIndex].name} dipasang`);
  }

  function solidHeightBelow(x, z, maxY) {
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    let best = -Infinity;
    for (let y = Math.floor(maxY); y >= -1; y--) {
      const block = blocks.get(keyOf(bx, y, bz));
      if (block && block.userData.typeId !== 'water') { best = y + 1; break; }
    }
    return best;
  }

  function jump() {
    if (player.grounded) {
      player.velocity.y = JUMP_SPEED;
      player.grounded = false;
    }
  }

  function movementVector() {
    const forward = (keys.has('KeyW') || keys.has('ArrowUp') || virtualMove.forward ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') || virtualMove.back ? 1 : 0);
    const strafe = (keys.has('KeyD') || keys.has('ArrowRight') || virtualMove.right ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') || virtualMove.left ? 1 : 0);
    const dir = new THREE.Vector3(strafe, 0, -forward);
    if (dir.lengthSq() > 0) dir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    return dir;
  }

  function updatePlayer(dt) {
    const dir = movementVector();
    player.position.x += dir.x * MOVE_SPEED * dt;
    player.position.z += dir.z * MOVE_SPEED * dt;
    player.position.x = THREE.MathUtils.clamp(player.position.x, -WORLD_RADIUS + 1, WORLD_RADIUS);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -WORLD_RADIUS + 1, WORLD_RADIUS);

    player.velocity.y -= GRAVITY * dt;
    player.position.y += player.velocity.y * dt;
    const floor = solidHeightBelow(player.position.x, player.position.z, player.position.y);
    if (player.position.y <= floor + 0.03) {
      player.position.y = floor;
      player.velocity.y = 0;
      player.grounded = true;
    } else {
      player.grounded = false;
    }
    if (player.position.y < -4) {
      player.position.set(0.5, heightAt(0, 6) + 3, 6.5);
      player.velocity.set(0, 0, 0);
    }
  }

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.04, (now - lastTime) / 1000);
    lastTime = now;
    if (running && !paused) updatePlayer(dt);
    scene.children.forEach(obj => {
      if (obj.userData?.cloud) obj.position.x += dt * 0.28;
      if (obj.userData?.cloud && obj.position.x > 28) obj.position.x = -28;
    });
    updateCamera();
    renderer.render(scene, camera);
  }

  function setPaused(value) {
    paused = value;
    els.pauseMenu.classList.toggle('hidden', !paused);
  }

  function startGame() {
    running = true;
    paused = false;
    els.startScreen.classList.add('hidden');
    if (!isTouchDevice) els.canvas.requestPointerLock?.();
    toast('Selamat bermain!');
  }

  function bindKeyboard() {
    window.addEventListener('keydown', event => {
      keys.add(event.code);
      if (event.code === 'Space') { event.preventDefault(); jump(); }
      if (event.code === 'Escape') setPaused(!paused);
      if (event.code === 'KeyC') { tiltIndex = (tiltIndex + 1) % 3; toast(`Tilt ${tiltIndex}`); }
      if (/^Digit[1-8]$/.test(event.code)) selectBlock(Number(event.code.slice(5)) - 1);
    });
    window.addEventListener('keyup', event => keys.delete(event.code));
  }

  function bindPointerLook() {
    document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && running && !isTouchDevice) setPaused(true); });
    window.addEventListener('mousemove', event => {
      if (document.pointerLockElement === els.canvas && running && !paused) {
        yaw -= event.movementX * LOOK_SPEED;
        pitch -= event.movementY * LOOK_SPEED;
        pitch = THREE.MathUtils.clamp(pitch, -1.35, 1.2);
      }
    });

    els.canvas.addEventListener('pointerdown', event => {
      if (!running) return;
      if (!isTouchDevice && document.pointerLockElement !== els.canvas) els.canvas.requestPointerLock?.();
      lookPointerId = event.pointerId;
      lastLook = { x: event.clientX, y: event.clientY };
      els.canvas.setPointerCapture?.(event.pointerId);
    }, { passive: true });

    els.canvas.addEventListener('pointermove', event => {
      if (!running || paused || lookPointerId !== event.pointerId || !lastLook) return;
      const dx = event.clientX - lastLook.x;
      const dy = event.clientY - lastLook.y;
      yaw -= dx * LOOK_SPEED;
      pitch -= dy * LOOK_SPEED;
      pitch = THREE.MathUtils.clamp(pitch, -1.35, 1.2);
      lastLook = { x: event.clientX, y: event.clientY };
    }, { passive: true });

    const endLook = event => {
      if (lookPointerId === event.pointerId) { lookPointerId = null; lastLook = null; }
    };
    els.canvas.addEventListener('pointerup', endLook, { passive: true });
    els.canvas.addEventListener('pointercancel', endLook, { passive: true });

    els.canvas.addEventListener('click', event => { if (!isTouchDevice && running && !paused) breakBlock(); });
    els.canvas.addEventListener('contextmenu', event => { event.preventDefault(); if (running && !paused) placeBlock(); });
  }

  function bindMobileControls() {
    document.querySelectorAll('.pad').forEach(button => {
      const direction = button.dataset.move;
      const set = value => { virtualMove[direction] = value; button.classList.toggle('active', value); };
      button.addEventListener('pointerdown', event => { stopUiPointer(event); button.setPointerCapture?.(event.pointerId); set(true); });
      button.addEventListener('pointerup', event => { stopUiPointer(event); set(false); });
      button.addEventListener('pointercancel', event => { stopUiPointer(event); set(false); });
      button.addEventListener('lostpointercapture', () => set(false));
    });

    const bindHold = (button, action) => {
      let interval = null;
      const start = event => {
        stopUiPointer(event);
        action();
        clearInterval(interval);
        interval = setInterval(action, 230);
      };
      const stop = event => { if (event) stopUiPointer(event); clearInterval(interval); interval = null; };
      button.addEventListener('pointerdown', start);
      button.addEventListener('pointerup', stop);
      button.addEventListener('pointercancel', stop);
      button.addEventListener('lostpointercapture', () => stop());
    };

    els.jumpButton.addEventListener('pointerdown', event => { stopUiPointer(event); jump(); });
    bindHold(els.breakButton, breakBlock);
    bindHold(els.placeButton, placeBlock);
    els.tiltButton.addEventListener('pointerdown', event => { stopUiPointer(event); tiltIndex = (tiltIndex + 1) % 3; toast(`Kamera miring ${tiltIndex}`); });
  }

  function init() {
    resize();
    buildBlockBar();
    addSkyObjects();
    buildWorld();
    updateCamera();
    bindKeyboard();
    bindPointerLook();
    bindMobileControls();

    els.startButton.addEventListener('click', startGame);
    els.resumeButton.addEventListener('click', () => { setPaused(false); if (!isTouchDevice) els.canvas.requestPointerLock?.(); });
    els.resetButton.addEventListener('click', () => { buildWorld(); setPaused(false); toast('Dunia direset'); });
    window.addEventListener('resize', resize);
    requestAnimationFrame(animate);
  }

  init();
})();

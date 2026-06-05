import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

const canvas = document.getElementById('game-canvas');
const startButton = document.getElementById('start-button');
const activeBlockName = document.getElementById('active-block-name');
const touchControls = document.getElementById('touch-controls');
const errorBox = document.getElementById('error-box');

if (!canvas || !startButton || !activeBlockName || !touchControls || !errorBox) {
  throw new Error('Elemen HTML utama tidak ditemukan. Pastikan index.html tidak berubah struktur ID-nya.');
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 45, 120);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 5.2, 8);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x5c7f38, 2.15);
scene.add(hemiLight);

const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.position.set(20, 35, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 100;
sun.shadow.camera.left = -35;
sun.shadow.camera.right = 35;
sun.shadow.camera.top = 35;
sun.shadow.camera.bottom = -35;
scene.add(sun);

const blockTypes = [
  { id: 1, name: 'Grass', color: 0x4caf50 },
  { id: 2, name: 'Dirt', color: 0x8d5a2b },
  { id: 3, name: 'Stone', color: 0x898989 },
  { id: 4, name: 'Sand', color: 0xd6c16a }
];
let activeBlockIndex = 0;

const world = new Map();
const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
const materialCache = new Map();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0);
const clock = new THREE.Clock();
const reusableBlocks = [];

const player = {
  velocity: new THREE.Vector3(),
  direction: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  speed: 8.5,
  jumpSpeed: 8.4,
  gravity: 24,
  height: 1.75,
  radius: 0.28,
  onGround: false
};

const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false
};

let isPlaying = false;
let lastSafePosition = camera.position.clone();
let lookPointerId = null;
let lastLookPoint = null;

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
}

function isTouchDevice() {
  return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

function keyOf(x, y, z) {
  return `${x},${y},${z}`;
}

function getMaterial(typeId) {
  if (!materialCache.has(typeId)) {
    const block = blockTypes.find((item) => item.id === typeId) || blockTypes[0];
    materialCache.set(typeId, new THREE.MeshLambertMaterial({ color: block.color }));
  }
  return materialCache.get(typeId);
}

function addBlock(x, y, z, typeId = 1) {
  const key = keyOf(x, y, z);
  if (world.has(key)) return false;

  const mesh = new THREE.Mesh(cubeGeometry, getMaterial(typeId));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { key, typeId };
  scene.add(mesh);
  world.set(key, mesh);
  reusableBlocks.push(mesh);
  return true;
}

function removeBlock(mesh) {
  if (!mesh || !mesh.userData || mesh.position.y < 0) return false;
  scene.remove(mesh);
  world.delete(mesh.userData.key);
  const index = reusableBlocks.indexOf(mesh);
  if (index >= 0) reusableBlocks.splice(index, 1);
  return true;
}

function getHeightAt(x, z) {
  const value = Math.sin(x * 0.45) * 0.75 + Math.cos(z * 0.35) * 0.65 + Math.sin((x + z) * 0.2) * 0.5;
  return Math.max(0, Math.floor(value + 1.2));
}

function generateWorld() {
  const radius = 18;
  for (let x = -radius; x <= radius; x += 1) {
    for (let z = -radius; z <= radius; z += 1) {
      const height = getHeightAt(x, z);
      for (let y = 0; y <= height; y += 1) {
        let typeId = 2;
        if (y === height) typeId = 1;
        if (y <= height - 3) typeId = 3;
        if (Math.abs(x) > 14 || Math.abs(z) > 14) typeId = y === height ? 4 : typeId;
        addBlock(x, y, z, typeId);
      }
    }
  }

  for (let i = 0; i < 14; i += 1) {
    const x = Math.floor(Math.random() * 24) - 12;
    const z = Math.floor(Math.random() * 24) - 12;
    const groundY = getHeightAt(x, z) + 1;
    addBlock(x, groundY, z, 2);
    addBlock(x, groundY + 1, z, 2);
    addBlock(x, groundY + 2, z, 1);
  }
}

generateWorld();

function setActiveBlock(index) {
  activeBlockIndex = THREE.MathUtils.clamp(index, 0, blockTypes.length - 1);
  activeBlockName.textContent = blockTypes[activeBlockIndex].name;

  document.querySelectorAll('[data-block]').forEach((button) => {
    const buttonIndex = Number(button.getAttribute('data-block'));
    button.classList.toggle('selected', buttonIndex === activeBlockIndex);
  });
}

function getTargetBlock() {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(reusableBlocks, false);
  return hits.find((hit) => hit.distance <= 7) || null;
}

function breakTargetBlock() {
  if (!isPlaying) return;
  const hit = getTargetBlock();
  if (!hit) return;
  removeBlock(hit.object);
}

function placeBlockNearTarget() {
  if (!isPlaying) return;
  const hit = getTargetBlock();
  if (!hit || !hit.face) return;

  const pos = hit.object.position.clone().add(hit.face.normal);
  const x = Math.round(pos.x);
  const y = Math.round(pos.y);
  const z = Math.round(pos.z);

  const playerFeet = camera.position.y - player.height;
  const nearPlayer = Math.abs(camera.position.x - x) < 0.8 &&
    Math.abs(camera.position.z - z) < 0.8 &&
    y >= Math.floor(playerFeet) &&
    y <= Math.ceil(camera.position.y);

  if (!nearPlayer) addBlock(x, y, z, blockTypes[activeBlockIndex].id);
}

function updateCameraRotation() {
  camera.rotation.order = 'YXZ';
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

function requestMouseLock() {
  if (isTouchDevice()) return;
  if (canvas.requestPointerLock) canvas.requestPointerLock();
}

function startGame() {
  isPlaying = true;
  startButton.classList.add('hidden');
  canvas.focus({ preventScroll: true });
  requestMouseLock();
}

startButton.addEventListener('click', startGame);

canvas.addEventListener('click', () => {
  if (!isPlaying || isTouchDevice()) return;
  if (document.pointerLockElement !== canvas) requestMouseLock();
});

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && isPlaying && !isTouchDevice()) {
    startButton.classList.remove('hidden');
  }
});

document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== canvas) return;
  const sensitivity = 0.0022;
  player.yaw -= event.movementX * sensitivity;
  player.pitch -= event.movementY * sensitivity;
  player.pitch = THREE.MathUtils.clamp(player.pitch, -Math.PI / 2 + 0.04, Math.PI / 2 - 0.04);
  updateCameraRotation();
});

document.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  switch (event.code) {
    case 'KeyW': keys.forward = true; break;
    case 'KeyS': keys.backward = true; break;
    case 'KeyA': keys.left = true; break;
    case 'KeyD': keys.right = true; break;
    case 'Space':
      event.preventDefault();
      if (player.onGround) {
        player.velocity.y = player.jumpSpeed;
        player.onGround = false;
      }
      break;
    case 'Digit1': setActiveBlock(0); break;
    case 'Digit2': setActiveBlock(1); break;
    case 'Digit3': setActiveBlock(2); break;
    case 'Digit4': setActiveBlock(3); break;
    default: break;
  }
});

document.addEventListener('keyup', (event) => {
  switch (event.code) {
    case 'KeyW': keys.forward = false; break;
    case 'KeyS': keys.backward = false; break;
    case 'KeyA': keys.left = false; break;
    case 'KeyD': keys.right = false; break;
    default: break;
  }
});

document.addEventListener('mousedown', (event) => {
  if (!isPlaying) return;
  const canAct = event.target === canvas || document.pointerLockElement === canvas;
  if (!canAct) return;
  if (event.button === 0) breakTargetBlock();
  if (event.button === 2) placeBlockNearTarget();
});

document.addEventListener('contextmenu', (event) => event.preventDefault());

function bindHoldButton(button, onStart, onEnd) {
  const start = (event) => {
    event.preventDefault();
    onStart();
    button.setPointerCapture?.(event.pointerId);
  };
  const end = (event) => {
    event.preventDefault();
    onEnd();
    button.releasePointerCapture?.(event.pointerId);
  };

  button.addEventListener('pointerdown', start);
  button.addEventListener('pointerup', end);
  button.addEventListener('pointercancel', end);
  button.addEventListener('lostpointercapture', onEnd);
}

function setupTouchControls() {
  if (!isTouchDevice()) return;
  touchControls.classList.remove('hidden');
  touchControls.setAttribute('aria-hidden', 'false');

  const moveButtons = touchControls.querySelectorAll('[data-move]');
  moveButtons.forEach((button) => {
    const move = button.getAttribute('data-move');
    bindHoldButton(
      button,
      () => { keys[move] = true; },
      () => { keys[move] = false; }
    );
  });

  document.getElementById('touch-jump').addEventListener('click', (event) => {
    event.preventDefault();
    if (player.onGround) {
      player.velocity.y = player.jumpSpeed;
      player.onGround = false;
    }
  });

  document.getElementById('touch-break').addEventListener('click', (event) => {
    event.preventDefault();
    breakTargetBlock();
  });

  document.getElementById('touch-place').addEventListener('click', (event) => {
    event.preventDefault();
    placeBlockNearTarget();
  });

  document.querySelectorAll('[data-block]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      setActiveBlock(Number(button.getAttribute('data-block')));
    });
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (!isPlaying || event.pointerType === 'mouse') return;
    lookPointerId = event.pointerId;
    lastLookPoint = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture?.(event.pointerId);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!isPlaying || event.pointerId !== lookPointerId || !lastLookPoint) return;
    const dx = event.clientX - lastLookPoint.x;
    const dy = event.clientY - lastLookPoint.y;
    lastLookPoint = { x: event.clientX, y: event.clientY };
    player.yaw -= dx * 0.006;
    player.pitch -= dy * 0.006;
    player.pitch = THREE.MathUtils.clamp(player.pitch, -Math.PI / 2 + 0.04, Math.PI / 2 - 0.04);
    updateCameraRotation();
  });

  const endLook = (event) => {
    if (event.pointerId === lookPointerId) {
      lookPointerId = null;
      lastLookPoint = null;
    }
  };
  canvas.addEventListener('pointerup', endLook);
  canvas.addEventListener('pointercancel', endLook);
}

setupTouchControls();

function collidesAt(position) {
  const minX = Math.floor(position.x - player.radius);
  const maxX = Math.floor(position.x + player.radius);
  const minY = Math.floor(position.y - player.height);
  const maxY = Math.floor(position.y - 0.1);
  const minZ = Math.floor(position.z - player.radius);
  const maxZ = Math.floor(position.z + player.radius);

  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        if (world.has(keyOf(x, y, z))) return true;
      }
    }
  }
  return false;
}

function moveAxis(axis, amount) {
  if (amount === 0) return;
  const next = camera.position.clone();
  next[axis] += amount;
  if (!collidesAt(next)) {
    camera.position[axis] = next[axis];
  } else if (axis === 'y') {
    if (amount < 0) player.onGround = true;
    player.velocity.y = 0;
  }
}

function updateMovement(delta) {
  player.direction.set(0, 0, 0);
  if (keys.forward) player.direction.z -= 1;
  if (keys.backward) player.direction.z += 1;
  if (keys.left) player.direction.x -= 1;
  if (keys.right) player.direction.x += 1;

  if (player.direction.lengthSq() > 0) {
    player.direction.normalize();
    const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
    const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    const move = new THREE.Vector3();
    move.addScaledVector(forward, -player.direction.z);
    move.addScaledVector(right, player.direction.x);
    move.normalize().multiplyScalar(player.speed * delta);
    moveAxis('x', move.x);
    moveAxis('z', move.z);
  }

  player.velocity.y -= player.gravity * delta;
  player.onGround = false;
  moveAxis('y', player.velocity.y * delta);

  if (camera.position.y < -20) {
    camera.position.copy(lastSafePosition);
    player.velocity.set(0, 0, 0);
  }

  if (player.onGround) lastSafePosition.copy(camera.position);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  if (isPlaying) updateMovement(delta);
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('error', (event) => {
  showError(`Terjadi error: ${event.message}`);
});

window.addEventListener('unhandledrejection', (event) => {
  showError(`Terjadi error async: ${event.reason?.message || event.reason}`);
});

setActiveBlock(0);
updateCameraRotation();
animate();

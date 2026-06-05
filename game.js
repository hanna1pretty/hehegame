import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const errorBox = document.getElementById('errorBox');
window.addEventListener('error', (event) => showError(event.message));
window.addEventListener('unhandledrejection', (event) => showError(String(event.reason || event)));
function showError(message) {
  errorBox.style.display = 'block';
  errorBox.textContent = 'Game error: ' + message;
}

const canvas = document.getElementById('gameCanvas');
const menu = document.getElementById('menu');
const startBtn = document.getElementById('startBtn');
const statusText = document.getElementById('statusText');
const hotbar = document.getElementById('hotbar');
const cameraPanel = document.getElementById('cameraPanel');
const cameraBtn = document.getElementById('cameraBtn');
const resetBtn = document.getElementById('resetBtn');
const pauseBtn = document.getElementById('pauseBtn');
const jumpBtn = document.getElementById('jumpBtn');
const breakBtn = document.getElementById('breakBtn');
const placeBtn = document.getElementById('placeBtn');
const joystick = document.getElementById('joystick');
const stick = document.getElementById('stick');

const isTouch = matchMedia('(pointer: coarse)').matches;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7fd3f2);
scene.fog = new THREE.Fog(0x92d9ee, 35, 86);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 220);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const hemi = new THREE.HemisphereLight(0xdff8ff, 0x406531, 1.35);
scene.add(hemi);
const sunLight = new THREE.DirectionalLight(0xfff0b8, 2.25);
sunLight.position.set(36, 54, 26);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.left = -46;
sunLight.shadow.camera.right = 46;
sunLight.shadow.camera.top = 46;
sunLight.shadow.camera.bottom = -46;
scene.add(sunLight);

const world = new Map();
const decorative = [];
const mobs = [];
const clouds = [];
const blockSize = 1;
const worldRadius = 24;
const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);
const targetOutline = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.035, 1.035, 1.035)),
  new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 })
);
targetOutline.visible = false;
scene.add(targetOutline);

const blockTypes = {
  grass: { color: 0x46b950, rough: 0.92 },
  dirt: { color: 0x82501f, rough: 0.96 },
  stone: { color: 0x858785, rough: 1.0 },
  sand: { color: 0xe6d982, rough: 0.9 },
  water: { color: 0x38a8e8, rough: 0.35, transparent: true, opacity: 0.68, solid: false },
  wood: { color: 0x7a4b22, rough: 0.95 },
  leaf: { color: 0x2e9f3d, rough: 0.9 },
  flower: { color: 0xff6da9, rough: 0.8, solid: false },
  grassplant: { color: 0x2dbd4a, rough: 0.8, solid: false },
  plank: { color: 0xb98245, rough: 0.88 },
  brick: { color: 0xa84d3c, rough: 0.93 },
  glass: { color: 0xbdefff, rough: 0.2, transparent: true, opacity: 0.46 }
};
let selectedBlock = 'grass';
let selectedIndex = 0;
const blockKeys = ['grass', 'dirt', 'stone', 'sand', 'wood', 'leaf', 'plank', 'brick', 'glass'];
const blockLabels = { grass: 'Grass', dirt: 'Dirt', stone: 'Stone', sand: 'Sand', wood: 'Wood', leaf: 'Leaf', plank: 'Plank', brick: 'Brick', glass: 'Glass' };
const blockColors = { grass: '#47bb52', dirt: '#805020', stone: '#858785', sand: '#eadb82', wood: '#7a4b22', leaf: '#2e9f3d', plank: '#b98245', brick: '#a84d3c', glass: '#bdefff' };

const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
function mat(type) {
  const info = blockTypes[type] || blockTypes.grass;
  const material = new THREE.MeshStandardMaterial({
    color: info.color,
    roughness: info.rough,
    metalness: 0,
    transparent: !!info.transparent,
    opacity: info.opacity ?? 1
  });
  return material;
}
const materials = Object.fromEntries(Object.keys(blockTypes).map(k => [k, mat(k)]));

const player = {
  pos: new THREE.Vector3(0, 7, 8),
  vel: new THREE.Vector3(),
  yaw: Math.PI,
  pitch: -0.22,
  radius: 0.32,
  height: 1.72,
  eye: 1.5,
  onGround: false
};

const keys = new Set();
const heldActions = { break: false, place: false };
let running = false;
let paused = false;
let pointerLocked = false;
let lastTime = performance.now();
let actionCooldown = 0;
let cameraMode = 1;
const cameraModes = [
  { name: 'Dekat', distance: 0, height: 0, top: false },
  { name: 'Normal', distance: 4.8, height: 1.0, top: false },
  { name: 'Jauh', distance: 7.2, height: 2.1, top: false },
  { name: 'Cinematic', distance: 8.4, height: 3.2, top: false },
  { name: 'Top', distance: 3.5, height: 9.0, top: true }
];

const joystickState = { active: false, id: null, x: 0, y: 0, max: 42 };

function key(x, y, z) { return `${x},${y},${z}`; }
function parseKey(k) { return k.split(',').map(Number); }
function isSolidType(type) { return blockTypes[type]?.solid !== false; }
function hasSolidBlock(x, y, z) {
  const item = world.get(key(x, y, z));
  return !!item && isSolidType(item.type);
}

function heightAt(x, z) {
  const rolling = Math.sin(x * 0.28) * 1.15 + Math.cos(z * 0.24) * 1.05 + Math.sin((x + z) * 0.16) * 0.85;
  const hill = Math.exp(-((x - 6) ** 2 + (z + 5) ** 2) / 110) * 4.2;
  const valley = Math.exp(-((x + 7) ** 2 + (z - 8) ** 2) / 90) * -1.5;
  return Math.max(1, Math.round(2.5 + rolling + hill + valley));
}

function addBlock(x, y, z, type, cast = true) {
  const k = key(x, y, z);
  if (world.has(k)) removeBlock(x, y, z);
  const mesh = new THREE.Mesh(boxGeometry, materials[type] || materials.grass);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast && type !== 'water';
  mesh.receiveShadow = true;
  mesh.userData = { block: true, type, x, y, z };
  scene.add(mesh);
  world.set(k, { type, mesh });
}
function removeBlock(x, y, z) {
  const item = world.get(key(x, y, z));
  if (!item) return;
  scene.remove(item.mesh);
  // Geometry/material are shared by many blocks, so do not dispose them per block.
  world.delete(key(x, y, z));
}

function addDecoration(mesh) {
  decorative.push(mesh);
  scene.add(mesh);
}

function generateWorld() {
  for (const item of world.values()) scene.remove(item.mesh);
  world.clear();
  for (const obj of decorative) scene.remove(obj);
  decorative.length = 0;
  for (const c of clouds) scene.remove(c);
  clouds.length = 0;
  for (const m of mobs) scene.remove(m.group);
  mobs.length = 0;

  for (let x = -worldRadius; x <= worldRadius; x++) {
    for (let z = -worldRadius; z <= worldRadius; z++) {
      const dist = Math.sqrt(x * x + z * z);
      if (dist > worldRadius + 0.8) continue;
      const h = heightAt(x, z);
      const waterLevel = 3;
      for (let y = 0; y <= h; y++) {
        let type = 'dirt';
        if (y === h) type = h <= waterLevel + 1 ? 'sand' : 'grass';
        if (y < h - 3) type = 'stone';
        addBlock(x, y, z, type, y === h);
      }
      if (h < waterLevel) {
        for (let y = h + 1; y <= waterLevel; y++) addBlock(x, y, z, 'water', false);
      }
      if (h > 3 && pseudo(x, z) > 0.83 && Math.abs(x) + Math.abs(z) > 7) addTree(x, h + 1, z);
      if (h > 3 && pseudo(x * 2 + 9, z * 2 - 4) > 0.9) addSmallPlant(x, h + 1, z, pseudo(x - 5, z + 8) > .55 ? 'flower' : 'grassplant');
      if (h > 4 && pseudo(x + 17, z - 22) > 0.94) addRock(x, h + 1, z);
    }
  }
  addSunAndSky();
  addClouds();
  addBirds();
  player.pos.set(0, heightAt(0, 0) + 4, 8);
  player.vel.set(0, 0, 0);
}

function pseudo(x, z) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function addTree(x, y, z) {
  const height = 3 + Math.floor(pseudo(x + 2, z + 2) * 3);
  for (let i = 0; i < height; i++) addBlock(x, y + i, z, 'wood');
  const top = y + height;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -2; dz <= 2; dz++) {
        const d = Math.abs(dx) + Math.abs(dz) + Math.max(0, Math.abs(dy) - .2);
        if (d <= 3.2 && pseudo(x + dx * 5, z + dz * 5 + dy) > 0.13) addBlock(x + dx, top + dy, z + dz, 'leaf');
      }
    }
  }
  addBlock(x, top + 2, z, 'leaf');
}

function addSmallPlant(x, y, z, type) {
  const geo = new THREE.BoxGeometry(type === 'flower' ? .18 : .12, type === 'flower' ? .45 : .38, type === 'flower' ? .18 : .12);
  const mesh = new THREE.Mesh(geo, materials[type]);
  mesh.position.set(x + (pseudo(x, z) - .5) * .4, y - .22, z + (pseudo(z, x) - .5) * .4);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addDecoration(mesh);
}

function addRock(x, y, z) {
  const geo = new THREE.DodecahedronGeometry(.32 + pseudo(x, z) * .24, 0);
  const mesh = new THREE.Mesh(geo, materials.stone);
  mesh.position.set(x + .1, y - .25, z - .08);
  mesh.rotation.set(pseudo(x, z), pseudo(z, x), 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addDecoration(mesh);
}

function addSunAndSky() {
  const sunGeo = new THREE.SphereGeometry(4.8, 24, 16);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xffdb65 });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  sun.position.set(42, 58, -38);
  addDecoration(sun);
}

function addClouds() {
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: .86 });
  for (let i = 0; i < 11; i++) {
    const group = new THREE.Group();
    const baseX = -36 + i * 8 + pseudo(i, 2) * 5;
    const baseZ = -28 + pseudo(i, 9) * 56;
    const baseY = 21 + pseudo(i, 3) * 10;
    for (let p = 0; p < 4 + Math.floor(pseudo(i, 4) * 3); p++) {
      const geo = new THREE.BoxGeometry(2.2 + pseudo(i, p) * 2.2, .8 + pseudo(p, i) * .8, 1.5 + pseudo(i + p, 0) * 1.7);
      const part = new THREE.Mesh(geo, cloudMat);
      part.position.set((p - 2) * 1.6, pseudo(p, i) * .7, (pseudo(i, p + 7) - .5) * 1.8);
      group.add(part);
    }
    group.position.set(baseX, baseY, baseZ);
    clouds.push(group);
    scene.add(group);
  }
}

function addBirds() {
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x1f2937 });
  for (let i = 0; i < 5; i++) {
    const group = new THREE.Group();
    const wingGeo = new THREE.BoxGeometry(.65, .08, .08);
    const left = new THREE.Mesh(wingGeo, birdMat);
    const right = new THREE.Mesh(wingGeo, birdMat);
    left.position.x = -.28;
    right.position.x = .28;
    group.add(left, right);
    group.position.set(-12 + i * 5, 15 + pseudo(i, 1) * 5, -14 + pseudo(i, 2) * 28);
    mobs.push({ group, speed: .5 + pseudo(i, 3) * .35, phase: pseudo(i, 5) * Math.PI * 2, left, right });
    scene.add(group);
  }
}

function updateSelected(blockOrIndex) {
  const idx = typeof blockOrIndex === 'number' ? blockOrIndex : blockKeys.indexOf(blockOrIndex);
  if (idx < 0 || idx >= blockKeys.length) return;
  const block = blockKeys[idx];
  if (!blockTypes[block] || block === 'water') return;
  selectedBlock = block;
  selectedIndex = idx;
  statusText.textContent = `${blockLabels[selectedBlock]} • ${cameraModes[cameraMode].name}`;
  document.querySelectorAll('.slot').forEach((slot, i) => slot.classList.toggle('selected', i === selectedIndex));
  const selectedSlot = document.querySelector(`.slot[data-index="${selectedIndex}"]`);
  selectedSlot?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

function createHotbar() {
  hotbar.innerHTML = '';
  blockKeys.forEach((block, i) => {
    const slot = document.createElement('button');
    slot.className = 'slot';
    slot.dataset.block = block;
    slot.dataset.index = String(i);
    slot.setAttribute('aria-label', `Pilih ${blockLabels[block]}`);
    slot.innerHTML = `<span class="num">${i + 1}</span><span class="cube" style="background:${blockColors[block]}"></span><span class="label">${blockLabels[block]}</span>`;
    slot.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); updateSelected(i); });
    hotbar.appendChild(slot);
  });
}

function cycleSelected(dir) {
  updateSelected((selectedIndex + dir + blockKeys.length) % blockKeys.length);
}

function setCameraMode(index) {
  cameraMode = THREE.MathUtils.clamp(index, 0, cameraModes.length - 1);
  updateSelected(selectedIndex);
  document.querySelectorAll('#cameraPanel button').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.camera) === cameraMode));
}

function cycleCamera() {
  setCameraMode((cameraMode + 1) % cameraModes.length);
}

function aabbOverlapsSolid(pos) {
  const minX = Math.floor(pos.x - player.radius);
  const maxX = Math.floor(pos.x + player.radius);
  const minY = Math.floor(pos.y);
  const maxY = Math.floor(pos.y + player.height);
  const minZ = Math.floor(pos.z - player.radius);
  const maxZ = Math.floor(pos.z + player.radius);
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (hasSolidBlock(x, y, z)) return true;
      }
    }
  }
  return false;
}

function moveAxis(axis, amount) {
  if (amount === 0) return;
  const stepCount = Math.max(1, Math.ceil(Math.abs(amount) / 0.045));
  const step = amount / stepCount;
  for (let i = 0; i < stepCount; i++) {
    const next = player.pos.clone();
    next[axis] += step;
    if (!aabbOverlapsSolid(next)) {
      player.pos.copy(next);
      player.onGround = false;
    } else {
      if (axis === 'y' && step < 0) player.onGround = true;
      if (axis === 'y') player.vel.y = 0;
      break;
    }
  }
}

function updatePlayer(dt) {
  const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  let inputX = 0, inputZ = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) inputZ += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) inputZ -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) inputX += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) inputX -= 1;
  inputX += joystickState.x;
  inputZ += -joystickState.y;
  const len = Math.hypot(inputX, inputZ);
  if (len > 1) { inputX /= len; inputZ /= len; }
  const speed = player.onGround ? 4.9 : 3.9;
  const desired = new THREE.Vector3();
  desired.addScaledVector(forward, inputZ * speed);
  desired.addScaledVector(right, inputX * speed);
  player.vel.x = THREE.MathUtils.lerp(player.vel.x, desired.x, 1 - Math.pow(0.0008, dt));
  player.vel.z = THREE.MathUtils.lerp(player.vel.z, desired.z, 1 - Math.pow(0.0008, dt));
  player.vel.y -= 16.2 * dt;
  player.onGround = false;
  moveAxis('x', player.vel.x * dt);
  moveAxis('z', player.vel.z * dt);
  moveAxis('y', player.vel.y * dt);
  if (player.pos.y < -8) {
    player.pos.set(0, heightAt(0, 0) + 5, 8);
    player.vel.set(0, 0, 0);
  }
}

function jump() {
  if (player.onGround) {
    player.vel.y = 7.2;
    player.onGround = false;
  }
}

function safeCameraPosition(look, desired) {
  const dir = desired.clone().sub(look);
  const distance = dir.length();
  if (distance < 0.01) return desired;
  dir.normalize();
  raycaster.set(look, dir);
  raycaster.far = distance;
  const hits = raycaster.intersectObjects(solidMeshes(), false);
  if (!hits.length) return desired;
  return look.clone().addScaledVector(dir, Math.max(0.8, hits[0].distance - 0.35));
}

function updateCamera() {
  player.pitch = THREE.MathUtils.clamp(player.pitch, -1.35, 1.15);
  const mode = cameraModes[cameraMode];
  if (mode.distance === 0) {
    camera.position.set(player.pos.x, player.pos.y + player.eye, player.pos.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;
    camera.rotation.z = 0;
    return;
  }
  const look = new THREE.Vector3(player.pos.x, player.pos.y + 1.05, player.pos.z);
  if (mode.top) {
    const desired = new THREE.Vector3(player.pos.x - Math.sin(player.yaw) * mode.distance, player.pos.y + mode.height, player.pos.z - Math.cos(player.yaw) * mode.distance);
    camera.position.copy(safeCameraPosition(look, desired));
    camera.lookAt(look);
    return;
  }
  const back = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const desired = look.clone().addScaledVector(back, mode.distance);
  desired.y += mode.height + Math.sin(-player.pitch) * 1.4;
  camera.position.copy(safeCameraPosition(look, desired));
  camera.lookAt(look.x + Math.sin(player.yaw) * 4, look.y + player.pitch * 2.2, look.z + Math.cos(player.yaw) * 4);
}

function solidMeshes() {
  return Array.from(world.values()).filter(b => b.type !== 'water' && isSolidType(b.type)).map(b => b.mesh);
}

function getTarget() {
  raycaster.setFromCamera(center, camera);
  raycaster.far = 7;
  const hits = raycaster.intersectObjects(solidMeshes(), false);
  return hits[0] || null;
}

function breakBlock() {
  const hit = getTarget();
  if (!hit) return;
  const data = hit.object.userData;
  if (data.y <= 0) return;
  removeBlock(data.x, data.y, data.z);
}

function placeBlock() {
  const hit = getTarget();
  if (!hit) return;
  const data = hit.object.userData;
  const n = hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld));
  const x = data.x + Math.round(n.x);
  const y = data.y + Math.round(n.y);
  const z = data.z + Math.round(n.z);
  const nextPos = new THREE.Vector3(x, y, z);
  const old = world.get(key(x, y, z));
  if (old && old.type !== 'water') return;
  if (blockIntersectsPlayer(x, y, z)) return;
  addBlock(x, y, z, selectedBlock);
}

function blockIntersectsPlayer(x, y, z) {
  const pxMin = player.pos.x - player.radius;
  const pxMax = player.pos.x + player.radius;
  const pyMin = player.pos.y;
  const pyMax = player.pos.y + player.height;
  const pzMin = player.pos.z - player.radius;
  const pzMax = player.pos.z + player.radius;
  return x - .5 < pxMax && x + .5 > pxMin && y - .5 < pyMax && y + .5 > pyMin && z - .5 < pzMax && z + .5 > pzMin;
}

function doAction(name) {
  if (actionCooldown > 0) return;
  if (name === 'break') breakBlock();
  if (name === 'place') placeBlock();
  actionCooldown = 0.16;
}


function updateTargetHighlight() {
  const hit = getTarget();
  if (!hit) {
    targetOutline.visible = false;
    return;
  }
  const data = hit.object.userData;
  targetOutline.position.set(data.x, data.y, data.z);
  targetOutline.visible = true;
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.033, (now - lastTime) / 1000 || 0.016);
  lastTime = now;
  if (!running || paused) {
    renderer.render(scene, camera);
    return;
  }
  actionCooldown = Math.max(0, actionCooldown - dt);
  updatePlayer(dt);
  updateCamera();
  updateTargetHighlight();
  const t = now * 0.001;
  for (const c of clouds) {
    c.position.x += dt * 0.55;
    if (c.position.x > 43) c.position.x = -43;
  }
  for (const m of mobs) {
    m.group.position.x += dt * m.speed;
    if (m.group.position.x > 30) m.group.position.x = -30;
    m.group.position.y += Math.sin(t * 2 + m.phase) * dt * .2;
    m.left.rotation.z = Math.sin(t * 8 + m.phase) * .55;
    m.right.rotation.z = -Math.sin(t * 8 + m.phase) * .55;
  }
  if (heldActions.break) doAction('break');
  if (heldActions.place) doAction('place');
  renderer.render(scene, camera);
}

function startGame() {
  running = true;
  menu.style.display = 'none';
  if (!isTouch && canvas.requestPointerLock) canvas.requestPointerLock();
}

function handleLook(dx, dy) {
  player.yaw -= dx * 0.0032;
  player.pitch -= dy * 0.0028;
}

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

document.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Space') jump();
  if (e.code === 'KeyC') cycleCamera();
  if (e.code === 'KeyR') generateWorld();
  if (e.code === 'KeyQ') cycleSelected(-1);
  if (e.code === 'KeyE') cycleSelected(1);
  const idx = Number(e.key) - 1;
  if (idx >= 0 && idx < blockKeys.length) updateSelected(idx);
});
document.addEventListener('keyup', (e) => keys.delete(e.code));
document.addEventListener('pointerlockchange', () => { pointerLocked = document.pointerLockElement === canvas; });
document.addEventListener('mousemove', (e) => { if (pointerLocked) handleLook(e.movementX, e.movementY); });
canvas.addEventListener('click', () => { if (!isTouch && !pointerLocked && running) canvas.requestPointerLock?.(); });
canvas.addEventListener('mousedown', (e) => { if (!running) return; if (e.button === 0) doAction('break'); if (e.button === 2) doAction('place'); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('wheel', (e) => { if (!running) return; e.preventDefault(); cycleSelected(e.deltaY > 0 ? 1 : -1); }, { passive: false });

let lookPointerId = null;
let lastLook = null;
canvas.addEventListener('pointerdown', (e) => {
  if (!isTouch || !running) return;
  if (e.target !== canvas) return;
  if (e.clientX < innerWidth * 0.42) return;
  lookPointerId = e.pointerId;
  lastLook = { x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!isTouch || e.pointerId !== lookPointerId || !lastLook) return;
  handleLook(e.clientX - lastLook.x, e.clientY - lastLook.y);
  lastLook = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerup', (e) => { if (e.pointerId === lookPointerId) { lookPointerId = null; lastLook = null; } });
canvas.addEventListener('pointercancel', (e) => { if (e.pointerId === lookPointerId) { lookPointerId = null; lastLook = null; } });

function setHeld(name, value) { heldActions[name] = value; }
function bindHold(btn, name) {
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); setHeld(name, true); doAction(name); btn.setPointerCapture(e.pointerId); });
  btn.addEventListener('pointerup', (e) => { e.preventDefault(); setHeld(name, false); });
  btn.addEventListener('pointercancel', () => setHeld(name, false));
  btn.addEventListener('pointerleave', () => setHeld(name, false));
}
bindHold(breakBtn, 'break');
bindHold(placeBtn, 'place');
jumpBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); jump(); });
cameraBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); cameraPanel.classList.toggle('hidden'); cycleCamera(); });
resetBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); generateWorld(); });
pauseBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); paused = !paused; pauseBtn.textContent = paused ? 'Resume' : 'Pause'; });
startBtn.addEventListener('click', startGame);

document.querySelectorAll('#cameraPanel button').forEach(btn => {
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); setCameraMode(Number(btn.dataset.camera)); });
});

joystick.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  joystickState.active = true;
  joystickState.id = e.pointerId;
  joystick.setPointerCapture(e.pointerId);
  updateJoystick(e);
});
joystick.addEventListener('pointermove', (e) => { if (joystickState.active && e.pointerId === joystickState.id) updateJoystick(e); });
joystick.addEventListener('pointerup', resetJoystick);
joystick.addEventListener('pointercancel', resetJoystick);
function updateJoystick(e) {
  const rect = joystick.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = e.clientX - cx;
  let dy = e.clientY - cy;
  const dist = Math.hypot(dx, dy);
  const max = joystickState.max;
  if (dist > max) { dx = dx / dist * max; dy = dy / dist * max; }
  joystickState.x = dx / max;
  joystickState.y = dy / max;
  stick.style.transform = `translate(${dx}px, ${dy}px)`;
}
function resetJoystick(e) {
  if (e && e.pointerId !== joystickState.id) return;
  joystickState.active = false;
  joystickState.id = null;
  joystickState.x = 0;
  joystickState.y = 0;
  stick.style.transform = 'translate(0, 0)';
}

createHotbar();
updateSelected(0);
setCameraMode(cameraMode);
generateWorld();
updateCamera();
requestAnimationFrame(animate);

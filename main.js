import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.154.0/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.154.0/examples/jsm/loaders/GLTFLoader.js';

// === Global Variables ===
let camera, scene, renderer, controls;
let moveForward, moveBackward, moveLeft, moveRight, canJump;
let prevTime, velocity, direction;
let enemyList = [];
let currentRound = 1, score = 0;
let bullets = [];

const baseEnemyCount = 3;
const enemySpeed = 1.0;
let gameRunning = false;

// DOM Elements
const info = document.getElementById('info');
const menu = document.getElementById('menu');
const playButton = document.getElementById('playButton');
const highScoreDisplay = document.getElementById('highScoreDisplay');
const gameContainer = document.getElementById('gameContainer');

// Jumping & Sprinting
let isSprinting = false;
const GRAVITY = 9.8 * 100; // gravity constant

// Ammo & Reloading
let ammo, maxAmmo = 10, reloading = false;
const reloadTime = 2000; // milliseconds

// Gun Recoil
let weaponMesh = null;
const originalWeaponPos = new THREE.Vector3(0.5, -1.5, -2);
let recoilAmount = 0;

// Model Loader & URLs
const loader = new GLTFLoader();
let enemyModel = null;
let weaponModel = null;
const enemyModelUrl = 'https://threejs.org/examples/models/gltf/Duck/glTF/Duck.gltf';
// Using a DamagedHelmet model as a placeholder for a weapon model.
const weaponModelUrl = 'https://rawcdn.githack.com/mrdoob/three.js/r146/examples/models/gltf/DamagedHelmet/glTF/DamagedHelmet.gltf';

// Load enemy model
loader.load(
  enemyModelUrl,
  (gltf) => {
    enemyModel = gltf.scene;
    enemyModel.scale.set(0.5, 0.5, 0.5);
    enemyModel.traverse((child) => {
      if (child.isMesh) child.castShadow = true;
    });
    console.log('Enemy model loaded.');
  },
  undefined,
  (error) => {
    console.error('Error loading enemy model', error);
  }
);

// Load weapon model
loader.load(
  weaponModelUrl,
  (gltf) => {
    weaponModel = gltf.scene;
    weaponModel.scale.set(1, 1, 1);
    console.log('Weapon model loaded.');
  },
  undefined,
  (error) => {
    console.error('Error loading weapon model', error);
  }
);

// === Game Initialization ===
function initGame() {
  // Reset variables
  moveForward = moveBackward = moveLeft = moveRight = false;
  canJump = false;
  prevTime = performance.now();
  velocity = new THREE.Vector3();
  direction = new THREE.Vector3();
  enemyList = [];
  currentRound = 1;
  score = 0;
  bullets = [];
  ammo = maxAmmo;
  reloading = false;
  recoilAmount = 0;
  
  // Create Scene & Camera
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xaaaaaa);
  scene.fog = new THREE.Fog(0xaaaaaa, 0, 750);
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
  camera.position.y = 10;

  // Attach Weapon Model to the Camera
  if (weaponModel) {
    weaponMesh = weaponModel.clone();
    weaponMesh.position.copy(originalWeaponPos);
    camera.add(weaponMesh);
  } else {
    // Fallback: a simple box
    const geometry = new THREE.BoxGeometry(0.5, 0.2, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x333333 });
    weaponMesh = new THREE.Mesh(geometry, material);
    weaponMesh.position.copy(originalWeaponPos);
    camera.add(weaponMesh);
  }

  // Lighting
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
  hemiLight.position.set(0, 200, 0);
  scene.add(hemiLight);
  const dirLight = new THREE.DirectionalLight(0xffffff);
  dirLight.position.set(0, 200, 100);
  dirLight.castShadow = true;
  dirLight.shadow.camera.top = 180;
  dirLight.shadow.camera.bottom = -100;
  dirLight.shadow.camera.left = -120;
  dirLight.shadow.camera.right = 120;
  scene.add(dirLight);

  // Floor with a grassy texture
  const floorGeometry = new THREE.PlaneGeometry(1000, 1000);
  const floorTexture = new THREE.TextureLoader().load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg');
  floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(50, 50);
  const floorMaterial = new THREE.MeshLambertMaterial({ map: floorTexture });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Add environment objects
  addEnvironment();

  // Set up Renderer
  while (gameContainer.firstChild) {
    gameContainer.removeChild(gameContainer.firstChild);
  }
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  gameContainer.appendChild(renderer.domElement);

  // Set up Pointer Lock Controls
  controls = new PointerLockControls(camera, renderer.domElement);
  controls.addEventListener('lock', () => { console.log('Pointer locked.'); });
  controls.addEventListener('unlock', () => { console.log('Pointer unlocked.'); });
  scene.add(controls.getObject());

  // Event Listeners
  document.addEventListener('keydown', onKeyDown, false);
  document.addEventListener('keyup', onKeyUp, false);
  document.addEventListener('mousedown', onMouseDown, false);

  // Spawn initial enemies
  spawnEnemies(baseEnemyCount);

  // Update high score display
  const storedHighScore = localStorage.getItem('highScore') || 0;
  highScoreDisplay.innerHTML = "High Score: " + storedHighScore;
}

// Add pillars and trees for immersion
function addEnvironment() {
  const pillarGeometry = new THREE.CylinderGeometry(5, 5, 50, 16);
  const pillarMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });
  for (let i = 0; i < 10; i++) {
    const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    pillar.position.set(Math.random() * 800 - 400, 25, Math.random() * 800 - 400);
    pillar.castShadow = true;
    scene.add(pillar);
  }
  const trunkGeometry = new THREE.CylinderGeometry(1, 1, 10, 8);
  const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
  const leavesGeometry = new THREE.ConeGeometry(5, 20, 8);
  const leavesMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
  for (let i = 0; i < 20; i++) {
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.set(Math.random() * 800 - 400, 5, Math.random() * 800 - 400);
    trunk.castShadow = true;
    scene.add(trunk);
    const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
    leaves.position.copy(trunk.position);
    leaves.position.y += 15;
    leaves.castShadow = true;
    scene.add(leaves);
  }
}

// === Input Handlers ===
function onKeyDown(event) {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = true;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = true;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveBackward = true;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveRight = true;
      break;
    case 'Space':
      if (canJump === true) {
        velocity.y += 350;
        canJump = false;
      }
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      isSprinting = true;
      break;
    case 'KeyR':
      if (!reloading && ammo < maxAmmo) {
        reloading = true;
        setTimeout(() => {
          ammo = maxAmmo;
          reloading = false;
        }, reloadTime);
      }
      break;
  }
}

function onKeyUp(event) {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = false;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = false;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveBackward = false;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveRight = false;
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      isSprinting = false;
      break;
  }
}

// === Shooting: Create a bullet with trail and recoil ===
function onMouseDown(event) {
  if (!controls.isLocked) return;
  // Only shoot if ammo is available and not reloading
  if (ammo > 0 && !reloading) {
    ammo--;
    // Gun recoil: push weapon back
    if (weaponMesh) {
      weaponMesh.position.z = originalWeaponPos.z - 0.5;
      recoilAmount = 0.5;
    }
    // Create bullet mesh
    const bulletGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const bulletMesh = new THREE.Mesh(bulletGeometry, bulletMaterial);
    // Spawn bullet a bit in front of the camera (using the camera's direction)
    const bulletStart = new THREE.Vector3();
    camera.getWorldPosition(bulletStart);
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    bulletStart.add(forward.clone().multiplyScalar(2));
    bulletMesh.position.copy(bulletStart);
    scene.add(bulletMesh);
    // Create a bullet trail (a line from spawn point to current bullet position)
    const trailGeometry = new THREE.BufferGeometry().setFromPoints([bulletStart.clone(), bulletStart.clone()]);
    const trailMaterial = new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 1 });
    const trailLine = new THREE.Line(trailGeometry, trailMaterial);
    scene.add(trailLine);
    // Add bullet to the bullets array
    bullets.push({
      mesh: bulletMesh,
      velocity: forward.clone().multiplyScalar(2000),
      life: 1.0, // bullet lifetime in seconds
      maxLife: 1.0,
      trail: trailLine
    });
  }
}

// === Enemy Spawning ===
function spawnEnemies(count) {
  for (let i = 0; i < count; i++) {
    let enemy;
    if (enemyModel) {
      enemy = enemyModel.clone();
    } else {
      const enemyGeometry = new THREE.BoxGeometry(10, 10, 10);
      const enemyMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      enemy = new THREE.Mesh(enemyGeometry, enemyMaterial);
    }
    let x = Math.random() * 800 - 400;
    let z = Math.random() * 800 - 400;
    while (Math.sqrt(x * x + z * z) < 50) {
      x = Math.random() * 800 - 400;
      z = Math.random() * 800 - 400;
    }
    enemy.position.set(x, 5, z);
    enemy.castShadow = true;
    scene.add(enemy);
    enemyList.push(enemy);
  }
}

// === Update Bullets Each Frame ===
function updateBullets(delta) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    bullet.mesh.position.add(bullet.velocity.clone().multiplyScalar(delta));
    // Update trail: modify the second vertex to follow the bullet
    const positions = bullet.trail.geometry.attributes.position.array;
    positions[3] = bullet.mesh.position.x;
    positions[4] = bullet.mesh.position.y;
    positions[5] = bullet.mesh.position.z;
    bullet.trail.geometry.attributes.position.needsUpdate = true;
    // Fade the trail over the bullet's lifetime
    bullet.trail.material.opacity = bullet.life / bullet.maxLife;
    bullet.life -= delta;
    if (bullet.life <= 0) {
      scene.remove(bullet.mesh);
      scene.remove(bullet.trail);
      bullets.splice(i, 1);
      continue;
    }
    // Check collision with enemies (using simple distance threshold)
    for (let j = enemyList.length - 1; j >= 0; j--) {
      const enemy = enemyList[j];
      if (bullet.mesh.position.distanceTo(enemy.position) < 5) {
        scene.remove(enemy);
        enemyList.splice(j, 1);
        score += 10;
        scene.remove(bullet.mesh);
        scene.remove(bullet.trail);
        bullets.splice(i, 1);
        break;
      }
    }
  }
}

// === Update HUD Info ===
function updateInfo() {
  info.innerHTML = `Score: ${score}<br>Round: ${currentRound}<br>Ammo: ${ammo}/${maxAmmo}<br>Enemies: ${enemyList.length}${reloading ? '<br>Reloading...' : ''}`;
}

// === Main Animation Loop ===
function animate() {
  if (!gameRunning) return;
  requestAnimationFrame(animate);
  const time = performance.now();
  const delta = (time - prevTime) / 1000;

  // Apply gravity
  velocity.y -= GRAVITY * delta;
  // Dampen horizontal velocity (simulate friction)
  velocity.x -= velocity.x * 10.0 * delta;
  velocity.z -= velocity.z * 10.0 * delta;
  
  // Set base speed (increase if sprinting)
  let baseSpeed = 400.0;
  if (isSprinting) baseSpeed *= 1.5;
  
  direction.z = Number(moveForward) - Number(moveBackward);
  direction.x = Number(moveRight) - Number(moveLeft);
  direction.normalize();
  
  if (moveForward || moveBackward) velocity.z -= direction.z * baseSpeed * delta;
  if (moveLeft || moveRight) velocity.x -= direction.x * baseSpeed * delta;
  
  controls.moveRight(-velocity.x * delta);
  controls.moveForward(-velocity.z * delta);
  
  // Vertical movement (jumping/gravity)
  controls.getObject().position.y += velocity.y * delta;
  if (controls.getObject().position.y < 10) {
    velocity.y = 0;
    controls.getObject().position.y = 10;
    canJump = true;
  }
  
  // Recover weapon recoil (animate the gun back to its original position)
  if (weaponMesh && weaponMesh.position.z < originalWeaponPos.z) {
    weaponMesh.position.z += recoilAmount * delta * 5;
    if (weaponMesh.position.z > originalWeaponPos.z) {
      weaponMesh.position.z = originalWeaponPos.z;
    }
  }
  
  // Update bullets and check for collisions
  updateBullets(delta);
  
  // Update enemies: move each enemy toward the player
  const playerPos = controls.getObject().position;
  for (let enemy of enemyList) {
    const enemyPos = enemy.position;
    const vecToPlayer = new THREE.Vector3().subVectors(playerPos, enemyPos);
    const distance = vecToPlayer.length();
    vecToPlayer.normalize();
    enemy.position.add(vecToPlayer.multiplyScalar(enemySpeed * delta * 20));
    if (distance < 10) { gameOver(); return; }
  }
  
  // Check if round is cleared
  if (enemyList.length === 0 && controls.isLocked) {
    currentRound++;
    const enemyCount = baseEnemyCount + currentRound * 2;
    spawnEnemies(enemyCount);
  }
  
  updateInfo();
  prevTime = time;
  renderer.render(scene, camera);
}

// === Game Over Handler ===
function gameOver() {
  gameRunning = false;
  const storedHighScore = Number(localStorage.getItem('highScore')) || 0;
  if (score > storedHighScore) {
    localStorage.setItem('highScore', score);
  }
  alert("Game Over! Your score: " + score);
  controls.unlock();
  menu.style.display = "flex";
  gameContainer.style.display = "none";
}

// === Start Game on Play Button Click ===
playButton.addEventListener('click', () => {
  console.log("Play button clicked.");
  menu.style.display = "none";
  gameContainer.style.display = "block";
  initGame();
  gameRunning = true;
  renderer.domElement.requestPointerLock();
  animate();
});

// === Handle Window Resize ===
window.addEventListener('resize', () => {
  if (camera && renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}, false);

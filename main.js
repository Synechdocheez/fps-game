import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.154.0/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.154.0/examples/jsm/loaders/GLTFLoader.js';

// ================== Global Variables ==================
let camera, scene, renderer, controls;
let moveForward, moveBackward, moveLeft, moveRight, canJump;
let prevTime, velocity, direction;
let enemyList = [];
let enemyMixers = []; // For enemy animations
let currentRound = 1, score = 0;
let bullets = [];
const baseEnemyCount = 3;
const enemySpeed = 1.0;
let gameRunning = false;

// Gravity, jumping & sprinting
let isSprinting = false;
const GRAVITY = 9.8 * 100; // adjust gravity as needed

// ================== Ammo, Reloading & Gun Recoil ==================
let lastShotTime = 0;
const originalWeaponPos = new THREE.Vector3(0.5, -1.5, -2);

// IMPORTANT: Declare currentGunMesh globally so it can be referenced in other functions.
let currentGunMesh = null;

// ================== Inventory & Guns ==================
const guns = [
  {
    name: "Pistol",
    modelUrl: "https://rawcdn.githack.com/jeremysalt/threejs-pistol/master/models/pistol.glb",
    ammo: 12,
    maxAmmo: 12,
    reloadTime: 1500, // ms
    bulletSpeed: 2000,
    fireRate: 0.5, // seconds between shots
    recoil: 0.5,
    bulletDamage: 10,
    pellets: 1
  },
  {
    name: "Shotgun",
    modelUrl: "https://raw.githubusercontent.com/engla99/shotgun-glb/main/shotgun.glb", // placeholder URL; replace if desired
    ammo: 6,
    maxAmmo: 6,
    reloadTime: 2500,
    bulletSpeed: 1500,
    fireRate: 1.0,
    recoil: 1.0,
    bulletDamage: 25,
    pellets: 6
  }
];
let currentGunIndex = 0;
let currentGun = guns[currentGunIndex];

// ================== Models ==================
const loader = new GLTFLoader();
// Use CesiumMan as a humanoid enemy model
const enemyModelUrl = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMan/glTF/CesiumMan.gltf";

// We'll load the enemy model once and then clone it.
let enemyModel = null;
loader.load(
  enemyModelUrl,
  (gltf) => {
    enemyModel = gltf.scene;
    console.log("Enemy model (CesiumMan) loaded.");
    // Optionally, store animations if available:
    enemyModel.animations = gltf.animations;
  },
  undefined,
  (error) => {
    console.error("Error loading enemy model", error);
  }
);

// ================== HUD & DOM Elements ==================
const info = document.getElementById("info");
const menu = document.getElementById("menu");
const playButton = document.getElementById("playButton");
const highScoreDisplay = document.getElementById("highScoreDisplay");
const gameContainer = document.getElementById("gameContainer");

// ================== Game Initialization ==================
function initGame() {
  // Reset movement & game variables
  moveForward = moveBackward = moveLeft = moveRight = false;
  canJump = false;
  prevTime = performance.now();
  velocity = new THREE.Vector3();
  direction = new THREE.Vector3();
  enemyList = [];
  enemyMixers = [];
  currentRound = 1;
  score = 0;
  bullets = [];
  // Reset ammo for current gun
  currentGun.ammo = currentGun.maxAmmo;
  lastShotTime = 0;

  // Create Scene & Camera
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xaaaaaa);
  scene.fog = new THREE.Fog(0xaaaaaa, 0, 750);
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
  camera.position.y = 10;

  // Load and attach current gun model
  loadGunModel(currentGun);

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

  // Floor (with grassy texture)
  const floorGeometry = new THREE.PlaneGeometry(1000, 1000);
  const floorTexture = new THREE.TextureLoader().load("https://threejs.org/examples/textures/terrain/grasslight-big.jpg");
  floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(50, 50);
  const floorMaterial = new THREE.MeshLambertMaterial({ map: floorTexture });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Add extra environment objects (pillars, trees)
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
  controls.addEventListener("lock", () => { console.log("Pointer locked."); });
  controls.addEventListener("unlock", () => { console.log("Pointer unlocked."); });
  scene.add(controls.getObject());

  // Event Listeners for input
  document.addEventListener("keydown", onKeyDown, false);
  document.addEventListener("keyup", onKeyUp, false);
  document.addEventListener("mousedown", onMouseDown, false);

  // Spawn initial enemies
  spawnEnemies(baseEnemyCount);

  // Update high score display
  const storedHighScore = localStorage.getItem("highScore") || 0;
  highScoreDisplay.innerHTML = "High Score: " + storedHighScore;
}

// ================== Load Gun Model ==================
function loadGunModel(gun) {
  // Remove old gun if present
  if (currentGunMesh && camera.children.includes(currentGunMesh)) {
    camera.remove(currentGunMesh);
  }
  loader.load(
    gun.modelUrl,
    (gltf) => {
      currentGunMesh = gltf.scene.clone();
      currentGunMesh.position.copy(originalWeaponPos);
      camera.add(currentGunMesh);
      console.log(gun.name + " model loaded.");
    },
    undefined,
    (error) => {
      console.error("Error loading gun model", error);
      // Fallback: a simple box
      const geometry = new THREE.BoxGeometry(0.5, 0.2, 1);
      const material = new THREE.MeshBasicMaterial({ color: 0x333333 });
      currentGunMesh = new THREE.Mesh(geometry, material);
      currentGunMesh.position.copy(originalWeaponPos);
      camera.add(currentGunMesh);
    }
  );
}

// ================== Switch Gun (Inventory) ==================
function switchGun(index) {
  if (index < 0 || index >= guns.length) return;
  if (index === currentGunIndex) return;
  currentGunIndex = index;
  currentGun = guns[currentGunIndex];
  loadGunModel(currentGun);
  console.log("Switched to " + currentGun.name);
}

// ================== Environment Objects ==================
function addEnvironment() {
  // Add some pillars
  const pillarGeometry = new THREE.CylinderGeometry(5, 5, 50, 16);
  const pillarMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });
  for (let i = 0; i < 10; i++) {
    const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    pillar.position.set(Math.random() * 800 - 400, 25, Math.random() * 800 - 400);
    pillar.castShadow = true;
    scene.add(pillar);
  }
  // Add some trees
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

// ================== Input Handlers ==================
function onKeyDown(event) {
  switch (event.code) {
    case "ArrowUp":
    case "KeyW":
      moveForward = true;
      break;
    case "ArrowLeft":
    case "KeyA":
      moveLeft = true;
      break;
    case "ArrowDown":
    case "KeyS":
      moveBackward = true;
      break;
    case "ArrowRight":
    case "KeyD":
      moveRight = true;
      break;
    case "Space":
      if (canJump === true) {
        velocity.y += 350;
        canJump = false;
      }
      break;
    case "ShiftLeft":
    case "ShiftRight":
      isSprinting = true;
      break;
    case "KeyR":
      // Reload current gun if needed
      if (currentGun.ammo < currentGun.maxAmmo) {
        console.log("Reloading " + currentGun.name + "...");
        setTimeout(() => {
          currentGun.ammo = currentGun.maxAmmo;
        }, currentGun.reloadTime);
      }
      break;
    case "Digit1":
      switchGun(0);
      break;
    case "Digit2":
      if (guns.length > 1) switchGun(1);
      break;
  }
}

function onKeyUp(event) {
  switch (event.code) {
    case "ArrowUp":
    case "KeyW":
      moveForward = false;
      break;
    case "ArrowLeft":
    case "KeyA":
      moveLeft = false;
      break;
    case "ArrowDown":
    case "KeyS":
      moveBackward = false;
      break;
    case "ArrowRight":
    case "KeyD":
      moveRight = false;
      break;
    case "ShiftLeft":
    case "ShiftRight":
      isSprinting = false;
      break;
  }
}

// ================== Shooting Handler ==================
function onMouseDown(event) {
  if (!controls.isLocked) return;
  const now = performance.now() / 1000;
  if (now - lastShotTime < currentGun.fireRate) return; // enforce fire rate
  if (currentGun.ammo <= 0) return; // no ammo
  lastShotTime = now;
  currentGun.ammo--;

  // Apply recoil to the gun model
  if (currentGunMesh) {
    currentGunMesh.position.z = originalWeaponPos.z - currentGun.recoil;
  }

  // Determine number of pellets to shoot
  const pellets = currentGun.pellets;
  for (let i = 0; i < pellets; i++) {
    let spreadAngle = 0;
    if (pellets > 1) {
      spreadAngle = THREE.MathUtils.degToRad(5);
    }
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    if (spreadAngle > 0) {
      forward.x += (Math.random() - 0.5) * spreadAngle;
      forward.y += (Math.random() - 0.5) * spreadAngle;
      forward.z += (Math.random() - 0.5) * spreadAngle;
      forward.normalize();
    }

    // Create bullet mesh
    const bulletGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const bulletMesh = new THREE.Mesh(bulletGeometry, bulletMaterial);
    const bulletStart = new THREE.Vector3();
    camera.getWorldPosition(bulletStart);
    bulletStart.add(forward.clone().multiplyScalar(2));
    bulletMesh.position.copy(bulletStart);
    scene.add(bulletMesh);

    // Create bullet trail
    const trailGeometry = new THREE.BufferGeometry().setFromPoints([bulletStart.clone(), bulletStart.clone()]);
    const trailMaterial = new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 1 });
    const trailLine = new THREE.Line(trailGeometry, trailMaterial);
    scene.add(trailLine);

    bullets.push({
      mesh: bulletMesh,
      velocity: forward.clone().multiplyScalar(currentGun.bulletSpeed),
      life: 1.0,
      maxLife: 1.0,
      trail: trailLine
    });
  }
}

// ================== Enemy Spawning (with Animation Mixer) ==================
function spawnEnemies(count) {
  for (let i = 0; i < count; i++) {
    let enemy;
    if (enemyModel) {
      enemy = enemyModel.clone();
      if (enemy.animations && enemy.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(enemy);
        mixer.clipAction(enemy.animations[0]).play();
        enemy.userData.mixer = mixer;
        enemyMixers.push(mixer);
      }
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

// ================== Update Bullets ==================
function updateBullets(delta) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    bullet.mesh.position.add(bullet.velocity.clone().multiplyScalar(delta));
    const positions = bullet.trail.geometry.attributes.position.array;
    positions[3] = bullet.mesh.position.x;
    positions[4] = bullet.mesh.position.y;
    positions[5] = bullet.mesh.position.z;
    bullet.trail.geometry.attributes.position.needsUpdate = true;
    bullet.trail.material.opacity = bullet.life / bullet.maxLife;
    bullet.life -= delta;
    if (bullet.life <= 0) {
      scene.remove(bullet.mesh);
      scene.remove(bullet.trail);
      bullets.splice(i, 1);
      continue;
    }
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

// ================== Update HUD Info ==================
function updateInfo() {
  info.innerHTML = `Score: ${score}<br>
Round: ${currentRound}<br>
Gun: ${currentGun.name}<br>
Ammo: ${currentGun.ammo}/${currentGun.maxAmmo}<br>
Enemies: ${enemyList.length}`;
}

// ================== Main Animation Loop ==================
function animate() {
  if (!gameRunning) return;
  requestAnimationFrame(animate);
  const time = performance.now();
  const delta = (time - prevTime) / 1000;

  enemyMixers.forEach((mixer) => mixer.update(delta));

  velocity.y -= GRAVITY * delta;
  velocity.x -= velocity.x * 10.0 * delta;
  velocity.z -= velocity.z * 10.0 * delta;
  let baseSpeed = 400.0;
  if (isSprinting) baseSpeed *= 1.5;
  direction.z = Number(moveForward) - Number(moveBackward);
  direction.x = Number(moveRight) - Number(moveLeft);
  direction.normalize();
  if (moveForward || moveBackward) velocity.z -= direction.z * baseSpeed * delta;
  if (moveLeft || moveRight) velocity.x -= direction.x * baseSpeed * delta;
  controls.moveRight(-velocity.x * delta);
  controls.moveForward(-velocity.z * delta);

  controls.getObject().position.y += velocity.y * delta;
  if (controls.getObject().position.y < 10) {
    velocity.y = 0;
    controls.getObject().position.y = 10;
    canJump = true;
  }

  if (currentGunMesh && currentGunMesh.position.z < originalWeaponPos.z) {
    currentGunMesh.position.z += currentGun.recoil * delta * 5;
    if (currentGunMesh.position.z > originalWeaponPos.z) {
      currentGunMesh.position.z = originalWeaponPos.z;
    }
  }

  updateBullets(delta);

  const playerPos = controls.getObject().position;
  for (let enemy of enemyList) {
    const enemyPos = enemy.position;
    const vecToPlayer = new THREE.Vector3().subVectors(playerPos, enemyPos);
    const distance = vecToPlayer.length();
    vecToPlayer.normalize();
    enemy.position.add(vecToPlayer.multiplyScalar(enemySpeed * delta * 20));
    if (distance < 10) { gameOver(); return; }
  }

  if (enemyList.length === 0 && controls.isLocked) {
    currentRound++;
    const enemyCount = baseEnemyCount + currentRound * 2;
    spawnEnemies(enemyCount);
  }

  updateInfo();
  prevTime = time;
  renderer.render(scene, camera);
}

// ================== Game Over ==================
function gameOver() {
  gameRunning = false;
  const storedHighScore = Number(localStorage.getItem("highScore")) || 0;
  if (score > storedHighScore) {
    localStorage.setItem("highScore", score);
  }
  alert("Game Over! Your score: " + score);
  controls.unlock();
  menu.style.display = "flex";
  gameContainer.style.display = "none";
}

// ================== Start Game ==================
playButton.addEventListener("click", () => {
  console.log("Play button clicked.");
  menu.style.display = "none";
  gameContainer.style.display = "block";
  initGame();
  gameRunning = true;
  renderer.domElement.requestPointerLock();
  animate();
});

// ================== Handle Window Resize ==================
window.addEventListener("resize", () => {
  if (camera && renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}, false);

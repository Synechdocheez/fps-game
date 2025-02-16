// Import Three.js and PointerLockControls from CDN
import * as THREE from 'https://unpkg.com/three@0.154.0/build/three.module.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.154.0/examples/jsm/controls/PointerLockControls.js';

// --- Scene Setup ---
let camera, scene, renderer, controls;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let canJump = false;
let prevTime = performance.now();
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();

// Enemy and game round variables
let enemyList = [];
let currentRound = 1;
const baseEnemyCount = 3;  // starting number of enemies
const enemySpeed = 1.0;    // base enemy speed
let score = 0;

scene = new THREE.Scene();
scene.background = new THREE.Color(0xaaaaaa);
scene.fog = new THREE.Fog(0xaaaaaa, 0, 750);

camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.y = 10;

// --- Lights ---
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

// --- Floor (Arena) ---
const floorGeometry = new THREE.PlaneGeometry(1000, 1000, 10, 10);
const floorMaterial = new THREE.MeshBasicMaterial({ color: 0x007700 });
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = - Math.PI / 2;
scene.add(floor);

// --- Renderer ---
renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- Pointer Lock Controls ---
controls = new PointerLockControls(camera, document.body);
const blocker = document.getElementById('blocker');
const instructions = document.getElementById('instructions');

instructions.addEventListener('click', function () {
  controls.lock();
}, false);

controls.addEventListener('lock', function () {
  instructions.style.display = 'none';
  blocker.style.display = 'none';
});

controls.addEventListener('unlock', function () {
  blocker.style.display = 'flex';
  instructions.style.display = '';
});

scene.add(controls.getObject());

// --- Movement Controls ---
const onKeyDown = function (event) {
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
      if (canJump === true) velocity.y += 350;
      canJump = false;
      break;
  }
};

const onKeyUp = function (event) {
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
  }
};

document.addEventListener('keydown', onKeyDown, false);
document.addEventListener('keyup', onKeyUp, false);

// --- Shooting ---
document.addEventListener('mousedown', function (event) {
  if (!controls.isLocked) return;
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersects = raycaster.intersectObjects(enemyList);
  if (intersects.length > 0) {
    const enemy = intersects[0].object;
    scene.remove(enemy);
    enemyList = enemyList.filter(e => e !== enemy);
    score += 10;
  }
}, false);

// --- Enemy Spawning ---
function spawnEnemies(count) {
  for (let i = 0; i < count; i++) {
    const enemyGeometry = new THREE.BoxGeometry(10, 10, 10);
    const enemyMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const enemy = new THREE.Mesh(enemyGeometry, enemyMaterial);
    // Randomly position the enemy, avoiding too close proximity to the player.
    let x = Math.random() * 800 - 400;
    let z = Math.random() * 800 - 400;
    while (Math.sqrt(x * x + z * z) < 50) {
      x = Math.random() * 800 - 400;
      z = Math.random() * 800 - 400;
    }
    enemy.position.set(x, 5, z); // y=5 so it sits on the floor
    scene.add(enemy);
    enemyList.push(enemy);
  }
}

// Start the first round
spawnEnemies(baseEnemyCount);

// --- HUD Info ---
const info = document.getElementById('info');
function updateInfo() {
  info.innerHTML = `Score: ${score}<br>Round: ${currentRound}<br>Enemies: ${enemyList.length}`;
}

// --- Animation Loop ---
function animate() {
  requestAnimationFrame(animate);

  if (controls.isLocked === true) {
    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    // Dampen the velocity (simulate friction)
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;

    // Movement speed
    const speed = 400.0;
    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize();

    if (moveForward || moveBackward) velocity.z -= direction.z * speed * delta;
    if (moveLeft || moveRight) velocity.x -= direction.x * speed * delta;

    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);

    // --- Enemy Behavior ---
    const playerPosition = controls.getObject().position;
    for (let enemy of enemyList) {
      const enemyPos = enemy.position;
      const vecToPlayer = new THREE.Vector3().subVectors(playerPosition, enemyPos);
      const distance = vecToPlayer.length();
      vecToPlayer.normalize();
      enemy.position.add(vecToPlayer.multiplyScalar(enemySpeed * delta * 20));
      if (distance < 10) {
        alert("Game Over! Your score: " + score);
        window.location.reload();
      }
    }
    prevTime = time;
  }

  // --- Check for Round Completion ---
  if (enemyList.length === 0 && controls.isLocked) {
    currentRound++;
    const enemyCount = baseEnemyCount + currentRound * 2;
    spawnEnemies(enemyCount);
  }

  updateInfo();
  renderer.render(scene, camera);
}

animate();

// --- Handle Window Resize ---
window.addEventListener('resize', function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}, false);

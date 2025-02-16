import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.154.0/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.154.0/examples/jsm/loaders/GLTFLoader.js';

// Global variables
let camera, scene, renderer, controls;
let moveForward, moveBackward, moveLeft, moveRight, canJump;
let prevTime, velocity, direction;

let enemyList, currentRound, score;
const baseEnemyCount = 3;  // starting enemies per round
const enemySpeed = 1.0;    // base enemy speed

let gameRunning = false;
const info = document.getElementById('info');
const menu = document.getElementById('menu');
const playButton = document.getElementById('playButton');
const highScoreDisplay = document.getElementById('highScoreDisplay');
const gameContainer = document.getElementById('gameContainer');

// Model globals and loader
let enemyModel = null;
let weaponModel = null;
const loader = new GLTFLoader();
const enemyModelUrl = 'https://threejs.org/examples/models/gltf/Duck/glTF/Duck.gltf';
// For demonstration, we use a free DamagedHelmet model as a placeholder for a weapon model.
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
    // We'll attach the weapon model to the camera in initGame().
  },
  undefined,
  (error) => {
    console.error('Error loading weapon model', error);
  }
);

function initGame() {
  // Reset movement & game variables
  moveForward = moveBackward = moveLeft = moveRight = false;
  canJump = false;
  prevTime = performance.now();
  velocity = new THREE.Vector3();
  direction = new THREE.Vector3();
  enemyList = [];
  currentRound = 1;
  score = 0;

  // Create scene & camera
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xaaaaaa);
  scene.fog = new THREE.Fog(0xaaaaaa, 0, 750);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
  camera.position.y = 10;

  // Attach weapon model (or fallback) to the camera for a first-person view
  if (weaponModel) {
    const weapon = weaponModel.clone();
    // Position the weapon model in the lower-right of the view
    weapon.position.set(0.5, -1.5, -2);
    camera.add(weapon);
  } else {
    // Fallback: simple box representing the weapon
    const geometry = new THREE.BoxGeometry(0.5, 0.2, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x333333 });
    const fallbackWeapon = new THREE.Mesh(geometry, material);
    fallbackWeapon.position.set(0.5, -1.5, -2);
    camera.add(fallbackWeapon);
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

  // Floor (Textured for a more immersive arena)
  const floorGeometry = new THREE.PlaneGeometry(1000, 1000);
  const floorTexture = new THREE.TextureLoader().load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg');
  floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(50, 50);
  const floorMaterial = new THREE.MeshLambertMaterial({ map: floorTexture });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Add additional environment objects for immersion
  addEnvironment();

  // Renderer: Clear any previous content in gameContainer
  while (gameContainer.firstChild) {
    gameContainer.removeChild(gameContainer.firstChild);
  }
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  gameContainer.appendChild(renderer.domElement);

  // Create Pointer Lock Controls attached to the renderer's DOM element
  controls = new PointerLockControls(camera, renderer.domElement);
  controls.addEventListener('lock', () => {
    console.log('Pointer locked.');
  });
  controls.addEventListener('unlock', () => {
    console.log('Pointer unlocked.');
  });
  scene.add(controls.getObject());

  // Set up key and mouse event listeners
  document.addEventListener('keydown', onKeyDown, false);
  document.addEventListener('keyup', onKeyUp, false);
  document.addEventListener('mousedown', onMouseDown, false);

  // Spawn the first round of enemies
  spawnEnemies(baseEnemyCount);

  // Update HUD with high score from localStorage
  const storedHighScore = localStorage.getItem('highScore') || 0;
  highScoreDisplay.innerHTML = "High Score: " + storedHighScore;
}

function addEnvironment() {
  // Add some pillars/buildings
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
      if (canJump === true) velocity.y += 350;
      canJump = false;
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
  }
}

function onMouseDown(event) {
  // Only allow shooting when pointer lock is active
  if (!controls.isLocked) return;
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  // Use recursive flag true to catch objects nested within models.
  const intersects = raycaster.intersectObjects(enemyList, true);
  if (intersects.length > 0) {
    // Assume the model's root is one level up from the intersected mesh.
    const enemy = intersects[0].object.parent;
    scene.remove(enemy);
    enemyList = enemyList.filter(e => e !== enemy);
    score += 10;
  }
}

function spawnEnemies(count) {
  for (let i = 0; i < count; i++) {
    let enemy;
    if (enemyModel) {
      enemy = enemyModel.clone();
    } else {
      // Fallback enemy: red box
      const enemyGeometry = new THREE.BoxGeometry(10, 10, 10);
      const enemyMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      enemy = new THREE.Mesh(enemyGeometry, enemyMaterial);
    }
    // Position enemy randomly in the arena (keeping a safe distance from the center)
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

function updateInfo() {
  info.innerHTML = `Score: ${score}<br>Round: ${currentRound}<br>Enemies: ${enemyList.length}`;
}

function animate() {
  if (!gameRunning) return;
  requestAnimationFrame(animate);

  const time = performance.now();
  const delta = (time - prevTime) / 1000;

  // Dampen velocity (simulate friction)
  velocity.x -= velocity.x * 10.0 * delta;
  velocity.z -= velocity.z * 10.0 * delta;

  const speed = 400.0;
  direction.z = Number(moveForward) - Number(moveBackward);
  direction.x = Number(moveRight) - Number(moveLeft);
  direction.normalize();

  if (moveForward || moveBackward) velocity.z -= direction.z * speed * delta;
  if (moveLeft || moveRight) velocity.x -= direction.x * speed * delta;

  controls.moveRight(-velocity.x * delta);
  controls.moveForward(-velocity.z * delta);

  // Move enemies toward the player
  const playerPosition = controls.getObject().position;
  for (let enemy of enemyList) {
    const enemyPos = enemy.position;
    const vecToPlayer = new THREE.Vector3().subVectors(playerPosition, enemyPos);
    const distance = vecToPlayer.length();
    vecToPlayer.normalize();
    enemy.position.add(vecToPlayer.multiplyScalar(enemySpeed * delta * 20));
    // Game over if enemy gets too close
    if (distance < 10) {
      gameOver();
      return;
    }
  }

  // Check for round completion
  if (enemyList.length === 0 && controls.isLocked) {
    currentRound++;
    const enemyCount = baseEnemyCount + currentRound * 2;
    spawnEnemies(enemyCount);
  }

  updateInfo();
  prevTime = time;
  renderer.render(scene, camera);
}

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

playButton.addEventListener('click', () => {
  console.log("Play button clicked.");
  menu.style.display = "none";
  gameContainer.style.display = "block";
  initGame();
  gameRunning = true;
  renderer.domElement.requestPointerLock();
  animate();
});

window.addEventListener('resize', () => {
  if (camera && renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}, false);

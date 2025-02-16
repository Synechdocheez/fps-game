// Now that we've defined an import map, we can import THREE using the bare specifier.
import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.154.0/examples/jsm/controls/PointerLockControls.js';

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

  // Floor (Arena)
  const floorGeometry = new THREE.PlaneGeometry(1000, 1000, 10, 10);
  const floorMaterial = new THREE.MeshBasicMaterial({ color: 0x007700 });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // Renderer: Clear any previous content in gameContainer
  while (gameContainer.firstChild) {
    gameContainer.removeChild(gameContainer.firstChild);
  }
  renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  gameContainer.appendChild(renderer.domElement);

  // Create Pointer Lock Controls attached to the renderer's DOM element
  controls = new PointerLockControls(camera, renderer.domElement);

  // Log pointer lock events for debugging
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

  // Set the HUD high score from localStorage (if any)
  const storedHighScore = localStorage.getItem('highScore') || 0;
  highScoreDisplay.innerHTML = "High Score: " + storedHighScore;
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
  const intersects = raycaster.intersectObjects(enemyList);
  if (intersects.length > 0) {
    const enemy = intersects[0].object;
    scene.remove(enemy);
    enemyList = enemyList.filter(e => e !== enemy);
    score += 10;
  }
}

function spawnEnemies(count) {
  for (let i = 0; i < count; i++) {
    const enemyGeometry = new THREE.BoxGeometry(10, 10, 10);
    const enemyMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const enemy = new THREE.Mesh(enemyGeometry, enemyMaterial);
    // Random position, avoiding immediate proximity to the player
    let x = Math.random() * 800 - 400;
    let z = Math.random() * 800 - 400;
    while (Math.sqrt(x * x + z * z) < 50) {
      x = Math.random() * 800 - 400;
      z = Math.random() * 800 - 400;
    }
    enemy.position.set(x, 5, z);
    scene.add(enemy);
    enemyList.push(enemy);
  }
}

function updateInfo() {
  info.innerHTML = `Score: ${score}<br>Round: ${currentRound}<br>Enemies: ${enemyList.length}`;
}

function animate() {
  if (!gameRunning) return; // Stop the loop if the game is not running
  requestAnimationFrame(animate);

  const time = performance.now();
  const delta = (time - prevTime) / 1000;

  // Apply damping to velocity (simulate friction)
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

  // Enemy behavior: move enemies toward the player
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

// --- Start Game when Play button is clicked ---
playButton.addEventListener('click', () => {
  console.log("Play button clicked.");
  menu.style.display = "none";
  gameContainer.style.display = "block";
  initGame();
  gameRunning = true;
  // Request pointer lock on the renderer's canvas (user gesture)
  renderer.domElement.requestPointerLock();
  animate();
});

// --- Handle Window Resize ---
window.addEventListener('resize', function () {
  if (camera && renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}, false);

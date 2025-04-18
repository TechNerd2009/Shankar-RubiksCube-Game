import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe0e0e0); // Slightly lighter background

const container = document.getElementById("container");

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 6;
camera.position.y = 4;
camera.position.x = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Slightly increased ambient light
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9); // Slightly increased directional light
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// --- Controls ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 5;
controls.maxDistance = 25; // Increased max distance slightly
// controls.maxPolarAngle = Math.PI / 2; // REMOVED: Allow looking from below

// --- Cube Constants ---
const CUBE_SIZE = 3;
const CUBIE_SIZE = 1;
const CUBIE_SPACING = 0.05;
const TOTAL_CUBIE_SIZE = CUBIE_SIZE + CUBIE_SPACING;
const HALF_CUBE_DIM = (CUBE_SIZE - 1) / 2;

// --- Vibrant Colors ---
const colors = {
  white: new THREE.MeshStandardMaterial({ color: 0xffffff }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xffd500 }), // Brighter yellow/gold
  blue: new THREE.MeshStandardMaterial({ color: 0x0051ba }), // Nice blue
  green: new THREE.MeshStandardMaterial({ color: 0x009e60 }), // Standard green
  red: new THREE.MeshStandardMaterial({ color: 0xc41e3a }), // Ruby red
  orange: new THREE.MeshStandardMaterial({ color: 0xff5800 }), // Vibrant orange
  black: new THREE.MeshStandardMaterial({ color: 0x333333 }), // Inside faces (kept dark)
};

// Face order for BoxGeometry materials: +X (Right), -X (Left), +Y (Top), -Y (Bottom), +Z (Front), -Z (Back)
const faceMaterials = [
  colors.red, // Right (+x)
  colors.orange, // Left (-x)
  colors.white, // Top (+y)
  colors.yellow, // Bottom (-y)
  colors.blue, // Front (+z)
  colors.green, // Back (-z)
];

const cubeGroup = new THREE.Group();
const cubies = []; // Flat array to store cubies

// --- Create Cubies ---
const cubieGeometry = new THREE.BoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE);

for (let x = -HALF_CUBE_DIM; x <= HALF_CUBE_DIM; x++) {
  for (let y = -HALF_CUBE_DIM; y <= HALF_CUBE_DIM; y++) {
    for (let z = -HALF_CUBE_DIM; z <= HALF_CUBE_DIM; z++) {
      if (x === 0 && y === 0 && z === 0) continue; // Skip center

      const materials = [];
      materials.push(x === HALF_CUBE_DIM ? colors.red : colors.black); // Right (+x)
      materials.push(x === -HALF_CUBE_DIM ? colors.orange : colors.black); // Left (-x)
      materials.push(y === HALF_CUBE_DIM ? colors.white : colors.black); // Top (+y)
      materials.push(y === -HALF_CUBE_DIM ? colors.yellow : colors.black); // Bottom (-y)
      materials.push(z === HALF_CUBE_DIM ? colors.blue : colors.black); // Front (+z)
      materials.push(z === -HALF_CUBE_DIM ? colors.green : colors.black); // Back (-z)

      const cubie = new THREE.Mesh(cubieGeometry, materials);
      cubie.position.set(
        x * TOTAL_CUBIE_SIZE,
        y * TOTAL_CUBIE_SIZE,
        z * TOTAL_CUBIE_SIZE
      );
      cubie.userData.originalPos = { x, y, z };
      cubie.userData.currentPos = { x, y, z };

      cubeGroup.add(cubie);
      cubies.push(cubie);
    }
  }
}
scene.add(cubeGroup);

// --- Rotation Logic ---
let isAnimating = false;
const animationQueue = [];
let scrambleMoves = []; // Stores the sequence of scramble moves

const moveDuration = 300; // milliseconds for one move animation

// Get UI Elements
const scrambleBtn = document.getElementById("scramble-btn");
const solveBtn = document.getElementById("solve-btn");

// Helper to update button enabled/disabled states
function updateButtonStates() {
  scrambleBtn.disabled = isAnimating;
  // Solve button is enabled only if not animating AND scramble moves exist
  solveBtn.disabled = isAnimating || scrambleMoves.length === 0;
}

// Helper to get cubies for a given slice
function getCubiesForSlice(axis, layer) {
  const slice = [];
  const threshold = TOTAL_CUBIE_SIZE / 2 - 0.01; // Tolerance for floating point

  cubies.forEach((cubie) => {
    let coord;
    switch (axis) {
      case "x":
        coord = cubie.position.x;
        break;
      case "y":
        coord = cubie.position.y;
        break;
      case "z":
        coord = cubie.position.z;
        break;
    }
    // Compare against the visual position scaled by TOTAL_CUBIE_SIZE
    if (Math.abs(coord - layer * TOTAL_CUBIE_SIZE) < threshold) {
      slice.push(cubie);
    }
  });
  return slice;
}

// Animate a rotation
async function animateRotation(axis, layer, angle) {
  return new Promise((resolve) => {
    isAnimating = true;
    updateButtonStates(); // Disable buttons during animation

    const pivot = new THREE.Group();
    scene.add(pivot); // Add pivot to the main scene

    const sliceCubies = getCubiesForSlice(axis, layer);

    // Move cubies from cubeGroup to pivot
    sliceCubies.forEach((cubie) => {
      pivot.attach(cubie); // attach preserves world transform
    });

    const targetRotation = { value: 0 };
    const start = performance.now();

    function step() {
      const now = performance.now();
      const elapsed = now - start;
      const progress = Math.min(elapsed / moveDuration, 1); // Clamp progress to 1

      const currentAngle = angle * progress;
      if (axis === "x") pivot.rotation.x = currentAngle;
      if (axis === "y") pivot.rotation.y = currentAngle;
      if (axis === "z") pivot.rotation.z = currentAngle;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        // Animation finished: finalize rotation and move cubies back
        if (axis === "x") pivot.rotation.x = angle;
        if (axis === "y") pivot.rotation.y = angle;
        if (axis === "z") pivot.rotation.z = angle;

        // Update world matrix before detaching
        pivot.updateMatrixWorld();

        // Move cubies back to the main group, preserving world transform
        sliceCubies.forEach((cubie) => {
          cubeGroup.attach(cubie); // attach preserves world transform
          // Round position and update logical position after rotation
          cubie.position.x =
            Math.round(cubie.position.x / TOTAL_CUBIE_SIZE) * TOTAL_CUBIE_SIZE;
          cubie.position.y =
            Math.round(cubie.position.y / TOTAL_CUBIE_SIZE) * TOTAL_CUBIE_SIZE;
          cubie.position.z =
            Math.round(cubie.position.z / TOTAL_CUBIE_SIZE) * TOTAL_CUBIE_SIZE;
          // Update logical position (optional but good practice)
          // cubie.userData.currentPos = { x: cubie.position.x / TOTAL_CUBIE_SIZE, ... };
        });

        scene.remove(pivot);
        isAnimating = false;
        // Do not update buttons here, let processMoveQueue handle it when queue is empty
        resolve(); // Resolve the promise
      }
      renderer.render(scene, camera); // Render each frame of animation
    }
    requestAnimationFrame(step);
  });
}

// --- Define Moves ---
const moves = {
  // Clockwise (adjust angles based on visual preference and right-hand rule)
  R: { axis: "x", layer: HALF_CUBE_DIM, angle: -Math.PI / 2 },
  L: { axis: "x", layer: -HALF_CUBE_DIM, angle: Math.PI / 2 },
  U: { axis: "y", layer: HALF_CUBE_DIM, angle: -Math.PI / 2 },
  D: { axis: "y", layer: -HALF_CUBE_DIM, angle: Math.PI / 2 },
  F: { axis: "z", layer: HALF_CUBE_DIM, angle: -Math.PI / 2 },
  B: { axis: "z", layer: -HALF_CUBE_DIM, angle: Math.PI / 2 },
  // Counter-clockwise (inverse)
  Ri: { axis: "x", layer: HALF_CUBE_DIM, angle: Math.PI / 2 },
  Li: { axis: "x", layer: -HALF_CUBE_DIM, angle: -Math.PI / 2 },
  Ui: { axis: "y", layer: HALF_CUBE_DIM, angle: Math.PI / 2 },
  Di: { axis: "y", layer: -HALF_CUBE_DIM, angle: -Math.PI / 2 },
  Fi: { axis: "z", layer: HALF_CUBE_DIM, angle: Math.PI / 2 },
  Bi: { axis: "z", layer: -HALF_CUBE_DIM, angle: -Math.PI / 2 },
};

const moveList = Object.keys(moves);

function getInverseMove(move) {
  if (move.endsWith("i")) {
    return move.slice(0, -1); // Remove 'i'
  } else {
    return move + "i"; // Add 'i'
  }
}

// --- Scramble & Solve ---

async function processMoveQueue() {
  if (isAnimating || animationQueue.length === 0) {
    // If queue is empty AND not currently animating, update button states
    if (!isAnimating && animationQueue.length === 0) {
      updateButtonStates();
    }
    return;
  }

  isAnimating = true; // Mark as animating before starting the move
  updateButtonStates(); // Disable buttons

  const moveName = animationQueue.shift(); // Get the next move
  const moveData = moves[moveName];

  if (moveData) {
    await animateRotation(moveData.axis, moveData.layer, moveData.angle);
    // isAnimating is set back to false inside animateRotation's promise resolve
  } else {
    console.warn("Unknown move:", moveName);
    isAnimating = false; // Ensure flag is reset if move is invalid
  }

  // Process next move immediately after the previous one finishes
  // Use requestAnimationFrame to yield to the browser briefly
  requestAnimationFrame(processMoveQueue);
}

function scrambleCube() {
  if (isAnimating) return; // Don't scramble if already animating
  console.log("Scrambling...");
  isAnimating = true; // Prevent clicks during queuing
  scrambleMoves = []; // Clear previous scramble
  const numScrambleMoves = 20;

  for (let i = 0; i < numScrambleMoves; i++) {
    const randomMoveIndex = Math.floor(Math.random() * moveList.length);
    const move = moveList[randomMoveIndex];
    scrambleMoves.push(move);
    animationQueue.push(move); // Add to animation queue
  }
  console.log("Scramble Sequence:", scrambleMoves.join(" "));
  isAnimating = false; // Re-enable button checking after queuing
  updateButtonStates(); // Enable solve button, potentially disable scramble if queue starts immediately
  requestAnimationFrame(processMoveQueue); // Start processing the queue
}

function solveCube() {
  // Check if animating OR if there are no moves to solve
  if (isAnimating || scrambleMoves.length === 0) return;
  console.log("Solving...");
  isAnimating = true; // Prevent clicks during queuing
  updateButtonStates(); // Disable buttons

  // Add inverse moves to the queue in reverse order
  for (let i = scrambleMoves.length - 1; i >= 0; i--) {
    const inverseMove = getInverseMove(scrambleMoves[i]);
    animationQueue.push(inverseMove);
  }
  scrambleMoves = []; // Clear scramble moves *after* queuing solve moves
  isAnimating = false; // Re-enable button checking after queuing
  updateButtonStates(); // Disable solve button now, potentially disable scramble if queue starts immediately
  console.log("Solving sequence queued.");
  requestAnimationFrame(processMoveQueue); // Start processing the queue
}

scrambleBtn.addEventListener("click", scrambleCube);
solveBtn.addEventListener("click", solveCube);

// --- Animation Loop ---
function animate() {
  requestAnimationFrame(animate);
  controls.update(); // Only required if enableDamping is true
  // Only render if not animating rotation (saves resources)
  // Animation function handles rendering during moves
  if (!isAnimating) {
    renderer.render(scene, camera);
  }
}

// --- Resize Handling ---
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (!isAnimating) {
    // Avoid redundant renders during animation resize
    renderer.render(scene, camera);
  }
}
window.addEventListener("resize", onWindowResize);

// Initial Setup
updateButtonStates(); // Set initial button states (Solve should be disabled)
animate(); // Start the main animation loop

// --- Debugging ---
// const axesHelper = new THREE.AxesHelper(5);
// scene.add(axesHelper);
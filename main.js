// main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Box3, Vector3, Shape, ExtrudeGeometry } from 'three'; // Explicitly import Shape, ExtrudeGeometry

// --- DOM Element References ---
const gameContainer = document.getElementById('game-container');
const canvas = document.getElementById('gameCanvas');
const dialogueBox = document.getElementById('dialogueBox');
const dialogueText = document.getElementById('dialogueText');
const dialogueOptions = document.getElementById('dialogueOptions');
const inventoryList = document.getElementById('inventoryList');
const questNameUI = document.getElementById('questName');
const questObjectiveUI = document.getElementById('questObjective');
const realityRiverUI = document.getElementById('realityRiver');
const riverQuestionUI = document.getElementById('riverQuestion');
const riverAnswersUI = document.getElementById('riverAnswers');
const riverFeedbackUI = document.getElementById('riverFeedback');
const riverProgressUI = document.getElementById('riverProgress');
const loadingScreen = document.getElementById('loadingScreen');
const uiContainer = document.getElementById('ui-container');
const interactionPrompt = document.getElementById('interactionPrompt');
const interactionText = document.getElementById('interactionText');

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x33334d);

// --- Camera Setup ---
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

// --- Renderer Setup ---
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(10, 15, 10); directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048; directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// --- Layout Constants ---
const MIN_X = -15;
const MAX_X = 15;
const MIN_Z = -10;
const MAX_Z = 10;
const DIVIDING_WALL_X = 0; // Wall separating Mito and Cyto
const TOTAL_WIDTH = MAX_X - MIN_X;
const TOTAL_DEPTH = MAX_Z - MIN_Z;
const MITO_WIDTH = DIVIDING_WALL_X - MIN_X;
const CYTO_WIDTH = MAX_X - DIVIDING_WALL_X;

// --- Ground & Zones ---
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x555577, metalness: 0.1, roughness: 0.8 });
const groundGeometry = new THREE.PlaneGeometry(TOTAL_WIDTH, TOTAL_DEPTH);
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.set(0, 0, 0); // Center the ground
ground.receiveShadow = true;
scene.add(ground);

const mitoMaterial = new THREE.MeshStandardMaterial({ color: 0x886666, metalness: 0.1, roughness: 0.8, side: THREE.DoubleSide });
const mitoGeometry = new THREE.PlaneGeometry(MITO_WIDTH, TOTAL_DEPTH);
const mitochondriaZone = new THREE.Mesh(mitoGeometry, mitoMaterial);
mitochondriaZone.rotation.x = -Math.PI / 2;
mitochondriaZone.position.set(MIN_X + MITO_WIDTH / 2, 0.01, 0);
mitochondriaZone.receiveShadow = true;
scene.add(mitochondriaZone);

// --- OrbitControls ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.1;
controls.screenSpacePanning = false;
controls.enableRotate = false; controls.enableZoom = false; controls.enablePan = false;
let isUserInteracting = false;

// --- Interaction/Tracking Arrays and Map ---
let interactiveObjects = [];
let resourceMeshes = [];
let collidableWalls = [];
const wallBoundingBoxes = [];
const originalMaterials = new Map();
const playerBoundingBox = new THREE.Box3();
let portalBarrier = null;

// --- Player Setup ---
const playerSpeed = 5.0;
const playerRadius = 0.35;
const player = new THREE.Group();
player.position.set(-5, 0, 0); // Start in Mito
scene.add(player);

// Humanoid Model Parts
const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x0099ff, roughness: 0.6, metalness: 0.2 });
const headHeight = 0.4; const bodyHeight = 0.8; const limbRadius = 0.1;
const armLength = 0.6; const legHeight = 0.7;
const head = new THREE.Mesh(new THREE.SphereGeometry(headHeight / 2, 16, 12), bodyMaterial); head.position.y = legHeight + bodyHeight + headHeight / 2; head.castShadow = true; player.add(head);
const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, bodyHeight, 0.3), bodyMaterial); body.position.y = legHeight + bodyHeight / 2; body.castShadow = true; player.add(body);
const limbMaterial = new THREE.MeshStandardMaterial({ color: 0x0077cc, roughness: 0.7 });
const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(limbRadius, limbRadius, armLength), limbMaterial); leftArm.position.set(-0.35, legHeight + bodyHeight * 0.7, 0); leftArm.rotation.z = Math.PI / 8; leftArm.castShadow = true; player.add(leftArm);
const rightArm = leftArm.clone(); rightArm.position.x = 0.35; rightArm.rotation.z = -Math.PI / 8; player.add(rightArm);
const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(limbRadius * 1.2, limbRadius * 1.1, legHeight), limbMaterial); leftLeg.position.set(-0.15, legHeight / 2, 0); leftLeg.castShadow = true; player.add(leftLeg);
const rightLeg = leftLeg.clone(); rightLeg.position.x = 0.15; player.add(rightLeg);
const playerHeight = legHeight + bodyHeight + headHeight;

const keysPressed = {};

// --- Wall Layout & Collision ---
const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.2, roughness: 0.9 });
const wallHeight = 1.5;
const portalGapWidth = 3.0;
const portalWallX = DIVIDING_WALL_X;
const portalWallCenterZ = 0;

function createWall(position, size, rotationY = 0, name = "Wall") {
    const wallGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.set(position.x, wallHeight / 2, position.z);
    wall.rotation.y = rotationY;
    wall.castShadow = true; wall.receiveShadow = true;
    wall.name = name;
    scene.add(wall);
    collidableWalls.push(wall);
    wall.updateMatrixWorld();
    const wallBox = new THREE.Box3().setFromObject(wall);
    wallBoundingBoxes.push(wallBox);
    return wall;
}

// --- Create Walls ---
// Outer Walls
createWall({ x: MIN_X, y: 0, z: 0 }, { x: 0.5, y: wallHeight, z: TOTAL_DEPTH }, 0, "Outer_Left");
createWall({ x: MAX_X, y: 0, z: 0 }, { x: 0.5, y: wallHeight, z: TOTAL_DEPTH }, 0, "Outer_Right");
createWall({ x: 0, y: 0, z: MIN_Z }, { x: TOTAL_WIDTH, y: wallHeight, z: 0.5 }, 0, "Outer_Bottom");
createWall({ x: 0, y: 0, z: MAX_Z }, { x: TOTAL_WIDTH, y: wallHeight, z: 0.5 }, 0, "Outer_Top");

// Dividing Wall (with Portal Gap)
const gapStartZ = portalWallCenterZ - portalGapWidth / 2;
const gapEndZ = portalWallCenterZ + portalGapWidth / 2;
const wall1Length = gapStartZ - MIN_Z;
const wall1CenterZ = MIN_Z + wall1Length / 2;
if (wall1Length > 0.1) { createWall({ x: DIVIDING_WALL_X, y: 0, z: wall1CenterZ }, { x: 0.5, y: wallHeight, z: wall1Length }, 0, "Dividing_Wall_Bottom"); }
const wall2Length = MAX_Z - gapEndZ;
const wall2CenterZ = gapEndZ + wall2Length / 2;
if (wall2Length > 0.1) { createWall({ x: DIVIDING_WALL_X, y: 0, z: wall2CenterZ }, { x: 0.5, y: wallHeight, z: wall2Length }, 0, "Dividing_Wall_Top"); }

// --- RESTORED: Internal Mitochondria Walls (Adjusted for new layout) ---
const internalWallLength = MITO_WIDTH * 0.7; // Make them slightly shorter than mito width
const internalWallCenterX = MIN_X + MITO_WIDTH / 2; // Center them horizontally in mito
createWall({ x: internalWallCenterX, y: 0, z: -4 }, { x: internalWallLength, y: wallHeight, z: 0.5 }, 0, "H_Mito_Internal_1");
createWall({ x: internalWallCenterX, y: 0, z: 4 }, { x: internalWallLength, y: wallHeight, z: 0.5 }, 0, "H_Mito_Internal_2");
// --- END RESTORED ---

// Add cabinet (Mitochondria)
const cabinetMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 });
const cabinetGeometry = new THREE.BoxGeometry(1, 1.5, 1.5);
const cabinet = new THREE.Mesh(cabinetGeometry, cabinetMaterial);
cabinet.position.set(MIN_X + 1.5, 0.75, -8);
scene.add(cabinet); cabinet.castShadow = true; cabinet.receiveShadow = true;
const cabinetLabel = createTextSprite("Kitchen Cabinet", { x: cabinet.position.x, y: cabinet.position.y + 1.2, z: cabinet.position.z }, { fontSize: 24, scale: 0.5 });
scene.add(cabinetLabel);
createResource('HCO3', { x: cabinet.position.x, z: cabinet.position.z }, 0xaaaaff, { initialY: cabinet.position.y + (cabinetGeometry.parameters.height / 2) + 0.3 });

// --- Interaction Setup ---
const interactionRadius = 2.0;
let closestInteractiveObject = null;
let lastClosestObject = null;
const highlightMaterial = new THREE.MeshStandardMaterial({ emissive: 0xffff00, emissiveIntensity: 0.6 });

// --- Game State & Quest Data ---
const QUEST_STATE = {
    NOT_STARTED: 'NOT_STARTED',
    STEP_1_GATHER_MITO: 'STEP_1_GATHER_MITO',
    STEP_2_MAKE_CARB_PHOS: 'STEP_2_MAKE_CARB_PHOS',
    STEP_3_MEET_USHER: 'STEP_3_MEET_USHER',
    STEP_4_MAKE_CITRULLINE: 'STEP_4_MAKE_CITRULLINE',
    STEP_5A_OPEN_PORTAL: 'STEP_5A_OPEN_PORTAL',
    STEP_6_GATHER_CYTO: 'STEP_6_GATHER_CYTO',
    STEP_7_MAKE_ARGSUCC: 'STEP_7_MAKE_ARGSUCC',
    STEP_8_CLEAVE_ARGSUCC: 'STEP_8_CLEAVE_ARGSUCC',
    STEP_8B_FURNACE_FUMARATE: 'STEP_8B_FURNACE_FUMARATE',
    STEP_9_MAKE_UREA: 'STEP_9_MAKE_UREA',
    STEP_9B_DISPOSE_UREA: 'STEP_9B_DISPOSE_UREA',
    STEP_10_RIVER_CHALLENGE: 'STEP_10_RIVER_CHALLENGE',
    COMPLETED: 'COMPLETED'
};
const cytosolStates = [
    QUEST_STATE.STEP_6_GATHER_CYTO, QUEST_STATE.STEP_7_MAKE_ARGSUCC,
    QUEST_STATE.STEP_8_CLEAVE_ARGSUCC, QUEST_STATE.STEP_8B_FURNACE_FUMARATE,
    QUEST_STATE.STEP_9_MAKE_UREA, QUEST_STATE.STEP_9B_DISPOSE_UREA,
    QUEST_STATE.STEP_10_RIVER_CHALLENGE
];
let inventory = {}; let currentQuest = null;
let hasPortalPermission = false;
let playerLocation = 'mitochondria';

const ureaCycleQuest = {
    id: 'ureaCycle', name: "Ammonia Annihilation", state: QUEST_STATE.NOT_STARTED,
    objectives: {
        [QUEST_STATE.NOT_STARTED]: "Talk to Professor Hepaticus.",
        [QUEST_STATE.STEP_1_GATHER_MITO]: "First, gather NH3 (1), HCO3 (1), ATP (2) in Mitochondria.",
        [QUEST_STATE.STEP_2_MAKE_CARB_PHOS]: "Great! Now use the CPS1 Station to make Carbamoyl Phosphate.",
        [QUEST_STATE.STEP_3_MEET_USHER]: "Find the Ornithine Usher to get some Ornithine.",
        [QUEST_STATE.STEP_4_MAKE_CITRULLINE]: "Use OTC Station with Carbamoyl Phosphate and Ornithine to make Citrulline, then talk to the Ornithine Usher to gain passage.",
        [QUEST_STATE.STEP_5A_OPEN_PORTAL]: "Permission granted! Use the ORN T1 Portal with Citrulline to activate it and transport to the Cytosol.",
        [QUEST_STATE.STEP_6_GATHER_CYTO]: "In the Cytosol: Collect the transported Citrulline, plus Aspartate (1) and ATP (1).",
        [QUEST_STATE.STEP_7_MAKE_ARGSUCC]: "Use ASS Station to make Argininosuccinate.",
        [QUEST_STATE.STEP_8_CLEAVE_ARGSUCC]: "Use ASL Station to cleave Argininosuccinate into Arginine and Fumarate. Collect both.",
        [QUEST_STATE.STEP_8B_FURNACE_FUMARATE]: "Gather the Arginine and Fumarate. Then, feed the Fumarate to the Krebs Cycle Furnace.",
        [QUEST_STATE.STEP_9_MAKE_UREA]: "Use ARG1 Station with Arginine to make Urea and Ornithine.",
        [QUEST_STATE.STEP_9B_DISPOSE_UREA]: "Dispose of the toxic Urea in the Waste Receptacle.",
        [QUEST_STATE.STEP_10_RIVER_CHALLENGE]: "Return to Professor Hepaticus and pass the Reality River challenge.",
        [QUEST_STATE.COMPLETED]: "Quest complete! You've mastered the Urea Cycle!"
    }, rewards: { knowledgePoints: 100 }
};
const ureaRiverQuestions = [
    { q: "Where does the Urea Cycle BEGIN?", a: ["Cytosol", "Mitochondria", "Nucleus", "ER"], correct: 1 },
    { q: "Which enzyme combines NH3, HCO3, and ATP?", a: ["OTC", "CPS1", "ASS", "Arginase"], correct: 1 },
    { q: "Which molecule carries N into the cycle in cytosol?", a: ["Glutamate", "Ornithine", "Aspartate", "Citrulline"], correct: 2 },
    { q: "Which molecule is transported OUT of mitochondria?", a: ["Ornithine", "Carbamoyl Phosphate", "Citrulline", "Urea"], correct: 2 },
    { q: "What toxic molecule is the primary input?", a: ["Urea", "Ammonia (NH3/NH4+)", "Fumarate", "ATP"], correct: 1 },
    { q: "What molecule is REGENERATED in cytosol?", a: ["Arginine", "Ornithine", "Aspartate", "Urea"], correct: 1 }
];
let currentRiverQuestionIndex = 0; let riverCorrectAnswers = 0;

// --- Text Sprite Function ---
function createTextSprite(text, position, parameters = {}) {
    const fontFace = parameters.fontFace || "Arial";
    const fontSize = parameters.fontSize || 48; // Base font size for canvas texture
    const scaleFactor = parameters.scale || 1.0; // Use default 1.0 if not provided, adjust per object
    const color = parameters.textColor || "rgba(255, 255, 255, 0.95)";

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = "Bold " + fontSize + "px " + fontFace;

    const metrics = context.measureText(text);
    const textWidth = metrics.width;
    const padding = fontSize * 0.2;
    canvas.width = textWidth + padding * 2;
    canvas.height = fontSize + padding * 2;

    // Re-set font after resizing canvas (important for some browsers)
    context.font = "Bold " + fontSize + "px " + fontFace;
    context.fillStyle = color;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false, // Render on top
        depthWrite: false
    });

    const sprite = new THREE.Sprite(spriteMaterial);
    const aspect = canvas.width / canvas.height;
    // Use the scaleFactor passed in parameters
    sprite.scale.set(scaleFactor * aspect, scaleFactor, 1);
    sprite.position.set(position.x, position.y, position.z);
    return sprite;
}


// --- Game Object Creation Functions ---
function createLightningBoltGeometry() {
    const points = [ new THREE.Vector3(0, 0.8, 0), new THREE.Vector3(-0.4, 0.4, 0.2), new THREE.Vector3(0, 0.2, -0.2), new THREE.Vector3(0.4, 0, 0.2), new THREE.Vector3(0, -0.2, -0.2), new THREE.Vector3(-0.4, -0.4, 0.2), new THREE.Vector3(0, -0.8, 0) ];
    const geometry = new THREE.BufferGeometry(); const vertices = []; const thickness = 0.15;
    for (let i = 0; i < points.length - 1; i++) { const p1 = points[i]; const p2 = points[i + 1]; const direction = new THREE.Vector3().subVectors(p2, p1).normalize(); const perpendicular = new THREE.Vector3(-direction.y, direction.x, 0).multiplyScalar(thickness); vertices.push( p1.x + perpendicular.x, p1.y + perpendicular.y, p1.z + thickness, p1.x - perpendicular.x, p1.y - perpendicular.y, p1.z + thickness, p2.x + perpendicular.x, p2.y + perpendicular.y, p2.z + thickness ); vertices.push( p1.x - perpendicular.x, p1.y - perpendicular.y, p1.z + thickness, p2.x - perpendicular.x, p2.y - perpendicular.y, p2.z + thickness, p2.x + perpendicular.x, p2.y + perpendicular.y, p2.z + thickness ); vertices.push( p1.x + perpendicular.x, p1.y + perpendicular.y, p1.z - thickness, p2.x + perpendicular.x, p2.y + perpendicular.y, p2.z - thickness, p1.x - perpendicular.x, p1.y - perpendicular.y, p1.z - thickness ); vertices.push( p2.x + perpendicular.x, p2.y + perpendicular.y, p2.z - thickness, p2.x - perpendicular.x, p2.y - perpendicular.y, p2.z - thickness, p1.x - perpendicular.x, p1.y - perpendicular.y, p1.z - thickness ); vertices.push( p1.x + perpendicular.x, p1.y + perpendicular.y, p1.z + thickness, p2.x + perpendicular.x, p2.y + perpendicular.y, p2.z + thickness, p1.x + perpendicular.x, p1.y + perpendicular.y, p1.z - thickness ); vertices.push( p2.x + perpendicular.x, p2.y + perpendicular.y, p2.z + thickness, p2.x + perpendicular.x, p2.y + perpendicular.y, p2.z - thickness, p1.x + perpendicular.x, p1.y + perpendicular.y, p1.z - thickness ); vertices.push( p1.x - perpendicular.x, p1.y - perpendicular.y, p1.z + thickness, p1.x - perpendicular.x, p1.y - perpendicular.y, p1.z - thickness, p2.x - perpendicular.x, p2.y - perpendicular.y, p2.z + thickness ); vertices.push( p1.x - perpendicular.x, p1.y - perpendicular.y, p1.z - thickness, p2.x - perpendicular.x, p2.y - perpendicular.y, p2.z - thickness, p2.x - perpendicular.x, p2.y - perpendicular.y, p2.z + thickness ); }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.computeVertexNormals(); return geometry;
}
function createStation(name, position, color, userData) {
    const geometry = new THREE.BoxGeometry(1, 2, 1); const material = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 }); const station = new THREE.Mesh(geometry, material); station.position.set(position.x, 1, position.z); station.castShadow = true; station.receiveShadow = true; station.userData = { type: 'station', name: name, ...userData }; scene.add(station); interactiveObjects.push(station); originalMaterials.set(station, material.clone());
    const label = createTextSprite(name, { x: position.x, y: 2.5, z: position.z }, { fontSize: 36, scale: 0.75 });
    scene.add(label); return station;
}
function createResource(name, position, color, userData = {}) {
    try { let geometry; let material; let scale = 1.0;
        if (name === 'ATP') { geometry = createLightningBoltGeometry(); material = new THREE.MeshStandardMaterial({ color: color, roughness: 0.3, metalness: 0.7, emissive: color, emissiveIntensity: 0.3 }); }
        else { geometry = new THREE.SphereGeometry(0.3, 12, 10); if (name === 'Carbamoyl Phosphate') { color = 0xff3333; } else if (name === 'Citrulline') { color = 0xff8c00; } else if (name === 'Argininosuccinate') { color = 0x33ff33; geometry = new THREE.IcosahedronGeometry(0.35, 0); scale = 1.1; } else if (name === 'Arginine') { color = 0x6666ff; geometry = new THREE.CapsuleGeometry(0.2, 0.3, 4, 8); scale = 1.0; } else if (name === 'Urea') { color = 0xdddddd; geometry = new THREE.TorusKnotGeometry(0.2, 0.08, 50, 8); scale = 1.2; } else if (name === 'Ornithine') { color = 0xaaccaa; } else if (name === 'Fumarate') { color = 0xcccccc; geometry = new THREE.DodecahedronGeometry(0.3, 0); } material = new THREE.MeshStandardMaterial({ color: color, roughness: 0.5, metalness: 0.1 }); }
        const resource = new THREE.Mesh(geometry, material); if (isNaN(position.x) || isNaN(position.z)) { console.error(`Invalid pos for ${name}`); position = { x: 0, z: 0 }; } const initialY = userData.initialY !== undefined ? userData.initialY : 0.6; resource.userData = { ...userData, type: 'resource', name: name, object3D: resource, initialY: initialY }; resource.position.set(position.x, initialY, position.z); resource.scale.set(scale, scale, scale); resource.castShadow = true;
        if (name !== 'ATP' && !(geometry instanceof THREE.SphereGeometry)) { resource.rotation.x = Math.random() * Math.PI; resource.rotation.y = Math.random() * Math.PI * 2; } else if (name === 'ATP') { resource.rotation.y = Math.random() * Math.PI * 2; }
        scene.add(resource); interactiveObjects.push(resource); resourceMeshes.push(resource); originalMaterials.set(resource, material.clone()); return resource;
    } catch (error) { console.error(`Error creating ${name}:`, error); return null; }
}
function createProfessorHepaticus(position) {
    const professorGroup = new THREE.Group(); professorGroup.position.copy(position);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xccaa00, roughness: 0.7 }); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.2, 8), bodyMaterial); body.position.y = 0.6; body.castShadow = true; professorGroup.add(body);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc99, roughness: 0.5 }); const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), headMaterial); head.position.y = 1.4; head.castShadow = true; professorGroup.add(head);
    const coatMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }); const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 1.4, 8), coatMaterial); coat.position.y = 0.7; coat.castShadow = true; professorGroup.add(coat);
    const armMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }); const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8), armMaterial); leftArm.position.set(-0.5, 0.8, 0); leftArm.rotation.z = Math.PI / 6; leftArm.castShadow = true; professorGroup.add(leftArm); const rightArm = leftArm.clone(); rightArm.position.x = 0.5; rightArm.rotation.z = -Math.PI / 6; professorGroup.add(rightArm);
    const glassesMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.3 }); const leftLens = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), glassesMaterial); leftLens.position.set(-0.1, 1.45, 0.25); leftLens.rotation.x = 0; professorGroup.add(leftLens); const rightLens = leftLens.clone(); rightLens.position.x = 0.1; professorGroup.add(rightLens);
    scene.add(professorGroup); professorGroup.userData = { type: 'npc', name: 'Professor Hepaticus', questId: 'ureaCycle' }; interactiveObjects.push(professorGroup); originalMaterials.set(professorGroup, coatMaterial.clone());
    const label = createTextSprite("Professor Hepaticus", { x: position.x, y: position.y, z: position.z }, { fontSize: 36, scale: 0.75 });
    scene.add(label);
    return professorGroup;
}
function createWasteBucket(position) {
    const bucketGroup = new THREE.Group(); bucketGroup.position.copy(position);
    const kidneyShape = new THREE.Shape(); kidneyShape.moveTo(0, 0.6); kidneyShape.bezierCurveTo(0.5, 0.7, 0.7, 0.4, 0.6, 0); kidneyShape.bezierCurveTo(0.65, -0.5, 0.3, -0.7, 0, -0.6); kidneyShape.bezierCurveTo(-0.3, -0.7, -0.65, -0.5, -0.6, 0); kidneyShape.bezierCurveTo(-0.7, 0.4, -0.5, 0.7, 0, 0.6);
    const extrudeSettings = { steps: 1, depth: 1.0, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelOffset: 0, bevelSegments: 3 };
    const geometry = new THREE.ExtrudeGeometry(kidneyShape, extrudeSettings); geometry.center(); geometry.rotateX(Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({ color: 0x888899, metalness: 0.7, roughness: 0.4 });
    const bucket = new THREE.Mesh(geometry, material); bucket.scale.set(0.8, 0.8, 0.8); bucket.castShadow = true; bucket.receiveShadow = true; bucketGroup.add(bucket);
    scene.add(bucketGroup); bucketGroup.userData = { type: 'wasteBucket', name: 'Waste Receptacle' }; interactiveObjects.push(bucketGroup); originalMaterials.set(bucketGroup, material.clone());
    const label = createTextSprite("Waste Receptacle", { x: position.x, y: position.y + 1.2, z: position.z }, { fontSize: 30, scale: 0.6 });
    scene.add(label);
    return bucketGroup;
}
function createKrebsFurnace(position) {
    const furnaceGroup = new THREE.Group(); furnaceGroup.position.copy(position);
    const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 }); const baseGeometry = new THREE.BoxGeometry(1.2, 1.5, 1.2); const base = new THREE.Mesh(baseGeometry, baseMaterial); base.position.y = 0.75; base.castShadow = true; base.receiveShadow = true; furnaceGroup.add(base);
    const fireMaterial = new THREE.MeshStandardMaterial({ color: 0xff4500, emissive: 0xdd3300, emissiveIntensity: 0.8, roughness: 0.6 }); const fireGeometry = new THREE.BoxGeometry(0.8, 0.6, 0.2); const firebox = new THREE.Mesh(fireGeometry, fireMaterial); firebox.position.set(0, 0.5, 0.51); furnaceGroup.add(firebox);
    const chimneyGeometry = new THREE.CylinderGeometry(0.2, 0.15, 0.8); const chimney = new THREE.Mesh(chimneyGeometry, baseMaterial); chimney.position.y = 1.5 + 0.4; furnaceGroup.add(chimney);
    furnaceGroup.userData = { type: 'krebsFurnace', name: 'Krebs Cycle Furnace' }; scene.add(furnaceGroup); interactiveObjects.push(furnaceGroup); originalMaterials.set(furnaceGroup, baseMaterial.clone()); originalMaterials.set(firebox, fireMaterial.clone());
    const label = createTextSprite("Krebs Cycle Furnace", { x: position.x, y: position.y + 2.4, z: position.z }, { fontSize: 30, scale: 0.6 }); scene.add(label);
    return furnaceGroup;
}


// --- Create Game World Entities (Repositioned) ---
const carbPhosColor = 0xff3333; const citrullineColor = 0xff8c00; const argSuccColor = 0x33ff33; const arginineColor = 0x6666ff; const ureaColor = 0xdddddd; const ornithineColor = 0xaaccaa; const fumarateColor = 0xcccccc;

// --- MITOCHONDRIA (X < 0) ---
const professorHepaticus = createProfessorHepaticus(new THREE.Vector3(-3, 0, -8)); // Moved further left
const usherMaterial = new THREE.MeshStandardMaterial({ color: 0x8a2be2 });
const usherGeometry = new THREE.CapsuleGeometry(0.4, 1.0, 4, 8);
const ornithineUsher = new THREE.Mesh(usherGeometry, usherMaterial);
ornithineUsher.position.set(-2, 0.7, -2); // Near portal wall, clear of internal wall
ornithineUsher.castShadow = true;
ornithineUsher.userData = { type: 'npc', name: 'Ornithine Usher' };
scene.add(ornithineUsher);
interactiveObjects.push(ornithineUsher);
originalMaterials.set(ornithineUsher, usherMaterial.clone());
const usherLabel = createTextSprite("Ornithine Usher", { x: ornithineUsher.position.x, y: 2.2, z: ornithineUsher.position.z }, { fontSize: 36, scale: 0.75 });
scene.add(usherLabel);

createStation("CPS1", { x: -12, z: 0 }, 0xff0000, { requires: { 'NH3': 1, 'HCO3': 1, 'ATP': 2 }, produces: 'Carbamoyl Phosphate', productColors: { 'Carbamoyl Phosphate': carbPhosColor }, requiredQuestState: QUEST_STATE.STEP_2_MAKE_CARB_PHOS, advancesQuestTo: QUEST_STATE.STEP_3_MEET_USHER });
createStation("OTC", { x: -8, z: 7 }, 0xff4500, { requires: { 'Carbamoyl Phosphate': 1, 'Ornithine': 1 }, produces: 'Citrulline', productColors: { 'Citrulline': citrullineColor }, requiredQuestState: QUEST_STATE.STEP_4_MAKE_CITRULLINE, advancesQuestTo: QUEST_STATE.STEP_4_MAKE_CITRULLINE }); // Moved up
createResource('NH3', { x: -13, z: 5 }, 0xffaaaa);
createResource('ATP', { x: -10, z: 8 }, 0xffffaa);
// ADDED: Second ATP resource in Mitochondria
createResource('ATP', { x: -4, z: 8 }, 0xffffaa); // Different position

// --- CYTOSOL (X > 0) ---
createStation("ASS", { x: 5, z: 5 }, 0x00ff00, { requires: { 'Citrulline': 1, 'Aspartate': 1, 'ATP': 1 }, produces: 'Argininosuccinate', productColors: { 'Argininosuccinate': argSuccColor }, requiredQuestState: QUEST_STATE.STEP_7_MAKE_ARGSUCC, advancesQuestTo: QUEST_STATE.STEP_8_CLEAVE_ARGSUCC });
createStation("ASL", { x: 10, z: 0 }, 0x00ced1, { requires: { 'Argininosuccinate': 1 }, produces: ['Arginine', 'Fumarate'], productColors: { 'Arginine': arginineColor, 'Fumarate': fumarateColor }, requiredQuestState: QUEST_STATE.STEP_8_CLEAVE_ARGSUCC, advancesQuestTo: QUEST_STATE.STEP_8B_FURNACE_FUMARATE });
createStation("ARG1", { x: 5, z: -5 }, 0x0000ff, { requires: { 'Arginine': 1 }, produces: ['Urea', 'Ornithine'], productColors: { 'Urea': ureaColor, 'Ornithine': ornithineColor }, requiredQuestState: QUEST_STATE.STEP_9_MAKE_UREA, advancesQuestTo: QUEST_STATE.STEP_9B_DISPOSE_UREA });
createResource('Aspartate', { x: 8, z: 8 }, 0xffaaff);
createResource('ATP', { x: 3, z: 0 }, 0xffffaa); // ATP in cytosol
const wasteBucket = createWasteBucket(new THREE.Vector3(13, 0, -8));

// --- MODIFIED: Embed Krebs Furnace in the dividing wall ---
// Position its center exactly on the dividing wall X, within Cytosol Z range
const krebsFurnace = createKrebsFurnace(new THREE.Vector3(DIVIDING_WALL_X, 1, 8));

// --- ORN T1 Portal (On dividing wall) ---
const portalGeometry = new THREE.TorusGeometry(1.5, 0.3, 16, 50);
const portalMaterial = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00aaaa, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide });
const ornT1Portal = new THREE.Mesh(portalGeometry, portalMaterial);
ornT1Portal.position.set(portalWallX + 0.05, wallHeight / 2 + 0.1, portalWallCenterZ);
ornT1Portal.rotation.y = Math.PI / 2;
ornT1Portal.userData = { type: 'portal', name: 'ORN T1 Portal', requiredQuestState: QUEST_STATE.STEP_5A_OPEN_PORTAL, requires: { 'Citrulline': 1 }, advancesQuestTo: QUEST_STATE.STEP_6_GATHER_CYTO, action: 'transportCitrulline', productColor: citrullineColor };
scene.add(ornT1Portal); interactiveObjects.push(ornT1Portal); originalMaterials.set(ornT1Portal, portalMaterial.clone());
const portalLabel = createTextSprite("ORN T1 Portal", { x: ornT1Portal.position.x, y: ornT1Portal.position.y + 2.0, z: ornT1Portal.position.z }, { fontSize: 36, scale: 0.75 });
scene.add(portalLabel);

// Portal Barrier (On dividing wall)
const barrierGeometry = new THREE.PlaneGeometry(portalGapWidth - 0.1, wallHeight - 0.1);
const barrierMaterial = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00aaaa, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
portalBarrier = new THREE.Mesh(barrierGeometry, barrierMaterial);
portalBarrier.position.set(portalWallX, wallHeight / 2, portalWallCenterZ);
portalBarrier.rotation.y = Math.PI / 2;
portalBarrier.name = "PortalBarrier";
scene.add(portalBarrier);
collidableWalls.push(portalBarrier);
portalBarrier.updateMatrixWorld();
wallBoundingBoxes.push(new THREE.Box3().setFromObject(portalBarrier));


// --- UI Functions ---
function updateInventoryUI() {
    inventoryList.innerHTML = '';
    let hasItems = false;
    for (const itemName in inventory) {
        if (inventory[itemName] > 0) {
            const li = document.createElement('li');
            li.textContent = `${itemName}: ${inventory[itemName]}`;
            inventoryList.appendChild(li);
            hasItems = true;
        }
    }
    if (!hasItems) {
        inventoryList.innerHTML = '<li>Empty</li>';
    }
}
function showDialogue(text, options = []) {
    dialogueText.textContent = text;
    dialogueOptions.innerHTML = '';
    options.forEach(opt => {
        const button = document.createElement('button');
        button.textContent = opt.text;
        button.onclick = () => {
            hideDialogue();
            if (opt.action) opt.action();
        };
        dialogueOptions.appendChild(button);
    });
    dialogueBox.classList.remove('hidden');
    controls.enabled = false;
    isUserInteracting = true;
}
function hideDialogue() {
    dialogueBox.classList.add('hidden');
    controls.enabled = true; // Re-enable controls if they were disabled
    isUserInteracting = false;
}
function updateQuestUI() {
    if (currentQuest) {
        questNameUI.textContent = currentQuest.name;
        questObjectiveUI.textContent = currentQuest.objectives[currentQuest.state] || 'Completed!';
    } else {
        questNameUI.textContent = 'None';
        questObjectiveUI.textContent = 'Find and speak with Professor Hepaticus.';
    }
}
function showFeedback(message, duration = 2500) {
    const feedback = document.createElement('div');
    feedback.style.position = 'absolute';
    feedback.style.bottom = '150px';
    feedback.style.left = '50%';
    feedback.style.transform = 'translateX(-50%)';
    feedback.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    feedback.style.color = 'white';
    feedback.style.padding = '10px 20px';
    feedback.style.borderRadius = '5px';
    feedback.textContent = message;
    feedback.style.pointerEvents = 'none'; // Allow clicks to pass through
    feedback.style.zIndex = '10'; // Ensure it's above most UI but below critical popups if any
    uiContainer.appendChild(feedback);
    setTimeout(() => {
        if (feedback.parentNode) {
            feedback.parentNode.removeChild(feedback);
        }
    }, duration);
}
function showInteractionPrompt(objectName) {
    if (interactionPrompt) {
        interactionText.textContent = objectName;
        interactionPrompt.classList.remove('hidden');
    }
}
function hideInteractionPrompt() {
    if (interactionPrompt) {
        interactionPrompt.classList.add('hidden');
    }
}

// --- Inventory Functions ---
function addToInventory(itemName, quantity = 1) {
    inventory[itemName] = (inventory[itemName] || 0) + quantity;
    updateInventoryUI();
}
function removeFromInventory(itemName, quantity = 1) {
    if (inventory[itemName] && inventory[itemName] >= quantity) {
        inventory[itemName] -= quantity;
        if (inventory[itemName] === 0) {
            delete inventory[itemName];
        }
        updateInventoryUI();
        return true;
    }
    return false;
}
function hasItems(requiredItems) {
    for (const itemName in requiredItems) {
        if (!inventory[itemName] || inventory[itemName] < requiredItems[itemName]) {
            return false;
        }
    }
    return true;
}

// --- Quest Functions ---
function startQuest(quest) {
    if (!currentQuest) {
        currentQuest = { ...quest }; // Shallow copy the quest object
        currentQuest.state = QUEST_STATE.STEP_1_GATHER_MITO; // Start at the first step
        updateQuestUI();
        showFeedback(`Quest Started: ${quest.name}`);
    }
}
function advanceQuest(quest, newState) {
    if (currentQuest && currentQuest.id === quest.id && currentQuest.state !== newState) {
        console.log(`Advancing quest ${quest.id} from ${currentQuest.state} to ${newState}`);
        currentQuest.state = newState;
        updateQuestUI(); // Update UI immediately

        // Optional: Add specific feedback when reaching certain steps
        if (newState === QUEST_STATE.STEP_8B_FURNACE_FUMARATE) {
            showFeedback("Products collected! Now feed the Fumarate to the furnace.");
        } else if (newState === QUEST_STATE.STEP_9_MAKE_UREA) {
             showFeedback("Fumarate processed! Time to make Urea.");
        } else if (newState === QUEST_STATE.STEP_6_GATHER_CYTO) {
            showFeedback(`Objective Updated!`);
            // Check if player already has items needed for next step upon entering cytosol
            if (hasItems({ 'Citrulline': 1, 'Aspartate': 1, 'ATP': 1 })) {
                 console.log("Items for STEP_7 already present upon entering STEP_6. Advancing immediately.");
                 // Use timeout to allow the "Objective Updated" message to show first
                 setTimeout(() => {
                     advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_7_MAKE_ARGSUCC);
                     showFeedback("Cytosol materials gathered! Head to the ASS station.");
                 }, 50); // Short delay
                 return; // Prevent immediate double advancement if conditions met quickly
            }
        }
        else if (newState === QUEST_STATE.COMPLETED) {
            const rewardPoints = quest.rewards?.knowledgePoints || 0;
            showFeedback(`Quest Complete: ${quest.name}! +${rewardPoints} KP`, 5000);
            // Optionally reset quest after a delay
             setTimeout(() => {
                 if(currentQuest?.state === QUEST_STATE.COMPLETED) { // Check if still completed
                     currentQuest = null;
                     updateQuestUI();
                 }
             }, 100);
        }
    } else if (currentQuest && currentQuest.id === quest.id && currentQuest.state === newState) {
        // Already in this state, do nothing. Could add a log here if needed.
        // console.log(`Quest ${quest.id} already in state ${newState}.`);
    }
}

// --- Reality River Functions ---
function startRealityRiver() {
    currentRiverQuestionIndex = 0;
    riverCorrectAnswers = 0;
    realityRiverUI.classList.remove('hidden');
    displayRiverQuestion();
    updateRiverProgress();
    controls.enabled = false; // Disable camera controls
    isUserInteracting = true; // Set interaction flag
}
function displayRiverQuestion() {
    if (currentRiverQuestionIndex >= ureaRiverQuestions.length) {
        endRealityRiver(true); // All questions answered correctly
        return;
    }
    const qData = ureaRiverQuestions[currentRiverQuestionIndex];
    riverQuestionUI.textContent = qData.q;
    riverAnswersUI.innerHTML = ''; // Clear previous answers
    riverFeedbackUI.textContent = ''; // Clear feedback

    qData.a.forEach((answer, index) => {
        const button = document.createElement('button');
        button.textContent = answer;
        button.onclick = () => checkRiverAnswer(index);
        riverAnswersUI.appendChild(button);
    });
}
function checkRiverAnswer(selectedIndex) {
    const qData = ureaRiverQuestions[currentRiverQuestionIndex];
    if (selectedIndex === qData.correct) {
        riverFeedbackUI.textContent = "Correct! Moving forward...";
        riverFeedbackUI.style.color = 'lightgreen';
        riverCorrectAnswers++;
        currentRiverQuestionIndex++;
        updateRiverProgress();

        // Disable buttons after answering
        const buttons = riverAnswersUI.querySelectorAll('button');
        buttons.forEach(b => b.disabled = true);

        // Move to next question or end after a delay
        setTimeout(() => {
            if (currentRiverQuestionIndex >= ureaRiverQuestions.length) {
                endRealityRiver(true);
            } else {
                displayRiverQuestion();
            }
        }, 1000); // 1 second delay
    } else {
        riverFeedbackUI.textContent = "Not quite. Think about the process...";
        riverFeedbackUI.style.color = 'lightcoral';
        // Optionally, end the game or allow retry after incorrect answer
        // For now, just shows feedback and waits for correct answer
    }
}
function updateRiverProgress() {
    let progress = "[";
    const totalSteps = ureaRiverQuestions.length;
    for(let i = 0; i < totalSteps; i++) {
        progress += (i < riverCorrectAnswers) ? "■" : "□";
    }
    progress += "]";
    riverProgressUI.textContent = progress;
}
function endRealityRiver(success) {
    realityRiverUI.classList.add('hidden');
    controls.enabled = true; // Re-enable camera controls
    isUserInteracting = false; // Clear interaction flag

    if (success) {
        showDialogue("Impressive! You've navigated the Urea Cycle...", [
            { text: "Great!", action: () => advanceQuest(ureaCycleQuest, QUEST_STATE.COMPLETED) }
        ]);
    } else {
        // This case might not be reached if incorrect answers don't end the game
        showDialogue("Hmm, seems you need to review...", [
            { text: "Okay" } // No action, just closes dialogue
        ]);
    }
}

// --- Helper: Remove Portal Barrier ---
function removePortalBarrier() {
    if (portalBarrier && portalBarrier.parent === scene) {
        console.log("Removing portal barrier NOW.");
        // Remove from collidables array
        const barrierIndex = collidableWalls.indexOf(portalBarrier);
        if (barrierIndex > -1) {
            collidableWalls.splice(barrierIndex, 1);
        } else { console.warn("Barrier mesh not found in collidableWalls array."); }

        // Remove from bounding boxes array
        const boxIndexToRemove = wallBoundingBoxes.findIndex(box => {
             const center = new Vector3();
             box.getCenter(center);
             // Check if the center of the box is very close to the barrier's position
             return center.distanceToSquared(portalBarrier.position) < 0.1; // Use a small threshold
        });
        if (boxIndexToRemove > -1) {
            wallBoundingBoxes.splice(boxIndexToRemove, 1);
        } else { console.warn("Barrier bounding box not found in wallBoundingBoxes array."); }

        // Remove from scene and dispose
        scene.remove(portalBarrier);
        portalBarrier.geometry.dispose();
        portalBarrier.material.dispose();
        portalBarrier = null; // Clear the reference
    } else {
        console.log("Portal barrier already removed or doesn't exist.");
    }
}

// --- Interaction Logic ---
function interactWithObject(object) {
    if (!object || isUserInteracting) return; // Don't interact if already interacting or no object
    const userData = object.userData;

    // --- NPC Interactions ---
    if (userData.type === 'npc' && userData.name === 'Professor Hepaticus') {
        isUserInteracting = true; // Stop player movement, etc.
        if (currentQuest && currentQuest.id === 'ureaCycle') {
            if (currentQuest.state === QUEST_STATE.STEP_10_RIVER_CHALLENGE) {
                 showDialogue("Ready to test your knowledge on the Urea Cycle?", [
                     { text: "Yes, start the challenge!", action: startRealityRiver },
                     { text: "Give me a moment.", action: () => { isUserInteracting = false; } } // Allow backing out
                 ]);
            } else if (currentQuest.state === QUEST_STATE.COMPLETED) {
                 showDialogue("Thanks again for helping clear the ammonia!", [
                     { text: "You're welcome.", action: () => { isUserInteracting = false; } }
                 ]);
            } else {
                 // Show current objective if quest active but not at challenge/complete state
                 showDialogue(`Current Objective: ${currentQuest.objectives[currentQuest.state]}`, [
                     { text: "Okay", action: () => { isUserInteracting = false; } }
                 ]);
            }
        } else if (!currentQuest) {
             // Offer the quest if not started
             showDialogue("The cell is overwhelmed with ammonia! We need to convert it to Urea. Can you help?", [
                 { text: "Accept Quest", action: () => { startQuest(ureaCycleQuest); isUserInteracting = false; } }, // Start quest and close dialogue
                 { text: "Decline", action: () => { isUserInteracting = false; } } // Just close dialogue
             ]);
        } else {
            // Fallback if interacted with but no specific state matches (shouldn't happen often)
            isUserInteracting = false;
        }
    }
    else if (userData.type === 'npc' && userData.name === 'Ornithine Usher') {
        isUserInteracting = true;
        if (currentQuest && currentQuest.id === 'ureaCycle') {
            if (currentQuest.state === QUEST_STATE.STEP_3_MEET_USHER) {
                showDialogue("Ah, you've made Carbamoyl Phosphate! You'll need Ornithine next...", [
                    { text: "Can I have some Ornithine?", action: () => {
                        // Spawn Ornithine near the Usher in Mitochondria
                        const p = ornithineUsher.position.clone().add(new THREE.Vector3(-1, 0, 1)); // Adjust offset as needed
                        p.y = 0.6;
                        createResource('Ornithine', {x: p.x, z: p.z}, ornithineColor, {initialY: 0.6});
                        showFeedback("Ornithine appeared!");
                        advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_4_MAKE_CITRULLINE);
                        isUserInteracting = false; // Close dialogue implicitly
                    }},
                    { text: "Tell me more about Ornithine", action: () => {
                        showDialogue("Ornithine is special because it gets recycled... When you make Citrulline, Ornithine is consumed. But later, when Arginine is cleaved to make Urea, Ornithine is regenerated!", [
                            { text: "I see! Can I have some?", action: () => {
                                const p = ornithineUsher.position.clone().add(new THREE.Vector3(-1, 0, 1));
                                p.y = 0.6;
                                createResource('Ornithine', {x: p.x, z: p.z}, ornithineColor, {initialY: 0.6});
                                showFeedback("Ornithine appeared!");
                                advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_4_MAKE_CITRULLINE);
                                // Dialogue closes implicitly here as well
                            }}
                        ]);
                    }}
                ]);
            } else if (currentQuest.state === QUEST_STATE.STEP_4_MAKE_CITRULLINE) {
                if (hasItems({ 'Citrulline': 1 })) {
                    hasPortalPermission = true;
                    showFeedback("Portal permission granted!");
                    advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_5A_OPEN_PORTAL);
                    showDialogue("Excellent! You've made Citrulline. I have granted you passage through the ORN T1 portal. You must activate it yourself using your Citrulline.", [
                        { text: "Understood.", action: () => { isUserInteracting = false; } }
                    ]);
                } else {
                    showDialogue("You'll need to make and collect Citrulline first. Use the OTC station...", [
                        { text: "Got it", action: () => { isUserInteracting = false; } }
                    ]);
                }
            } else if (currentQuest.state === QUEST_STATE.STEP_5A_OPEN_PORTAL) {
                showDialogue("You have permission. Use the ORN T1 Portal with your Citrulline...", [
                    { text: "Will do!", action: () => { isUserInteracting = false; } }
                ]);
            } else if (cytosolStates.includes(currentQuest.state)) {
                // If player is back in mito after reaching cytosol steps
                showDialogue("You've transported Citrulline. Well done!", [
                    { text: "Thanks!", action: () => { isUserInteracting = false; } }
                ]);
            } else {
                // Generic message if interacted at other quest stages
                showDialogue("Come back when you've made Carbamoyl Phosphate.", [
                    { text: "Okay", action: () => { isUserInteracting = false; } }
                ]);
            }
        } else {
            // Default dialogue if quest not active
            showDialogue("Greetings! I manage the ORN T1 antiport.", [
                { text: "Interesting.", action: () => { isUserInteracting = false; } }
            ]);
        }
    }

    // --- Resource Interaction ---
    else if (userData.type === 'resource') {
        addToInventory(userData.name, 1);
        showFeedback(`Collected ${userData.name}`);

        // Quest advancement checks after collecting resources
        if (currentQuest?.id === 'ureaCycle') {
            if (currentQuest.state === QUEST_STATE.STEP_1_GATHER_MITO && hasItems({ 'NH3': 1, 'HCO3': 1, 'ATP': 2 })) {
                advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_2_MAKE_CARB_PHOS);
                showFeedback("Materials gathered! Head to CPS1.");
            }
            else if (currentQuest.state === QUEST_STATE.STEP_6_GATHER_CYTO && hasItems({ 'Citrulline': 1, 'Aspartate': 1, 'ATP': 1 })) {
                advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_7_MAKE_ARGSUCC);
                showFeedback("Cytosol materials gathered! Head to ASS.");
            }
            else if (currentQuest.state === QUEST_STATE.STEP_8_CLEAVE_ARGSUCC && (userData.name === 'Arginine' || userData.name === 'Fumarate')) {
                // Provide feedback upon collecting Arginine/Fumarate
                if (hasItems({'Arginine': 1}) && hasItems({'Fumarate': 1})) {
                    showFeedback("Arginine and Fumarate collected!");
                    // Note: Quest advances to STEP_8B via ASL station, not collection.
                } else if (hasItems({'Arginine': 1})) {
                     showFeedback("Arginine collected. Still need Fumarate.");
                } else if (hasItems({'Fumarate': 1})) {
                     showFeedback("Fumarate collected. Still need Arginine.");
                }
             }
        }

        // Remove the collected resource from the scene and tracking arrays
        scene.remove(userData.object3D);
        const i_obj = interactiveObjects.indexOf(object); if (i_obj > -1) interactiveObjects.splice(i_obj, 1);
        const m_mesh = resourceMeshes.indexOf(object); if (m_mesh > -1) resourceMeshes.splice(m_mesh, 1);
        originalMaterials.delete(object); // Clean up original material map

        // If the collected object was the closest one, clear the prompt
        if (closestInteractiveObject === object) {
            closestInteractiveObject = null;
            lastClosestObject = null; // Prevent potential unhighlight flicker
            hideInteractionPrompt();
        }
        // No need to set isUserInteracting as collecting is instant
    }

    // --- Station Interaction ---
    else if (userData.type === 'station') {
        if (!currentQuest || currentQuest.id !== 'ureaCycle') {
            showFeedback("Quest not active."); return;
        }
        if (currentQuest.state !== userData.requiredQuestState) {
            showFeedback(`Incorrect step for ${userData.name}. Objective: ${currentQuest.objectives[currentQuest.state]}`); return;
        }
        if (hasItems(userData.requires)) {
            // Consume required items
            let consumed = true;
            for (const item in userData.requires) {
                if (!removeFromInventory(item, userData.requires[item])) {
                    consumed = false;
                    console.error("Inventory error removing required item:", item);
                    showFeedback("Inventory error!", 2000); break;
                }
            }

            if (consumed) {
                showFeedback(`Using ${userData.name}...`);
                let prods = []; // Array to hold product names
                if (typeof userData.produces === 'string') {
                    prods = [userData.produces];
                } else if (Array.isArray(userData.produces)) {
                    prods = userData.produces;
                }

                // Determine spawn location relative to the station
                const stationObject = object;
                const offset = new THREE.Vector3(0, 0, 1.5); // Base offset in front
                const rotation = new THREE.Quaternion();
                stationObject.getWorldQuaternion(rotation);
                offset.applyQuaternion(rotation); // Rotate offset based on station rotation
                const basePosition = stationObject.position.clone();
                let spawnBasePosition = basePosition.add(offset);
                spawnBasePosition.y = 0.6; // Set spawn height

                // Spawn products
                prods.forEach((itemName, index) => {
                    const colorHex = userData.productColors?.[itemName] || 0xffffff; // Get color or default white
                    const finalSpawnPos = spawnBasePosition.clone();
                    // Add spread for multiple products
                    const spreadOffset = new THREE.Vector3((index - (prods.length - 1) / 2) * 0.6, 0, 0);
                    spreadOffset.applyQuaternion(rotation); // Rotate spread offset too
                    finalSpawnPos.add(spreadOffset);

                    // Ensure spawn position is within bounds (simple clamp)
                    finalSpawnPos.x = THREE.MathUtils.clamp(finalSpawnPos.x, MIN_X + 0.5, MAX_X - 0.5);
                    finalSpawnPos.z = THREE.MathUtils.clamp(finalSpawnPos.z, MIN_Z + 0.5, MAX_Z - 0.5);

                    createResource(itemName, { x: finalSpawnPos.x, z: finalSpawnPos.z }, colorHex, { initialY: finalSpawnPos.y });
                    showFeedback(`${itemName} appeared! (Collectable)`);
                });

                // Advance the quest state AFTER producing items
                if (userData.advancesQuestTo) {
                    advanceQuest(ureaCycleQuest, userData.advancesQuestTo);
                }
                // Station interaction is usually instant, no need to keep isUserInteracting = true
            }
        } else {
            // Report missing items
            let missing = "Missing: ";
            let first = true;
            for (const item in userData.requires) {
                const required = userData.requires[item];
                const current = inventory[item] || 0;
                if (current < required) {
                    missing += `${first ? '' : ', '}${required - current} ${item}`;
                    first = false;
                }
            }
            showFeedback(missing);
        }
    }

    // --- Portal Interaction ---
    else if (userData.type === 'portal' && userData.name === 'ORN T1 Portal') {
        if (!currentQuest || currentQuest.id !== 'ureaCycle') { showFeedback("Quest not active."); return; }
        if (currentQuest.state !== QUEST_STATE.STEP_5A_OPEN_PORTAL) { showFeedback(`Portal cannot be used yet.`); return; }
        if (!hasPortalPermission) { showFeedback("You don't have permission to activate this portal yet. Talk to the Usher."); return; }
        if (!hasItems(userData.requires)) { showFeedback("Missing: Citrulline"); return; }

        // Consume Citrulline
        if (!removeFromInventory('Citrulline', 1)) {
             console.error("Failed to remove Citrulline for portal!");
             showFeedback("Error using portal!", 2000); return;
        }

        showFeedback("Activating ORN T1 Portal...");
        removePortalBarrier(); // Remove the visual/collision barrier

        // Optional: Visual effect for portal activation
        const portalMesh = object;
        if (originalMaterials.has(portalMesh)) {
            const originalMat = originalMaterials.get(portalMesh);
            if (originalMat && originalMat.emissive) { // Check if material has emissive property
                const originalEmissive = originalMat.emissive.getHex(); // Store original color
                portalMesh.material.emissive.setHex(0xffffff); // Flash white
                setTimeout(() => {
                    // Restore original emissive color after flash
                    if (portalMesh?.material && originalMaterials.has(portalMesh)) { // Check again if mesh/material still exist
                        const currentOriginalMat = originalMaterials.get(portalMesh);
                        if(currentOriginalMat?.emissive) {
                            portalMesh.material.emissive.setHex(currentOriginalMat.emissive.getHex());
                        }
                    }
                }, 200); // Flash duration
            }
        }

        // Spawn transported Citrulline on the CYTOSOL side
        const spawnPosition = { x: portalMesh.position.x + 1.5, z: portalMesh.position.z }; // Offset slightly into cytosol
        const spawnColor = userData.productColor || citrullineColor;
        // Clamp spawn position to be safely within bounds
        spawnPosition.x = THREE.MathUtils.clamp(spawnPosition.x, MIN_X + 0.5, MAX_X - 0.5);
        spawnPosition.z = THREE.MathUtils.clamp(spawnPosition.z, MIN_Z + 0.5, MAX_Z - 0.5);
        createResource('Citrulline', spawnPosition, spawnColor, {initialY: 0.6});
        showFeedback("Citrulline transported! Collect it in the Cytosol.");

        // Advance quest state
        if (userData.advancesQuestTo === QUEST_STATE.STEP_6_GATHER_CYTO) {
             advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_6_GATHER_CYTO);
        } else {
             // Log warning if quest state mismatch
             console.warn(`Portal advancement state mismatch! Expected ${QUEST_STATE.STEP_6_GATHER_CYTO}, but got ${userData.advancesQuestTo}`);
        }
        // Portal interaction is instant
    }

    // --- Waste Bucket Interaction ---
    else if (userData.type === 'wasteBucket') {
        if (!currentQuest || currentQuest.id !== 'ureaCycle') { showFeedback("Nothing to dispose right now."); return; }
        if (currentQuest.state !== QUEST_STATE.STEP_9B_DISPOSE_UREA) { showFeedback("No need to use this yet."); return; }
        if (!hasItems({ 'Urea': 1 })) { showFeedback("You need Urea to dispose of."); return; }

        if (removeFromInventory('Urea', 1)) {
            showFeedback("Urea safely disposed!");
            advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_10_RIVER_CHALLENGE); // Advance to final challenge
        } else {
            console.error("Failed to remove Urea for disposal!");
            showFeedback("Error disposing Urea.", 2000);
        }
        // Waste disposal is instant
    }

    // --- Krebs Furnace Interaction ---
    else if (userData.type === 'krebsFurnace') {
        if (!currentQuest || currentQuest.id !== 'ureaCycle') { showFeedback("The furnace slumbers."); return; }
        if (currentQuest.state !== QUEST_STATE.STEP_8B_FURNACE_FUMARATE) { showFeedback("You don't need to use the furnace right now."); return; }
        if (hasItems({ 'Fumarate': 1 })) {
            if (removeFromInventory('Fumarate', 1)) {
                showFeedback("Fumarate fed to the Krebs Cycle Furnace!");

                // Optional: Visual effect for furnace
                const furnaceGroup = object;
                const fireboxMesh = furnaceGroup.children.find(c => c.material?.emissive && c.material.color.getHex() === 0xff4500);
                if (fireboxMesh && originalMaterials.has(fireboxMesh)) {
                     const originalMat = originalMaterials.get(fireboxMesh);
                     fireboxMesh.material.emissive.setHex(0xffaa00); // Brighter flash
                     fireboxMesh.material.emissiveIntensity = 1.5;
                     setTimeout(() => {
                         if (fireboxMesh?.material && originalMaterials.has(fireboxMesh)) {
                            const currentOrigMat = originalMaterials.get(fireboxMesh);
                             fireboxMesh.material.emissive.setHex(currentOrigMat.emissive.getHex());
                             fireboxMesh.material.emissiveIntensity = currentOrigMat.emissiveIntensity;
                         }
                     }, 300); // Effect duration
                } else { console.warn("Could not find firebox mesh or its original material for effect."); }

                advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_9_MAKE_UREA); // Advance quest
            } else {
                console.error("Failed to remove Fumarate from inventory for furnace!");
                showFeedback("Inventory error disposing Fumarate.", 2000);
            }
        } else {
            showFeedback("You need Fumarate to feed the furnace.");
        }
        // Furnace interaction is instant
    }

    // Reset interaction flag ONLY if a UI element didn't take control
    if (isUserInteracting && dialogueBox.classList.contains('hidden') && realityRiverUI.classList.contains('hidden')) {
         isUserInteracting = false;
     }
} // End interactWithObject


// --- Event Listeners ---
document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    keysPressed[key] = true;
    // Trigger interaction on 'E' press if an object is close and not already interacting via UI
    if (key === 'e' && closestInteractiveObject && !isUserInteracting) {
        interactWithObject(closestInteractiveObject);
    }
});
document.addEventListener('keyup', (event) => {
    keysPressed[event.key.toLowerCase()] = false;
});
window.addEventListener('resize', () => {
    // Update camera aspect ratio and renderer size on window resize
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});


// --- Animation Loop ---
const clock = new THREE.Clock();
const cameraIdealOffset = new THREE.Vector3(0, 10, -12); // Adjusted camera distance/height
const cameraIdealLookAt = new THREE.Vector3(0, 1.5, 0); // Look slightly above player feet
const cameraPositionSmoothFactor = 0.08; // How quickly camera position catches up
const cameraTargetSmoothFactor = 0.1; // How quickly camera lookAt catches up
const playerWorldPos = new THREE.Vector3(); // To store player's world position
const cameraTargetPos = new THREE.Vector3(); // Ideal camera position calculation
const cameraTargetLookAt = new THREE.Vector3(); // Ideal camera lookAt calculation
const cameraForward = new THREE.Vector3(); // For movement direction relative to camera
const cameraRight = new THREE.Vector3(); // For movement direction relative to camera
const moveDirection = new THREE.Vector3(); // Combined movement direction
const playerVelocity = new THREE.Vector3(); // Player's movement vector for the frame
const targetQuaternion = new THREE.Quaternion(); // For smooth player rotation
const upVector = new THREE.Vector3(0, 1, 0); // World up direction

function checkCollision(nextPos) {
    // Create a bounding box for the player's potential next position
    const playerHeightOffset = new Vector3(0, playerHeight / 2, 0); // Center the box vertically
    const playerSize = new Vector3(playerRadius * 2, playerHeight, playerRadius * 2);
    playerBoundingBox.setFromCenterAndSize(nextPos.clone().add(playerHeightOffset), playerSize);

    // Check for intersection with any wall bounding box
    for (const wallBox of wallBoundingBoxes) {
        if (playerBoundingBox.intersectsBox(wallBox)) {
            // Optional: Log which wall is hit for debugging
            // const wall = collidableWalls[wallBoundingBoxes.indexOf(wallBox)];
            // console.log("Collision with:", wall?.name);
             return true; // Collision detected
        }
    }
    return false; // No collision
}

function highlightObject(object) {
    if (!object) return;
    let meshToHighlight = null;
    // Find a suitable mesh within the object (Group or Mesh)
    if (object instanceof THREE.Group) {
        // Prioritize specific named parts or geometry types if available
        meshToHighlight = object.children.find(child => child instanceof THREE.Mesh && child.name === 'body');
         if (!meshToHighlight) meshToHighlight = object.children.find(child => child instanceof THREE.Mesh && child.name === 'coat');
         if (!meshToHighlight) meshToHighlight = object.children.find(child => child instanceof THREE.Mesh && child.geometry instanceof THREE.BoxGeometry); // Generic box
        if (!meshToHighlight) meshToHighlight = object.children.find(child => child instanceof THREE.Mesh && child.material); // Any mesh with material
    } else if (object instanceof THREE.Mesh) {
        meshToHighlight = object; // If it's already a mesh
    }

    if (meshToHighlight?.material) {
         // Store original material if not already stored
         if (!originalMaterials.has(meshToHighlight)) {
             if (meshToHighlight.material.emissive !== undefined) { // Only store if it has emissive
                 originalMaterials.set(meshToHighlight, meshToHighlight.material.clone());
             }
        }
         // Apply highlight effect (only if material has emissive property)
         if (meshToHighlight.material.emissive !== undefined) {
             meshToHighlight.material.emissive.copy(highlightMaterial.emissive);
             meshToHighlight.material.emissiveIntensity = highlightMaterial.emissiveIntensity;
             meshToHighlight.material.needsUpdate = true; // Ensure material update
         }
    }
}

function unhighlightObject(object) {
    if (!object) return;
    let meshToUnhighlight = null;
    // Find the mesh that might have been highlighted
     if (object instanceof THREE.Group) {
         // Find the child mesh that has an entry in originalMaterials
         meshToUnhighlight = object.children.find(child => child instanceof THREE.Mesh && originalMaterials.has(child));
    } else if (object instanceof THREE.Mesh) {
        if (originalMaterials.has(object)) {
             meshToUnhighlight = object; // If the mesh itself was stored
        }
    }

    // Restore the original material properties if found
    if (meshToUnhighlight && originalMaterials.has(meshToUnhighlight)) {
        const originalMat = originalMaterials.get(meshToUnhighlight);
        if (meshToUnhighlight.material.emissive !== undefined && originalMat.emissive !== undefined) {
            meshToUnhighlight.material.emissive.copy(originalMat.emissive);
            meshToUnhighlight.material.emissiveIntensity = originalMat.emissiveIntensity;
            meshToUnhighlight.material.needsUpdate = true;
        }
        // Don't remove from originalMaterials map here, might need it again if player moves away/back
    }
}


function animate() {
    requestAnimationFrame(animate); // Loop the animation
    const delta = Math.min(clock.getDelta(), 0.1); // Get time difference, cap delta to prevent large jumps
    const elapsedTime = clock.elapsedTime; // Total elapsed time

    // 1. Player Movement Input & Calculation
    let moveZ = 0; let moveX = 0;
    if (!isUserInteracting) { // Only allow movement if not in UI interaction
        if (keysPressed['w'] || keysPressed['arrowup']) moveZ = 1;
        if (keysPressed['s'] || keysPressed['arrowdown']) moveZ = -1;
        if (keysPressed['a'] || keysPressed['arrowleft']) moveX = 1;
        if (keysPressed['d'] || keysPressed['arrowright']) moveX = -1;
    }

    playerVelocity.set(0, 0, 0); // Reset velocity
    moveDirection.set(0, 0, 0); // Reset move direction
    const playerIsMoving = moveX !== 0 || moveZ !== 0;

    if (playerIsMoving) {
        // Get camera direction (ignore Y component for ground movement)
        camera.getWorldDirection(cameraForward);
        cameraForward.y = 0;
        cameraForward.normalize();

        // Calculate right direction based on camera forward and world up
        cameraRight.crossVectors(upVector, cameraForward).normalize();

        // Combine movement inputs based on camera orientation
        moveDirection.addScaledVector(cameraForward, moveZ).addScaledVector(cameraRight, moveX).normalize();

        // Calculate velocity for this frame
        playerVelocity.copy(moveDirection).multiplyScalar(playerSpeed * delta);

        // 2. Collision Detection & Resolution
        const currentPos = player.position.clone();

        // Check X movement separately
        const nextPosX = currentPos.clone().add(new THREE.Vector3(playerVelocity.x, 0, 0));
        if (!checkCollision(nextPosX)) {
            player.position.x = nextPosX.x; // Apply X movement if no collision
        } else {
            playerVelocity.x = 0; // Stop X movement on collision
        }

        // Check Z movement separately (using potentially updated X position)
        const nextPosZ = player.position.clone().add(new THREE.Vector3(0, 0, playerVelocity.z));
         if (!checkCollision(nextPosZ)) {
            player.position.z = nextPosZ.z; // Apply Z movement if no collision
        } else {
            playerVelocity.z = 0; // Stop Z movement on collision
        }

        // 3. Player Rotation
        if (moveDirection.lengthSq() > 0.001) { // Only rotate if moving significantly
            // Calculate target rotation based on movement direction
            targetQuaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), moveDirection); // Point Z axis along move direction
            // Smoothly interpolate player's current rotation towards the target
            player.quaternion.slerp(targetQuaternion, 0.2); // Adjust slerp factor for rotation speed
        }
    }

    // 4. Portal Crossing Check
    if (!portalBarrier) { // Only check if barrier is down (portal activated)
        const currentX = player.position.x;
        const prevLocation = playerLocation; // Store location before check

        // Check if player crossed the dividing wall into Cytosol
        if (currentX > DIVIDING_WALL_X + playerRadius && prevLocation === 'mitochondria') { // Add buffer to prevent triggering exactly on the line
            playerLocation = 'cytosol';
            showFeedback("You are entering the Cytosol", 3000);
            console.log("Player crossed into Cytosol");
        }
        // Check if player crossed back into Mitochondria
        else if (currentX < DIVIDING_WALL_X - playerRadius && prevLocation === 'cytosol') { // Add buffer
            playerLocation = 'mitochondria';
            showFeedback("You are entering the Mitochondria", 3000);
            console.log("Player crossed into Mitochondria");
        }
    }

    // 5. Proximity Check for Interaction Prompt
    if (!isUserInteracting) {
        let minDistSq = interactionRadius * interactionRadius;
        let foundClosest = null;
        player.getWorldPosition(playerWorldPos); // Get player's current world position

        // Iterate through interactable objects
        interactiveObjects.forEach(obj => {
            // Ensure object exists, is visible, and part of the scene
            if (obj?.parent === scene && obj.visible) {
                let objPos = new Vector3();
                obj.getWorldPosition(objPos); // Get object's world position

                const distSq = playerWorldPos.distanceToSquared(objPos);
                if (distSq < minDistSq) { // If this object is closer than the current closest
                    minDistSq = distSq;
                    foundClosest = obj;
                }
            }
        });

        // Handle highlighting/unhighlighting and showing/hiding prompt
        if (foundClosest !== closestInteractiveObject) { // If the closest object changed
            if (closestInteractiveObject) {
                unhighlightObject(closestInteractiveObject); // Unhighlight the old one
            }
            if (foundClosest) {
                highlightObject(foundClosest); // Highlight the new one
                showInteractionPrompt(foundClosest.userData.name || 'Object'); // Show prompt
            } else {
                hideInteractionPrompt(); // Hide prompt if no object is close
            }
            lastClosestObject = closestInteractiveObject; // Store the previously closest object
            closestInteractiveObject = foundClosest; // Update the currently closest object
        }
    } else { // If player is interacting with UI
        // Ensure no object remains highlighted and prompt is hidden
        if (closestInteractiveObject) {
             unhighlightObject(closestInteractiveObject);
             closestInteractiveObject = null;
        }
         if (lastClosestObject) { // Also unhighlight the last object to be safe
             unhighlightObject(lastClosestObject);
             lastClosestObject = null;
         }
        hideInteractionPrompt();
    }

    // 6. Resource Hover Animation
    const hoverSpeed = 2; const hoverAmount = 0.2;
    resourceMeshes.forEach((resource, index) => {
        if (resource?.parent === scene && resource.userData?.initialY !== undefined) {
            // Calculate vertical hover position using sine wave based on time and index
            const yPos = resource.userData.initialY + Math.sin(elapsedTime * hoverSpeed + index * 0.5) * hoverAmount;
            if (!isNaN(yPos)) { // Basic check for valid number
                resource.position.y = yPos;
            }
        }
    });

    // 7. Camera Logic
    player.getWorldPosition(playerWorldPos); // Get player position again (might have moved)
    // Calculate ideal camera position based on offset, player rotation, and position
    cameraTargetPos.copy(cameraIdealOffset).applyQuaternion(player.quaternion).add(playerWorldPos);
    // Calculate ideal look-at point (slightly above player's feet)
    cameraTargetLookAt.copy(playerWorldPos).add(cameraIdealLookAt);

    if (!isUserInteracting) {
        // Smoothly interpolate camera position and target look-at point
        camera.position.lerp(cameraTargetPos, cameraPositionSmoothFactor);
        controls.target.lerp(cameraTargetLookAt, cameraTargetSmoothFactor);
    } else {
        // If interacting, snap controls target immediately to prevent drift during UI
        controls.target.copy(cameraTargetLookAt);
    }
    controls.update(delta); // Update OrbitControls (handles damping)

    // 8. Render the Scene
    renderer.render(scene, camera);
}

// --- Initial Setup Calls ---
updateInventoryUI(); // Populate inventory UI initially
updateQuestUI(); // Set initial quest display

// Set initial camera position and look-at based on player start
player.getWorldPosition(playerWorldPos);
const initialCamPos = cameraIdealOffset.clone().applyQuaternion(player.quaternion).add(playerWorldPos);
const initialLookAt = playerWorldPos.clone().add(cameraIdealLookAt);
camera.position.copy(initialCamPos);
controls.target.copy(initialLookAt);
camera.lookAt(controls.target); // Point camera at the target initially
controls.update(); // Update controls state after setting position/target

loadingScreen.classList.add('hidden'); // Hide loading screen
animate(); // Start the animation loop

console.log("Metabolon RPG Initialized (v25 - Added ATP, Restored Mito Walls, Embedded Furnace).");
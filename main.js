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

// --- Ground & Zones ---
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x555577, metalness: 0.1, roughness: 0.8 });
const groundGeometry = new THREE.PlaneGeometry(50, 50);
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

const mitoMaterial = new THREE.MeshStandardMaterial({ color: 0x886666, metalness: 0.1, roughness: 0.8 });
const mitoGeometry = new THREE.PlaneGeometry(18, 18);
const mitochondriaZone = new THREE.Mesh(mitoGeometry, mitoMaterial);
mitochondriaZone.rotation.x = -Math.PI / 2; mitochondriaZone.position.set(-12, 0.01, -6);
mitochondriaZone.receiveShadow = true; scene.add(mitochondriaZone);

// --- OrbitControls (Used mainly for damping/smoothing, user input disabled) ---
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
player.position.set(-10, 0, -4); // START IN MITOCHONDRIA
scene.add(player);

// Humanoid Model Parts
const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x0099ff, roughness: 0.6, metalness: 0.2 });
const headHeight = 0.4; const bodyHeight = 0.8; const limbRadius = 0.1;
const armLength = 0.6; const legHeight = 0.7;
const head = new THREE.Mesh(new THREE.SphereGeometry(headHeight / 2, 16, 12), bodyMaterial);
head.position.y = legHeight + bodyHeight + headHeight / 2; head.castShadow = true; player.add(head);
const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, bodyHeight, 0.3), bodyMaterial);
body.position.y = legHeight + bodyHeight / 2; body.castShadow = true; player.add(body);
const limbMaterial = new THREE.MeshStandardMaterial({ color: 0x0077cc, roughness: 0.7 });
const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(limbRadius, limbRadius, armLength), limbMaterial);
leftArm.position.set(-0.35, legHeight + bodyHeight * 0.7, 0); leftArm.rotation.z = Math.PI / 8; leftArm.castShadow = true; player.add(leftArm);
const rightArm = leftArm.clone(); rightArm.position.x = 0.35; rightArm.rotation.z = -Math.PI / 8; player.add(rightArm);
const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(limbRadius * 1.2, limbRadius * 1.1, legHeight), limbMaterial);
leftLeg.position.set(-0.15, legHeight / 2, 0); leftLeg.castShadow = true; player.add(leftLeg);
const rightLeg = leftLeg.clone(); rightLeg.position.x = 0.15; player.add(rightLeg);
const playerHeight = legHeight + bodyHeight + headHeight;

const keysPressed = {};

// --- Maze Walls & Collision ---
const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.2, roughness: 0.9 });
const wallHeight = 1.5; // MODIFIED: Reduced wall height by 50%
const portalGapWidth = 3.0;
const portalWallX = -3.5;
const portalWallCenterZ = -6;
const portalWallLength = 18;

function createWall(position, size, rotationY = 0, name = "Wall") {
    const wallGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    // Position Y depends on the new wallHeight
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

// Wall Layout (Uses the new wallHeight)
createWall({ x: 6, y: 0, z: 12 }, { x: 17, y: wallHeight, z: 0.5 }, 0, "H_Top"); // Y pos handled in function
createWall({ x: -2.5, y: 0, z: 6 }, { x: 0.5, y: wallHeight, z: 12 }, 0, "V_Left_Cytosol");
createWall({ x: 14.5, y: 0, z: 4 }, { x: 0.5, y: wallHeight, z: 16 }, 0, "V_Right_Cytosol");
createWall({ x: 6, y: 0, z: -3 }, { x: 12, y: wallHeight, z: 0.5 }, 0, "H_Bottom_Cytosol");
createWall({ x: -18, y: 0, z: -6 }, { x: 0.5, y: wallHeight, z: 18 }, 0, "V_Mito_Boundary_L");
createWall({ x: -10.75, y: 0, z: 3 }, { x: 14.5, y: wallHeight, z: 0.5 }, 0, "H_Mito_Boundary_Top");
createWall({ x: -10.75, y: 0, z: -15 }, { x: 14.5, y: wallHeight, z: 0.5 }, 0, "H_Mito_Boundary_Bottom");
createWall({ x: -11.5, y: 0, z: -2.5 }, { x: 10, y: wallHeight, z: 0.5 }, 0, "H_Mito_Internal_1");
createWall({ x: -11.5, y: 0, z: -8 }, { x: 10, y: wallHeight, z: 0.5 }, 0, "H_Mito_Internal_2");
// Split Wall for Portal Gap (Uses the new wallHeight)
const wallStartZ = portalWallCenterZ - portalWallLength / 2; const wallEndZ = portalWallCenterZ + portalWallLength / 2;
const gapStartZ = portalWallCenterZ - portalGapWidth / 2; const gapEndZ = portalWallCenterZ + portalGapWidth / 2;
const wall1Length = gapStartZ - wallStartZ; const wall1CenterZ = wallStartZ + wall1Length / 2;
if (wall1Length > 0.1) { createWall({ x: portalWallX, y: 0, z: wall1CenterZ }, { x: 0.5, y: wallHeight, z: wall1Length }, 0, "V_Mito_Boundary_R_Bottom"); }
const wall2Length = wallEndZ - gapEndZ; const wall2CenterZ = gapEndZ + wall2Length / 2;
if (wall2Length > 0.1) { createWall({ x: portalWallX, y: 0, z: wall2CenterZ }, { x: 0.5, y: wallHeight, z: wall2Length }, 0, "V_Mito_Boundary_R_Top"); }

// Add cabinet near the wall
const cabinetMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 });
const cabinetGeometry = new THREE.BoxGeometry(1, 1.5, 1.5);
const cabinet = new THREE.Mesh(cabinetGeometry, cabinetMaterial);
cabinet.position.set(-14.5, 0.75, -1); scene.add(cabinet); cabinet.castShadow = true; cabinet.receiveShadow = true;
// MODIFIED: Smaller label scale
const cabinetLabel = createTextSprite("Kitchen Cabinet", { x: cabinet.position.x, y: cabinet.position.y + 1.2, z: cabinet.position.z }, { fontSize: 24, scale: 0.5 }); // Smaller scale
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
    STEP_8B_FURNACE_FUMARATE: 'STEP_8B_FURNACE_FUMARATE', // <-- NEW STATE
    STEP_9_MAKE_UREA: 'STEP_9_MAKE_UREA',
    STEP_9B_DISPOSE_UREA: 'STEP_9B_DISPOSE_UREA',
    STEP_10_RIVER_CHALLENGE: 'STEP_10_RIVER_CHALLENGE',
    COMPLETED: 'COMPLETED'
};
// Update cytosolStates if needed (though it's probably fine as is)
const cytosolStates = [
    QUEST_STATE.STEP_6_GATHER_CYTO, QUEST_STATE.STEP_7_MAKE_ARGSUCC,
    QUEST_STATE.STEP_8_CLEAVE_ARGSUCC, QUEST_STATE.STEP_8B_FURNACE_FUMARATE,
    QUEST_STATE.STEP_9_MAKE_UREA, QUEST_STATE.STEP_9B_DISPOSE_UREA,
    QUEST_STATE.STEP_10_RIVER_CHALLENGE
];
let inventory = {}; let currentQuest = null;
let hasPortalPermission = false; // Flag for portal access
let playerLocation = 'mitochondria'; // NEW: Track player location relative to portal

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
        [QUEST_STATE.STEP_8_CLEAVE_ARGSUCC]: "Use ASL Station to cleave Argininosuccinate into Arginine and Fumarate. Collect both.", // Updated objective
        [QUEST_STATE.STEP_8B_FURNACE_FUMARATE]: "Gather the Arginine and Fumarate. Then, feed the Fumarate to the Krebs Cycle Furnace.", // <-- NEW OBJECTIVE
        [QUEST_STATE.STEP_9_MAKE_UREA]: "Use ARG1 Station with Arginine to make Urea and Ornithine.", // Adjusted for clarity
        [QUEST_STATE.STEP_9B_DISPOSE_UREA]: "Dispose of the toxic Urea in the Waste Receptacle.",
        [QUEST_STATE.STEP_10_RIVER_CHALLENGE]: "Return to Professor Hepaticus and pass the Reality River challenge.",
        [QUEST_STATE.COMPLETED]: "Quest complete! You've mastered the Urea Cycle!"
    }, rewards: { knowledgePoints: 100 }
};
const ureaRiverQuestions = [ { q: "Where does the Urea Cycle BEGIN?", a: ["Cytosol", "Mitochondria", "Nucleus", "ER"], correct: 1 }, { q: "Which enzyme combines NH3, HCO3, and ATP?", a: ["OTC", "CPS1", "ASS", "Arginase"], correct: 1 }, { q: "Which molecule carries N into the cycle in cytosol?", a: ["Glutamate", "Ornithine", "Aspartate", "Citrulline"], correct: 2 }, { q: "Which molecule is transported OUT of mitochondria?", a: ["Ornithine", "Carbamoyl Phosphate", "Citrulline", "Urea"], correct: 2 }, { q: "What toxic molecule is the primary input?", a: ["Urea", "Ammonia (NH3/NH4+)", "Fumarate", "ATP"], correct: 1 }, { q: "What molecule is REGENERATED in cytosol?", a: ["Arginine", "Ornithine", "Aspartate", "Urea"], correct: 1 } ];
let currentRiverQuestionIndex = 0; let riverCorrectAnswers = 0;

// --- Text Sprite Function ---
// Note: Font size and scale are handled where this function is *called*
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
    // MODIFIED: Smaller label scale
    const label = createTextSprite(name, { x: position.x, y: 2.5, z: position.z }, { fontSize: 36, scale: 0.75 }); // Smaller scale
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
    // MODIFIED: Smaller label scale
    const label = createTextSprite("Professor Hepaticus", { x: position.x, y: position.y + 2.0, z: position.z }, { fontSize: 36, scale: 0.75 }); // Smaller scale
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
    // MODIFIED: Smaller label scale
    const label = createTextSprite("Waste Receptacle", { x: position.x, y: position.y + 1.2, z: position.z }, { fontSize: 30, scale: 0.6 }); // Smaller scale
    scene.add(label);
    return bucketGroup;
}

// --- Create Krebs Furnace Object ---
function createKrebsFurnace(position) {
    const furnaceGroup = new THREE.Group();
    furnaceGroup.position.copy(position);

    // Base
    const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 });
    const baseGeometry = new THREE.BoxGeometry(1.2, 1.5, 1.2);
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.75;
    base.castShadow = true;
    base.receiveShadow = true;
    furnaceGroup.add(base);

    // Opening/Firebox
    const fireMaterial = new THREE.MeshStandardMaterial({
        color: 0xff4500, // Orange-red
        emissive: 0xdd3300,
        emissiveIntensity: 0.8,
        roughness: 0.6
    });
    const fireGeometry = new THREE.BoxGeometry(0.8, 0.6, 0.2);
    const firebox = new THREE.Mesh(fireGeometry, fireMaterial);
    firebox.position.set(0, 0.5, 0.51); // Positioned at the front face, slightly lower part
    furnaceGroup.add(firebox);

    // Chimney (Optional)
    const chimneyGeometry = new THREE.CylinderGeometry(0.2, 0.15, 0.8);
    const chimney = new THREE.Mesh(chimneyGeometry, baseMaterial);
    chimney.position.y = 1.5 + 0.4; // On top of the base
    furnaceGroup.add(chimney);

    furnaceGroup.userData = { type: 'krebsFurnace', name: 'Krebs Cycle Furnace' };
    scene.add(furnaceGroup);
    interactiveObjects.push(furnaceGroup); // Make it interactive
    originalMaterials.set(furnaceGroup, baseMaterial.clone()); // Store base material for group highlighting
    originalMaterials.set(firebox, fireMaterial.clone()); // Store firebox material for effect reversion

    // MODIFIED: Smaller label scale
    const label = createTextSprite("Krebs Cycle Furnace", { x: position.x, y: position.y + 2.4, z: position.z }, { fontSize: 30, scale: 0.6 }); // Smaller scale
    scene.add(label);

    return furnaceGroup;
}


// --- Create Game World Entities ---
const professorHepaticus = createProfessorHepaticus(new THREE.Vector3(-4.5, 0, -1));
const usherMaterial = new THREE.MeshStandardMaterial({ color: 0x8a2be2 }); const usherGeometry = new THREE.CapsuleGeometry(0.4, 1.0, 4, 8); const ornithineUsher = new THREE.Mesh(usherGeometry, usherMaterial); ornithineUsher.position.set(-4.5, 0.7, -4); ornithineUsher.castShadow = true; ornithineUsher.userData = { type: 'npc', name: 'Ornithine Usher' }; scene.add(ornithineUsher); interactiveObjects.push(ornithineUsher); originalMaterials.set(ornithineUsher, usherMaterial.clone());
// MODIFIED: Smaller label scale
const usherLabel = createTextSprite("Ornithine Usher", { x: -4.5, y: 2.2, z: -4 }, { fontSize: 36, scale: 0.75 }); // Smaller scale
scene.add(usherLabel);
const carbPhosColor = 0xff3333; const citrullineColor = 0xff8c00; const argSuccColor = 0x33ff33; const arginineColor = 0x6666ff; const ureaColor = 0xdddddd; const ornithineColor = 0xaaccaa; const fumarateColor = 0xcccccc;
// --- MITOCHONDRIA ---
createStation("CPS1", { x: -15, z: -10 }, 0xff0000, { requires: { 'NH3': 1, 'HCO3': 1, 'ATP': 2 }, produces: 'Carbamoyl Phosphate', productColors: { 'Carbamoyl Phosphate': carbPhosColor }, requiredQuestState: QUEST_STATE.STEP_2_MAKE_CARB_PHOS, advancesQuestTo: QUEST_STATE.STEP_3_MEET_USHER });
createStation("OTC", { x: -11, z: -10 }, 0xff4500, { requires: { 'Carbamoyl Phosphate': 1, 'Ornithine': 1 }, produces: 'Citrulline', productColors: { 'Citrulline': citrullineColor }, requiredQuestState: QUEST_STATE.STEP_4_MAKE_CITRULLINE, advancesQuestTo: QUEST_STATE.STEP_4_MAKE_CITRULLINE });
createResource('NH3', { x: -16.5, z: -4 }, 0xffaaaa);
createResource('ATP', { x: -10, z: -13 }, 0xffffaa);
createResource('ATP', { x: -16, z: -13 }, 0xffffaa);

// --- CYTOSOL (MODIFIED POSITIONS for spacing) ---
createStation("ASS", { x: 4, z: 2 }, 0x00ff00, { requires: { 'Citrulline': 1, 'Aspartate': 1, 'ATP': 1 }, produces: 'Argininosuccinate', productColors: { 'Argininosuccinate': argSuccColor }, requiredQuestState: QUEST_STATE.STEP_7_MAKE_ARGSUCC, advancesQuestTo: QUEST_STATE.STEP_8_CLEAVE_ARGSUCC });
createStation("ASL", { x: 8, z: 6 }, 0x00ced1, { requires: { 'Argininosuccinate': 1 }, produces: ['Arginine', 'Fumarate'], productColors: { 'Arginine': arginineColor, 'Fumarate': fumarateColor }, requiredQuestState: QUEST_STATE.STEP_8_CLEAVE_ARGSUCC, advancesQuestTo: QUEST_STATE.STEP_8B_FURNACE_FUMARATE });
createStation("ARG1", { x: 12, z: 0 }, 0x0000ff, { requires: { 'Arginine': 1 }, produces: ['Urea', 'Ornithine'], productColors: { 'Urea': ureaColor, 'Ornithine': ornithineColor }, requiredQuestState: QUEST_STATE.STEP_9_MAKE_UREA, advancesQuestTo: QUEST_STATE.STEP_9B_DISPOSE_UREA });
createResource('Aspartate', { x: 3, z: -1 }, 0xffaaff); // Slightly moved
createResource('ATP', { x: 0, z: 0 }, 0xffffaa); // ATP in cytosol
const wasteBucket = createWasteBucket(new THREE.Vector3(10, 0, -2)); // Moved
const krebsFurnace = createKrebsFurnace(new THREE.Vector3(9, 0, 9)); // Moved

// --- ORN T1 Portal ---
const portalGeometry = new THREE.TorusGeometry(1.5, 0.3, 16, 50);
const portalMaterial = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00aaaa, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide });
const ornT1Portal = new THREE.Mesh(portalGeometry, portalMaterial);
ornT1Portal.position.set(portalWallX + 0.25, 1.6, portalWallCenterZ); // Y pos relative to ground
ornT1Portal.rotation.y = Math.PI / 2;
ornT1Portal.userData = { type: 'portal', name: 'ORN T1 Portal', requiredQuestState: QUEST_STATE.STEP_5A_OPEN_PORTAL, requires: { 'Citrulline': 1 }, advancesQuestTo: QUEST_STATE.STEP_6_GATHER_CYTO, action: 'transportCitrulline', productColor: citrullineColor };
scene.add(ornT1Portal); interactiveObjects.push(ornT1Portal); originalMaterials.set(ornT1Portal, portalMaterial.clone());
// MODIFIED: Smaller label scale
const portalLabel = createTextSprite("ORN T1 Portal", { x: ornT1Portal.position.x, y: 3.0, z: ornT1Portal.position.z }, { fontSize: 36, scale: 0.75 }); // Smaller scale, adjusted Y
scene.add(portalLabel);
// Portal Barrier (Uses the new wallHeight)
const barrierGeometry = new THREE.PlaneGeometry(portalGapWidth - 0.1, wallHeight - 0.1); // Uses new wallHeight
const barrierMaterial = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00aaaa, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
portalBarrier = new THREE.Mesh(barrierGeometry, barrierMaterial);
portalBarrier.position.set(portalWallX, wallHeight / 2, portalWallCenterZ); // Uses new wallHeight for Y pos
portalBarrier.rotation.y = Math.PI / 2;
portalBarrier.name = "PortalBarrier";
scene.add(portalBarrier);
collidableWalls.push(portalBarrier);
portalBarrier.updateMatrixWorld();
wallBoundingBoxes.push(new THREE.Box3().setFromObject(portalBarrier));


// --- UI Functions ---
function updateInventoryUI() { inventoryList.innerHTML = ''; let hasItems = false; for (const itemName in inventory) { if (inventory[itemName] > 0) { const li = document.createElement('li'); li.textContent = `${itemName}: ${inventory[itemName]}`; inventoryList.appendChild(li); hasItems = true; } } if (!hasItems) { inventoryList.innerHTML = '<li>Empty</li>'; } }
function showDialogue(text, options = []) { dialogueText.textContent = text; dialogueOptions.innerHTML = ''; options.forEach(opt => { const button = document.createElement('button'); button.textContent = opt.text; button.onclick = () => { hideDialogue(); if (opt.action) opt.action(); }; dialogueOptions.appendChild(button); }); dialogueBox.classList.remove('hidden'); controls.enabled = false; isUserInteracting = true; }
function hideDialogue() { dialogueBox.classList.add('hidden'); controls.enabled = true; isUserInteracting = false; }
function updateQuestUI() { if (currentQuest) { questNameUI.textContent = currentQuest.name; questObjectiveUI.textContent = currentQuest.objectives[currentQuest.state] || 'Completed!'; } else { questNameUI.textContent = 'None'; questObjectiveUI.textContent = 'Find and speak with Professor Hepaticus.'; } }
function showFeedback(message, duration = 2500) { const feedback = document.createElement('div'); feedback.style.position = 'absolute'; feedback.style.bottom = '150px'; feedback.style.left = '50%'; feedback.style.transform = 'translateX(-50%)'; feedback.style.backgroundColor = 'rgba(0, 0, 0, 0.8)'; feedback.style.color = 'white'; feedback.style.padding = '10px 20px'; feedback.style.borderRadius = '5px'; feedback.textContent = message; feedback.style.pointerEvents = 'none'; feedback.style.zIndex = '10'; uiContainer.appendChild(feedback); setTimeout(() => { if (feedback.parentNode) feedback.parentNode.removeChild(feedback); }, duration); }
function showInteractionPrompt(objectName) { if (interactionPrompt) { interactionText.textContent = objectName; interactionPrompt.classList.remove('hidden'); } }
function hideInteractionPrompt() { if (interactionPrompt) { interactionPrompt.classList.add('hidden'); } }

// --- Inventory Functions ---
function addToInventory(itemName, quantity = 1) { inventory[itemName] = (inventory[itemName] || 0) + quantity; updateInventoryUI(); }
function removeFromInventory(itemName, quantity = 1) { if (inventory[itemName] && inventory[itemName] >= quantity) { inventory[itemName] -= quantity; if (inventory[itemName] === 0) delete inventory[itemName]; updateInventoryUI(); return true; } return false; }
function hasItems(requiredItems) { for (const itemName in requiredItems) { if (!inventory[itemName] || inventory[itemName] < requiredItems[itemName]) { return false; } } return true; }

// --- Quest Functions ---
function startQuest(quest) { if (!currentQuest) { currentQuest = { ...quest }; currentQuest.state = QUEST_STATE.STEP_1_GATHER_MITO; updateQuestUI(); showFeedback(`Quest Started: ${quest.name}`); } }
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
            if (hasItems({ 'Citrulline': 1, 'Aspartate': 1, 'ATP': 1 })) {
                 console.log("Items for STEP_7 already present upon entering STEP_6. Advancing immediately.");
                 setTimeout(() => {
                     advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_7_MAKE_ARGSUCC);
                     showFeedback("Cytosol materials gathered! Head to the ASS station.");
                 }, 50);
                 return;
            }
        }
        else if (newState === QUEST_STATE.COMPLETED) {
            const rewardPoints = quest.rewards?.knowledgePoints || 0;
            showFeedback(`Quest Complete: ${quest.name}! +${rewardPoints} KP`, 5000);
             setTimeout(() => { if(currentQuest?.state === QUEST_STATE.COMPLETED) { currentQuest = null; updateQuestUI(); } }, 100);
        }
    } else if (currentQuest && currentQuest.id === quest.id && currentQuest.state === newState) {
        // Already in this state, do nothing.
    }
}


// --- Reality River Functions ---
function startRealityRiver() { currentRiverQuestionIndex = 0; riverCorrectAnswers = 0; realityRiverUI.classList.remove('hidden'); displayRiverQuestion(); updateRiverProgress(); controls.enabled = false; isUserInteracting = true; }
function displayRiverQuestion() { if (currentRiverQuestionIndex >= ureaRiverQuestions.length) { endRealityRiver(true); return; } const qData = ureaRiverQuestions[currentRiverQuestionIndex]; riverQuestionUI.textContent = qData.q; riverAnswersUI.innerHTML = ''; riverFeedbackUI.textContent = ''; qData.a.forEach((answer, index) => { const button = document.createElement('button'); button.textContent = answer; button.onclick = () => checkRiverAnswer(index); riverAnswersUI.appendChild(button); }); }
function checkRiverAnswer(selectedIndex) { const qData = ureaRiverQuestions[currentRiverQuestionIndex]; if (selectedIndex === qData.correct) { riverFeedbackUI.textContent = "Correct! Moving forward..."; riverFeedbackUI.style.color = 'lightgreen'; riverCorrectAnswers++; currentRiverQuestionIndex++; updateRiverProgress(); const buttons = riverAnswersUI.querySelectorAll('button'); buttons.forEach(b => b.disabled = true); setTimeout(() => { if (currentRiverQuestionIndex >= ureaRiverQuestions.length) { endRealityRiver(true); } else { displayRiverQuestion(); } }, 1000); } else { riverFeedbackUI.textContent = "Not quite. Think about the process..."; riverFeedbackUI.style.color = 'lightcoral'; } }
function updateRiverProgress() { let progress = "["; const totalSteps = ureaRiverQuestions.length; for(let i = 0; i < totalSteps; i++) { progress += (i < riverCorrectAnswers) ? "■" : "□"; } progress += "]"; riverProgressUI.textContent = progress; }
function endRealityRiver(success) { realityRiverUI.classList.add('hidden'); controls.enabled = true; isUserInteracting = false; if (success) { showDialogue("Impressive! You've navigated the Urea Cycle...", [ { text: "Great!", action: () => advanceQuest(ureaCycleQuest, QUEST_STATE.COMPLETED) } ]); } else { showDialogue("Hmm, seems you need to review...", [ { text: "Okay" } ]); } }

// --- Helper: Remove Portal Barrier ---
function removePortalBarrier() {
    if (portalBarrier && portalBarrier.parent === scene) {
        console.log("Removing portal barrier NOW.");
        const barrierIndex = collidableWalls.indexOf(portalBarrier);
        if (barrierIndex > -1) { collidableWalls.splice(barrierIndex, 1); } else { console.warn("Barrier not in collidables."); }
        const boxIndexToRemove = wallBoundingBoxes.findIndex(box => { const c = new Vector3(); box.getCenter(c); return c.distanceToSquared(portalBarrier.position) < 0.1; });
        if (boxIndexToRemove > -1) { wallBoundingBoxes.splice(boxIndexToRemove, 1); } else { console.warn("Barrier BBox not found."); }
        scene.remove(portalBarrier);
        portalBarrier.geometry.dispose(); portalBarrier.material.dispose(); portalBarrier = null;
    } else { console.log("Portal barrier already removed or doesn't exist."); }
}


// --- Interaction Logic (Triggered by 'E' key press) ---
function interactWithObject(object) {
    if (!object || isUserInteracting) return;
    const userData = object.userData;

    // --- NPC Interactions ---
    if (userData.type === 'npc' && userData.name === 'Professor Hepaticus') {
        isUserInteracting = true;
        if (currentQuest && currentQuest.id === 'ureaCycle') {
            if (currentQuest.state === QUEST_STATE.STEP_10_RIVER_CHALLENGE) {
                 showDialogue("Ready to test your knowledge on the Urea Cycle?", [ { text: "Yes, start the challenge!", action: startRealityRiver }, { text: "Give me a moment.", action: () => { isUserInteracting = false; } }]);
            } else if (currentQuest.state === QUEST_STATE.COMPLETED) {
                 showDialogue("Thanks again for helping clear the ammonia!", [{ text: "You're welcome.", action: () => { isUserInteracting = false; } }]);
            } else {
                 showDialogue(`Current Objective: ${currentQuest.objectives[currentQuest.state]}`, [{ text: "Okay", action: () => { isUserInteracting = false; } }]);
            }
        } else if (!currentQuest) {
             showDialogue("The cell is overwhelmed with ammonia! We need to convert it to Urea. Can you help?", [ { text: "Accept Quest", action: () => { startQuest(ureaCycleQuest); isUserInteracting = false; } }, { text: "Decline", action: () => { isUserInteracting = false; } }]);
        } else { isUserInteracting = false; }
    }
    else if (userData.type === 'npc' && userData.name === 'Ornithine Usher') {
        isUserInteracting = true;
        if (currentQuest && currentQuest.id === 'ureaCycle') {
            if (currentQuest.state === QUEST_STATE.STEP_3_MEET_USHER) {
                showDialogue(
                    "Ah, you've made Carbamoyl Phosphate! Next, you'll need something important for the Urea Cycle.", 
                    [
                      {
                        text: "What do I need?", 
                        action: () => {
                          showDialogue(
                            "You'll need Ornithine! It's a special amino acid — though it's *not* used to build proteins.",
                            [
                              {
                                text: "Why is Ornithine important?", 
                                action: () => {
                                  showDialogue(
                                    "Ornithine acts like a carrier. It picks up nitrogen atoms and moves them through the urea cycle.",
                                    [
                                      {
                                        text: "Can I have some Ornithine?", 
                                        action: () => {
                                          const p = { x: -8, z: -6 };
                                          createResource('Ornithine', p, ornithineColor, { initialY: 0.6 });
                                          showFeedback("Ornithine appeared!");
                                          advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_4_MAKE_CITRULLINE);
                                          isUserInteracting = false;
                                        }
                                      },
                                      {
                                        text: "Tell me even more!", 
                                        action: () => {
                                          showDialogue(
                                            "Ornithine is recycled! After helping to make citrulline, it eventually gets regenerated when arginine splits to form urea and ornithine again.",
                                            [
                                              {
                                                text: "So Ornithine keeps coming back?",
                                                action: () => {
                                                  showDialogue(
                                                    "Exactly! Some people even say the Urea Cycle should really be called the *Ornithine Cycle*!",
                                                    [
                                                      {
                                                        text: "Now can I have some Ornithine?",
                                                        action: () => {
                                                          const p = { x: -8, z: -6 };
                                                          createResource('Ornithine', p, ornithineColor, { initialY: 0.6 });
                                                          showFeedback("Ornithine appeared!");
                                                          advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_4_MAKE_CITRULLINE);
                                                          isUserInteracting = false;
                                                        }
                                                      }
                                                    ]
                                                  );
                                                }
                                              }
                                            ]
                                          );
                                        }
                                      }
                                    ]
                                  );
                                }
                              }
                            ]
                          );
                        }
                      }
                    ]
                  );
                              } else if (currentQuest.state === QUEST_STATE.STEP_4_MAKE_CITRULLINE) {
                if (hasItems({ 'Citrulline': 1 })) {
                    hasPortalPermission = true; showFeedback("Portal permission granted!"); advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_5A_OPEN_PORTAL);
                    showDialogue("Excellent! You've made Citrulline. I have granted you passage through the ORN T1 portal. You must activate it yourself using your Citrulline.", [ { text: "Understood.", action: () => { isUserInteracting = false; } }]);
                } else { showDialogue("You'll need to make and collect Citrulline first. Use the OTC station...", [{ text: "Got it", action: () => { isUserInteracting = false; } }]); }
            } else if (currentQuest.state === QUEST_STATE.STEP_5A_OPEN_PORTAL) {
                showDialogue("You have permission. Use the ORN T1 Portal with your Citrulline...", [{ text: "Will do!", action: () => { isUserInteracting = false; } }]);
            } else if (cytosolStates.includes(currentQuest.state)) {
                showDialogue("You've transported Citrulline. Well done!", [{ text: "Thanks!", action: () => { isUserInteracting = false; } }]);
            } else { showDialogue("Come back when you've made Carbamoyl Phosphate.", [{ text: "Okay", action: () => { isUserInteracting = false; } }]); }
        } else { showDialogue("Greetings! I manage the ORN T1 antiport.", [{ text: "Interesting.", action: () => { isUserInteracting = false; } }]); }
    }

    // --- Resource Interaction ---
    else if (userData.type === 'resource') {
        addToInventory(userData.name, 1); showFeedback(`Collected ${userData.name}`);
        if (currentQuest?.id === 'ureaCycle') {
            if (currentQuest.state === QUEST_STATE.STEP_1_GATHER_MITO && hasItems({ 'NH3': 1, 'HCO3': 1, 'ATP': 2 })) { advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_2_MAKE_CARB_PHOS); showFeedback("Materials gathered! Head to CPS1."); }
            else if (currentQuest.state === QUEST_STATE.STEP_6_GATHER_CYTO && hasItems({ 'Citrulline': 1, 'Aspartate': 1, 'ATP': 1 })) { advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_7_MAKE_ARGSUCC); showFeedback("Cytosol materials gathered! Head to ASS."); }
            else if (currentQuest.state === QUEST_STATE.STEP_8_CLEAVE_ARGSUCC && (userData.name === 'Arginine' || userData.name === 'Fumarate')) {
                // Provide feedback when collecting items relevant to the current step
                if (hasItems({'Arginine': 1}) && hasItems({'Fumarate': 1})) {
                    showFeedback("Arginine and Fumarate collected!");
                    // Don't advance quest here, wait for ASL station usage to advance to 8B
                } else if (hasItems({'Arginine': 1})) {
                     showFeedback("Arginine collected. Still need Fumarate.");
                } else if (hasItems({'Fumarate': 1})) {
                     showFeedback("Fumarate collected. Still need Arginine.");
                }
             }
        }
        scene.remove(userData.object3D);
        const i = interactiveObjects.indexOf(object); if (i > -1) interactiveObjects.splice(i, 1);
        const m = resourceMeshes.indexOf(object); if (m > -1) resourceMeshes.splice(m, 1);
        originalMaterials.delete(object);
        if (closestInteractiveObject === object) { closestInteractiveObject = null; lastClosestObject = null; hideInteractionPrompt(); }
    }

    // --- Station Interaction ---
    else if (userData.type === 'station') {
        if (!currentQuest || currentQuest.id !== 'ureaCycle') { showFeedback("Quest not active."); return; }
        if (currentQuest.state !== userData.requiredQuestState) { showFeedback(`Incorrect step for ${userData.name}. Objective: ${currentQuest.objectives[currentQuest.state]}`); return; }
        if (hasItems(userData.requires)) {
            let consumed = true; for (const item in userData.requires) { if (!removeFromInventory(item, userData.requires[item])) { consumed = false; console.error("Inventory error removing required item:", item); showFeedback("Inventory error!", 2000); break; } }
            if (consumed) {
                showFeedback(`Using ${userData.name}...`);
                let prods = [];
                if (typeof userData.produces === 'string') prods = [userData.produces];
                else if (Array.isArray(userData.produces)) prods = userData.produces;

                const stationObject = object;
                const off = new THREE.Vector3(0, 0, 1.5);
                const rot = new THREE.Quaternion();
                stationObject.getWorldQuaternion(rot);
                off.applyQuaternion(rot);
                const baseP = stationObject.position.clone();
                let spawnP = baseP.add(off);
                spawnP.y = 0.6;

                prods.forEach((itemName, i) => {
                    const colorHex = userData.productColors?.[itemName] || 0xffffff;
                    const finalSpawnPos = spawnP.clone();
                    const spreadOffset = new THREE.Vector3((i - (prods.length - 1) / 2) * 0.6, 0, 0);
                    spreadOffset.applyQuaternion(rot);
                    finalSpawnPos.add(spreadOffset);

                    createResource(itemName, { x: finalSpawnPos.x, z: finalSpawnPos.z }, colorHex, { initialY: finalSpawnPos.y });
                    showFeedback(`${itemName} appeared! (Collectable)`); // Always collectable now
                });

                // Advance the quest state AFTER producing items
                if (userData.advancesQuestTo) {
                    advanceQuest(ureaCycleQuest, userData.advancesQuestTo);
                }

            }
        } else { let miss = "Missing: "; let fir = true; for (const item in userData.requires) { const req = userData.requires[item]; const cur = inventory[item] || 0; if (cur < req) { miss += `${fir ? '' : ', '}${req - cur} ${item}`; fir = false; } } showFeedback(miss); }
    }


    // --- Portal Interaction ---
    else if (userData.type === 'portal' && userData.name === 'ORN T1 Portal') {
        if (!currentQuest || currentQuest.id !== 'ureaCycle') { showFeedback("Quest not active."); return; }
        if (currentQuest.state !== QUEST_STATE.STEP_5A_OPEN_PORTAL) { showFeedback(`Portal cannot be used yet.`); return; }
        if (!hasPortalPermission) { showFeedback("You don't have permission to activate this portal yet. Talk to the Usher."); return; }
        if (!hasItems(userData.requires)) { showFeedback("Missing: Citrulline"); return; }

        if (!removeFromInventory('Citrulline', 1)) { console.error("Failed to remove Citrulline!"); showFeedback("Error using portal!", 2000); return; }
        showFeedback("Activating ORN T1 Portal..."); removePortalBarrier();
        const portalMesh = object; if (originalMaterials.has(portalMesh)) { const origMat = originalMaterials.get(portalMesh); if (origMat && origMat.emissive) { const origE = origMat.emissive.getHex(); portalMesh.material.emissive.setHex(0xffffff); setTimeout(() => { if (portalMesh?.material && originalMaterials.has(portalMesh)) { const currentOrigMat = originalMaterials.get(portalMesh); if(currentOrigMat?.emissive) portalMesh.material.emissive.setHex(currentOrigMat.emissive.getHex()); } }, 200); } }
        const sPos = { x: portalMesh.position.x + 1.5, z: portalMesh.position.z }; const sCol = userData.productColor || citrullineColor; createResource('Citrulline', sPos, sCol, {initialY: 0.6});
        showFeedback("Citrulline transported! Collect it in the Cytosol.");
         if (userData.advancesQuestTo === QUEST_STATE.STEP_6_GATHER_CYTO) { advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_6_GATHER_CYTO); }
         else { console.warn(`Portal advancement state mismatch! Expected ${QUEST_STATE.STEP_6_GATHER_CYTO}, got ${userData.advancesQuestTo}`); }
    }

    // --- Waste Bucket Interaction ---
    else if (userData.type === 'wasteBucket') {
        if (!currentQuest || currentQuest.id !== 'ureaCycle') { showFeedback("Nothing to dispose right now."); return; }
        if (currentQuest.state !== QUEST_STATE.STEP_9B_DISPOSE_UREA) { showFeedback("No need to use this yet."); return; }
        if (!hasItems({ 'Urea': 1 })) { showFeedback("You need Urea to dispose of."); return; }
        if (removeFromInventory('Urea', 1)) { showFeedback("Urea safely disposed!"); advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_10_RIVER_CHALLENGE); }
        else { console.error("Failed to remove Urea!"); showFeedback("Error disposing Urea.", 2000); }
    }

    // --- Krebs Furnace Interaction ---
    else if (userData.type === 'krebsFurnace') {
        if (!currentQuest || currentQuest.id !== 'ureaCycle') { showFeedback("The furnace slumbers."); return; }

        // *** MODIFIED: Check for the specific furnace step ***
        if (currentQuest.state !== QUEST_STATE.STEP_8B_FURNACE_FUMARATE) {
             showFeedback("You don't need to use the furnace right now."); return;
        }

        if (hasItems({ 'Fumarate': 1 })) {
            if (removeFromInventory('Fumarate', 1)) {
                showFeedback("Fumarate fed to the Krebs Cycle Furnace!");

                // Optional: Add a visual effect to the furnace firebox
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
                     }, 300);
                } else {
                     console.warn("Could not find firebox mesh or its original material for effect.");
                }

                // *** MODIFIED: Advance quest state AFTER successful interaction ***
                advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_9_MAKE_UREA);

            } else {
                console.error("Failed to remove Fumarate from inventory for furnace!");
                showFeedback("Inventory error disposing Fumarate.", 2000);
            }
        } else {
            showFeedback("You need Fumarate to feed the furnace.");
        }
        isUserInteracting = false; // Don't keep interaction locked
    }


    // Reset interaction flag if no UI element took control
    if (isUserInteracting && dialogueBox.classList.contains('hidden') && realityRiverUI.classList.contains('hidden')) {
         isUserInteracting = false;
     }
} // End interactWithObject


// --- Event Listeners ---
document.addEventListener('keydown', (event) => { const key = event.key.toLowerCase(); keysPressed[key] = true; if (key === 'e' && closestInteractiveObject && !isUserInteracting) interactWithObject(closestInteractiveObject); });
document.addEventListener('keyup', (event) => { keysPressed[event.key.toLowerCase()] = false; });
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });


// --- Animation Loop ---
const clock = new THREE.Clock();
const cameraIdealOffset = new THREE.Vector3(0, 8, -10); const cameraIdealLookAt = new THREE.Vector3(0, 1.5, 0);
const cameraPositionSmoothFactor = 0.08; const cameraTargetSmoothFactor = 0.1;
const playerWorldPos = new THREE.Vector3(); const cameraTargetPos = new THREE.Vector3(); const cameraTargetLookAt = new THREE.Vector3();
const cameraForward = new THREE.Vector3(); const cameraRight = new THREE.Vector3(); const moveDirection = new THREE.Vector3();
const playerVelocity = new THREE.Vector3(); const targetQuaternion = new THREE.Quaternion(); const upVector = new THREE.Vector3(0, 1, 0);

function checkCollision(nextPos) {
    const playerHeightOffset = new Vector3(0, playerHeight / 2, 0);
    const playerSize = new Vector3(playerRadius * 2, playerHeight, playerRadius * 2);
    playerBoundingBox.setFromCenterAndSize(nextPos.clone().add(playerHeightOffset), playerSize);

    for (const wallBox of wallBoundingBoxes) {
        if (playerBoundingBox.intersectsBox(wallBox)) {
             return true;
        }
    }
    return false;
}

function highlightObject(object) {
    if (!object) return;
    let meshToHighlight = null;
    if (object instanceof THREE.Group) {
        meshToHighlight = object.children.find(child => child instanceof THREE.Mesh && child.name === 'body');
         if (!meshToHighlight) meshToHighlight = object.children.find(child => child instanceof THREE.Mesh && child.name === 'coat');
         if (!meshToHighlight) meshToHighlight = object.children.find(child => child instanceof THREE.Mesh && child.geometry instanceof THREE.BoxGeometry);
        if (!meshToHighlight) meshToHighlight = object.children.find(child => child instanceof THREE.Mesh && child.material);
    } else if (object instanceof THREE.Mesh) {
        meshToHighlight = object;
    }

    if (meshToHighlight?.material) {
         if (!originalMaterials.has(meshToHighlight)) {
             if (meshToHighlight.material.emissive !== undefined) {
                 originalMaterials.set(meshToHighlight, meshToHighlight.material.clone());
             }
        }
         if (meshToHighlight.material.emissive !== undefined) {
             meshToHighlight.material.emissive.copy(highlightMaterial.emissive);
             meshToHighlight.material.emissiveIntensity = highlightMaterial.emissiveIntensity;
             meshToHighlight.material.needsUpdate = true;
         }
    }
}

function unhighlightObject(object) {
    if (!object) return;
    let meshToUnhighlight = null;
     if (object instanceof THREE.Group) {
         meshToUnhighlight = object.children.find(child => child instanceof THREE.Mesh && originalMaterials.has(child));
    } else if (object instanceof THREE.Mesh) {
        if (originalMaterials.has(object)) {
             meshToUnhighlight = object;
        }
    }

    if (meshToUnhighlight && originalMaterials.has(meshToUnhighlight)) {
        const originalMat = originalMaterials.get(meshToUnhighlight);
        if (meshToUnhighlight.material.emissive !== undefined && originalMat.emissive !== undefined) {
            meshToUnhighlight.material.emissive.copy(originalMat.emissive);
            meshToUnhighlight.material.emissiveIntensity = originalMat.emissiveIntensity;
            meshToUnhighlight.material.needsUpdate = true;
        }
    }
}


function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);
    const elapsedTime = clock.elapsedTime;

    // Player Movement
    let moveZ = 0; let moveX = 0;
    if (!isUserInteracting) {
        if (keysPressed['w'] || keysPressed['arrowup']) moveZ = 1;
        if (keysPressed['s'] || keysPressed['arrowdown']) moveZ = -1;
        if (keysPressed['a'] || keysPressed['arrowleft']) moveX = 1;
        if (keysPressed['d'] || keysPressed['arrowright']) moveX = -1;
    }

    playerVelocity.set(0, 0, 0);
    moveDirection.set(0, 0, 0);
    const playerIsMoving = moveX !== 0 || moveZ !== 0;

    if (playerIsMoving) {
        camera.getWorldDirection(cameraForward); cameraForward.y = 0; cameraForward.normalize();
        cameraRight.crossVectors(upVector, cameraForward).normalize();
        moveDirection.addScaledVector(cameraForward, moveZ).addScaledVector(cameraRight, moveX).normalize();
        playerVelocity.copy(moveDirection).multiplyScalar(playerSpeed * delta);
        const currentPos = player.position.clone();
        const nextPosX = currentPos.clone().add(new THREE.Vector3(playerVelocity.x, 0, 0));
        if (!checkCollision(nextPosX)) { player.position.x = nextPosX.x; } else { playerVelocity.x = 0; }
        const nextPosZ = player.position.clone().add(new THREE.Vector3(0, 0, playerVelocity.z));
        if (!checkCollision(nextPosZ)) { player.position.z = nextPosZ.z; } else { playerVelocity.z = 0; }
        if (moveDirection.lengthSq() > 0.001) { targetQuaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), moveDirection); player.quaternion.slerp(targetQuaternion, 0.2); }
    }

    // --- NEW: Portal Crossing Check ---
    // Check only if the portal barrier is gone (meaning player interacted successfully)
    if (!portalBarrier) {
        const currentX = player.position.x;
        if (currentX > portalWallX && playerLocation === 'mitochondria') {
            playerLocation = 'cytosol';
            showFeedback("You are entering the Cytosol", 3000);
            console.log("Player crossed into Cytosol");
        } else if (currentX < portalWallX && playerLocation === 'cytosol') {
            playerLocation = 'mitochondria';
            showFeedback("You are entering the Mitochondria", 3000);
            console.log("Player crossed into Mitochondria");
        }
    }
    // --- END NEW ---

    // Proximity Check for Interaction Prompt
    if (!isUserInteracting) {
        let minDistSq = interactionRadius * interactionRadius;
        let foundClosest = null;
        player.getWorldPosition(playerWorldPos);

        interactiveObjects.forEach(obj => {
            if (obj?.parent === scene && obj.visible) {
                let objPos = new Vector3();
                if (obj instanceof THREE.Group || obj instanceof THREE.Mesh) {
                     obj.getWorldPosition(objPos);
                } else { return; }

                const distSq = playerWorldPos.distanceToSquared(objPos);
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    foundClosest = obj;
                }
            }
        });

        if (foundClosest !== closestInteractiveObject) {
            if (closestInteractiveObject) { unhighlightObject(closestInteractiveObject); }
            if (foundClosest) { highlightObject(foundClosest); showInteractionPrompt(foundClosest.userData.name || 'Object'); }
            else { hideInteractionPrompt(); }
            lastClosestObject = closestInteractiveObject;
            closestInteractiveObject = foundClosest;
        }
    } else {
        if (closestInteractiveObject) { unhighlightObject(closestInteractiveObject); closestInteractiveObject = null; }
         if (lastClosestObject) { unhighlightObject(lastClosestObject); lastClosestObject = null; }
        hideInteractionPrompt();
    }


    // Resource Hover Animation
    const hoverSpeed = 2; const hoverAmount = 0.2;
    resourceMeshes.forEach((resource, index) => {
        if (resource?.parent === scene && resource.userData?.initialY !== undefined) {
            const yPos = resource.userData.initialY + Math.sin(elapsedTime * hoverSpeed + index * 0.5) * hoverAmount;
            if (!isNaN(yPos)) { resource.position.y = yPos; }
        }
    });

    // Camera Logic
    player.getWorldPosition(playerWorldPos);
    cameraTargetPos.copy(cameraIdealOffset).applyQuaternion(player.quaternion).add(playerWorldPos);
    cameraTargetLookAt.copy(playerWorldPos).add(cameraIdealLookAt);

    if (!isUserInteracting) {
        camera.position.lerp(cameraTargetPos, cameraPositionSmoothFactor);
        controls.target.lerp(cameraTargetLookAt, cameraTargetSmoothFactor);
    } else {
        controls.target.copy(cameraTargetLookAt);
    }

    controls.update(delta);
    renderer.render(scene, camera);
}

// --- Initial Setup Calls ---
updateInventoryUI();
updateQuestUI();
player.getWorldPosition(playerWorldPos);
const initialCamPos = cameraIdealOffset.clone().applyQuaternion(player.quaternion).add(playerWorldPos);
const initialLookAt = playerWorldPos.clone().add(cameraIdealLookAt);
camera.position.copy(initialCamPos);
controls.target.copy(initialLookAt);
camera.lookAt(controls.target);
controls.update();
loadingScreen.classList.add('hidden');
animate();
console.log("Metabolon RPG Initialized (v23 - Smaller labels, shorter walls, spaced cytosol, portal messages).");
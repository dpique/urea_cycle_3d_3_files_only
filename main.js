import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Box3, Vector3 } from 'three'; // Explicitly import

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
// Camera starting position is less relevant now, will be positioned relative to player

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
controls.enableDamping = true; controls.dampingFactor = 0.1; // Adjust for desired smoothness
controls.screenSpacePanning = false;
controls.enableRotate = false; // Disable user orbiting
controls.enableZoom = false;   // Disable user zoom
controls.enablePan = false;    // Disable user panning
let isUserInteracting = false; // Still useful to pause lerping during dialogues etc.

// --- Interaction/Tracking Arrays and Map ---
let interactiveObjects = [];
let resourceMeshes = [];
let collidableWalls = [];
const wallBoundingBoxes = [];
const originalMaterials = new Map();
const playerBoundingBox = new THREE.Box3();
let portalBarrier = null; // Reference to the visual barrier mesh

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
const playerTargetY = legHeight + bodyHeight / 2; // Used for lookAt offset

// --- Maze Walls & Collision ---
const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.2, roughness: 0.9 });
const wallHeight = 3;
const portalGapWidth = 3.0;
const portalWallX = -3.5;
const portalWallCenterZ = -6;
const portalWallLength = 18;

function createWall(position, size, rotationY = 0, name = "Wall") {
    const wallGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.set(position.x, position.y, position.z);
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

// Wall Layout
createWall({ x: 6, y: wallHeight / 2, z: 12 }, { x: 17, y: wallHeight, z: 0.5 }, 0, "H_Top");
createWall({ x: -2.5, y: wallHeight / 2, z: 6 }, { x: 0.5, y: wallHeight, z: 12 }, 0, "V_Left_Cytosol");
createWall({ x: 14.5, y: wallHeight / 2, z: 4 }, { x: 0.5, y: wallHeight, z: 16 }, 0, "V_Right_Cytosol");
createWall({ x: 6, y: wallHeight / 2, z: -3 }, { x: 12, y: wallHeight, z: 0.5 }, 0, "H_Bottom_Cytosol");
createWall({ x: -18, y: wallHeight / 2, z: -6 }, { x: 0.5, y: wallHeight, z: 18 }, 0, "V_Mito_Boundary_L");
createWall({ x: -10.75, y: wallHeight / 2, z: 3 }, { x: 14.5, y: wallHeight, z: 0.5 }, 0, "H_Mito_Boundary_Top");
createWall({ x: -10.75, y: wallHeight / 2, z: -15 }, { x: 14.5, y: wallHeight, z: 0.5 }, 0, "H_Mito_Boundary_Bottom");
createWall({ x: -11.5, y: wallHeight / 2, z: -2.5 }, { x: 10, y: wallHeight, z: 0.5 }, 0, "H_Mito_Internal_1");
createWall({ x: -11.5, y: wallHeight / 2, z: -8 }, { x: 10, y: wallHeight, z: 0.5 }, 0, "H_Mito_Internal_2");
// Split Wall for Portal Gap
const wallStartZ = portalWallCenterZ - portalWallLength / 2; const wallEndZ = portalWallCenterZ + portalWallLength / 2;
const gapStartZ = portalWallCenterZ - portalGapWidth / 2; const gapEndZ = portalWallCenterZ + portalGapWidth / 2;
const wall1Length = gapStartZ - wallStartZ; const wall1CenterZ = wallStartZ + wall1Length / 2;
if (wall1Length > 0.1) { createWall({ x: portalWallX, y: wallHeight / 2, z: wall1CenterZ }, { x: 0.5, y: wallHeight, z: wall1Length }, 0, "V_Mito_Boundary_R_Bottom"); }
const wall2Length = wallEndZ - gapEndZ; const wall2CenterZ = gapEndZ + wall2Length / 2;
if (wall2Length > 0.1) { createWall({ x: portalWallX, y: wallHeight / 2, z: wall2CenterZ }, { x: 0.5, y: wallHeight, z: wall2Length }, 0, "V_Mito_Boundary_R_Top"); }

// Add cabinet near the wall
const cabinetMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 });
const cabinetGeometry = new THREE.BoxGeometry(1, 1.5, 1.5);
const cabinet = new THREE.Mesh(cabinetGeometry, cabinetMaterial);
cabinet.position.set(-14.5, 0.75, -1); // Position next to wall
cabinet.castShadow = true;
cabinet.receiveShadow = true;
scene.add(cabinet);

const cabinetLabel = createTextSprite("Kitchen Cabinet",
    { x: cabinet.position.x, y: cabinet.position.y + 1.2, z: cabinet.position.z },
    { fontSize: 24, scale: 1 }
);
scene.add(cabinetLabel);

// Move HCO3 to be on top of the cabinet
createResource('HCO3', { x: cabinet.position.x, z: cabinet.position.z }, 0xaaaaff,
    { initialY: cabinet.position.y + (cabinetGeometry.parameters.height / 2) + 0.3 });

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
    STEP_3_MEET_USHER: 'STEP_3_MEET_USHER',  // New state
    STEP_4_MAKE_CITRULLINE: 'STEP_4_MAKE_CITRULLINE',
    STEP_5_TRANSPORT_CIT: 'STEP_5_TRANSPORT_CIT',
    STEP_6_GATHER_CYTO: 'STEP_6_GATHER_CYTO',
    STEP_7_MAKE_ARGSUCC: 'STEP_7_MAKE_ARGSUCC',
    STEP_8_CLEAVE_ARGSUCC: 'STEP_8_CLEAVE_ARGSUCC',
    STEP_9_MAKE_UREA: 'STEP_9_MAKE_UREA',
    STEP_10_RIVER_CHALLENGE: 'STEP_10_RIVER_CHALLENGE',
    COMPLETED: 'COMPLETED'
};

// Define cytosol states at a higher scope
const cytosolStates = [
    QUEST_STATE.STEP_6_GATHER_CYTO,
    QUEST_STATE.STEP_7_MAKE_ARGSUCC,
    QUEST_STATE.STEP_8_CLEAVE_ARGSUCC,
    QUEST_STATE.STEP_9_MAKE_UREA,
    QUEST_STATE.STEP_10_RIVER_CHALLENGE
];

let inventory = {}; let currentQuest = null;
const ureaCycleQuest = {
    id: 'ureaCycle', name: "Ammonia Annihilation", state: QUEST_STATE.NOT_STARTED,
    objectives: {
        [QUEST_STATE.NOT_STARTED]: "Talk to Professor Hepaticus.",
        [QUEST_STATE.STEP_1_GATHER_MITO]: "First, gather NH3 (1), HCO3 (1), ATP (2) in Mitochondria.",
        [QUEST_STATE.STEP_2_MAKE_CARB_PHOS]: "Great! Now use the CPS1 Station to make Carbamoyl Phosphate.",
        [QUEST_STATE.STEP_3_MEET_USHER]: "Find the Ornithine Usher to get some Ornithine.",
        [QUEST_STATE.STEP_4_MAKE_CITRULLINE]: "Use OTC Station with Carbamoyl Phosphate and Ornithine to make Citrulline.",
        [QUEST_STATE.STEP_5_TRANSPORT_CIT]: "Talk to Ornithine Usher again to open the portal, then use it to transport Citrulline.",
        [QUEST_STATE.STEP_6_GATHER_CYTO]: "In the Cytosol: Collect transported Citrulline, gather Aspartate (1), ATP (1).",
        [QUEST_STATE.STEP_7_MAKE_ARGSUCC]: "Use ASS Station to make Argininosuccinate.",
        [QUEST_STATE.STEP_8_CLEAVE_ARGSUCC]: "Use ASL Station to cleave Argininosuccinate into Arginine.",
        [QUEST_STATE.STEP_9_MAKE_UREA]: "Final step: Use ARG1 Station to convert Arginine to Urea.",
        [QUEST_STATE.STEP_10_RIVER_CHALLENGE]: "Return to Professor Hepaticus and pass the Reality River challenge.",
        [QUEST_STATE.COMPLETED]: "Quest complete! You've mastered the Urea Cycle!"
    }, rewards: { knowledgePoints: 100 }
};

const ureaRiverQuestions = [ { q: "Where in the cell does the Urea Cycle BEGIN?", a: ["Cytosol", "Mitochondria", "Nucleus", "ER"], correct: 1 }, { q: "Which enzyme combines NH3, HCO3, and ATP?", a: ["OTC", "CPS1", "ASS", "Arginase"], correct: 1 }, { q: "Which molecule carries the second nitrogen into the cycle (in the cytosol)?", a: ["Glutamate", "Ornithine", "Aspartate", "Citrulline"], correct: 2 }, { q: "Which molecule is transported OUT of the mitochondria during the cycle?", a: ["Ornithine", "Carbamoyl Phosphate", "Citrulline", "Urea"], correct: 2 }, { q: "What toxic molecule is the primary input for the cycle?", a: ["Urea", "Ammonia (NH3/NH4+)", "Fumarate", "ATP"], correct: 1 }, { q: "What molecule is REGENERATED at the end of the cycle in the cytosol?", a: ["Arginine", "Ornithine", "Aspartate", "Urea"], correct: 1 } ];
let currentRiverQuestionIndex = 0; let riverCorrectAnswers = 0;


// --- Text Sprite Function ---
function createTextSprite(text, position, parameters = {}) {
    const fontFace = parameters.fontFace || "Arial";
    const fontSize = parameters.fontSize || 48; // px
    const scaleFactor = parameters.scale || 2;
    const color = parameters.textColor || "rgba(255, 255, 255, 0.95)";

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = "Bold " + fontSize + "px " + fontFace;
    const metrics = context.measureText(text);
    const textWidth = metrics.width;
    const padding = fontSize * 0.2;
    canvas.width = textWidth + padding * 2;
    canvas.height = fontSize + padding * 2;

    context.font = "Bold " + fontSize + "px " + fontFace; // Re-apply after resize
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
        depthWrite: false,
    });

    const sprite = new THREE.Sprite(spriteMaterial);
    const aspect = canvas.width / canvas.height;
    sprite.scale.set(scaleFactor * aspect, scaleFactor, 1);
    sprite.position.set(position.x, position.y, position.z);
    return sprite;
}


// --- Game Object Creation Functions ---
function createLightningBoltGeometry() {
    const points = [
        new THREE.Vector3(0, 0.8, 0),      // Top
        new THREE.Vector3(-0.4, 0.4, 0.2),   // Left point upper
        new THREE.Vector3(0, 0.2, -0.2),    // Middle upper
        new THREE.Vector3(0.4, 0, 0.2),    // Right point
        new THREE.Vector3(0, -0.2, -0.2),   // Middle lower
        new THREE.Vector3(-0.4, -0.4, 0.2),  // Left point lower
        new THREE.Vector3(0, -0.8, 0)      // Bottom
    ];

    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const thickness = 0.15; // Increased thickness

    // Create triangles for each segment with varying depth
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const direction = new THREE.Vector3().subVectors(p2, p1).normalize();
        const perpendicular = new THREE.Vector3(-direction.y, direction.x, 0).multiplyScalar(thickness);

        // Front face triangles
        vertices.push(
            p1.x + perpendicular.x, p1.y + perpendicular.y, p1.z + thickness,
            p1.x - perpendicular.x, p1.y - perpendicular.y, p1.z + thickness,
            p2.x + perpendicular.x, p2.y + perpendicular.y, p2.z + thickness
        );
        vertices.push(
            p1.x - perpendicular.x, p1.y - perpendicular.y, p1.z + thickness,
            p2.x - perpendicular.x, p2.y - perpendicular.y, p2.z + thickness,
            p2.x + perpendicular.x, p2.y + perpendicular.y, p2.z + thickness
        );

        // Back face triangles
        vertices.push(
            p1.x + perpendicular.x, p1.y + perpendicular.y, p1.z - thickness,
            p2.x + perpendicular.x, p2.y + perpendicular.y, p2.z - thickness,
            p1.x - perpendicular.x, p1.y - perpendicular.y, p1.z - thickness
        );
        vertices.push(
            p2.x + perpendicular.x, p2.y + perpendicular.y, p2.z - thickness,
            p2.x - perpendicular.x, p2.y - perpendicular.y, p2.z - thickness,
            p1.x - perpendicular.x, p1.y - perpendicular.y, p1.z - thickness
        );

        // Side triangles
        vertices.push(
            p1.x + perpendicular.x, p1.y + perpendicular.y, p1.z + thickness,
            p2.x + perpendicular.x, p2.y + perpendicular.y, p2.z + thickness,
            p1.x + perpendicular.x, p1.y + perpendicular.y, p1.z - thickness
        );
        vertices.push(
            p2.x + perpendicular.x, p2.y + perpendicular.y, p2.z + thickness,
            p2.x + perpendicular.x, p2.y + perpendicular.y, p2.z - thickness,
            p1.x + perpendicular.x, p1.y + perpendicular.y, p1.z - thickness
        );
         // Add the other side face
         vertices.push(
             p1.x - perpendicular.x, p1.y - perpendicular.y, p1.z + thickness,
             p1.x - perpendicular.x, p1.y - perpendicular.y, p1.z - thickness,
             p2.x - perpendicular.x, p2.y - perpendicular.y, p2.z + thickness
         );
         vertices.push(
             p1.x - perpendicular.x, p1.y - perpendicular.y, p1.z - thickness,
             p2.x - perpendicular.x, p2.y - perpendicular.y, p2.z - thickness,
             p2.x - perpendicular.x, p2.y - perpendicular.y, p2.z + thickness
         );
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return geometry;
}

function createStation(name, position, color, userData) {
    const geometry = new THREE.BoxGeometry(1, 2, 1);
    const material = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 });
    const station = new THREE.Mesh(geometry, material);
    station.position.set(position.x, 1, position.z);
    station.castShadow = true; station.receiveShadow = true;
    station.userData = { type: 'station', name: name, ...userData };
    scene.add(station);
    interactiveObjects.push(station);
    originalMaterials.set(station, material.clone()); // Store a clone
    const label = createTextSprite(name, { x: position.x, y: 2.5, z: position.z }, { fontSize: 36, scale: 1.5 });
    scene.add(label); return station;
}
function createResource(name, position, color, userData = {}) {
    try {
        let geometry;
        let material;
        let scale = 1.0; // Default scale

        if (name === 'ATP') {
            geometry = createLightningBoltGeometry();
            material = new THREE.MeshStandardMaterial({
                color: color,
                roughness: 0.3,
                metalness: 0.7,
                emissive: color,
                emissiveIntensity: 0.3
            });
            // ATP already has its own geometry size, scale might not be needed or adjusted differently
        } else {
             // *** ADDED *** Define standard sphere geometry for reuse
            geometry = new THREE.SphereGeometry(0.3, 12, 10); // Standard size for molecules

            // *** ADDED *** Custom shapes/colors for specific molecules
            if (name === 'Carbamoyl Phosphate') {
                 // Maybe slightly different color or shape? Using sphere for now.
                 color = 0xff3333; // Distinct reddish
            } else if (name === 'Citrulline') {
                color = 0xff8c00; // Keep orange
            } else if (name === 'Argininosuccinate') {
                color = 0x33ff33; // Distinct greenish
                 geometry = new THREE.IcosahedronGeometry(0.35, 0); // Slightly different shape
                 scale = 1.1;
            } else if (name === 'Arginine') {
                color = 0x6666ff; // Distinct blueish
                 geometry = new THREE.CapsuleGeometry(0.2, 0.3, 4, 8); // Capsule shape
                 scale = 1.0;
            } else if (name === 'Urea') {
                 color = 0xdddddd; // Whitish/Grey
                 geometry = new THREE.TorusKnotGeometry(0.2, 0.08, 50, 8); // Knot shape
                 scale = 1.2;
            } else if (name === 'Ornithine') {
                color = 0xaaccaa; // Keep greenish
            } else if (name === 'Fumarate') { // Although we don't spawn Fumarate, define for consistency
                color = 0xcccccc;
            }
            // Use standard sphere if not specified above

            material = new THREE.MeshStandardMaterial({
                color: color,
                roughness: 0.5,
                metalness: 0.1
            });
        }

        const resource = new THREE.Mesh(geometry, material);
        if (isNaN(position.x) || isNaN(position.z)) {
            console.error(`Invalid position for resource ${name}`);
            position = { x: 0, z: 0 };
        }

        const initialY = userData.initialY !== undefined ? userData.initialY : 0.6;
        resource.userData = { ...userData, type: 'resource', name: name, object3D: resource, initialY: initialY };
        resource.position.set(position.x, initialY, position.z);
        resource.scale.set(scale, scale, scale); // Apply scale
        resource.castShadow = true;

        // Add random rotation for non-spheres/ATP
        if (name !== 'ATP' && !(geometry instanceof THREE.SphereGeometry)) {
             resource.rotation.x = Math.random() * Math.PI;
             resource.rotation.y = Math.random() * Math.PI * 2;
        } else if (name === 'ATP') {
            resource.rotation.y = Math.random() * Math.PI * 2;
        }


        scene.add(resource);
        interactiveObjects.push(resource);
        resourceMeshes.push(resource);
        originalMaterials.set(resource, material.clone());
        return resource;
    } catch (error) {
        console.error(`Error creating resource ${name}:`, error);
        return null;
    }
}

function createProfessorHepaticus(position) {
    const professorGroup = new THREE.Group();
    professorGroup.position.copy(position);

    // Body
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xccaa00, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.2, 8), bodyMaterial);
    body.position.y = 0.6;
    body.castShadow = true;
    professorGroup.add(body);

    // Head
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc99, roughness: 0.5 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), headMaterial);
    head.position.y = 1.4; // Corrected Y position relative to group base
    head.castShadow = true;
    professorGroup.add(head);

    // Lab Coat
    const coatMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 1.4, 8), coatMaterial);
    coat.position.y = 0.7; // Corrected Y position
    coat.castShadow = true;
    professorGroup.add(coat);

    // Arms
    const armMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8), armMaterial);
    leftArm.position.set(-0.5, 0.8, 0); // Corrected Y position
    leftArm.rotation.z = Math.PI / 6;
    leftArm.castShadow = true;
    professorGroup.add(leftArm);

    const rightArm = leftArm.clone();
    rightArm.position.x = 0.5;
    rightArm.rotation.z = -Math.PI / 6;
    professorGroup.add(rightArm);

    // Glasses
    const glassesMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.3 });
    const leftLens = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), glassesMaterial);
     leftLens.position.set(-0.1, 1.45, 0.25); // Y position matches head height, Z slightly forward
     leftLens.rotation.x = 0; // Circle geometry lies on XY plane, no X rotation needed if facing Z
     leftLens.rotation.y = 0; // Adjust if needed
    professorGroup.add(leftLens);

    const rightLens = leftLens.clone();
    rightLens.position.x = 0.1;
    professorGroup.add(rightLens);

    // Add to scene and interactive objects
    scene.add(professorGroup);
    professorGroup.userData = { type: 'npc', name: 'Professor Hepaticus', questId: 'ureaCycle' };
    interactiveObjects.push(professorGroup);
    originalMaterials.set(professorGroup, coatMaterial.clone()); // Use coat material for highlight base

    // Add name label
    const label = createTextSprite("Professor Hepaticus",
        { x: position.x, y: position.y + 2.0, z: position.z }, // Adjusted label height
        { fontSize: 36, scale: 1.5 }
    );
    scene.add(label);

    return professorGroup;
}

// --- Create Game World Entities ---
// NPCs
const professorHepaticus = createProfessorHepaticus(new THREE.Vector3(-4.5, 0, -1)); // Professor base at y=0

const usherMaterial = new THREE.MeshStandardMaterial({ color: 0x8a2be2 }); // Purple
// CapsuleGeometry: radius, height (excluding caps), capSegments, radialSegments
const usherGeometry = new THREE.CapsuleGeometry(0.4, 1.0, 4, 8); // Adjust size
const ornithineUsher = new THREE.Mesh(usherGeometry, usherMaterial);
ornithineUsher.position.set(-4.5, 0.7, -4); // Y = height/2 + radius = 1.0/2 + 0.4 = 0.9 (or adjust base)
ornithineUsher.castShadow = true;
ornithineUsher.userData = { type: 'npc', name: 'Ornithine Usher' };
scene.add(ornithineUsher);
interactiveObjects.push(ornithineUsher);
originalMaterials.set(ornithineUsher, usherMaterial.clone());
const usherLabel = createTextSprite("Ornithine Usher", { x: -4.5, y: 2.2, z: -4 }, { fontSize: 36, scale: 1.5 }); // Adjusted label height
scene.add(usherLabel);

// Stations (Define product colors here if not done in createResource)
const carbPhosColor = 0xff3333;
const citrullineColor = 0xff8c00;
const argSuccColor = 0x33ff33;
const arginineColor = 0x6666ff;
const ureaColor = 0xdddddd;
const ornithineColor = 0xaaccaa;
const fumarateColor = 0xcccccc; // For feedback reference

createStation("CPS1", { x: -15, z: -10 }, 0xff0000, {
    requires: { 'NH3': 1, 'HCO3': 1, 'ATP': 2 },
    produces: 'Carbamoyl Phosphate',
    productColors: { 'Carbamoyl Phosphate': carbPhosColor },
    requiredQuestState: QUEST_STATE.STEP_2_MAKE_CARB_PHOS,  // State needed to USE the station
    advancesQuestTo: QUEST_STATE.STEP_3_MEET_USHER // State AFTER successful use
});

createStation("OTC", { x: -11, z: -10 }, 0xff4500, {
    requires: { 'Carbamoyl Phosphate': 1, 'Ornithine': 1 },
    produces: 'Citrulline',
    productColors: { 'Citrulline': citrullineColor },
    requiredQuestState: QUEST_STATE.STEP_4_MAKE_CITRULLINE, // State needed to USE the station
    // advancesQuestTo: QUEST_STATE.STEP_5_TRANSPORT_CIT // Advance occurs after talking to Usher with Citrulline
    // Keep null or same state if advancement happens elsewhere
     advancesQuestTo: QUEST_STATE.STEP_4_MAKE_CITRULLINE // Does not advance state on its own
});

createStation("ASS", { x: 6, z: 0 }, 0x00ff00, {
    requires: { 'Citrulline': 1, 'Aspartate': 1, 'ATP': 1 },
    produces: 'Argininosuccinate',
    productColors: { 'Argininosuccinate': argSuccColor },
    requiredQuestState: QUEST_STATE.STEP_7_MAKE_ARGSUCC, // State needed to USE the station
    advancesQuestTo: QUEST_STATE.STEP_8_CLEAVE_ARGSUCC // State AFTER successful use
});

createStation("ASL", { x: 6, z: 5 }, 0x00ced1, {
    requires: { 'Argininosuccinate': 1 },
    produces: ['Arginine', 'Fumarate'],
    productColors: { 'Arginine': arginineColor, 'Fumarate': fumarateColor },
    requiredQuestState: QUEST_STATE.STEP_8_CLEAVE_ARGSUCC, // State needed to USE the station
    advancesQuestTo: QUEST_STATE.STEP_9_MAKE_UREA // State AFTER successful use
});

createStation("ARG1", { x: 10, z: 2 }, 0x0000ff, {
    requires: { 'Arginine': 1 },
    produces: ['Urea', 'Ornithine'],
    productColors: { 'Urea': ureaColor, 'Ornithine': ornithineColor },
    requiredQuestState: QUEST_STATE.STEP_9_MAKE_UREA, // State needed to USE the station
    // advancesQuestTo: QUEST_STATE.STEP_10_RIVER_CHALLENGE // Advance occurs after talking to Prof with Urea
     advancesQuestTo: QUEST_STATE.STEP_9_MAKE_UREA // Does not advance state on its own
});

// ORN T1 Portal
const portalGeometry = new THREE.TorusGeometry(1.5, 0.3, 16, 50);
const portalMaterial = new THREE.MeshStandardMaterial({
    color: 0x00ffff,
    emissive: 0x00aaaa,
    roughness: 0.4,
    metalness: 0.6,
    side: THREE.DoubleSide
});
const ornT1Portal = new THREE.Mesh(portalGeometry, portalMaterial);
ornT1Portal.position.set(portalWallX + 0.25, 1.6, portalWallCenterZ); // Position slightly offset from wall line
ornT1Portal.rotation.y = Math.PI / 2; // Perpendicular to the wall
ornT1Portal.userData = {
    type: 'portal',
    name: 'ORN T1 Portal',
    requiredQuestState: QUEST_STATE.STEP_5_TRANSPORT_CIT, // State required to USE portal
    requires: { 'Citrulline': 1 },
    advancesQuestTo: QUEST_STATE.STEP_6_GATHER_CYTO, // State AFTER successful use
    action: 'transportCitrulline',
    productColor: citrullineColor // Color for spawned Citrulline
};
scene.add(ornT1Portal);
interactiveObjects.push(ornT1Portal);
originalMaterials.set(ornT1Portal, portalMaterial.clone());
const portalLabel = createTextSprite("ORN T1 Portal",
    { x: ornT1Portal.position.x, y: 3.5, z: ornT1Portal.position.z },
    { fontSize: 36, scale: 1.5 }
);
scene.add(portalLabel);

// Portal Barrier
const barrierGeometry = new THREE.PlaneGeometry(portalGapWidth - 0.1, wallHeight - 0.1);
const barrierMaterial = new THREE.MeshStandardMaterial({
    color: 0x00ffff,
    emissive: 0x00aaaa,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
    depthWrite: false // Important for transparency rendering
});
portalBarrier = new THREE.Mesh(barrierGeometry, barrierMaterial);
portalBarrier.position.set(portalWallX, wallHeight / 2, portalWallCenterZ);
portalBarrier.rotation.y = Math.PI / 2; // Rotated to be perpendicular to the wall (align with gap)
portalBarrier.name = "PortalBarrier";
scene.add(portalBarrier);
collidableWalls.push(portalBarrier); // Add to collidables initially
portalBarrier.updateMatrixWorld();
wallBoundingBoxes.push(new THREE.Box3().setFromObject(portalBarrier)); // Add its bounding box

// Resources
createResource('NH3',     { x: -16.5, z: -4 }, 0xffaaaa);
// HCO3 created above cabinet
createResource('ATP',     { x: -10, z: -13 }, 0xffffaa);
createResource('ATP',     { x: -16, z: -13 }, 0xffffaa);
// Remove initial Ornithine spawn - it will be created after talking to Usher in STEP_3
// createResource('Ornithine', { x: -8, z: -6 }, 0xaaccaa);
createResource('Aspartate', { x: 3, z: 2 }, 0xffaaff);
createResource('ATP',       { x: 0, z: 0 }, 0xffffaa); // ATP in cytosol


// --- UI Functions ---
function updateInventoryUI() { inventoryList.innerHTML = ''; let hasItems = false; for (const itemName in inventory) { if (inventory[itemName] > 0) { const li = document.createElement('li'); li.textContent = `${itemName}: ${inventory[itemName]}`; inventoryList.appendChild(li); hasItems = true; } } if (!hasItems) { inventoryList.innerHTML = '<li>Empty</li>'; } }
function showDialogue(text, options = []) { dialogueText.textContent = text; dialogueOptions.innerHTML = ''; options.forEach(opt => { const button = document.createElement('button'); button.textContent = opt.text; button.onclick = () => { hideDialogue(); if (opt.action) opt.action(); }; dialogueOptions.appendChild(button); }); dialogueBox.classList.remove('hidden'); controls.enabled = false; isUserInteracting = true; } // Set isUserInteracting
function hideDialogue() { dialogueBox.classList.add('hidden'); controls.enabled = true; isUserInteracting = false; } // Reset isUserInteracting
function updateQuestUI() { if (currentQuest) { questNameUI.textContent = currentQuest.name; questObjectiveUI.textContent = currentQuest.objectives[currentQuest.state] || 'Completed!'; } else { questNameUI.textContent = 'None'; questObjectiveUI.textContent = 'Find and speak with Professor Hepaticus.'; } }
function showFeedback(message, duration = 2500) { const feedback = document.createElement('div'); feedback.style.position = 'absolute'; feedback.style.bottom = '150px'; feedback.style.left = '50%'; feedback.style.transform = 'translateX(-50%)'; feedback.style.backgroundColor = 'rgba(0, 0, 0, 0.8)'; feedback.style.color = 'white'; feedback.style.padding = '10px 20px'; feedback.style.borderRadius = '5px'; feedback.textContent = message; feedback.style.pointerEvents = 'none'; feedback.style.zIndex = '10'; uiContainer.appendChild(feedback); setTimeout(() => { if (feedback.parentNode) feedback.parentNode.removeChild(feedback); }, duration); }
function showInteractionPrompt(objectName) { if (interactionPrompt) { interactionText.textContent = objectName; interactionPrompt.classList.remove('hidden'); } }
function hideInteractionPrompt() { if (interactionPrompt) { interactionPrompt.classList.add('hidden'); } }


// --- Inventory Functions ---
function addToInventory(itemName, quantity = 1) { inventory[itemName] = (inventory[itemName] || 0) + quantity; updateInventoryUI(); }
function removeFromInventory(itemName, quantity = 1) { if (inventory[itemName] && inventory[itemName] >= quantity) { inventory[itemName] -= quantity; if (inventory[itemName] === 0) delete inventory[itemName]; updateInventoryUI(); return true; } return false; }
function hasItems(requiredItems) { for (const itemName in requiredItems) { if (!inventory[itemName] || inventory[itemName] < requiredItems[itemName]) { return false; } } return true; }

// --- Quest Functions ---
function startQuest(quest) { if (!currentQuest) { currentQuest = quest; currentQuest.state = QUEST_STATE.STEP_1_GATHER_MITO; updateQuestUI(); showFeedback(`Quest Started: ${quest.name}`); } }
function advanceQuest(quest, newState) {
    if (currentQuest && currentQuest.id === quest.id && currentQuest.state !== newState) { // Prevent re-advancing to same state
        console.log(`Advancing quest ${quest.id} from ${currentQuest.state} to ${newState}`);
        currentQuest.state = newState;
        updateQuestUI();
        if (newState === QUEST_STATE.COMPLETED) {
            const rewardPoints = quest.rewards?.knowledgePoints || 0;
            showFeedback(`Quest Complete: ${quest.name}! +${rewardPoints} KP`, 5000);
            // Small delay before clearing quest to allow UI updates/feedback
            setTimeout(() => {
                if(currentQuest && currentQuest.state === QUEST_STATE.COMPLETED) { // Check state again
                     currentQuest = null;
                     updateQuestUI(); // Update UI to show no quest
                }
            }, 100);
        } else {
             // Optional: Feedback on step change
             // showFeedback(`Objective Updated: ${currentQuest.objectives[newState]}`);
        }
    } else if (currentQuest && currentQuest.id === quest.id && currentQuest.state === newState) {
        // console.log(`Quest ${quest.id} already in state ${newState}. No advancement.`);
    }
}


// --- Reality River Functions ---
function startRealityRiver() { currentRiverQuestionIndex = 0; riverCorrectAnswers = 0; realityRiverUI.classList.remove('hidden'); displayRiverQuestion(); updateRiverProgress(); controls.enabled = false; isUserInteracting = true; } // Set isUserInteracting
function displayRiverQuestion() { if (currentRiverQuestionIndex >= ureaRiverQuestions.length) { endRealityRiver(true); return; } const qData = ureaRiverQuestions[currentRiverQuestionIndex]; riverQuestionUI.textContent = qData.q; riverAnswersUI.innerHTML = ''; riverFeedbackUI.textContent = ''; qData.a.forEach((answer, index) => { const button = document.createElement('button'); button.textContent = answer; button.onclick = () => checkRiverAnswer(index); riverAnswersUI.appendChild(button); }); }
function checkRiverAnswer(selectedIndex) { const qData = ureaRiverQuestions[currentRiverQuestionIndex]; if (selectedIndex === qData.correct) { riverFeedbackUI.textContent = "Correct! Moving forward..."; riverFeedbackUI.style.color = 'lightgreen'; riverCorrectAnswers++; currentRiverQuestionIndex++; updateRiverProgress(); const buttons = riverAnswersUI.querySelectorAll('button'); buttons.forEach(b => b.disabled = true); setTimeout(() => { if (currentRiverQuestionIndex >= ureaRiverQuestions.length) { endRealityRiver(true); } else { displayRiverQuestion(); } }, 1000); } else { riverFeedbackUI.textContent = "Not quite. Think about the process..."; riverFeedbackUI.style.color = 'lightcoral'; } }
function updateRiverProgress() { let progress = "["; const totalSteps = ureaRiverQuestions.length; for(let i = 0; i < totalSteps; i++) { progress += (i < riverCorrectAnswers) ? "■" : "□"; } progress += "]"; riverProgressUI.textContent = progress; }
function endRealityRiver(success) { realityRiverUI.classList.add('hidden'); controls.enabled = true; isUserInteracting = false; // Reset isUserInteracting
    if (success) { showDialogue("Impressive! You've navigated the Urea Cycle...", [ { text: "Great!", action: () => advanceQuest(ureaCycleQuest, QUEST_STATE.COMPLETED) } ]); } else { showDialogue("Hmm, seems you need to review...", [ { text: "Okay" } ]); } }

// --- Helper: Remove Portal Barrier ---
function removePortalBarrier() {
    if (portalBarrier && portalBarrier.parent === scene) { // Check it exists and is in scene
        console.log("Attempting to remove portal barrier...");
        // Remove from collision checks
        const barrierIndex = collidableWalls.indexOf(portalBarrier);
        if (barrierIndex > -1) {
            collidableWalls.splice(barrierIndex, 1);
            console.log("Removed barrier from collidableWalls array.");
        } else {
            console.warn("Portal barrier mesh not found in collidableWalls array.");
        }

        // Find and remove the corresponding bounding box
        const boxIndexToRemove = wallBoundingBoxes.findIndex(box => {
             // Comparing center might be unreliable if box wasn't updated perfectly
             // Check if the box dimensions and approximate position match the barrier
             const boxCenter = new Vector3(); box.getCenter(boxCenter);
             const boxSize = new Vector3(); box.getSize(boxSize);
             const barrierSize = portalBarrier.geometry.parameters; // Approx size
             return boxCenter.distanceToSquared(portalBarrier.position) < 0.1 &&
                    Math.abs(boxSize.x - barrierSize.width) < 0.1 &&
                    Math.abs(boxSize.y - barrierSize.height) < 0.1;
         });
         if (boxIndexToRemove > -1) {
            wallBoundingBoxes.splice(boxIndexToRemove, 1);
            console.log("Removed barrier bounding box from wallBoundingBoxes array.");
         } else {
             console.warn("Could not find portal barrier bounding box to remove accurately.");
             // Fallback: Try removing any box near the portal's position as a last resort
             const fallbackIndex = wallBoundingBoxes.findIndex(box => {
                 const boxCenter = new Vector3(); box.getCenter(boxCenter);
                 return boxCenter.distanceToSquared(portalBarrier.position) < 1.0;
             });
             if (fallbackIndex > -1) {
                 wallBoundingBoxes.splice(fallbackIndex, 1);
                 console.log("Removed barrier bounding box via fallback position check.");
             } else {
                 console.warn("Fallback check also failed to find barrier bounding box.");
             }
         }

        // Remove visually
        scene.remove(portalBarrier);
        // Optionally dispose geometry/material if not reused
        portalBarrier.geometry.dispose();
        portalBarrier.material.dispose();
        portalBarrier = null; // Clear reference
        showFeedback("Pathway to Cytosol is now open!");
        console.log("Portal barrier removed from scene.");
    } else {
         console.log("Portal barrier already removed or doesn't exist.");
    }
}


// --- Interaction Logic (Triggered by 'E' key press) ---
function interactWithObject(object) {
    if (!object || isUserInteracting) return; // Prevent interaction if UI is active
    const userData = object.userData;

    // --- NPC Interactions ---
    if (userData.type === 'npc' && userData.name === 'Professor Hepaticus') {
        isUserInteracting = true; // Pause game for dialogue
        if (currentQuest && currentQuest.id === 'ureaCycle') {
             // Check for Urea in inventory for final step trigger only when in the appropriate preceding state
            if (currentQuest.state === QUEST_STATE.STEP_9_MAKE_UREA && hasItems({ 'Urea': 1 })) {
                // Advance state *before* showing dialogue that depends on the new state
                // currentQuest.state = QUEST_STATE.STEP_10_RIVER_CHALLENGE; // Advance state first
                // updateQuestUI(); // Update UI immediately
                showDialogue("Excellent work converting that ammonia and producing Urea! Now, can you recall the steps? Cross the River of Recall!", [
                    { text: "Let's do it!", action: () => {
                        advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_10_RIVER_CHALLENGE); // Advance state ON action
                        startRealityRiver();
                        // isUserInteracting remains true during river game
                    }},
                    { text: "Not yet.", action: () => { isUserInteracting = false; } } // Unpause if declined
                ]);
            } else if (currentQuest.state === QUEST_STATE.STEP_10_RIVER_CHALLENGE) {
                 showDialogue("Ready to test your knowledge on the Urea Cycle?", [
                     { text: "Yes, start the challenge!", action: () => startRealityRiver() }, // isUserInteracting remains true
                     { text: "Give me a moment.", action: () => { isUserInteracting = false; } } // Unpause
                 ]);
            } else if (currentQuest.state === QUEST_STATE.COMPLETED) {
                 showDialogue("Thanks again for helping clear the ammonia!", [{ text: "You're welcome.", action: () => { isUserInteracting = false; } }]); // Unpause on close
            } else {
                 // Show current objective if quest active but not at a specific interaction point
                 showDialogue(`Current Objective: ${currentQuest.objectives[currentQuest.state]}`, [{ text: "Okay", action: () => { isUserInteracting = false; } }]); // Unpause
            }
        } else if (!currentQuest) {
             // Start the quest
             showDialogue("The cell is overwhelmed with ammonia! We need to convert it to Urea. Can you help?", [
                 { text: "Accept Quest", action: () => { startQuest(ureaCycleQuest); isUserInteracting = false; } }, // Start quest and unpause
                 { text: "Decline", action: () => { isUserInteracting = false; } } // Unpause
             ]);
        } else {
             // A different quest is active? Or some other edge case.
             isUserInteracting = false; // Unpause if no specific interaction
        }
    }
    else if (userData.type === 'npc' && userData.name === 'Ornithine Usher') {
        isUserInteracting = true; // Pause game for dialogue
        if (currentQuest && currentQuest.id === 'ureaCycle') {
            if (currentQuest.state === QUEST_STATE.STEP_3_MEET_USHER) {
                // First interaction - explain Ornithine and give it
                showDialogue("Ah, you've made Carbamoyl Phosphate! You'll need Ornithine next...", [ // Shortened text
                    { text: "Can I have some Ornithine?", action: () => {
                        const ornithineSpawnPos = { x: -8, z: -6 }; // Defined position
                        createResource('Ornithine', ornithineSpawnPos, ornithineColor, { initialY: 0.6});
                        showFeedback("Ornithine has appeared nearby!");
                        advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_4_MAKE_CITRULLINE);
                        isUserInteracting = false; // Unpause after action
                    }},
                    { text: "Tell me more...", action: () => { // Nested dialogue needs careful handling of isUserInteracting
                        showDialogue("Ornithine gets recycled... It's consumed when making Citrulline, but regenerated later...", [
                            { text: "I see! Can I have some?", action: () => {
                                const ornithineSpawnPos = { x: -8, z: -6 };
                                createResource('Ornithine', ornithineSpawnPos, ornithineColor, { initialY: 0.6 });
                                showFeedback("Ornithine has appeared nearby!");
                                advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_4_MAKE_CITRULLINE);
                                // isUserInteracting remains true until this inner dialogue is closed
                                // The button click automatically calls hideDialogue, which sets it to false.
                            }}
                        ]);
                        // Don't set isUserInteracting = false here, let inner dialogue handle it
                    }}
                ]);
            } else if (currentQuest.state === QUEST_STATE.STEP_4_MAKE_CITRULLINE) {
                const hasCitrulline = hasItems({ 'Citrulline': 1 });
                if (hasCitrulline) {
                    // Player has Citrulline, remove barrier and advance state
                    removePortalBarrier(); // Remove the physical barrier
                    advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_5_TRANSPORT_CIT); // Advance to transport step
                    showDialogue("Excellent! You've made Citrulline. The pathway is now open! Use the ORN T1 Portal...", [
                        { text: "Let's transport Citrulline", action: () => { isUserInteracting = false; } } // Unpause
                        // Add "Tell me more" option if needed
                    ]);
                } else {
                    // Player in step 4 but hasn't made Citrulline yet
                    showDialogue("You'll need to make and collect Citrulline first. Use the OTC station...", [{ text: "Got it", action: () => { isUserInteracting = false; } }]); // Unpause
                }
            } else if (currentQuest.state === QUEST_STATE.STEP_5_TRANSPORT_CIT) {
                // Player needs to use the portal
                showDialogue("The pathway is open! Use the ORN T1 Portal with your Citrulline to transport it...", [{ text: "Will do!", action: () => { isUserInteracting = false; } }]); // Unpause
            } else if (cytosolStates.includes(currentQuest.state)) {
                // Player is in later steps (cytosol)
                showDialogue("You've successfully transported Citrulline to the cytosol. Well done!", [{ text: "Thanks!", action: () => { isUserInteracting = false; } }]); // Unpause
            } else {
                // Player is in an earlier state (e.g., Step 1 or 2)
                showDialogue("Come back when you've made Carbamoyl Phosphate at the CPS1 station.", [{ text: "Okay", action: () => { isUserInteracting = false; } }]); // Unpause
            }
        } else {
            // No quest active, or different quest
            showDialogue("Greetings! I manage the ORN T1 antiport.", [{ text: "Interesting.", action: () => { isUserInteracting = false; } }]); // Unpause
        }
    }

    // --- Resource Interaction ---
    else if (userData.type === 'resource') {
        // No dialogue, interaction is instant
        addToInventory(userData.name, 1);
        showFeedback(`Collected ${userData.name}`);

        // Quest advancement check for gathering step
        if (currentQuest &&
            currentQuest.id === 'ureaCycle' &&
            currentQuest.state === QUEST_STATE.STEP_1_GATHER_MITO &&
            hasItems({ 'NH3': 1, 'HCO3': 1, 'ATP': 2 })) {
            advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_2_MAKE_CARB_PHOS);
            showFeedback("All materials gathered! Head to the CPS1 station.");
        }
        // Add similar check for STEP_6_GATHER_CYTO if needed, based on items collected
        if (currentQuest &&
            currentQuest.id === 'ureaCycle' &&
            currentQuest.state === QUEST_STATE.STEP_6_GATHER_CYTO &&
            hasItems({ 'Citrulline': 1, 'Aspartate': 1, 'ATP': 1 })) {
             advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_7_MAKE_ARGSUCC); // Ready for ASS station
             showFeedback("Cytosol materials gathered! Head to the ASS station.");
        }


        // Remove object from world AFTER checks
        scene.remove(userData.object3D);
        const index = interactiveObjects.indexOf(object); // Use the object passed to function
         if (index > -1) interactiveObjects.splice(index, 1);
        const meshIndex = resourceMeshes.indexOf(object);
         if (meshIndex > -1) resourceMeshes.splice(meshIndex, 1);
        originalMaterials.delete(object); // Remove material backup

        // Clear closest object if it was the one collected
        if (closestInteractiveObject === object) {
             closestInteractiveObject = null;
             lastClosestObject = null; // Prevent unhighlighting disposed object
             hideInteractionPrompt();
         }
         // No need to set isUserInteracting = false, as it wasn't set true for resources
    }

    // --- Station Interaction ---
    else if (userData.type === 'station') {
        // No dialogue, interaction is instant feedback

        if (!currentQuest || currentQuest.id !== 'ureaCycle') {
            showFeedback("Quest not active or not the Urea Cycle quest.");
            return; // Exit interaction
        }

        // Check if we are in the correct state to use the station
        if (currentQuest.state !== userData.requiredQuestState) {
             showFeedback(`Incorrect step for ${userData.name}. Current objective: ${currentQuest.objectives[currentQuest.state]}`);
             return; // Exit interaction
        }

        // Check if player has required items
        if (hasItems(userData.requires)) {
            let consumed = true;
            // Consume required items
            for (const itemName in userData.requires) {
                if (!removeFromInventory(itemName, userData.requires[itemName])) {
                    consumed = false;
                    console.error("Inventory inconsistency!");
                    showFeedback("Inventory error!", 2000); // Show error feedback
                    break;
                }
            }

            if (consumed) {
                showFeedback(`Using ${userData.name}... Reaction occurring!`);

                // Spawn products
                let producedItems = [];
                if (typeof userData.produces === 'string') {
                    producedItems = [userData.produces];
                } else if (Array.isArray(userData.produces)) {
                    producedItems = userData.produces;
                }

                // Calculate spawn position relative to station
                const spawnOffset = new THREE.Vector3(0, 0, 1.5); // Offset in front of station
                 const spawnRotation = new THREE.Quaternion(); // Get station's world rotation
                 object.getWorldQuaternion(spawnRotation);
                 spawnOffset.applyQuaternion(spawnRotation); // Rotate offset

                 const spawnBasePos = object.position.clone();
                 let spawnPos = spawnBasePos.add(spawnOffset);
                 spawnPos.y = 0.6; // Set spawn height


                producedItems.forEach((item, i) => {
                    const itemColorHex = userData.productColors ? userData.productColors[item] : 0xffffff;
                    const itemColor = parseInt(itemColorHex); // Ensure it's a number

                    if (item && item !== 'Fumarate') {
                         // Offset multiple items slightly
                         const multiOffset = new THREE.Vector3((i - (producedItems.length -1)/2) * 0.6, 0, 0); // Spread items side-to-side
                         multiOffset.applyQuaternion(spawnRotation);
                         const finalSpawnPos = spawnPos.clone().add(multiOffset);

                         createResource(item, { x: finalSpawnPos.x, z: finalSpawnPos.z }, itemColor, { initialY: 0.6 });
                         showFeedback(`${item} has appeared near the station!`);
                    } else if (item === 'Fumarate') {
                        showFeedback(`Byproduct Fumarate produced (links to other pathways).`);
                    }
                });

                // Advance quest state if defined for this station
                if (userData.advancesQuestTo) {
                    advanceQuest(ureaCycleQuest, userData.advancesQuestTo);
                    // updateQuestUI is called within advanceQuest
                }

                 // Specific check AFTER producing Urea
                 if (userData.name === "ARG1" && producedItems.includes("Urea")) {
                     showFeedback("Urea produced! Return to Professor Hepaticus.");
                     // Quest state remains STEP_9_MAKE_UREA, but player now has Urea
                     // Interaction with Professor will check inventory and state
                 }

                 // Specific check AFTER producing Ornithine with Urea
                  if (userData.name === "ARG1" && producedItems.includes("Ornithine")) {
                       // Ornithine is regenerated, can be collected again if needed elsewhere.
                  }


            } // End if consumed
        } else {
            // Calculate and show missing items
            let missing = "Missing: ";
            let first = true;
            for (const itemName in userData.requires) {
                const requiredAmount = userData.requires[itemName];
                const currentAmount = inventory[itemName] || 0;
                if (currentAmount < requiredAmount) {
                    missing += `${first ? '' : ', '}${requiredAmount - currentAmount} ${itemName}`;
                    first = false;
                }
            }
            showFeedback(missing);
        }
         // No need to set isUserInteracting = false, as it wasn't set true for stations
    }

    // --- Portal Interaction ---
    else if (userData.type === 'portal' && userData.name === 'ORN T1 Portal') {
        // No dialogue, instant interaction

        if (!currentQuest || currentQuest.id !== 'ureaCycle') {
            showFeedback("Quest not active or portal not relevant.");
            return;
        }

        // Check if we are in the correct state to use the portal
        if (currentQuest.state !== QUEST_STATE.STEP_5_TRANSPORT_CIT) {
             showFeedback(`Portal cannot be used yet. Current objective: ${currentQuest.objectives[currentQuest.state]}`);
             return;
        }

        // Check if we have Citrulline
        if (hasItems(userData.requires)) {

            // Consume Citrulline from inventory FIRST
            if (!removeFromInventory('Citrulline', 1)) {
                 console.error("Failed to remove Citrulline for portal use!");
                 showFeedback("Error using portal!", 2000);
                 return;
            }

            showFeedback("Activating ORN T1 Portal...");

            // Visual effect for the portal mesh
            const portalMesh = object; // The portal mesh itself
             if (originalMaterials.has(portalMesh)) {
                 const originalEmissive = originalMaterials.get(portalMesh).emissive.getHex();
                 portalMesh.material.emissive.setHex(0xffffff); // Flash white
                 setTimeout(() => {
                     // Check if portal still exists and has material before resetting
                     if (portalMesh && portalMesh.material && originalMaterials.has(portalMesh)) {
                          portalMesh.material.emissive.setHex(originalEmissive);
                     }
                 }, 200);
             }

            // Spawn Citrulline in cytosol side of the portal
             // Position relative to the portal's location
            const spawnPos = { x: portalMesh.position.x + 1.5, z: portalMesh.position.z }; // Adjusted position in cytosol
            const spawnColor = userData.productColor || citrullineColor; // Use color from userData or default
             createResource('Citrulline', spawnPos, spawnColor, {initialY: 0.6});
            showFeedback("Citrulline transported! Collect it in the Cytosol to continue.");

             // Advance quest state AFTER successful transport and spawning
             if (userData.advancesQuestTo) {
                 advanceQuest(ureaCycleQuest, userData.advancesQuestTo);
                 // updateQuestUI is called within advanceQuest
             }

        } else {
            showFeedback("Missing: Citrulline");
        }
         // No need to set isUserInteracting = false
    }

     // If interaction occurred but wasn't handled (e.g. non-interactive object somehow triggered), reset flag
     if (isUserInteracting && dialogueBox.classList.contains('hidden') && realityRiverUI.classList.contains('hidden')) {
         isUserInteracting = false;
     }


} // End interactWithObject


// --- Event Listeners ---
document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    keysPressed[key] = true;
    // Only allow interaction if not in dialogue/river AND interaction key ('e') is pressed
    if (key === 'e' && closestInteractiveObject && !isUserInteracting) {
        interactWithObject(closestInteractiveObject);
    }
});
document.addEventListener('keyup', (event) => { keysPressed[event.key.toLowerCase()] = false; });
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });


// --- Animation Loop ---
const clock = new THREE.Clock();

// --- Camera Control Variables ---
const cameraIdealOffset = new THREE.Vector3(0, 8, -10); // Adjusted for better view (behind and up)
const cameraIdealLookAt = new THREE.Vector3(0, 1.5, 0); // Look slightly above player feet/center mass
const cameraPositionSmoothFactor = 0.08; // Controls how fast camera moves to target position (lower = smoother)
const cameraTargetSmoothFactor = 0.1; // Controls how fast camera lookAt target moves (lower = smoother)

// Reusable vectors for performance
const playerWorldPos = new THREE.Vector3();
const cameraTargetPos = new THREE.Vector3();      // Where the camera should ideally be
const cameraTargetLookAt = new THREE.Vector3();   // Where the camera should ideally look
const cameraForward = new THREE.Vector3();        // Player/Movement forward relative to camera
const cameraRight = new THREE.Vector3();          // Player/Movement right relative to camera
const moveDirection = new THREE.Vector3();        // Final calculated move direction in world space
const playerVelocity = new THREE.Vector3();       // Player's velocity for the current frame
const targetQuaternion = new THREE.Quaternion();  // Target rotation for the player model
const upVector = new THREE.Vector3(0, 1, 0);      // World up direction


function checkCollision(nextPos) {
    // Update player's bounding box based on the potential next position
    playerBoundingBox.setFromCenterAndSize(
        nextPos.clone().add(new Vector3(0, playerHeight / 2, 0)), // Center the box vertically based on player height
        new Vector3(playerRadius * 2, playerHeight, playerRadius * 2) // Box dimensions
    );

    // Check for intersection with each wall's bounding box
    for (const wallBox of wallBoundingBoxes) {
        if (playerBoundingBox.intersectsBox(wallBox)) {
            return true; // Collision detected
        }
    }
    return false; // No collision
}

function highlightObject(object) {
    if (!object) return; // Safety check

    // Handle Groups (like Professor) - find the main mesh to highlight
    if (object instanceof THREE.Group) {
         // Find a prominent mesh, e.g., the 'coat' or 'body'
         const meshToHighlight = object.children.find(child => child instanceof THREE.Mesh && (child.name === 'coat' || child.name === 'body' || child.material)); // Fallback to any mesh with material
         if (meshToHighlight && meshToHighlight.material) {
             if (!originalMaterials.has(meshToHighlight)) {
                 originalMaterials.set(meshToHighlight, meshToHighlight.material.clone());
             }
             // Check if material is MeshStandardMaterial or similar before setting emissive
             if (meshToHighlight.material.emissive) {
                 meshToHighlight.material.emissive.copy(highlightMaterial.emissive);
                 meshToHighlight.material.emissiveIntensity = highlightMaterial.emissiveIntensity;
                 meshToHighlight.material.needsUpdate = true;
             }
         }
         return; // Done handling group
    }

     // Handle single Meshes
     if (object instanceof THREE.Mesh && object.material) {
         if (!originalMaterials.has(object)) {
             originalMaterials.set(object, object.material.clone()); // Store original material state
         }
         // Check if material supports emissive property
         if (object.material.emissive) {
            object.material.emissive.copy(highlightMaterial.emissive);
            object.material.emissiveIntensity = highlightMaterial.emissiveIntensity;
            object.material.needsUpdate = true; // Important for changes to take effect
         }
     }
}

function unhighlightObject(object) {
     if (!object) return; // Safety check

     // Handle Groups
     if (object instanceof THREE.Group) {
         const meshToUnhighlight = object.children.find(child => child instanceof THREE.Mesh && originalMaterials.has(child)); // Find the mesh we stored material for
         if (meshToUnhighlight && meshToUnhighlight.material && meshToUnhighlight.material.emissive) {
             const originalMat = originalMaterials.get(meshToUnhighlight);
             meshToUnhighlight.material.emissive.copy(originalMat.emissive); // Restore original emissive color
             meshToUnhighlight.material.emissiveIntensity = originalMat.emissiveIntensity; // Restore original intensity
             meshToUnhighlight.material.needsUpdate = true;
         }
         // Note: We don't remove from originalMaterials map here, allows re-highlighting
         return; // Done handling group
     }

     // Handle single Meshes
      if (object instanceof THREE.Mesh && object.material && object.material.emissive && originalMaterials.has(object)) {
          const originalMat = originalMaterials.get(object);
          object.material.emissive.copy(originalMat.emissive);
          object.material.emissiveIntensity = originalMat.emissiveIntensity;
          object.material.needsUpdate = true;
      }
}


function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1); // Clamp delta to prevent large jumps if tab loses focus
    const elapsedTime = clock.elapsedTime;

    // --- Player Movement ---
    let moveZ = 0; let moveX = 0;
    if (!isUserInteracting) { // Only allow movement if not in dialogue/UI interaction
        if (keysPressed['w'] || keysPressed['arrowup']) moveZ = 1;
        if (keysPressed['s'] || keysPressed['arrowdown']) moveZ = -1;
        if (keysPressed['a'] || keysPressed['arrowleft']) moveX = 1; // Turn Left relative to camera
        if (keysPressed['d'] || keysPressed['arrowright']) moveX = -1; // Turn Right relative to camera
    }

    playerVelocity.set(0, 0, 0); // Reset velocity each frame
    moveDirection.set(0, 0, 0); // Reset move direction

    const playerIsMoving = moveX !== 0 || moveZ !== 0;

    if (playerIsMoving) {
        // Get camera's forward direction vector (ignore y-component)
        camera.getWorldDirection(cameraForward);
        cameraForward.y = 0;
        cameraForward.normalize();

        // Get camera's right direction vector
        cameraRight.crossVectors(upVector, cameraForward).normalize(); // Right = Up x Forward (adjust if coordinate system differs)

        // Calculate movement direction based on input relative to camera
        moveDirection.addScaledVector(cameraForward, moveZ); // Move forward/backward based on camera direction
        moveDirection.addScaledVector(cameraRight, moveX);   // Move left/right based on camera direction
        moveDirection.normalize(); // Ensure consistent speed regardless of direction

        // Calculate velocity for this frame
        playerVelocity.copy(moveDirection).multiplyScalar(playerSpeed * delta);

        // --- Collision Detection & Resolution (Simple Slide) ---
        const currentPos = player.position.clone();

        // Try moving along X axis
        const nextPosX = currentPos.clone().add(new THREE.Vector3(playerVelocity.x, 0, 0));
        if (!checkCollision(nextPosX)) {
            player.position.x = nextPosX.x;
        } else {
            playerVelocity.x = 0; // Stop X movement if collision
        }

        // Try moving along Z axis (using potentially updated X position)
        const nextPosZ = player.position.clone().add(new THREE.Vector3(0, 0, playerVelocity.z));
        if (!checkCollision(nextPosZ)) {
            player.position.z = nextPosZ.z;
        } else {
            playerVelocity.z = 0; // Stop Z movement if collision
        }

        // --- Player Rotation ---
        if (moveDirection.lengthSq() > 0.001) { // Only rotate if moving significantly
            // Calculate target quaternion to face the movement direction
            targetQuaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), moveDirection); // Assumes model's default forward is +Z

            // Smoothly interpolate player's rotation towards the target rotation
            player.quaternion.slerp(targetQuaternion, 0.2); // Adjust 0.2 for turning speed (higher = faster)
        }
    }

    // --- Proximity Interaction Check ---
    // Run this check even if player isn't moving, but NOT if user is interacting with UI
    if (!isUserInteracting) {
        let minDistSq = interactionRadius * interactionRadius;
        let foundClosest = null;
        player.getWorldPosition(playerWorldPos); // Get player's current world position

        interactiveObjects.forEach(obj => {
            // Ensure object is still valid and in the scene
             if (obj && obj.parent === scene && obj.visible) {
                let objPos = new Vector3();
                 // Get world position correctly for Groups vs Meshes
                 if (obj instanceof THREE.Group) {
                     // For groups, often the group's position is the reference point
                     objPos.copy(obj.position); // Assumes group position is meaningful anchor
                 } else if (obj instanceof THREE.Mesh) {
                     obj.getWorldPosition(objPos); // Get mesh's world position
                 } else {
                     return; // Skip if not Group or Mesh
                 }

                const distSq = playerWorldPos.distanceToSquared(objPos);
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    foundClosest = obj;
                }
            }
        });

        // Update highlighting and prompt based on closest object found
        if (foundClosest !== closestInteractiveObject) {
            if (closestInteractiveObject) {
                unhighlightObject(closestInteractiveObject); // Unhighlight the previous closest
            }
            if (foundClosest) {
                highlightObject(foundClosest); // Highlight the new closest
                showInteractionPrompt(foundClosest.userData.name || 'Object'); // Show prompt
            } else {
                hideInteractionPrompt(); // Hide prompt if nothing is close
            }
            lastClosestObject = closestInteractiveObject; // Keep track of the last object for unhighlighting if needed
            closestInteractiveObject = foundClosest; // Update the current closest object
        }
    } else {
        // If user is interacting with UI, ensure nothing is highlighted and prompt is hidden
        if (closestInteractiveObject) {
             unhighlightObject(closestInteractiveObject);
             closestInteractiveObject = null;
        }
         if (lastClosestObject) { // Also unhighlight the last one if interaction started suddenly
             unhighlightObject(lastClosestObject);
             lastClosestObject = null;
         }
        hideInteractionPrompt();
    }


    // --- Resource Hover Animation ---
    const hoverSpeed = 2; const hoverAmount = 0.2;
    resourceMeshes.forEach((resource, index) => {
        // Check if resource still exists and has the necessary data
        if (resource && resource.parent === scene && resource.userData?.initialY !== undefined) {
            const yPos = resource.userData.initialY + Math.sin(elapsedTime * hoverSpeed + index * 0.5) * hoverAmount;
            // Ensure the calculated position is valid before applying
            if (!isNaN(yPos)) {
                 resource.position.y = yPos;
            }
        }
    });


    // --- Third-Person Camera Logic ---
    // Always update camera based on player, even during interaction (dialogue etc.)
    // unless specific pausing logic is implemented elsewhere. OrbitControls are disabled for user input.
    player.getWorldPosition(playerWorldPos); // Get player's updated world position

    // Calculate Ideal Camera Position: Start with offset, rotate it by player's rotation, then add player position
    cameraTargetPos.copy(cameraIdealOffset);
    cameraTargetPos.applyQuaternion(player.quaternion); // Rotate offset vector by player's rotation
    cameraTargetPos.add(playerWorldPos); // Add player's world position

    // Calculate Ideal LookAt Target: Player position + vertical offset
    cameraTargetLookAt.copy(playerWorldPos).add(cameraIdealLookAt);

    // Smoothly interpolate camera position and target (Lerp)
    // Only lerp if not actively interacting with UI that should freeze camera
    if (!isUserInteracting) { // Only lerp camera if game is not paused by UI
        camera.position.lerp(cameraTargetPos, cameraPositionSmoothFactor);
        controls.target.lerp(cameraTargetLookAt, cameraTargetSmoothFactor);
    } else {
         // If interacting, maybe snap camera or just stop lerping?
         // Snapping might be jarring. Stopping lerp keeps it where it was.
         // Let's keep it simple: Don't lerp if isUserInteracting is true.
         // Ensure controls.target is updated even if not lerping, so OrbitControls doesn't fight it.
         controls.target.copy(cameraTargetLookAt); // Keep target updated even if position doesn't lerp
    }


    // Apply OrbitControls damping AFTER manual calculations if damping is enabled
    controls.update(delta); // This applies damping and updates internal state

    renderer.render(scene, camera);
}

// --- Initial Setup Calls ---
updateInventoryUI();
updateQuestUI();
// Set initial camera position and lookAt based on player start
player.getWorldPosition(playerWorldPos);
const initialCamPos = cameraIdealOffset.clone().applyQuaternion(player.quaternion).add(playerWorldPos);
const initialLookAt = playerWorldPos.clone().add(cameraIdealLookAt);
camera.position.copy(initialCamPos);
controls.target.copy(initialLookAt);
camera.lookAt(controls.target);
controls.update(); // Initialize OrbitControls state

loadingScreen.classList.add('hidden'); // Hide loading screen once setup is done
animate(); // Start the animation loop

console.log("Metabolon RPG Initialized (Original Single File Version).");
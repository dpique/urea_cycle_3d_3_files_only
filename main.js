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

// --- Audio Setup ---
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let backgroundMusic = null;
let isMusicPlaying = false;

// GameBoy-style sound generator
function createGameBoySound(type) {
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    switch(type) {
        case 'collect':
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.15);
            break;
        case 'interact':
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.2);
            break;
        case 'success':
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.3);
            break;
    }
}

function startBackgroundMusic(patternType = 'default') {
    if (isMusicPlaying) return;
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    const masterGain = audioContext.createGain();
    masterGain.gain.value = 0.02;
    masterGain.connect(audioContext.destination);
    const bassOsc = audioContext.createOscillator();
    const leadOsc = audioContext.createOscillator();
    const padOsc = audioContext.createOscillator();
    bassOsc.type = 'sine'; leadOsc.type = 'sine'; padOsc.type = 'sine';
    const bassGain = audioContext.createGain();
    const leadGain = audioContext.createGain();
    const padGain = audioContext.createGain();
    bassOsc.connect(bassGain); leadOsc.connect(leadGain); padOsc.connect(padGain);
    bassGain.connect(masterGain); leadGain.connect(masterGain); padGain.connect(masterGain);
    const patterns = {
        default: [
            [ { bass: 261.63, lead: 523.25, pad: 392.00 }, { bass: 293.66, lead: 587.33, pad: 440.00 }, { bass: 329.63, lead: 659.25, pad: 493.88 }, { bass: 349.23, lead: 698.46, pad: 523.25 } ],
            [ { bass: 261.63, lead: 392.00, pad: 523.25 }, { bass: 293.66, lead: 440.00, pad: 587.33 }, { bass: 329.63, lead: 493.88, pad: 659.25 }, { bass: 349.23, lead: 523.25, pad: 698.46 } ],
            [ { bass: 392.00, lead: 523.25, pad: 659.25 }, { bass: 349.23, lead: 493.88, pad: 587.33 }, { bass: 329.63, lead: 440.00, pad: 523.25 }, { bass: 293.66, lead: 392.00, pad: 493.88 } ],
            [ { bass: 261.63, lead: 392.00, pad: 523.25 }, { bass: 293.66, lead: 440.00, pad: 587.33 }, { bass: 329.63, lead: 493.88, pad: 659.25 }, { bass: 349.23, lead: 523.25, pad: 698.46 } ],
            [ { bass: 392.00, lead: 523.25, pad: 659.25 }, { bass: 440.00, lead: 587.33, pad: 698.46 }, { bass: 493.88, lead: 659.25, pad: 783.99 }, { bass: 523.25, lead: 698.46, pad: 880.00 } ],
            [ { bass: 261.63, lead: 329.63, pad: 392.00 }, { bass: 293.66, lead: 349.23, pad: 440.00 }, { bass: 329.63, lead: 392.00, pad: 493.88 }, { bass: 349.23, lead: 440.00, pad: 523.25 } ],
            [ { bass: 392.00, lead: 493.88, pad: 587.33 }, { bass: 440.00, lead: 523.25, pad: 659.25 }, { bass: 493.88, lead: 587.33, pad: 698.46 }, { bass: 523.25, lead: 659.25, pad: 783.99 } ],
            [ { bass: 261.63, lead: 392.00, pad: 493.88 }, { bass: 293.66, lead: 440.00, pad: 523.25 }, { bass: 329.63, lead: 493.88, pad: 587.33 }, { bass: 349.23, lead: 523.25, pad: 659.25 } ],
            [ { bass: 392.00, lead: 523.25, pad: 659.25 }, { bass: 440.00, lead: 587.33, pad: 698.46 }, { bass: 493.88, lead: 659.25, pad: 783.99 }, { bass: 523.25, lead: 698.46, pad: 880.00 } ],
            [ { bass: 261.63, lead: 329.63, pad: 392.00 }, { bass: 293.66, lead: 349.23, pad: 440.00 }, { bass: 329.63, lead: 392.00, pad: 493.88 }, { bass: 349.23, lead: 440.00, pad: 523.25 } ],
            [ { bass: 392.00, lead: 493.88, pad: 587.33 }, { bass: 440.00, lead: 523.25, pad: 659.25 }, { bass: 493.88, lead: 587.33, pad: 698.46 }, { bass: 523.25, lead: 659.25, pad: 783.99 } ],
            [ { bass: 261.63, lead: 392.00, pad: 493.88 }, { bass: 293.66, lead: 440.00, pad: 523.25 }, { bass: 329.63, lead: 493.88, pad: 587.33 }, { bass: 349.23, lead: 523.25, pad: 659.25 } ],
            [ { bass: 392.00, lead: 523.25, pad: 659.25 }, { bass: 440.00, lead: 587.33, pad: 698.46 }, { bass: 493.88, lead: 659.25, pad: 783.99 }, { bass: 523.25, lead: 698.46, pad: 880.00 } ],
            [ { bass: 261.63, lead: 329.63, pad: 392.00 }, { bass: 293.66, lead: 349.23, pad: 440.00 }, { bass: 329.63, lead: 392.00, pad: 493.88 }, { bass: 349.23, lead: 440.00, pad: 523.25 } ]
        ],
        postPortal: [
            [ { bass: 392.00, lead: 587.33, pad: 783.99 }, { bass: 440.00, lead: 659.25, pad: 880.00 }, { bass: 493.88, lead: 698.46, pad: 987.77 }, { bass: 523.25, lead: 783.99, pad: 1046.50 } ],
            [ { bass: 523.25, lead: 783.99, pad: 1046.50 }, { bass: 493.88, lead: 698.46, pad: 987.77 }, { bass: 440.00, lead: 659.25, pad: 880.00 }, { bass: 392.00, lead: 587.33, pad: 783.99 } ],
            [ { bass: 392.00, lead: 587.33, pad: 783.99 }, { bass: 349.23, lead: 523.25, pad: 698.46 }, { bass: 329.63, lead: 493.88, pad: 659.25 }, { bass: 293.66, lead: 440.00, pad: 587.33 } ],
            [ { bass: 392.00, lead: 587.33, pad: 783.99 }, { bass: 440.00, lead: 659.25, pad: 880.00 }, { bass: 493.88, lead: 698.46, pad: 987.77 }, { bass: 523.25, lead: 783.99, pad: 1046.50 } ],
            [ { bass: 523.25, lead: 783.99, pad: 1046.50 }, { bass: 493.88, lead: 698.46, pad: 987.77 }, { bass: 440.00, lead: 659.25, pad: 880.00 }, { bass: 392.00, lead: 587.33, pad: 783.99 } ],
            [ { bass: 392.00, lead: 587.33, pad: 783.99 }, { bass: 349.23, lead: 523.25, pad: 698.46 }, { bass: 329.63, lead: 493.88, pad: 659.25 }, { bass: 293.66, lead: 440.00, pad: 587.33 } ]
        ]
    };

    let currentPattern = 0; let currentNote = 0; const noteDuration = 0.8;
    const selectedPatterns = patterns[patternType] || patterns.default;

    function playNextNote() {
        const pattern = selectedPatterns[currentPattern];
        const note = pattern[currentNote];

        bassOsc.frequency.setValueAtTime(note.bass, audioContext.currentTime);
        leadOsc.frequency.setValueAtTime(note.lead, audioContext.currentTime);
        padOsc.frequency.setValueAtTime(note.pad, audioContext.currentTime);

        currentNote = (currentNote + 1) % pattern.length;
        if (currentNote === 0) {
            currentPattern = (currentPattern + 1) % selectedPatterns.length;
        }
    }    bassOsc.start(); leadOsc.start(); padOsc.start(); playNextNote();
    const interval = setInterval(playNextNote, noteDuration * 1000);
    isMusicPlaying = true;
    backgroundMusic = { interval, masterGain, bassOsc, leadOsc, padOsc };
}

function stopBackgroundMusic() {
    if (!isMusicPlaying) return;
    clearInterval(backgroundMusic.interval);
    backgroundMusic.bassOsc.stop();
    backgroundMusic.leadOsc.stop();
    backgroundMusic.padOsc.stop();
    backgroundMusic.masterGain.disconnect();
    isMusicPlaying = false;
    backgroundMusic = null;
}

// --- Scene Style Constants ---
const MITO_PRIMARY_COLOR = 0x604040;
const MITO_SECONDARY_COLOR = 0x886666;
const CYTO_PRIMARY_COLOR = 0x556677;
const WALL_GENERAL_COLOR = 0x999999;
const ROCK_COLOR = 0x5A5A5A;
const WATER_COLOR = 0x3399FF;
const BRAZIER_COLOR = 0xB87333;
const EMBER_COLOR = 0xFF4500;
const SMOKE_COLOR = 0x888888;
const BICARBONATE_COLOR = 0xADD8E6;

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x282C34);

// --- Camera Setup ---
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

// --- Renderer Setup ---
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 15, 10); directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048; directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// --- Fog ---
scene.fog = new THREE.Fog(scene.background, 20, 50);


// --- Layout Constants ---
const MIN_X = -15; const MAX_X = 15; const MIN_Z = -10; const MAX_Z = 10;
const DIVIDING_WALL_X = 0;
const TOTAL_WIDTH = MAX_X - MIN_X; const TOTAL_DEPTH = MAX_Z - MIN_Z;
const MITO_WIDTH = DIVIDING_WALL_X - MIN_X;
const CYTO_WIDTH = MAX_X - DIVIDING_WALL_X;

const ALCOVE_DEPTH = 3;
const ALCOVE_WIDTH = 4;
const ALCOVE_Z_CENTER = 0;
const ALCOVE_Z_START = ALCOVE_Z_CENTER - ALCOVE_WIDTH / 2;
const ALCOVE_Z_END = ALCOVE_Z_CENTER + ALCOVE_WIDTH / 2;
const ALCOVE_INTERIOR_BACK_X = MIN_X + 0.25;
const ALCOVE_OPENING_X_PLANE = MIN_X + 0.25 + ALCOVE_DEPTH;


// --- Ground & Zones ---
const groundMaterial = new THREE.MeshStandardMaterial({ color: CYTO_PRIMARY_COLOR, metalness: 0.1, roughness: 0.9 });
const groundGeometry = new THREE.PlaneGeometry(TOTAL_WIDTH, TOTAL_DEPTH);
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 0); ground.receiveShadow = true;
scene.add(ground);

const mitoMaterial = new THREE.MeshStandardMaterial({ color: MITO_PRIMARY_COLOR, metalness: 0.2, roughness: 0.7 });
const mitochondriaZoneMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(MITO_WIDTH, TOTAL_DEPTH),
    mitoMaterial
);
mitochondriaZoneMesh.rotation.x = -Math.PI / 2;
mitochondriaZoneMesh.position.set(MIN_X + MITO_WIDTH / 2, 0.01, 0);
mitochondriaZoneMesh.receiveShadow = true;
scene.add(mitochondriaZoneMesh);


// --- OrbitControls ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.1; controls.screenSpacePanning = false;
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
const simpleParticleSystems = [];

// --- Player Setup ---
const playerSpeed = 5.0; const playerRadius = 0.35;
const player = new THREE.Group(); player.position.set(-5, 0, 0); scene.add(player);
const walkCycleDuration = 0.5; const maxLimbSwing = Math.PI / 6; const maxArmSwing = Math.PI / 8;
let walkCycleTime = 0;
const playerBodyMaterial = new THREE.MeshStandardMaterial({ color: 0x0099ff, roughness: 0.6, metalness: 0.2 });
const headHeight = 0.4; const bodyHeight = 0.8; const limbRadius = 0.1;
const armLength = 0.6; const legHeight = 0.7;
const head = new THREE.Mesh(new THREE.SphereGeometry(headHeight / 2, 16, 12), playerBodyMaterial); head.position.y = legHeight + bodyHeight + headHeight / 2; head.castShadow = true; player.add(head);
const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, bodyHeight, 0.3), playerBodyMaterial); body.position.y = legHeight + bodyHeight / 2; body.castShadow = true; player.add(body);
const playerLimbMaterial = new THREE.MeshStandardMaterial({ color: 0x0077cc, roughness: 0.7 });
const playerLeftArm = new THREE.Mesh(new THREE.CylinderGeometry(limbRadius, limbRadius, armLength), playerLimbMaterial);
playerLeftArm.position.set(-0.35, legHeight + bodyHeight * 0.95, 0); playerLeftArm.geometry.translate(0, armLength/2, 0); playerLeftArm.rotation.x = Math.PI; playerLeftArm.castShadow = true; player.add(playerLeftArm);
const playerRightArm = playerLeftArm.clone(); playerRightArm.position.x = 0.35; player.add(playerRightArm);
const playerLeftLeg = new THREE.Mesh(new THREE.CylinderGeometry(limbRadius * 1.2, limbRadius * 1.1, legHeight), playerLimbMaterial); playerLeftLeg.position.set(-0.15, legHeight / 2, 0); playerLeftLeg.castShadow = true; player.add(playerLeftLeg);
const playerRightLeg = playerLeftLeg.clone(); playerRightLeg.position.x = 0.15; player.add(playerRightLeg);
const playerHeight = legHeight + bodyHeight + headHeight;
const keysPressed = {};

// --- Wall Layout & Collision ---
const baseWallMaterial = new THREE.MeshStandardMaterial({ color: WALL_GENERAL_COLOR, metalness: 0.2, roughness: 0.9 });
const wallHeight = 1.5;
const wallThickness = 0.5;
const portalGapWidth = 3.0; const portalWallX = DIVIDING_WALL_X; const portalWallCenterZ = 0;

function createWall(position, size, rotationY = 0, name = "Wall", material = baseWallMaterial) {
    const wallGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const wall = new THREE.Mesh(wallGeometry, material);
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

const alcoveWallMaterial = new THREE.MeshStandardMaterial({ color: MITO_SECONDARY_COLOR, metalness: 0.1, roughness: 0.8 });
createWall(
    { x: MIN_X, y: 0, z: ALCOVE_Z_CENTER },
    { x: wallThickness, y: wallHeight, z: ALCOVE_WIDTH },
    0, "Alcove_Back", alcoveWallMaterial
);
createWall(
    { x: MIN_X + wallThickness/2 + ALCOVE_DEPTH / 2, y: 0, z: ALCOVE_Z_START - wallThickness/2 },
    { x: ALCOVE_DEPTH, y: wallHeight, z: wallThickness },
    0, "Alcove_Side_South", alcoveWallMaterial
);
createWall(
    { x: MIN_X + wallThickness/2 + ALCOVE_DEPTH / 2, y: 0, z: ALCOVE_Z_END + wallThickness/2 },
    { x: ALCOVE_DEPTH, y: wallHeight, z: wallThickness },
    0, "Alcove_Side_North", alcoveWallMaterial
);

const effectiveAlcoveOpeningX = MIN_X + wallThickness/2 + ALCOVE_DEPTH;
const leftWallSegment1Length = ALCOVE_Z_START - MIN_Z - wallThickness/2;
if (leftWallSegment1Length > 0.1) {
    createWall(
        { x: effectiveAlcoveOpeningX, y: 0, z: MIN_Z + leftWallSegment1Length / 2 },
        { x: wallThickness, y: wallHeight, z: leftWallSegment1Length }
    );
}
const leftWallSegment2Length = MAX_Z - ALCOVE_Z_END - wallThickness/2;
if (leftWallSegment2Length > 0.1) {
    createWall(
        { x: effectiveAlcoveOpeningX, y: 0, z: ALCOVE_Z_END + wallThickness/2 + leftWallSegment2Length / 2 },
        { x: wallThickness, y: wallHeight, z: leftWallSegment2Length }
    );
}

createWall({ x: MAX_X, y: 0, z: 0 }, { x: wallThickness, y: wallHeight, z: TOTAL_DEPTH }, 0, "Outer_Right");
createWall({ x: (MIN_X + MAX_X)/2, y: 0, z: MIN_Z }, { x: TOTAL_WIDTH - wallThickness, y: wallHeight, z: wallThickness }, 0, "Outer_Bottom");
createWall({ x: (MIN_X + MAX_X)/2, y: 0, z: MAX_Z }, { x: TOTAL_WIDTH - wallThickness, y: wallHeight, z: wallThickness }, 0, "Outer_Top");

const gapStartZ = portalWallCenterZ - portalGapWidth / 2;
const gapEndZ = portalWallCenterZ + portalGapWidth / 2;
const wall1Length = gapStartZ - MIN_Z;
const wall1CenterZ = MIN_Z + wall1Length / 2;
if (wall1Length > 0.1) { createWall({ x: DIVIDING_WALL_X, y: 0, z: wall1CenterZ }, { x: wallThickness, y: wallHeight, z: wall1Length }, 0, "Dividing_Wall_Bottom"); }
const wall2Length = MAX_Z - gapEndZ;
const wall2CenterZ = gapEndZ + wall2Length / 2;
if (wall2Length > 0.1) { createWall({ x: DIVIDING_WALL_X, y: 0, z: wall2CenterZ }, { x: wallThickness, y: wallHeight, z: wall2Length }, 0, "Dividing_Wall_Top"); }

const internalWallLength = MITO_WIDTH * 0.3;
const internalWallCenterX = MIN_X + MITO_WIDTH * 0.7;
if (internalWallCenterX - internalWallLength/2 > effectiveAlcoveOpeningX + 1) {
    createWall({ x: internalWallCenterX, y: 0, z: -4 }, { x: internalWallLength, y: wallHeight, z: wallThickness }, 0, "H_Mito_Internal_1", alcoveWallMaterial);
    createWall({ x: internalWallCenterX, y: 0, z: 4 }, { x: internalWallLength, y: wallHeight, z: wallThickness }, 0, "H_Mito_Internal_2", alcoveWallMaterial);
}

// --- Interaction Setup ---
const interactionRadius = 2.0; let closestInteractiveObject = null; let lastClosestObject = null;
const highlightMaterial = new THREE.MeshStandardMaterial({ emissive: 0xffff00, emissiveIntensity: 0.6 });

// --- Game State & Quest Data ---
const QUEST_STATE = {
    NOT_STARTED: 'NOT_STARTED',
    STEP_0_GATHER_WATER_CO2: 'STEP_0_GATHER_WATER_CO2',
    STEP_0B_MAKE_BICARBONATE: 'STEP_0B_MAKE_BICARBONATE',
    STEP_0C_COLLECT_BICARBONATE: 'STEP_0C_COLLECT_BICARBONATE',
    STEP_1_GATHER_MITO_REMAINING: 'STEP_1_GATHER_MITO_REMAINING',
    STEP_2_MAKE_CARB_PHOS: 'STEP_2_MAKE_CARB_PHOS',
    STEP_3_COLLECT_CARB_PHOS: 'STEP_3_COLLECT_CARB_PHOS',
    STEP_4_MEET_USHER: 'STEP_4_MEET_USHER',
    STEP_5_MAKE_CITRULLINE: 'STEP_5_MAKE_CITRULLINE',
    STEP_6_TALK_TO_USHER_PASSAGE: 'STEP_6_TALK_TO_USHER_PASSAGE',
    STEP_7_OPEN_PORTAL: 'STEP_7_OPEN_PORTAL',
    STEP_8_GATHER_CYTO: 'STEP_8_GATHER_CYTO',
    STEP_9_MAKE_ARGSUCC: 'STEP_9_MAKE_ARGSUCC',
    STEP_10_CLEAVE_ARGSUCC: 'STEP_10_CLEAVE_ARGSUCC',
    STEP_11_FURNACE_FUMARATE: 'STEP_11_FURNACE_FUMARATE',
    STEP_12_MAKE_UREA: 'STEP_12_MAKE_UREA',
    STEP_13_DISPOSE_UREA: 'STEP_13_DISPOSE_UREA',
    STEP_14_RIVER_CHALLENGE: 'STEP_14_RIVER_CHALLENGE',
    COMPLETED: 'COMPLETED'
};
let inventory = {}; let currentQuest = null; let hasPortalPermission = false; let playerLocation = 'mitochondria';

const ureaCycleQuest = {
    id: 'ureaCycle', name: "Ammonia Annihilation", state: QUEST_STATE.NOT_STARTED,
    objectives: {
        [QUEST_STATE.NOT_STARTED]: "Talk to Professor Hepaticus.",
        [QUEST_STATE.STEP_0_GATHER_WATER_CO2]: "Go to the alcove (West Mitochondria). Collect Water from the Well and CO2 from the Brazier.",
        [QUEST_STATE.STEP_0B_MAKE_BICARBONATE]: "Use the CAVA Shrine in the alcove with Water and CO2 to create Bicarbonate.",
        [QUEST_STATE.STEP_0C_COLLECT_BICARBONATE]: "Collect the Bicarbonate crystal that formed at the CAVA Shrine.",
        [QUEST_STATE.STEP_1_GATHER_MITO_REMAINING]: "Gather NH3 (1) and ATP (2) in Mitochondria. (You have Bicarbonate).",
        [QUEST_STATE.STEP_2_MAKE_CARB_PHOS]: "Great! Now use the CPS1 Station to make Carbamoyl Phosphate.",
        [QUEST_STATE.STEP_3_COLLECT_CARB_PHOS]: "Collect the Carbamoyl Phosphate.",
        [QUEST_STATE.STEP_4_MEET_USHER]: "Speak with the Ornithine Usher to get some Ornithine.",
        [QUEST_STATE.STEP_5_MAKE_CITRULLINE]: "Use OTC Station with Carbamoyl Phosphate and Ornithine to make Citrulline.",
        [QUEST_STATE.STEP_6_TALK_TO_USHER_PASSAGE]: "Talk to the Ornithine Usher to gain passage.",
        [QUEST_STATE.STEP_7_OPEN_PORTAL]: "Permission granted! Use the ORNT1 Portal with Citrulline to activate it and transport to the Cytosol.",
        [QUEST_STATE.STEP_8_GATHER_CYTO]: "In the Cytosol: Collect the transported Citrulline, plus Aspartate (1) and ATP (1).",
        [QUEST_STATE.STEP_9_MAKE_ARGSUCC]: "Use ASS Station to make Argininosuccinate.",
        [QUEST_STATE.STEP_10_CLEAVE_ARGSUCC]: "Use ASL Station to cleave Argininosuccinate into Arginine and Fumarate. Collect both.",
        [QUEST_STATE.STEP_11_FURNACE_FUMARATE]: "Gather Arginine and Fumarate. Then, feed the Fumarate to the Krebs Cycle Furnace.",
        [QUEST_STATE.STEP_12_MAKE_UREA]: "Use ARG1 Station with Arginine to make Urea and Ornithine.",
        [QUEST_STATE.STEP_13_DISPOSE_UREA]: "Dispose of the toxic Urea in the Waste Receptacle.",
        [QUEST_STATE.STEP_14_RIVER_CHALLENGE]: "Return to Professor Hepaticus... she has a few questions for you.",
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
    const fontSize = parameters.fontSize || 48;
    const scaleFactor = parameters.scale || 1.0;
    const color = parameters.textColor || "rgba(255, 255, 255, 0.95)";
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = "Bold " + fontSize + "px " + fontFace;
    const metrics = context.measureText(text);
    const textWidth = metrics.width;
    const padding = fontSize * 0.2;
    canvas.width = textWidth + padding * 2;
    canvas.height = fontSize + padding * 2;
    context.font = "Bold " + fontSize + "px " + fontFace;
    context.fillStyle = color;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(spriteMaterial);
    const aspect = canvas.width / canvas.height;
    sprite.scale.set(scaleFactor * aspect, scaleFactor, 1);
    sprite.position.set(position.x, position.y, position.z);
    return sprite;
}

// --- Simple Particle System ---
function createSimpleParticleSystem(count, color, size, speed, lifetime, emitterPosition, emissionArea) {
    const particlesGeo = new THREE.BufferGeometry();
    const particleVertices = [];
    const particleLifetimes = [];
    const particleVelocities = [];

    for (let i = 0; i < count; i++) {
        particleVertices.push(
            emitterPosition.x + (Math.random() - 0.5) * emissionArea.x,
            emitterPosition.y + (Math.random() - 0.5) * emissionArea.y,
            emitterPosition.z + (Math.random() - 0.5) * emissionArea.z
        );
        particleLifetimes.push(Math.random() * lifetime);
        particleVelocities.push(
            (Math.random() - 0.5) * speed,
            Math.random() * speed,
            (Math.random() - 0.5) * speed
        );
    }
    particlesGeo.setAttribute('position', new THREE.Float32BufferAttribute(particleVertices, 3));
    const particlesMat = new THREE.PointsMaterial({ color: color, size: size, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
    const points = new THREE.Points(particlesGeo, particlesMat);
    points.userData = {
        lifetimes: particleLifetimes,
        velocities: particleVelocities,
        maxLifetime: lifetime,
        baseSpeed: speed,
        basePosition: emitterPosition.clone(),
        emissionArea: emissionArea.clone()
    };
    scene.add(points);
    simpleParticleSystems.push(points);
    return points;
}

function updateSimpleParticleSystems(delta) {
    simpleParticleSystems.forEach(system => {
        const positions = system.geometry.attributes.position.array;
        const lifetimes = system.userData.lifetimes;
        const velocities = system.userData.velocities;
        const count = positions.length / 3;

        for (let i = 0; i < count; i++) {
            lifetimes[i] -= delta;
            if (lifetimes[i] <= 0) {
                positions[i * 3] = system.userData.basePosition.x + (Math.random() - 0.5) * system.userData.emissionArea.x;
                positions[i * 3 + 1] = system.userData.basePosition.y + (Math.random() - 0.5) * system.userData.emissionArea.y;
                positions[i * 3 + 2] = system.userData.basePosition.z + (Math.random() - 0.5) * system.userData.emissionArea.z;
                lifetimes[i] = system.userData.maxLifetime * Math.random();
                velocities[i * 3] = (Math.random() - 0.5) * system.userData.baseSpeed;
                velocities[i * 3 + 1] = Math.random() * system.userData.baseSpeed;
                velocities[i * 3 + 2] = (Math.random() - 0.5) * system.userData.baseSpeed;
            }
            positions[i * 3] += velocities[i * 3] * delta;
            positions[i * 3 + 1] += velocities[i * 3 + 1] * delta;
            positions[i * 3 + 2] += velocities[i * 3 + 2] * delta;
        }
        system.geometry.attributes.position.needsUpdate = true;
    });
}


// --- Game Object Creation Functions ---
function createLightningBoltGeometry() {
    const points = [ new THREE.Vector3(0, 0.8, 0), new THREE.Vector3(-0.4, 0.4, 0.2), new THREE.Vector3(0, 0.2, -0.2), new THREE.Vector3(0.4, 0, 0.2), new THREE.Vector3(0, -0.2, -0.2), new THREE.Vector3(-0.4, -0.4, 0.2), new THREE.Vector3(0, -0.8, 0) ];
    const geometry = new THREE.BufferGeometry(); const vertices = []; const thickness = 0.15;
    for (let i = 0; i < points.length - 1; i++) { const p1 = points[i]; const p2 = points[i + 1]; const direction = new THREE.Vector3().subVectors(p2, p1).normalize(); const perpendicular = new THREE.Vector3(-direction.y, direction.x, 0).multiplyScalar(thickness); vertices.push( p1.x + perpendicular.x, p1.y + perpendicular.y, p1.z + thickness, p1.x - perpendicular.x, p1.y - perpendicular.y, p1.z + thickness, p2.x + perpendicular.x, p2.y + perpendicular.y, p2.z + thickness ); vertices.push( p1.x - perpendicular.x, p1.y - perpendicular.y, p1.z + thickness, p2.x - perpendicular.x, p2.y - perpendicular.y, p2.z + thickness, p2.x + perpendicular.x, p2.y + perpendicular.y, p2.z + thickness ); vertices.push( p1.x + perpendicular.x, p1.y + perpendicular.y, p1.z - thickness, p2.x + perpendicular.x, p2.y + perpendicular.y, p2.z - thickness, p1.x - perpendicular.x, p1.y - perpendicular.y, p1.z - thickness ); vertices.push( p2.x + perpendicular.x, p2.y + perpendicular.y, p2.z - thickness, p2.x - perpendicular.x, p2.y - perpendicular.y, p2.z - thickness, p1.x - perpendicular.x, p1.y - perpendicular.y, p1.z - thickness ); vertices.push( p1.x + perpendicular.x, p1.y + perpendicular.y, p1.z + thickness, p2.x + perpendicular.x, p2.y + perpendicular.y, p2.z + thickness, p1.x + perpendicular.x, p1.y + perpendicular.y, p1.z - thickness ); vertices.push( p2.x + perpendicular.x, p2.y + perpendicular.y, p2.z + thickness, p2.x + perpendicular.x, p2.y + perpendicular.y, p2.z - thickness, p1.x + perpendicular.x, p1.y + perpendicular.y, p1.z - thickness ); vertices.push( p1.x - perpendicular.x, p1.y - perpendicular.y, p1.z + thickness, p1.x - perpendicular.x, p1.y - perpendicular.y, p1.z - thickness, p2.x - perpendicular.x, p2.y - perpendicular.y, p2.z + thickness ); vertices.push( p1.x - perpendicular.x, p1.y - perpendicular.y, p1.z - thickness, p2.x - perpendicular.x, p2.y - perpendicular.y, p2.z - thickness, p2.x - perpendicular.x, p2.y - perpendicular.y, p2.z + thickness ); }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.computeVertexNormals(); return geometry;
}

function createStation(name, position, color, userData) {
    const geometry = new THREE.BoxGeometry(1, 2, 1);
    const material = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7, metalness: 0.3 });
    const station = new THREE.Mesh(geometry, material);
    station.position.set(position.x, 1, position.z);
    station.castShadow = true; station.receiveShadow = true;
    station.userData = { type: 'station', name: name, ...userData };
    scene.add(station);
    interactiveObjects.push(station);
    originalMaterials.set(station, material.clone());
    const label = createTextSprite(name, { x: position.x, y: 2.5, z: position.z }, { fontSize: 36, scale: 0.75 });
    scene.add(label); return station;
}

function createResource(name, position, color, userData = {}) {
    try { let geometry; let material; let scale = 1.0;
        if (name === 'ATP') { geometry = createLightningBoltGeometry(); material = new THREE.MeshStandardMaterial({ color: color, roughness: 0.3, metalness: 0.7, emissive: color, emissiveIntensity: 0.3 }); }
        else if (name === 'Water') { geometry = new THREE.SphereGeometry(0.25, 10, 8); material = new THREE.MeshStandardMaterial({ color: WATER_COLOR, transparent: true, opacity: 0.7, roughness: 0.2, metalness: 0.1 }); scale = 0.9; }
        else if (name === 'CO2') { geometry = new THREE.SphereGeometry(0.28, 10, 8); material = new THREE.MeshStandardMaterial({ color: SMOKE_COLOR, transparent: true, opacity: 0.6, roughness: 0.8, metalness: 0.0 }); scale = 1.0; }
        else if (name === 'Bicarbonate') { geometry = new THREE.OctahedronGeometry(0.3, 0); material = new THREE.MeshStandardMaterial({ color: BICARBONATE_COLOR, roughness: 0.4, metalness: 0.2, emissive: BICARBONATE_COLOR, emissiveIntensity: 0.2 }); scale = 1.0; }
        else { geometry = new THREE.SphereGeometry(0.3, 12, 10); if (name === 'Carbamoyl Phosphate') { color = 0xff3333; } else if (name === 'Citrulline') { color = 0xff8c00; } else if (name === 'Argininosuccinate') { color = 0x33ff33; geometry = new THREE.IcosahedronGeometry(0.35, 0); scale = 1.1; } else if (name === 'Arginine') { color = 0x6666ff; geometry = new THREE.CapsuleGeometry(0.2, 0.3, 4, 8); scale = 1.0; } else if (name === 'Urea') { color = 0xdddddd; geometry = new THREE.TorusKnotGeometry(0.2, 0.08, 50, 8); scale = 1.2; } else if (name === 'Ornithine') { color = 0xaaccaa; } else if (name === 'Fumarate') { color = 0xcccccc; geometry = new THREE.DodecahedronGeometry(0.3, 0); } material = new THREE.MeshStandardMaterial({ color: color, roughness: 0.5, metalness: 0.1 }); }
        const resource = new THREE.Mesh(geometry, material); if (isNaN(position.x) || isNaN(position.z)) { console.error(`Invalid pos for ${name}`); position = { x: 0, z: 0 }; } const initialY = userData.initialY !== undefined ? userData.initialY : 0.6; resource.userData = { ...userData, type: 'resource', name: name, object3D: resource, initialY: initialY }; resource.position.set(position.x, initialY, position.z); resource.scale.set(scale, scale, scale); resource.castShadow = true;
        if (name !== 'ATP' && !(geometry instanceof THREE.SphereGeometry)) { resource.rotation.x = Math.random() * Math.PI; resource.rotation.y = Math.random() * Math.PI * 2; } else if (name === 'ATP') { resource.rotation.y = Math.random() * Math.PI * 2; }
        scene.add(resource); interactiveObjects.push(resource); resourceMeshes.push(resource); originalMaterials.set(resource, material.clone()); return resource;
    } catch (error) { console.error(`Error creating ${name}:`, error); return null; }
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


// --- ALCOVE OBJECTS ---
function createWaterWell(position) {
    const group = new THREE.Group();
    group.position.copy(position);
    const rockMat = new THREE.MeshStandardMaterial({ color: ROCK_COLOR, roughness: 0.9 });
    for (let i = 0; i < 5; i++) {
        const size = Math.random() * 0.4 + 0.3;
        const rockGeo = new THREE.SphereGeometry(size, 5, 4);
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.position.set((Math.random() - 0.5) * 0.6, size * 0.3 - 0.1, (Math.random() - 0.5) * 0.6);
        rock.castShadow = true; rock.receiveShadow = true;
        group.add(rock);
    }
    const waterGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16);
    const waterMat = new THREE.MeshStandardMaterial({ color: WATER_COLOR, transparent: true, opacity: 0.8, emissive: WATER_COLOR, emissiveIntensity: 0.3, roughness: 0.1 });
    const waterSurface = new THREE.Mesh(waterGeo, waterMat);
    waterSurface.position.y = 0.1;
    group.add(waterSurface);

    group.userData = { type: 'source', name: 'Water Well', provides: 'Water', requiredQuestState: QUEST_STATE.STEP_0_GATHER_WATER_CO2 };
    interactiveObjects.push(group);
    originalMaterials.set(group, waterMat.clone());
    scene.add(group);
    const label = createTextSprite("Water Well", { x: position.x, y: position.y + 0.8, z: position.z }, { scale: 0.5 });
    scene.add(label);
    createSimpleParticleSystem(20, 0xffffff, 0.03, 0.2, 2, position.clone().add(new Vector3(0, 0.2, 0)), new Vector3(0.3, 0.1, 0.3));
    return group;
}

function createAlchemistsBrazier(position) {
    const group = new THREE.Group();
    group.position.copy(position);
    const pedestalMat = new THREE.MeshStandardMaterial({ color: ROCK_COLOR, roughness: 0.8 });
    const pedestalGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.5, 12);
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = 0.25;
    pedestal.castShadow = true; pedestal.receiveShadow = true;
    group.add(pedestal);
    const brazierMat = new THREE.MeshStandardMaterial({ color: BRAZIER_COLOR, metalness: 0.8, roughness: 0.4 });
    const brazierGeo = new THREE.TorusKnotGeometry(0.25, 0.08, 50, 8, 2, 3);
    brazierGeo.scale(1, 0.7, 1);
    const brazier = new THREE.Mesh(brazierGeo, brazierMat);
    brazier.position.y = 0.5 + 0.15;
    brazier.castShadow = true;
    group.add(brazier);
    const emberLight = new THREE.PointLight(EMBER_COLOR, 0.5, 1);
    emberLight.position.y = 0.7;
    group.add(emberLight);

    group.userData = { type: 'source', name: 'Alchemist\'s Brazier', provides: 'CO2', requiredQuestState: QUEST_STATE.STEP_0_GATHER_WATER_CO2 };
    interactiveObjects.push(group);
    originalMaterials.set(group, brazierMat.clone());
    scene.add(group);
    const label = createTextSprite("Alchemist's Brazier", { x: position.x, y: position.y + 1.2, z: position.z }, { scale: 0.5 });
    scene.add(label);
    createSimpleParticleSystem(30, SMOKE_COLOR, 0.05, 0.3, 3, position.clone().add(new Vector3(0, 0.8, 0)), new Vector3(0.2, 0.2, 0.2));
    return group;
}

// --- Create Game World Entities ---
const carbPhosColor = 0xff3333; const citrullineColor = 0xff8c00; const argSuccColor = 0x33ff33;
const arginineColor = 0x6666ff; const ureaColor = 0xdddddd; const ornithineColor = 0xaaccaa;
const fumarateColor = 0xcccccc;

// --- MITOCHONDRIA (X < 0) ---
const professorHepaticus = createProfessorHepaticus(new THREE.Vector3(-3, 0, -8));
scene.add(professorHepaticus); interactiveObjects.push(professorHepaticus);
originalMaterials.set(professorHepaticus.children.find(c => c.name === "robe"), professorHepaticus.children.find(c => c.name === "robe").material.clone());

let professorBasePos = new THREE.Vector3(-3, 0, -8);
let professorTargetPos = professorBasePos.clone();
let professorPaceTimer = 0;
let professorPaceInterval = 2 + Math.random() * 2;


const ornithineUsher = createOrnithineUsher(new THREE.Vector3(-2, 0, -2));
scene.add(ornithineUsher); interactiveObjects.push(ornithineUsher);
originalMaterials.set(ornithineUsher.children.find(c => c.name === "body"), ornithineUsher.children.find(c => c.name === "body").material.clone());

const alcoveItemNearOpeningX = ALCOVE_INTERIOR_BACK_X + ALCOVE_DEPTH - 0.8;
const alcoveItemDeeperX = ALCOVE_INTERIOR_BACK_X + 0.8;
createWaterWell(new THREE.Vector3(alcoveItemNearOpeningX, 0, ALCOVE_Z_CENTER - 1));
createAlchemistsBrazier(new THREE.Vector3(alcoveItemNearOpeningX, 0, ALCOVE_Z_CENTER + 1));
createStation("CAVA Shrine", { x: alcoveItemDeeperX , z: ALCOVE_Z_CENTER }, MITO_SECONDARY_COLOR, { // Changed name to CAVA
    requires: { 'Water': 1, 'CO2': 1 },
    produces: 'Bicarbonate',
    productColors: { 'Bicarbonate': BICARBONATE_COLOR },
    requiredQuestState: QUEST_STATE.STEP_0B_MAKE_BICARBONATE,
    advancesQuestTo: QUEST_STATE.STEP_0C_COLLECT_BICARBONATE
});

const mitoStationOffset = effectiveAlcoveOpeningX + 2;
createStation("OTC", { x: Math.max(mitoStationOffset, -10), z: -5 }, 0xff4500, {
    requires: { 'Carbamoyl Phosphate': 1, 'Ornithine': 1 },
    produces: 'Citrulline', productColors: { 'Citrulline': citrullineColor },
    requiredQuestState: QUEST_STATE.STEP_5_MAKE_CITRULLINE,
    advancesQuestTo: QUEST_STATE.STEP_6_TALK_TO_USHER_PASSAGE
});
createStation("CPS1", { x: Math.max(mitoStationOffset, -7), z: 7 }, 0xff0000, {
    requires: { 'Bicarbonate': 1, 'NH3': 1, 'ATP': 2 },
    produces: 'Carbamoyl Phosphate', productColors: { 'Carbamoyl Phosphate': carbPhosColor },
    requiredQuestState: QUEST_STATE.STEP_2_MAKE_CARB_PHOS,
    advancesQuestTo: QUEST_STATE.STEP_3_COLLECT_CARB_PHOS
});

createResource('NH3', { x: Math.max(effectiveAlcoveOpeningX + 1.5, -13), z: 5 }, 0xffaaaa);
createResource('ATP', { x: Math.max(effectiveAlcoveOpeningX + 1, -10), z: 8 }, 0xffffaa);
createResource('ATP', { x: -4, z: 8 }, 0xffffaa);
const cabinetMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8 });
const cabinetGeometry = new THREE.BoxGeometry(1, 1.5, 1.5);
const cabinet = new THREE.Mesh(cabinetGeometry, cabinetMaterial);
cabinet.position.set(Math.max(effectiveAlcoveOpeningX + 2, MIN_X + 1.5), 0.75, -8);
scene.add(cabinet); cabinet.castShadow = true; cabinet.receiveShadow = true;
const cabinetLabel = createTextSprite("Storage Cabinet", { x: cabinet.position.x, y: cabinet.position.y + 1.2, z: cabinet.position.z }, { fontSize: 24, scale: 0.5 });
scene.add(cabinetLabel);


// --- CYTOSOL (X > 0) ---
createStation("ASS", { x: 5, z: 5 }, 0x00ff00, {
    requires: { 'Citrulline': 1, 'Aspartate': 1, 'ATP': 1 },
    produces: 'Argininosuccinate',
    productColors: { 'Argininosuccinate': argSuccColor },
    requiredQuestState: QUEST_STATE.STEP_9_MAKE_ARGSUCC,
    advancesQuestTo: QUEST_STATE.STEP_10_CLEAVE_ARGSUCC
});
createStation("ASL", { x: 10, z: 0 }, 0x00ced1, {
    requires: { 'Argininosuccinate': 1 },
    produces: ['Arginine', 'Fumarate'],
    productColors: { 'Arginine': arginineColor, 'Fumarate': fumarateColor },
    requiredQuestState: QUEST_STATE.STEP_10_CLEAVE_ARGSUCC,
    advancesQuestTo: QUEST_STATE.STEP_11_FURNACE_FUMARATE
});
createStation("ARG1", { x: 5, z: -5 }, 0x0000ff, {
    requires: { 'Arginine': 1 },
    produces: ['Urea', 'Ornithine'],
    productColors: { 'Urea': ureaColor, 'Ornithine': ornithineColor },
    requiredQuestState: QUEST_STATE.STEP_12_MAKE_UREA,
    advancesQuestTo: QUEST_STATE.STEP_13_DISPOSE_UREA
});
createResource('Aspartate', { x: 8, z: 8 }, 0xffaaff);
createResource('ATP', { x: 3, z: 0 }, 0xffffaa);
const wasteBucket = createWasteBucket(new THREE.Vector3(13, 0, -8));
const krebsFurnace = createKrebsFurnace(new THREE.Vector3(DIVIDING_WALL_X, 0, 8));


// --- ORNT1 Portal & Barrier ---
const portalGeometry = new THREE.TorusGeometry(1.5, 0.3, 16, 50);
const portalMaterial = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00aaaa, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide });
const ornT1Portal = new THREE.Mesh(portalGeometry, portalMaterial);
ornT1Portal.position.set(portalWallX + 0.05, wallHeight / 2 + 0.1, portalWallCenterZ);
ornT1Portal.rotation.y = Math.PI / 2;
ornT1Portal.userData = {
    type: 'portal',
    name: 'ORNT1 Portal',
    requiredQuestState: QUEST_STATE.STEP_7_OPEN_PORTAL,
    requires: { 'Citrulline': 1 },
    advancesQuestTo: QUEST_STATE.STEP_8_GATHER_CYTO,
    action: 'transportCitrulline',
    productColor: citrullineColor
};
scene.add(ornT1Portal);
interactiveObjects.push(ornT1Portal);
originalMaterials.set(ornT1Portal, portalMaterial.clone());

const portalLabel = createTextSprite("ORNT1 Portal", { x: ornT1Portal.position.x, y: ornT1Portal.position.y + 2.0, z: ornT1Portal.position.z }, { fontSize: 36, scale: 0.75 }); scene.add(portalLabel);
const barrierGeometry = new THREE.PlaneGeometry(portalGapWidth - 0.1, wallHeight - 0.1);
const barrierMaterial = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00aaaa, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
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
    if (!realityRiverUI.classList.contains('hidden')) {
    } else {
        controls.enabled = true;
    }
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
    let feedbackContainer = document.getElementById('feedbackContainer');
    if (!feedbackContainer) {
        feedbackContainer = document.createElement('div');
        feedbackContainer.id = 'feedbackContainer';
        feedbackContainer.style.position = 'fixed';
        feedbackContainer.style.left = '50%';
        feedbackContainer.style.bottom = '150px'; // Start position for the container
        feedbackContainer.style.transform = 'translateX(-50%)';
        feedbackContainer.style.display = 'flex';
        feedbackContainer.style.flexDirection = 'column-reverse'; // New messages appear at the bottom and push old ones up
        feedbackContainer.style.alignItems = 'center';
        feedbackContainer.style.zIndex = '1000'; // High z-index
        feedbackContainer.style.pointerEvents = 'none'; // Allow clicks through
        document.body.appendChild(feedbackContainer);
    }

    const feedback = document.createElement('div');
    feedback.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    feedback.style.color = 'white';
    feedback.style.padding = '10px 20px';
    feedback.style.borderRadius = '5px';
    feedback.style.marginTop = '8px'; // Spacing between messages
    feedback.textContent = message;
    feedback.style.pointerEvents = 'none'; // Individual messages also non-interactive
    feedbackContainer.appendChild(feedback);

    setTimeout(() => {
        if (feedback.parentNode) {
            feedback.parentNode.removeChild(feedback);
        }
    }, duration);
}
function showInteractionPrompt(objectName, objectType) {
    if (interactionPrompt) {
        let actionText = "Interact with";
        if (objectType === 'resource') {
            actionText = "Collect";
        }
        interactionText.textContent = `${actionText} ${objectName}`;
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
        currentQuest = { ...quest };
        currentQuest.state = QUEST_STATE.STEP_0_GATHER_WATER_CO2;
        updateQuestUI();
        showFeedback(`Quest Started: ${quest.name}`);
    }
}

function advanceQuest(quest, newState) {
    if (currentQuest && currentQuest.id === quest.id && currentQuest.state !== newState) {
        console.log(`Advancing quest ${quest.id} from ${currentQuest.state} to ${newState}`);
        currentQuest.state = newState;
        updateQuestUI();

        if (newState === QUEST_STATE.STEP_0B_MAKE_BICARBONATE) {
            showFeedback("Water and CO2 collected! Head to the CAVA Shrine.");
        } else if (newState === QUEST_STATE.STEP_0C_COLLECT_BICARBONATE) {
            showFeedback("Bicarbonate synthesized! Collect the crystal.");
        } else if (newState === QUEST_STATE.STEP_1_GATHER_MITO_REMAINING) {
            showFeedback("Bicarbonate collected! Now gather Ammonia and ATP.");
        } else if (newState === QUEST_STATE.STEP_2_MAKE_CARB_PHOS) {
            showFeedback("All mitochondrial precursors gathered! Go to CPS1 station.");
        } else if (newState === QUEST_STATE.STEP_4_MEET_USHER) {
            showFeedback("Carbamoyl Phosphate collected! Find the Ornithine Usher.");
        } else if (newState === QUEST_STATE.STEP_8_GATHER_CYTO) {
            showFeedback(`Portal to Cytosol open! Now: ${currentQuest.objectives[QUEST_STATE.STEP_8_GATHER_CYTO]}`);
            if (hasItems({ 'Citrulline': 1, 'Aspartate': 1, 'ATP': 1 })) {
                setTimeout(() => { advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_9_MAKE_ARGSUCC); }, 50);
                return;
            }
        } else if (newState === QUEST_STATE.STEP_9_MAKE_ARGSUCC) {
             showFeedback("All materials for Cytosol step 1 collected! Proceed to the ASS station.");
        } else if (newState === QUEST_STATE.STEP_10_CLEAVE_ARGSUCC) {
             showFeedback("Argininosuccinate created! Now, use the ASL station to cleave it.");
        } else if (newState === QUEST_STATE.STEP_11_FURNACE_FUMARATE) {
            showFeedback("ASL station processed Argininosuccinate. Gather Arginine & Fumarate, then take Fumarate to Krebs Furnace.");
        } else if (newState === QUEST_STATE.COMPLETED) {
            const rewardPoints = quest.rewards?.knowledgePoints || 0;
            showFeedback(`Quest Complete: ${quest.name}! +${rewardPoints} KP`, 5000);
            setTimeout(() => { if(currentQuest?.state === QUEST_STATE.COMPLETED) { currentQuest = null; updateQuestUI(); } }, 100);
        }
        // No generic "Objective Updated!" feedback if a specific one was already given for the state.
    }
}

// --- Reality River Functions ---
function startRealityRiver() {
    currentRiverQuestionIndex = 0;
    riverCorrectAnswers = 0;
    realityRiverUI.classList.remove('hidden');
    displayRiverQuestion();
    updateRiverProgress();
    controls.enabled = false;
    isUserInteracting = true;
}
function displayRiverQuestion() {
    if (currentRiverQuestionIndex >= ureaRiverQuestions.length) {
        endRealityRiver(true);
        return;
    }
    const qData = ureaRiverQuestions[currentRiverQuestionIndex];
    riverQuestionUI.textContent = qData.q;
    riverAnswersUI.innerHTML = '';
    riverFeedbackUI.textContent = '';

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
        const buttons = riverAnswersUI.querySelectorAll('button');
        buttons.forEach(b => b.disabled = true);
        setTimeout(() => {
            if (currentRiverQuestionIndex >= ureaRiverQuestions.length) {
                endRealityRiver(true);
            } else {
                displayRiverQuestion();
            }
        }, 1000);
    } else {
        riverFeedbackUI.textContent = "Not quite. Think about the process...";
        riverFeedbackUI.style.color = 'lightcoral';
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
    controls.enabled = true;
    isUserInteracting = false;

    if (success) {
        showDialogue("Impressive! You've navigated the Urea Cycle...", [
            { text: "Great!", action: () => advanceQuest(ureaCycleQuest, QUEST_STATE.COMPLETED) }
        ]);
    } else {
        showDialogue("Hmm, seems you need to review...", [
            { text: "Okay" }
        ]);
    }
}

// --- Helper: Remove Portal Barrier ---
function removePortalBarrier() {
    if (portalBarrier && portalBarrier.parent === scene) {
        const barrierIndex = collidableWalls.indexOf(portalBarrier);
        if (barrierIndex > -1) collidableWalls.splice(barrierIndex, 1);
        const boxIndexToRemove = wallBoundingBoxes.findIndex(box => {
             const center = new Vector3(); box.getCenter(center);
             return center.distanceToSquared(portalBarrier.position) < 0.1;
        });
        if (boxIndexToRemove > -1) wallBoundingBoxes.splice(boxIndexToRemove, 1);
        scene.remove(portalBarrier);
        portalBarrier.geometry.dispose();
        portalBarrier.material.dispose();
        portalBarrier = null;
    }
}


// --- Interaction Logic ---
function interactWithObject(object) {
    if (!object || isUserInteracting) return;

    const userData = object.userData;
    let interactionProcessedThisFrame = false;

    if (userData.type === 'npc' && !interactionProcessedThisFrame) {
        interactionProcessedThisFrame = true;
        isUserInteracting = true;
        if (userData.name === 'Professor Hepaticus') {
            if (currentQuest && currentQuest.id === 'ureaCycle') {
                if (currentQuest.state === QUEST_STATE.STEP_14_RIVER_CHALLENGE) {
                     showDialogue("Ready to test your knowledge on the Urea Cycle?", [
                         { text: "Yes, start the challenge!", action: startRealityRiver },
                         { text: "Give me a moment." }
                     ]);
                } else if (currentQuest.state === QUEST_STATE.COMPLETED) {
                     showDialogue("Thanks again for helping clear the ammonia!", [ { text: "You're welcome."} ]);
                } else {
                     showDialogue(`Current Objective: ${currentQuest.objectives[currentQuest.state]}`, [ { text: "Okay"} ]);
                }
            } else if (!currentQuest) {
                 showDialogue("The cell is overwhelmed with ammonia! We need to convert it to Urea. Can you help?", [
                     { text: "Accept Quest", action: () => {
                         startQuest(ureaCycleQuest);
                         startBackgroundMusic();
                     }},
                     { text: "Decline" }
                 ]);
            } else {
                isUserInteracting = false;
            }
        } else if (userData.name === 'Ornithine Usher') {
            if (currentQuest && currentQuest.id === 'ureaCycle') {
                if (currentQuest.state === QUEST_STATE.STEP_4_MEET_USHER) {
                    showDialogue("Ah, you must be the one Professor Hepaticus sent. Need some Ornithine for your journey?", [
                        { text: "Yes, please!", action: () => {
                            addToInventory('Ornithine', 1);
                            showFeedback("Ornithine received!"); // This is specific enough for the action
                            advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_5_MAKE_CITRULLINE);
                        }},
                        { text: "Not yet."}
                    ]);
                } else if (currentQuest.state === QUEST_STATE.STEP_6_TALK_TO_USHER_PASSAGE) {
                    if (hasItems({ 'Citrulline': 1 })) {
                        showDialogue("Excellent, you've made Citrulline! You may pass through the ORNT1 portal.", [
                            { text: "Thank you!", action: () => {
                                hasPortalPermission = true; // State variable
                                advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_7_OPEN_PORTAL);
                            }}
                        ]);
                    } else {
                        showDialogue("You need Citrulline to pass. Come back when you have it.", [{ text: "Okay" }]);
                    }
                } else if (currentQuest.state === QUEST_STATE.STEP_13_DISPOSE_UREA && hasItems({'Ornithine': 1})) {
                     showDialogue("Welcome back, traveler! You've returned with Ornithine. The cycle is complete within you.", [
                        { text: "Indeed!", action: () => {
                            removeFromInventory('Ornithine', 1);
                            showFeedback("Ornithine returned to the cycle's start."); // Specific feedback
                            advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_14_RIVER_CHALLENGE);
                        }}
                    ]);
                } else if (currentQuest.state < QUEST_STATE.STEP_4_MEET_USHER) {
                    showDialogue("Greetings! I am the Ornithine Usher. I guard this passage and assist with... transport.", [{ text: "Interesting." }]);
                } else if (currentQuest.state > QUEST_STATE.STEP_7_OPEN_PORTAL && currentQuest.state < QUEST_STATE.STEP_13_DISPOSE_UREA) {
                     showDialogue("Keep up the good work in the Cytosol!", [{ text: "Will do." }]);
                } else {
                    showDialogue("The cycle continues...", [{ text: "Indeed." }]);
                }
            } else {
                 showDialogue("I am the Ornithine Usher. Speak to Professor Hepaticus to learn about the Urea Cycle.", [{ text: "Okay" }]);
            }
        } else {
            isUserInteracting = false;
        }
    }

    else if (userData.type === 'source' && !interactionProcessedThisFrame) {
        interactionProcessedThisFrame = true;
        if (!currentQuest || currentQuest.id !== 'ureaCycle' || currentQuest.state !== userData.requiredQuestState) {
            showFeedback(`Not the right time to use the ${userData.name}. Objective: ${currentQuest?.objectives[currentQuest.state] || "Start quest first."}`);
            return;
        }
        if (inventory[userData.provides] >=1) {
            showFeedback(`You already have ${userData.provides}.`);
            return;
        }
        
        addToInventory(userData.provides, 1);
        createGameBoySound('collect');

        let questAdvancedByThisSource = false;
        if (currentQuest.state === QUEST_STATE.STEP_0_GATHER_WATER_CO2 && hasItems({ 'Water': 1, 'CO2': 1 })) {
            advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_0B_MAKE_BICARBONATE);
            questAdvancedByThisSource = true; // advanceQuest gives: "Water and CO2 collected! Head to the CAVA Shrine."
        }

        if (!questAdvancedByThisSource) { // Only show generic if quest didn't advance with specific feedback
            showFeedback(`Collected ${userData.provides} from the ${userData.name}.`);
        }
    }

    else if (userData.type === 'resource' && !interactionProcessedThisFrame) {
        interactionProcessedThisFrame = true;
        const initialQuestDependentResources = ['NH3', 'ATP', 'Water', 'CO2', 'Bicarbonate'];
        if (initialQuestDependentResources.includes(userData.name) && (!currentQuest || currentQuest.state === QUEST_STATE.NOT_STARTED)) {
            showFeedback("You should talk to Professor Hepaticus first.");
            return;
        }

        addToInventory(userData.name, 1);
        createGameBoySound('collect'); // Play sound early, action is happening

        scene.remove(userData.object3D);
        const i_obj = interactiveObjects.indexOf(object); if (i_obj > -1) interactiveObjects.splice(i_obj, 1);
        const m_mesh = resourceMeshes.indexOf(object); if (m_mesh > -1) resourceMeshes.splice(m_mesh, 1);
        originalMaterials.delete(object);
        if (closestInteractiveObject === object) { closestInteractiveObject = null; lastClosestObject = null; hideInteractionPrompt(); }

        let questAdvancedByThisCollection = false;
        let specificFeedbackGivenForThisResource = false;

        if (currentQuest?.id === 'ureaCycle') {
            if (currentQuest.state === QUEST_STATE.STEP_0C_COLLECT_BICARBONATE && userData.name === 'Bicarbonate') {
                advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_1_GATHER_MITO_REMAINING);
                questAdvancedByThisCollection = true; // advanceQuest gives: "Bicarbonate collected! Now gather Ammonia and ATP."
            }
            else if (currentQuest.state === QUEST_STATE.STEP_1_GATHER_MITO_REMAINING && hasItems({ 'Bicarbonate': 1, 'NH3': 1, 'ATP': 2 })) {
                advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_2_MAKE_CARB_PHOS);
                questAdvancedByThisCollection = true; // advanceQuest gives: "All mitochondrial precursors gathered! Go to CPS1 station."
            }
            else if (currentQuest.state === QUEST_STATE.STEP_3_COLLECT_CARB_PHOS && userData.name === 'Carbamoyl Phosphate') {
                advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_4_MEET_USHER);
                questAdvancedByThisCollection = true; // advanceQuest gives: "Carbamoyl Phosphate collected! Find the Ornithine Usher."
            }
            else if (currentQuest.state === QUEST_STATE.STEP_8_GATHER_CYTO) {
                const itemsNeeded = { 'Citrulline': 1, 'Aspartate': 1, 'ATP': 1 };
                if (hasItems(itemsNeeded)) { // This means ALL items for this step are now collected
                    advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_9_MAKE_ARGSUCC);
                    questAdvancedByThisCollection = true; // advanceQuest gives: "All materials for Cytosol step 1 collected! Proceed to the ASS station."
                }
            }
            else if (currentQuest.state === QUEST_STATE.STEP_11_FURNACE_FUMARATE && (userData.name === 'Arginine' || userData.name === 'Fumarate')) {
                specificFeedbackGivenForThisResource = true;
                if (hasItems({'Arginine': 1}) && hasItems({'Fumarate': 1})) {
                    showFeedback(`Both Arginine and Fumarate collected! Take Fumarate to the Krebs Cycle Furnace.`);
                } else if (userData.name === 'Arginine' && inventory['Arginine'] >= 1 && !inventory['Fumarate']) {
                    showFeedback("Arginine collected. Still need Fumarate.");
                } else if (userData.name === 'Fumarate' && inventory['Fumarate'] >= 1 && !inventory['Arginine']) {
                    showFeedback("Fumarate collected. Still need Arginine.");
                } else if (userData.name === 'Arginine' && inventory['Arginine'] > 1 && inventory['Fumarate']){ // Already had Fumarate, collected more Arginine
                     showFeedback(`Collected more Arginine. You have all items for this step.`);
                } else if (userData.name === 'Fumarate' && inventory['Fumarate'] > 1 && inventory['Arginine']){ // Already had Arginine, collected more Fumarate
                     showFeedback(`Collected more Fumarate. You have all items for this step.`);
                }
                // This state does not auto-advance quest, so questAdvancedByThisCollection remains false
            }
        }

        if (!questAdvancedByThisCollection && !specificFeedbackGivenForThisResource) {
            showFeedback(`Collected ${userData.name}`);
        }
    }

    else if (userData.type === 'station' && !interactionProcessedThisFrame) {
        interactionProcessedThisFrame = true;
        if (!currentQuest || currentQuest.state !== userData.requiredQuestState) {
            showFeedback(`Not the right time for ${userData.name}. Objective: ${currentQuest?.objectives[currentQuest.state] || "Start quest first."}`);
            return;
        }
        if (!hasItems(userData.requires)) {
            let missing = [];
            for (const item in userData.requires) {
                if (!inventory[item] || inventory[item] < userData.requires[item]) {
                    missing.push(`${item} (need ${userData.requires[item]}${inventory[item] ? `, have ${inventory[item]}` : ''})`);
                }
            }
            showFeedback(`Missing: ${missing.join(', ')} for ${userData.name}.`);
            return;
        }

        createGameBoySound('success');
        playMoleculeGenerationSound();
        for (const item in userData.requires) {
            removeFromInventory(item, userData.requires[item]);
        }

        let productOffset = 0;
        if (Array.isArray(userData.produces)) {
            userData.produces.forEach(prodName => {
                const prodColor = userData.productColors[prodName] || 0xffffff;
                createResource(prodName, { x: object.position.x + productOffset - 0.5, z: object.position.z - 2 }, prodColor, { initialY: 0.6 });
                productOffset += 1.0;
            });
        } else {
            const prodColor = userData.productColors[userData.produces] || 0xffffff;
            createResource(userData.produces, { x: object.position.x, z: object.position.z - 2 }, prodColor, { initialY: 0.6 });
        }
        // Feedback for station producing item is good.
        showFeedback(`${Array.isArray(userData.produces) ? userData.produces.join(' & ') : userData.produces} created at ${userData.name}!`);
        if (userData.advancesQuestTo) {
            // advanceQuest will give the next objective feedback. This two-step feedback is fine.
            advanceQuest(ureaCycleQuest, userData.advancesQuestTo);
        }
    }

    else if (userData.type === 'portal' && userData.name === 'ORNT1 Portal' && !interactionProcessedThisFrame) {
        interactionProcessedThisFrame = true;
        if (!currentQuest || currentQuest.state !== userData.requiredQuestState) {
            showFeedback("The portal is not active or you don't have permission. Check your objective.");
            return;
        }
        if (!hasItems(userData.requires)) {
            showFeedback(`The portal requires ${Object.keys(userData.requires).join(', ')}.`);
            return;
        }

        removeFromInventory('Citrulline', 1);
        removePortalBarrier();
        stopBackgroundMusic();
        playPortalCelebration(); // This has its own sound logic
        // createGameBoySound('success'); // Portal celebration is more prominent

        // This specific feedback is good, then advanceQuest will update objective.
        showFeedback("Portal activated! Transporting Citrulline...", 3000);
        player.position.set(DIVIDING_WALL_X + 2, player.position.y, 0);
        playerLocation = 'cytosol';
        createResource('Citrulline', { x: DIVIDING_WALL_X + 1, z: 1 }, userData.productColor || citrullineColor, { initialY: 0.6 });
        advanceQuest(ureaCycleQuest, userData.advancesQuestTo);
    }

    else if (userData.type === 'wasteBucket' && !interactionProcessedThisFrame) {
        interactionProcessedThisFrame = true;
        if (currentQuest?.state === QUEST_STATE.STEP_13_DISPOSE_UREA && hasItems({ 'Urea': 1 })) {
            removeFromInventory('Urea', 1);
            showFeedback("Urea disposed! The cell feels cleaner."); // Specific action feedback
            createGameBoySound('success');
            // The quest doesn't advance here directly, but checks if Ornithine is ready.
            // The advance to STEP_14 happens when talking to Usher with Ornithine.
            if (hasItems({'Ornithine': 1})) {
                 showFeedback("With Urea gone and Ornithine ready, it's time to see the Usher.");
            }
        } else if (inventory['Urea']) {
            showFeedback("You have Urea, but it's not time to dispose of it yet. Check your objective.");
        } else {
            showFeedback("This is a waste receptacle for Urea. You don't have any to dispose of or it's not the right time.");
        }
    }

    else if (userData.type === 'krebsFurnace' && !interactionProcessedThisFrame) {
        interactionProcessedThisFrame = true;
        if (currentQuest?.state === QUEST_STATE.STEP_11_FURNACE_FUMARATE && hasItems({ 'Fumarate': 1 })) {
            if (!hasItems({ 'Arginine': 1 })) {
                showFeedback("You need to collect the Arginine from the ASL station first!");
                return;
            }
            removeFromInventory('Fumarate', 1);
            showFeedback("Fumarate fed to the Krebs Cycle! It will be converted to Malate."); // Specific action feedback
            createGameBoySound('interact');
            createSimpleParticleSystem(50, EMBER_COLOR, 0.08, 0.5, 1.5, object.position.clone().add(new Vector3(0,0.7,0.4)), new Vector3(0.4, 0.1, 0.1));
            advanceQuest(ureaCycleQuest, QUEST_STATE.STEP_12_MAKE_UREA); // advanceQuest provides next objective
        } else if (inventory['Fumarate']) {
            showFeedback("You have Fumarate, but it's not time to use the furnace. Check your objective.");
        } else {
            showFeedback("This furnace processes Fumarate for the Krebs Cycle. You don't have any Fumarate or it's not the right time.");
        }
    }

    if (!dialogueBox.classList.contains('hidden') || !realityRiverUI.classList.contains('hidden')) {
        // isUserInteracting remains true
    } else if (interactionProcessedThisFrame) { // If an interaction happened but no persistent UI opened
        isUserInteracting = false;
    }
}


// --- Event Listeners ---
document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    keysPressed[key] = true;
    if (key === 'e' && closestInteractiveObject && !isUserInteracting) {
        if (dialogueBox.classList.contains('hidden') && realityRiverUI.classList.contains('hidden')) {
            interactWithObject(closestInteractiveObject);
        }
    }
});
document.addEventListener('keyup', (event) => {
    keysPressed[event.key.toLowerCase()] = false;
});
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});


// --- Animation Loop ---
const clock = new THREE.Clock();
const cameraIdealOffset = new THREE.Vector3(0, 10, -12); const cameraIdealLookAt = new THREE.Vector3(0, 1.5, 0);
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
        if (!meshToHighlight) meshToHighlight = object.children.find(child => child instanceof THREE.Mesh && child.name === 'robe');
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

const professorSwaySpeed = 0.5; const professorArmSwingSpeed = 1.2;
const usherFloatSpeed = 1.0; const usherFloatAmount = 0.1;

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);
    const elapsedTime = clock.elapsedTime;

    updateSimpleParticleSystems(delta);

    let moveZ = 0; let moveX = 0;
    if (!isUserInteracting) {
        if (keysPressed['w'] || keysPressed['arrowup']) moveZ = 1;
        if (keysPressed['s'] || keysPressed['arrowdown']) moveZ = -1;
        if (keysPressed['a'] || keysPressed['arrowleft']) moveX = 1;
        if (keysPressed['d'] || keysPressed['arrowright']) moveX = -1;
    }
    playerVelocity.set(0, 0, 0); moveDirection.set(0, 0, 0);
    const playerIsMoving = moveX !== 0 || moveZ !== 0;
    if (playerIsMoving) {
        walkCycleTime += delta;
        if (walkCycleTime > walkCycleDuration) { walkCycleTime -= walkCycleDuration; }
        const swingPhase = (walkCycleTime / walkCycleDuration) * Math.PI * 2;
        const armSwing = Math.sin(swingPhase) * maxArmSwing;
        const legSwing = Math.sin(swingPhase) * maxLimbSwing;
        playerLeftArm.rotation.x = Math.PI + armSwing; playerRightArm.rotation.x = Math.PI - armSwing;
        playerLeftLeg.rotation.x = legSwing; playerRightLeg.rotation.x = -legSwing;

        camera.getWorldDirection(cameraForward); cameraForward.y = 0; cameraForward.normalize();
        cameraRight.crossVectors(upVector, cameraForward).normalize();
        moveDirection.addScaledVector(cameraForward, moveZ).addScaledVector(cameraRight, moveX).normalize();
        playerVelocity.copy(moveDirection).multiplyScalar(playerSpeed * delta);
        const currentPos = player.position.clone();
        const nextPosX = currentPos.clone().add(new THREE.Vector3(playerVelocity.x, 0, 0));
        if (!checkCollision(nextPosX)) { player.position.x = nextPosX.x; } else { playerVelocity.x = 0; }
        const nextPosZ = player.position.clone().add(new THREE.Vector3(0, 0, playerVelocity.z));
        if (!checkCollision(nextPosZ)) { player.position.z = nextPosZ.z; } else { playerVelocity.z = 0; }
        if (moveDirection.lengthSq() > 0.001) {
            targetQuaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), moveDirection);
            player.quaternion.slerp(targetQuaternion, 0.2);
        }
    } else {
        walkCycleTime = 0;
        playerLeftArm.rotation.x = Math.PI; playerRightArm.rotation.x = Math.PI;
        playerLeftLeg.rotation.x = 0; playerRightLeg.rotation.x = 0;
    }

    if (!portalBarrier) {
        const currentX = player.position.x;
        const prevLocation = playerLocation;
        if (currentX > DIVIDING_WALL_X + playerRadius && prevLocation === 'mitochondria') {
            playerLocation = 'cytosol';
            showFeedback("You are entering the Cytosol", 3000);
        }
        else if (currentX < DIVIDING_WALL_X - playerRadius && prevLocation === 'cytosol') {
            playerLocation = 'mitochondria';
            showFeedback("You are entering the Mitochondria", 3000);
        }
    }

    if (!isUserInteracting) {
        let minDistSq = interactionRadius * interactionRadius;
        let foundClosest = null;
        player.getWorldPosition(playerWorldPos);

        interactiveObjects.forEach(obj => {
            if (obj?.parent === scene && obj.visible) {
                let objPos = new Vector3();
                obj.getWorldPosition(objPos);
                const distSq = playerWorldPos.distanceToSquared(objPos);
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    foundClosest = obj;
                }
            }
        });

        if (foundClosest !== closestInteractiveObject) {
            if (closestInteractiveObject) {
                unhighlightObject(closestInteractiveObject);
            }
            if (foundClosest) {
                highlightObject(foundClosest);
                showInteractionPrompt(foundClosest.userData.name || 'Object', foundClosest.userData.type);
            } else {
                hideInteractionPrompt();
            }
            lastClosestObject = closestInteractiveObject;
            closestInteractiveObject = foundClosest;
        }
    } else {
        if (closestInteractiveObject) {
             unhighlightObject(closestInteractiveObject);
             closestInteractiveObject = null;
        }
         if (lastClosestObject) {
             unhighlightObject(lastClosestObject);
             lastClosestObject = null;
         }
        hideInteractionPrompt();
    }

    const hoverSpeed = 2; const hoverAmount = 0.2;
    resourceMeshes.forEach((resource, index) => {
        if (resource?.parent === scene && resource.userData?.initialY !== undefined) {
            const yPos = resource.userData.initialY + Math.sin(elapsedTime * hoverSpeed + index * 0.5) * hoverAmount;
            if (!isNaN(yPos)) {
                resource.position.y = yPos;
            }
        }
    });
    player.getWorldPosition(playerWorldPos);
    cameraTargetPos.copy(cameraIdealOffset).applyQuaternion(player.quaternion).add(playerWorldPos);
    cameraTargetLookAt.copy(playerWorldPos).add(cameraIdealLookAt);

    if (!isUserInteracting || (!dialogueBox.classList.contains('hidden') || !realityRiverUI.classList.contains('hidden'))) {
        camera.position.lerp(cameraTargetPos, cameraPositionSmoothFactor);
        controls.target.lerp(cameraTargetLookAt, cameraTargetSmoothFactor);
    } else {
        controls.target.copy(cameraTargetLookAt);
    }
    controls.update(delta);


    if (professorHepaticus && professorHepaticus.parent === scene && professorBasePos) {
        professorPaceTimer += delta;
        if (professorPaceTimer > professorPaceInterval) {
            let newTargetX = professorBasePos.x + (Math.random()-0.5)*1.5;
            let newTargetZ = professorBasePos.z + (Math.random()-0.5)*1.5;
            if (newTargetX < effectiveAlcoveOpeningX + 1 && newTargetZ > ALCOVE_Z_START -1 && newTargetZ < ALCOVE_Z_END + 1) {
                newTargetX = Math.max(newTargetX, effectiveAlcoveOpeningX + 1.5);
            }
            professorTargetPos.set(newTargetX, professorBasePos.y, newTargetZ);
            professorPaceTimer = 0;
            professorPaceInterval = 2 + Math.random() * 2;
        }
        professorHepaticus.position.lerp(professorTargetPos, 0.02);
        professorHepaticus.rotation.y = Math.sin(elapsedTime * professorSwaySpeed * 0.5) * 0.1;
        const profRobe = professorHepaticus.children.find(c => c.name === "robe");
        if (profRobe) profRobe.rotation.y = Math.sin(elapsedTime * professorSwaySpeed) * 0.05;

        const leftSleeve = professorHepaticus.children.find(c => c.geometry && c.position.x < -0.1 && c.geometry instanceof THREE.CylinderGeometry);
        const rightSleeve = professorHepaticus.children.find(c => c.geometry && c.position.x > 0.1 && c.geometry instanceof THREE.CylinderGeometry);

        if(leftSleeve) leftSleeve.rotation.z = Math.PI / 4 + Math.sin(elapsedTime * professorArmSwingSpeed) * 0.2;
        if(rightSleeve) rightSleeve.rotation.z = -Math.PI / 4 - Math.sin(elapsedTime * professorArmSwingSpeed) * 0.2;
    }
    if (ornithineUsher && ornithineUsher.parent === scene) {
        ornithineUsher.position.y = 0 + Math.sin(elapsedTime * usherFloatSpeed) * usherFloatAmount;
        ornithineUsher.rotation.y = Math.sin(elapsedTime * usherFloatSpeed * 0.7) * 0.15;
    }

    renderer.render(scene, camera);
}

// --- Initial Setup Calls ---
updateInventoryUI(); updateQuestUI();
player.getWorldPosition(playerWorldPos);
const initialCamPos = cameraIdealOffset.clone().applyQuaternion(player.quaternion).add(playerWorldPos);
const initialLookAt = playerWorldPos.clone().add(cameraIdealLookAt);
camera.position.copy(initialCamPos); controls.target.copy(initialLookAt); camera.lookAt(controls.target); controls.update();
loadingScreen.classList.add('hidden');


// --- NPC Creation Functions ---
function createOrnithineUsher(position) {
    const usherGroup = new THREE.Group();
    usherGroup.position.copy(position);
    const torsoMaterial = new THREE.MeshStandardMaterial({ color: 0x3366cc, roughness: 0.5 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.18), torsoMaterial);
    torso.position.y = 1.0;
    torso.name = "body";
    usherGroup.add(torso);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffe0b3, roughness: 0.4 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 16), headMaterial);
    head.position.y = 1.38;
    usherGroup.add(head);
    const eyeWhiteMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const leftEyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), eyeWhiteMaterial);
    leftEyeWhite.position.set(-0.06, 1.43, 0.13);
    const rightEyeWhite = leftEyeWhite.clone();
    rightEyeWhite.position.x = 0.06;
    usherGroup.add(leftEyeWhite);
    usherGroup.add(rightEyeWhite);
    const pupilMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), pupilMaterial);
    leftPupil.position.set(-0.06, 1.43, 0.17);
    const rightPupil = leftPupil.clone();
    rightPupil.position.x = 0.06;
    usherGroup.add(leftPupil);
    usherGroup.add(rightPupil);
    const smileCurve = new THREE.CatmullRomCurve3([ new THREE.Vector3(-0.045, 1.37, 0.16), new THREE.Vector3(0, 1.35, 0.18), new THREE.Vector3(0.045, 1.37, 0.16) ]);
    const smileGeometry = new THREE.TubeGeometry(smileCurve, 20, 0.008, 8, false);
    const smileMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const smile = new THREE.Mesh(smileGeometry, smileMaterial);
    usherGroup.add(smile);
    const armMaterial = new THREE.MeshStandardMaterial({ color: 0x3366cc, roughness: 0.5 });
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.38, 10), armMaterial);
    leftArm.position.set(-0.21, 1.22, 0);
    leftArm.geometry.translate(0, -0.38/2, 0);
    leftArm.rotation.z = Math.PI / 5;
    usherGroup.add(leftArm);
    const rightArm = leftArm.clone();
    rightArm.position.x = 0.21;
    rightArm.rotation.z = -Math.PI / 5;
    usherGroup.add(rightArm);
    const handMaterial = new THREE.MeshStandardMaterial({ color: 0xffe0b3 });
    const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), handMaterial);
    leftHand.position.set(-0.21 - Math.sin(Math.PI/5)*0.38, 1.22 - Math.cos(Math.PI/5)*0.38, 0);
    usherGroup.add(leftHand);
    const rightHand = leftHand.clone();
    rightHand.position.x = 0.21 + Math.sin(Math.PI/5)*0.38;
    usherGroup.add(rightHand);
    const legMaterial = new THREE.MeshStandardMaterial({ color: 0x223366, roughness: 0.6 });
    const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.75, 10), legMaterial);
    leftLeg.position.set(-0.09, 0.75/2, 0);
    usherGroup.add(leftLeg);
    const rightLeg = leftLeg.clone();
    rightLeg.position.x = 0.09;
    usherGroup.add(rightLeg);
    const bowtieMaterial = new THREE.MeshStandardMaterial({ color: 0xff3366 });
    const leftBow = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.01), bowtieMaterial);
    leftBow.position.set(-0.025, 1.27, 0.11);
    const rightBow = leftBow.clone();
    rightBow.position.x = 0.025;
    const bowKnot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), bowtieMaterial);
    bowKnot.position.set(0, 1.27, 0.11);
    usherGroup.add(leftBow); usherGroup.add(rightBow); usherGroup.add(bowKnot);
    const label = createTextSprite("Ornithine Usher", { x: 0, y: 1.7, z: 0 }, { fontSize: 36, scale: 0.75 });
    usherGroup.add(label);
    usherGroup.userData = { type: 'npc', name: 'Ornithine Usher' };
    usherGroup.traverse(child => { if (child.isMesh) child.castShadow = true; });
    return usherGroup;
}

function createProfessorHepaticus(position) {
    const professorGroup = new THREE.Group();
    professorGroup.position.copy(position);
    const robeMaterial = new THREE.MeshStandardMaterial({ color: 0x8888cc, roughness: 0.7 });
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.5, 24), robeMaterial);
    robe.position.y = 0.75;
    robe.name = "robe";
    professorGroup.add(robe);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffe0b3, roughness: 0.4 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 18), headMaterial);
    head.position.y = 1.55;
    professorGroup.add(head);
    const noseMaterial = new THREE.MeshStandardMaterial({ color: 0xffe0b3 });
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.13, 12), noseMaterial);
    nose.position.set(0, 1.57, 0.18);
    nose.rotation.x = Math.PI / 2.2;
    professorGroup.add(nose);
    const eyeWhiteMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const leftEyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 10), eyeWhiteMaterial);
    leftEyeWhite.position.set(-0.055, 1.62, 0.13);
    const rightEyeWhite = leftEyeWhite.clone();
    rightEyeWhite.position.x = 0.055;
    professorGroup.add(leftEyeWhite); professorGroup.add(rightEyeWhite);
    const pupilMaterial = new THREE.MeshStandardMaterial({ color: 0x3366cc });
    const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), pupilMaterial);
    leftPupil.position.set(-0.055, 1.62, 0.16);
    const rightPupil = leftPupil.clone();
    rightPupil.position.x = 0.055;
    professorGroup.add(leftPupil); professorGroup.add(rightPupil);
    const browMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const leftBrow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.012), browMaterial);
    leftBrow.position.set(-0.055, 1.66, 0.13);
    leftBrow.rotation.z = Math.PI / 10;
    professorGroup.add(leftBrow);
    const rightBrow = leftBrow.clone();
    rightBrow.position.x = 0.055;
    rightBrow.rotation.z = -Math.PI / 10;
    professorGroup.add(rightBrow);
    const beardMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.45, 18), beardMaterial);
    beard.position.set(0, 1.36, 0.09);
    beard.rotation.x = Math.PI / 16;
    professorGroup.add(beard);
    const glassMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, wireframe: true });
    const leftGlass = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 8, 24), glassMaterial);
    leftGlass.position.set(-0.055, 1.62, 0.13);
    leftGlass.rotation.x = Math.PI / 2;
    const rightGlass = leftGlass.clone();
    rightGlass.position.x = 0.055;
    professorGroup.add(leftGlass); professorGroup.add(rightGlass);
    const hatMaterial = new THREE.MeshStandardMaterial({ color: 0x223366, roughness: 0.5 });
    const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 18), hatMaterial);
    hatBrim.position.set(0, 1.73, 0);
    professorGroup.add(hatBrim);
    const hatTop = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.32, 18), hatMaterial);
    hatTop.position.set(0, 1.73 + 0.015 + 0.32/2, 0);
    professorGroup.add(hatTop);
    const sleeveMaterial = new THREE.MeshStandardMaterial({ color: 0x8888cc, roughness: 0.7 });
    const leftSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.55, 14), sleeveMaterial);
    leftSleeve.position.set(-0.23, 1.18, 0);
    leftSleeve.geometry.translate(0, -0.55/2, 0);
    leftSleeve.rotation.z = Math.PI / 4;
    professorGroup.add(leftSleeve);
    const rightSleeve = leftSleeve.clone();
    rightSleeve.position.x = 0.23;
    rightSleeve.rotation.z = -Math.PI / 4;
    professorGroup.add(rightSleeve);
    const handMaterial = new THREE.MeshStandardMaterial({ color: 0xffe0b3 });
    const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), handMaterial);
    leftHand.position.set(-0.23 - Math.sin(Math.PI/4)*0.55, 1.18 - Math.cos(Math.PI/4)*0.55, 0);
    professorGroup.add(leftHand);
    const rightHand = leftHand.clone();
    rightHand.position.x = 0.23 + Math.sin(Math.PI/4)*0.55;
    professorGroup.add(rightHand);
    const label = createTextSprite("Professor Hepaticus", { x: 0, y: 2.1, z: 0 }, { fontSize: 36, scale: 0.75 });
    professorGroup.add(label);
    professorGroup.userData = { type: 'npc', name: 'Professor Hepaticus', questId: 'ureaCycle' };
    professorGroup.traverse(child => { if (child.isMesh) child.castShadow = true; });
    return professorGroup;
}
if (professorHepaticus) {
    professorBasePos = professorHepaticus.position.clone();
    professorTargetPos = professorBasePos.clone();
}


// --- Decorative Elements ---
function addMitoCristae() {
    const cristaeMat = new THREE.MeshStandardMaterial({ color: MITO_SECONDARY_COLOR, roughness: 0.9, side:THREE.DoubleSide });
    const cristaeHeight = wallHeight * 0.6;
    const cristaeDepth = 0.2;
    const numCristaeSets = 4;

    for (let i = 0; i < numCristaeSets; i++) {
        const cristaeLength = MITO_WIDTH * (0.15 + Math.random() * 0.25);
        let xPos = MIN_X + MITO_WIDTH * (0.3 + i * 0.18) + (Math.random()-0.5) * 1.5;
        let zPos = (Math.random() - 0.5) * (MAX_Z - MIN_Z) * 0.7;

        const alcoveXMin = MIN_X - 1;
        const alcoveXMax = effectiveAlcoveOpeningX + 1;
        const alcoveZMin = ALCOVE_Z_START - 1;
        const alcoveZMax = ALCOVE_Z_END + 1;

        if (xPos > alcoveXMin && xPos < alcoveXMax && zPos > alcoveZMin && zPos < alcoveZMax) {
            xPos = Math.max(xPos, alcoveXMax + 0.5);
            if (Math.random() < 0.5) zPos = MIN_Z + cristaeLength/2 + 1; else zPos = MAX_Z - cristaeLength/2 - 1;
        }
        if (xPos > DIVIDING_WALL_X - 2 && xPos < DIVIDING_WALL_X + 2 && zPos > portalWallCenterZ - portalGapWidth && zPos < portalWallCenterZ + portalGapWidth) {
            continue;
        }

        const cristaeGeo = new THREE.BoxGeometry(cristaeDepth, cristaeHeight, cristaeLength);
        const crista = new THREE.Mesh(cristaeGeo, cristaeMat);
        crista.position.set(xPos, cristaeHeight / 2, zPos);
        crista.receiveShadow = true;
        scene.add(crista);
    }
}
addMitoCristae();

function addCytoVesicles() {
    const vesicleMat = new THREE.MeshStandardMaterial({ color: 0xAACCFF, transparent: true, opacity: 0.5, roughness: 0.3 });
    for (let i = 0; i < 15; i++) {
        const radius = Math.random() * 0.3 + 0.2;
        const vesicleGeo = new THREE.SphereGeometry(radius, 8, 6);
        const vesicle = new THREE.Mesh(vesicleGeo, vesicleMat);
        vesicle.position.set(
            DIVIDING_WALL_X + Math.random() * CYTO_WIDTH * 0.8 + 1,
            Math.random() * 1.5 + 0.5,
            (Math.random() - 0.5) * (MAX_Z - MIN_Z) * 0.8
        );
        scene.add(vesicle);
    }
}
addCytoVesicles();

// --- Sound Functions for Effects ---
function playPortalCelebration() {
    if (audioContext.state === 'suspended') audioContext.resume();
    const masterGain = audioContext.createGain(); masterGain.gain.value = 0.1; masterGain.connect(audioContext.destination);
    const osc1 = audioContext.createOscillator(), osc2 = audioContext.createOscillator(), osc3 = audioContext.createOscillator();
    osc1.type = 'sine'; osc2.type = 'sine'; osc3.type = 'sine';
    const gain1 = audioContext.createGain(), gain2 = audioContext.createGain(), gain3 = audioContext.createGain();
    osc1.connect(gain1); osc2.connect(gain2); osc3.connect(gain3);
    gain1.connect(masterGain); gain2.connect(masterGain); gain3.connect(masterGain);
    const notes = [ { f1: 523.25, f2: 659.25, f3: 783.99 }, { f1: 587.33, f2: 698.46, f3: 880.00 }, { f1: 659.25, f2: 783.99, f3: 987.77 }, { f1: 698.46, f2: 880.00, f3: 1046.50 }, { f1: 783.99, f2: 987.77, f3: 1174.66 }, { f1: 880.00, f2: 1046.50, f3: 1318.51 } ];
    let currentNote = 0; const noteDuration = 0.15;
    function playNext() {
        if (currentNote >= notes.length) {
            osc1.stop(); osc2.stop(); osc3.stop(); masterGain.disconnect();
            setTimeout(() => { startBackgroundMusic('postPortal'); }, 500);
            return;
        }
        const note = notes[currentNote];
        osc1.frequency.setValueAtTime(note.f1, audioContext.currentTime);
        osc2.frequency.setValueAtTime(note.f2, audioContext.currentTime);
        osc3.frequency.setValueAtTime(note.f3, audioContext.currentTime);
        currentNote++; setTimeout(playNext, noteDuration * 1000);
    }
    osc1.start(); osc2.start(); osc3.start(); playNext();
}

function playMoleculeGenerationSound() {
    if (audioContext.state === 'suspended') audioContext.resume();
    const masterGain = audioContext.createGain(); masterGain.gain.value = 0.15; masterGain.connect(audioContext.destination);
    const osc1 = audioContext.createOscillator(), osc2 = audioContext.createOscillator(), osc3 = audioContext.createOscillator();
    osc1.type = 'sine'; osc2.type = 'sine'; osc3.type = 'sine';
    const gain1 = audioContext.createGain(), gain2 = audioContext.createGain(), gain3 = audioContext.createGain();
    osc1.connect(gain1); osc2.connect(gain2); osc3.connect(gain3);
    gain1.connect(masterGain); gain2.connect(masterGain); gain3.connect(masterGain);
    const notes = [ { f1: 523.25, f2: 659.25, f3: 783.99 }, { f1: 587.33, f2: 698.46, f3: 880.00 }, { f1: 659.25, f2: 783.99, f3: 987.77 }, { f1: 698.46, f2: 880.00, f3: 1046.50 } ];
    let currentNote = 0; const noteDuration = 0.2;
    function playNext() {
        if (currentNote >= notes.length) {
            osc1.stop(); osc2.stop(); osc3.stop(); masterGain.disconnect(); return;
        }
        const note = notes[currentNote];
        osc1.frequency.setValueAtTime(note.f1, audioContext.currentTime);
        osc2.frequency.setValueAtTime(note.f2, audioContext.currentTime);
        osc3.frequency.setValueAtTime(note.f3, audioContext.currentTime);
        currentNote++; setTimeout(playNext, noteDuration * 1000);
    }
    osc1.start(); osc2.start(); osc3.start(); playNext();
}

animate();
console.log("Metabolon RPG Initialized (v30 - Feedback Streamlined).");
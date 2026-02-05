// Fez Morocco Frame - Three.js Color Sampler
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// === SCENE SETUP ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0);

const camera = new THREE.PerspectiveCamera(
 70,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0.2, 0, 10);


const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; // Aktivér skygger i renderer
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Bløde skygger
renderer.toneMapping = THREE.NoToneMapping; // Deaktivér tone mapping for præcise farver
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enabled = false;

// Raycaster til at detektere klik på billedet i 3D
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// BELYSNING OG SKYGGE INDSTILLINGER
const ambientLight = new THREE.AmbientLight(0xffffff, 0.90); // Højt generelt lys
scene.add(ambientLight);

// Moderat directional light for subtile skygger
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Moderat styrke
directionalLight.position.set(0, -10, 10); // Lyskildens position (x, y, z)
directionalLight.castShadow = true; // Aktivér skygger
scene.add(directionalLight);

// Side-lys for at fylde skygger lidt op
const sideLight = new THREE.DirectionalLight(0xffffff, 0.25);
sideLight.position.set(-3, 2, 3);
scene.add(sideLight);
// ============================================

// === STATE ===
let frameModel = null;
let holeObjects = []; // Kun hul1-hul62
let specialObjects = []; // C, C2, E, F, M, O1, O2, O3, R, Z - skal have samme farve som hul1
let frameInnerPlane = null; // Til at vise billedet
let sampledColors = [
  new THREE.Color(0x3498db), // Blå 1
  new THREE.Color(0xe74c3c), // Rød 2
  new THREE.Color(0x2ecc71), // Grøn 3
  new THREE.Color(0xf39c12), // Orange 4
  new THREE.Color(0x9b59b6), // Lilla 5
  new THREE.Color(0x1abc9c), // Turkis 6
  new THREE.Color(0xe67e22), // Mørk orange 7
  new THREE.Color(0x95a5a6), // Grå 8
  new THREE.Color(0x34495e)  // Mørk blå 9
];
let samplingMode = false;
let currentColorIndex = 0;
let sourceImage = null;
let uploadedImageTexture = null;


// FARVE INDSTILLINGER - ÆNDRE HER! 

const FRAME_COLOR = 0xf7b594; //ramme
const HOLE_BOTTOM_COLOR = 0x96715f; // bundfarve i hullerne

// Liste over special objekter der skal have samme farve som hul1
const SPECIAL_OBJECT_NAMES = ['C', 'C2', 'E', 'F', 'M', 'O1', 'O2', 'O3', 'R', 'Z'];

// === LOAD GLB MODEL ===
const loader = new GLTFLoader();
loader.load(
  'modeller/rigtigerammemoroccofes.glb', 
  (gltf) => {
    frameModel = gltf.scene;
    
    // Roter modellen så den står oprejst
    frameModel.rotation.x = Math.PI / 2; // 90 grader rotation
    
    scene.add(frameModel);
    
    // Find alle objekter og kategoriser dem
    frameModel.traverse((child) => {
      if (child.isMesh) {
        const name = child.name;
        
        // Tjek om det er et hul (hul1-hul62)
        const holeMatch = name.match(/hul(\d+)/i);
        if (holeMatch) {
          const holeNumber = parseInt(holeMatch[1]);
          if (holeNumber >= 1 && holeNumber <= 62) {
            // Dette er et hul der skal få tilfældig farve
            holeObjects.push(child);
            
            // Brug MeshBasicMaterial for præcise farver UDEN lyseffekter
            child.material = new THREE.MeshBasicMaterial({
              color: HOLE_BOTTOM_COLOR
            });
            
            console.log(`Fandt hul: ${name} (nummer ${holeNumber})`);
          }
        }
        // Tjek om det er et special objekt (C, C2, E, F, M, O1, O2, O3, R, Z)
        else if (SPECIAL_OBJECT_NAMES.some(specialName => 
          name.toLowerCase() === specialName.toLowerCase() || 
          name.toLowerCase().startsWith(specialName.toLowerCase() + '.')
        )) {
          // Dette skal have samme farve som hul1
          specialObjects.push(child);
          
          // Brug MeshBasicMaterial for præcise farver UDEN lyseffekter
          child.material = new THREE.MeshBasicMaterial({
            color: HOLE_BOTTOM_COLOR
          });
          
          console.log(`Fandt special objekt: ${name}`);
        }
        // Alt andet er ramme
        else {
          // Dette er rammen selv - TVING ramme farven
          // Brug MeshStandardMaterial for skygger
          child.material = new THREE.MeshStandardMaterial({
            color: FRAME_COLOR,
            roughness: 0.9, // Meget mat = bedre farvegengivelse
            metalness: 0.0  // Ingen metallisk effekt
          });
          child.material.userData.isFrame = true; // Marker som ramme
          
          // Aktivér skygger for rammen
          child.castShadow = true;
          child.receiveShadow = true;
          
          console.log(`Fandt ramme del: ${name} - satte ramme farve`);
        }
      }
    });
    
    console.log(`Total antal huller (hul1-hul62) fundet: ${holeObjects.length}`);
    console.log(`Total antal special objekter fundet: ${specialObjects.length}`);
    
    // Opret en plane til at vise billedet inde i rammen
    createImagePlane();
    
    updateStatus(`Model indlæst! ${holeObjects.length} huller og ${specialObjects.length} special objekter fundet.`);
  },
  (progress) => {
    console.log(`Indlæser: ${(progress.loaded / progress.total * 100).toFixed(2)}%`);
  },
  (error) => {
    console.error('Fejl ved indlæsning af model:', error);
    updateStatus('Fejl: Kunne ikke indlæse model. Tjek sti til GLB fil.');
  }
);

// Opret en plane til at vise det uploadede billede
function createImagePlane() {
  // Tilpas størrelsen efter din ramme
  const geometry = new THREE.PlaneGeometry(6, 10);
  
  // MeshBasicMaterial påvirkes IKKE af lys - perfekt til billeder
  const material = new THREE.MeshBasicMaterial({ 
    color: 0xffffff,
    side: THREE.DoubleSide,
    toneMapped: false // Deaktivér tone mapping for præcise farver
  });
  
  frameInnerPlane = new THREE.Mesh(geometry, material);
  frameInnerPlane.position.set(0, 0, -0.5); // Justér z-position så den er bag rammen
  
  // Sørg for at billedet IKKE modtager eller kaster skygger
  frameInnerPlane.receiveShadow = false;
  frameInnerPlane.castShadow = false;
  
  scene.add(frameInnerPlane);
}

// Opdater billedet i rammen
function updateFrameImage(img) {
  if (!frameInnerPlane) return;
  
  // Opret texture fra billedet med korrekt color space
  const texture = new THREE.Texture(img);
  texture.colorSpace = THREE.SRGBColorSpace; // Korrekt farverum
  texture.needsUpdate = true;
  
  // Opdater materialet
  frameInnerPlane.material.map = texture;
  frameInnerPlane.material.needsUpdate = true;
  
  uploadedImageTexture = texture;
  
  updateStatus('Billede sat ind i rammen!');
}

// === UI SETUP ===
function createUI() {
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    top: 20px;
    left: 20px;
    background: white;
    padding: 20px;
    border-radius: 10px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-family: Arial, sans-serif;
    max-width: 300px;
  `;
  
  container.innerHTML = `
    <h2 style="margin: 0 0 15px 0; font-size: 18px;">Color Sampler</h2>
    
    <div style="margin-bottom: 15px;">
      <label style="display: block; margin-bottom: 5px; font-size: 14px;">Upload billede:</label>
      <input type="file" id="imageUpload" accept="image/*" style="width: 100%;">
    </div>
    
    <!-- Canvas er nu skjult - bruges kun til at læse pixel data -->
    <canvas id="imageCanvas" style="display: none;"></canvas>
    
    <div style="margin-bottom: 15px;">
      <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold;">Samplede farver:</p>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 10px;">
        <div>
          <div id="color1" style="width: 100%; height: 35px; border-radius: 5px; background: #3498db; cursor: pointer; border: 2px solid #ddd;"></div>
          <button id="sample1" style="width: 100%; margin-top: 5px; padding: 3px; cursor: pointer; font-size: 11px;">Sample 1</button>
        </div>
        <div>
          <div id="color2" style="width: 100%; height: 35px; border-radius: 5px; background: #e74c3c; cursor: pointer; border: 2px solid #ddd;"></div>
          <button id="sample2" style="width: 100%; margin-top: 5px; padding: 3px; cursor: pointer; font-size: 11px;">Sample 2</button>
        </div>
        <div>
          <div id="color3" style="width: 100%; height: 35px; border-radius: 5px; background: #2ecc71; cursor: pointer; border: 2px solid #ddd;"></div>
          <button id="sample3" style="width: 100%; margin-top: 5px; padding: 3px; cursor: pointer; font-size: 11px;">Sample 3</button>
        </div>
        <div>
          <div id="color4" style="width: 100%; height: 35px; border-radius: 5px; background: #f39c12; cursor: pointer; border: 2px solid #ddd;"></div>
          <button id="sample4" style="width: 100%; margin-top: 5px; padding: 3px; cursor: pointer; font-size: 11px;">Sample 4</button>
        </div>
        <div>
          <div id="color5" style="width: 100%; height: 35px; border-radius: 5px; background: #9b59b6; cursor: pointer; border: 2px solid #ddd;"></div>
          <button id="sample5" style="width: 100%; margin-top: 5px; padding: 3px; cursor: pointer; font-size: 11px;">Sample 5</button>
        </div>
        <div>
          <div id="color6" style="width: 100%; height: 35px; border-radius: 5px; background: #1abc9c; cursor: pointer; border: 2px solid #ddd;"></div>
          <button id="sample6" style="width: 100%; margin-top: 5px; padding: 3px; cursor: pointer; font-size: 11px;">Sample 6</button>
        </div>
        <div>
          <div id="color7" style="width: 100%; height: 35px; border-radius: 5px; background: #e67e22; cursor: pointer; border: 2px solid #ddd;"></div>
          <button id="sample7" style="width: 100%; margin-top: 5px; padding: 3px; cursor: pointer; font-size: 11px;">Sample 7</button>
        </div>
        <div>
          <div id="color8" style="width: 100%; height: 35px; border-radius: 5px; background: #95a5a6; cursor: pointer; border: 2px solid #ddd;"></div>
          <button id="sample8" style="width: 100%; margin-top: 5px; padding: 3px; cursor: pointer; font-size: 11px;">Sample 8</button>
        </div>
        <div>
          <div id="color9" style="width: 100%; height: 35px; border-radius: 5px; background: #34495e; cursor: pointer; border: 2px solid #ddd;"></div>
          <button id="sample9" style="width: 100%; margin-top: 5px; padding: 3px; cursor: pointer; font-size: 11px;">Sample 9</button>
        </div>
      </div>
    </div>
    
    <button id="applyColors" style="width: 100%; padding: 10px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; font-weight: bold;">
      Anvend farver på huller
    </button>
    
    <p id="status" style="margin: 10px 0 0 0; font-size: 12px; color: #666;"></p>
  `;
  
  document.body.appendChild(container);
  
  // Event listeners
  document.getElementById('imageUpload').addEventListener('change', handleImageUpload);
  document.getElementById('sample1').addEventListener('click', () => activateSampling(0));
  document.getElementById('sample2').addEventListener('click', () => activateSampling(1));
  document.getElementById('sample3').addEventListener('click', () => activateSampling(2));
  document.getElementById('sample4').addEventListener('click', () => activateSampling(3));
  document.getElementById('sample5').addEventListener('click', () => activateSampling(4));
  document.getElementById('sample6').addEventListener('click', () => activateSampling(5));
  document.getElementById('sample7').addEventListener('click', () => activateSampling(6));
  document.getElementById('sample8').addEventListener('click', () => activateSampling(7));
  document.getElementById('sample9').addEventListener('click', () => activateSampling(8));
  document.getElementById('applyColors').addEventListener('click', applyColorsToHoles);
  
  // Lyt til klik på renderer (3D scenen) i stedet for canvas
  renderer.domElement.addEventListener('click', handle3DClick);
}

function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      sourceImage = img;
      
      // Vis billedet i rammen
      updateFrameImage(img);
      
      const canvas = document.getElementById('imageCanvas');
      const ctx = canvas.getContext('2d');
      
      // Sæt canvas størrelse til billedets størrelse for præcis sampling
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Tegn billede på canvas til color sampling (canvas er skjult)
      ctx.drawImage(img, 0, 0);
      
      updateStatus('Billede uploadet! Klik på en "Sample" knap og derefter på billedet i rammen for at vælge farver.');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function activateSampling(colorIndex) {
  samplingMode = true;
  currentColorIndex = colorIndex;
  
  // Skift cursor på 3D scenen
  renderer.domElement.style.cursor = 'crosshair';
  
  updateStatus(`Pipette ${colorIndex + 1} aktiv - klik på billedet i rammen for at vælge farve`);
}

function handle3DClick(event) {
  if (!samplingMode || !sourceImage || !frameInnerPlane) return;
  
  // Beregn mouse position i normalized device coordinates (-1 til +1)
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  // Opdater raycaster
  raycaster.setFromCamera(mouse, camera);
  
  // Tjek om vi ramte billedplanet
  const intersects = raycaster.intersectObject(frameInnerPlane);
  
  if (intersects.length > 0) {
    const intersect = intersects[0];
    
    // Få UV coordinates fra intersection point (0-1 range)
    const uv = intersect.uv;
    
    // Konverter UV til pixel koordinater på canvas
    const canvas = document.getElementById('imageCanvas');
    const x = Math.floor(uv.x * canvas.width);
    const y = Math.floor((1 - uv.y) * canvas.height); // Flip Y
    
    // Læs pixel farve fra canvas
    const ctx = canvas.getContext('2d');
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    
    // Konverter til Three.js color i korrekt farverum
    const color = new THREE.Color();
    color.setRGB(pixel[0] / 255, pixel[1] / 255, pixel[2] / 255, THREE.SRGBColorSpace);
    
    sampledColors[currentColorIndex] = color;
    
    // Opdater UI farve display
    const colorDiv = document.getElementById(`color${currentColorIndex + 1}`);
    colorDiv.style.background = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
    
    // Reset sampling mode
    samplingMode = false;
    renderer.domElement.style.cursor = 'default';
    
    updateStatus(`Farve ${currentColorIndex + 1} opdateret!`);
  }
}

// Hjælpefunktion til at finde naboer baseret på afstand
function findNeighbors(holes, maxDistance = 0.8) {
  const neighbors = new Map();
  
  holes.forEach((hole, index) => {
    const holeNeighbors = [];
    const pos1 = new THREE.Vector3();
    hole.getWorldPosition(pos1);
    
    holes.forEach((otherHole, otherIndex) => {
      if (index === otherIndex) return;
      
      const pos2 = new THREE.Vector3();
      otherHole.getWorldPosition(pos2);
      
      const distance = pos1.distanceTo(pos2);
      
      if (distance < maxDistance) {
        holeNeighbors.push(otherIndex);
      }
    });
    
    neighbors.set(index, holeNeighbors);
  });
  
  return neighbors;
}

// Hjælpefunktion til at vælge en farve der ikke bruges af naboer
function selectColorAvoidingNeighbors(usedColors, availableColors) {
  // Prøv at finde en farve der ikke er i usedColors
  for (let i = 0; i < availableColors.length; i++) {
    const colorIndex = Math.floor(Math.random() * availableColors.length);
    if (!usedColors.has(colorIndex)) {
      return colorIndex;
    }
  }
  
  // Hvis alle farver er brugt af naboer, vælg en tilfældig
  return Math.floor(Math.random() * availableColors.length);
}

function applyColorsToHoles() {
  if (holeObjects.length === 0) {
    updateStatus('Ingen huller fundet - vent på at modellen indlæses');
    return;
  }
  
  console.log('=== ANVENDER FARVER MED NABO-TJEK ===');
  console.log(`Antal huller (hul1-hul62): ${holeObjects.length}`);
  console.log(`Antal special objekter: ${specialObjects.length}`);
  console.log(`Samplede farver:`, sampledColors);
  
  // Find naboer for hvert hul
  const neighbors = findNeighbors(holeObjects);
  console.log('Naboer fundet:', neighbors);
  
  // Array til at holde styr på hvilken farve hvert hul har fået
  const holeColorIndices = new Array(holeObjects.length).fill(-1);
  
  let hul1Color = null;
  let hul1Index = -1;
  
  // Find hul1 først
  holeObjects.forEach((hole, index) => {
    const match = hole.name.match(/hul(\d+)/i);
    if (match && match[1] === '1') {
      hul1Index = index;
    }
  });
  
  // Anvend farver med nabo-tjek
  holeObjects.forEach((hole, index) => {
    if (!hole.material) return;
    
    // Find hvilke farver naboerne bruger
    const neighborColorIndices = new Set();
    const holeNeighbors = neighbors.get(index) || [];
    
    holeNeighbors.forEach(neighborIndex => {
      if (holeColorIndices[neighborIndex] !== -1) {
        neighborColorIndices.add(holeColorIndices[neighborIndex]);
      }
    });
    
    // Vælg en farve der ikke bruges af naboer
    const colorIndex = selectColorAvoidingNeighbors(neighborColorIndices, sampledColors);
    const selectedColor = sampledColors[colorIndex];
    
    // Gem farve index
    holeColorIndices[index] = colorIndex;
    
    // Anvend farven
    hole.material.color.copy(selectedColor);
    hole.material.needsUpdate = true;
    
    // Gem hul1's farve
    if (index === hul1Index) {
      hul1Color = selectedColor.clone();
      console.log(`Hul1 farve gemt: rgb(${Math.round(hul1Color.r*255)}, ${Math.round(hul1Color.g*255)}, ${Math.round(hul1Color.b*255)})`);
    }
    
    console.log(`${hole.name}: farve ${colorIndex + 1}, naboer bruger: [${Array.from(neighborColorIndices).map(i => i + 1).join(', ')}]`);
  });
  
  // Anvend hul1's farve på special objekterne (C, C2, E, F, M, O1, O2, O3, R, Z)
  if (hul1Color && specialObjects.length > 0) {
    specialObjects.forEach((obj) => {
      if (obj.material) {
        obj.material.color.copy(hul1Color);
        obj.material.needsUpdate = true;
        console.log(`Special objekt ${obj.name} fik hul1 farve: rgb(${Math.round(hul1Color.r*255)}, ${Math.round(hul1Color.g*255)}, ${Math.round(hul1Color.b*255)})`);
      }
    });
  }
  
  updateStatus(`Farver anvendt på ${holeObjects.length} huller! Ingen naboer har samme farve.`);
}

function updateStatus(message) {
  const status = document.getElementById('status');
  if (status) {
    status.textContent = message;
  }
  console.log(message);
}

// === ANIMATION LOOP ===
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// === WINDOW RESIZE ===
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// === START ===
createUI();
animate();
updateStatus('Upload et billede for at komme i gang');
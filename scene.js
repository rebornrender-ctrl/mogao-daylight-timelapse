import * as THREE from "./vendor/three.module.js";
import { GLTFLoader } from "./vendor/GLTFLoader.js";
import { mergeVertices } from "./vendor/BufferGeometryUtils.js";
import { createDocumentedCave } from "./documented-cave.js";

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const FRAME_WIDTH = 1920;
const FRAME_HEIGHT = 1080;
const SCENE_DURATION = 120;
const DUNHUANG = Object.freeze({ latitude: 40.142, longitude: 94.661, utcOffset: 8 });

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (edge0, edge1, value) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};
const fract = (value) => value - Math.floor(value);
const hash2 = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
const hash3 = (x, y, z) => fract(Math.sin(x * 91.3458 + y * 157.733 + z * 113.951) * 43758.5453123);

function valueNoise3(x, y, z) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  const n000 = hash3(ix, iy, iz);
  const n100 = hash3(ix + 1, iy, iz);
  const n010 = hash3(ix, iy + 1, iz);
  const n110 = hash3(ix + 1, iy + 1, iz);
  const n001 = hash3(ix, iy, iz + 1);
  const n101 = hash3(ix + 1, iy, iz + 1);
  const n011 = hash3(ix, iy + 1, iz + 1);
  const n111 = hash3(ix + 1, iy + 1, iz + 1);
  const nx00 = lerp(n000, n100, ux);
  const nx10 = lerp(n010, n110, ux);
  const nx01 = lerp(n001, n101, ux);
  const nx11 = lerp(n011, n111, ux);
  const nxy0 = lerp(nx00, nx10, uy);
  const nxy1 = lerp(nx01, nx11, uy);
  return lerp(nxy0, nxy1, uz) * 2 - 1;
}

function fbm3(x, y, z, octaves = 4) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let octave = 0; octave < octaves; octave += 1) {
    value += valueNoise3(x * frequency, y * frequency, z * frequency) * amplitude;
    frequency *= 2.03;
    amplitude *= 0.5;
  }
  return value;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function interpolateKeyframes(time, keys, property) {
  if (time <= keys[0].t) {
    return typeof keys[0][property] === "number" ? keys[0][property] : keys[0][property].clone();
  }
  if (time >= keys[keys.length - 1].t) {
    const value = keys[keys.length - 1][property];
    return typeof value === "number" ? value : value.clone();
  }
  for (let index = 0; index < keys.length - 1; index += 1) {
    const a = keys[index];
    const b = keys[index + 1];
    if (time >= a.t && time <= b.t) {
      const raw = (time - a.t) / (b.t - a.t);
      const t = raw * raw * (3 - 2 * raw);
      if (typeof a[property] === "number") return lerp(a[property], b[property], t);
      return a[property].clone().lerp(b[property], t);
    }
  }
  const fallback = keys[0][property];
  return typeof fallback === "number" ? fallback : fallback.clone();
}

function mapTimeToLocalHours(time) {
  const anchors = [
    { t: 0, hours: 7.5 },
    { t: 15, hours: 8.7 },
    { t: 60, hours: 13.5 },
    { t: 100, hours: 17.4 },
    { t: 120, hours: 18.5 },
  ];
  return interpolateKeyframes(clamp(time, 0, SCENE_DURATION), anchors, "hours");
}

function localDateToUtc(dateString, localHours) {
  const [year, month, day] = dateString.split("-").map(Number);
  const wholeHour = Math.floor(localHours);
  const minute = (localHours - wholeHour) * 60;
  return new Date(Date.UTC(year, month - 1, day, wholeHour - DUNHUANG.utcOffset, minute));
}

function sunDirectionFromPosition(position) {
  const altitude = position.altitude;
  const azimuth = position.azimuth;
  const horizontal = Math.cos(altitude);
  return new THREE.Vector3(
    -Math.sin(azimuth) * horizontal,
    Math.sin(altitude),
    Math.cos(azimuth) * horizontal,
  ).normalize();
}

function astroState(dateString, localHours) {
  const date = localDateToUtc(dateString, localHours);
  const sun = SunCalc.getPosition(date, DUNHUANG.latitude, DUNHUANG.longitude);
  return {
    date,
    sun,
    sunDirection: sunDirectionFromPosition(sun),
  };
}

function makeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function createRockTextures() {
  const width = 1024;
  const height = 512;
  const colorCanvas = makeCanvas(width, height);
  const colorContext = colorCanvas.getContext("2d");
  const image = colorContext.createImageData(width, height);
  const bumpCanvas = makeCanvas(width, height);
  const bumpContext = bumpCanvas.getContext("2d");
  const bumpImage = bumpContext.createImageData(width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const nx = x / width;
      const ny = y / height;
      const broad = fbm3(nx * 5.6, ny * 3.4, 0.7, 5);
      const medium = fbm3(nx * 18.0 + 3.1, ny * 10.0 - 2.4, 1.9, 3);
      const strata = Math.sin((ny * 25.0 + broad * 2.8 + Math.sin(nx * 11.0) * 0.45) * Math.PI) * 0.5;
      const vein = Math.pow(Math.max(0, 1 - Math.abs(medium) * 5.2), 2) * 0.7;
      const grain = (hash2(x, y) - 0.5) * 0.7;
      const mineral = clamp(0.5 + broad * 0.34 + medium * 0.16, 0, 1);
      image.data[index] = clamp(122 + broad * 24 + strata * 7 + grain * 7, 0, 255);
      image.data[index + 1] = clamp(94 + broad * 19 + strata * 5 + grain * 6, 0, 255);
      image.data[index + 2] = clamp(67 + broad * 14 + strata * 3 + grain * 5, 0, 255);
      image.data[index + 3] = 255;

      const bump = clamp(128 + broad * 48 + medium * 24 + strata * 12 + grain * 22 - vein * 15, 0, 255);
      bumpImage.data[index] = bump;
      bumpImage.data[index + 1] = bump;
      bumpImage.data[index + 2] = bump;
      bumpImage.data[index + 3] = 255;
      if (mineral > 0.78) {
        image.data[index] = clamp(image.data[index] * 0.93, 0, 255);
        image.data[index + 2] = clamp(image.data[index + 2] * 1.08, 0, 255);
      }
    }
  }

  colorContext.putImageData(image, 0, 0);
  bumpContext.putImageData(bumpImage, 0, 0);

  const random = mulberry32(20260924);
  colorContext.globalCompositeOperation = "multiply";
  for (let index = 0; index < 38; index += 1) {
    const startX = random() * width;
    const startY = random() * height;
    colorContext.strokeStyle = `rgba(48, 30, 20, ${0.06 + random() * 0.12})`;
    colorContext.lineWidth = 0.6 + random() * 1.4;
    colorContext.beginPath();
    colorContext.moveTo(startX, startY);
    let x = startX;
    let y = startY;
    const segments = 5 + Math.floor(random() * 10);
    for (let segment = 0; segment < segments; segment += 1) {
      x += (random() - 0.48) * 72;
      y += (random() - 0.5) * 28;
      colorContext.lineTo(x, y);
    }
    colorContext.stroke();
  }
  colorContext.globalCompositeOperation = "source-over";

  const color = new THREE.CanvasTexture(colorCanvas);
  color.colorSpace = THREE.SRGBColorSpace;
  color.wrapS = color.wrapT = THREE.RepeatWrapping;
  color.repeat.set(1.65, 1.2);
  color.anisotropy = 8;

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.copy(color.repeat);
  bump.anisotropy = 8;

  return { color, bump };
}

function createMuralTexture() {
  const canvas = makeCanvas(2048, 1024);
  const context = canvas.getContext("2d");
  const random = mulberry32(96285);
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#8e7655");
  gradient.addColorStop(0.34, "#b09268");
  gradient.addColorStop(0.68, "#94754f");
  gradient.addColorStop(1, "#5f4b37");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const mineralColors = ["#3f5d55", "#3e5874", "#744b3b", "#6b5b78", "#8b6b3f"];
  for (let index = 0; index < 18; index += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const radius = 80 + random() * 260;
    const radial = context.createRadialGradient(x, y, 0, x, y, radius);
    const color = mineralColors[index % mineralColors.length];
    radial.addColorStop(0, `${color}38`);
    radial.addColorStop(0.55, `${color}20`);
    radial.addColorStop(1, `${color}00`);
    context.fillStyle = radial;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  const bands = [
    { y: 120, height: 66, color: "rgba(55, 91, 75, 0.22)" },
    { y: 368, height: 94, color: "rgba(52, 76, 111, 0.18)" },
    { y: 682, height: 72, color: "rgba(125, 67, 45, 0.18)" },
    { y: 880, height: 38, color: "rgba(66, 84, 61, 0.16)" },
  ];
  for (const band of bands) {
    context.beginPath();
    context.moveTo(0, band.y);
    for (let x = 0; x <= canvas.width; x += 64) {
      context.lineTo(x, band.y + Math.sin(x * 0.013 + band.y) * 7 + (random() - 0.5) * 4);
    }
    for (let x = canvas.width; x >= 0; x -= 64) {
      context.lineTo(x, band.y + band.height + Math.sin(x * 0.009 + band.y) * 8 + (random() - 0.5) * 5);
    }
    context.closePath();
    context.fillStyle = band.color;
    context.fill();
    context.strokeStyle = "rgba(226, 190, 126, 0.16)";
    context.lineWidth = 3;
    context.stroke();
  }

  context.globalAlpha = 0.18;
  for (let index = 0; index < 90; index += 1) {
    const x = random() * canvas.width;
    const y = 80 + random() * (canvas.height - 160);
    const length = 12 + random() * 58;
    context.strokeStyle = mineralColors[index % mineralColors.length];
    context.lineWidth = 2 + random() * 7;
    context.beginPath();
    context.moveTo(x, y);
    context.quadraticCurveTo(x + length * 0.45, y - 7 + random() * 14, x + length, y + (random() - 0.5) * 12);
    context.stroke();
  }
  context.globalAlpha = 1;

  context.strokeStyle = "rgba(39, 27, 20, 0.38)";
  context.lineWidth = 2;
  for (let index = 0; index < 42; index += 1) {
    let x = random() * canvas.width;
    let y = random() * canvas.height;
    context.beginPath();
    context.moveTo(x, y);
    for (let segment = 0; segment < 5 + Math.floor(random() * 8); segment += 1) {
      x += (random() - 0.5) * 90;
      y += (random() - 0.5) * 52;
      context.lineTo(x, y);
    }
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.15, 0.92);
  texture.anisotropy = 8;
  return texture;
}

function createGlowTexture(inner, outer) {
  const canvas = makeCanvas(256, 256);
  const context = canvas.getContext("2d");
  const radial = context.createRadialGradient(128, 128, 0, 128, 128, 126);
  radial.addColorStop(0, inner);
  radial.addColorStop(0.24, outer);
  radial.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = radial;
  context.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function perturbGeometry(geometry, amplitude = 0.05, profile = "wall") {
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  const size = bounds.getSize(new THREE.Vector3());
  const position = geometry.attributes.position;
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const edgeDistance = Math.min(
      (x - bounds.min.x) / Math.max(size.x, 0.0001),
      (bounds.max.x - x) / Math.max(size.x, 0.0001),
      (y - bounds.min.y) / Math.max(size.y, 0.0001),
      (bounds.max.y - y) / Math.max(size.y, 0.0001),
    );
    const edgeMask = smoothstep(0.0, 0.16, edgeDistance);
    const broad = fbm3(x * 0.34, y * 0.34, z * 0.34, 4);
    const medium = fbm3(x * 1.12 + 11.7, y * 1.12 - 4.3, z * 1.12 + 7.9, 3);
    const strata = Math.sin((y + broad * 0.22) * (profile === "floor" ? 2.6 : 4.2)) * 0.24;
    const grain = (hash3(x * 2.7, y * 2.7, z * 2.7) - 0.5) * 0.16;
    const edgeWear = profile === "floor" ? Math.abs(x) * 0.012 : Math.abs(y - 3.5) * 0.008;
    const displacement = broad * 0.62 + medium * 0.24 + strata + grain - edgeWear;
    position.setZ(index, z + displacement * amplitude * edgeMask);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

const canvas = document.getElementById("three-canvas");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(1);
renderer.setSize(FRAME_WIDTH, FRAME_HEIGHT, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.24;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x15100b);
scene.fog = new THREE.FogExp2(0x1a1510, 0.014);

const camera = new THREE.PerspectiveCamera(37, FRAME_WIDTH / FRAME_HEIGHT, 0.08, 120);
camera.position.set(1.25, 1.55, 0.35);

const rockTextures = createRockTextures();
const muralTexture = createMuralTexture();

const rockMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  map: rockTextures.color,
  bumpMap: rockTextures.bump,
  bumpScale: 0.12,
  roughness: 0.94,
  metalness: 0,
  side: THREE.DoubleSide,
});
rockMaterial.shadowSide = THREE.DoubleSide;

const darkRockMaterial = new THREE.MeshStandardMaterial({
  color: 0x604a35,
  map: rockTextures.color,
  bumpMap: rockTextures.bump,
  bumpScale: 0.12,
  roughness: 0.98,
  metalness: 0,
});
darkRockMaterial.shadowSide = THREE.DoubleSide;

const nicheMaterial = new THREE.MeshStandardMaterial({
  color: 0xb18a62,
  map: rockTextures.color,
  bumpMap: rockTextures.bump,
  bumpScale: 0.08,
  roughness: 0.98,
  metalness: 0,
  side: THREE.DoubleSide,
});
nicheMaterial.shadowSide = THREE.DoubleSide;

const columnMaterial = new THREE.MeshStandardMaterial({
  color: 0xa47c58,
  map: rockTextures.color,
  bumpMap: rockTextures.bump,
  bumpScale: 0.07,
  roughness: 0.96,
  metalness: 0,
});
columnMaterial.shadowSide = THREE.DoubleSide;

const muralMaterial = new THREE.MeshStandardMaterial({
  map: muralTexture,
  color: 0xd2b78a,
  roughness: 0.98,
  metalness: 0,
  bumpMap: rockTextures.bump,
  bumpScale: 0.045,
  side: THREE.DoubleSide,
});
muralMaterial.shadowSide = THREE.DoubleSide;

const floorMaterial = new THREE.MeshStandardMaterial({
  color: 0xc09a70,
  map: rockTextures.color,
  bumpMap: rockTextures.bump,
  bumpScale: 0.16,
  roughness: 0.98,
  metalness: 0,
  side: THREE.DoubleSide,
});
floorMaterial.shadowSide = THREE.DoubleSide;

const stoneShadowMaterial = new THREE.MeshStandardMaterial({
  color: 0x67533e,
  roughness: 0.9,
  metalness: 0,
});
stoneShadowMaterial.shadowSide = THREE.DoubleSide;

function addPanel(width, height, position, rotation, material = rockMaterial, subdivisions = 1, profile = "wall", amplitude = 0.14) {
  const segmentsX = Math.max(8, Math.round(width * 3.2 * subdivisions));
  const segmentsY = Math.max(8, Math.round(height * 3.2 * subdivisions));
  const geometry = new THREE.PlaneGeometry(width, height, segmentsX, segmentsY);
  if (profile === "ceiling") {
    const positionAttribute = geometry.attributes.position;
    for (let index = 0; index < positionAttribute.count; index += 1) {
      const worldX = position.x + positionAttribute.getX(index);
      const vault = 0.34 * (1 - Math.pow(worldX / 5.8, 2));
      positionAttribute.setZ(index, vault);
    }
    positionAttribute.needsUpdate = true;
  }
  perturbGeometry(geometry, amplitude, profile);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.rotation.set(rotation.x, rotation.y, rotation.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function createRimLoop(center, u, v, normal, halfU, halfV, material, radius = 0.1) {
  const points = [];
  const pointCount = 32;
  for (let index = 0; index < pointCount; index += 1) {
    const angle = (index / pointCount) * TAU;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const roundedU = Math.sign(cosine) * Math.pow(Math.abs(cosine), 0.36) * halfU;
    const roundedV = Math.sign(sine) * Math.pow(Math.abs(sine), 0.36) * halfV;
    points.push(
      center
        .clone()
        .addScaledVector(u, roundedU)
        .addScaledVector(v, roundedV)
        .addScaledVector(normal, 0.035),
    );
  }
  const curve = new THREE.CatmullRomCurve3(points, true, "centripetal");
  const rim = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, radius, 8, true), material);
  rim.castShadow = true;
  rim.receiveShadow = true;
  scene.add(rim);
  return rim;
}

const apertures = [
  {
    id: "west",
    label: "西壁孔",
    center: new THREE.Vector3(-5.78, 5.6, -1.5),
    normal: new THREE.Vector3(-1, 0, 0),
    u: new THREE.Vector3(0, 0, 1),
    v: new THREE.Vector3(0, 1, 0),
    half: new THREE.Vector2(0.95, 0.72),
  },
  {
    id: "east",
    label: "东壁孔",
    center: new THREE.Vector3(5.78, 5.4, -1.5),
    normal: new THREE.Vector3(1, 0, 0),
    u: new THREE.Vector3(0, 0, -1),
    v: new THREE.Vector3(0, 1, 0),
    half: new THREE.Vector2(1.18, 0.76),
  },
  {
    id: "roof-west",
    label: "窟顶西孔",
    center: new THREE.Vector3(-1.9, 7.22, 0.55),
    normal: new THREE.Vector3(0, 1, 0),
    u: new THREE.Vector3(1, 0, 0),
    v: new THREE.Vector3(0, 0, 1),
    half: new THREE.Vector2(0.4, 0.34),
  },
  {
    id: "roof-center",
    label: "窟顶中孔",
    center: new THREE.Vector3(0.9, 7.22, 0.55),
    normal: new THREE.Vector3(0, 1, 0),
    u: new THREE.Vector3(1, 0, 0),
    v: new THREE.Vector3(0, 0, 1),
    half: new THREE.Vector2(0.44, 0.36),
  },
  {
    id: "roof-east",
    label: "窟顶东孔",
    center: new THREE.Vector3(3.3, 7.22, 0.55),
    normal: new THREE.Vector3(0, 1, 0),
    u: new THREE.Vector3(1, 0, 0),
    v: new THREE.Vector3(0, 0, 1),
    half: new THREE.Vector2(0.4, 0.34),
  },
];

function createSideWall(x, zMin, zMax, yMin, yMax, hole, inwardRotation) {
  const zWidth = zMax - zMin;
  const belowHeight = hole.centerY - hole.halfY - yMin;
  const aboveHeight = yMax - (hole.centerY + hole.halfY);
  const leftWidth = hole.centerZ - hole.halfZ - zMin;
  const rightWidth = zMax - (hole.centerZ + hole.halfZ);
  const rotation = { x: 0, y: inwardRotation, z: 0 };
  const amplitude = 0.075;

  addPanel(zWidth, belowHeight, new THREE.Vector3(x, yMin + belowHeight / 2, (zMin + zMax) / 2), rotation, rockMaterial, 1, "wall", amplitude);
  addPanel(zWidth, aboveHeight, new THREE.Vector3(x, yMax - aboveHeight / 2, (zMin + zMax) / 2), rotation, rockMaterial, 1, "wall", amplitude);
  addPanel(leftWidth, hole.halfY * 2, new THREE.Vector3(x, hole.centerY, zMin + leftWidth / 2), rotation, rockMaterial, 1, "wall", amplitude);
  addPanel(rightWidth, hole.halfY * 2, new THREE.Vector3(x, hole.centerY, zMax - rightWidth / 2), rotation, rockMaterial, 1, "wall", amplitude);

  createRimLoop(
    new THREE.Vector3(x, hole.centerY, hole.centerZ),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(x < 0 ? 1 : -1, 0, 0),
    hole.halfZ,
    hole.halfY,
    darkRockMaterial,
    0.12,
  );
  createRimLoop(
    new THREE.Vector3(x, hole.centerY, hole.centerZ),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(x < 0 ? 1 : -1, 0, 0),
    hole.halfZ - 0.06,
    hole.halfY - 0.06,
    rockMaterial,
    0.035,
  );
}

createSideWall(
  -5.8,
  -5,
  10.8,
  0,
  7.35,
  { centerZ: -1.5, centerY: 5.6, halfZ: 0.95, halfY: 0.72 },
  -Math.PI / 2,
);
createSideWall(
  5.8,
  -5,
  10.8,
  0,
  7.35,
  { centerZ: -1.5, centerY: 5.4, halfZ: 1.18, halfY: 0.76 },
  Math.PI / 2,
);

const ceilingY = 7.35;
const roofApertures = apertures.slice(2);
const ceilingBounds = { xMin: -5.8, xMax: 5.8, zMin: -5, zMax: 10.8 };
{
  const holeBack = roofApertures[0].center.z - roofApertures[0].half.y;
  const holeFront = roofApertures[0].center.z + roofApertures[0].half.y;
  const rotation = { x: -Math.PI / 2, y: 0, z: 0 };
  const ceilingAmplitude = 0.075;
  addPanel(
    ceilingBounds.xMax - ceilingBounds.xMin,
    holeBack - ceilingBounds.zMin,
    new THREE.Vector3(0, ceilingY, (ceilingBounds.zMin + holeBack) / 2),
    rotation,
    rockMaterial,
    1.25,
    "ceiling",
    ceilingAmplitude,
  );
  addPanel(
    ceilingBounds.xMax - ceilingBounds.xMin,
    ceilingBounds.zMax - holeFront,
    new THREE.Vector3(0, ceilingY, (holeFront + ceilingBounds.zMax) / 2),
    rotation,
    rockMaterial,
    1.25,
    "ceiling",
    ceilingAmplitude,
  );

  let cursorX = ceilingBounds.xMin;
  for (const aperture of roofApertures) {
    const holeLeft = aperture.center.x - aperture.half.x;
    const holeRight = aperture.center.x + aperture.half.x;
    addPanel(
      holeLeft - cursorX,
      holeFront - holeBack,
      new THREE.Vector3((cursorX + holeLeft) / 2, ceilingY, aperture.center.z),
      rotation,
      rockMaterial,
      1.25,
      "ceiling",
      ceilingAmplitude,
    );
    cursorX = holeRight;
  }
  addPanel(
    ceilingBounds.xMax - cursorX,
    holeFront - holeBack,
    new THREE.Vector3((cursorX + ceilingBounds.xMax) / 2, ceilingY, roofApertures[0].center.z),
    rotation,
    rockMaterial,
    1.25,
    "ceiling",
    ceilingAmplitude,
  );

  for (const aperture of roofApertures) {
    createRimLoop(
      new THREE.Vector3(aperture.center.x, ceilingY, aperture.center.z),
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 1, 0),
      aperture.half.x,
      aperture.half.y,
      darkRockMaterial,
      0.1,
    );
    createRimLoop(
      new THREE.Vector3(aperture.center.x, ceilingY, aperture.center.z),
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 1, 0),
      aperture.half.x - 0.05,
      aperture.half.y - 0.05,
      rockMaterial,
      0.03,
    );
  }
}

const backWallGeometry = perturbGeometry(
  new THREE.PlaneGeometry(11.6, 7.25, 92, 56),
  0.11,
  "wall",
);
const backWall = new THREE.Mesh(backWallGeometry, rockMaterial);
backWall.position.set(0, 3.62, -5.02);
backWall.receiveShadow = true;
backWall.castShadow = true;
scene.add(backWall);

const backMuralGeometry = perturbGeometry(
  new THREE.PlaneGeometry(10.8, 6.45, 76, 48),
  0.08,
  "wall",
);
const backMural = new THREE.Mesh(backMuralGeometry, muralMaterial);
backMural.position.set(0, 3.42, -4.82);
backMural.receiveShadow = true;
scene.add(backMural);

for (const x of [-5.68, 5.68]) {
  const sideMural = new THREE.Mesh(
    perturbGeometry(new THREE.PlaneGeometry(5.2, 3.2, 42, 28), 0.08, "wall"),
    muralMaterial,
  );
  sideMural.position.set(x, 3.4, 5.25);
  sideMural.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
  sideMural.receiveShadow = true;
  scene.add(sideMural);
}

const floorGeometry = perturbGeometry(
  new THREE.PlaneGeometry(11.6, 15.8, 72, 92),
  0.08,
  "floor",
);
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, -0.02, 2.7);
floor.receiveShadow = true;
scene.add(floor);

function createArchBand(centerX, baseY, radiusX, radiusY, z, material, radius) {
  const points = [];
  const segments = 42;
  for (let index = 0; index <= segments; index += 1) {
    const progress = index / segments;
    const angle = Math.PI - progress * Math.PI;
    const irregularity = (fbm3(progress * 4.2, centerX, z, 3) * 0.5 + 0.5) * 0.12;
    points.push(
      new THREE.Vector3(
        centerX + Math.cos(angle) * (radiusX + irregularity),
        baseY + Math.sin(angle) * (radiusY + irregularity),
        z + Math.sin(progress * Math.PI) * 0.045,
      ),
    );
  }
  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
  const archBand = new THREE.Mesh(new THREE.TubeGeometry(curve, 72, radius, 10, false), material);
  archBand.castShadow = true;
  archBand.receiveShadow = true;
  scene.add(archBand);
  return archBand;
}

const nicheBack = new THREE.Mesh(
  perturbGeometry(new THREE.PlaneGeometry(4.7, 5.65, 42, 52), 0.055, "wall"),
  nicheMaterial,
);
nicheBack.position.set(0.38, 3.02, -4.69);
nicheBack.receiveShadow = true;
scene.add(nicheBack);

for (const side of [-1, 1]) {
  const nicheSide = new THREE.Mesh(
    perturbGeometry(new THREE.PlaneGeometry(2.5, 5.65, 34, 52), 0.055, "wall"),
    nicheMaterial,
  );
  nicheSide.position.set(0.38 + side * 2.34, 3.02, -3.48);
  nicheSide.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
  nicheSide.receiveShadow = true;
  nicheSide.castShadow = true;
  scene.add(nicheSide);
}

createArchBand(0.38, 3.02, 2.34, 2.62, -4.48, darkRockMaterial, 0.17);
createArchBand(0.38, 3.02, 2.12, 2.38, -4.39, nicheMaterial, 0.075);

function createColumn(x) {
  const profile = [
    new THREE.Vector2(0.66, 0),
    new THREE.Vector2(0.76, 0.13),
    new THREE.Vector2(0.58, 0.34),
    new THREE.Vector2(0.43, 0.62),
    new THREE.Vector2(0.39, 2.55),
    new THREE.Vector2(0.48, 2.86),
    new THREE.Vector2(0.66, 3.12),
    new THREE.Vector2(0.72, 3.3),
  ];
  const geometry = new THREE.LatheGeometry(profile, 28);
  const position = geometry.attributes.position;
  for (let index = 0; index < position.count; index += 1) {
    const px = position.getX(index);
    const py = position.getY(index);
    const pz = position.getZ(index);
    const angle = Math.atan2(pz, px);
    const flute = Math.sin(angle * 7 + py * 1.6) * 0.018;
    const wear = fbm3(px * 2.1, py * 1.7, pz * 2.1, 3) * 0.045;
    const radius = Math.hypot(px, pz) || 1;
    position.setXYZ(index, px + (px / radius) * (flute + wear), py, pz + (pz / radius) * (flute + wear));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  const column = new THREE.Mesh(geometry, columnMaterial);
  column.position.set(x, 0, -4.2);
  column.castShadow = true;
  column.receiveShadow = true;
  scene.add(column);
  return column;
}
createColumn(-2.75);
createColumn(3.35);

// The first environment pass was a visual sketch built from generic panels and
// floating rock primitives. Keep it only as a non-rendered fallback; the
// visible cave is rebuilt below from documented Mogao-type spatial evidence.
scene.traverse((object) => {
  if (object.isMesh) object.visible = false;
});

const documentedCave = createDocumentedCave({
  scene,
  noise: fbm3,
  materials: {
    rockTextures,
    rockMaterial,
    darkRockMaterial,
    nicheMaterial,
    columnMaterial,
    floorMaterial,
  },
});
const caveApertures = documentedCave.apertures;
const caveReferenceTexturePromise = new THREE.TextureLoader()
  .loadAsync("./assets/textures/mogao-cave217-public-domain-reference.png")
  .catch((error) => {
    console.warn("Cave 217 public-domain reference unavailable; using procedural shrine fallback", error);
    return null;
  });

const statue = new THREE.Group();
statue.name = "Mogao Cave 328 attendant Bodhisattva";
statue.position.set(0.75, 0.03, -3.98);
scene.add(statue);

const statueContent = new THREE.Group();
statueContent.name = "Cave 328 photogrammetric sculpture";
statue.add(statueContent);

// Harvard object 1924.70 records an overall height of 121.9 cm including the
// lotus base. The close camera preserves the approved face-led composition
// without pretending that a one-metre attendant is a five-metre cavern statue.
const STATUE_TARGET_HEIGHT = 1.219;
const statueModelUrl = "./assets/models/mogao-c328-source/Kneeling_Attendant_Bodhisattva-129635ad/Kneeling_Attendant_Bodhisattva.gltf";
const statueTextureUrl =
  "./assets/models/mogao-c328-source/Kneeling_Attendant_Bodhisattva-129635ad/textures/e49f61fa2b37416993a37ad6c253fc14_1924_70_Bodhisattva-1mil.jpg";

function createNormalMapFromTexture(sourceTexture) {
  const image = sourceTexture?.image;
  const sourceWidth = image?.naturalWidth || image?.width;
  const sourceHeight = image?.naturalHeight || image?.height;
  if (!image || !sourceWidth || !sourceHeight) return null;
  const size = Math.min(1024, sourceWidth, sourceHeight);
  const canvas = makeCanvas(size, size);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, size, size);
  const source = context.getImageData(0, 0, size, size);
  const normal = context.createImageData(size, size);
  const sample = (x, y) => {
    const px = (y * size + x) * 4;
    return (source.data[px] * 0.299 + source.data[px + 1] * 0.587 + source.data[px + 2] * 0.114) / 255;
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const left = sample(Math.max(0, x - 1), y);
      const right = sample(Math.min(size - 1, x + 1), y);
      const up = sample(x, Math.max(0, y - 1));
      const down = sample(x, Math.min(size - 1, y + 1));
      const nx = (left - right) * 2.4;
      const ny = (up - down) * 2.4;
      const length = Math.hypot(nx, ny, 1);
      const index = (y * size + x) * 4;
      normal.data[index] = Math.round(((nx / length) * 0.5 + 0.5) * 255);
      normal.data[index + 1] = Math.round(((ny / length) * 0.5 + 0.5) * 255);
      normal.data[index + 2] = Math.round(((1 / length) * 0.5 + 0.5) * 255);
      normal.data[index + 3] = 255;
    }
  }
  context.putImageData(normal, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

async function loadCave328Statue() {
  const loader = new GLTFLoader();
  const textureLoader = new THREE.TextureLoader();
  const [gltf, colorTexture, caveReferenceTexture] = await Promise.all([
    loader.loadAsync(statueModelUrl),
    textureLoader.loadAsync(statueTextureUrl),
    caveReferenceTexturePromise,
  ]);

  colorTexture.colorSpace = THREE.SRGBColorSpace;
  colorTexture.flipY = false;
  colorTexture.wrapS = THREE.RepeatWrapping;
  colorTexture.wrapT = THREE.RepeatWrapping;
  colorTexture.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  colorTexture.minFilter = THREE.LinearMipmapLinearFilter;
  colorTexture.magFilter = THREE.LinearFilter;
  colorTexture.generateMipmaps = true;

  const bumpTexture = colorTexture.clone();
  bumpTexture.colorSpace = THREE.NoColorSpace;
  bumpTexture.needsUpdate = true;
  if (caveReferenceTexture) {
    caveReferenceTexture.colorSpace = THREE.SRGBColorSpace;
    caveReferenceTexture.flipY = true;
    caveReferenceTexture.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
    caveReferenceTexture.needsUpdate = true;
    documentedCave.shrineMaterial.map = caveReferenceTexture;
    documentedCave.shrineMaterial.color.set(0xb9a184);
    documentedCave.shrineMaterial.needsUpdate = true;
    documentedCave.wallMaterial.map = caveReferenceTexture;
    documentedCave.wallMaterial.color.set(0xb9a081);
    const wallBumpTexture = caveReferenceTexture.clone();
    wallBumpTexture.colorSpace = THREE.NoColorSpace;
    wallBumpTexture.flipY = true;
    wallBumpTexture.needsUpdate = true;
    documentedCave.wallMaterial.bumpMap = wallBumpTexture;
    documentedCave.wallMaterial.bumpScale = 0.11;
    const wallNormalTexture = createNormalMapFromTexture(caveReferenceTexture);
    if (wallNormalTexture) {
      documentedCave.wallMaterial.normalMap = wallNormalTexture;
      documentedCave.wallMaterial.normalScale = new THREE.Vector2(0.55, 0.55);
    }
    documentedCave.wallMaterial.needsUpdate = true;
  }
  const sculptureMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    bumpMap: bumpTexture,
    bumpScale: 0.002,
    roughness: 0.94,
    metalness: 0,
    side: THREE.FrontSide,
  });
  sculptureMaterial.shadowSide = THREE.DoubleSide;

  const model = gltf.scene;
  model.traverse((object) => {
    if (!object.isMesh) return;
    object.material = sculptureMaterial;
    object.castShadow = true;
    object.receiveShadow = true;
  });

  model.updateMatrixWorld(true);
  const rawBounds = new THREE.Box3().setFromObject(model);
  const rawSize = rawBounds.getSize(new THREE.Vector3());
  const fitScale = STATUE_TARGET_HEIGHT / rawSize.y;
  statueContent.rotation.y = Math.PI + 1.15;
  statueContent.scale.setScalar(fitScale);
  statueContent.add(model);

  const desiredStatuePosition = statue.position.clone();
  statue.position.set(0, 0, 0);
  statue.updateMatrixWorld(true);
  const orientedBounds = new THREE.Box3().setFromObject(statueContent);
  const orientedCenter = orientedBounds.getCenter(new THREE.Vector3());
  statueContent.position.set(-orientedCenter.x, -orientedBounds.min.y, -orientedCenter.z);
  statue.position.copy(desiredStatuePosition);

  statue.updateMatrixWorld(true);
  let fittedBounds = new THREE.Box3().setFromObject(statue);
  const rearWallLimit = -4.58;
  if (fittedBounds.min.z < rearWallLimit) {
    statue.position.z += rearWallLimit - fittedBounds.min.z;
    statue.updateMatrixWorld(true);
    fittedBounds = new THREE.Box3().setFromObject(statue);
  }

  const fittedSize = fittedBounds.getSize(new THREE.Vector3());
  const faceLocal = new THREE.Vector3(0.04, fittedSize.y * 0.865, fittedSize.z * 0.5 - 0.18);
  facePortalPoint.copy(statue.localToWorld(faceLocal));

  const cameraTarget = facePortalPoint.clone().add(new THREE.Vector3(-0.02, -0.02, 0));
  const targetOffsets = [
    new THREE.Vector3(0.04, 0.02, 0),
    new THREE.Vector3(0.03, 0.01, 0),
    new THREE.Vector3(0.02, -0.01, 0),
    new THREE.Vector3(0.03, 0.01, 0),
    new THREE.Vector3(0.04, 0.02, 0),
  ];
  const viewOffsets = [
    new THREE.Vector3(-0.62, -0.78, 1.28),
    new THREE.Vector3(-0.5, -0.7, 1.1),
    new THREE.Vector3(-0.34, -0.58, 0.94),
    new THREE.Vector3(-0.52, -0.72, 1.08),
    new THREE.Vector3(-0.62, -0.78, 1.28),
  ];
  cameraKeys.forEach((key, index) => {
    key.target.copy(cameraTarget).add(targetOffsets[index]);
    key.position.copy(facePortalPoint).add(viewOffsets[index]);
  });

  window.__hfCave328 = {
    ready: true,
    source: "Harvard Art Museums 1924.70 / Sketchfab 129635ad",
    bounds: { min: fittedBounds.min.toArray(), max: fittedBounds.max.toArray() },
    face: facePortalPoint.toArray(),
    texture: "8192x8192",
    physicalHeightMeters: 1.219,
    caveProfile: "research-led Mogao-type chamber; not a survey reconstruction",
    periodMuralReference: caveReferenceTexture ? "public-domain Cave 217 mural reference" : "procedural fallback",
  };

  renderAt(currentTime);
  interactionBadge.textContent = "CAVE 328 / TANG SCAN / CC BY · PD C217 REF";
}

const rockRandom = mulberry32(770421);
const rockGeometry = mergeVertices(new THREE.IcosahedronGeometry(0.72, 2), 1e-4);
{
  const position = rockGeometry.attributes.position;
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const erosion = fbm3(x * 2.4 + 5, y * 2.4 - 3, z * 2.4 + 8, 4);
    const radius = Math.hypot(x, y, z) || 1;
    const scale = 1 + erosion * 0.16;
    position.setXYZ(index, x * scale, y * scale, z * scale);
  }
  position.needsUpdate = true;
  rockGeometry.computeVertexNormals();
}

function addEmbeddedRock(position, scale, material = rockMaterial) {
  const rock = new THREE.Mesh(rockGeometry, material);
  rock.position.copy(position);
  rock.scale.set(scale.x, scale.y, scale.z);
  rock.rotation.set(rockRandom() * 0.24, rockRandom() * TAU, rockRandom() * 0.18);
  rock.castShadow = true;
  rock.receiveShadow = true;
  scene.add(rock);
  return rock;
}

for (let index = 0; index < 18; index += 1) {
  const side = index % 2 === 0 ? -1 : 1;
  const z = -3.8 + rockRandom() * 13.2;
  const y = 0.18 + rockRandom() * 0.42;
  addEmbeddedRock(
    new THREE.Vector3(side * (5.05 + rockRandom() * 0.36), y, z),
    new THREE.Vector3(0.55 + rockRandom() * 0.65, 0.3 + rockRandom() * 0.5, 0.7 + rockRandom() * 1.1),
    index % 4 === 0 ? darkRockMaterial : rockMaterial,
  );
}
const foregroundLeft = addEmbeddedRock(
  new THREE.Vector3(-4.75, 0.62, 8.65),
  new THREE.Vector3(1.45, 1.25, 1.8),
  darkRockMaterial,
);
foregroundLeft.rotation.set(0.12, -0.24, 0.08);
const foregroundRight = addEmbeddedRock(
  new THREE.Vector3(4.95, 0.48, 8.95),
  new THREE.Vector3(1.25, 0.98, 1.6),
  darkRockMaterial,
);
foregroundRight.rotation.set(0.08, 0.38, -0.12);

const skyMaterial = new THREE.MeshBasicMaterial({ color: 0x0a1019, side: THREE.BackSide, depthWrite: false, fog: false });
const sky = new THREE.Mesh(new THREE.SphereGeometry(58, 40, 22), skyMaterial);
sky.renderOrder = -100;
scene.add(sky);

const sunSprite = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: createGlowTexture("rgba(255,245,210,1)", "rgba(255,190,100,0.72)"),
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  }),
);
sunSprite.scale.set(4.8, 4.8, 1);
scene.add(sunSprite);

// A broad, feathered daylight wash replaces the hard aperture stripe. It is
// deliberately interpretive: a soft pool of warm light on the mural plane,
// moving with the solar vector rather than behaving like a decal.
const daylightWash = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({
    map: createGlowTexture("rgba(255,239,198,0.92)", "rgba(226,173,103,0.34)"),
    color: 0xffd79b,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    side: THREE.DoubleSide,
  }),
);
daylightWash.position.set(0.7, 2.65, -4.58);
daylightWash.scale.set(4.8, 3.25, 1);
daylightWash.renderOrder = 2;
scene.add(daylightWash);

// Daylight-only study: the cave is illuminated by the sun and its bounced
// sandstone fill. No lunar light or moon sprite is rendered.
const ambientLight = new THREE.AmbientLight(0x2f261d, 0.24);
scene.add(ambientLight);
const hemisphereLight = new THREE.HemisphereLight(0x7e91a5, 0x372517, 0.3);
scene.add(hemisphereLight);

const sunLight = new THREE.DirectionalLight(0xffe1a6, 0);
sunLight.castShadow = false;
scene.add(sunLight);
scene.add(sunLight.target);

// A second, shadowless daylight term represents diffuse skylight and bounced
// sandstone. It keeps the apertures soft instead of letting one hard band
// carry the whole lighting design.
const sunFillLight = new THREE.DirectionalLight(0xffddb0, 0);
scene.add(sunFillLight);
scene.add(sunFillLight.target);

// A whisper of aperture shadow remains for spatial depth, but it is kept far
// below the broad daylight wash so it never becomes the dominant diagonal bar.
const sunShadowLight = new THREE.DirectionalLight(0xffd39a, 0);
sunShadowLight.castShadow = true;
sunShadowLight.shadow.mapSize.set(2048, 2048);
sunShadowLight.shadow.camera.left = -5.8;
sunShadowLight.shadow.camera.right = 5.8;
sunShadowLight.shadow.camera.top = 5.8;
sunShadowLight.shadow.camera.bottom = -4.2;
sunShadowLight.shadow.camera.near = 0.5;
sunShadowLight.shadow.camera.far = 80;
sunShadowLight.shadow.bias = -0.00016;
sunShadowLight.shadow.normalBias = 0.04;
sunShadowLight.shadow.radius = 14;
if ("blurSamples" in sunShadowLight.shadow) sunShadowLight.shadow.blurSamples = 24;
scene.add(sunShadowLight);
scene.add(sunShadowLight.target);

// The main sun is intentionally shadowless; the low-intensity VSM layer below
// preserves just enough aperture depth without drawing a hard diagonal band.
const caveBounceLight = new THREE.PointLight(0xc38b5b, 0, 14, 1);
caveBounceLight.position.set(0.25, 2.25, -0.85);
scene.add(caveBounceLight);

const statueBounceLight = new THREE.PointLight(0xc59b6e, 0, 4.2, 1);
statueBounceLight.position.set(0.75, 1.35, -3.05);
scene.add(statueBounceLight);

const floorFillLight = new THREE.PointLight(0xc28b60, 0, 8, 1);
floorFillLight.position.set(0.0, 0.72, -1.55);
scene.add(floorFillLight);

const facePortalPoint = new THREE.Vector3(0.75, 1.18, -3.58);
// The hero shaft is an interpretive volume aimed through the face portal so
// the Tyndall effect remains legible in the close-up. The sun still chooses
// the active aperture, color, and intensity.
const tyndallTarget = new THREE.Vector3(-0.28, 1.34, -3.28);
const sunFaceLight = new THREE.SpotLight(0xffe0a0, 0, 16, 0.42, 0.96, 1.35);
sunFaceLight.castShadow = false;
scene.add(sunFaceLight);
scene.add(sunFaceLight.target);

function createBeam() {
  const group = new THREE.Group();
  const layerOpacities = [0.28, 0.18, 0.12];
  for (let layer = 0; layer < layerOpacities.length; layer += 1) {
    const geometry = new THREE.PlaneGeometry(1, 1, 24, 32);
    const position = geometry.attributes.position;
    const colors = new Float32Array(position.count * 3);
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index) + 0.5;
      const normalizedX = Math.abs(x) * 2;
      const edge = 1 - smoothstep(0.0, 0.78, normalizedX);
      const start = smoothstep(0.0, 0.16, y);
      const end = 1 - smoothstep(0.58, 1.0, y);
      const intensity = Math.pow(edge, 2.2) * start * end;
      position.setX(index, x * (0.58 + y * 0.42));
      colors[index * 3] = intensity;
      colors[index * 3 + 1] = intensity;
      colors[index * 3 + 2] = intensity;
    }
    position.needsUpdate = true;
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.MeshBasicMaterial({
      color: 0xffd79b,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.layer = layer;
    mesh.userData.baseOpacity = layerOpacities[layer];
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    group.add(mesh);
  }
  scene.add(group);
  return group;
}

const sunBeams = caveApertures.map(() => createBeam());

function createHeroTyndallVeil() {
  const width = 1.25;
  const height = 5.6;
  const geometry = new THREE.PlaneGeometry(width, height, 28, 42);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index) + height * 0.5;
    const normalizedX = Math.abs(x) / (width * 0.5);
    const normalizedY = y / height;
    const edge = 1 - smoothstep(0.12, 0.98, normalizedX);
    const start = smoothstep(0.0, 0.14, normalizedY);
    const end = 1 - smoothstep(0.58, 1.0, normalizedY);
    const intensity = Math.pow(edge, 2.1) * start * end;
    position.setX(index, x * (0.58 + normalizedY * 0.42));
    colors[index * 3] = intensity;
    colors[index * 3 + 1] = intensity;
    colors[index * 3 + 2] = intensity;
  }
  position.needsUpdate = true;
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.MeshBasicMaterial({
    color: 0xffd79b,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const veil = new THREE.Mesh(geometry, material);
  veil.frustumCulled = false;
  veil.renderOrder = 3;
  scene.add(veil);
  return veil;
}

const heroTyndallVeil = createHeroTyndallVeil();

function createHeroTyndallDust() {
  const count = 1800;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const brightness = new Float32Array(count);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const random = mulberry32(441907);
  for (let index = 0; index < count; index += 1) {
    const base = index * 3;
    const y = lerp(-2.55, 2.55, random());
    const halfWidth = 0.16 + (y + 2.55) / 5.1 * 0.54;
    positions[base] = lerp(-halfWidth, halfWidth, random());
    positions[base + 1] = y;
    positions[base + 2] = 0;
    sizes[index] = 0.14 + Math.pow(random(), 2.2) * 0.42;
    brightness[index] = 0.45 + random() * 0.8;
    phases[index] = random() * TAU;
    speeds[index] = 0.3 + random() * 0.72;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aBrightness", new THREE.BufferAttribute(brightness, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uSizeScale: { value: 22 },
      uColor: { value: new THREE.Color(0xffd7a0) },
    },
    vertexShader: visibleMoteVertexShader,
    fragmentShader: visibleMoteFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 7;
  scene.add(points);
  return points;
}

let heroTyndallDust;
const heroVeilForward = new THREE.Vector3();

const beamWidthAxis = new THREE.Vector3();
const beamHeightAxis = new THREE.Vector3();
const beamNormal = new THREE.Vector3();
const beamMidpoint = new THREE.Vector3();
const beamBasis = new THREE.Matrix4();

function updateBeam(group, aperture, sourceDirection, strength, color, time, displayScale = 1) {
  if (!aperture.active || displayScale <= 0) {
    group.visible = false;
    return;
  }
  const facing = Math.max(0, sourceDirection.dot(aperture.normal));
  const visibility = smoothstep(-0.015, 0.24, facing);
  const opacity = strength * visibility * displayScale;
  group.visible = opacity > 0.00025;
  if (!group.visible) return;

  const physicalTravel = sourceDirection.clone().multiplyScalar(-1).normalize();
  const artisticTravel = tyndallTarget.clone().sub(aperture.center).normalize();
  // Keep a trace of the astronomical direction, but bias the visible volume
  // toward the face so the close-up reads as a shaped Tyndall shaft.
  const travelDirection = physicalTravel.lerp(artisticTravel, 0.82).normalize();
  const length = Math.min(4.2, Math.max(3.0, aperture.center.distanceTo(tyndallTarget) * 0.98));
  const baseWidth = Math.max(0.82, aperture.half.x * 3.0);
  const layerAngles = [0, Math.PI / 3, (Math.PI * 2) / 3];
  const baseWidthAxis = aperture.u.clone().addScaledVector(
    travelDirection,
    -aperture.u.dot(travelDirection),
  ).normalize();
  const baseHeightAxis = aperture.v.clone().addScaledVector(
    travelDirection,
    -aperture.v.dot(travelDirection),
  ).normalize();
  beamMidpoint.copy(aperture.center).addScaledVector(travelDirection, length * 0.5);

  group.children.forEach((mesh, layer) => {
    const angle = layerAngles[layer];
    beamWidthAxis.copy(baseWidthAxis).multiplyScalar(Math.cos(angle)).addScaledVector(baseHeightAxis, Math.sin(angle)).normalize();
    beamHeightAxis.copy(travelDirection);
    beamNormal.crossVectors(beamWidthAxis, beamHeightAxis).normalize();
    if (beamNormal.lengthSq() < 0.001) beamNormal.set(0, 0, 1);
    beamBasis.makeBasis(beamWidthAxis, beamHeightAxis, beamNormal);
    mesh.position.copy(beamMidpoint);
    mesh.quaternion.setFromRotationMatrix(beamBasis);
    mesh.scale.set(baseWidth, length, 1);
    mesh.material.color.copy(color);
    mesh.material.opacity = Math.min(0.32, opacity * mesh.userData.baseOpacity * 1.8);
  });
}

const dustVertexShader = `
  attribute float aSize;
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aBrightness;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uDustGain;
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform float uSunStrength;
  uniform vec3 uApertureCenter[5];
  uniform vec3 uApertureNormal[5];
  uniform vec3 uApertureU[5];
  uniform vec3 uApertureV[5];
  uniform vec2 uApertureHalf[5];
  varying vec3 vColor;
  varying float vAlpha;
  varying float vScatter;

  float apertureVisibility(vec3 pointPosition, vec3 lightDirection) {
    float visibility = 0.0;
    for (int index = 0; index < 5; index++) {
      if (uApertureHalf[index].x < 0.001) continue;
      vec3 toCenter = uApertureCenter[index] - pointPosition;
      float denominator = dot(lightDirection, uApertureNormal[index]);
      if (denominator > 0.001) {
        float distanceToPlane = dot(toCenter, uApertureNormal[index]) / denominator;
        if (distanceToPlane > 0.0) {
          vec3 hit = pointPosition + lightDirection * distanceToPlane;
          vec3 local = hit - uApertureCenter[index];
          vec2 aperturePoint = vec2(dot(local, uApertureU[index]), dot(local, uApertureV[index]));
          vec2 normalizedPoint = abs(aperturePoint) / uApertureHalf[index];
          float inside = step(normalizedPoint.x, 1.0) * step(normalizedPoint.y, 1.0);
          float softEdge = 1.0 - smoothstep(0.62, 1.0, max(normalizedPoint.x, normalizedPoint.y));
          float distanceFade = exp(-distanceToPlane * 0.014);
          visibility = max(visibility, inside * softEdge * distanceFade);
        }
      }
    }
    return visibility;
  }

  void main() {
    vec3 animated = position;
    float t = uTime * aSpeed + aPhase;
    animated.x += sin(t * 0.73 + position.y * 0.31) * 0.12;
    animated.y += sin(t * 0.49 + position.x * 0.27) * 0.085;
    animated.z += cos(t * 0.61 + position.y * 0.21) * 0.11;
    vec4 modelViewPosition = modelViewMatrix * vec4(animated, 1.0);
    gl_Position = projectionMatrix * modelViewPosition;
    gl_PointSize = min(56.0, aSize * uPixelRatio * (60.0 / max(0.85, -modelViewPosition.z)));

    float sunVisibility = apertureVisibility(animated, uSunDirection);
    float scatter = smoothstep(0.04, 0.78, sunVisibility);
    float grain = 0.82 + 0.18 * sin(aPhase * 1.7 + uTime * 0.19);
    vec3 scatteredSun = uSunColor * uSunStrength * (0.035 + scatter * 0.55) * uDustGain;
    vColor = scatteredSun * aBrightness * grain + vec3(0.060, 0.045, 0.028);
    vAlpha = clamp((0.12 + scatter * uSunStrength * 0.30) * aBrightness, 0.0, 0.92);
    vScatter = scatter;
  }
`;

const dustFragmentShader = `
  precision highp float;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vScatter;
  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float radius = length(point);
    if (radius > 0.5) discard;
    float halo = smoothstep(0.5, 0.06, radius);
    float core = smoothstep(0.17, 0.0, radius);
    vec3 dustColor = vColor + vec3(0.12, 0.075, 0.028) * core * vScatter;
    gl_FragColor = vec4(dustColor, vAlpha * halo);
  }
`;

function createDust() {
  const count = 24000;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const brightness = new Float32Array(count);
  const random = mulberry32(960524);
  for (let index = 0; index < count; index += 1) {
    const base = index * 3;
    positions[base] = lerp(-3.4, 3.4, random());
    positions[base + 1] = lerp(0.08, 4.5, Math.pow(random(), 0.9));
    positions[base + 2] = lerp(-4.55, 4.45, random());
    // Most grains remain fine, while a small population becomes readable
    // foreground motes when the camera moves through the shaft.
    sizes[index] = 0.42 + Math.pow(random(), 2.2) * 2.35;
    phases[index] = random() * TAU;
    speeds[index] = 0.48 + random() * 1.08;
    brightness[index] = 0.52 + random() * 0.92;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute("aBrightness", new THREE.BufferAttribute(brightness, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uDustGain: { value: 2.0 },
      uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(0xffe0a0) },
      uSunStrength: { value: 0 },
      uApertureCenter: { value: caveApertures.map((aperture) => aperture.center.clone()) },
      uApertureNormal: { value: caveApertures.map((aperture) => aperture.normal.clone()) },
      uApertureU: { value: caveApertures.map((aperture) => aperture.u.clone()) },
      uApertureV: { value: caveApertures.map((aperture) => aperture.v.clone()) },
      uApertureHalf: { value: caveApertures.map((aperture) => aperture.half.clone()) },
    },
    vertexShader: dustVertexShader,
    fragmentShader: dustFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 5;
  scene.add(points);
  return points;
}

const dust = createDust();

const visibleMoteVertexShader = `
  attribute float aSize;
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aBrightness;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSizeScale;
  uniform vec3 uColor;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 animated = position;
    float t = uTime * aSpeed + aPhase;
    animated.x += sin(t * 0.73 + position.y * 0.31) * 0.045;
    animated.y += sin(t * 0.49 + position.x * 0.27) * 0.032;
    animated.z += cos(t * 0.61 + position.y * 0.21) * 0.038;
    vec4 modelViewPosition = modelViewMatrix * vec4(animated, 1.0);
    gl_Position = projectionMatrix * modelViewPosition;
    gl_PointSize = min(18.0, aSize * uPixelRatio * (uSizeScale / max(0.8, -modelViewPosition.z)));
    float flicker = 0.72 + 0.28 * sin(aPhase * 1.7 + uTime * 0.14);
    vColor = uColor * aBrightness * flicker;
    vAlpha = 0.26 * aBrightness;
  }
`;

const visibleMoteFragmentShader = `
  precision highp float;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float radius = length(point);
    if (radius > 0.5) discard;
    float soft = smoothstep(0.5, 0.06, radius);
    gl_FragColor = vec4(vColor, vAlpha * soft);
  }
`;

function createVisibleMotes() {
  const count = 6500;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const brightness = new Float32Array(count);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const random = mulberry32(771204);
  for (let index = 0; index < count; index += 1) {
    const base = index * 3;
    positions[base] = lerp(-3.25, 3.25, random());
    positions[base + 1] = lerp(0.15, 4.25, Math.pow(random(), 0.88));
    positions[base + 2] = lerp(-4.25, 3.9, random());
    sizes[index] = 0.22 + Math.pow(random(), 2.8) * 0.92;
    brightness[index] = 0.28 + random() * 0.62;
    phases[index] = random() * TAU;
    speeds[index] = 0.32 + random() * 0.62;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aBrightness", new THREE.BufferAttribute(brightness, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uSizeScale: { value: 30 },
      uColor: { value: new THREE.Color(0xf0c58a) },
    },
    vertexShader: visibleMoteVertexShader,
    fragmentShader: visibleMoteFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 6;
  scene.add(points);
  return points;
}

function updateVisibleMotes(points, time) {
  points.material.uniforms.uTime.value = time;
}

const visibleMotes = createVisibleMotes();
heroTyndallDust = createHeroTyndallDust();

const cameraKeys = [
  { t: 0, position: new THREE.Vector3(0.13, 0.3, -2.3), target: new THREE.Vector3(0.75, 1.08, -3.5) },
  { t: 30, position: new THREE.Vector3(0.25, 0.38, -2.48), target: new THREE.Vector3(0.75, 1.07, -3.49) },
  { t: 60, position: new THREE.Vector3(0.41, 0.5, -2.64), target: new THREE.Vector3(0.75, 1.05, -3.45) },
  { t: 90, position: new THREE.Vector3(0.23, 0.36, -2.47), target: new THREE.Vector3(0.75, 1.07, -3.48) },
  { t: 120, position: new THREE.Vector3(0.13, 0.3, -2.3), target: new THREE.Vector3(0.75, 1.08, -3.5) },
];

const colorDawn = new THREE.Color(0x5f4c45);
const colorDay = new THREE.Color(0x9ebed1);
const colorDusk = new THREE.Color(0x8a6250);
const colorSunLow = new THREE.Color(0xff9a5b);
const colorSunHigh = new THREE.Color(0xf3d6a4);
const colorFogDay = new THREE.Color(0x756b5e);
const colorFogDawn = new THREE.Color(0x554a43);
const colorFogDusk = new THREE.Color(0x675044);
const targetCenter = new THREE.Vector3(0.45, 1.8, -1.15);
const workingColor = new THREE.Color();
const workingColorTwo = new THREE.Color();
const sunSpritePosition = new THREE.Vector3();

function skyColorForAltitude(altitude) {
  if (altitude < 0.02) return workingColor.copy(colorDawn);
  if (altitude < 0.18) return workingColor.copy(colorDawn).lerp(colorDusk, smoothstep(0.02, 0.16, altitude));
  if (altitude < 0.42) return workingColor.copy(colorDusk).lerp(colorDay, smoothstep(0.16, 0.42, altitude));
  return workingColor.copy(colorDay);
}

function fogColorFor(altitude) {
  if (altitude < 0.08) return workingColorTwo.copy(colorFogDawn);
  if (altitude < 0.3) return workingColorTwo.copy(colorFogDawn).lerp(colorFogDusk, smoothstep(0.08, 0.22, altitude));
  return workingColorTwo.copy(colorFogDusk).lerp(colorFogDay, smoothstep(0.22, 0.5, altitude));
}

function formatLocalTime(hours) {
  const normalized = ((hours % 24) + 24) % 24;
  const hour = Math.floor(normalized);
  const minute = Math.floor((normalized - hour) * 60);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const timeValue = document.getElementById("time-value");
const dateValue = document.getElementById("date-value");
const sourceValue = document.getElementById("source-value");
const apertureValue = document.getElementById("aperture-value");
const altitudeValue = document.getElementById("altitude-value");
const illuminationValue = document.getElementById("illumination-value");
const timeSlider = document.getElementById("time-slider");
const playButton = document.getElementById("play-button");
const dateInput = document.getElementById("date-input");
const speedSelect = document.getElementById("speed-select");
const interactionBadge = document.getElementById("interaction-badge");
const flowToggle = document.getElementById("flow-toggle");
const resetViewButton = document.getElementById("reset-view");
const interactionHint = document.getElementById("interaction-hint");
const urlParams = new URLSearchParams(window.location.search);
const renderMode = urlParams.get("mode") === "render" || urlParams.has("render");

const orbitState = {
  yaw: 0,
  pitch: 0,
  distance: 1,
  dragging: false,
  pointerId: -1,
  lastX: 0,
  lastY: 0,
};

let flowEnabled = false;
let flowClock = 0;
let flowFrameId = 0;
let previousFlowTimestamp = 0;

if (renderMode) {
  if (flowToggle) flowToggle.disabled = true;
  if (interactionHint) interactionHint.textContent = "RENDER MODE · CINEMATIC CAMERA";
}

let selectedDate = "2026-09-24";
let currentTime = 0;
let currentAstro = astroState(selectedDate, mapTimeToLocalHours(0));
let manualPlaying = false;
let manualFrameId = 0;
let previousManualTimestamp = 0;

function updateApertureReadout(sourceDirection, sourceStrength, preferredSunAperture = null) {
  if (preferredSunAperture && sourceStrength > 0.01) {
    apertureValue.textContent = preferredSunAperture.label;
    return;
  }

  let bestIndex = -1;
  let bestFacing = 0.06;
  caveApertures.forEach((aperture, index) => {
    if (!aperture.active) return;
    const facing = sourceDirection.dot(aperture.normal);
    if (facing > bestFacing && sourceStrength > 0.01) {
      bestFacing = facing;
      bestIndex = index;
    }
  });
  if (bestIndex >= 0) {
    apertureValue.textContent = caveApertures[bestIndex].label;
    return;
  }
  apertureValue.textContent = sourceStrength > 0.01 ? "日光漫射" : "日光未穿入";
}

function selectFacePortal(sourceDirection) {
  let bestAperture = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const aperture of caveApertures) {
    if (!aperture.active) continue;
    const facing = sourceDirection.dot(aperture.normal);
    if (facing < 0.08) continue;
    const alongRay = aperture.center.clone().sub(facePortalPoint).dot(sourceDirection);
    if (alongRay <= 0) continue;
    const closestPoint = facePortalPoint.clone().addScaledVector(sourceDirection, alongRay);
    const local = closestPoint.sub(aperture.center);
    const normalizedU = Math.abs(local.dot(aperture.u)) / aperture.half.x;
    const normalizedV = Math.abs(local.dot(aperture.v)) / aperture.half.y;
    const outside = Math.max(normalizedU, normalizedV);
    if (outside > 1.08) continue;
    const score = outside + (1 - facing) * 0.08;
    if (score < bestScore) {
      bestScore = score;
      bestAperture = aperture;
    }
  }
  return bestAperture;
}

function updateFacePortal(light, aperture, sourceDirection, strength, color, intensityScale) {
  if (!aperture || strength <= 0) {
    light.intensity = 0;
    return;
  }
  light.color.copy(color);
  light.position.copy(aperture.center).addScaledVector(sourceDirection, 0.35);
  light.target.position.copy(facePortalPoint);
  light.intensity = strength * intensityScale;
  light.target.updateMatrixWorld();
}

const orbitOffset = new THREE.Vector3();
const orbitSpherical = new THREE.Spherical();
const orbitCameraPosition = new THREE.Vector3();

function applyCameraPose(cameraPosition, cameraTarget) {
  if (renderMode) {
    camera.position.copy(cameraPosition);
    camera.lookAt(cameraTarget);
    return;
  }

  orbitOffset.copy(cameraPosition).sub(cameraTarget);
  orbitSpherical.setFromVector3(orbitOffset);
  orbitSpherical.theta += orbitState.yaw;
  orbitSpherical.phi = clamp(orbitSpherical.phi + orbitState.pitch, 0.58, 1.8);
  orbitSpherical.radius = Math.max(0.9, orbitSpherical.radius * orbitState.distance);
  orbitCameraPosition.setFromSpherical(orbitSpherical).add(cameraTarget);
  orbitCameraPosition.x = clamp(orbitCameraPosition.x, -3.12, 3.12);
  orbitCameraPosition.y = clamp(orbitCameraPosition.y, 0.3, 4.12);
  orbitCameraPosition.z = clamp(orbitCameraPosition.z, -3.05, 4.12);
  camera.position.copy(orbitCameraPosition);
  camera.lookAt(cameraTarget);
}

function resetOrbitState() {
  orbitState.yaw = 0;
  orbitState.pitch = 0;
  orbitState.distance = 1;
  orbitState.dragging = false;
  orbitState.pointerId = -1;
  canvas.classList.remove("is-dragging");
}

function stopFlowLoop() {
  if (flowFrameId) cancelAnimationFrame(flowFrameId);
  flowFrameId = 0;
  previousFlowTimestamp = 0;
}

function setFlowEnabled(enabled) {
  flowEnabled = Boolean(enabled) && !renderMode;
  if (flowToggle) {
    flowToggle.textContent = flowEnabled ? "光流 ON" : "光流 OFF";
    flowToggle.setAttribute("aria-pressed", String(flowEnabled));
  }
  stopFlowLoop();
  if (!flowEnabled) {
    renderAt(currentTime);
    return;
  }
  flowFrameId = requestAnimationFrame(flowFrame);
}

function flowFrame(timestamp) {
  if (!flowEnabled) return;
  if (previousFlowTimestamp === 0) previousFlowTimestamp = timestamp;
  const delta = Math.min(0.08, (timestamp - previousFlowTimestamp) / 1000);
  previousFlowTimestamp = timestamp;
  flowClock = (flowClock + delta * 0.42) % 1000;
  renderAt(currentTime);
  flowFrameId = requestAnimationFrame(flowFrame);
}

function renderAt(time) {
  currentTime = clamp(time, 0, SCENE_DURATION);
  const localHours = mapTimeToLocalHours(currentTime);
  currentAstro = astroState(selectedDate, localHours);

  const sunAltitude = currentAstro.sun.altitude;
  const sunUp = smoothstep(-0.12, 0.08, sunAltitude);
  const twilight = Math.exp(-Math.pow((sunAltitude + 0.015) / 0.16, 2));
  const lowSunFill = smoothstep(0.01, 0.08, sunAltitude) * (1 - smoothstep(0.12, 0.32, sunAltitude));
  const sunStrength = 2.0 * sunUp;

  workingColor.copy(colorSunLow).lerp(colorSunHigh, smoothstep(0.05, 0.58, sunAltitude));
  sunLight.color.copy(workingColor);
  sunLight.intensity = sunStrength;
  // The interpretive daylight wash carries the aperture story; keep the
  // directional source shadowless to avoid a hard diagonal bar on the mural.
  sunLight.castShadow = false;
  sunLight.target.position.copy(targetCenter);
  sunLight.position.copy(targetCenter).addScaledVector(currentAstro.sunDirection, 40);
  sunLight.target.updateMatrixWorld();
  sunFillLight.color.copy(workingColor);
  sunFillLight.intensity = 0.08 + sunUp * 0.32 + lowSunFill * 0.12;
  sunFillLight.target.position.copy(targetCenter);
  sunFillLight.position.copy(targetCenter).addScaledVector(currentAstro.sunDirection, 40);
  sunFillLight.target.updateMatrixWorld();
  sunShadowLight.color.copy(workingColor);
  sunShadowLight.intensity = sunUp * 0.22;
  sunShadowLight.target.position.copy(targetCenter);
  sunShadowLight.position.copy(targetCenter).addScaledVector(currentAstro.sunDirection, 40);
  sunShadowLight.target.updateMatrixWorld();

  const sunFacePortal = selectFacePortal(currentAstro.sunDirection);
  updateFacePortal(sunFaceLight, sunFacePortal, currentAstro.sunDirection, sunStrength, sunLight.color, 3.4);

  const skyColor = skyColorForAltitude(sunAltitude).clone();
  skyMaterial.color.copy(skyColor);
  const fogColor = fogColorFor(sunAltitude).clone();
  scene.fog.color.copy(fogColor);
  scene.fog.density = 0.008 + sunUp * 0.003;
  hemisphereLight.color.copy(skyColor).lerp(new THREE.Color(0xa6b4c0), 0.24);
  hemisphereLight.groundColor.set(0x4a3422);
  hemisphereLight.intensity = 0.44 + sunUp * 0.42 + lowSunFill * 0.28 + twilight * 0.12;
  ambientLight.color.copy(skyColor).lerp(new THREE.Color(0x6a4930), 0.52);
  ambientLight.intensity = 0.48 + sunUp * 0.16 + lowSunFill * 0.24;
  caveBounceLight.intensity = 0.28 + sunUp * 2.05 + lowSunFill * 0.68 + twilight * 0.2;
  caveBounceLight.color.set(0xc4b092).lerp(sunLight.color, 0.3);
  statueBounceLight.intensity = 0.06 + sunUp * 0.3 + lowSunFill * 0.12;
  statueBounceLight.color.set(0xc59b6e).lerp(sunLight.color, 0.22);
  floorFillLight.intensity = 0.04 + sunUp * 0.46 + lowSunFill * 0.22;
  floorFillLight.color.set(0xc28b60).lerp(sunLight.color, 0.24);
  renderer.toneMappingExposure = 1.36 + sunUp * 0.1 + lowSunFill * 0.04;

  sunSpritePosition.copy(currentAstro.sunDirection).multiplyScalar(43).add(new THREE.Vector3(0, 1.4, 0));
  sunSprite.position.copy(sunSpritePosition);
  sunSprite.material.opacity = smoothstep(-0.05, 0.06, sunAltitude) * 0.9;

  const washStrength = smoothstep(-0.08, 0.16, sunAltitude);
  daylightWash.position.x = clamp(0.55 + currentAstro.sunDirection.x * 2.6, -2.35, 3.25);
  daylightWash.position.y = clamp(2.45 + currentAstro.sunDirection.y * 1.15, 1.45, 3.7);
  daylightWash.scale.set(4.25 + (1 - washStrength) * 0.7, 2.85 + (1 - washStrength) * 0.55, 1);
  daylightWash.material.color.copy(workingColor);
  daylightWash.material.opacity = washStrength * (0.026 + sunUp * 0.052);

  const visualTime = currentTime + flowClock;
  updateVisibleMotes(visibleMotes, visualTime);
  let heroAperture = sunFacePortal;
  if (!heroAperture) {
    let strongestFacing = 0.06;
    caveApertures.forEach((aperture) => {
      if (!aperture.active) return;
      const facing = currentAstro.sunDirection.dot(aperture.normal);
      if (facing > strongestFacing) {
        strongestFacing = facing;
        heroAperture = aperture;
      }
    });
  }
  const heroApertureIndex = heroAperture ? caveApertures.indexOf(heroAperture) : -1;
  caveApertures.forEach((aperture, index) => {
    const displayScale = index === heroApertureIndex ? 1 : 0;
    updateBeam(
      sunBeams[index],
      aperture,
      currentAstro.sunDirection,
      sunStrength,
      sunLight.color,
      visualTime,
      displayScale,
    );
  });

  dust.material.uniforms.uTime.value = visualTime;
  dust.material.uniforms.uPixelRatio.value = 1;
  dust.material.uniforms.uSunDirection.value.copy(currentAstro.sunDirection);
  dust.material.uniforms.uSunColor.value.copy(sunLight.color);
  dust.material.uniforms.uSunStrength.value = sunStrength;

  const cameraPosition = interpolateKeyframes(currentTime, cameraKeys, "position");
  const cameraTarget = interpolateKeyframes(currentTime, cameraKeys, "target");
  const driftX = Math.sin(currentTime * 0.42) * 0.065;
  const driftY = Math.sin(currentTime * 0.55 + 1.2) * 0.035;
  const driftZ = Math.cos(currentTime * 0.31 + 0.4) * 0.026;
  cameraPosition.add(new THREE.Vector3(driftX, driftY, driftZ));
  applyCameraPose(cameraPosition, cameraTarget);
  camera.getWorldDirection(heroVeilForward);
  heroTyndallVeil.position.copy(camera.position).addScaledVector(heroVeilForward, 1.85);
  heroTyndallVeil.position.y += 0.28;
  heroTyndallVeil.quaternion.copy(camera.quaternion);
  heroTyndallVeil.rotateZ(-0.72 + Math.sin(visualTime * 0.05) * 0.014);
  heroTyndallVeil.material.color.copy(sunLight.color);
  heroTyndallVeil.material.opacity = 0.025 + sunUp * 0.105;
  heroTyndallDust.position.copy(heroTyndallVeil.position);
  heroTyndallDust.quaternion.copy(heroTyndallVeil.quaternion);
  heroTyndallDust.material.uniforms.uTime.value = visualTime;
  heroTyndallDust.material.uniforms.uColor.value.copy(sunLight.color);

  timeValue.textContent = formatLocalTime(localHours);
  dateValue.textContent = selectedDate.replaceAll("-", ".");
  if (sunAltitude < 0.02) {
    sourceValue.textContent = "晨光";
    altitudeValue.textContent = `太阳 ${(sunAltitude / DEG).toFixed(1)}°`;
  } else if (sunAltitude < 0.2) {
    sourceValue.textContent = "斜阳";
    altitudeValue.textContent = `太阳 ${(sunAltitude / DEG).toFixed(1)}°`;
  } else {
    sourceValue.textContent = "日光";
    altitudeValue.textContent = `太阳 ${(sunAltitude / DEG).toFixed(1)}°`;
  }
  illuminationValue.textContent = `日照 ${Math.round(sunUp * 100)}%`;
  updateApertureReadout(currentAstro.sunDirection, sunStrength, sunFacePortal);
  timeSlider.value = String(currentTime);

  renderer.render(scene, camera);
}

function stopManualPlayback() {
  manualPlaying = false;
  if (manualFrameId) cancelAnimationFrame(manualFrameId);
  manualFrameId = 0;
  previousManualTimestamp = 0;
  playButton.textContent = "播放";
  playButton.setAttribute("aria-label", "播放 120 秒白昼光流");
}

function manualPlaybackFrame(timestamp) {
  if (!manualPlaying) return;
  if (previousManualTimestamp === 0) previousManualTimestamp = timestamp;
  const delta = Math.min(0.08, (timestamp - previousManualTimestamp) / 1000);
  previousManualTimestamp = timestamp;
  currentTime += delta * Number(speedSelect.value);
  if (currentTime >= SCENE_DURATION) currentTime -= SCENE_DURATION;
  const timeline = window.__timelines.main;
  if (timeline) timeline.seek(currentTime, false);
  renderAt(currentTime);
  manualFrameId = requestAnimationFrame(manualPlaybackFrame);
}

function startManualPlayback() {
  manualPlaying = true;
  previousManualTimestamp = 0;
  playButton.textContent = "暂停";
  playButton.setAttribute("aria-label", "暂停播放");
  manualFrameId = requestAnimationFrame(manualPlaybackFrame);
}

playButton.addEventListener("click", () => {
  if (manualPlaying) stopManualPlayback();
  else startManualPlayback();
});

timeSlider.addEventListener("input", (event) => {
  stopManualPlayback();
  currentTime = Number(event.target.value);
  const timeline = window.__timelines.main;
  if (timeline) timeline.seek(currentTime, false);
  renderAt(currentTime);
});

dateInput.addEventListener("change", (event) => {
  const next = event.target.value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(next)) selectedDate = next;
  renderAt(currentTime);
});

speedSelect.addEventListener("change", () => {
  if (manualPlaying) {
    stopManualPlayback();
    startManualPlayback();
  }
});

function requestInteractiveRender() {
  if (!renderMode && !manualPlaying) renderAt(currentTime);
}

canvas.addEventListener("pointerdown", (event) => {
  if (renderMode || event.button !== 0) return;
  orbitState.dragging = true;
  orbitState.pointerId = event.pointerId;
  orbitState.lastX = event.clientX;
  orbitState.lastY = event.clientY;
  canvas.classList.add("is-dragging");
  canvas.setPointerCapture(event.pointerId);
  event.preventDefault();
});

canvas.addEventListener("pointermove", (event) => {
  if (!orbitState.dragging || event.pointerId !== orbitState.pointerId) return;
  const deltaX = event.clientX - orbitState.lastX;
  const deltaY = event.clientY - orbitState.lastY;
  orbitState.lastX = event.clientX;
  orbitState.lastY = event.clientY;
  orbitState.yaw = clamp(orbitState.yaw - deltaX * 0.004, -0.46, 0.46);
  orbitState.pitch = clamp(orbitState.pitch - deltaY * 0.003, -0.2, 0.2);
  requestInteractiveRender();
});

function endPointerInteraction(event) {
  if (event.pointerId !== orbitState.pointerId) return;
  orbitState.dragging = false;
  orbitState.pointerId = -1;
  canvas.classList.remove("is-dragging");
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}

canvas.addEventListener("pointerup", endPointerInteraction);
canvas.addEventListener("pointercancel", endPointerInteraction);
canvas.addEventListener("pointerleave", (event) => {
  if (orbitState.dragging && event.pointerType === "mouse") endPointerInteraction(event);
});
canvas.addEventListener("wheel", (event) => {
  if (renderMode) return;
  orbitState.distance = clamp(orbitState.distance + event.deltaY * 0.0007, 0.8, 1.22);
  requestInteractiveRender();
  event.preventDefault();
}, { passive: false });
canvas.addEventListener("dblclick", () => {
  if (renderMode) return;
  resetOrbitState();
  requestInteractiveRender();
});

if (resetViewButton) {
  resetViewButton.addEventListener("click", () => {
    resetOrbitState();
    requestInteractiveRender();
  });
}
if (flowToggle) {
  flowToggle.addEventListener("click", () => setFlowEnabled(!flowEnabled));
}

window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
  if (event.code === "KeyR" && !renderMode) {
    resetOrbitState();
    requestInteractiveRender();
  }
  if (event.code === "Space") {
    event.preventDefault();
    if (manualPlaying) stopManualPlayback();
    else startManualPlayback();
  }
  if (event.code === "ArrowRight") {
    stopManualPlayback();
    currentTime = clamp(currentTime + (event.shiftKey ? 1 : 0.25), 0, SCENE_DURATION);
    const timeline = window.__timelines.main;
    if (timeline) timeline.seek(currentTime, false);
    renderAt(currentTime);
  }
  if (event.code === "ArrowLeft") {
    stopManualPlayback();
    currentTime = clamp(currentTime - (event.shiftKey ? 1 : 0.25), 0, SCENE_DURATION);
    const timeline = window.__timelines.main;
    if (timeline) timeline.seek(currentTime, false);
    renderAt(currentTime);
  }
});

const previewTimeParam = urlParams.get("t");
const parsedPreviewTime = Number(previewTimeParam);
const previewTimeOverride = previewTimeParam !== null && Number.isFinite(parsedPreviewTime)
  ? clamp(parsedPreviewTime, 0, SCENE_DURATION)
  : null;

window.addEventListener("hf-seek", (event) => {
  if (previewTimeOverride !== null) return;
  stopManualPlayback();
  const time = Number(event.detail?.time ?? window.__hfThreeTime ?? 0);
  renderAt(time);
});

window.__timelines = window.__timelines || {};
if (!window.__timelines.main) window.__timelines.main = gsap.timeline({ paused: true });

const initialTime = previewTimeOverride ?? (window.__hfThreeTime ?? 0);
if (window.__timelines.main) window.__timelines.main.seek(initialTime, false);
renderAt(initialTime);
interactionBadge.textContent = "CAVE 328 / LOADING SCAN";
window.__hf = window.__hf || {};
window.__hf.buildReady = loadCave328Statue().catch((error) => {
  interactionBadge.textContent = "CAVE 328 / ASSET ERROR";
  console.error("Cave 328 asset failed to load", error);
  throw error;
});

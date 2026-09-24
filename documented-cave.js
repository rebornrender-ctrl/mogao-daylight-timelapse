import * as THREE from "./vendor/three.module.js";

const TAU = Math.PI * 2;
const CAVE = Object.freeze({
  halfWidth: 3.45,
  backZ: -4.68,
  frontZ: 4.55,
  wallTop: 4.48,
  wallCenterY: 2.2,
  wallDepth: 9.23,
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function makeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function createDocumentedWallTexture() {
  const canvas = makeCanvas(2048, 1024);
  const context = canvas.getContext("2d");
  const random = (() => {
    let state = 328041;
    return () => {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  })();

  const base = context.createLinearGradient(0, 0, 0, canvas.height);
  base.addColorStop(0, "#897454");
  base.addColorStop(0.28, "#b0946c");
  base.addColorStop(0.62, "#987b57");
  base.addColorStop(1, "#604d3a");
  context.fillStyle = base;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const mineral = ["#3d5d55", "#3e5872", "#70493b", "#695875", "#8b6a3e", "#59634a"];
  for (let index = 0; index < 22; index += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const radius = 100 + random() * 280;
    const wash = context.createRadialGradient(x, y, 0, x, y, radius);
    const color = mineral[index % mineral.length];
    wash.addColorStop(0, `${color}30`);
    wash.addColorStop(0.55, `${color}18`);
    wash.addColorStop(1, `${color}00`);
    context.fillStyle = wash;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  const drawBorder = (y, height, color, alpha) => {
    context.beginPath();
    context.moveTo(0, y);
    for (let x = 0; x <= canvas.width; x += 48) {
      context.lineTo(x, y + Math.sin(x * 0.011 + y) * 5 + (random() - 0.5) * 3);
    }
    for (let x = canvas.width; x >= 0; x -= 48) {
      context.lineTo(x, y + height + Math.sin(x * 0.009 + y) * 6 + (random() - 0.5) * 4);
    }
    context.closePath();
    context.fillStyle = color;
    context.globalAlpha = alpha;
    context.fill();
    context.globalAlpha = 1;
    context.strokeStyle = "rgba(224,190,132,0.32)";
    context.lineWidth = 3;
    context.stroke();
  };

  drawBorder(46, 30, "#6d503a", 0.42);
  drawBorder(188, 178, "#3e5c53", 0.25);
  drawBorder(398, 290, "#3e5871", 0.2);
  drawBorder(724, 188, "#70493b", 0.2);
  drawBorder(946, 30, "#5c6a4b", 0.34);

  const drawSeatedFigure = (x, y, scale, color, alpha, variant) => {
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    context.globalAlpha = alpha;
    context.strokeStyle = "rgba(226,193,133,0.42)";
    context.lineWidth = 2.4;
    context.fillStyle = color;

    context.beginPath();
    context.arc(0, -27, 13, 0, TAU);
    context.fill();
    context.beginPath();
    context.arc(0, -27, 22, Math.PI * 0.1, Math.PI * 0.9);
    context.stroke();

    context.beginPath();
    context.moveTo(-18, -8);
    context.quadraticCurveTo(0, 4, 18, -8);
    context.lineTo(30, 48);
    context.quadraticCurveTo(0, 67, -30, 48);
    context.closePath();
    context.fill();

    context.beginPath();
    context.moveTo(-27, 51);
    context.quadraticCurveTo(0, 38, 27, 51);
    context.lineTo(18, 65);
    context.quadraticCurveTo(0, 73, -18, 65);
    context.closePath();
    context.fill();

    context.strokeStyle = "rgba(232,204,146,0.5)";
    context.lineWidth = 2;
    context.beginPath();
    if (variant % 3 === 0) {
      context.moveTo(-9, 0);
      context.quadraticCurveTo(0, 13, 9, 0);
      context.moveTo(-11, 19);
      context.quadraticCurveTo(0, 30, 11, 19);
    } else if (variant % 3 === 1) {
      context.moveTo(0, 2);
      context.lineTo(0, 43);
      context.moveTo(-14, 15);
      context.lineTo(14, 15);
    } else {
      context.arc(0, 23, 14, Math.PI * 0.1, Math.PI * 0.9);
    }
    context.stroke();
    context.restore();
  };

  // The upper register is a dense field of small, repeated sacred figures,
  // not three oversized icons. Keep the contrast low so the wall reads as
  // worn pigment rather than a flat graphic mural.
  for (let index = 0; index < 74; index += 1) {
    const x = 30 + (index % 37) * 54 + (random() - 0.5) * 12;
    const y = 102 + Math.floor(index / 37) * 62 + (random() - 0.5) * 12;
    drawSeatedFigure(x, y, 0.2 + random() * 0.08, mineral[index % mineral.length], 0.1 + random() * 0.08, index);
  }

  for (let index = 0; index < 18; index += 1) {
    const x = 56 + index * 112 + (random() - 0.5) * 20;
    const y = 480 + (random() - 0.5) * 24;
    const scale = 0.34 + random() * 0.13;
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    context.globalAlpha = 0.1 + random() * 0.09;
    context.fillStyle = mineral[(index + 2) % mineral.length];
    context.strokeStyle = "rgba(232,201,143,0.32)";
    context.lineWidth = 4;
    context.beginPath();
    context.arc(0, -48, 18, 0, TAU);
    context.fill();
    context.beginPath();
    context.moveTo(-23, -25);
    context.quadraticCurveTo(0, -11, 23, -25);
    context.lineTo(33, 75);
    context.quadraticCurveTo(0, 94, -33, 75);
    context.closePath();
    context.fill();
    context.beginPath();
    context.arc(0, -48, 31, Math.PI * 0.1, Math.PI * 0.9);
    context.stroke();
    context.restore();
  }

  for (let index = 0; index < 20; index += 1) {
    const x = 42 + index * 101 + (random() - 0.5) * 16;
    const y = 818 + (random() - 0.5) * 20;
    drawSeatedFigure(x, y, 0.27 + random() * 0.1, mineral[(index + 4) % mineral.length], 0.12 + random() * 0.08, index + 2);
  }

  context.globalAlpha = 0.18;
  for (let index = 0; index < 110; index += 1) {
    const x = random() * canvas.width;
    const y = 60 + random() * (canvas.height - 120);
    context.strokeStyle = mineral[index % mineral.length];
    context.lineWidth = 1 + random() * 4;
    context.beginPath();
    context.moveTo(x, y);
    context.quadraticCurveTo(
      x + (random() - 0.5) * 90,
      y + (random() - 0.5) * 22,
      x + (random() - 0.5) * 160,
      y + (random() - 0.5) * 34,
    );
    context.stroke();
  }
  context.globalAlpha = 1;

  context.strokeStyle = "rgba(35,25,20,0.36)";
  context.lineWidth = 2;
  for (let index = 0; index < 54; index += 1) {
    let x = random() * canvas.width;
    let y = random() * canvas.height;
    context.beginPath();
    context.moveTo(x, y);
    for (let segment = 0; segment < 4 + Math.floor(random() * 7); segment += 1) {
      x += (random() - 0.5) * 92;
      y += (random() - 0.5) * 48;
      context.lineTo(x, y);
    }
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

function createFloorTextures() {
  const size = 1024;
  const colorCanvas = makeCanvas(size, size);
  const bumpCanvas = makeCanvas(size, size);
  const colorContext = colorCanvas.getContext("2d");
  const bumpContext = bumpCanvas.getContext("2d");
  const colorImage = colorContext.createImageData(size, size);
  const bumpImage = bumpContext.createImageData(size, size);
  const fract = (value) => value - Math.floor(value);
  const hash = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
  const noise = (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy);
    const b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1);
    const d = hash(ix + 1, iy + 1);
    return (a + (b - a) * ux + (c - a + (d - b - c + a) * ux) * uy) * 2 - 1;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const nx = x / size;
      const ny = y / size;
      const broad = noise(nx * 5.2, ny * 5.2) * 0.55 + noise(nx * 17.0 + 8.0, ny * 13.0 - 4.0) * 0.22;
      const grit = (hash(x, y) - 0.5) * 0.65;
      const mineral = Math.max(0, Math.min(1, 0.5 + broad * 0.32 + grit * 0.14));
      colorImage.data[index] = Math.max(0, Math.min(255, 144 + broad * 22 + grit * 10));
      colorImage.data[index + 1] = Math.max(0, Math.min(255, 111 + broad * 17 + grit * 8));
      colorImage.data[index + 2] = Math.max(0, Math.min(255, 76 + broad * 12 + grit * 6));
      colorImage.data[index + 3] = 255;
      const bump = Math.max(0, Math.min(255, 128 + broad * 42 + grit * 32 + mineral * 6));
      bumpImage.data[index] = bump;
      bumpImage.data[index + 1] = bump;
      bumpImage.data[index + 2] = bump;
      bumpImage.data[index + 3] = 255;
    }
  }
  colorContext.putImageData(colorImage, 0, 0);
  bumpContext.putImageData(bumpImage, 0, 0);

  colorContext.lineCap = "round";
  for (let index = 0; index < 24; index += 1) {
    let x = hash(index, 4) * size;
    let y = hash(index, 9) * size;
    colorContext.beginPath();
    colorContext.moveTo(x, y);
    for (let segment = 0; segment < 5; segment += 1) {
      x += (hash(index * 13 + segment, 2) - 0.5) * 90;
      y += (hash(index * 17 + segment, 7) - 0.5) * 70;
      colorContext.lineTo(x, y);
    }
    colorContext.strokeStyle = `rgba(57, 38, 27, ${0.12 + hash(index, 12) * 0.12})`;
    colorContext.lineWidth = 1 + hash(index, 19) * 3;
    colorContext.stroke();
  }

  const colorTexture = new THREE.CanvasTexture(colorCanvas);
  colorTexture.colorSpace = THREE.SRGBColorSpace;
  colorTexture.wrapS = THREE.RepeatWrapping;
  colorTexture.wrapT = THREE.RepeatWrapping;
  colorTexture.repeat.set(2.2, 3.2);
  colorTexture.anisotropy = 8;
  const bumpTexture = new THREE.CanvasTexture(bumpCanvas);
  bumpTexture.colorSpace = THREE.NoColorSpace;
  bumpTexture.wrapS = THREE.RepeatWrapping;
  bumpTexture.wrapT = THREE.RepeatWrapping;
  bumpTexture.repeat.copy(colorTexture.repeat);
  bumpTexture.anisotropy = 8;
  return { color: colorTexture, bump: bumpTexture };
}

function createShrineTexture() {
  const canvas = makeCanvas(1024, 1024);
  const context = canvas.getContext("2d");
  const random = (() => {
    let state = 328328;
    return () => {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  })();
  const gradient = context.createRadialGradient(512, 390, 40, 512, 430, 700);
  gradient.addColorStop(0, "#aa8d62");
  gradient.addColorStop(0.55, "#816a4e");
  gradient.addColorStop(1, "#493c31");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1024, 1024);

  context.strokeStyle = "rgba(218,181,117,0.28)";
  context.lineWidth = 8;
  context.strokeRect(44, 44, 936, 936);
  context.strokeStyle = "rgba(47,76,68,0.34)";
  context.lineWidth = 4;
  context.strokeRect(72, 72, 880, 880);

  const drawFigure = (x, y, scale, color, central) => {
    context.save();
    context.filter = central ? "blur(0.8px)" : "blur(0.45px)";
    context.translate(x, y);
    context.scale(scale, scale);
    context.globalAlpha = central ? 0.2 : 0.12;
    context.lineCap = "round";
    context.lineJoin = "round";

    if (central) {
      context.strokeStyle = "rgba(211,177,111,0.28)";
      context.lineWidth = 7;
      context.beginPath();
      context.arc(0, -76, 76, Math.PI * 0.12, Math.PI * 0.88);
      context.stroke();
      context.strokeStyle = "rgba(74,91,76,0.22)";
      context.lineWidth = 4;
      context.beginPath();
      context.arc(0, -76, 58, Math.PI * 0.18, Math.PI * 0.82);
      context.stroke();
    }

    context.fillStyle = color;
    context.strokeStyle = "rgba(229,196,137,0.42)";
    context.lineWidth = central ? 4 : 2.5;
    context.beginPath();
    context.arc(0, -70, central ? 25 : 16, 0, TAU);
    context.fill();
    context.stroke();

    context.beginPath();
    context.moveTo(-22, -48);
    context.quadraticCurveTo(0, -60, 22, -48);
    context.quadraticCurveTo(34, -22, 28, 6);
    context.quadraticCurveTo(17, 26, 0, 31);
    context.quadraticCurveTo(-17, 26, -28, 6);
    context.quadraticCurveTo(-34, -22, -22, -48);
    context.closePath();
    context.fill();
    context.stroke();

    context.beginPath();
    context.moveTo(-25, 13);
    context.quadraticCurveTo(0, 2, 25, 13);
    context.lineTo(42, 65);
    context.quadraticCurveTo(0, 82, -42, 65);
    context.closePath();
    context.fill();
    context.stroke();

    context.beginPath();
    context.moveTo(-36, 66);
    context.quadraticCurveTo(0, 49, 36, 66);
    context.quadraticCurveTo(25, 85, 0, 88);
    context.quadraticCurveTo(-25, 85, -36, 66);
    context.closePath();
    context.fill();
    context.stroke();

    context.strokeStyle = "rgba(232,204,146,0.38)";
    context.lineWidth = central ? 3 : 2;
    context.beginPath();
    context.moveTo(-16, -38);
    context.quadraticCurveTo(0, -24, 16, -38);
    context.moveTo(-18, 5);
    context.quadraticCurveTo(0, 17, 18, 5);
    context.moveTo(0, -28);
    context.lineTo(0, 54);
    context.stroke();

    if (central) {
      context.strokeStyle = "rgba(218,185,119,0.26)";
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(-67, 93);
      context.quadraticCurveTo(0, 78, 67, 93);
      context.stroke();
    }
    context.filter = "none";
    context.restore();
  };

  drawFigure(512, 402, 0.68, "#5b6b5a", true);
  drawFigure(260, 468, 0.38, "#7a5c47", false);
  drawFigure(764, 468, 0.38, "#526452", false);

  context.globalAlpha = 0.28;
  for (let index = 0; index < 46; index += 1) {
    const x = random() * 1024;
    const y = random() * 1024;
    context.fillStyle = index % 2 ? "#3f5d55" : "#70493b";
    context.fillRect(x, y, 8 + random() * 42, 2 + random() * 8);
  }
  context.globalAlpha = 1;
  context.strokeStyle = "rgba(31,23,19,0.42)";
  context.lineWidth = 2;
  for (let index = 0; index < 22; index += 1) {
    let x = random() * 1024;
    let y = random() * 1024;
    context.beginPath();
    context.moveTo(x, y);
    for (let segment = 0; segment < 5; segment += 1) {
      x += (random() - 0.5) * 90;
      y += (random() - 0.5) * 70;
      context.lineTo(x, y);
    }
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function createSurface({
  group,
  material,
  origin,
  u,
  v,
  normal,
  width,
  height,
  holes = [],
  segmentsU = 32,
  segmentsV = 24,
  surfaceKind = "wall",
  noise,
}) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const halfU = width / 2;
  const halfV = height / 2;
  const addPoint = (uCoordinate, vCoordinate) => {
    const point = origin.clone().addScaledVector(u, uCoordinate).addScaledVector(v, vCoordinate);
    const edgeDistance = Math.min(
      halfU - Math.abs(uCoordinate),
      halfV - Math.abs(vCoordinate),
    );
    const edgeMask = clamp(edgeDistance / Math.min(halfU, halfV) / 0.22, 0, 1);
    const surfaceNoise = noise(point.x * 0.7, point.y * 0.7, point.z * 0.7);
    if (surfaceKind === "ceiling") {
      point.y += 0.2 * (1 - Math.min(1, (point.x / CAVE.halfWidth) ** 2));
      point.y += surfaceNoise * 0.012 * edgeMask;
    } else if (surfaceKind === "floor") {
      point.y += surfaceNoise * 0.016 * edgeMask;
    } else {
      const plasterRelief = surfaceNoise * 0.05 + Math.sin(point.y * 3.4 + point.z * 1.7) * 0.009;
      point.addScaledVector(normal, plasterRelief * edgeMask);
    }
    positions.push(point.x, point.y, point.z);
    uvs.push((uCoordinate + halfU) / width, (vCoordinate + halfV) / height);
  };

  for (let row = 0; row < segmentsV; row += 1) {
    const v0 = -halfV + (row / segmentsV) * height;
    const v1 = -halfV + ((row + 1) / segmentsV) * height;
    for (let column = 0; column < segmentsU; column += 1) {
      const u0 = -halfU + (column / segmentsU) * width;
      const u1 = -halfU + ((column + 1) / segmentsU) * width;
      const centerU = (u0 + u1) / 2;
      const centerV = (v0 + v1) / 2;
      const inHole = holes.some(
        (hole) =>
          Math.abs(centerU - hole.u) < hole.halfU &&
          Math.abs(centerV - hole.v) < hole.halfV,
      );
      if (inHole) continue;
      const base = positions.length / 3;
      addPoint(u0, v0);
      addPoint(u1, v0);
      addPoint(u1, v1);
      addPoint(u0, v1);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const computedNormals = geometry.attributes.normal;
  for (let index = 0; index < computedNormals.count; index += 1) {
    const dot =
      computedNormals.getX(index) * normal.x +
      computedNormals.getY(index) * normal.y +
      computedNormals.getZ(index) * normal.z;
    if (dot < 0) {
      computedNormals.setXYZ(
        index,
        -computedNormals.getX(index),
        -computedNormals.getY(index),
        -computedNormals.getZ(index),
      );
    }
  }
  computedNormals.needsUpdate = true;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function createReveal({ group, material, origin, u, v, normal, hole, depth = 0.22 }) {
  const corners = [
    new THREE.Vector3(-hole.halfU, -hole.halfV, 0),
    new THREE.Vector3(hole.halfU, -hole.halfV, 0),
    new THREE.Vector3(hole.halfU, hole.halfV, 0),
    new THREE.Vector3(-hole.halfU, hole.halfV, 0),
  ].map((corner) => corner.add(new THREE.Vector3(hole.u, hole.v, 0)));
  const positions = [];
  const indices = [];
  for (let index = 0; index < 4; index += 1) {
    const a = corners[index];
    const b = corners[(index + 1) % 4];
    const outerA = origin.clone().addScaledVector(u, a.x).addScaledVector(v, a.y);
    const outerB = origin.clone().addScaledVector(u, b.x).addScaledVector(v, b.y);
    const innerA = outerA.clone().addScaledVector(normal, -depth);
    const innerB = outerB.clone().addScaledVector(normal, -depth);
    const base = positions.length / 3;
    positions.push(outerA.x, outerA.y, outerA.z, outerB.x, outerB.y, outerB.z, innerB.x, innerB.y, innerB.z, innerA.x, innerA.y, innerA.z);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function createRim({ group, material, origin, u, v, normal, hole, radius = 0.06 }) {
  const points = [];
  const pointCount = 40;
  for (let index = 0; index < pointCount; index += 1) {
    const angle = (index / pointCount) * TAU;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const roundedU = Math.sign(cosine) * Math.pow(Math.abs(cosine), 0.34) * hole.halfU;
    const roundedV = Math.sign(sine) * Math.pow(Math.abs(sine), 0.34) * hole.halfV;
    points.push(
      origin
        .clone()
        .addScaledVector(u, hole.u + roundedU)
        .addScaledVector(v, hole.v + roundedV)
        .addScaledVector(normal, 0.022),
    );
  }
  const curve = new THREE.CatmullRomCurve3(points, true, "centripetal");
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 72, radius, 8, true), material);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addBox(group, size, position, material, rotation = null) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
  mesh.position.copy(position);
  if (rotation) mesh.rotation.set(rotation.x, rotation.y, rotation.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function createContactShadowTexture() {
  const canvas = makeCanvas(256, 256);
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(128, 128, 8, 128, 128, 126);
  gradient.addColorStop(0, "rgba(22, 12, 7, 0.64)");
  gradient.addColorStop(0.34, "rgba(22, 12, 7, 0.38)");
  gradient.addColorStop(0.72, "rgba(22, 12, 7, 0.12)");
  gradient.addColorStop(1, "rgba(22, 12, 7, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createDocumentedCave({ scene, materials, noise }) {
  const group = new THREE.Group();
  group.name = "Research-led Mogao-type cave interior";
  scene.add(group);

  const wallTexture = createDocumentedWallTexture();
  const wallMaterial = new THREE.MeshStandardMaterial({
    map: wallTexture,
    color: 0xe0c6a0,
    roughness: 0.98,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  wallMaterial.shadowSide = THREE.DoubleSide;
  const ceilingMaterial = wallMaterial.clone();
  ceilingMaterial.color.set(0xb59a78);
  ceilingMaterial.needsUpdate = true;

  const shrineTexture = createShrineTexture();
  const shrineMaterial = new THREE.MeshStandardMaterial({
    map: shrineTexture,
    color: 0xc4a37a,
    roughness: 0.98,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  shrineMaterial.shadowSide = THREE.DoubleSide;

  const floorTextures = createFloorTextures();
  const floorSurfaceMaterial = new THREE.MeshStandardMaterial({
    color: 0xd0a878,
    map: floorTextures.color,
    bumpMap: floorTextures.bump,
    bumpScale: 0.14,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  floorSurfaceMaterial.shadowSide = THREE.DoubleSide;
  floorSurfaceMaterial.emissive.set(0x1b1008);
  floorSurfaceMaterial.emissiveIntensity = 0.22;

  const revealMaterial = new THREE.MeshStandardMaterial({
    color: 0x5b4130,
    map: materials.rockTextures.color,
    bumpMap: materials.rockTextures.bump,
    bumpScale: 0.08,
    roughness: 0.98,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  revealMaterial.shadowSide = THREE.DoubleSide;

  const apertures = [
    {
      id: "east-entry",
      label: "东壁门洞",
      center: new THREE.Vector3(3.42, 2.14, 0.72),
      normal: new THREE.Vector3(1, 0, 0),
      u: new THREE.Vector3(0, 0, -1),
      v: new THREE.Vector3(0, 1, 0),
      half: new THREE.Vector2(0.68, 1.02),
      active: true,
    },
    {
      id: "east-high",
      label: "东壁高窗",
      center: new THREE.Vector3(3.42, 3.38, -1.24),
      normal: new THREE.Vector3(1, 0, 0),
      u: new THREE.Vector3(0, 0, -1),
      v: new THREE.Vector3(0, 1, 0),
      half: new THREE.Vector2(0.38, 0.42),
      active: true,
    },
    {
      id: "roof-light",
      label: "窟顶东侧天光缝",
      center: new THREE.Vector3(2.45, 4.43, -0.8),
      normal: new THREE.Vector3(0, 1, 0),
      u: new THREE.Vector3(1, 0, 0),
      v: new THREE.Vector3(0, 0, 1),
      half: new THREE.Vector2(0.3, 0.58),
      active: true,
    },
    {
      id: "inactive-1",
      label: "未启用",
      center: new THREE.Vector3(0, -20, 0),
      normal: new THREE.Vector3(0, 1, 0),
      u: new THREE.Vector3(1, 0, 0),
      v: new THREE.Vector3(0, 0, 1),
      half: new THREE.Vector2(0, 0),
      active: false,
    },
    {
      id: "inactive-2",
      label: "未启用",
      center: new THREE.Vector3(0, -20, 0),
      normal: new THREE.Vector3(0, 1, 0),
      u: new THREE.Vector3(1, 0, 0),
      v: new THREE.Vector3(0, 0, 1),
      half: new THREE.Vector2(0, 0),
      active: false,
    },
  ];

  const wallOrigin = new THREE.Vector3(0, CAVE.wallCenterY, 0);
  const wallNormal = new THREE.Vector3(0, 0, 1);
  const wallU = new THREE.Vector3(1, 0, 0);
  const wallV = new THREE.Vector3(0, 1, 0);
  createSurface({
    group,
    material: wallMaterial,
    origin: new THREE.Vector3(0, CAVE.wallCenterY, CAVE.backZ),
    u: wallU,
    v: wallV,
    normal: wallNormal,
    width: CAVE.halfWidth * 2,
    height: 4.4,
    segmentsU: 44,
    segmentsV: 30,
    surfaceKind: "wall",
    noise,
  });

  createSurface({
    group,
    material: wallMaterial,
    origin: new THREE.Vector3(-CAVE.halfWidth, CAVE.wallCenterY, -0.05),
    u: new THREE.Vector3(0, 0, 1),
    v: wallV,
    normal: new THREE.Vector3(-1, 0, 0),
    width: CAVE.wallDepth,
    height: 4.4,
    segmentsU: 54,
    segmentsV: 30,
    surfaceKind: "wall",
    noise,
  });

  const eastHoles = [
    { u: -0.72, v: -0.06, halfU: 0.68, halfV: 1.02 },
    { u: 1.24, v: 1.18, halfU: 0.38, halfV: 0.42 },
  ];
  createSurface({
    group,
    material: wallMaterial,
    origin: new THREE.Vector3(CAVE.halfWidth, CAVE.wallCenterY, -0.05),
    u: new THREE.Vector3(0, 0, -1),
    v: wallV,
    normal: new THREE.Vector3(1, 0, 0),
    width: CAVE.wallDepth,
    height: 4.4,
    holes: eastHoles,
    segmentsU: 58,
    segmentsV: 32,
    surfaceKind: "wall",
    noise,
  });
  for (const hole of eastHoles) {
    createReveal({
      group,
      material: revealMaterial,
      origin: new THREE.Vector3(CAVE.halfWidth, CAVE.wallCenterY, -0.05),
      u: new THREE.Vector3(0, 0, -1),
      v: wallV,
      normal: new THREE.Vector3(1, 0, 0),
      hole,
      depth: 0.24,
    });
    createRim({
      group,
      material: materials.darkRockMaterial,
      origin: new THREE.Vector3(CAVE.halfWidth, CAVE.wallCenterY, -0.05),
      u: new THREE.Vector3(0, 0, -1),
      v: wallV,
      normal: new THREE.Vector3(1, 0, 0),
      hole,
      radius: 0.065,
    });
  }

  const roofHole = { u: 2.45, v: -0.75, halfU: 0.55, halfV: 0.75 };
  createSurface({
    group,
    material: ceilingMaterial,
    origin: new THREE.Vector3(0, CAVE.wallTop, -0.05),
    u: new THREE.Vector3(1, 0, 0),
    v: new THREE.Vector3(0, 0, 1),
    normal: new THREE.Vector3(0, 1, 0),
    width: CAVE.halfWidth * 2,
    height: CAVE.wallDepth,
    holes: [roofHole],
    segmentsU: 42,
    segmentsV: 58,
    surfaceKind: "ceiling",
    noise,
  });
  createReveal({
    group,
    material: revealMaterial,
    origin: new THREE.Vector3(0, CAVE.wallTop, -0.05),
    u: new THREE.Vector3(1, 0, 0),
    v: new THREE.Vector3(0, 0, 1),
    normal: new THREE.Vector3(0, 1, 0),
    hole: roofHole,
    depth: 0.18,
  });
  createRim({
    group,
    material: materials.darkRockMaterial,
    origin: new THREE.Vector3(0, CAVE.wallTop, -0.05),
    u: new THREE.Vector3(1, 0, 0),
    v: new THREE.Vector3(0, 0, 1),
    normal: new THREE.Vector3(0, 1, 0),
    hole: roofHole,
    radius: 0.055,
  });

  createSurface({
    group,
    material: floorSurfaceMaterial,
    origin: new THREE.Vector3(0, 0, -0.05),
    u: new THREE.Vector3(1, 0, 0),
    v: new THREE.Vector3(0, 0, 1),
    normal: new THREE.Vector3(0, 1, 0),
    width: CAVE.halfWidth * 2 + 0.28,
    height: CAVE.wallDepth + 0.28,
    segmentsU: 42,
    segmentsV: 58,
    surfaceKind: "floor",
    noise,
  });

  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.35, 1.65),
    new THREE.MeshBasicMaterial({
      map: createContactShadowTexture(),
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.set(0.75, 0.018, -3.95);
  contactShadow.renderOrder = 1;
  group.add(contactShadow);

  for (const side of [-1, 1]) {
    const returnWall = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 2.92, 22, 34), materials.nicheMaterial);
    returnWall.position.set(side * 2.98, 2.1, CAVE.backZ + 0.62);
    returnWall.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    returnWall.castShadow = true;
    returnWall.receiveShadow = true;
    group.add(returnWall);
  }
  addBox(group, new THREE.Vector3(6.45, 0.12, 0.18), new THREE.Vector3(0, 4.06, CAVE.backZ + 0.12), materials.columnMaterial);
  addBox(group, new THREE.Vector3(0.22, 4.0, 0.22), new THREE.Vector3(-3.3, 2.05, CAVE.backZ + 0.18), materials.columnMaterial);
  addBox(group, new THREE.Vector3(0.22, 4.0, 0.22), new THREE.Vector3(3.3, 2.05, CAVE.backZ + 0.18), materials.columnMaterial);
  addBox(group, new THREE.Vector3(1.7, 0.08, 0.28), new THREE.Vector3(0, 0.04, 4.22), materials.rockMaterial);

  for (const z of [-2.65, 0.35, 2.85]) {
    addBox(group, new THREE.Vector3(0.1, 2.45, 0.12), new THREE.Vector3(-3.32, 2.1, z), materials.columnMaterial);
    addBox(group, new THREE.Vector3(0.1, 2.45, 0.12), new THREE.Vector3(3.32, 2.1, z), materials.columnMaterial);
  }

  addBox(group, new THREE.Vector3(0.11, 2.3, 0.08), new THREE.Vector3(-1.46, 2.15, CAVE.backZ + 0.12), materials.columnMaterial);
  addBox(group, new THREE.Vector3(0.11, 2.3, 0.08), new THREE.Vector3(2.96, 2.15, CAVE.backZ + 0.12), materials.columnMaterial);
  for (const z of [-2.8, -0.6, 1.6, 3.55]) {
    addBox(group, new THREE.Vector3(6.35, 0.055, 0.075), new THREE.Vector3(0, 4.37, z), materials.darkRockMaterial);
  }

  return {
    group,
    apertures,
    bounds: CAVE,
    shrineMaterial,
    wallMaterial,
  };
}

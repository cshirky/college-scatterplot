import * as d3 from "../../_npm/d3@7.9.0/080cf928.js";
import * as THREE from "../../_npm/three@0.186.1/ba7446bd.js";
import {OrbitControls} from "../../_npm/three@0.186.1/examples/jsm/controls/OrbitControls.js.f8e609f2.js";
import {STEP, cellShade, buildCells, cellHtml, addCellToTray, makeTip} from "./cells.dceb64b7.js";

const PUBLIC = "#d50000", PRIVATE = "#1d4ed8";
const W = 860, H = 640;
const FOV = 30;

// The starting angle is the old isometric one: near corner high-yield / high-grad.
const DEFAULT_VIEW = {azimuth: Math.PI / 4, polar: Math.acos(1 / Math.sqrt(3)), zoom: 1};
// Kept across re-renders so changing a filter doesn't snap the camera back.
let savedView = {...DEFAULT_VIEW};

function textTexture(text, {color = "#555", weight = 400, halo = false} = {}) {
  const px = 48, pad = 10;
  const font = `${weight} ${px}px sans-serif`;
  const canvas = document.createElement("canvas");
  const measure = canvas.getContext("2d");
  measure.font = font;
  canvas.width = Math.ceil(measure.measureText(text).width) + pad * 2;
  canvas.height = px + pad * 2;
  const ctx = canvas.getContext("2d");
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (halo) {
    ctx.lineWidth = 9; ctx.lineJoin = "round"; ctx.strokeStyle = "white";
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return {map, aspect: canvas.width / canvas.height};
}

// Camera-facing text. `height` is in world units (one grid square = 1).
function textSprite(text, {height, onTop = false, ...style} = {}) {
  const {map, aspect} = textTexture(text, style);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map, transparent: true, depthTest: !onTop}));
  sprite.scale.set(height * aspect, height, 1);
  if (onTop) sprite.renderOrder = 10;
  return sprite;
}

// Text lying flat on the floor, for the axis titles.
function floorText(text, {height, ...style} = {}) {
  const {map, aspect} = textTexture(text, style);
  return new THREE.Mesh(
    new THREE.PlaneGeometry(height * aspect, height),
    new THREE.MeshBasicMaterial({map, transparent: true, side: THREE.DoubleSide}),
  );
}

// Top face of a prism: the sector color with the school count painted on it.
function topTexture(fill, n) {
  const S = 96;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = "white";
  ctx.font = `600 ${n > 99 ? 38 : 46}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(n, S / 2, S / 2 + 2);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.center.set(0.5, 0.5);
  return map;
}

function floorTexture(gradBins, yieldBins) {
  const S = 48;
  const canvas = document.createElement("canvas");
  canvas.width = gradBins.length * S;
  canvas.height = yieldBins.length * S;
  const ctx = canvas.getContext("2d");
  ctx.strokeStyle = "#d4d4d8";
  ctx.lineWidth = 1.5;
  for (const [v, y1] of yieldBins.entries()) for (const [u, g1] of gradBins.entries()) {
    ctx.fillStyle = cellShade(g1, y1);
    ctx.fillRect(u * S, v * S, S, S);
    ctx.strokeRect(u * S, v * S, S, S);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return map;
}

// 3D version: each 5x5 grid square gets a prism whose height is the number of schools.
// World axes: x = grad column, z = yield row, y = height. Drag to orbit; ctrl/cmd + wheel to zoom.
// Pass the cell's `invalidation` promise so the WebGL context is released on re-render.
export function plot3d({data, query, yieldFloor, gradFloor, cardArea, programsByUnitid, invalidation}) {
  const {gradBins, yieldBins, grid, cellOf, maxCount} = buildCells(data, yieldFloor, gradFloor);
  const nG = gradBins.length, nY = yieldBins.length;
  const maxH = 0.45 * (nG + nY);
  const X = u => u - nG / 2, Z = v => v - nY / 2;
  const heightOf = n => (n / maxCount) * maxH;

  const wrapper = document.createElement("div");
  wrapper.style.cssText = `position:relative; display:inline-block; width:${W}px; max-width:100%;`;
  const tip = makeTip();

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
  } catch {
    wrapper.textContent = "This view needs WebGL, which isn't available in this browser.";
    return wrapper;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W, H, false);
  const canvas = renderer.domElement;
  canvas.style.cssText = `display:block; width:100%; height:auto; aspect-ratio:${W}/${H}; cursor:grab; touch-action:none;`;

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(1, 2, 0.35);
  scene.add(sun);

  // Floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(nG, nY),
    new THREE.MeshBasicMaterial({map: floorTexture(gradBins, yieldBins), side: THREE.DoubleSide}),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // Axis ticks along the two edges that start nearest the camera
  for (let u = 0; u <= nG; u++) {
    const t = textSprite(gradFloor + u * STEP + "%", {height: 0.66});
    t.position.set(X(u), 0, nY / 2 + 0.9);
    scene.add(t);
  }
  for (let v = 0; v <= nY; v++) {
    const t = textSprite(yieldFloor + v * STEP + "%", {height: 0.66});
    t.position.set(nG / 2 + 0.9, 0, Z(v));
    scene.add(t);
  }
  const gradTitle = floorText("6-year graduation rate", {height: 0.85});
  gradTitle.position.set(0, 0, nY / 2 + 2.3);
  const yieldTitle = floorText("Yield (admitted students who chose to attend)", {height: 0.85});
  yieldTitle.position.set(nG / 2 + 2.3, 0, 0);
  scene.add(gradTitle, yieldTitle);

  // Prisms
  const color = d3.interpolateRgb(PRIVATE, PUBLIC);
  const box = new THREE.BoxGeometry(0.92, 1, 0.92).translate(0, 0.5, 0);
  const boxEdges = new THREE.EdgesGeometry(box);
  const edgeMaterial = new THREE.LineBasicMaterial({color: 0x000000, transparent: true, opacity: 0.3});
  const prisms = [];
  const topMaps = [];
  for (let v = 0; v < nY; v++) for (let u = 0; u < nG; u++) {
    const schools = grid[v][u];
    if (!schools.length) continue;
    const n = schools.length;
    const share = schools.filter(d => d.sector_label === "Public").length / n;
    const fill = color(share);
    const side = new THREE.MeshLambertMaterial({color: fill});
    const map = topTexture(fill, n);
    topMaps.push(map);
    const top = new THREE.MeshBasicMaterial({map});
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z
    const mesh = new THREE.Mesh(box, [side, side, top, side, side, side]);
    mesh.position.set(X(u + 0.5), 0, Z(v + 0.5));
    mesh.scale.y = heightOf(n);
    mesh.add(new THREE.LineSegments(boxEdges, edgeMaterial));
    mesh.userData = {u, v, schools, side};
    prisms.push(mesh);
    scene.add(mesh);
  }

  // Outline drawn over whichever prism is hovered
  const outline = new THREE.LineSegments(boxEdges, new THREE.LineBasicMaterial({color: 0x111111}));
  outline.visible = false;
  scene.add(outline);

  // Search matches: a pin standing on the school's prism, always drawn over the scene
  if (query) {
    const pinMaterial = new THREE.MeshBasicMaterial({color: "#16a34a", depthTest: false});
    const seen = new Map();
    for (const d of data) {
      if (!d.INSTNM.toLowerCase().includes(query) || !cellOf.has(d)) continue;
      const [u, v] = cellOf.get(d);
      const k = `${u}|${v}`;
      const i = seen.get(k) || 0;
      seen.set(k, i + 1);
      const h = heightOf(grid[v][u].length);
      if (i === 0) {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.1), pinMaterial);
        stem.position.set(X(u + 0.5), h + 0.55, Z(v + 0.5));
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), pinMaterial);
        head.position.set(X(u + 0.5), h + 1.1, Z(v + 0.5));
        stem.renderOrder = head.renderOrder = 9;
        scene.add(stem, head);
      }
      const label = textSprite(d.INSTNM, {height: 0.62, color: "#111", weight: 600, halo: true, onTop: true});
      label.position.set(X(u + 0.5), h + 1.65 + i * 0.6, Z(v + 0.5));
      scene.add(label);
    }
  }

  // Camera
  const camera = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 500);
  const target = new THREE.Vector3(0, maxH * 0.32, 0);
  const radius = 0.5 * Math.hypot(nG + 4, nY + 4, maxH);
  const baseDistance = 0.92 * radius / Math.sin(THREE.MathUtils.degToRad(FOV / 2));
  const setView = ({azimuth, polar, zoom}) => {
    camera.position.setFromSphericalCoords(baseDistance / zoom, polar, azimuth).add(target);
    camera.lookAt(target);
  };
  setView(savedView);

  // OrbitControls would otherwise swallow every scroll over the chart, so zoom needs ctrl/cmd.
  canvas.addEventListener("wheel", evt => { controls.enableZoom = evt.ctrlKey || evt.metaKey; }, {capture: true});
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.minDistance = baseDistance * 0.35;
  controls.maxDistance = baseDistance * 1.6;
  controls.maxPolarAngle = THREE.MathUtils.degToRad(88);  // stay above the floor
  controls.update();

  let frame = 0;
  const render = () => {
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; renderer.render(scene, camera); });
  };

  // Turn the counts on the prism tops and the axis titles on the floor so they read
  // upright from whichever side the camera is on.
  let quadrant = null;
  const faceLabels = () => {
    const azimuth = controls.getAzimuthalAngle();
    gradTitle.rotation.set(-Math.PI / 2, 0, Math.cos(azimuth) < 0 ? Math.PI : 0);
    yieldTitle.rotation.set(-Math.PI / 2, 0, Math.PI / 2 + (Math.sin(azimuth) < 0 ? Math.PI : 0));
    const q = Math.round(azimuth / (Math.PI / 2) - 0.5);
    if (q === quadrant) return;
    quadrant = q;
    for (const map of topMaps) map.rotation = q * Math.PI / 2;
  };
  faceLabels();

  controls.addEventListener("change", () => {
    savedView = {
      azimuth: controls.getAzimuthalAngle(),
      polar: controls.getPolarAngle(),
      zoom: baseDistance / controls.getDistance(),
    };
    faceLabels();
    render();
  });

  // Hover and click. A press that moves is a drag, not a click.
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered = null, down = null;
  const pick = evt => {
    const r = canvas.getBoundingClientRect();
    pointer.set(((evt.clientX - r.left) / r.width) * 2 - 1, -((evt.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(prisms, false)[0]?.object ?? null;
  };
  const setHovered = mesh => {
    if (mesh === hovered) return;
    if (hovered) hovered.userData.side.emissive.set(0x000000);
    hovered = mesh;
    outline.visible = !!mesh;
    if (mesh) {
      mesh.userData.side.emissive.set(0x2a2a2a);
      outline.position.copy(mesh.position);
      outline.scale.copy(mesh.scale);
    }
    canvas.style.cursor = mesh ? "pointer" : "grab";
    render();
  };
  canvas.addEventListener("pointerdown", evt => { down = [evt.clientX, evt.clientY]; });
  canvas.addEventListener("pointermove", evt => {
    if (evt.buttons) { tip.hide(); return; }
    const mesh = pick(evt);
    setHovered(mesh);
    if (mesh) {
      const {schools, u, v} = mesh.userData;
      tip.show(cellHtml(schools, gradBins[u], yieldBins[v]), evt, wrapper);
    } else tip.hide();
  });
  canvas.addEventListener("pointerup", evt => {
    const moved = down ? Math.hypot(evt.clientX - down[0], evt.clientY - down[1]) : Infinity;
    down = null;
    if (moved > 4) return;
    const mesh = pick(evt);
    if (mesh) addCellToTray(cardArea, mesh.userData.schools, programsByUnitid);
  });
  canvas.addEventListener("pointerleave", () => { setHovered(null); tip.hide(); });

  // Legend, hint and reset button sit over the canvas as plain HTML
  const legend = document.createElement("div");
  legend.style.cssText = "position:absolute; left:16px; top:10px; font:10px sans-serif; color:#888; line-height:1.4; pointer-events:none;";
  legend.innerHTML = `Prism height = number of schools in the square<br>Tallest here: ${maxCount}
    <div style="width:110px; height:8px; border-radius:2px; margin:6px 0 2px; background:linear-gradient(to right, ${PRIVATE}, ${PUBLIC});"></div>
    <div style="width:110px; display:flex; justify-content:space-between;"><span>all private</span><span>all public</span></div>`;

  const hint = document.createElement("div");
  hint.style.cssText = "position:absolute; left:16px; bottom:8px; font:10px sans-serif; color:#888; pointer-events:none;";
  hint.textContent = "Drag to rotate · Ctrl/⌘ + scroll to zoom";

  const reset = document.createElement("button");
  reset.type = "button";
  reset.textContent = "Reset view";
  reset.style.cssText = "position:absolute; right:12px; top:10px; font:11px sans-serif; padding:0.2rem 0.6rem; border-radius:999px; border:1px solid #93c5fd; background:#dbeafe; color:#1e3a8a; cursor:pointer;";
  reset.addEventListener("click", () => {
    setView(DEFAULT_VIEW);
    controls.update();
    savedView = {...DEFAULT_VIEW};
    faceLabels();
    render();
  });

  invalidation?.then(() => {
    cancelAnimationFrame(frame);
    controls.dispose();
    scene.traverse(obj => {
      obj.geometry?.dispose();
      for (const m of [obj.material ?? []].flat()) { m.map?.dispose(); m.dispose(); }
    });
    renderer.dispose();
    renderer.forceContextLoss();
  });

  wrapper.append(canvas, legend, hint, reset, tip.el);
  render();
  return wrapper;
}

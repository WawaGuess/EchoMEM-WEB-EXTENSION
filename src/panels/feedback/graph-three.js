// 认知图谱 Three.js 3D 渲染器（基于 graph_higo_ba8f80d0.html 样例风格适配）
// 文档：docs/flows/cognitive-feedback/图谱渲染.md

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// 节点类型样式
const TYPE_STYLES = {
  atom: { color: 0xcc66ff, emissive: 0x6633aa, size: 1.1, opacity: 0.88 },
  entity: { color: 0x00e6ff, emissive: 0x0066aa, size: 2.8, opacity: 0.92 },
  episode: { color: 0xf093fb, emissive: 0xaa33aa, size: 4.0, opacity: 0.95 },
  other: { color: 0x8899aa, emissive: 0x445566, size: 1.5, opacity: 0.7 },
};

// 关系颜色
const REL_COLORS = {
  about: 0x66aaff,
  contains: 0xaa88ff,
};

/**
 * 创建文字标签 Sprite
 */
function createLabel(text, color) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 512;
  canvas.height = 64;

  ctx.font = 'bold 26px "JetBrains Mono", "PingFang SC", "Microsoft YaHei", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e8f4ff';
  ctx.shadowColor = '#' + new THREE.Color(color).getHexString();
  ctx.shadowBlur = 12;
  ctx.fillText(text, 256, 32);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(7, 0.9, 1);
  return sprite;
}

/**
 * 创建单个 3D 节点
 */
function createNodeMesh(nodeData, style) {
  const geometry = new THREE.SphereGeometry(style.size, 32, 32);
  const material = new THREE.MeshPhysicalMaterial({
    color: style.color,
    emissive: style.emissive,
    emissiveIntensity: 0.4,
    metalness: 0.7,
    roughness: 0.15,
    transparent: true,
    opacity: style.opacity,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
  });

  const mesh = new THREE.Mesh(geometry, material);

  // 内核发光
  const coreGeo = new THREE.SphereGeometry(style.size * 0.5, 16, 16);
  const coreMat = new THREE.MeshBasicMaterial({
    color: style.color,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  mesh.add(core);

  // 外层光晕
  const haloGeo = new THREE.SphereGeometry(style.size * 2.0, 16, 16);
  const haloMat = new THREE.MeshBasicMaterial({
    color: style.color,
    transparent: true,
    opacity: 0.04,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  mesh.add(halo);

  // 静态装饰环
  const ringGeo = new THREE.TorusGeometry(style.size * 1.5, 0.03, 8, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: style.color,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  mesh.add(ring);

  // 文字标签
  const label = createLabel(nodeData.label, style.color);
  label.position.y = style.size * 2.8;
  mesh.add(label);

  mesh.userData = {
    node_id: nodeData.node_id,
    label: nodeData.label,
    node_type: nodeData.node_type,
    originalScale: style.size,
    glowMesh: halo,
    coreMesh: core,
    style,
  };

  return mesh;
}

/**
 * 创建曲边
 */
function createEdgeMesh(sourceMesh, targetMesh, edgeData, edgeColor) {
  const start = sourceMesh.position.clone();
  const end = targetMesh.position.clone();
  const mid = start.clone().add(end).multiplyScalar(0.5);
  mid.y += 2 + Math.random() * 2;

  const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
  const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.09, 10, false);
  const tubeMat = new THREE.MeshPhysicalMaterial({
    color: edgeColor,
    emissive: edgeColor,
    emissiveIntensity: 0.7,
    transparent: true,
    opacity: 0.6,
    metalness: 0.9,
    roughness: 0.1,
  });
  const tube = new THREE.Mesh(tubeGeo, tubeMat);
  tube.userData = {
    edge: edgeData,
    sourceNode: sourceMesh,
    targetNode: targetMesh,
    curve,
  };
  return tube;
}

/**
 * 创建星空背景
 */
function createStarfield() {
  const starGeo = new THREE.BufferGeometry();
  const starCount = 5000;
  const starPos = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 600;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 600;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 600;
    starSizes[i] = Math.random() * 2 + 0.5;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

  const starMat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      color: { value: new THREE.Color(0x88ccff) },
    },
    vertexShader: `
      attribute float size;
      varying float vAlpha;
      uniform float time;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (200.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
        float twinkle = sin(time * 2.0 + position.x * 0.01) * 0.3 + 0.7;
        vAlpha = twinkle;
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      varying float vAlpha;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = smoothstep(0.5, 0.0, dist) * vAlpha;
        gl_FragColor = vec4(color, alpha * 0.8);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const stars = new THREE.Points(starGeo, starMat);
  stars.userData = { isStarfield: true, material: starMat };
  return stars;
}

/**
 * 创建网格地板
 */
function createGridFloor() {
  const size = 200;
  const divisions = 40;
  const gridHelper = new THREE.GridHelper(size, divisions, 0x00aaff, 0x001133);
  gridHelper.position.y = -40;
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.15;

  const planeGeo = new THREE.PlaneGeometry(size, size);
  const planeMat = new THREE.MeshBasicMaterial({
    color: 0x001122,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -40.1;

  const group = new THREE.Group();
  group.add(gridHelper);
  group.add(plane);
  return group;
}

/**
 * 创建面板 UI（图例、统计、详情）
 */
function createPanels(container) {
  const panelCss = `
    position: absolute;
    background: rgba(2, 8, 20, 0.88);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(0, 230, 255, 0.15);
    color: #e0f0ff;
    font-family: "JetBrains Mono", "PingFang SC", "Microsoft YaHei", monospace;
    z-index: 10;
    pointer-events: auto;
  `;

  const legend = document.createElement('div');
  legend.style.cssText = panelCss + `
    top: 16px; left: 16px;
    padding: 14px 18px;
    font-size: 12px;
    min-width: 140px;
  `;
  legend.innerHTML = `
    <h3 style="margin:0 0 10px;font-size:11px;color:#00e6ff;letter-spacing:2px;text-transform:uppercase;">// Node Types</h3>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><span style="width:10px;height:10px;border-radius:50%;background:#00e6ff;box-shadow:0 0 8px #00e6ff;"></span><span>Entity (实体)</span></div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><span style="width:10px;height:10px;border-radius:50%;background:#cc66ff;box-shadow:0 0 8px #cc66ff;"></span><span>Atom (原子记忆)</span></div>
    <div style="display:flex;align-items:center;gap:8px;"><span style="width:10px;height:10px;border-radius:50%;background:#8899aa;box-shadow:0 0 8px #8899aa;"></span><span>Other (其他)</span></div>
  `;

  const stats = document.createElement('div');
  stats.style.cssText = panelCss + `
    top: 16px; right: 16px;
    padding: 14px 18px;
    font-size: 12px;
    min-width: 140px;
  `;
  stats.innerHTML = `
    <h3 style="margin:0 0 10px;font-size:11px;color:#00e6ff;letter-spacing:2px;text-transform:uppercase;">// Memory Graph</h3>
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Nodes</span><span style="color:#00e6ff;font-weight:700;" data-stat="nodes">0</span></div>
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Edges</span><span style="color:#00e6ff;font-weight:700;" data-stat="edges">0</span></div>
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Entities</span><span style="color:#00e6ff;font-weight:700;" data-stat="entities">0</span></div>
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Atoms</span><span style="color:#00e6ff;font-weight:700;" data-stat="atoms">0</span></div>
    <div style="display:flex;justify-content:space-between;"><span>Other</span><span style="color:#00e6ff;font-weight:700;" data-stat="other">0</span></div>
  `;

  const info = document.createElement('div');
  info.style.cssText = panelCss + `
    top: 56px; right: 16px;
    width: 320px;
    max-height: 60vh;
    padding: 18px 22px;
    overflow-y: auto;
    transform: translateX(calc(100% + 32px));
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  `;
  info.innerHTML = `
    <button class="echomem-info-close" style="position:absolute;top:12px;right:12px;width:24px;height:24px;background:rgba(0,230,255,0.08);border:1px solid rgba(0,230,255,0.2);color:#00e6ff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;">&times;</button>
    <h2 style="margin:0 0 14px;font-size:15px;color:#00e6ff;letter-spacing:2px;text-transform:uppercase;">Node Details</h2>
    <div class="echomem-info-content" style="font-size:12px;line-height:1.6;color:#cceeff;"></div>
  `;

  container.appendChild(legend);
  container.appendChild(stats);
  container.appendChild(info);

  return { legend, stats, info, closeBtn: info.querySelector('.echomem-info-close') };
}

function updateStats(statsPanel, nodes, edges) {
  const entityCount = nodes.filter((n) => n.userData.node_type === 'entity').length;
  const atomCount = nodes.filter((n) => n.userData.node_type === 'atom').length;
  const otherCount = nodes.filter((n) => n.userData.node_type === 'other').length;
  statsPanel.querySelector('[data-stat="nodes"]').textContent = nodes.length;
  statsPanel.querySelector('[data-stat="edges"]').textContent = edges.length;
  statsPanel.querySelector('[data-stat="entities"]').textContent = entityCount;
  statsPanel.querySelector('[data-stat="atoms"]').textContent = atomCount;
  statsPanel.querySelector('[data-stat="other"]').textContent = otherCount;
}

/**
 * 力导向布局
 */
function runForceLayout(nodeObjects, edgeObjects, iterations = 200) {
  const velocities = nodeObjects.map(() => new THREE.Vector3());
  const K = 100;
  const SPRING_LEN = 14;
  const DAMPING = 0.88;
  const CENTER_PULL = 0.006;

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < nodeObjects.length; i++) {
      for (let j = i + 1; j < nodeObjects.length; j++) {
        const diff = nodeObjects[i].position.clone().sub(nodeObjects[j].position);
        let dist = diff.length();
        if (dist < 0.1) dist = 0.1;
        const force = diff.normalize().multiplyScalar(K / (dist * dist));
        velocities[i].add(force);
        velocities[j].sub(force);
      }
    }

    edgeObjects.forEach((edge) => {
      const src = edge.userData.sourceNode;
      const tgt = edge.userData.targetNode;
      const diff = tgt.position.clone().sub(src.position);
      const dist = diff.length();
      const force = diff.normalize().multiplyScalar((dist - SPRING_LEN) * 0.012);
      const srcIdx = nodeObjects.indexOf(src);
      const tgtIdx = nodeObjects.indexOf(tgt);
      if (srcIdx >= 0) velocities[srcIdx].add(force);
      if (tgtIdx >= 0) velocities[tgtIdx].sub(force);
    });

    nodeObjects.forEach((node, i) => {
      velocities[i].sub(node.position.clone().multiplyScalar(CENTER_PULL));
      velocities[i].multiplyScalar(DAMPING);
      node.position.add(velocities[i]);
    });
  }
}

/**
 * 重绘曲边
 */
function updateEdgeGeometry(edgeObjects) {
  edgeObjects.forEach((edge) => {
    const src = edge.userData.sourceNode;
    const tgt = edge.userData.targetNode;
    const start = src.position.clone();
    const end = tgt.position.clone();
    const mid = start.clone().add(end).multiplyScalar(0.5);
    mid.y += 2;

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    edge.userData.curve = curve;
    edge.geometry.dispose();
    edge.geometry = new THREE.TubeGeometry(curve, 32, 0.09, 10, false);
  });
}

/**
 * 初始化并渲染 3D 认知图谱
 */
export function renderThreeGraph(container, graphData, options = {}) {
  cleanupThreeGraph(container);
  container.innerHTML = '';
  container.style.position = 'relative';

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 600;

  // 场景
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000510, 0.006);

  // 相机
  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
  camera.position.set(0, 25, 45);

  // 渲染器
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  container.appendChild(renderer.domElement);

  // 控制器
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.zoomSpeed = 2.0;
  controls.rotateSpeed = 0.8;
  controls.panSpeed = 1.2;
  controls.minDistance = 3;
  controls.maxDistance = 200;
  controls.target.set(0, 0, 0);

  // 灯光
  const ambientLight = new THREE.AmbientLight(0x101830, 0.6);
  scene.add(ambientLight);

  const pointLight1 = new THREE.PointLight(0x00aaff, 3, 150);
  pointLight1.position.set(30, 40, 30);
  scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(0xff0066, 2, 150);
  pointLight2.position.set(-30, -20, 40);
  scene.add(pointLight2);

  const pointLight3 = new THREE.PointLight(0x00ffaa, 1.5, 150);
  pointLight3.position.set(0, -40, -30);
  scene.add(pointLight3);

  // 背景与地板
  const stars = createStarfield();
  scene.add(stars);
  scene.add(createGridFloor());

  // 构建节点
  const nodesById = {};
  const nodeObjects = [];
  const totalNodes = graphData.nodes.length;
  graphData.nodes.forEach((n, i) => {
    const category = graphData.categories[n.category];
    const nodeType = category?.name || 'atom';
    const style = TYPE_STYLES[nodeType] || TYPE_STYLES.atom;

    const nodeData = {
      node_id: n.id,
      label: n.name,
      node_type: nodeType,
    };
    const mesh = createNodeMesh(nodeData, style);

    // 初始斐波那契球面分布
    const phi = Math.acos(-1 + (2 * i) / Math.max(totalNodes, 1));
    const theta = Math.sqrt(Math.max(totalNodes, 1) * Math.PI) * phi;
    const radius = 20 + Math.random() * 10;
    mesh.position.set(
      radius * Math.cos(theta) * Math.sin(phi),
      radius * Math.sin(theta) * Math.sin(phi),
      radius * Math.cos(phi)
    );

    scene.add(mesh);
    nodeObjects.push(mesh);
    nodesById[n.id] = mesh;
  });

  // 构建边
  const edgeObjects = [];
  graphData.links.forEach((link) => {
    const src = nodesById[link.source];
    const tgt = nodesById[link.target];
    if (!src || !tgt) return;

    const edgeColor = REL_COLORS[link.name] || 0x6688cc;
    const edgeData = {
      source: link.source,
      target: link.target,
      rel_type: link.name,
      source_label: src.userData.label,
      target_label: tgt.userData.label,
    };
    const edge = createEdgeMesh(src, tgt, edgeData, edgeColor);
    scene.add(edge);
    edgeObjects.push(edge);
  });

  // 力导向布局 + 重绘边
  runForceLayout(nodeObjects, edgeObjects);
  updateEdgeGeometry(edgeObjects);

  // 相机目标与位置
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  nodeObjects.forEach((node) => {
    const r = node.userData.originalScale;
    minX = Math.min(minX, node.position.x - r);
    minY = Math.min(minY, node.position.y - r);
    minZ = Math.min(minZ, node.position.z - r);
    maxX = Math.max(maxX, node.position.x + r);
    maxY = Math.max(maxY, node.position.y + r);
    maxZ = Math.max(maxZ, node.position.z + r);
  });
  const center = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
  controls.target.copy(center);
  camera.position.set(center.x + 30, center.y + 20, center.z + 45);
  controls.update();

  // UI 面板
  const panels = createPanels(container);
  updateStats(panels.stats, nodeObjects, edgeObjects);

  // Tooltip
  let tooltip = container.querySelector('.echomem-graph-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'echomem-graph-tooltip';
    tooltip.style.cssText = `
      position: fixed;
      pointer-events: none;
      padding: 8px 12px;
      background: rgba(2, 8, 20, 0.92);
      border: 1px solid rgba(0, 230, 255, 0.3);
      border-radius: 6px;
      color: #e0f0ff;
      font-size: 12px;
      font-family: "JetBrains Mono", "PingFang SC", "Microsoft YaHei", monospace;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.15s ease;
      backdrop-filter: blur(8px);
    `;
    document.body.appendChild(tooltip);
  }

  // 交互
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hoveredNode = null;
  let selectedNode = null;

  function resetHighlights() {
    nodeObjects.forEach((n) => {
      const style = n.userData.style;
      n.material.emissiveIntensity = 0.4;
      n.material.opacity = style.opacity;
      n.userData.glowMesh.material.opacity = 0.04;
      n.userData.coreMesh.material.opacity = 0.6;
    });
    edgeObjects.forEach((edge) => {
      edge.material.opacity = 0.4;
      edge.material.emissiveIntensity = 0.5;
    });
  }

  function selectNode(node) {
    selectedNode = node;

    nodeObjects.forEach((n) => {
      n.material.emissiveIntensity = 0.4;
      n.userData.glowMesh.material.opacity = 0.04;
      n.userData.coreMesh.material.opacity = 0.6;
    });
    node.material.emissiveIntensity = 1.0;
    node.userData.glowMesh.material.opacity = 0.15;
    node.userData.coreMesh.material.opacity = 1.0;

    edgeObjects.forEach((edge) => {
      const e = edge.userData.edge;
      const isConnected = e.source === node.userData.node_id || e.target === node.userData.node_id;
      edge.material.opacity = isConnected ? 0.9 : 0.08;
      edge.material.emissiveIntensity = isConnected ? 1.0 : 0.2;
    });

    nodeObjects.forEach((n) => {
      if (n !== node) {
        const isConnected = edgeObjects.some((e) =>
          (e.userData.edge.source === node.userData.node_id && e.userData.edge.target === n.userData.node_id) ||
          (e.userData.edge.target === node.userData.node_id && e.userData.edge.source === n.userData.node_id)
        );
        n.material.opacity = isConnected ? 0.75 : 0.12;
      }
    });

    const data = node.userData;
    const typeColor = TYPE_STYLES[data.node_type]?.color || 0xaaccff;
    const hexColor = '#' + new THREE.Color(typeColor).getHexString();

    let html = '';
    html += `<div style="margin-bottom:10px;"><div style="color:#6688aa;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Type</div><div><span style="display:inline-block;padding:2px 8px;background:rgba(0,230,255,0.1);border:1px solid ${hexColor};border-radius:2px;color:${hexColor};font-size:11px;">${data.node_type.toUpperCase()}</span></div></div>`;
    html += `<div style="margin-bottom:10px;"><div style="color:#6688aa;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Node ID</div><div style="font-size:11px;word-break:break-all;">${data.node_id}</div></div>`;
    html += `<div style="margin-bottom:10px;"><div style="color:#6688aa;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Label</div><div style="color:#e0f0ff;">${data.label}</div></div>`;

    const connected = edgeObjects.filter(
      (e) => e.userData.edge.source === data.node_id || e.userData.edge.target === data.node_id
    );
    if (connected.length > 0) {
      html += `<div style="margin-bottom:6px;color:#6688aa;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Relationships (${connected.length})</div>`;
      connected.forEach((e) => {
        const edge = e.userData.edge;
        const isSource = edge.source === data.node_id;
        const other = isSource ? edge.target_label : edge.source_label;
        const arrow = isSource ? '→' : '←';
        html += `<div style="margin-bottom:6px;padding:8px 10px;background:rgba(0,150,255,0.05);border-radius:4px;border-left:2px solid ${hexColor};font-size:11px;"><span style="color:#00aacc;text-transform:uppercase;letter-spacing:1px;">${edge.rel_type}</span> <span style="color:#6688cc;">${arrow}</span> ${other}</div>`;
      });
    }

    panels.info.querySelector('.echomem-info-content').innerHTML = html;
    panels.info.style.transform = 'translateX(0)';
  }

  function closeInfoPanel() {
    selectedNode = null;
    panels.info.style.transform = 'translateX(calc(100% + 32px))';
    resetHighlights();
  }

  // 双击聚焦节点（与样例一致）
  let cameraAnimation = null;

  function focusOnNode(node) {
    const targetPos = node.position.clone();
    const offset = new THREE.Vector3(8, 6, 12);
    const endPos = targetPos.clone().add(offset);

    cameraAnimation = {
      startTime: performance.now(),
      duration: 1200,
      startPos: camera.position.clone(),
      endPos,
      startTarget: controls.target.clone(),
      endTarget: targetPos.clone(),
    };
  }

  const initialFocusNode = options.focusNodeId ? nodesById[options.focusNodeId] : null;
  if (initialFocusNode) {
    selectNode(initialFocusNode);
    focusOnNode(initialFocusNode);
  }

  function updateCameraAnimation(time) {
    if (!cameraAnimation) return;

    const elapsed = time - cameraAnimation.startTime;
    const progress = Math.min(elapsed / cameraAnimation.duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);

    camera.position.lerpVectors(cameraAnimation.startPos, cameraAnimation.endPos, eased);
    controls.target.lerpVectors(cameraAnimation.startTarget, cameraAnimation.endTarget, eased);

    if (progress >= 1) {
      cameraAnimation = null;
    }
  }

  panels.closeBtn.addEventListener('click', closeInfoPanel);

  function onMouseMove(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(nodeObjects);

    if (intersects.length > 0) {
      hoveredNode = intersects[0].object;
      renderer.domElement.style.cursor = 'pointer';
      tooltip.style.left = event.clientX + 14 + 'px';
      tooltip.style.top = event.clientY + 14 + 'px';
      const typeColor = TYPE_STYLES[hoveredNode.userData.node_type]?.color || 0xaaccff;
      const hexColor = '#' + new THREE.Color(typeColor).getHexString();
      tooltip.innerHTML = `<strong style="color:${hexColor};">${hoveredNode.userData.label}</strong><br><span style="color:#6688aa;font-size:10px;letter-spacing:1px;">${hoveredNode.userData.node_type.toUpperCase()}</span>`;
      tooltip.style.opacity = '1';
    } else {
      hoveredNode = null;
      renderer.domElement.style.cursor = 'default';
      tooltip.style.opacity = '0';
    }
  }

  function onClick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(nodeObjects);

    if (intersects.length > 0) {
      selectNode(intersects[0].object);
    } else if (!panels.info.contains(event.target)) {
      closeInfoPanel();
    }
  }

  function onDoubleClick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(nodeObjects);

    if (intersects.length > 0) {
      focusOnNode(intersects[0].object);
    }
  }

  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('click', onClick);
  renderer.domElement.addEventListener('dblclick', onDoubleClick);
  renderer.domElement.addEventListener('mouseleave', () => {
    hoveredNode = null;
    tooltip.style.opacity = '0';
  });

  // 动画循环
  let animationId = null;
  function animate() {
    animationId = requestAnimationFrame(animate);
    if (!container.isConnected) {
      cleanupThreeGraph(container);
      return;
    }

    const time = performance.now();
    stars.userData.material.uniforms.time.value = time * 0.001;

    // 悬停光晕脉冲（与样例一致）
    nodeObjects.forEach((n) => {
      const targetScale = hoveredNode === n ? 1 + Math.sin(time * 0.008) * 0.2 : 1;
      n.userData.glowMesh.scale.setScalar(targetScale);
    });

    // 双击聚焦动画
    updateCameraAnimation(time);

    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // Resize 处理
  const resizeHandler = () => {
    if (!container.isConnected) return;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', resizeHandler);

  // 保存引用以便清理
  container._threeScene = scene;
  container._threeCamera = camera;
  container._threeRenderer = renderer;
  container._threeControls = controls;
  container._threeResizeHandler = resizeHandler;
  container._threeAnimationId = animationId;
  container._threeTooltip = tooltip;
  container._threeEventHandlers = { mousemove: onMouseMove, click: onClick, dblclick: onDoubleClick };
}

/**
 * 清理 Three.js 资源
 */
export function cleanupThreeGraph(container) {
  if (!container) return;

  if (container._threeAnimationId) {
    cancelAnimationFrame(container._threeAnimationId);
    container._threeAnimationId = null;
  }

  if (container._threeResizeHandler) {
    window.removeEventListener('resize', container._threeResizeHandler);
    container._threeResizeHandler = null;
  }

  if (container._threeEventHandlers) {
    const renderer = container._threeRenderer;
    if (renderer && renderer.domElement) {
      renderer.domElement.removeEventListener('mousemove', container._threeEventHandlers.mousemove);
      renderer.domElement.removeEventListener('click', container._threeEventHandlers.click);
      renderer.domElement.removeEventListener('dblclick', container._threeEventHandlers.dblclick);
    }
    container._threeEventHandlers = null;
  }

  if (container._threeScene) {
    container._threeScene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((m) => m.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
    container._threeScene = null;
  }

  if (container._threeRenderer) {
    container._threeRenderer.dispose();
    if (container._threeRenderer.domElement && container._threeRenderer.domElement.parentNode === container) {
      container.removeChild(container._threeRenderer.domElement);
    }
    container._threeRenderer = null;
  }

  if (container._threeTooltip && container._threeTooltip.parentNode) {
    container._threeTooltip.parentNode.removeChild(container._threeTooltip);
    container._threeTooltip = null;
  }

  container._threeCamera = null;
  container._threeControls = null;
}

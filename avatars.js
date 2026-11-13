// Grok-Bot-style 3D avatars: one consistent construction (soft body shape, dark glossy visor,
// expressive glowing eyes, antenna) with per-bot shape, accent colour and a holographic role glyph.
import * as THREE from "three";

function rounded(points, r) { // closed polygon with rounded corners
  const s = new THREE.Shape(), n = points.length, P = points.map(p => new THREE.Vector2(...p));
  for (let i = 0; i < n; i++) {
    const a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n];
    const ab = a.clone().sub(b).normalize(), cb = c.clone().sub(b).normalize();
    const p1 = b.clone().addScaledVector(ab, r), p2 = b.clone().addScaledVector(cb, r);
    if (i === 0) s.moveTo(p1.x, p1.y); else s.lineTo(p1.x, p1.y);
    s.quadraticCurveTo(b.x, b.y, p2.x, p2.y);
  }
  s.closePath(); return s;
}
function sparkleShape() {
  const s = new THREE.Shape(), R = .98, k = .36; s.moveTo(0, R);
  [[R, 0], [0, -R], [-R, 0], [0, R]].forEach(([x, y], i) => { const prev = [[0, R], [R, 0], [0, -R], [-R, 0]][i]; s.quadraticCurveTo((prev[0] + x) * k, (prev[1] + y) * k, x, y); });
  return s;
}
function extrude(shape, q) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: .62, bevelEnabled: true, bevelThickness: .2, bevelSize: .16, bevelSegments: q ? 5 : 2, curveSegments: q ? 18 : 8 });
  g.computeBoundingBox(); const c = new THREE.Vector3(); g.boundingBox.getCenter(c); g.translate(-c.x, -c.y, -c.z); g.computeVertexNormals(); return g;
}
// body geometry + where the visor/eyes/antenna go
function body(kind, q) {
  switch (kind) {
    case "wedge": return { g: extrude(rounded([[-.92, -.62], [.92, -.62], [0, .92]], .34), q), face: [0, -.2, .52], visor: [.8, .42], top: .72 };
    case "chip": return { g: extrude(rounded([[-.78, -.72], [.78, -.72], [.78, .72], [-.78, .72]], .34), q), face: [0, -.02, .52], visor: [1.05, .5], top: .86 };
    case "sparkle": return { g: extrude(sparkleShape(), q), face: [0, 0, .52], visor: [.66, .34], top: .9 };
    case "pill": { const g = new THREE.CapsuleGeometry(.56, .42, q ? 10 : 5, q ? 28 : 14); g.scale(1.06, 1, .9); return { g, face: [0, .04, .5], visor: [.86, .44], top: .98 }; }
    default: { // blob: soft, slightly irregular bean
      const g = new THREE.SphereGeometry(.8, q ? 48 : 22, q ? 32 : 16), p = g.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + .06 * Math.sin(v.x * 3.1 + 1.3) * Math.cos(v.y * 2.7) + .05 * Math.sin(v.z * 3.7); v.multiplyScalar(k); v.y *= .92; p.setXYZ(i, v.x, v.y, v.z); }
      g.computeVertexNormals(); return { g, face: [0, -.04, .66], visor: [.92, .46], top: .74 };
    }
  }
}
const GLYPHS = {
  chart: g => { [[-.5, .2], [-.15, -.15], [.2, .35]].forEach(([x, h]) => { g.fillRect(x * 64 + 64 - 9, 96 - (h + .55) * 60, 18, (h + .55) * 60); }); g.fillRect(28, 98, 72, 6); },
  pound: g => { g.font = "700 84px Inter, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("£", 64, 70); },
  megaphone: g => { g.beginPath(); g.moveTo(30, 54); g.lineTo(84, 30); g.lineTo(84, 98); g.lineTo(30, 76); g.closePath(); g.fill(); g.fillRect(22, 52, 12, 26); g.beginPath(); g.arc(94, 64, 14, -1, 1); g.stroke(); },
  mail: g => { g.strokeRect(22, 36, 84, 58); g.beginPath(); g.moveTo(22, 38); g.lineTo(64, 70); g.lineTo(106, 38); g.stroke(); },
  folder: g => { g.beginPath(); g.moveTo(20, 40); g.lineTo(52, 40); g.lineTo(60, 50); g.lineTo(108, 50); g.lineTo(108, 98); g.lineTo(20, 98); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(20, 60); g.lineTo(108, 60); g.stroke(); },
  case: g => { g.strokeRect(20, 46, 88, 54); g.strokeRect(46, 30, 36, 16); g.beginPath(); g.moveTo(20, 68); g.lineTo(108, 68); g.stroke(); },
  code: g => { g.beginPath(); g.moveTo(44, 38); g.lineTo(20, 64); g.lineTo(44, 90); g.moveTo(84, 38); g.lineTo(108, 64); g.lineTo(84, 90); g.moveTo(72, 30); g.lineTo(56, 98); g.stroke(); },
  star: g => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 18 : 44; g.lineTo(64 + Math.cos(a) * r, 66 + Math.sin(a) * r); } g.closePath(); g.fill(); },
  check: g => { g.beginPath(); g.arc(64, 64, 42, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(42, 66); g.lineTo(58, 82); g.lineTo(88, 48); g.stroke(); },
  pulse: g => { g.beginPath(); g.moveTo(14, 66); g.lineTo(42, 66); g.lineTo(52, 40); g.lineTo(66, 94); g.lineTo(78, 56); g.lineTo(86, 66); g.lineTo(114, 66); g.stroke(); },
};
function glyphTexture(name, color) {
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  g.strokeStyle = g.fillStyle = color; g.lineWidth = 9; g.lineCap = g.lineJoin = "round"; g.shadowColor = color; g.shadowBlur = 14;
  g.save(); g.globalAlpha = .9; g.lineWidth = 4; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.stroke(); g.restore();
  g.save(); g.translate(64, 64); g.scale(.62, .62); g.translate(-64, -64); g.strokeStyle = g.fillStyle = "#ffffff"; g.shadowColor = color; (GLYPHS[name] || GLYPHS.star)(g); g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const RIM_VS = `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); vV=-mv.xyz; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*mv; }`;
const RIM_FS = `uniform vec3 uColor; uniform float uI; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.-max(dot(normalize(vN),normalize(vV)),0.),2.6); gl_FragColor=vec4(uColor*f*uI,f*uI); }`;
const VISOR_FS = `uniform vec3 uColor; uniform float uTime; uniform float uI; varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying vec3 vP;
  void main(){ float f=pow(1.-max(dot(normalize(vN),normalize(vV)),0.),2.);
    float scan=.5+.5*sin(vP.y*90.-uTime*4.); float band=smoothstep(.0,.35,vP.y+.05)*smoothstep(.55,.2,vP.y+.05);
    vec3 c=vec3(.006,.008,.02)+uColor*(f*.55*uI+scan*.035)+vec3(.55,.6,.9)*band*.07*(1.-f);
    gl_FragColor=vec4(c,1.); }`;
const VISOR_VS = `varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying vec3 vP; void main(){ vUv=uv; vP=position; vec4 mv=modelViewMatrix*vec4(position,1.); vV=-mv.xyz; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*mv; }`;

export function makeAvatar(bot, opts) {
  const q = opts.quality !== "low", col = new THREE.Color(bot.color), head = new THREE.Group();
  const B = body(bot.avatar || "blob", q);
  B.g.computeBoundingBox(); B.face = [B.face[0], B.face[1], B.g.boundingBox.max.z - .05]; // visor sits on the front surface
  const shellCol = col.clone().multiplyScalar(.3).lerp(new THREE.Color(0x0b0d18), .45);
  const mat = q ? new THREE.MeshPhysicalMaterial({ color: shellCol, metalness: .25, roughness: .3, clearcoat: 1, clearcoatRoughness: .12, emissive: col, emissiveIntensity: .05 })
    : new THREE.MeshStandardMaterial({ color: shellCol, metalness: .3, roughness: .32, emissive: col, emissiveIntensity: .06 });
  const shell = new THREE.Mesh(B.g, mat); head.add(shell);
  const rimMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uColor: { value: col.clone() }, uI: { value: 1 } }, vertexShader: RIM_VS, fragmentShader: RIM_FS });
  const rim = new THREE.Mesh(B.g, rimMat); rim.scale.setScalar(1.035); head.add(rim);
  // visor dome
  const visorMat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: col.clone() }, uTime: { value: 0 }, uI: { value: 1 } }, vertexShader: VISOR_VS, fragmentShader: VISOR_FS });
  const visor = new THREE.Mesh(new THREE.SphereGeometry(.5, q ? 40 : 20, q ? 24 : 12), visorMat);
  visor.scale.set(B.visor[0], B.visor[1], .3); visor.position.set(B.face[0], B.face[1], B.face[2] - .04); head.add(visor);
  // eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: col.clone().lerp(new THREE.Color(1, 1, 1), .55), toneMapped: false });
  const eyeGeo = new THREE.CapsuleGeometry(.055, .1, 4, 10), eyes = [];
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(eyeGeo, eyeMat); e.position.set(B.face[0] + sx * B.visor[0] * .17, B.face[1] + .01, B.face[2] + .11); head.add(e); eyes.push(e); }
  const eyeGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: opts.glowTex, color: col, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }));
  eyeGlow.scale.set(B.visor[0] * 1.1, B.visor[1] * 1.1, 1); eyeGlow.position.set(B.face[0], B.face[1], B.face[2] + .14); head.add(eyeGlow);
  // antenna + tip
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(.018, .025, .34, 6), new THREE.MeshStandardMaterial({ color: 0x1e2133, metalness: .8, roughness: .3 }));
  ant.position.set(0, B.top + .14, -.05); ant.rotation.z = -.18; head.add(ant);
  const tip = new THREE.Sprite(new THREE.SpriteMaterial({ map: opts.glowTex, color: col.clone().lerp(new THREE.Color(1, 1, 1), .3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  tip.scale.setScalar(.42); tip.position.set(.06, B.top + .33, -.05); head.add(tip);
  // holographic role badge (billboard)
  const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyphTexture(bot.glyph, bot.color), transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  badge.scale.setScalar(.5); badge.position.set(0, B.top + .78, 0);
  return { head, badge, shell, rimMat, visorMat, eyeMat, eyes, eyeGlow, tip, mat, top: B.top, blinkAt: performance.now() + 1500 + Math.random() * 4000, blinkK: 0, lookK: Math.random() * 10 };
}

// per-frame animation; state: working | waiting | idle | unknown
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0);
export function animateAvatar(A, n, t, ds, now, camera, glow) {
  // face the camera (smoothly), with a little life: tilt + glance towards the core while working
  A.head.getWorldPosition(_v);
  _m.lookAt(camera.position, _v, _up); _q.setFromRotationMatrix(_m);
  if (A.head.parent) { const pq = new THREE.Quaternion(); A.head.parent.getWorldQuaternion(pq); _q.premultiply(pq.invert()); }
  A.head.quaternion.slerp(_q, Math.min(1, ds * 3));
  A.head.rotation.z += Math.sin(t * .8 + A.lookK) * .0016;
  // blink
  if (now > A.blinkAt) { A.blinkK = 1; A.blinkAt = now + 2200 + Math.random() * 4200; }
  A.blinkK = Math.max(0, A.blinkK - ds * 7);
  const st = n.state, open = { working: 1.1, waiting: .95, idle: .6, unknown: .4 }[st];
  const sy = open * (1 - Math.sin(Math.min(1, A.blinkK) * Math.PI) * .92);
  const scan = st === "working" ? Math.sin(t * 2.6 + A.lookK) * .05 : Math.sin(t * .5 + A.lookK) * .015;
  A.eyes.forEach((e, i) => { e.scale.set(1, Math.max(.08, sy), 1); e.position.x = (i ? 1 : -1) * Math.abs(e.position.x) + scan; });
  const lit = .45 + glow * .7 + n.flare * 1.2 + n.hoverK * .4;
  A.eyeMat.color.copy(n.col).lerp(new THREE.Color(1, 1, 1), st === "unknown" ? .2 : .55).multiplyScalar(Math.min(2.2, lit));
  A.eyeGlow.material.opacity = Math.min(1, .15 + glow * .4 + n.flare * .5);
  A.rimMat.uniforms.uI.value = .55 + glow * .8 + n.flare * 1.4 + n.hoverK * .6 + n.selK * .5;
  A.visorMat.uniforms.uTime.value = t; A.visorMat.uniforms.uI.value = .6 + glow * .6;
  A.tip.material.opacity = st === "working" ? .6 + .4 * Math.sin(t * 8) : st === "waiting" ? .5 + .5 * Math.sin(t * 3) : .35;
  if (st === "waiting") A.tip.material.color.set("#fbbf24"); else A.tip.material.color.copy(n.col).lerp(new THREE.Color(1, 1, 1), .3);
  A.mat.emissiveIntensity = .04 + glow * .08 + n.flare * .3;
}

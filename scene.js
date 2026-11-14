// Jarvis Command Deck — 3D scene (Three.js r170, ES modules, no build step).
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { makeAvatar, animateAvatar } from "./avatars.js?v=264";
import { compactStatus } from "./readout.js?v=264";

const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

export const ease = {
  inOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  outExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
};

function detectTier(pref) {
  if (pref && pref !== "auto") return pref;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || matchMedia("(pointer:coarse)").matches;
  const mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 8;
  if (mobile && (mem <= 3 || cores <= 4)) return "low";
  if (mobile) return "mid";
  return "high";
}
const TIERS = {
  high: { maxDpr: 2, minDpr: 1, bloomScale: .75, stars: 90, dust: 16, sphereSeg: 128, octaves: 5 },
  mid:  { maxDpr: 1.6, minDpr: .8, bloomScale: .5, stars: 70, dust: 10, sphereSeg: 96, octaves: 4 },
  low:  { maxDpr: 1.15, minDpr: .65, bloomScale: .35, stars: 50, dust: 8, sphereSeg: 64, octaves: 3 },
};


// Blue-noise-ish scatter: random points with a minimum distance, no grid.
function scatterPoints(n, rMin, rMax, yScale) {
  const out = [];
  const vol = (4 / 3) * Math.PI * (Math.pow(rMax, 3) - Math.pow(rMin, 3)) * yScale;
  const minD = Math.pow(vol / Math.max(n, 1), 1 / 3) * 0.52;
  const minD2 = minD * minD;
  for (let i = 0; i < n; i++) {
    let x = 0, y = 0, z = 0, ok = false;
    for (let t = 0; t < 80; t++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
      const rr = rMin + Math.pow(Math.random(), .55) * (rMax - rMin);
      const q = Math.sqrt(Math.max(0, 1 - u * u));
      x = rr * q * Math.cos(th); y = rr * u * yScale; z = rr * q * Math.sin(th);
      ok = true;
      for (let j = 0; j < out.length; j += 3) {
        const dx = x - out[j], dy = y - out[j + 1], dz = z - out[j + 2];
        if (dx * dx + dy * dy + dz * dz < minD2) { ok = false; break; }
      }
      if (ok) break;
    }
    if (ok) out.push(x, y, z);
  }
  return out;
}

function glowTexture(stops) {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d"), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function dashRingTexture(segments, fill, thin) {
  const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d");
  g.translate(256, 256); g.strokeStyle = "#fff"; g.lineCap = "round";
  for (let i = 0; i < segments; i++) {
    const a0 = i / segments * Math.PI * 2, a1 = a0 + (Math.PI * 2 / segments) * fill;
    g.lineWidth = thin ? (i % 4 === 0 ? 5 : 2.5) : (i % 4 === 0 ? 10 : 5); g.beginPath(); g.arc(0, 0, 230, a0, a1); g.stroke();
  }
  g.lineWidth = 2; g.globalAlpha = .5; g.beginPath(); g.arc(0, 0, 205, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function makeGeo(shape) {
  switch (shape) {
    case "octa": return new THREE.OctahedronGeometry(.78, 0);
    case "icosa": return new THREE.IcosahedronGeometry(.74, 0);
    case "dodeca": return new THREE.DodecahedronGeometry(.72, 0);
    case "tetra": return new THREE.TetrahedronGeometry(.88, 0);
    case "box": return new THREE.BoxGeometry(.95, .95, .95);
    case "torus": return new THREE.TorusGeometry(.52, .2, 20, 48);
    case "knot": return new THREE.TorusKnotGeometry(.42, .14, 120, 16, 2, 3);
    case "cone": return new THREE.ConeGeometry(.6, 1.15, 6, 1);
    case "capsule": return new THREE.CapsuleGeometry(.34, .6, 6, 16);
    case "gem": { const g = new THREE.CylinderGeometry(.45, .78, .5, 8, 1); const top = new THREE.ConeGeometry(.78, .9, 8, 1); return mergeSimple(g, top); }
    default: return new THREE.IcosahedronGeometry(.75, 1);
  }
}
function mergeSimple(a, b) { // gem: table + pavilion
  b.rotateX(Math.PI); b.translate(0, -.7, 0); a.translate(0, 0, 0);
  const ga = a.toNonIndexed(), gb = b.toNonIndexed();
  const pos = new Float32Array(ga.attributes.position.array.length + gb.attributes.position.array.length);
  pos.set(ga.attributes.position.array); pos.set(gb.attributes.position.array, ga.attributes.position.array.length);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.computeVertexNormals(); g.translate(0, .25, 0); return g;
}

// Unit tube along t∈[0,1]; deformed into a quadratic Bézier in the vertex shader.
function unitTube(seg = 96, rad = 10) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) for (let j = 0; j <= rad; j++) {
    const a = j / rad * Math.PI * 2; pos.push(i / seg, Math.cos(a), Math.sin(a)); uv.push(i / seg, j / rad);
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) {
    const a = i * (rad + 1) + j, b = a + rad + 1; idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry(); g.setIndex(idx);
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4); return g;
}
const BEAM_VS = /* glsl */`
uniform vec3 P0; uniform vec3 P1; uniform vec3 P2; uniform float uRadius;
varying float vT; varying float vRim;
vec3 bz(float t){return mix(mix(P0,P1,t),mix(P1,P2,t),t);}
void main(){
  float t=position.x; vT=t;
  vec3 c=bz(t); vec3 T=normalize(2.*(1.-t)*(P1-P0)+2.*t*(P2-P1));
  vec3 up=abs(T.y)>.95?vec3(1.,0.,0.):vec3(0.,1.,0.);
  vec3 N=normalize(cross(T,up)); vec3 B=cross(T,N);
  float taper=.35+.65*sin(3.14159*clamp(t,0.,1.));
  vec3 off=(N*position.y+B*position.z);
  vec3 p=c+off*uRadius*taper;
  vec4 mv=modelViewMatrix*vec4(p,1.);
  vec3 vn=normalize(normalMatrix*off); vRim=abs(dot(vn,normalize(-mv.xyz)));
  gl_Position=projectionMatrix*mv;
}`;
const BEAM_FS = /* glsl */`
uniform vec3 uColor; uniform float uTime; uniform float uHead; uniform float uTail; uniform float uOpacity; uniform float uFlow; uniform float uCore;
varying float vT; varying float vRim;
void main(){
  float body=smoothstep(uTail,uTail+.08,vT)*(1.-smoothstep(uHead,uHead+.015,vT));
  float dash=pow(.5+.5*sin((vT*26.-uTime*uFlow*7.)),6.);
  float head=exp(-pow((vT-uHead)*14.,2.));
  float edge=uCore>.5?pow(vRim,.6):pow(vRim,2.2);
  float a=(body*(.32+.55*dash)+head*2.6)*edge*uOpacity;
  vec3 col=mix(uColor,vec3(1.),head*.65+uCore*.35);
  gl_FragColor=vec4(col*a*(uCore>.5?2.6:1.6),a);
}`;

export class Deck {
  constructor(canvas, labelsEl, roster, opts = {}) {
    this.canvas = canvas; this.labelsEl = labelsEl; this.roster = roster; this.opts = opts;
    this.tierName = detectTier(opts.quality); this.tier = TIERS[this.tierName];
    if (labelsEl) { labelsEl.classList.remove("q-high", "q-mid", "q-low"); labelsEl.classList.add("q-" + this.tierName); }
    this.reduced = !!opts.reduced; this.tweens = []; this.beams = []; this.links = new Map(); this.flares = [];
    this.hover = null; this.selected = null; this.onSelect = opts.onSelect || (() => {}); this.onHover = opts.onHover || (() => {});
    this.t0 = performance.now(); this.lastInteract = -1e9; this.fpsAcc = []; this.dprTimer = 0; this.dprSkip = 0; this.resizeCount = 0; this.dprDowns = 0;
    this.init();
  }
  init() {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: "high-performance", alpha: false, stencil: false, failIfMajorPerformanceCaveat: false });
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; r.outputColorSpace = THREE.SRGBColorSpace;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.tier.maxDpr); r.setPixelRatio(this.dpr);
    const s = this.scene = new THREE.Scene(); s.background = new THREE.Color(0x020611); s.fog = new THREE.FogExp2(0x03081a, .007);
    const pm = new THREE.PMREMGenerator(r); s.environment = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose();
    s.environmentIntensity = .55;
    this.camera = new THREE.PerspectiveCamera(42, 1, .1, 1200);
    this.home = { pos: new THREE.Vector3(0, 6.2, 21), target: new THREE.Vector3(0, .3, 0) };
    this.camera.position.set(0, 34, 64);
    const c = this.controls = new OrbitControls(this.camera, this.canvas);
    c.enableDamping = true; c.dampingFactor = .06; c.enablePan = false; c.minDistance = 7; c.maxDistance = 52;
    c.maxPolarAngle = Math.PI * .56; c.minPolarAngle = Math.PI * .12; c.rotateSpeed = .6; c.zoomSpeed = .8;
    c.autoRotate = !this.reduced; c.autoRotateSpeed = this.reduced ? .06 : .22; c.target.copy(this.home.target);
    c.addEventListener("start", () => { this.lastInteract = performance.now(); this.userDriving = true; });
    c.addEventListener("end", () => { this.lastInteract = performance.now(); this.userDriving = false; });
    this.glowTex = glowTexture([[0, "rgba(255,255,255,1)"], [.18, "rgba(255,255,255,.55)"], [.45, "rgba(255,255,255,.12)"], [1, "rgba(255,255,255,0)"]]);
    this.ringTex = dashRingTexture(48, .55); this.ringTexThin = dashRingTexture(48, .55, true);
    s.add(new THREE.HemisphereLight(0x5fd4e8, 0x04090f, .42));
    const k1 = new THREE.DirectionalLight(0xcfe8ff, 1.25); k1.position.set(-8, 10, 6); s.add(k1);
    const k2 = new THREE.DirectionalLight(0x2a9df4, .75); k2.position.set(9, 3, -8); s.add(k2);
    this.coreLight = new THREE.PointLight(0x5fd4e8, 60, 30, 1.6); s.add(this.coreLight);
    this.buildSky(); this.buildStars(); this.buildFloor(); this.buildCore(); this.buildNodes(); this.buildPost();
    this.raycaster = new THREE.Raycaster(); this.ptr = new THREE.Vector2(9, 9); this.ptrActive = false;
    this.bindInput(); this.resize(); addEventListener("resize", () => this.resize());
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { this.last = performance.now(); this.fpsAcc = []; this.dprSkip = 30; } });
    this.intro(); this.last = performance.now(); this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
  }
  buildSky() {
    const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec3 vD; varying vec4 vClip; void main(){ vD=normalize(position); vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.); vClip=p; gl_Position=p.xyww; }`,
      fragmentShader: `uniform float uTime; varying vec3 vD; varying vec4 vClip;
        void main(){ vec3 d=normalize(vD);
          float t=clamp(.5-vClip.y/max(vClip.w,1e-4)*.5,0.,1.);
          vec3 top=vec3(.008,.024,.067);
          vec3 upper=vec3(.012,.031,.102);
          vec3 mid=vec3(.024,.086,.145);
          vec3 low=vec3(.055,.227,.290);
          vec3 glow=vec3(.122,.498,.600);
          vec3 c=mix(top,upper,smoothstep(0.,.22,t));
          c=mix(c,mid,smoothstep(.28,.58,t));
          c=mix(c,low,smoothstep(.58,.85,t));
          c=mix(c,glow,smoothstep(.80,1.,t)*.32);
          float rh=smoothstep(-.2,.95,d.x)*smoothstep(-.75,.2,d.y);
          c+=vec3(.051,.165,.212)*rh*.12;
          gl_FragColor=vec4(c,1.); }` });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(600, 48, 32), m); this.sky.frustumCulled = false; this.scene.add(this.sky);
  }
  buildStars() {
    const mk = (n, rMin, rMax, sizeMin, sizeMax, palette, sparkleChance) => {
      const pts = scatterPoints(n, rMin, rMax, .7), count = pts.length / 3;
      const pos = new Float32Array(pts), col = new Float32Array(count * 3), sz = new Float32Array(count), ph = new Float32Array(count), sp = new Float32Array(count);
      const cs = palette.map(h => new THREE.Color(h));
      for (let i = 0; i < count; i++) {
        const c = cs[(Math.random() * cs.length) | 0]; col.set([c.r, c.g, c.b], i * 3);
        sz[i] = sizeMin + Math.pow(Math.random(), 3) * (sizeMax - sizeMin); ph[i] = Math.random() * 100;
        sp[i] = Math.random() < sparkleChance ? 1 : 0;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      g.setAttribute("size", new THREE.BufferAttribute(sz, 1)); g.setAttribute("phase", new THREE.BufferAttribute(ph, 1));
      g.setAttribute("spark", new THREE.BufferAttribute(sp, 1));
      const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uDpr: { value: this.dpr }, uTwinkle: { value: this.reduced ? 0 : 1 } },
        vertexShader: `attribute float size; attribute float phase; attribute float spark; attribute vec3 color; uniform float uTime; uniform float uDpr; uniform float uTwinkle; varying vec3 vC; varying float vA;
          void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv;
            float breath=.78+.22*sin(uTime*.28+phase)*uTwinkle;
            float glint=spark*uTwinkle*pow(max(sin(uTime*.45+phase),0.),8.)*.85;
            vA=(.55*breath+glint); vC=color;
            float ps=size*uDpr*(200./-mv.z)*(1.+glint*.4);
            vA*=smoothstep(.6,1.5,ps);
            gl_PointSize=max(ps,1.5); }`,
        fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 p=gl_PointCoord-.5; float d=length(p); float a=smoothstep(.5,.0,d); a=a*a; float core=smoothstep(.14,0.,d); gl_FragColor=vec4(vC*(a*vA+core*vA),a*vA+core*vA*.6); }` });
      const p = new THREE.Points(g, m); p.frustumCulled = false; return p;
    };
    this.stars = mk(this.tier.stars, 90, 420, .35, 1.05, ["#8aa4b0", "#5a7480", "#6a8a96", "#4a6a76"], .12);
    this.dust = mk(this.tier.dust, 10, 48, .2, .45, ["#1a2a32", "#223c47"], 0);
    this.dust.material.uniforms.uDpr = this.stars.material.uniforms.uDpr;
    this.dust.material.uniforms.uTwinkle = this.stars.material.uniforms.uTwinkle;
    this.scene.add(this.stars, this.dust);
  }
  buildFloor() {
    const m = this.floorMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPulse: { value: 0 }, uPulseT: { value: -10 }, uR: { value: 8.6 } },
      vertexShader: `varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform float uTime; uniform float uPulseT; uniform float uR; varying vec2 vP;
        void main(){ float r=length(vP);
          float fade=smoothstep(13.,0.,r)*(.4+.6*exp(-r*.07));
          float wash=exp(-r*.11)*.18;
          float orbit=exp(-pow((r-uR)*10.,2.))*.055 + exp(-pow((r-uR)*1.8,2.))*.015;
          float pt=uTime-uPulseT; float pulse=exp(-pow((r-pt*9.)*1.4,2.))*exp(-pt*.9)*step(0.,pt)*.55;
          vec3 c=vec3(.035,.16,.24)*wash + vec3(.22,.55,.66)*orbit + vec3(.70,.88,.92)*pulse*.3;
          gl_FragColor=vec4(c*fade,1.); }` });
    const f = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), m); f.rotation.x = -Math.PI / 2; f.position.y = -2.6; this.scene.add(f);
  }
  buildCore() {
    const g = this.core = new THREE.Group(); this.scene.add(g);
    const seg = this.tier.sphereSeg;
    this.coreMat = new THREE.ShaderMaterial({ transparent: true, uniforms: { uTime: { value: 0 }, uEnergy: { value: 1 }, uFlare: { value: 0 }, uMood: { value: 0 }, uAmp: { value: 0 }, uMoodCol: { value: new THREE.Color(0xff3b5c) } },
      vertexShader: NOISE + `uniform float uTime; uniform float uEnergy; uniform float uFlare; uniform float uMood; uniform float uAmp; varying vec3 vN; varying vec3 vV; varying vec3 vP; varying float vD;
        void main(){ vec3 p=position; float n=snoise(p*1.15+vec3(0.,uTime*.35,uTime*.2)); vD=n; p+=normal*n*(.07+.06*uFlare)*uEnergy; p+=normal*uMood*(.04+uAmp*.22)*sin(length(position.xz)*5.5+position.y*4.-uTime*9.);
          vP=position; vec4 mv=modelViewMatrix*vec4(p,1.); vV=-mv.xyz; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: NOISE + `uniform float uTime; uniform float uFlare; uniform float uMood; uniform float uAmp; uniform vec3 uMoodCol; varying vec3 vN; varying vec3 vV; varying vec3 vP; varying float vD;
        void main(){ float fr=pow(1.-max(dot(normalize(vN),normalize(vV)),0.),2.4);
          vec3 q=vP*1.7; float e=snoise(q+vec3(uTime*.25,-uTime*.18,uTime*.1)); float e2=snoise(q*2.3-vec3(0.,uTime*.4,0.));
          float veins=smoothstep(.06,0.,abs(e))*.8+smoothstep(.035,0.,abs(e2))*.4;
          float bands=pow(.5+.5*sin(vP.y*16.+uTime*1.6+e*3.),8.)*.25;
          vec3 deep=vec3(.02,.08,.14), mid=vec3(.12,.45,.62), hot=vec3(.90,.97,1.);
          vec3 lav=vec3(.62,.85,.92);
          vec3 c=mix(deep,mid,.5+.5*e)*.6 + mix(lav,hot,uFlare*.6)*veins*(.42+uFlare*.8) + vec3(.35,.75,.85)*bands*.7;
          c+=vec3(.45,.85,.95)*fr*1.5 + vec3(.80,.92,1.)*pow(fr,5.)*1.5;
          float waves=pow(.5+.5*sin(length(vP.xz)*5.5+vP.y*4.-uTime*9.),5.);
          vec3 mc=uMoodCol*(.35+veins*1.1+fr*1.6+waves*(.35+uAmp*1.4));
          c=mix(c,c*.3+mc,uMood*.8);
          float a=clamp(.42+fr*.7+veins*.25+uMood*waves*.2,0.,1.);
          gl_FragColor=vec4(c*(1.+uFlare*.9),a); }` });
    this.coreMesh = new THREE.Mesh(new THREE.SphereGeometry(1.55, seg, seg / 2), this.coreMat); g.add(this.coreMesh);
    const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(.78, 1), new THREE.MeshBasicMaterial({ color: 0xcfe8ff, wireframe: true, transparent: true, opacity: .55, toneMapped: false }));
    this.coreInner = inner; g.add(inner);
    const cage = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.05, 1)), new THREE.LineBasicMaterial({ color: 0x4a717d, transparent: true, opacity: .28, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.cage = cage; g.add(cage);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0x5fd4e8, transparent: true, opacity: .4, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(10); this.coreHalo = halo; g.add(halo);
    this.gyro = [];
    const ringDefs = [[2.6, .025, 0x5fd4e8, [Math.PI / 2, 0, 0], [.0, .0, .45]], [3.05, .018, 0x99ced9, [Math.PI / 3, Math.PI / 5, 0], [.32, .0, -.2]], [3.5, .014, 0xe8dcb0, [-Math.PI / 4, 0, Math.PI / 6], [-.18, .26, 0]]];
    for (const [rad, tube, col, rot, spd] of ringDefs) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(rad, tube, 8, 220), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .9, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.rotation.set(...rot); m.userData.spd = spd; g.add(m); this.gyro.push(m);
      const bead = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      bead.scale.setScalar(.6); bead.position.x = rad; m.add(bead);
    }
    // instanced tick ring
    const ticks = 140, tg = new THREE.BoxGeometry(.018, .16, .018), tm = new THREE.MeshBasicMaterial({ color: 0x5fd4e8, transparent: true, opacity: .24, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false });
    const ti = this.ticks = new THREE.InstancedMesh(tg, tm, ticks); const d = new THREE.Object3D();
    for (let i = 0; i < ticks; i++) { const a = i / ticks * Math.PI * 2; d.position.set(Math.cos(a) * 4.1, 0, Math.sin(a) * 4.1); d.rotation.set(0, -a, 0); d.scale.y = i % 10 === 0 ? 2.4 : (i % 5 === 0 ? 1.5 : 1); d.updateMatrix(); ti.setMatrixAt(i, d.matrix); }
    ti.position.y = -1.9; g.add(ti);
    const scanMat = new THREE.MeshBasicMaterial({ color: 0x5fd4e8, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.scans = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(8.2, .01, .01), scanMat.clone());
      line.position.x = 5.2;
      const wrap = new THREE.Group(); wrap.rotation.y = i * 2.15 + .4; wrap.add(line);
      wrap.userData.spd = .035 * (i % 2 ? 1 : -1);
      this.scans.add(wrap);
    }
    this.scans.position.y = -1.85; g.add(this.scans);
    // data motes orbiting the core
    const n = this.tierName === "low" ? 260 : 700, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, r = 2.2 + Math.random() * 2.6, y = (Math.random() - .5) * .9 * (1 - (r - 2.2) / 3); pos.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3); }
    const mg = new THREE.BufferGeometry(); mg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.motes = new THREE.Points(mg, new THREE.PointsMaterial({ size: .07, map: this.glowTex, color: 0x99ced9, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, toneMapped: false }));
    g.add(this.motes);
    // shockwave pool
    this.shockMat = thin => new THREE.MeshBasicMaterial({ map: thin ? this.ringTexThin : this.ringTex, color: 0x5fd4e8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    // core hit target + label
    const hit = new THREE.Mesh(new THREE.SphereGeometry(2.3, 12, 12), new THREE.MeshBasicMaterial({ visible: false })); hit.userData.idx = 0; g.add(hit);
    this.hits = [hit];
    this.coreLabel = this.makeLabel(this.roster[0], true);
  }
  makeLabel(bot, core) {
    const el = document.createElement("div"); el.className = "nl" + (core ? " core" : ""); el.style.setProperty("--c", bot.color);
    el.innerHTML = `<i class="nl-lead" aria-hidden="true"></i><div class="n"><i></i>${bot.name.toUpperCase()}</div><div class="r">${bot.title}</div><div class="st">${compactStatus("unknown")}</div>`;
    el.addEventListener("click", e => { e.stopPropagation(); this.select(this.roster.indexOf(bot)); });
    el.addEventListener("pointerenter", () => this.setHover(this.roster.indexOf(bot)));
    el.addEventListener("pointerleave", () => this.setHover(null));
    this.labelsEl.appendChild(el); return el;
  }
  buildNodes() {
    this.nodes = [];
    const crew = this.roster.slice(1), N = crew.length;
    this.orbitR = 8.6;
    const pts = []; for (let i = 0; i <= 256; i++) { const a = i / 256 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * this.orbitR, 0, Math.sin(a) * this.orbitR)); }
    this.orbitLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x4a717d, transparent: true, opacity: .2, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.orbitPlane = new THREE.Group(); this.orbitPlane.rotation.set(.06, 0, -.05); this.orbitPlane.add(this.orbitLine); this.scene.add(this.orbitPlane);
    crew.forEach((bot, k) => {
      const col = new THREE.Color(bot.color), grp = new THREE.Group();
      const av = makeAvatar(bot, { quality: this.tierName, glowTex: this.glowTex }); grp.add(av.head); grp.add(av.badge); const mesh = av.head, mat = av.mat, wire = null;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: col, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.setScalar(3.6); halo.position.z = -.35; grp.add(halo);
      const ring = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1), this.shockMat(true)); ring.material.color = col.clone(); ring.material.opacity = .25; ring.rotation.x = -Math.PI / 2; ring.position.y = -.95; grp.add(ring);
      const sel = new THREE.Mesh(new THREE.TorusGeometry(1.45, .018, 8, 96), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }));
      grp.add(sel);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, 1.6, 4), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false })); stem.position.y = -1.75; grp.add(stem);
      const hit = new THREE.Mesh(new THREE.SphereGeometry(1.35, 10, 10), new THREE.MeshBasicMaterial({ visible: false })); hit.userData.idx = k + 1; grp.add(hit); this.hits.push(hit);
      grp.scale.setScalar(.001); this.orbitPlane.add(grp);
      const node = { bot, grp, av, mesh, wire, halo, ring, sel, mat, col, base: k / N * Math.PI * 2, bob: Math.random() * 6, state: "unknown", glow: .3, flare: 0, hoverK: 0, selK: 0, appear: 0, label: this.makeLabel(bot, false), world: new THREE.Vector3(), spin: (Math.random() * .5 + .35) * (k % 2 ? 1 : -1) };
      this.nodes.push(node);
    });
  }
  buildPost() {
    const r = this.renderer, size = new THREE.Vector2(); r.getSize(size);
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: this.tierName === "high" ? 4 : 0 });
    const comp = this.composer = new EffectComposer(r, rt);
    comp.addPass(new RenderPass(this.scene, this.camera));
    const bloom = this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), this.tierName === "low" ? .32 : .42, .42, .82);
    const origSet = bloom.setSize.bind(bloom), sc = this.tier.bloomScale; bloom.setSize = (w, h) => origSet(Math.max(64, Math.round(w * sc)), Math.max(64, Math.round(h * sc)));
    comp.addPass(bloom); if (/nobloom/.test(location.search) || this.reduced) bloom.enabled = false; comp.addPass(new OutputPass());
    this.finish = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uGrain: { value: this.reduced ? 0 : this.tierName === "high" ? .012 : .01 }, uGrainAnim: { value: (!this.reduced && this.tierName === "high") ? 1 : 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; uniform float uGrain; uniform float uGrainAnim; varying vec2 vUv;
        float h(vec2 p){ vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
        void main(){ vec2 d=vUv-.5; float r2=dot(d,d);
          vec2 off=d*r2*.008; vec3 c; c.r=texture2D(tDiffuse,vUv+off).r; c.g=texture2D(tDiffuse,vUv).g; c.b=texture2D(tDiffuse,vUv-off).b;
          float vig=smoothstep(1.05,.16,r2*1.85); c*=mix(.36,1.,vig);
          float g=h(gl_FragCoord.xy+uGrainAnim*floor(uTime*12.)*vec2(91.,37.))-.5; c+=g*uGrain;
          c+=vec3(.051,.165,.212)*smoothstep(.12,.92,vUv.x)*smoothstep(1.,.22,r2)*.16;
          c+=vec3(.004,.012,.02)*(1.-vig);
          gl_FragColor=vec4(c,1.); }` });
    comp.addPass(this.finish);
  }
  resize() {
    const w = innerWidth, hRaw = innerHeight;
    if (this._stableH == null) this._stableH = hRaw;
    const widthChanged = this.w != null && w !== this.w;
    const dh = Math.abs(hRaw - this._stableH);
    // Ignore visualViewport / address-bar height jitter when width is unchanged.
    if (this.w != null && !widthChanged && dh < 80) { /* keep this._stableH */ }
    else this._stableH = hRaw;
    const h = this._stableH, dpr = this.dpr;
    if (this.w === w && this.h === h && this.sizedDpr === dpr) return;
    this.w = w; this.h = h; this.sizedDpr = dpr; this.resizeCount = (this.resizeCount || 0) + 1;
    if (this.labelsEl) this.labelsEl.querySelectorAll(".nl").forEach(el => { el._mkey = ""; });
    this.renderer.setPixelRatio(dpr); this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(dpr); this.composer.setSize(w, h);
    this.finish.uniforms.uRes.value.set(w * dpr, h * dpr);
    this.stars.material.uniforms.uDpr.value = dpr;
    const a = w / h; this.camera.aspect = a;
    const portrait = a < .8; this.camera.fov = portrait ? 66 : 42;
    const hf = Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * a), fit = (this.orbitR + 1.4) / Math.tan(hf) * (portrait ? 1.1 : .82);
    const dist = Math.max(portrait ? 31 : 24.5, Math.min(fit, 48)), dir = new THREE.Vector3(0, portrait ? .9 : .37, 1).normalize();
    this.home.target.set(0, portrait ? -.6 : .2, 0); this.home.pos.copy(dir.multiplyScalar(dist)).add(this.home.target);
    this.applyShift();
  }
  setShift(px) { this.shiftTo = px; }
  applyShift() { const sx = this.shift || 0; if (Math.abs(sx) > .5) this.camera.setViewOffset(this.w, this.h, -sx, 0, this.w, this.h); else this.camera.clearViewOffset(); this.camera.updateProjectionMatrix(); }
  bindInput() {
    const cv = this.canvas; let down = null;
    const setPtr = e => { const r = cv.getBoundingClientRect(); this.ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
    cv.addEventListener("pointermove", e => { if (e.pointerType === "mouse") { setPtr(e); this.ptrActive = true; } });
    cv.addEventListener("pointerleave", () => { this.ptrActive = false; this.setHover(null); });
    cv.addEventListener("pointerdown", e => { down = [e.clientX, e.clientY, performance.now()]; this.lastInteract = performance.now(); });
    cv.addEventListener("pointerup", e => {
      if (!down) return; const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]); const dt = performance.now() - down[2]; down = null;
      if (moved > 8 || dt > 600) return; setPtr(e); const i = this.pick(); if (i != null) this.select(i); else if (this.selected != null) this.select(null);
    });
  }
  pick() {
    this.raycaster.setFromCamera(this.ptr, this.camera);
    const hit = this.raycaster.intersectObjects(this.hits, false)[0]; return hit ? hit.object.userData.idx : null;
  }
  setHover(i) {
    if (this.hover === i) return; this.hover = i; this.canvas.style.cursor = i != null ? "pointer" : "";
    this.allLabels().forEach((l, k) => l.classList.toggle("hov", k === i)); this.onHover(i);
  }
  allLabels() { return [this.coreLabel, ...this.nodes.map(n => n.label)]; }
  select(i, silent) {
    this.selected = i; this.allLabels().forEach((l, k) => { l.classList.toggle("sel", k === i); l.classList.toggle("dim", i != null && k !== i && k !== 0); });
    const now = performance.now(); this.lastInteract = now;
    const fromT = this.controls.target.clone(), fromP = this.camera.position.clone();
    this.focusTween = { t0: now, dur: 1400, fromT, fromP, idx: i };
    if (!silent) this.onSelect(i);
  }
  focusFrame(i) { const p = this.nodePos(i), out = p.clone().setY(0).normalize(), side = new THREE.Vector3(-out.z, 0, out.x);
    const tgt = p.clone().lerp(new THREE.Vector3(0, 0, 0), .3); const cam = p.clone().addScaledVector(out, 7.6).addScaledVector(side, 4.8); cam.y = p.y + 3.8; return [tgt, cam]; }
  nodePos(i) { return i === 0 ? new THREE.Vector3(0, 0, 0) : this.nodes[i - 1].world.clone(); }
  setStates(map) { // map: idx -> "working"|"waiting"|"idle"|"unknown"
    this.nodes.forEach((n, k) => {
      const s = map[k + 1] || "unknown";
      if (n.state === s) return;
      n.state = s; n.label.classList.remove("working", "waiting", "idle", "unknown"); n.label.classList.add(s);
      const stEl = n.label.querySelector(".st"); if (stEl) stEl.textContent = compactStatus(s); n.label._mkey = "";
    });
    const cs = map[0] || "unknown";
    if (this.coreState !== cs) { this.coreState = cs; this.coreLabel.classList.remove("working", "waiting", "idle", "unknown"); this.coreLabel.classList.add(cs); const stEl = this.coreLabel.querySelector(".st"); if (stEl) stEl.textContent = compactStatus(cs); this.coreLabel._mkey = ""; }
  }
  // ---- beams ----
  makeBeamMeshes(color) {
    const geo = this.tubeGeo || (this.tubeGeo = unitTube(this.tierName === "low" ? 64 : 110, this.tierName === "low" ? 6 : 10));
    const mk = (rad, core) => new THREE.Mesh(geo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: BEAM_VS, fragmentShader: BEAM_FS,
      uniforms: { P0: { value: new THREE.Vector3() }, P1: { value: new THREE.Vector3() }, P2: { value: new THREE.Vector3() }, uRadius: { value: rad }, uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uHead: { value: 0 }, uTail: { value: 0 }, uOpacity: { value: 1 }, uFlow: { value: 1 }, uCore: { value: core ? 1 : 0 } } }));
    const outer = mk(.24, false), inner = mk(.045, true); outer.frustumCulled = inner.frustumCulled = false;
    const packet = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: new THREE.Color(color).lerp(new THREE.Color(1, 1, 1), .4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    packet.scale.setScalar(1.1);
    this.scene.add(outer, inner, packet); return { outer, inner, packet };
  }
  curve(i, dir) {
    const a = new THREE.Vector3(0, 0, 0), b = this.nodePos(i);
    const mid = a.clone().add(b).multiplyScalar(.5); mid.y += 3.2 + b.length() * .12; mid.addScaledVector(b.clone().normalize(), 1.2);
    const p0 = dir === "in" ? b : a, p2 = dir === "in" ? a : b;
    const dirv = p2.clone().sub(p0).normalize(); p0.addScaledVector(dirv, dir === "in" ? 1.0 : 1.7); p2.addScaledVector(dirv, dir === "in" ? -1.7 : -1.0);
    return [p0, mid, p2];
  }
  fire(i, dir = "out") {
    if (i == null || i < 1 || i > this.nodes.length) return;
    const n = this.nodes[i - 1], color = dir === "out" ? n.bot.color : "#b2d4d9";
    const m = this.makeBeamMeshes(color); this.beams.push({ i, dir, t0: performance.now(), m, done: false, hit: false });
    if (dir === "out") this.flareCore(.6);
  }
  setLinks(list) { // persistent routed-but-unanswered links: [{i}]
    const want = new Set(list.map(x => x.i).filter(i => i >= 1));
    for (const [i, L] of this.links) if (!want.has(i)) { L.fading = performance.now(); }
    for (const i of want) if (!this.links.has(i) || this.links.get(i).fading) { const old = this.links.get(i); if (old) this.disposeBeam(old.m); this.links.set(i, { m: this.makeBeamMeshes(this.nodes[i - 1].bot.color), t0: performance.now(), fading: 0 }); }
  }
  disposeBeam(m) { for (const o of [m.outer, m.inner, m.packet]) { this.scene.remove(o); o.material.dispose(); } }
  flareCore(k = 1) { this.coreFlare = Math.min(1.6, (this.coreFlare || 0) + k); this.floorMat.uniforms.uPulseT.value = this.time; this.shock(new THREE.Vector3(0, -1.9, 0), "#5fd4e8", 7); }
  shock(pos, color, size) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.shockMat()); m.material.color = new THREE.Color(color); m.rotation.x = -Math.PI / 2; m.position.copy(pos); this.scene.add(m); this.flares.push({ m, t0: performance.now(), size }); }
  setMood(kind) { this.moodKind = kind || null; const col = { listening: 0xff4d6a, speaking: 0x5fd4e8, thinking: 0x2a9df4 }[kind]; if (col != null) this.coreMat.uniforms.uMoodCol.value.set(col); }
  setLevel(x) { this.levelIn = Math.max(0, Math.min(1, x || 0)); }
  intake() { this.flareCore(1); } // local acknowledgement when a message is queued
  intro() {
    const t0 = performance.now(), from = this.camera.position.clone();
    this.introT = { t0, dur: this.reduced ? 10 : 3200, from };
  }
  updBeam(m, P, head, tail, opacity, t, flow) {
    for (const o of [m.outer, m.inner]) { const u = o.material.uniforms; u.P0.value.copy(P[0]); u.P1.value.copy(P[1]); u.P2.value.copy(P[2]); u.uHead.value = head; u.uTail.value = tail; u.uOpacity.value = opacity; u.uTime.value = t; u.uFlow.value = flow; }
    const h = Math.min(Math.max(head, 0), 1), a = P[0].clone().lerp(P[1], h), b = P[1].clone().lerp(P[2], h); m.packet.position.copy(a.lerp(b, h));
    m.packet.material.opacity = opacity * (head > 1.02 ? 0 : 1); m.packet.scale.setScalar(.9 + .35 * Math.sin(t * 12));
  }
  adapt(dt) {
    if (this.opts.quality && this.opts.quality !== "auto") return;
    if (this.dprSkip > 0) { this.dprSkip--; return; }
    this.fpsAcc.push(dt);
    if (this.fpsAcc.length < 90) return;
    const sorted = this.fpsAcc.slice().sort((a, b) => a - b);
    const mid = sorted[sorted.length >> 1]; this.fpsAcc = [];
    const fps = 1000 / mid; this.fps = fps;
    if (fps < 45 && this.dpr > this.tier.minDpr) {
      const next = Math.max(this.tier.minDpr, Math.round((this.dpr - .25) * 4) / 4);
      if (next < this.dpr - .01) { this.dpr = next; this.dprSkip = 30; this.dprDowns = (this.dprDowns || 0) + 1; this.resize(); }
    }
  }
  loop(now) {
    requestAnimationFrame(this.loop);
    if (document.hidden) return;
    const dt = Math.min(now - this.last, 100); this.last = now; this.adapt(dt);
    const t = this.time = (now - this.t0) / 1000, ds = dt / 1000, mo = this.reduced ? .25 : 1;
    if (this.shiftTo != null && Math.abs((this.shift || 0) - this.shiftTo) > .3) { this.shift = (this.shift || 0) + (this.shiftTo - (this.shift || 0)) * Math.min(1, ds * 4); this.applyShift(); }
    // intro
    if (this.introT) { const k = Math.min(1, (now - this.introT.t0) / this.introT.dur), e = ease.inOutCubic(k);
      this.camera.position.lerpVectors(this.introT.from, this.home.pos, e); this.controls.target.copy(this.home.target);
      if (k >= 1) this.introT = null; }
    // focus tween
    if (this.focusTween && !this.introT) { const F = this.focusTween, k = Math.min(1, (now - F.t0) / F.dur), e = ease.inOutCubic(k);
      let tgt, cam;
      if (F.idx == null) { tgt = this.home.target; cam = F.fromP.clone().sub(F.fromT).setLength(this.home.pos.distanceTo(this.home.target)).add(this.home.target); }
      else if (F.idx === 0) { tgt = new THREE.Vector3(0, .3, 0); cam = F.fromP.clone().sub(F.fromT).setLength(13).add(tgt); cam.y = Math.max(cam.y, 3.5); }
      else { [tgt, cam] = this.focusFrame(F.idx); }
      this.controls.target.lerpVectors(F.fromT, tgt, e); this.camera.position.lerpVectors(F.fromP, cam, e);
      if (k >= 1) this.focusTween = null; }
    else if (this.selected != null && this.selected > 0 && !this.userDriving && now - this.lastInteract > 2500) { const [tg, cm] = this.focusFrame(this.selected); this.controls.target.lerp(tg, .04); this.camera.position.lerp(cm, .02); }
    const idle = now - this.lastInteract > 7000 && !this.introT;
    this.controls.autoRotate = !this.reduced && idle && this.selected == null; this.controls.update();
    if (idle && !this.focusTween) { this.camera.position.y += Math.sin(t * .23) * .0045 * mo; }
    // sky, stars
    this.sky.material.uniforms.uTime.value = t; this.stars.material.uniforms.uTime.value = t;
    this.stars.rotation.y = t * .004; this.dust.rotation.y = -t * .012 * mo; this.dust.position.y = Math.sin(t * .1) * .4;
    this.sky.position.copy(this.camera.position); this.floorMat.uniforms.uTime.value = t;
    // core
    this.coreFlare = Math.max(0, (this.coreFlare || 0) - ds * .9); const cf = this.coreFlare;
    const cStateK = { working: 1.25, waiting: 1.05, idle: .9, unknown: .8 }[this.coreState || "unknown"];
    this.coreMat.uniforms.uTime.value = t * mo; this.coreMat.uniforms.uFlare.value = cf; this.coreMat.uniforms.uEnergy.value = cStateK;
    const mk = this.moodKind ? (this.moodKind === "thinking" ? .55 : 1) : 0; this.moodK = (this.moodK || 0) + (mk - (this.moodK || 0)) * Math.min(1, ds * 4);
    const lvT = this.moodKind === "thinking" ? .25 + .2 * Math.sin(t * 6) : (this.levelIn || 0); this.amp = (this.amp || 0) + (lvT - (this.amp || 0)) * Math.min(1, ds * (lvT > (this.amp || 0) ? 18 : 5)); this.levelIn = (this.levelIn || 0) * Math.pow(.02, ds);
    const cu = this.coreMat.uniforms; cu.uMood.value = this.moodK; cu.uAmp.value = this.amp;
    if (!this._hb) { this._hb = new THREE.Color(0x5fd4e8); this._lb = new THREE.Color(0x99ced9); }
    this.coreHalo.material.color.copy(this._hb).lerp(cu.uMoodCol.value, this.moodK * .85); this.coreLight.color.copy(this._lb).lerp(cu.uMoodCol.value, this.moodK * .8);
    if (this.moodK > .5 && this.amp > .45 && now - (this._lastPulse || 0) > 650) { this._lastPulse = now; this.floorMat.uniforms.uPulseT.value = t; }
    const pulse = 1 + Math.sin(t * 1.6) * .025 + cf * .08 + this.amp * this.moodK * .09; this.coreMesh.scale.setScalar(pulse);
    this.coreInner.rotation.set(t * .5 * mo, t * .7 * mo, 0); this.cage.rotation.set(-t * .08 * mo, t * .12 * mo, 0);
    this.coreHalo.material.opacity = .32 + .06 * Math.sin(t * 1.6) + cf * .3 + (this.moodK || 0) * (.12 + (this.amp || 0) * .3); this.coreHalo.scale.setScalar(9.5 + cf * 3 + (this.hover === 0 ? 1 : 0));
    this.coreLight.intensity = 40 + 14 * Math.sin(t * 1.6) + cf * 100;
    const gk = 1 + (this.moodK || 0) * (1.5 + (this.amp || 0) * 4); this.gyro.forEach(g => { const s = g.userData.spd.map(v => v * gk); g.rotation.x += s[0] * ds * mo; g.rotation.y += s[1] * ds * mo; g.rotation.z += s[2] * ds * mo; });
    this.ticks.rotation.y = -t * .06 * mo; this.motes.rotation.y = t * .18 * mo; if (this.scans) this.scans.children.forEach(sc => { sc.rotation.y += sc.userData.spd * ds * mo; });
    // nodes
    const tmp = new THREE.Vector3();
    const labItems = this._labItems || (this._labItems = []); labItems.length = 0;
    this.nodes.forEach((n, k) => {
      const delay = .9 + k * .09, ap = Math.min(1, Math.max(0, (t - delay) / .9)); n.appear = ap;
      const ang = n.base + t * .018 * mo; const y = Math.sin(t * .7 + n.bob) * .28 + Math.sin(k * 2.1) * .5;
      n.grp.position.set(Math.cos(ang) * this.orbitR, y + 1.0, Math.sin(ang) * this.orbitR);
      const st = n.state, sp = { working: 4.2, waiting: 1.8, idle: .8, unknown: .5 }[st], amp = { working: .35, waiting: .22, idle: .06, unknown: .03 }[st], base = { working: .72, waiting: .55, idle: .32, unknown: .2 }[st];
      const tg = base + Math.sin(t * sp + k) * amp; n.glow += (tg - n.glow) * Math.min(1, ds * 4);
      n.flare = Math.max(0, n.flare - ds * .8);
      n.hoverK += ((this.hover === k + 1 ? 1 : 0) - n.hoverK) * Math.min(1, ds * 8); n.selK += ((this.selected === k + 1 ? 1 : 0) - n.selK) * Math.min(1, ds * 5);
      const sc = ease.outBack(ap) * (1 + n.hoverK * .18 + n.selK * .12 + n.flare * .3); n.grp.scale.setScalar(Math.max(.001, sc));
      animateAvatar(n.av, n, t, ds, now, this.camera, n.glow); n.av.badge.position.y = n.av.top + .78 + Math.sin(t * 1.3 + k) * .05; n.av.badge.material.opacity = (.55 + n.glow * .35 + n.hoverK * .3) * ap;
      n.halo.material.opacity = (.1 + n.glow * .22 + n.flare * .5 + n.hoverK * .18) * ap; n.halo.scale.setScalar(3 + n.glow * .9 + n.flare * 2.2);
      n.ring.rotation.z += ds * (st === "working" ? 1.6 : st === "waiting" ? -.6 : .15) * mo;
      n.ring.material.color.set(st === "waiting" ? "#fbbf24" : n.bot.color); n.ring.material.opacity = ({ working: .42, waiting: .36, idle: .14, unknown: .07 }[st] + n.flare * .3) * ap;
      n.sel.material.opacity = n.selK * .9; n.sel.rotation.set(Math.PI / 2 + Math.sin(t * .9) * .12, Math.cos(t * .7) * .12, t * .5); n.sel.position.y = -.2; n.sel.scale.setScalar(1 + Math.sin(t * 3) * .03);
      n.grp.getWorldPosition(n.world);
      tmp.copy(n.world); tmp.y += n.av.top + 1.2;
      labItems.push({ el: n.label, v: tmp.clone(), op: ap });
    });
    labItems.push({ el: this.coreLabel, v: new THREE.Vector3(0, 2.55, 0), op: Math.min(1, t / 1.2) });
    this.layoutLabels(labItems);
    // hover raycast (desktop)
    if (this.ptrActive) this.setHover(this.pick());
    // transient beams
    const B = 1700, HOLD = 600, FADE = 1300;
    this.beams = this.beams.filter(b => {
      const age = now - b.t0, P = this.curve(b.i, b.dir); let head, tail = 0, op = 1;
      head = ease.inOutSine(Math.min(1, age / B)) * 1.06;
      if (age > B + HOLD) { const k = Math.min(1, (age - B - HOLD) / FADE); tail = ease.inOutCubic(k) * 1.05; op = 1 - k * .5; }
      if (!b.hit && age > B * .96) { b.hit = true; if (b.dir === "out") { const n = this.nodes[b.i - 1]; n.flare = 1.2; this.shock(n.world.clone().add(new THREE.Vector3(0, -.9, 0)), n.bot.color, 4); } else this.flareCore(.9); }
      this.updBeam(b.m, P, head, tail, op, t, b.dir === "out" ? 1 : -1);
      if (age > B + HOLD + FADE) { this.disposeBeam(b.m); return false; } return true;
    });
    // persistent links (routed, awaiting answer)
    for (const [i, L] of this.links) {
      const P = this.curve(i, "out"), age = (now - L.t0) / 1000;
      let op = Math.min(1, age / 1.2) * .55; if (L.fading) { const k = (now - L.fading) / 900; op *= Math.max(0, 1 - k); if (k >= 1) { this.disposeBeam(L.m); this.links.delete(i); continue; } }
      const head = ((age * .42) % 1.25); this.updBeam(L.m, P, 1.02, 0, op, t, .6);
      const h = Math.min(head, 1), a = P[0].clone().lerp(P[1], h), b = P[1].clone().lerp(P[2], h); L.m.packet.position.copy(a.lerp(b, h)); L.m.packet.material.opacity = head > 1 ? 0 : op * 1.4;
    }
    // shockwaves
    this.flares = this.flares.filter(f => { const k = (now - f.t0) / 1400; if (k >= 1) { this.scene.remove(f.m); f.m.material.dispose(); f.m.geometry.dispose(); return false; }
      const e = ease.outExpo(k); f.m.scale.setScalar(.5 + e * f.size); f.m.material.opacity = (1 - k) * .9; f.m.rotation.z = k * 1.5; return true; });
    this.finish.uniforms.uTime.value = t;
    this.composer.render();
  }
  measureLabel(el) {
    const key = (el.classList.contains("sel") ? "s" : "") + (el.classList.contains("hov") ? "h" : "") + this.w + "x" + this.h;
    if (el._mkey === key && el._lw) return;
    el._lw = Math.max(1, el.offsetWidth);
    el._lh = Math.max(1, el.offsetHeight);
    el._mkey = key;
  }
  layoutLabels(items) {
    const w = this.w, h = this.h, cam = this.camera;
    const mt = (w <= 820 ? 70 : 18), mb = (w <= 820 ? 136 : 96), mx = 8, gap = 6;
    let leftPad = mx, rightPad = mx;
    if (w > 820) {
      const L = document.getElementById("left"), R = document.getElementById("right");
      if (L && L.classList.contains("open")) { const r = L.getBoundingClientRect(); if (r.width > 40) leftPad = Math.max(leftPad, Math.round(r.right) + 8); }
      if (R && R.classList.contains("open")) { const r = R.getBoundingClientRect(); if (r.width > 40) rightPad = Math.max(rightPad, Math.round(w - r.left) + 8); }
    }
    const boxes = [];
    for (const it of items) {
      const el = it.el, p = it.v.clone().project(cam);
      const vis = p.z < 1 && Math.abs(p.x) < 1.35 && Math.abs(p.y) < 1.35;
      if (!vis) { boxes.push({ el, vis: false, op: it.op }); continue; }
      this.measureLabel(el);
      const ax = (p.x * .5 + .5) * w, ay = (-p.y * .5 + .5) * h;
      const dist = cam.position.distanceTo(it.v), s = Math.max(.72, Math.min(1.15, 18 / dist));
      const lw = el._lw * s, lh = el._lh * s;
      boxes.push({ el, vis: true, ax, ay, lx: ax - lw / 2, ly: ay - lh, lw, lh, s, dist, op: it.op });
    }
    const clampBox = b => { b.lx = Math.max(leftPad, Math.min(w - rightPad - b.lw, b.lx)); b.ly = Math.max(mt, Math.min(h - mb - b.lh, b.ly)); };
    const visB = boxes.filter(b => b.vis);
    visB.forEach(clampBox);
    for (let iter = 0; iter < 4; iter++) {
      for (let i = 0; i < visB.length; i++) {
        for (let j = i + 1; j < visB.length; j++) {
          const a = visB[i], o = visB[j];
          if (!(a.lx < o.lx + o.lw + gap && a.lx + a.lw + gap > o.lx && a.ly < o.ly + o.lh + gap && a.ly + a.lh + gap > o.ly)) continue;
          const aCore = a.el.classList.contains("core"), oCore = o.el.classList.contains("core");
          let move = a, stay = o;
          if (aCore && !oCore) { move = o; stay = a; }
          else if (!aCore && oCore) { move = a; stay = o; }
          else if (a.ay > o.ay) { move = a; stay = o; }
          if (move.ay <= stay.ay) move.ly = stay.ly - move.lh - gap;
          else move.ly = stay.ly + stay.lh + gap;
          clampBox(move);
        }
      }
      for (const a of visB) {
        for (const o of visB) {
          if (a === o) continue;
          if (o.ax >= a.lx - 4 && o.ax <= a.lx + a.lw + 4 && o.ay >= a.ly - 4 && o.ay <= a.ly + a.lh + 4) {
            a.ly = Math.min(a.ly, o.ay - a.lh - gap - 4);
            clampBox(a);
          }
        }
      }
    }
    for (const b of boxes) {
      const el = b.el, lead = el.querySelector(":scope > .nl-lead");
      if (!b.vis) {
        el.style.opacity = 0;
        el.classList.remove("shifted");
        if (lead) { lead.style.opacity = 0; lead.style.height = "0"; }
        continue;
      }
      el.style.opacity = el.classList.contains("dim") ? .35 * b.op : b.op;
      el.style.zIndex = String(1000 - Math.round(b.dist * 10));
      el.style.transform = `translate3d(${b.lx.toFixed(1)}px,${b.ly.toFixed(1)}px,0) scale(${b.s.toFixed(3)})`;
      const dx = (b.lx + b.lw / 2) - b.ax, dy = (b.ly + b.lh) - b.ay;
      const shifted = Math.hypot(dx, dy) > 8;
      el.classList.toggle("shifted", shifted);
      if (lead) {
        if (shifted) {
          const x0 = el._lw / 2, y0 = el._lh, x1 = (b.ax - b.lx) / b.s, y1 = (b.ay - b.ly) / b.s;
          const ddx = x1 - x0, ddy = y1 - y0, dist = Math.hypot(ddx, ddy), ang = Math.atan2(ddy, ddx) - Math.PI / 2;
          lead.style.height = dist.toFixed(1) + "px";
          lead.style.opacity = "1";
          lead.style.transform = `translate(${x0.toFixed(1)}px,${y0.toFixed(1)}px) rotate(${ang.toFixed(3)}rad)`;
        } else {
          lead.style.opacity = "0";
          lead.style.height = "0";
        }
      }
    }
  }
}

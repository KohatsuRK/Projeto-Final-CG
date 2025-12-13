// track.js - WebGL com árvores procedurais (cross-quads) + grama procedural + asfalto
'use strict';

const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl', { antialias: true });
if (!gl) { alert('Seu navegador não suporta WebGL.'); throw new Error('webgl'); }

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.floor(window.innerWidth * dpr);
  const h = Math.floor(window.innerHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w; canvas.height = h;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    gl.viewport(0,0,canvas.width,canvas.height);
  }
}
window.addEventListener('resize', resize);
resize();

// ---------- SHADERS ----------
const VS = `
attribute vec3 aPos;
attribute vec2 aUV;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
varying vec2 vUV;
void main(){
  vUV = aUV;
  gl_Position = uProj * uView * uModel * vec4(aPos,1.0);
}
`;

/* Fragment shader with tree mode (uTexMode == 3)
   - uUseTex : enable procedural texturing
   - uTexMode : 1=grass, 2=asphalt, 3=trees
*/
const FS = `
precision mediump float;
varying vec2 vUV;
uniform vec3 uColor;
uniform bool uUseTex;
uniform int uTexMode;
uniform float uTime;

// ----------------- hash / noise -----------------
float hash21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(a,b,u.x) + (c-a)*u.y*(1.0 - u.x) + (d-b)*u.x*u.y;
}

float fbm(vec2 p){
  float v = 0.0;
  float a = 0.5;
  for(int i=0;i<4;i++){
    v += a * noise(p);
    p = p * 2.0 + 37.0;
    a *= 0.5;
  }
  return v;
}

// ----------------- TREE SHAPES (draw on UV) -----------------
vec4 treeProcedural(vec2 uv, float seed){
  // trunk: lower region (v < trunkTop)
  float trunkTop = 0.28 + seed * 0.08;
  float trunkWidth = 0.12 + seed * 0.06;
  float trunkMask = smoothstep(0.0, 0.008, trunkWidth*0.5 - abs(uv.x - 0.5)) * smoothstep(trunkTop, trunkTop - 0.02, uv.y);
  vec3 trunkCol = vec3(0.35, 0.18, 0.08) * (0.9 + seed*0.2);

  // canopy
  vec2 cpos = vec2(0.5, 0.65 + seed * 0.06);
  float r = 0.35 + seed * 0.08;
  float dist = distance(uv, cpos);
  float canopyMask = smoothstep(r, r-0.05, dist);

  float n = fbm((uv + seed*7.0) * 6.0);
  vec3 canopyBase = vec3(0.06, 0.45, 0.06) * (0.85 + seed*0.2);
  canopyBase += n * 0.08;
  float light = pow(max(0.0, 1.0 - dist / r), 1.8) * 0.12;
  canopyBase += light;

  float alpha = max(trunkMask, canopyMask);
  vec3 color = mix(trunkCol, canopyBase, step(trunkTop, uv.y));
  return vec4(color, alpha);
}

void main(){
  // default flat color if no texture
  if(!uUseTex){
    gl_FragColor = vec4(uColor, 1.0);
    return;
  }

  // ---------- GRASS procedural ----------
  if(uTexMode == 1){
    vec2 uv = vUV * 10.0;
    float n1 = noise(uv * 3.0);
    float n2 = noise(uv * 0.7);
    float grass = mix(n1, n2, 0.5);
    vec3 base = vec3(0.05, 0.45, 0.06);
    base += grass * 0.18;
    gl_FragColor = vec4(base, 1.0);
    return;
  }

  // ---------- ASPHALT / CONCRETE ----------
  // ---------- ASPHALT / CONCRETE ----------
if(uTexMode == 2){
    vec2 uv = vUV * vec2(20.0, 60.0);
    
    // Base concrete color
    vec3 baseColor = vec3(0.45, 0.45, 0.47);
    
    // Texture variation
    float n1 = noise(uv * 0.8);
    float n2 = noise(uv * 3.0);
    float n3 = noise(uv * 8.0);
    float pattern = n1 * 0.7 + n2 * 0.2 + n3 * 0.1;
    baseColor += pattern * 0.08;
    
    // Lane markings
    float trackX = vUV.x; // 0 to 1 across track width
    
    // Continuous yellow center line
    float centerLineWidth = 0.015;
    if(abs(trackX - 0.5) < centerLineWidth) {
        baseColor = vec3(1.0, 0.9, 0.0); // Yellow
    }
    
    // Dashed lane separators
    float dashLength = 0.05;
    float gapLength = 0.05;
    float dashPattern = mod(vUV.y * 25.0, dashLength + gapLength);
    bool isDash = dashPattern < dashLength;
    
    // Left lane separator (dashed white)
    float laneSepWidth = 0.01;
    float leftLanePos = 0.3333;
    if(abs(trackX - leftLanePos) < laneSepWidth && isDash) {
        baseColor = vec3(1.0, 1.0, 1.0); // White
    }
    
    // Right lane separator (dashed white)
    float rightLanePos = 0.6667;
    if(abs(trackX - rightLanePos) < laneSepWidth && isDash) {
        baseColor = vec3(1.0, 1.0, 1.0); // White
    }
    
    // Edge lines (continuous white)
    float edgeWidth = 0.008;
    if(trackX < edgeWidth || trackX > 1.0 - edgeWidth) {
        baseColor = vec3(1.0, 1.0, 1.0); // White
    }
    
    // Add some subtle grain
    float grain = noise(uv * 50.0) * 0.03;
    baseColor += grain;
    baseColor = clamp(baseColor, vec3(0.38, 0.38, 0.40), vec3(0.52, 0.52, 0.54));
    
    gl_FragColor = vec4(baseColor, 1.0);
    return;
}

  // ---------- TREES procedural ----------
  if(uTexMode == 3){
    float seed = fract((vUV.x + vUV.y) * 437.1);
    vec4 t = treeProcedural(vUV, seed);
    if(t.a < 0.01) discard;
    gl_FragColor = vec4(t.rgb, 1.0);
    return;
  }

  // fallback
  gl_FragColor = vec4(uColor, 1.0);
}
`;

// compile helpers
function compileShader(type, src){
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
  }
  return s;
}
function createProgram(vsSrc, fsSrc){
  const vs = compileShader(gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl.FRAGMENT_SHADER, fsSrc);
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(p));
  return p;
}
const program = createProgram(VS, FS);
gl.useProgram(program);

// locations
const aPos = gl.getAttribLocation(program, 'aPos');
const aUV  = gl.getAttribLocation(program, 'aUV');
const uProj = gl.getUniformLocation(program, 'uProj');
const uView = gl.getUniformLocation(program, 'uView');
const uModel = gl.getUniformLocation(program, 'uModel');
const uColor = gl.getUniformLocation(program, 'uColor');
const uUseTex = gl.getUniformLocation(program, 'uUseTex');
const uTexMode = gl.getUniformLocation(program, 'uTexMode');
const uTime = gl.getUniformLocation(program, 'uTime');

gl.enable(gl.DEPTH_TEST);
gl.enable(gl.CULL_FACE);

// ---------- utility ----------
function createBufferWithUV(arr){
  const b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
  b.count = arr.length / 5;
  return b;
}

// ---------- GEOMETRY ----------
const TRACK_LENGTH = 200;
const LANE_WIDTH = 2.0;
const TOTAL_WIDTH = LANE_WIDTH * 3;

// track
const trackVerts = [
  -TOTAL_WIDTH/2, 0, 0,   0,0,
   TOTAL_WIDTH/2, 0, 0,   1,0,
   TOTAL_WIDTH/2, 0, -TRACK_LENGTH, 1,1,
  -TOTAL_WIDTH/2, 0, 0,   0,0,
   TOTAL_WIDTH/2, 0, -TRACK_LENGTH, 1,1,
  -TOTAL_WIDTH/2, 0, -TRACK_LENGTH, 0,1
];
const bufTrack = createBufferWithUV(trackVerts);

// walls (muretas)
const wallVerts = [];
for(let z=0; z<TRACK_LENGTH; z+=2){
  const h = 0.8;
  const seg = 2.0;
  const xL = -TOTAL_WIDTH/2 - 0.05;
  wallVerts.push(xL,0,-z, 0,0);
  wallVerts.push(xL,h,-z, 0,0);
  wallVerts.push(xL,h,-z-seg, 0,0);
  wallVerts.push(xL,0,-z, 0,0);
  wallVerts.push(xL,h,-z-seg, 0,0);
  wallVerts.push(xL,0,-z-seg, 0,0);
  const xR = TOTAL_WIDTH/2 + 0.05;
  wallVerts.push(xR,0,-z, 0,0);
  wallVerts.push(xR,h,-z, 0,0);
  wallVerts.push(xR,h,-z-seg, 0,0);
  wallVerts.push(xR,0,-z, 0,0);
  wallVerts.push(xR,h,-z-seg, 0,0);
  wallVerts.push(xR,0,-z-seg, 0,0);
}
const bufWalls = createBufferWithUV(wallVerts);

// GRASS geometry (left and right)
const GRASS_WIDTH = 6.0;
const leftStart = -TOTAL_WIDTH/2 - 0.40 - GRASS_WIDTH;
const leftEnd   = -TOTAL_WIDTH/2 - 0.40;
const rightStart = TOTAL_WIDTH/2 + 0.40;
const rightEnd   = TOTAL_WIDTH/2 + 0.40 + GRASS_WIDTH;

const grassVerts = [
  leftStart,0,0,    0.0, 0.0,
  leftEnd,  0,0,    1.0, 0.0,
  leftEnd,  0,-TRACK_LENGTH, 1.0, TRACK_LENGTH/4.0,
  leftStart,0,0,    0.0, 0.0,
  leftEnd,  0,-TRACK_LENGTH, 1.0, TRACK_LENGTH/4.0,
  leftStart,0,-TRACK_LENGTH, 0.0, TRACK_LENGTH/4.0,

  rightStart,0,0,   0.0, 0.0,
  rightEnd,  0,0,   1.0, 0.0,
  rightEnd,  0,-TRACK_LENGTH, 1.0, TRACK_LENGTH/4.0,
  rightStart,0,0,   0.0, 0.0,
  rightEnd,  0,-TRACK_LENGTH, 1.0, TRACK_LENGTH/4.0,
  rightStart,0,-TRACK_LENGTH, 0.0, TRACK_LENGTH/4.0
];
const bufGrass = createBufferWithUV(grassVerts);

// sky
const skyVerts = [
  -2000,120,0, 0,0,
   2000,120,0, 0,0,
   2000,120,-TRACK_LENGTH, 0,0,
  -2000,120,0, 0,0,
   2000,120,-TRACK_LENGTH, 0,0,
  -2000,120,-TRACK_LENGTH, 0,0
];
const bufSky = createBufferWithUV(skyVerts);

// sphere (player)
function makeSphereVerts(radius=0.35, latBands=10, longBands=16){
  const v=[];
  for(let lat=0; lat<latBands; lat++){
    const t1 = Math.PI * lat / latBands;
    const t2 = Math.PI * (lat+1) / latBands;
    for(let lon=0; lon<longBands; lon++){
      const p1 = 2*Math.PI * lon / longBands;
      const p2 = 2*Math.PI * (lon+1) / longBands;
      const x1 = radius * Math.sin(t1) * Math.cos(p1);
      const y1 = radius * Math.cos(t1);
      const z1 = radius * Math.sin(t1) * Math.sin(p1);
      const x2 = radius * Math.sin(t2) * Math.cos(p1);
      const y2 = radius * Math.cos(t2);
      const z2 = radius * Math.sin(t2) * Math.sin(p1);
      const x3 = radius * Math.sin(t2) * Math.cos(p2);
      const y3 = radius * Math.cos(t2);
      const z3 = radius * Math.sin(t2) * Math.sin(p2);
      const x4 = radius * Math.sin(t1) * Math.cos(p2);
      const y4 = radius * Math.cos(t1);
      const z4 = radius * Math.sin(t1) * Math.sin(p2);
      v.push(x1,y1,z1,0,0, x2,y2,z2,0,0, x3,y3,z3,0,0);
      v.push(x1,y1,z1,0,0, x3,y3,z3,0,0, x4,y4,z4,0,0);
    }
  }
  return createBufferWithUV(v);
}
const bufSphere = makeSphereVerts();

// ---------- TREES: generate cross quads on grass regions ----------
function createTreeBuffers(){
  const verts = [];

  const TREE_COUNT_LEFT = 24;
  const TREE_COUNT_RIGHT = 24;

  function pushCrossTree(cx, cz, w, h, seed){
    const x0 = cx - w*0.5, x1 = cx + w*0.5;
    const z0 = cz, z1 = cz;
    
    // first quad
    verts.push(x0, 0, z0,  0,0);
    verts.push(x1, 0, z1,  1,0);
    verts.push(x1, h, z1,  1,1);

    verts.push(x0, 0, z0,  0,0);
    verts.push(x1, h, z1,  1,1);
    verts.push(x0, h, z0,  0,1);

    // second quad (perpendicular)
    verts.push(cx, 0, cz - w*0.5,  0,0);
    verts.push(cx, 0, cz + w*0.5,  1,0);
    verts.push(cx, h, cz + w*0.5,  1,1);

    verts.push(cx, 0, cz - w*0.5,  0,0);
    verts.push(cx, h, cz + w*0.5,  1,1);
    verts.push(cx, h, cz - w*0.5,  0,1);
  }

  // left side trees
  for(let i=0;i<TREE_COUNT_LEFT;i++){
    const rx = leftStart + 0.5 + Math.random() * (leftEnd - (leftStart + 0.5));
    const rz = -5 - Math.random() * (TRACK_LENGTH - 10);
    const scale = 0.8 + Math.random() * 0.8;
    const width = 0.8 * scale;
    const height = 1.6 * scale;
    pushCrossTree(rx, rz, width, height, Math.random());
  }

  // right side trees
  for(let i=0;i<TREE_COUNT_RIGHT;i++){
    const rx = rightStart + 0.5 + Math.random() * (rightEnd - (rightStart + 0.5));
    const rz = -5 - Math.random() * (TRACK_LENGTH - 10);
    const scale = 0.8 + Math.random() * 0.8;
    const width = 0.8 * scale;
    const height = 1.6 * scale;
    pushCrossTree(rx, rz, width, height, Math.random());
  }

  return createBufferWithUV(verts);
}

const bufTrees = createTreeBuffers();

// ---------- MATRIZES ----------
function perspective(out, fovy, aspect, near, far){
  const f = 1.0 / Math.tan(fovy/2);
  out = out || new Float32Array(16);
  out[0] = f/aspect; out[1]=0; out[2]=0; out[3]=0;
  out[4]=0; out[5]=f; out[6]=0; out[7]=0;
  out[8]=0; out[9]=0; out[10]=(far+near)/(near-far); out[11]=-1;
  out[12]=0; out[13]=0; out[14]=(2*far*near)/(near-far); out[15]=0;
  return out;
}
function identity(){ return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); }
function translate(out, m, v){
  out = out || new Float32Array(m);
  out[12] = m[0]*v[0] + m[4]*v[1] + m[8]*v[2] + m[12];
  out[13] = m[1]*v[0] + m[5]*v[1] + m[9]*v[2] + m[13];
  out[14] = m[2]*v[0] + m[6]*v[1] + m[10]*v[2] + m[14];
  out[15] = m[3]*v[0] + m[7]*v[1] + m[11]*v[2] + m[15];
  out[0]=m[0]; out[1]=m[1]; out[2]=m[2]; out[3]=m[3];
  out[4]=m[4]; out[5]=m[5]; out[6]=m[6]; out[7]=m[7];
  out[8]=m[8]; out[9]=m[9]; out[10]=m[10]; out[11]=m[11];
  return out;
}
function lookAt(eye, center, up){
  const z0 = eye[0]-center[0], z1 = eye[1]-center[1], z2 = eye[2]-center[2];
  let len = Math.hypot(z0,z1,z2) || 1;
  const zx = z0/len, zy=z1/len, zz=z2/len;
  let xx = up[1]*zz - up[2]*zy;
  let xy = up[2]*zx - up[0]*zz;
  let xz = up[0]*zy - up[1]*zx;
  len = Math.hypot(xx,xy,xz) || 1;
  const x0 = xx/len, x1=xy/len, x2=xz/len;
  const y0 = zy*x2 - zz*x1;
  const y1 = zz*x0 - zx*x2;
  const y2 = zx*x1 - zy*x0;
  return new Float32Array([
    x0, y0, zx, 0,
    x1, y1, zy, 0,
    x2, y2, zz, 0,
    -(x0*eye[0]+x1*eye[1]+x2*eye[2]),
    -(y0*eye[0]+y1*eye[1]+y2*eye[2]),
    -(zx*eye[0]+zy*eye[1]+zz*eye[2]),
    1
  ]);
}

const projMat = perspective(null, Math.PI/3, canvas.width/canvas.height, 0.1, 2000);
gl.uniformMatrix4fv(uProj, false, projMat);

// ---------- PLAYER ----------
const LANE_CENTER_X = [ -LANE_WIDTH, 0, LANE_WIDTH ];
let player = {
  laneIndex: 1,
  targetLane: 1,
  x: 0,
  z: -1,
  y: 0.35,
  radius: 0.35,
  forwardSpeed: 6
};

window.addEventListener('keydown', (e)=>{
  const k = e.key.toLowerCase();
  if(k === 'arrowleft' || k === 'a'){
    player.targetLane = Math.max(0, player.targetLane - 1);
  }
  if(k === 'arrowright' || k === 'd'){
    player.targetLane = Math.min(2, player.targetLane + 1);
  }
});

function clampToWalls(x){
  const half = TOTAL_WIDTH/2 - 0.4;
  return Math.max(-half, Math.min(half, x));
}

// ---------- ATTRIB ----------
function setAttrib(buf){
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(aUV);
  gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 20, 12);
}

// ---------- DRAW ----------
function draw(buf, model, color, texMode=null){
  gl.uniformMatrix4fv(uModel, false, model);

  if(texMode){
    gl.uniform1i(uUseTex, 1);
    if(texMode === "grass") gl.uniform1i(uTexMode, 1);
    else if(texMode === "asphalt") gl.uniform1i(uTexMode, 2);
    else if(texMode === "tree") gl.uniform1i(uTexMode, 3);
    else gl.uniform1i(uTexMode, 0);
  } else {
    gl.uniform1i(uUseTex, 0);
    gl.uniform3fv(uColor, color);
  }

  gl.uniform1f(uTime, performance.now() * 0.001);

  setAttrib(buf);
  gl.drawArrays(gl.TRIANGLES, 0, buf.count);
}

// ---------- MAIN LOOP ----------
let last = performance.now();
function update(dt){
  player.z -= player.forwardSpeed * dt;

  const targetX = LANE_CENTER_X[player.targetLane];
  player.x += (targetX - player.x) * Math.min(1, 6 * dt);
  player.x = clampToWalls(player.x);

  if(Math.abs(player.z) >= TRACK_LENGTH){
    player.z = -TRACK_LENGTH;
    player.forwardSpeed = 0;
  }
}

function render(){
  resize();
  const now = performance.now();
  const dt = Math.min(0.05, (now-last)/1000);
  last = now;
  update(dt);

  const camEye = [ player.x*0.3, 4.0, player.z + 6.5 ];
  const camTarget = [ player.x, 0.8, player.z - 4.0 ];
  const viewMat = lookAt(camEye, camTarget, [0,1,0]);
  gl.uniformMatrix4fv(uView, false, viewMat);

  gl.clearColor(0.53,0.80,0.92,1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // sky
  draw(bufSky, identity(), [0.40,0.60,1.00]);

  // grass procedural sides
  draw(bufGrass, identity(), null, "grass");

  // asphalt track (now concrete polished)
  draw(bufTrack, identity(), null, "asphalt");

  // walls
  draw(bufWalls, identity(), [0.7,0.12,0.12]);

  // draw trees
  gl.disable(gl.CULL_FACE);
  draw(bufTrees, identity(), null, "tree");
  gl.enable(gl.CULL_FACE);

  // sphere (player)
  const modelSphere = translate(identity(), identity(), [player.x, player.y, player.z]);
  draw(bufSphere, modelSphere, [0.95,0.45,0.2]);

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
// track.js - WebGL COMPLETO COM ILUMINAÇÃO
'use strict';

const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl', { antialias: true });
if (!gl) { alert('Seu navegador não suporta WebGL.'); throw new Error('webgl'); }

let isGameRunning = false;
let isPaused = false;

const startScreen = document.getElementById('start-screen');
const pauseScreen = document.getElementById('pause-screen');
const btnStart = document.getElementById('btn-start');
const btnResume = document.getElementById('btn-resume');

btnStart.addEventListener('click', startGame);
btnResume.addEventListener('click', togglePause);

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

// ---------- SHADERS PRINCIPAL ----------
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

const FS = `
precision mediump float;
varying vec2 vUV;
uniform vec3 uColor;
uniform bool uUseTex;
uniform int uTexMode;
uniform float uTime;

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

vec4 treeProcedural(vec2 uv, float seed){
  float trunkTop = 0.28 + seed * 0.08;
  float trunkWidth = 0.12 + seed * 0.06;
  float trunkMask = smoothstep(0.0, 0.008, trunkWidth*0.5 - abs(uv.x - 0.5)) * smoothstep(trunkTop, trunkTop - 0.02, uv.y);
  vec3 trunkCol = vec3(0.35, 0.18, 0.08) * (0.9 + seed*0.2);

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
  if(!uUseTex){
    gl_FragColor = vec4(uColor, 1.0);
    return;
  }

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

  if(uTexMode == 2){
    vec2 uv = vUV * vec2(20.0, 60.0);
    vec3 baseColor = vec3(0.45, 0.45, 0.47);
    
    float n1 = noise(uv * 0.8);
    float n2 = noise(uv * 3.0);
    float n3 = noise(uv * 8.0);
    float pattern = n1 * 0.7 + n2 * 0.2 + n3 * 0.1;
    baseColor += pattern * 0.08;
    
    float trackX = vUV.x;
    float centerLineWidth = 0.015;
    if(abs(trackX - 0.5) < centerLineWidth) {
        baseColor = vec3(1.0, 0.9, 0.0);
    }
    
    float dashLength = 0.05;
    float gapLength = 0.05;
    float dashPattern = mod(vUV.y * 25.0, dashLength + gapLength);
    bool isDash = dashPattern < dashLength;
    
    float laneSepWidth = 0.01;
    if(abs(trackX - 0.3333) < laneSepWidth && isDash) {
        baseColor = vec3(1.0, 1.0, 1.0);
    }
    if(abs(trackX - 0.6667) < laneSepWidth && isDash) {
        baseColor = vec3(1.0, 1.0, 1.0);
    }
    
    float edgeWidth = 0.008;
    if(trackX < edgeWidth || trackX > 1.0 - edgeWidth) {
        baseColor = vec3(1.0, 1.0, 1.0);
    }
    
    float grain = noise(uv * 50.0) * 0.03;
    baseColor += grain;
    baseColor = clamp(baseColor, vec3(0.38, 0.38, 0.40), vec3(0.52, 0.52, 0.54));
    
    gl_FragColor = vec4(baseColor, 1.0);
    return;
  }

  if(uTexMode == 3){
    float seed = fract((vUV.x + vUV.y) * 437.1);
    vec4 t = treeProcedural(vUV, seed);
    if(t.a < 0.01) discard;
    gl_FragColor = vec4(t.rgb, 1.0);
    return;
  }

  gl_FragColor = vec4(uColor, 1.0);
}
`;

// ---------- SHADERS COM ILUMINAÇÃO (Moedas e Barris) ----------
const VS_COIN = window.shadersComLuz ? window.shadersComLuz.vertex : `
attribute vec3 aVertexPosition;
attribute vec2 aTextureCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
varying highp vec2 vTextureCoord;
void main(void) {
    gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aVertexPosition, 1.0);
    vTextureCoord = aTextureCoord;
}
`;

const FS_COIN = window.shadersComLuz ? window.shadersComLuz.fragment : `
varying highp vec2 vTextureCoord;
uniform sampler2D uSampler;
void main(void) {
    gl_FragColor = texture2D(uSampler, vTextureCoord);
}
`;

// ---------- SHADERS DAS BOMBAS ----------
const VS_BOMB = `
attribute vec3 aVertexPosition;
attribute vec2 aTextureCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
varying highp vec2 vTextureCoord;
void main(void) {
    gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aVertexPosition, 1.0);
    vTextureCoord = aTextureCoord;
}
`;

const FS_BOMB = `
varying highp vec2 vTextureCoord;
uniform sampler2D uSampler;
void main(void) {
    if(vTextureCoord.x < 0.5){
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
    gl_FragColor = texture2D(uSampler, vTextureCoord);
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

const programCoin = createProgram(VS_COIN, FS_COIN);

const programBomb = createProgram(VS_BOMB, FS_BOMB);

const aPos = gl.getAttribLocation(program, 'aPos');
const aUV  = gl.getAttribLocation(program, 'aUV');
const uProj = gl.getUniformLocation(program, 'uProj');
const uView = gl.getUniformLocation(program, 'uView');
const uModel = gl.getUniformLocation(program, 'uModel');
const uColor = gl.getUniformLocation(program, 'uColor');
const uUseTex = gl.getUniformLocation(program, 'uUseTex');
const uTexMode = gl.getUniformLocation(program, 'uTexMode');
const uTime = gl.getUniformLocation(program, 'uTime');

const aVertexPosition = gl.getAttribLocation(programCoin, 'aVertexPosition');
const aTextureCoord = gl.getAttribLocation(programCoin, 'aTextureCoord');
const aNormalCoin = gl.getAttribLocation(programCoin, 'aVertexNormal');
const uProjectionMatrix = gl.getUniformLocation(programCoin, 'uProjectionMatrix');
const uModelViewMatrix = gl.getUniformLocation(programCoin, 'uModelViewMatrix');
const uSampler = gl.getUniformLocation(programCoin, 'uSampler');

let configLuzCoin = null;
if (window.configurarIluminacao) {
    configLuzCoin = window.configurarIluminacao(gl, programCoin);
}

const aBombVertexPosition = gl.getAttribLocation(programBomb, 'aVertexPosition');
const aBombTextureCoord = gl.getAttribLocation(programBomb, 'aTextureCoord');
const uBombProjectionMatrix = gl.getUniformLocation(programBomb, 'uProjectionMatrix');
const uBombModelViewMatrix = gl.getUniformLocation(programBomb, 'uModelViewMatrix');
const uBombSampler = gl.getUniformLocation(programBomb, 'uSampler');

gl.enable(gl.DEPTH_TEST);
gl.enable(gl.CULL_FACE);

// ---------- VARIÁVEL DE CONTROLE DA CÂMERA ----------
let cameraMode = 0;

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
const BACK_BUFFER = 50;

const trackVerts = [
  -TOTAL_WIDTH/2, 0, BACK_BUFFER,   0,0, 
   TOTAL_WIDTH/2, 0, BACK_BUFFER,   1,0, 
   TOTAL_WIDTH/2, 0, -TRACK_LENGTH, 1,1,
  -TOTAL_WIDTH/2, 0, BACK_BUFFER,   0,0, 
   TOTAL_WIDTH/2, 0, -TRACK_LENGTH, 1,1,
  -TOTAL_WIDTH/2, 0, -TRACK_LENGTH, 0,1
];
const bufTrack = createBufferWithUV(trackVerts);

const wallVerts = [];
for(let z=-BACK_BUFFER; z<TRACK_LENGTH; z+=2){
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

const GRASS_WIDTH = 6.0;
const leftStart = -TOTAL_WIDTH/2 - 0.40 - GRASS_WIDTH;
const leftEnd   = -TOTAL_WIDTH/2 - 0.40;
const rightStart = TOTAL_WIDTH/2 + 0.40;
const rightEnd   = TOTAL_WIDTH/2 + 0.40 + GRASS_WIDTH;

const grassVerts = [
  leftStart,0, BACK_BUFFER,    0.0, 0.0,
  leftEnd,  0, BACK_BUFFER,    1.0, 0.0,
  leftEnd,  0,-TRACK_LENGTH, 1.0, TRACK_LENGTH/4.0,
  leftStart,0, BACK_BUFFER,    0.0, 0.0,
  leftEnd,  0,-TRACK_LENGTH, 1.0, TRACK_LENGTH/4.0,
  leftStart,0,-TRACK_LENGTH, 0.0, TRACK_LENGTH/4.0,

  rightStart,0, BACK_BUFFER,   0.0, 0.0,
  rightEnd,  0, BACK_BUFFER,   1.0, 0.0,
  rightEnd,  0,-TRACK_LENGTH, 1.0, TRACK_LENGTH/4.0,
  rightStart,0, BACK_BUFFER,   0.0, 0.0,
  rightEnd,  0,-TRACK_LENGTH, 1.0, TRACK_LENGTH/4.0,
  rightStart,0,-TRACK_LENGTH, 0.0, TRACK_LENGTH/4.0
];
const bufGrass = createBufferWithUV(grassVerts);

const skyVerts = [
  -2000,120, BACK_BUFFER, 0,0, // Era 0
   2000,120, BACK_BUFFER, 0,0, // Era 0
   2000,120,-TRACK_LENGTH, 0,0,
  -2000,120, BACK_BUFFER, 0,0, // Era 0
   2000,120,-TRACK_LENGTH, 0,0,
  -2000,120,-TRACK_LENGTH, 0,0
];
const bufSky = createBufferWithUV(skyVerts);

// ---------- CHARACTER GEOMETRY ----------
function makeCharacterGeometry(){
  function createBox(w, h, d){
    const hw = w/2, hh = h/2, hd = d/2;
    return [
      -hw,-hh, hd, 0,0,  hw,-hh, hd, 1,0,  hw, hh, hd, 1,1,
      -hw,-hh, hd, 0,0,  hw, hh, hd, 1,1,  -hw, hh, hd, 0,1,
      hw,-hh,-hd, 0,0,  -hw,-hh,-hd, 1,0,  -hw, hh,-hd, 1,1,
      hw,-hh,-hd, 0,0,  -hw, hh,-hd, 1,1,  hw, hh,-hd, 0,1,
      -hw, hh,-hd, 0,0,  hw, hh,-hd, 1,0,  hw, hh, hd, 1,1,
      -hw, hh,-hd, 0,0,  hw, hh, hd, 1,1,  -hw, hh, hd, 0,1,
      -hw,-hh, hd, 0,0,  hw,-hh, hd, 1,0,  hw,-hh,-hd, 1,1,
      -hw,-hh, hd, 0,0,  hw,-hh,-hd, 1,1,  -hw,-hh,-hd, 0,1,
      hw,-hh, hd, 0,0,  hw,-hh,-hd, 1,0,  hw, hh,-hd, 1,1,
      hw,-hh, hd, 0,0,  hw, hh,-hd, 1,1,  hw, hh, hd, 0,1,
      -hw,-hh,-hd, 0,0,  -hw,-hh, hd, 1,0,  -hw, hh, hd, 1,1,
      -hw,-hh,-hd, 0,0,  -hw, hh, hd, 1,1,  -hw, hh,-hd, 0,1
    ];
  }
  
  function createSphere(radius, lat=10, lon=16){
    const v = [];
    for(let i=0; i<lat; i++){
      const t1 = Math.PI * i / lat;
      const t2 = Math.PI * (i+1) / lat;
      for(let j=0; j<lon; j++){
        const p1 = 2*Math.PI * j / lon;
        const p2 = 2*Math.PI * (j+1) / lon;
        
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
        
        v.push(x1,y1,z1, 0,0,  x2,y2,z2, 0,0,  x3,y3,z3, 0,0);
        v.push(x1,y1,z1, 0,0,  x3,y3,z3, 0,0,  x4,y4,z4, 0,0);
      }
    }
    return v;
  }
  
  const head = createSphere(0.22);
  const body = createBox(0.35, 0.6, 0.25);
  const armLeft = createBox(0.12, 0.5, 0.12);
  const armRight = createBox(0.12, 0.5, 0.12);
  const legLeft = createBox(0.15, 0.55, 0.15);
  const legRight = createBox(0.15, 0.55, 0.15);
  
  return { head, body, armLeft, armRight, legLeft, legRight };
}

const characterParts = makeCharacterGeometry();

const bufCharacterHead = createBufferWithUV(characterParts.head);
const bufCharacterBody = createBufferWithUV(characterParts.body);
const bufCharacterArmLeft = createBufferWithUV(characterParts.armLeft);
const bufCharacterArmRight = createBufferWithUV(characterParts.armRight);
const bufCharacterLegLeft = createBufferWithUV(characterParts.legLeft);
const bufCharacterLegRight = createBufferWithUV(characterParts.legRight);

// ---------- COIN GEOMETRY COM NORMAIS ----------
const coinPositions = [];
const coinTextureCoords = [];
const coinRadius = 0.3;
const coinThickness = 0.08;
const coinSegments = 40;

for (let i = 0; i <= coinSegments; i++) {
    const theta = (i / coinSegments) * 2 * Math.PI;
    const nextTheta = ((i + 1) / coinSegments) * 2 * Math.PI;
    
    const x = Math.cos(theta) * coinRadius;
    const y = Math.sin(theta) * coinRadius;
    const nextX = Math.cos(nextTheta) * coinRadius;
    const nextY = Math.sin(nextTheta) * coinRadius;

    const coordY = -(y/coinRadius)/2 + 0.5;
    const nextCoordY = -(nextY/coinRadius)/2 + 0.5;
    const baseU = (x/coinRadius)/2 + 0.5;
    const nextBaseU = (nextX/coinRadius)/2 + 0.5;
    const uFront = baseU / 2.0;
    const nextUFront = nextBaseU / 2.0;
    const baseUBack = (-x/coinRadius)/2 + 0.5;
    const nextBaseUBack = (-nextX/coinRadius)/2 + 0.5;
    const uBack = baseUBack / 2.0 + 0.5;
    const nextUBack = nextBaseUBack / 2.0 + 0.5;

    coinPositions.push(0, 0, coinThickness/2);         
    coinTextureCoords.push(0.25, 0.5);
    coinPositions.push(x, y, coinThickness/2);         
    coinTextureCoords.push(uFront, coordY);
    coinPositions.push(nextX, nextY, coinThickness/2); 
    coinTextureCoords.push(nextUFront, nextCoordY);

    coinPositions.push(0, 0, -coinThickness/2);          
    coinTextureCoords.push(0.75, 0.5);
    coinPositions.push(nextX, nextY, -coinThickness/2);  
    coinTextureCoords.push(nextUBack, nextCoordY);
    coinPositions.push(x, y, -coinThickness/2);          
    coinTextureCoords.push(uBack, coordY);

    coinPositions.push(x, y, coinThickness/2);            
    coinTextureCoords.push(0, 0);
    coinPositions.push(nextX, nextY, coinThickness/2);    
    coinTextureCoords.push(0.05, 0);
    coinPositions.push(x, y, -coinThickness/2);           
    coinTextureCoords.push(0, 0.1);
    
    coinPositions.push(nextX, nextY, coinThickness/2);    
    coinTextureCoords.push(0.05, 0);
    coinPositions.push(nextX, nextY, -coinThickness/2);   
    coinTextureCoords.push(0.05, 0.1);
    coinPositions.push(x, y, -coinThickness/2);           
    coinTextureCoords.push(0, 0.1);
}

const coinPosBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, coinPosBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coinPositions), gl.STATIC_DRAW);

const coinUVBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, coinUVBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coinTextureCoords), gl.STATIC_DRAW);

const coinNormals = window.calcularNormais ? window.calcularNormais(coinPositions) : [];
const coinNormalBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, coinNormalBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coinNormals), gl.STATIC_DRAW);

const ctx = document.createElement('canvas').getContext('2d');
ctx.canvas.width = 1024;
ctx.canvas.height = 512;

ctx.fillStyle = '#FFD700';
ctx.fillRect(0, 0, 512, 512);
ctx.beginPath();
ctx.arc(256, 256, 240, 0, Math.PI * 2);
ctx.lineWidth = 20;
ctx.strokeStyle = '#DAA520';
ctx.stroke();
ctx.fillStyle = '#B8860B';
ctx.font = 'bold 300px sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('$', 256, 270);

ctx.translate(512, 0);
ctx.fillStyle = '#FFD700';
ctx.fillRect(0, 0, 512, 512);
ctx.beginPath();
ctx.arc(256, 256, 240, 0, Math.PI * 2);
ctx.lineWidth = 20;
ctx.strokeStyle = '#B8860B';
ctx.stroke();
ctx.fillStyle = '#DAA520';
ctx.beginPath();
ctx.arc(256, 256, 180, 0, Math.PI*2);
ctx.fill();
ctx.fillStyle = '#B8860B';
ctx.font = 'bold 80px sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('UNIFESP', 256, 256);
ctx.translate(-512, 0);

const coinTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, coinTexture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ctx.canvas);

// ---------- BARREL GEOMETRY COM NORMAIS ----------
function createBarrelGeometry(){
  const segments = 40;
  const stacks = 32;
  const baseRadius = 0.4;
  const bulge = 0.25;
  const height = 0.8;
  const halfH = height / 2;

  function radiusAtY(y) {
    const t = (y / halfH);
    return baseRadius * (1.0 + bulge * (1.0 - t * t));
  }

  const positions = [];
  const uvs = [];

  for (let j = 0; j < stacks; j++) {
    const v0 = j / stacks;
    const v1 = (j + 1) / stacks;
    const y0 = -halfH + v0 * height;
    const y1 = -halfH + v1 * height;
    const r0 = radiusAtY(y0);
    const r1 = radiusAtY(y1);

    for (let i = 0; i < segments; i++) {
      const u0 = i / segments;
      const u1 = (i + 1) / segments;
      const a0 = u0 * Math.PI * 2;
      const a1 = u1 * Math.PI * 2;

      const x00 = Math.cos(a0)*r0, z00 = Math.sin(a0)*r0;
      const x10 = Math.cos(a1)*r0, z10 = Math.sin(a1)*r0;
      const x01 = Math.cos(a0)*r1, z01 = Math.sin(a0)*r1;
      const x11 = Math.cos(a1)*r1, z11 = Math.sin(a1)*r1;

      positions.push(x00, y0, z00, x01, y1, z01, x10, y0, z10);
      uvs.push(u0*2, v0, u0*2, v1, u1*2, v0);
      
      positions.push(x10, y0, z10, x01, y1, z01, x11, y1, z11);
      uvs.push(u1*2, v0, u0*2, v1, u1*2, v1);
    }
  }

  const topY = halfH;
  const topR = radiusAtY(topY) * 0.95;
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const x0 = Math.cos(a0) * topR;
    const z0 = Math.sin(a0) * topR;
    const x1 = Math.cos(a1) * topR;
    const z1 = Math.sin(a1) * topR;
    positions.push(0, topY, 0, x0, topY, z0, x1, topY, z1);
    uvs.push(0.5, 0.5, 0.5 + Math.cos(a0)*0.25, 0.5 + Math.sin(a0)*0.25, 0.5 + Math.cos(a1)*0.25, 0.5 + Math.sin(a1)*0.25);
  }

  const bottomY = -halfH;
  const bottomR = radiusAtY(bottomY) * 0.95;
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const x0 = Math.cos(a0) * bottomR;
    const z0 = Math.sin(a0) * bottomR;
    const x1 = Math.cos(a1) * bottomR;
    const z1 = Math.sin(a1) * bottomR;
    positions.push(0, bottomY, 0, x1, bottomY, z1, x0, bottomY, z0);
    uvs.push(0.5, 0.5, 0.5 + Math.cos(a1)*0.25, 0.5 + Math.sin(a1)*0.25, 0.5 + Math.cos(a0)*0.25, 0.5 + Math.sin(a0)*0.25);
  }

  return { positions, uvs, count: positions.length / 3 };
}

const barrelGeom = createBarrelGeometry();

const barrelPosBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, barrelPosBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(barrelGeom.positions), gl.STATIC_DRAW);

const barrelUVBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, barrelUVBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(barrelGeom.uvs), gl.STATIC_DRAW);

const barrelNormals = window.calcularNormais ? window.calcularNormais(barrelGeom.positions) : [];
const barrelNormalBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, barrelNormalBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(barrelNormals), gl.STATIC_DRAW);

const ctxWood = document.createElement('canvas').getContext('2d');
ctxWood.canvas.width = 1024;
ctxWood.canvas.height = 1024;

ctxWood.fillStyle = "#5c3a21";
ctxWood.fillRect(0, 0, 1024, 1024);

const planks = 10;
const plankW = 1024 / planks;
for(let i=0; i<planks; i++) {
  const x = i * plankW;
  const tone = (Math.random() - 0.5) * 20;
  ctxWood.fillStyle = `rgb(${100+tone}, ${65+tone}, ${35+tone})`;
  ctxWood.fillRect(x, 0, plankW, 1024);
  
  ctxWood.globalAlpha = 0.15;
  ctxWood.fillStyle = "#3e2514";
  for(let k=0; k<100; k++) {
    const rx = x + Math.random() * plankW;
    const ry = Math.random() * 1024;
    const rw = 1 + Math.random() * 4;
    const rh = 20 + Math.random() * 100;
    ctxWood.fillRect(rx, ry, rw, rh);
  }
  ctxWood.globalAlpha = 1.0;
  
  ctxWood.fillStyle = "rgba(0,0,0,0.5)";
  ctxWood.fillRect(x, 0, 4, 1024);
  ctxWood.fillRect(x + plankW - 2, 0, 2, 1024);
}

const barrelTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, barrelTexture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ctxWood.canvas);

// ---------- BOMB GEOMETRY (CORPO PRETO + PAVIO CURVO) ----------
function createBombGeometry(){
  const positions = [];
  const uvs = [];
  
  const stacks = 32, slices = 32, R = 0.3;
  
  for (let i = 0; i < stacks; i++) {
    const v0 = i / stacks, v1 = (i+1) / stacks;
    const t0 = v0*Math.PI, t1 = v1*Math.PI;
    
    const y0 = Math.cos(t0)*R, y1 = Math.cos(t1)*R;
    const r0 = Math.sin(t0)*R, r1 = Math.sin(t1)*R;
    
    for (let j = 0; j < slices; j++) {
      const u0 = j/slices, u1 = (j+1)/slices;
      const p0 = u0*Math.PI*2, p1 = u1*Math.PI*2;
      
      const x00 = Math.cos(p0)*r0, z00 = Math.sin(p0)*r0;
      const x10 = Math.cos(p1)*r0, z10 = Math.sin(p1)*r0;
      const x01 = Math.cos(p0)*r1, z01 = Math.sin(p0)*r1;
      const x11 = Math.cos(p1)*r1, z11 = Math.sin(p1)*r1;
      
      positions.push(x00,y0,z00, x01,y1,z01, x10,y0,z10);
      positions.push(x10,y0,z10, x01,y1,z01, x11,y1,z11);
      
      uvs.push(u0*0.5, v0, u0*0.5, v1, u1*0.5, v0);
      uvs.push(u1*0.5, v0, u0*0.5, v1, u1*0.5, v1);
    }
  }
  
  const fuseSegments = 50;
  const fuseRadius = 0.06 * 0.3;
  const fuseRadialSteps = 30;
  
  const baseNormal = { x: 0, y: 1, z: 0 };
  
  const baseCenter = {
    x: 0 + baseNormal.x * (R + fuseRadius*0.1),
    y: R + baseNormal.y * (fuseRadius*0.1),
    z: 0 + baseNormal.z * (fuseRadius*0.1) + 0.05
  };
  
  function fusePath(t){
    const scale = 0.65 * 0.3;
    const x = baseCenter.x + Math.sin(t * Math.PI * 1.2) * 0.35 * t * scale;
    const y = baseCenter.y + t * (0.9 * scale);
    const z = baseCenter.z + Math.cos(t * Math.PI * 1.1) * 0.15 * t * scale - t*0.1*scale;
    return { x, y, z };
  }
  
  function normalize(v){
    const L = Math.hypot(v.x, v.y, v.z) || 1;
    return { x:v.x/L, y:v.y/L, z:v.z/L };
  }
  function cross(a,b){
    return { x: a.y*b.z - a.z*b.y, y: a.z*b.x - a.x*b.z, z: a.x*b.y - a.y*b.x };
  }
  
  for (let i = 0; i < fuseSegments; i++) {
    const t0 = i / fuseSegments;
    const t1 = (i + 1) / fuseSegments;
    
    const p0 = fusePath(t0);
    const p1 = fusePath(t1);
    
    const tan = { x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z };
    const up = Math.abs(tan.y) < 0.9 ? { x:0, y:1, z:0 } : { x:1, y:0, z:0 };
    
    const tTan = normalize(tan);
    const n = normalize(cross(tTan, up));
    const b = normalize(cross(n, tTan));
    
    for (let j = 0; j < fuseRadialSteps; j++) {
      const a0 = j / fuseRadialSteps * Math.PI * 2;
      const a1 = (j+1) / fuseRadialSteps * Math.PI * 2;
      
      const x00 = p0.x + (Math.cos(a0)*n.x + Math.sin(a0)*b.x) * fuseRadius;
      const y00 = p0.y + (Math.cos(a0)*n.y + Math.sin(a0)*b.y) * fuseRadius;
      const z00 = p0.z + (Math.cos(a0)*n.z + Math.sin(a0)*b.z) * fuseRadius;
      
      const x10 = p0.x + (Math.cos(a1)*n.x + Math.sin(a1)*b.x) * fuseRadius;
      const y10 = p0.y + (Math.cos(a1)*n.y + Math.sin(a1)*b.y) * fuseRadius;
      const z10 = p0.z + (Math.cos(a1)*n.z + Math.sin(a1)*b.z) * fuseRadius;
      
      const x01 = p1.x + (Math.cos(a0)*n.x + Math.sin(a0)*b.x) * fuseRadius;
      const y01 = p1.y + (Math.cos(a0)*n.y + Math.sin(a0)*b.y) * fuseRadius;
      const z01 = p1.z + (Math.cos(a0)*n.z + Math.sin(a0)*b.z) * fuseRadius;
      
      const x11 = p1.x + (Math.cos(a1)*n.x + Math.sin(a1)*b.x) * fuseRadius;
      const y11 = p1.y + (Math.cos(a1)*n.y + Math.sin(a1)*b.y) * fuseRadius;
      const z11 = p1.z + (Math.cos(a1)*n.z + Math.sin(a1)*b.z) * fuseRadius;
      
      positions.push(
        x00,y00,z00,  x01,y01,z01,  x10,y10,z10,
        x10,y10,z10,  x01,y01,z01,  x11,y11,z11
      );
      
      const uA = 0.5 + t0 * 0.5;
      const uB = 0.5 + t1 * 0.5;
      const vA = j / fuseRadialSteps;
      const vB = (j+1) / fuseRadialSteps;
      
      uvs.push(
        uA, vA,
        uB, vA,
        uA, vB,
        uA, vB,
        uB, vA,
        uB, vB
      );
    }
  }
  
  return { positions, uvs, count: positions.length / 3 };
}

const bombGeom = createBombGeometry();

const bombPosBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, bombPosBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(bombGeom.positions), gl.STATIC_DRAW);

const bombUVBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, bombUVBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(bombGeom.uvs), gl.STATIC_DRAW);

// Textura da bomba
const ctxBomb = document.createElement('canvas').getContext('2d');
ctxBomb.canvas.width = 256;
ctxBomb.canvas.height = 64;

ctxBomb.fillStyle = "#000000";
ctxBomb.fillRect(0, 0, ctxBomb.canvas.width/2, ctxBomb.canvas.height);

const gx = ctxBomb.createLinearGradient(ctxBomb.canvas.width/2, 0, ctxBomb.canvas.width, 0);
gx.addColorStop(0.00, "#bfa46f");
gx.addColorStop(0.60, "#4a2d0b");
gx.addColorStop(0.85, "#ff3300");
gx.addColorStop(1.00, "#ffdd00");
ctxBomb.fillStyle = gx;
ctxBomb.fillRect(ctxBomb.canvas.width/2, 0, ctxBomb.canvas.width/2, ctxBomb.canvas.height);

const bombTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, bombTexture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ctxBomb.canvas);
gl.generateMipmap(gl.TEXTURE_2D);

// ---------- TREES ----------
function createTreeBuffers(){
  const verts = [];
  const TREE_COUNT_LEFT = 24;
  const TREE_COUNT_RIGHT = 24;

  function pushCrossTree(cx, cz, w, h, seed){
    const x0 = cx - w*0.5, x1 = cx + w*0.5;
    const z0 = cz, z1 = cz;
    
    verts.push(x0, 0, z0,  0,0);
    verts.push(x1, 0, z1,  1,0);
    verts.push(x1, h, z1,  1,1);
    verts.push(x0, 0, z0,  0,0);
    verts.push(x1, h, z1,  1,1);
    verts.push(x0, h, z0,  0,1);

    verts.push(cx, 0, cz - w*0.5,  0,0);
    verts.push(cx, 0, cz + w*0.5,  1,0);
    verts.push(cx, h, cz + w*0.5,  1,1);
    verts.push(cx, 0, cz - w*0.5,  0,0);
    verts.push(cx, h, cz + w*0.5,  1,1);
    verts.push(cx, h, cz - w*0.5,  0,1);
  }

  for(let i=0;i<TREE_COUNT_LEFT;i++){
    const rx = leftStart + 0.5 + Math.random() * (leftEnd - (leftStart + 0.5));
    const rz = -5 - Math.random() * (TRACK_LENGTH - 10);
    const scale = 0.8 + Math.random() * 0.8;
    pushCrossTree(rx, rz, 0.8 * scale, 1.6 * scale, Math.random());
  }

  for(let i=0;i<TREE_COUNT_RIGHT;i++){
    const rx = rightStart + 0.5 + Math.random() * (rightEnd - (rightStart + 0.5));
    const rz = -5 - Math.random() * (TRACK_LENGTH - 10);
    const scale = 0.8 + Math.random() * 0.8;
    pushCrossTree(rx, rz, 0.8 * scale, 1.6 * scale, Math.random());
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

function identity(){ 
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); 
}

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

function rotateY(out, m, angle){
  out = out || new Float32Array(16);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const m0=m[0], m1=m[1], m2=m[2], m3=m[3];
  const m8=m[8], m9=m[9], m10=m[10], m11=m[11];
  out[0] = m0*c + m8*s;
  out[1] = m1*c + m9*s;
  out[2] = m2*c + m10*s;
  out[3] = m3*c + m11*s;
  out[8] = m8*c - m0*s;
  out[9] = m9*c - m1*s;
  out[10] = m10*c - m2*s;
  out[11] = m11*c - m3*s;
  out[4]=m[4]; out[5]=m[5]; out[6]=m[6]; out[7]=m[7];
  out[12]=m[12]; out[13]=m[13]; out[14]=m[14]; out[15]=m[15];
  return out;
}

function rotateX(out, m, angle){
  out = out || new Float32Array(16);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const m4=m[4], m5=m[5], m6=m[6], m7=m[7];
  const m8=m[8], m9=m[9], m10=m[10], m11=m[11];
  out[4] = m4*c + m8*s;
  out[5] = m5*c + m9*s;
  out[6] = m6*c + m10*s;
  out[7] = m7*c + m11*s;
  out[8] = m8*c - m4*s;
  out[9] = m9*c - m5*s;
  out[10] = m10*c - m6*s;
  out[11] = m11*c - m7*s;
  out[0]=m[0]; out[1]=m[1]; out[2]=m[2]; out[3]=m[3];
  out[12]=m[12]; out[13]=m[13]; out[14]=m[14]; out[15]=m[15];
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

// ---------- COINS DATA ----------
const LANE_CENTER_X = [ -LANE_WIDTH, 0, LANE_WIDTH ];
const coins = [];

/*
let currentZ = -10;
let remainingCoins = 100;

while(remainingCoins > 0 && currentZ > -TRACK_LENGTH + 10){
  const groupSize = Math.min(remainingCoins, 5 + Math.floor(Math.random() * 11));
  
  for(let i = 0; i < groupSize; i++){
    const randomLane = Math.floor(Math.random() * 3);
    
    coins.push({
      x: LANE_CENTER_X[randomLane],
      y: 0.5,
      z: currentZ - (i * 0.8),
      active: true,
      rotation: Math.random() * Math.PI * 2
    });
    
    remainingCoins--;
  }
  
  currentZ -= (groupSize * 0.8) + (3 + Math.random() * 7);
}
*/

// ---------- OBSTACLES DATA ----------
const obstacles = [];

/*
for(let i = 0; i < 15; i++){
  const randomLane = Math.floor(Math.random() * 3);
  const randomZ = -20 - Math.random() * (TRACK_LENGTH - 30);
  
  obstacles.push({
    x: LANE_CENTER_X[randomLane],
    y: 0.4,
    z: randomZ,
    radius: 0.45
  });
}

obstacles.forEach(obs => {
  coins.forEach(coin => {
    const dist = Math.abs(obs.z - coin.z);
    if(dist < 3){
      coin.z -= 4;
    }
  });
});
*/

// ---------- BOMBAS ESTÁTICAS NA PISTA ----------
const staticBombs = [];

/*
for(let i = 0; i < 6; i++){
  const randomLane = Math.floor(Math.random() * 3);
  const randomZ = -25 - Math.random() * (TRACK_LENGTH - 35);
  
  staticBombs.push({
    x: LANE_CENTER_X[randomLane],
    y: 0.35,
    z: randomZ,
    radius: 0.35,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: 0.5 + Math.random() * 1.0
  });
}

staticBombs.forEach(bomb => {
  obstacles.forEach(obs => {
    const dist = Math.abs(obs.z - bomb.z);
    if(dist < 4){
      bomb.z -= 5;
    }
  });
});

staticBombs.forEach(bomb => {
  coins.forEach(coin => {
    const dist = Math.abs(bomb.z - coin.z);
    if(dist < 3){
      coin.z -= 4;
    }
  });
});
*/

// --- SISTEMA DE GERAÇÃO INFINITA ---

let nextSpawnZ = -20; 
const SPAWN_INTERVAL = 5;

function spawnWorldChunk(zPos) {
    const lane = [ -LANE_WIDTH, 0, LANE_WIDTH ];
    const tipo = Math.random();

    if (tipo < 0.4) {
        const randomLane = Math.floor(Math.random() * 3);
        // Gera 5 moedas em linha
        for(let i=0; i<5; i++){
            coins.push({
                x: lane[randomLane],
                y: 0.5,
                z: zPos - (i * 1.5),
                active: true,
                rotation: Math.random() * Math.PI * 2
            });
        }
    } 
    else if (tipo < 0.7) {
        const randomLane = Math.floor(Math.random() * 3);
        obstacles.push({
            x: lane[randomLane],
            y: 0.4,
            z: zPos,
            radius: 0.45
        });
    }
    else {
        const randomLane = Math.floor(Math.random() * 3);
        staticBombs.push({
            x: lane[randomLane],
            y: 0.35,
            z: zPos,
            radius: 0.35,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: 0.5 + Math.random()
        });
    }
}

function cleanUpObjects(playerZ) {
    const cutoff = playerZ + 20;

    for (let i = coins.length - 1; i >= 0; i--) {
        if (coins[i].z > cutoff) coins.splice(i, 1);
    }
    for (let i = obstacles.length - 1; i >= 0; i--) {
        if (obstacles[i].z > cutoff) obstacles.splice(i, 1);
    }
    for (let i = staticBombs.length - 1; i >= 0; i--) {
        if (staticBombs[i].z > cutoff) staticBombs.splice(i, 1);
    }
}

// ---------- FALLING BOMBS ----------
const fallingBombs = [];
let bombSpawnTimer = 0;
const BOMB_SPAWN_INTERVAL = 2.5;
const BOMB_START_Z = 100;

function spawnBomb(){
  // if(player.z > BOMB_START_Z) return;
  
  const randomLane = Math.floor(Math.random() * 3);
  const randomX = LANE_CENTER_X[randomLane] + (Math.random() - 0.5) * 1.0;
  
  fallingBombs.push({
    x: randomX,
    y: 15 + Math.random() * 5,
    z: player.z - 20 - Math.random() * 30,
    velocityY: 0,
    radius: 0.35,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 2
  });
}

function updateBombs(dt){
  if(isGameOver || isVictory) return;
  
  bombSpawnTimer += dt;
  
  if(player.z < BOMB_START_Z) {
      while(bombSpawnTimer >= BOMB_SPAWN_INTERVAL) {
          spawnBomb();
          bombSpawnTimer -= BOMB_SPAWN_INTERVAL; 
      }
  }
  
  const gravidadeAtual = player.forwardSpeed * 0.4; 

  for(let i = fallingBombs.length - 1; i >= 0; i--){
    const bomb = fallingBombs[i];
    
    bomb.velocityY -= gravidadeAtual * dt; 
    
    bomb.y += bomb.velocityY * dt;
    bomb.rotation += bomb.rotationSpeed * dt;
    
    if(bomb.y < 0){
      fallingBombs.splice(i, 1);
      continue;
    }
    
    if(bomb.z > player.z + 30){
      fallingBombs.splice(i, 1);
      continue;
    }
  }
}

function checkBombCollisions(){
  fallingBombs.forEach(bomb => {
    const dx = player.x - bomb.x;
    const dy = player.y - bomb.y;
    const dz = player.z - bomb.z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
    
    if(dist < (player.radius + bomb.radius)){
      gameOver();
    }
  });
}

// ---------- PLAYER ----------
let player = {
  laneIndex: 1,
  targetLane: 1,
  x: 0,
  z: -1,
  y: 0.5,
  radius: 0.5,
  forwardSpeed: 6,
  coinsCollected: 0
};

// ---------- UI ----------
const timerDisplay = document.getElementById('timer-display');
const coinDisplay = document.getElementById('coin-display');
let startTime = Date.now();
let isGameOver = false;
let isVictory = false;

function updateUI(){
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const secs = (elapsed % 60).toString().padStart(2, '0');
  timerDisplay.textContent = `TIME: ${mins}:${secs}`;
  coinDisplay.textContent = `COINS: ${player.coinsCollected}`;
}

// ---------- EVENT LISTENER COM CÂMERA ----------
window.addEventListener('keydown', (e)=>{
  const k = e.key.toLowerCase();

  // Tecla de Pausa (ESC ou P)
  if (e.key === 'Escape' || k === 'p') {
      togglePause();
  }

  if (!isGameRunning || isPaused || isGameOver) return;
  
  if(k === 'arrowleft' || k === 'a'){
    player.targetLane = Math.max(0, player.targetLane - 1);
  }
  if(k === 'arrowright' || k === 'd'){
    player.targetLane = Math.min(2, player.targetLane + 1);
  }
  
  if(e.key === 'ArrowUp'){
    cameraMode = (cameraMode + 1) % 2;
    console.log(cameraMode === 0 ? "Câmera: Terceira Pessoa" : "Câmera: Primeira Pessoa");
  }
});

function clampToWalls(x){
  const half = TOTAL_WIDTH/2 - 0.4;
  return Math.max(-half, Math.min(half, x));
}

function checkCoinCollisions(){
  coins.forEach(coin => {
    if(!coin.active) return;
    const dx = player.x - coin.x;
    const dy = player.y - coin.y;
    const dz = player.z - coin.z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if(dist < 0.7){
      coin.active = false;
      player.coinsCollected++;
    }
  });
}

function checkStaticBombCollisions(){
  staticBombs.forEach(bomb => {
    const dx = player.x - bomb.x;
    const dy = player.y - bomb.y;
    const dz = player.z - bomb.z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
    
    if(dist < (player.radius + bomb.radius)){
      gameOver();
    }
  });
}

function checkObstacleCollisions(){
  obstacles.forEach(obs => {
    const dx = player.x - obs.x;
    const dy = player.y - obs.y;
    const dz = player.z - obs.z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
    
    if(dist < (player.radius + obs.radius)){
      gameOver();
    }
  });
}

function gameOver(){
  if(isGameOver || isVictory) return;
  isGameOver = true;
  player.forwardSpeed = 0;

  let recorde = localStorage.getItem('maxCoins') || 0;
  let mensagemRecorde = "";
  
  if (player.coinsCollected > recorde) {
      recorde = player.coinsCollected;
      localStorage.setItem('maxCoins', recorde);

      mensagemRecorde = `<br><span style="color: #33ff33; font-size: 22px; font-weight: bold; text-shadow: 0 0 5px #00ff00;">NOVO RECORDE!</span>`;
  } else {
      mensagemRecorde = `<br><span style="color: #cccccc; font-size: 18px;">Recorde: ${recorde}</span>`;
  }

  const gameOverDiv = document.createElement('div');
  gameOverDiv.style.cssText = `
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.95);
    color: #ff0000;
    padding: 40px 60px;
    border-radius: 20px;
    border: 4px solid #ff0000;
    font-family: Arial, sans-serif;
    text-align: center;
    z-index: 2000;
    box-shadow: 0 0 20px rgba(255, 0, 0, 0.4);
  `;
  
  gameOverDiv.innerHTML = `
    <div style="font-size: 48px; font-weight: bold; margin-bottom: 10px;">GAME OVER!</div>
    <div style="font-size: 24px; color: #FFD700; margin-bottom: 5px;">Moedas: ${player.coinsCollected}</div>
    ${mensagemRecorde} <br><br>
    <div style="font-size: 18px; color: #fff; cursor: pointer; border: 1px solid #fff; padding: 10px; display: inline-block; border-radius: 5px;" onclick="restartGame()">
       Reiniciar
    </div>
  `;
  document.body.appendChild(gameOverDiv);
}

function victory(){
  if(isGameOver || isVictory) return;
  isVictory = true;
  player.forwardSpeed = 0;
  
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const secs = (elapsed % 60).toString().padStart(2, '0');

  let recorde = localStorage.getItem('maxCoins') || 0;
  let mensagemRecorde = "";
  
  if (player.coinsCollected > recorde) {
      recorde = player.coinsCollected;
      localStorage.setItem('maxCoins', recorde);
      mensagemRecorde = `<br><span style="color: #ccffcc; font-size: 22px; font-weight: bold;">NOVO RECORDE!</span>`;
  } else {
      mensagemRecorde = `<br><span style="color: #eee; font-size: 18px;">Recorde: ${recorde}</span>`;
  }
  
  const victoryDiv = document.createElement('div');
  victoryDiv.style.cssText = `
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 100, 0, 0.95);
    color: #FFD700;
    padding: 40px 60px;
    border-radius: 20px;
    border: 4px solid #FFD700;
    font-family: Arial, sans-serif;
    text-align: center;
    z-index: 2000;
    box-shadow: 0 0 30px rgba(255, 215, 0, 0.5);
  `;
  
  victoryDiv.innerHTML = `
    <div style="font-size: 48px; font-weight: bold; margin-bottom: 10px;">🏆 VOCÊ VENCEU! 🏆</div>
    <div style="font-size: 24px; color: #fff;">Tempo: ${mins}:${secs}</div>
    <div style="font-size: 24px; color: #FFD700;">Moedas: ${player.coinsCollected}</div>
    ${mensagemRecorde}
    <br><br>
    <div style="font-size: 18px; color: #FFD700; cursor: pointer; border: 1px solid #FFD700; padding: 10px; display: inline-block; border-radius: 5px;" onclick="restartGame()">
       Jogar Novamente
    </div>
  `;
  document.body.appendChild(victoryDiv);
}

function setAttrib(buf){
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(aUV);
  gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 20, 12);
}

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

// ---------- ANIMAÇÃO DE CORRIDA ----------
let runAnimTime = 0;

function drawAnimatedCharacter(baseX, baseY, baseZ){
  if (!isPaused && isGameRunning) {
      runAnimTime += 0.25;
  }
  
  const legAngle = Math.sin(runAnimTime) * 0.6;
  const armAngle = Math.sin(runAnimTime) * 0.5;
  const bodyBob = Math.abs(Math.sin(runAnimTime * 2)) * 0.08;
  
  let m = translate(identity(), identity(), [baseX, baseY + 0.25 + bodyBob, baseZ]);
  draw(bufCharacterBody, m, [0.2, 0.5, 0.95]);
  
  m = translate(identity(), identity(), [baseX, baseY + 0.75 + bodyBob, baseZ]);
  draw(bufCharacterHead, m, [0.95, 0.75, 0.6]);
  
  const shoulderLeftX = baseX - 0.28;
  const shoulderLeftY = baseY + 0.55 + bodyBob;
  const shoulderLeftZ = baseZ;
  
  m = translate(identity(), identity(), [shoulderLeftX, shoulderLeftY, shoulderLeftZ]);
  m = rotateX(identity(), m, -armAngle);
  m = translate(identity(), m, [0, -0.25, 0]);
  draw(bufCharacterArmLeft, m, [0.2, 0.5, 0.95]);
  
  const shoulderRightX = baseX + 0.28;
  const shoulderRightY = baseY + 0.55 + bodyBob;
  const shoulderRightZ = baseZ;
  
  m = translate(identity(), identity(), [shoulderRightX, shoulderRightY, shoulderRightZ]);
  m = rotateX(identity(), m, armAngle);
  m = translate(identity(), m, [0, -0.25, 0]);
  draw(bufCharacterArmRight, m, [0.2, 0.5, 0.95]);
  
  const hipLeftX = baseX - 0.11;
  const hipLeftY = baseY - 0.05 + bodyBob;
  const hipLeftZ = baseZ;
  
  m = translate(identity(), identity(), [hipLeftX, hipLeftY, hipLeftZ]);
  m = rotateX(identity(), m, legAngle);
  m = translate(identity(), m, [0, -0.275, 0]);
  draw(bufCharacterLegLeft, m, [0.15, 0.35, 0.7]);
  
  const hipRightX = baseX + 0.11;
  const hipRightY = baseY - 0.05 + bodyBob;
  const hipRightZ = baseZ;
  
  m = translate(identity(), identity(), [hipRightX, hipRightY, hipRightZ]);
  m = rotateX(identity(), m, -legAngle);
  m = translate(identity(), m, [0, -0.275, 0]);
  draw(bufCharacterLegRight, m, [0.15, 0.35, 0.7]);
}

// ---------- UPDATE ----------
function update(dt){
  if(isGameOver || isVictory) return;

  const ACELERACAO = 0.1;
  const VELOCIDADE_MAX = 12.0;

  if (player.forwardSpeed < VELOCIDADE_MAX) {
      player.forwardSpeed += ACELERACAO * dt;
  }

  while (nextSpawnZ > player.z - 120) {
      spawnWorldChunk(nextSpawnZ);
      nextSpawnZ -= SPAWN_INTERVAL;
  }

  while (nextSpawnZ > player.z - 120) {
      spawnWorldChunk(nextSpawnZ);
      nextSpawnZ -= SPAWN_INTERVAL;
  }

  cleanUpObjects(player.z);

  if (player.z < -100) {
      const shiftAmount = 100;

      player.z += shiftAmount;

      nextSpawnZ += shiftAmount;

      coins.forEach(o => o.z += shiftAmount);
      obstacles.forEach(o => o.z += shiftAmount);
      staticBombs.forEach(o => o.z += shiftAmount);
      fallingBombs.forEach(o => o.z += shiftAmount);
  }
  
  player.z -= player.forwardSpeed * dt;
  const targetX = LANE_CENTER_X[player.targetLane];
  player.x += (targetX - player.x) * Math.min(1, 6 * dt);
  player.x = clampToWalls(player.x);
  
  /*
  if(player.z <= -TRACK_LENGTH + 5){
    victory();
    return;
  }
  */
  
  checkCoinCollisions();
  checkObstacleCollisions();
  checkStaticBombCollisions();
  updateBombs(dt);
  checkBombCollisions();
  updateUI();
  
  coins.forEach(coin => {
    if(coin.active) coin.rotation += dt * 3;
  });
  
  staticBombs.forEach(bomb => {
    bomb.rotation += bomb.rotationSpeed * dt;
  });
}

function startGame() {
    startScreen.style.display = 'none';
    isGameRunning = true;
    isPaused = false;
    
    startTime = Date.now(); 
}

function togglePause() {
    if (!isGameRunning || isGameOver || isVictory) return;

    isPaused = !isPaused;

    if (isPaused) {
        pauseScreen.style.display = 'flex';
    } else {
        pauseScreen.style.display = 'none';
        last = performance.now(); 
    }
}

const btnRestart = document.getElementById('btn-restart');

btnRestart.addEventListener('click', restartGame);

function restartGame() {
    pauseScreen.style.display = 'none';

    const allDivs = document.querySelectorAll('div');
    allDivs.forEach(div => {
        if (div.innerText.includes("GAME OVER") || div.innerText.includes("VOCÊ VENCEU")) {
            div.remove();
        }
    });

    isGameOver = false;
    isVictory = false;
    isPaused = false;
    isGameRunning = true;

    player.laneIndex = 1;
    player.targetLane = 1;
    player.x = 0;
    player.z = -1;
    player.forwardSpeed = 6;
    player.coinsCollected = 0;

    coins.length = 0;
    obstacles.length = 0;
    staticBombs.length = 0;
    fallingBombs.length = 0;

    nextSpawnZ = -20; 

    startTime = Date.now();
    last = performance.now();
}

let last = performance.now();

// ---------- MAIN LOOP ----------
function render(){
  resize();
  const now = performance.now();
  const dt = Math.min(0.05, (now-last)/1000);

  let camEye, camTarget;

  if (!isPaused && isGameRunning) {
        last = now;
        update(dt); 
  } else {
        last = now;
  }
  
  if(cameraMode === 0) {
    camEye = [ player.x*0.3, 4.0, player.z + 6.5 ];
    camTarget = [ player.x, 0.8, player.z - 4.0 ];
  } else {
    camEye = [ player.x, player.y + 1.3, player.z ];
    camTarget = [ player.x, player.y + 1.3, player.z - 10 ];
  }
  
  const viewMat = lookAt(camEye, camTarget, [0,1,0]);

  gl.clearColor(0.53,0.80,0.92,1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(program);
  gl.uniformMatrix4fv(uProj, false, projMat);
  gl.uniformMatrix4fv(uView, false, viewMat);

  draw(bufSky, identity(), [0.40,0.60,1.00]);
  draw(bufGrass, identity(), null, "grass");
  draw(bufTrack, identity(), null, "asphalt");
  draw(bufWalls, identity(), [0.7,0.12,0.12]);

  gl.disable(gl.CULL_FACE);
  draw(bufTrees, identity(), null, "tree");
  gl.enable(gl.CULL_FACE);

  if(cameraMode === 0) {
    drawAnimatedCharacter(player.x, player.y, player.z);
  }

  gl.useProgram(programCoin);
  gl.uniformMatrix4fv(uProjectionMatrix, false, projMat);
  
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, barrelTexture);
  gl.uniform1i(uSampler, 0);

  gl.disable(gl.CULL_FACE);

  obstacles.forEach(obs => {
    const finalMat = translate(identity(), viewMat, [obs.x, obs.y, obs.z]);
    gl.uniformMatrix4fv(uModelViewMatrix, false, finalMat);
    
    if (configLuzCoin) {
        configLuzCoin.aplicar(finalMat);
    }
    
    gl.bindBuffer(gl.ARRAY_BUFFER, barrelPosBuffer);
    gl.vertexAttribPointer(aVertexPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aVertexPosition);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, barrelUVBuffer);
    gl.vertexAttribPointer(aTextureCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aTextureCoord);
    
    if (aNormalCoin !== -1) {
        gl.bindBuffer(gl.ARRAY_BUFFER, barrelNormalBuffer);
        gl.vertexAttribPointer(aNormalCoin, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aNormalCoin);
    }
    
    gl.drawArrays(gl.TRIANGLES, 0, barrelGeom.count);
  });

  gl.enable(gl.CULL_FACE);

  gl.bindTexture(gl.TEXTURE_2D, coinTexture);
  gl.uniform1i(uSampler, 0);

  coins.forEach(coin => {
    if(coin.active){
      const finalMat = translate(identity(), viewMat, [coin.x, coin.y, coin.z]);
      const rotated = rotateY(identity(), finalMat, coin.rotation);
      gl.uniformMatrix4fv(uModelViewMatrix, false, rotated);

      if (configLuzCoin) {
          configLuzCoin.aplicar(rotated);
      }
      
      gl.bindBuffer(gl.ARRAY_BUFFER, coinPosBuffer);
      gl.vertexAttribPointer(aVertexPosition, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(aVertexPosition);
      
      gl.bindBuffer(gl.ARRAY_BUFFER, coinUVBuffer);
      gl.vertexAttribPointer(aTextureCoord, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(aTextureCoord);
      
      if (aNormalCoin !== -1) {
          gl.bindBuffer(gl.ARRAY_BUFFER, coinNormalBuffer);
          gl.vertexAttribPointer(aNormalCoin, 3, gl.FLOAT, false, 0, 0);
          gl.enableVertexAttribArray(aNormalCoin);
      }
      
      gl.drawArrays(gl.TRIANGLES, 0, coinPositions.length / 3);
    }
  });

  gl.useProgram(programBomb);
  gl.uniformMatrix4fv(uBombProjectionMatrix, false, projMat);
  
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, bombTexture);
  gl.uniform1i(uBombSampler, 0);

  staticBombs.forEach(bomb => {
    let bombMat = translate(identity(), viewMat, [bomb.x, bomb.y, bomb.z]);
    bombMat = rotateY(identity(), bombMat, bomb.rotation);
    gl.uniformMatrix4fv(uBombModelViewMatrix, false, bombMat);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, bombPosBuffer);
    gl.vertexAttribPointer(aBombVertexPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aBombVertexPosition);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, bombUVBuffer);
    gl.vertexAttribPointer(aBombTextureCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aBombTextureCoord);
    
    gl.drawArrays(gl.TRIANGLES, 0, bombGeom.count);
  });

  fallingBombs.forEach(bomb => {
    let bombMat = translate(identity(), viewMat, [bomb.x, bomb.y, bomb.z]);
    bombMat = rotateY(identity(), bombMat, bomb.rotation);
    gl.uniformMatrix4fv(uBombModelViewMatrix, false, bombMat);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, bombPosBuffer);
    gl.vertexAttribPointer(aBombVertexPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aBombVertexPosition);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, bombUVBuffer);
    gl.vertexAttribPointer(aBombTextureCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aBombTextureCoord);
    
    gl.drawArrays(gl.TRIANGLES, 0, bombGeom.count);
  });

  requestAnimationFrame(render);
}

requestAnimationFrame(render);

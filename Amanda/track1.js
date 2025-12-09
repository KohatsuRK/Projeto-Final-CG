// track1.js - WebGL puro com MOEDAS e CONTADOR
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

// ---------- shaders ----------
const VS = `
attribute vec3 aPos;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
void main(){
  gl_Position = uProj * uView * uModel * vec4(aPos,1.0);
}
`;

const FS = `
precision mediump float;
uniform vec3 uColor;
void main(){
  gl_FragColor = vec4(uColor,1.0);
}
`;

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

const aPos = gl.getAttribLocation(program, 'aPos');
const uProj = gl.getUniformLocation(program, 'uProj');
const uView = gl.getUniformLocation(program, 'uView');
const uModel = gl.getUniformLocation(program, 'uModel');
const uColor = gl.getUniformLocation(program, 'uColor');

gl.enable(gl.DEPTH_TEST);
gl.enable(gl.CULL_FACE);

// ---------- utility ----------
function createBufferFloat32(arr){
  const b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
  return { buffer: b, count: arr.length / 3 };
}

// ---------- TRACK ----------
const TRACK_LENGTH = 200;
const LANE_WIDTH = 2.0;
const TOTAL_WIDTH = LANE_WIDTH * 3;

// pista
const trackVerts = [
  -TOTAL_WIDTH/2, 0, 0,
  TOTAL_WIDTH/2, 0, 0,
  TOTAL_WIDTH/2, 0, -TRACK_LENGTH,
  -TOTAL_WIDTH/2, 0, 0,
  TOTAL_WIDTH/2, 0, -TRACK_LENGTH,
  -TOTAL_WIDTH/2, 0, -TRACK_LENGTH
];
const bufTrack = createBufferFloat32(trackVerts);

// linhas centrais
const lineVerts = [];
for(let z=0; z<TRACK_LENGTH; z+=4){
  const x1 = -LANE_WIDTH/2, x2 = LANE_WIDTH/2;
  lineVerts.push(
    x1, 0.02, -z,  x1, 0.02, -(z+2),
    x2, 0.02, -z,  x2, 0.02, -(z+2)
  );
}
const bufLines = createBufferFloat32(lineVerts);

// paredes laterais
const H = 1.2;
const wallVerts = [
  -TOTAL_WIDTH/2, 0, 0,  -TOTAL_WIDTH/2, H, 0,  -TOTAL_WIDTH/2, H, -TRACK_LENGTH,
  -TOTAL_WIDTH/2, 0, 0,  -TOTAL_WIDTH/2, H, -TRACK_LENGTH,  -TOTAL_WIDTH/2, 0, -TRACK_LENGTH,
  TOTAL_WIDTH/2, 0, 0,  TOTAL_WIDTH/2, H, -TRACK_LENGTH,  TOTAL_WIDTH/2, H, 0,
  TOTAL_WIDTH/2, 0, 0,  TOTAL_WIDTH/2, 0, -TRACK_LENGTH,  TOTAL_WIDTH/2, H, -TRACK_LENGTH
];
const bufWalls = createBufferFloat32(wallVerts);

// grama
const GW = 50;
const grassVerts = [
  -GW, -0.1, 20,  GW, -0.1, 20,  GW, -0.1, -TRACK_LENGTH-20,
  -GW, -0.1, 20,  GW, -0.1, -TRACK_LENGTH-20,  -GW, -0.1, -TRACK_LENGTH-20
];
const bufGrass = createBufferFloat32(grassVerts);

// céu
const skyVerts = [
  -GW, 0, -TRACK_LENGTH-20,  GW, 0, -TRACK_LENGTH-20,  GW, 20, -TRACK_LENGTH-20,
  -GW, 0, -TRACK_LENGTH-20,  GW, 20, -TRACK_LENGTH-20,  -GW, 20, -TRACK_LENGTH-20
];
const bufSky = createBufferFloat32(skyVerts);

// ---------- MOEDAS 3D ----------
const COIN_RADIUS = 0.3;
const COIN_THICKNESS = 0.08;
const COIN_SEGMENTS = 24;

// Estrutura para armazenar dados das moedas
const coins = [];

// Gerar 50 moedas com posições e status
for(let i = 0; i < 50; i++){
  let x;
  if (i % 3 === 0) x = -LANE_WIDTH;
  else if (i % 3 === 1) x = 0;
  else x = LANE_WIDTH;
  
  const y = 0.5;
  const z = -(i * 4.0);
  
  coins.push({
    x: x,
    y: y,
    z: z,
    active: true
  });
}

// Criar geometria para uma única moeda (reutilizável)
function createSingleCoinGeometry(){
  const faceVerts = [];
  const edgeVerts = [];
  const halfThick = COIN_THICKNESS / 2;
  
  // Faces (frente e trás)
  for(let j = 0; j < COIN_SEGMENTS; j++){
    const a1 = (j / COIN_SEGMENTS) * 2 * Math.PI;
    const a2 = ((j + 1) / COIN_SEGMENTS) * 2 * Math.PI;
    
    // Face frontal
    faceVerts.push(
      0, 0, halfThick,
      Math.cos(a1) * COIN_RADIUS, Math.sin(a1) * COIN_RADIUS, halfThick,
      Math.cos(a2) * COIN_RADIUS, Math.sin(a2) * COIN_RADIUS, halfThick
    );
    
    // Face traseira
    faceVerts.push(
      0, 0, -halfThick,
      Math.cos(a2) * COIN_RADIUS, Math.sin(a2) * COIN_RADIUS, -halfThick,
      Math.cos(a1) * COIN_RADIUS, Math.sin(a1) * COIN_RADIUS, -halfThick
    );
  }
  
  // Borda lateral
  for(let j = 0; j < COIN_SEGMENTS; j++){
    const a1 = (j / COIN_SEGMENTS) * 2 * Math.PI;
    const a2 = ((j + 1) / COIN_SEGMENTS) * 2 * Math.PI;
    const x1 = Math.cos(a1) * COIN_RADIUS;
    const y1 = Math.sin(a1) * COIN_RADIUS;
    const x2 = Math.cos(a2) * COIN_RADIUS;
    const y2 = Math.sin(a2) * COIN_RADIUS;
    
    edgeVerts.push(
      x1, y1, halfThick,
      x1, y1, -halfThick,
      x2, y2, halfThick,
      
      x2, y2, halfThick,
      x1, y1, -halfThick,
      x2, y2, -halfThick
    );
  }
  
  return { faceVerts, edgeVerts };
}

const coinGeometry = createSingleCoinGeometry();
const bufCoinFace = createBufferFloat32(coinGeometry.faceVerts);
const bufCoinEdge = createBufferFloat32(coinGeometry.edgeVerts);

// ---------- ESFERA (jogador) ----------
function createSphere(r, seg){
  const v = [];
  for(let lat=0; lat<=seg; lat++){
    const theta = lat * Math.PI / seg;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    for(let lon=0; lon<=seg; lon++){
      const phi = lon * 2 * Math.PI / seg;
      const x = Math.cos(phi)*sinTheta;
      const y = cosTheta;
      const z = Math.sin(phi)*sinTheta;
      v.push(r*x, r*y, r*z);
    }
  }
  const indices = [];
  for(let lat=0; lat<seg; lat++){
    for(let lon=0; lon<seg; lon++){
      const first = lat*(seg+1) + lon;
      const second = first + seg + 1;
      indices.push(first, second, first+1);
      indices.push(second, second+1, first+1);
    }
  }
  const tri = [];
  for(const idx of indices) tri.push(v[idx*3], v[idx*3+1], v[idx*3+2]);
  return tri;
}
const bufSphere = createBufferFloat32(createSphere(0.5, 16));

// ---------- Matrizes ----------
function perspective(fovy, aspect, near, far){
  const f = 1.0 / Math.tan(fovy/2);
  const nf = 1/(near-far);
  return new Float32Array([
    f/aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far+near)*nf, -1,
    0, 0, 2*far*near*nf, 0
  ]);
}
function lookAt(eye, center, up){
  const [ex,ey,ez]=[eye[0],eye[1],eye[2]];
  const [cx,cy,cz]=[center[0],center[1],center[2]];
  let zx=ex-cx, zy=ey-cy, zz=ez-cz;
  let len=Math.hypot(zx,zy,zz); if(len>0){zx/=len;zy/=len;zz/=len;}
  let xx=up[1]*zz-up[2]*zy, xy=up[2]*zx-up[0]*zz, xz=up[0]*zy-up[1]*zx;
  len=Math.hypot(xx,xy,xz); if(len>0){xx/=len;xy/=len;xz/=len;}
  const yx=zy*xz-zz*xy, yy=zz*xx-zx*xz, yz=zx*xy-zy*xx;
  return new Float32Array([
    xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0,
    -(xx*ex+xy*ey+xz*ez), -(yx*ex+yy*ey+yz*ez), -(zx*ex+zy*ey+zz*ez), 1
  ]);
}
function identity(){
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
}
function translate(out, a, v){
  const x=v[0], y=v[1], z=v[2];
  out[12] = a[0]*x + a[4]*y + a[8]*z + a[12];
  out[13] = a[1]*x + a[5]*y + a[9]*z + a[13];
  out[14] = a[2]*x + a[6]*y + a[10]*z + a[14];
  out[15] = a[3]*x + a[7]*y + a[11]*z + a[15];
  if(a!==out){ for(let i=0;i<12;i++) out[i]=a[i]; }
  return out;
}

const projMat = perspective(Math.PI/3, canvas.width/canvas.height, 0.1, 300);
gl.uniformMatrix4fv(uProj, false, projMat);

// ---------- PLAYER ----------
const LANE_CENTER_X = [-LANE_WIDTH, 0, LANE_WIDTH];
const player = {
  x: 0,
  y: 0.5,
  z: 0,
  targetLane: 1,
  forwardSpeed: 10,
  coinsCollected: 0
};

// Criar elemento HTML para contador de moedas
const coinCounter = document.createElement('div');
coinCounter.id = 'coinCounter';
coinCounter.style.cssText = `
  position: fixed;
  top: 20px;
  right: 20px;
  font-family: Arial, sans-serif;
  font-size: 32px;
  font-weight: bold;
  color: #FFD700;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
  z-index: 1000;
  background: rgba(0,0,0,0.5);
  padding: 10px 20px;
  border-radius: 10px;
  border: 3px solid #FFD700;
`;
coinCounter.textContent = '🪙 0';
document.body.appendChild(coinCounter);

window.addEventListener('keydown', e=>{
  const k = e.key.toLowerCase();
  if(k==='arrowleft'||k==='a') player.targetLane = Math.max(0, player.targetLane-1);
  if(k==='arrowright'||k==='d') player.targetLane = Math.min(2, player.targetLane+1);
});

function clampToWalls(x){
  const half = TOTAL_WIDTH/2 - 0.4;
  return Math.max(-half, Math.min(half, x));
}

function setAttrib(buf){
  gl.bindBuffer(gl.ARRAY_BUFFER, buf.buffer);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos,3,gl.FLOAT,false,0,0);
}

function draw(buf, model, color){
  gl.uniform3fv(uColor,color);
  gl.uniformMatrix4fv(uModel,false,model);
  setAttrib(buf);
  gl.drawArrays(gl.TRIANGLES,0,buf.count);
}

// ---------- Detecção de colisão ----------
function checkCoinCollisions(){
  coins.forEach(coin => {
    if(!coin.active) return;
    
    const dx = player.x - coin.x;
    const dy = player.y - coin.y;
    const dz = player.z - coin.z;
    const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
    
    if(distance < 0.7){
      coin.active = false;
      player.coinsCollected++;
      coinCounter.textContent = '🪙 ' + player.coinsCollected;
    }
  });
}

// ---------- LOOP ----------
let last = performance.now();

function update(dt){
  player.z -= player.forwardSpeed * dt;
  const targetX = LANE_CENTER_X[player.targetLane];
  player.x += (targetX - player.x) * Math.min(1, 6*dt);
  player.x = clampToWalls(player.x);
  
  checkCoinCollisions();
  
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

  const camEye = [ player.x*0.3, 4.0, player.z+6.5 ];
  const camTarget = [ player.x, 0.8, player.z-4.0 ];
  const viewMat = lookAt(camEye, camTarget, [0,1,0]);
  gl.uniformMatrix4fv(uView,false,viewMat);

  gl.clearColor(0.53,0.80,0.92,1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  draw(bufSky, identity(), [0.40,0.60,1.00]);
  draw(bufGrass, identity(), [0.05,0.55,0.05]);
  draw(bufTrack, identity(), [0.18,0.18,0.18]);
  draw(bufLines, identity(), [1,1,1]);
  draw(bufWalls, identity(), [0.7,0.12,0.12]);
  
  // Desenhar apenas moedas ativas
  coins.forEach(coin => {
    if(coin.active){
      const modelCoin = translate(identity(), identity(), [coin.x, coin.y, coin.z]);
      draw(bufCoinFace, modelCoin, [1.0, 0.84, 0.0]);
      draw(bufCoinEdge, modelCoin, [0.8, 0.65, 0.0]);
    }
  });

  const modelSphere = translate(identity(), identity(), [player.x,player.y,player.z]);
  draw(bufSphere, modelSphere, [0.95,0.45,0.2]);

  requestAnimationFrame(render);
}

requestAnimationFrame(render);

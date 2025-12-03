// track.js - WebGL puro
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
  const w = 0.12;
  const len = 2.0;
  lineVerts.push(-w, 0.01, -z);
  lineVerts.push( w, 0.01, -z);
  lineVerts.push( w, 0.01, -z - len);

  lineVerts.push(-w, 0.01, -z);
  lineVerts.push( w, 0.01, -z - len);
  lineVerts.push(-w, 0.01, -z - len);
}
const bufLines = createBufferFloat32(lineVerts);

// ---------- WALLS (muretas dos lados) ----------
const wallVerts = [];
for(let z=0; z<TRACK_LENGTH; z+=2){
  const h = 0.8;
  const seg = 2.0;

  const xL = -TOTAL_WIDTH/2 - 0.05;
  wallVerts.push(xL,0,-z,  xL,h,-z,  xL,h,-z-seg);
  wallVerts.push(xL,0,-z,  xL,h,-z-seg, xL,0,-z-seg);

  const xR = TOTAL_WIDTH/2 + 0.05;
  wallVerts.push(xR,0,-z,  xR,h,-z,  xR,h,-z-seg);
  wallVerts.push(xR,0,-z,  xR,h,-z-seg, xR,0,-z-seg);
}
const bufWalls = createBufferFloat32(wallVerts);

// ---------- GRASS (NOVO!) ----------
const grassVerts = [];
const GRASS_WIDTH = 6.0;

const leftStart = -TOTAL_WIDTH/2 - 0.40 - GRASS_WIDTH;
const leftEnd   = -TOTAL_WIDTH/2 - 0.40;

const rightStart = TOTAL_WIDTH/2 + 0.40;
const rightEnd   = TOTAL_WIDTH/2 + 0.40 + GRASS_WIDTH;

// gramado esquerdo
grassVerts.push(
  leftStart,0,0,
  leftEnd,0,0,
  leftEnd,0,-TRACK_LENGTH,

  leftStart,0,0,
  leftEnd,0,-TRACK_LENGTH,
  leftStart,0,-TRACK_LENGTH
);

// gramado direito
grassVerts.push(
  rightStart,0,0,
  rightEnd,0,0,
  rightEnd,0,-TRACK_LENGTH,

  rightStart,0,0,
  rightEnd,0,-TRACK_LENGTH,
  rightStart,0,-TRACK_LENGTH
);

const bufGrass = createBufferFloat32(grassVerts);

// ---------- SKY ----------
const skyVerts = [
  -2000,120,0,
   2000,120,0,
   2000,120,-TRACK_LENGTH,
  -2000,120,0,
   2000,120,-TRACK_LENGTH,
  -2000,120,-TRACK_LENGTH
];
const bufSky = createBufferFloat32(skyVerts);

// ---------- SPHERE ----------
function makeSphereVerts(radius=0.35, latBands=10, longBands=16){
  const v=[];
  for(let lat=0; lat<latBands; lat++){
    const t1 = Math.PI * lat/latBands;
    const t2 = Math.PI * (lat+1)/latBands;

    for(let lon=0; lon<longBands; lon++){
      const p1 = 2*Math.PI * lon/longBands;
      const p2 = 2*Math.PI * (lon+1)/longBands;

      const x1 = radius*Math.sin(t1)*Math.cos(p1);
      const y1 = radius*Math.cos(t1);
      const z1 = radius*Math.sin(t1)*Math.sin(p1);

      const x2 = radius*Math.sin(t2)*Math.cos(p1);
      const y2 = radius*Math.cos(t2);
      const z2 = radius*Math.sin(t2)*Math.sin(p1);

      const x3 = radius*Math.sin(t2)*Math.cos(p2);
      const y3 = radius*Math.cos(t2);
      const z3 = radius*Math.sin(t2)*Math.sin(p2);

      const x4 = radius*Math.sin(t1)*Math.cos(p2);
      const y4 = radius*Math.cos(t1);
      const z4 = radius*Math.sin(t1)*Math.sin(p2);

      v.push(x1,y1,z1, x2,y2,z2, x3,y3,z3);
      v.push(x1,y1,z1, x3,y3,z3, x4,y4,z4);
    }
  }
  return v;
}
const bufSphere = createBufferFloat32(makeSphereVerts());

// ---------- MATH ----------
function perspective(out,fovy,aspect,near,far){
  const f = 1.0 / Math.tan(fovy/2);
  out = out || new Float32Array(16);
  out[0]=f/aspect; out[5]=f; out[10]=(far+near)/(near-far); out[11]=-1;
  out[14]=(2*far*near)/(near-far);
  return out;
}
function identity(){
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
}
function translate(out,m,v){
  out = new Float32Array(m);
  out[12] += v[0]; out[13] += v[1]; out[14] += v[2];
  return out;
}
function lookAt(eye,center,up){
  const zx = eye[0]-center[0], zy = eye[1]-center[1], zz = eye[2]-center[2];
  let l = Math.hypot(zx,zy,zz); l = l||1;
  const z0=zx/l, z1=zy/l, z2=zz/l;

  let xx = up[1]*z2 - up[2]*z1;
  let xy = up[2]*z0 - up[0]*z2;
  let xz = up[0]*z1 - up[1]*z0;
  l = Math.hypot(xx,xy,xz); l = l||1;
  const x0=xx/l, x1=xy/l, x2=xz/l;

  const y0 = z1*x2 - z2*x1;
  const y1 = z2*x0 - z0*x2;
  const y2 = z0*x1 - z1*x0;

  return new Float32Array([
    x0,y0,z0,0,
    x1,y1,z1,0,
    x2,y2,z2,0,
    -(x0*eye[0]+x1*eye[1]+x2*eye[2]),
    -(y0*eye[0]+y1*eye[1]+y2*eye[2]),
    -(z0*eye[0]+z1*eye[1]+z2*eye[2]),
    1
  ]);
}

const projMat = perspective(null, Math.PI/3, canvas.width/canvas.height, 0.1, 2000);
gl.uniformMatrix4fv(uProj,false,projMat);

// ---------- PLAYER ----------
const LANE_CENTER_X = [-LANE_WIDTH, 0, LANE_WIDTH];

let player = {
  laneIndex:1,
  targetLane:1,
  x:0,
  z:-1,
  y:0.35,
  radius:0.35,
  forwardSpeed:6
};

window.addEventListener('keydown', (e)=>{
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

// ---------- LOOP ----------
let last = performance.now();

function update(dt){
  player.z -= player.forwardSpeed * dt;

  const targetX = LANE_CENTER_X[player.targetLane];
  player.x += (targetX - player.x) * Math.min(1, 6*dt);
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

  const modelSphere = translate(identity(), identity(), [player.x,player.y,player.z]);
  draw(bufSphere, modelSphere, [0.95,0.45,0.2]);

  requestAnimationFrame(render);
}

requestAnimationFrame(render);

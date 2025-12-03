

/* track.js */
const canvas = document.getElementById("glcanvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const gl = canvas.getContext("webgl");
if(!gl) alert("Seu navegador não suporta WebGL puro!");

// =========================
// SHADERS
// =========================
const vs = `
attribute vec3 aPos;
uniform mat4 uProj, uView, uModel;
void main(){ gl_Position = uProj * uView * uModel * vec4(aPos,1.0); }
`;

const fs = `
precision mediump float;
uniform vec3 uColor;
void main(){ gl_FragColor = vec4(uColor,1.0); }
`;

function compile(type, src){
 let s = gl.createShader(type);
 gl.shaderSource(s,src);
 gl.compileShader(s);
 return s;
}

let prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER,vs));
gl.attachShader(prog, compile(gl.FRAGMENT_SHADER,fs));
gl.linkProgram(prog);
gl.useProgram(prog);

const aPos = gl.getAttribLocation(prog,"aPos");
const uProj = gl.getUniformLocation(prog,"uProj");
const uView = gl.getUniformLocation(prog,"uView");
const uModel = gl.getUniformLocation(prog,"uModel");
const uColor = gl.getUniformLocation(prog,"uColor");

// =========================
// GEOMETRIA DA PISTA
// =========================
// pista longa: 2000 unidades → ~2 minutos andando
// largura: 3 vias = 3 * 2m = 6m
// desenhar como um retângulo gigante

const trackVerts = new Float32Array([
   -3,-1,0,   3,-1,0,   3,-1,-2000,
   -3,-1,0,   3,-1,-2000,   -3,-1,-2000
]);

// marcações centrais
const lines = [];
for(let i=0;i<2000;i+=10){
   lines.push(-0.05,-0.99,-i, 0.05,-0.99,-i, 0.05,-0.99,-i-2);
   lines.push(-0.05,-0.99,-i, 0.05,-0.99,-i-2, -0.05,-0.99,-i-2);
}
const lineVerts = new Float32Array(lines);

// céu (skybox simplificado: uma "caixa" gigante)
const skyVerts = new Float32Array([
   -2000,100,-2000, 2000,100,-2000, 2000,100,2000,
   -2000,100,-2000, 2000,100,2000, -2000,100,2000
]);

function makeBuffer(data){
 let b = gl.createBuffer();
 gl.bindBuffer(gl.ARRAY_BUFFER,b);
 gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
 return {buffer:b, count:data.length/3};
}
const bufTrack = makeBuffer(trackVerts);
const bufLines = makeBuffer(lineVerts);
const bufSky = makeBuffer(skyVerts);

// =========================
// CÂMERA E JOGADOR
// =========================
let laneX = 0;       // -2 = esquerda | 0 = meio | 2 = direita
let posZ = 0;
let speed = 6;       // velocidade

window.addEventListener("keydown", e=>{
   if(e.key==="ArrowLeft" || e.key==="a") laneX -= 2;
   if(e.key==="ArrowRight"|| e.key==="d") laneX += 2;
   laneX = Math.max(-2, Math.min(2,laneX));
});

// =========================
// MATRIZES
// =========================
function perspective(fov,aspect,near,far){
 let f = 1/Math.tan(fov/2), nf=1/(near-far);
 return new Float32Array([
  f/aspect,0,0,0,
  0,f,0,0,
  0,0,(far+near)*nf,-1,
  0,0,(2*far*near)*nf,0
 ]);
}

function lookAt(px,py,pz, tx,ty,tz){
 let zx = px-tx, zy = py-ty, zz = pz-tz;
 let rl = 1/Math.hypot(zx,zy,zz);
 zx*=rl; zy*=rl; zz*=rl;
 let xx = 0*zz - 1*zy;
 let xy = 1*zx - 0*zz;
 let xz = 0*zy - 0*zx;
 let xl = 1/Math.hypot(xx,xy,xz);
 xx*=xl; xy*=xl; xz*=xl;
 let yx = zy*xz - zz*xy;
 let yy = zz*xx - zx*xz;
 let yz = zx*xy - zy*xx;
 return new Float32Array([
   xx, yx, zx, 0,
   xy, yy, zy, 0,
   xz, yz, zz, 0,
   -(xx*px+xy*py+xz*pz),
   -(yx*px+yy*py+yz*pz),
   -(zx*px+zy*py+zz*pz), 1
 ]);
}

const proj = perspective(60*Math.PI/180, canvas.width/canvas.height, 0.1, 5000);

// =========================
// DRAW
// =========================
function drawBuffer(buf,color,model){
 gl.uniform3fv(uColor,color);
 gl.uniformMatrix4fv(uModel,false,model);
 gl.bindBuffer(gl.ARRAY_BUFFER, buf.buffer);
 gl.vertexAttribPointer(aPos,3,gl.FLOAT,false,0,0);
 gl.enableVertexAttribArray(aPos);
 gl.drawArrays(gl.TRIANGLES,0,buf.count);
}

function identity(){ return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); }

// =========================
// LOOP
// =========================
function loop(t){
 requestAnimationFrame(loop);
 posZ -= speed * 0.1;

 const view = lookAt(laneX,2,posZ+5, laneX,0,posZ-10);
 gl.uniformMatrix4fv(uProj,false,proj);
 gl.uniformMatrix4fv(uView,false,view);

 gl.clearColor(0.53,0.80,0.92,1);
 gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 gl.enable(gl.DEPTH_TEST);

 drawBuffer(bufSky,[0.4,0.6,1],identity());
 drawBuffer(bufTrack,[0.2,0.2,0.2],identity());
 drawBuffer(bufLines,[1,1,1],identity());
}
loop();

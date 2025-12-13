// BOMBA

// SHADERS
const vsSource = `
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

const fsSource = `
    varying highp vec2 vTextureCoord;
    uniform sampler2D uSampler;

    void main(void) {

        // --- CORPO DA BOMBA TOTALMENTE PRETO ---
        if(vTextureCoord.x < 0.5){
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            return;
        }

        // --- PAVIO / FOGO ---
        gl_FragColor = texture2D(uSampler, vTextureCoord);
    }
`;

// WEBGL INIT
const canvas = document.querySelector("#glCanvas");
const gl = canvas.getContext("webgl");
if (!gl) alert("WebGL não suportado");

function resizeCanvas() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0,0,w,h);
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// SHADER PROGRAM
function loadShader(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
        return null;
    }
    return s;
}

const program = gl.createProgram();
gl.attachShader(program, loadShader(gl, gl.VERTEX_SHADER, vsSource));
gl.attachShader(program, loadShader(gl, gl.FRAGMENT_SHADER, fsSource));
gl.linkProgram(program);
gl.useProgram(program);

// GEOMETRIA
const positions = [];
const uvs = [];

//  ESFERA PRETA
const stacks = 32, slices = 32, R = 1.0;

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

        positions.push(
            x00,y0,z00, x01,y1,z01, x10,y0,z10,
            x10,y0,z10, x01,y1,z01, x11,y1,z11
        );

        uvs.push(
            u0*0.5, v0, u0*0.5, v1, u1*0.5, v0,
            u1*0.5, v0, u0*0.5, v1, u1*0.5, v1
        );
    }
}

//  PAVIO
const fuseSegments = 50;
const fuseRadius = 0.06;
const fuseRadialSteps = 30;

const baseNormal = { x: 0, y: 1, z: 0 };

const baseCenter = {
    x: 0 + baseNormal.x * (R + fuseRadius*0.1),
    y: R + baseNormal.y * (fuseRadius*0.1),
    z: 0 + baseNormal.z * (fuseRadius*0.1) + 0.05
};

function fusePath(t){
    const scale = 0.65;
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

// BUFFERS
const posBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
const aPos = gl.getAttribLocation(program, "aVertexPosition");
gl.enableVertexAttribArray(aPos);
gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

const uvBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);
const aUV = gl.getAttribLocation(program, "aTextureCoord");
gl.enableVertexAttribArray(aUV);
gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);

// TEXTURA
const texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);

const tex = document.createElement("canvas");
tex.width = 256;
tex.height = 64;
const ctx = tex.getContext("2d");

ctx.clearRect(0,0,tex.width,tex.height);

ctx.fillStyle = "#000000";
ctx.fillRect(0,0,tex.width/2, tex.height);

// pavio
const gx = ctx.createLinearGradient(tex.width/2, 0, tex.width, 0);
gx.addColorStop(0.00, "#bfa46f");
gx.addColorStop(0.60, "#4a2d0b");
gx.addColorStop(0.85, "#ff3300");
gx.addColorStop(1.00, "#ffdd00");
ctx.fillStyle = gx;
ctx.fillRect(tex.width/2, 0, tex.width/2, tex.height);

gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,tex);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
gl.generateMipmap(gl.TEXTURE_2D);

// MATRIZES / RENDER
function perspective(fovy, aspect, near, far) {
    const f = 1.0/Math.tan(fovy/2);
    const nf = 1/(near-far);
    return [
        f/aspect,0,0,0,
        0,f,0,0,
        0,0,(far+near)*nf,-1,
        0,0,(2*far*near)*nf,0
    ];
}

function mat4() {
    return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
}

function translate(m,x,y,z){ m[12]+=x; m[13]+=y; m[14]+=z; }
function rotateY(m,a){
    const c=Math.cos(a), s=Math.sin(a);
    const m0=m[0], m2=m[2], m8=m[8], m10=m[10];
    m[0]=c*m0 - s*m2;  m[2]=s*m0 + c*m2;
    m[8]=c*m8 - s*m10; m[10]=s*m8 + c*m10;
}

const uProj = gl.getUniformLocation(program,"uProjectionMatrix");
const uMV   = gl.getUniformLocation(program,"uModelViewMatrix");

gl.enable(gl.DEPTH_TEST);
gl.clearColor(0.15,0.15,0.15,1);

let rot = 0;

function render(){
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const proj = perspective(45*Math.PI/180, canvas.width/canvas.height, 0.1, 100);
    const mv = mat4();
    translate(mv,0,0,-5);
    rotateY(mv,rot);

    gl.uniformMatrix4fv(uProj,false,new Float32Array(proj));
    gl.uniformMatrix4fv(uMV,false,new Float32Array(mv));

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(gl.getUniformLocation(program,"uSampler"),0);

    gl.drawArrays(gl.TRIANGLES, 0, positions.length/3);

    rot += 0.01;
    requestAnimationFrame(render);
}

render();
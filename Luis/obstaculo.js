// OBSTÁCULO

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
        // Apenas a cor da textura, sem multiplicação por luz
        gl_FragColor = texture2D(uSampler, vTextureCoord);
    }
`;

// WEBGL INIT
const canvas = document.querySelector("#glCanvas");
const gl = canvas.getContext("webgl");
if (!gl) alert("Seu navegador não suporta WebGL.");

function resizeCanvas() {
    const w = Math.floor(window.innerWidth * window.devicePixelRatio);
    const h = Math.floor(window.innerHeight * window.devicePixelRatio);
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
    }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function loadShader(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
    }
    return s;
}
const program = gl.createProgram();
gl.attachShader(program, loadShader(gl, gl.VERTEX_SHADER, vsSource));
gl.attachShader(program, loadShader(gl, gl.FRAGMENT_SHADER, fsSource));
gl.linkProgram(program);
gl.useProgram(program);

// PARÂMETROS DO BARRIL
const segments = 40;
const stacks = 32;
const baseRadius = 1.0;
const bulge = 0.25;
const height = 2.2;
const halfH = height / 2;
const woodRepeat = 2.0; 

function radiusAtY(y) {
    const t = (y / halfH);
    return baseRadius * (1.0 + bulge * (1.0 - t * t));
}

// Arrays para os dados
const positions = [];
const uvs = [];

// Corpo do Barril
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

        // Triângulo 1
        positions.push(x00, y0, z00, x01, y1, z01, x10, y0, z10);
        uvs.push(u0*woodRepeat, v0, u0*woodRepeat, v1, u1*woodRepeat, v0);
        
        // Triângulo 2
        positions.push(x10, y0, z10, x01, y1, z01, x11, y1, z11);
        uvs.push(u1*woodRepeat, v0, u0*woodRepeat, v1, u1*woodRepeat, v1);
    }
}

// Tampas
function addCap(y, top) {
    const centerU = 0.5, centerV = 0.5; // Centro da textura
    for (let i = 0; i < segments; i++) {
        const u0 = i / segments;
        const u1 = (i + 1) / segments;
        const a0 = u0 * Math.PI * 2;
        const a1 = u1 * Math.PI * 2;
        const r = radiusAtY(y) * 0.95; 

        const x0 = Math.cos(a0) * r, z0 = Math.sin(a0) * r;
        const x1 = Math.cos(a1) * r, z1 = Math.sin(a1) * r;

        // Mapeamento planar circular
        const uv0 = [centerU + Math.cos(a0)*0.25, centerV + Math.sin(a0)*0.25];
        const uv1 = [centerU + Math.cos(a1)*0.25, centerV + Math.sin(a1)*0.25];

        if (top) {
            positions.push(0, y, 0, x0, y, z0, x1, y, z1);
            uvs.push(centerU, centerV, uv0[0], uv0[1], uv1[0], uv1[1]);
        } else {
            positions.push(0, y, 0, x1, y, z1, x0, y, z0);
            uvs.push(centerU, centerV, uv1[0], uv1[1], uv0[0], uv0[1]);
        }
    }
}
addCap(halfH, true);
addCap(-halfH, false);


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

// GERAÇÃO DE TEXTURA
const ctx = document.createElement('canvas').getContext('2d');
ctx.canvas.width = 1024;
ctx.canvas.height = 1024;

// Fundo Madeira
const woodHeight = 1024;
ctx.fillStyle = "#5c3a21"; 
ctx.fillRect(0, 0, 1024, woodHeight);

// Desenhar Tábuas
const planks = 10;
const plankW = 1024 / planks;
for(let i=0; i<planks; i++) {
    const x = i * plankW;
    
    // Variação de cor da tábua
    const tone = (Math.random() - 0.5) * 20;
    ctx.fillStyle = `rgb(${100+tone}, ${65+tone}, ${35+tone})`;
    ctx.fillRect(x, 0, plankW, woodHeight);

    // Veios da madeira
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = "#3e2514";
    for(let k=0; k<100; k++) {
        const rx = x + Math.random() * plankW;
        const ry = Math.random() * woodHeight;
        const rw = 1 + Math.random() * 4;
        const rh = 20 + Math.random() * 100;
        ctx.fillRect(rx, ry, rw, rh);
    }
    ctx.globalAlpha = 1.0;

    // Divisória escura entre tábuas
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(x, 0, 4, woodHeight);
    ctx.fillRect(x + plankW - 2, 0, 2, woodHeight);
}

//UPLOAD TEXTURE
const texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ctx.canvas);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.generateMipmap(gl.TEXTURE_2D);

// MATRIZES E RENDER
function perspective(fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    return [
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, (2 * far * near) * nf, 0
    ];
}
function mat4Create() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }
function mat4Translate(m, tx, ty, tz) { m[12]+=tx; m[13]+=ty; m[14]+=tz; }
function mat4RotateY(m, a) {
    const c = Math.cos(a), s = Math.sin(a);
    const m0=m[0], m2=m[2], m8=m[8], m10=m[10];
    m[0] = c*m0 - s*m2; m[2] = c*m2 + s*m0;
    m[8] = c*m8 - s*m10; m[10] = c*m10 + s*m8;
}

const uProj = gl.getUniformLocation(program, "uProjectionMatrix");
const uMV = gl.getUniformLocation(program, "uModelViewMatrix");

gl.enable(gl.DEPTH_TEST);
gl.clearColor(0.15, 0.15, 0.15, 1.0);

let rot = 0;
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = gl.canvas.width / gl.canvas.height;
    const proj = perspective(45 * Math.PI/180, aspect, 0.1, 100.0);
    const mv = mat4Create();
    mat4Translate(mv, 0, 0, -5.0);
    mat4RotateY(mv, rot);

    gl.uniformMatrix4fv(uProj, false, new Float32Array(proj));
    gl.uniformMatrix4fv(uMV, false, new Float32Array(mv));
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(gl.getUniformLocation(program, "uSampler"), 0);

    gl.drawArrays(gl.TRIANGLES, 0, positions.length / 3);

    rot += 0.01;
    requestAnimationFrame(render);
}
render();
// MOEDA

// Shaders

    // Vertex Shader
const vsSource = `
    attribute vec4 aVertexPosition;
    attribute vec2 aTextureCoord;
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    varying highp vec2 vTextureCoord;
    void main(void) {
        gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
        vTextureCoord = aTextureCoord;
    }
`;

    // Fragment Shader
const fsSource = `
    varying highp vec2 vTextureCoord;
    uniform sampler2D uSampler;
    void main(void) {
        // Correção do texture2D (D maiúsculo) aplicada
        gl_FragColor = texture2D(uSampler, vTextureCoord);
    }
`;

// Iniciar WebGL
const canvas = document.querySelector("#glCanvas");
const gl = canvas.getContext("webgl");

if (!gl) {
    alert("Seu navegador não suporta WebGL.");
}

// Gerenciar redimensionamento
function resizeCanvas() {
    const displayWidth  = window.innerWidth * window.devicePixelRatio;
    const displayHeight = window.innerHeight * window.devicePixelRatio;

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width  = displayWidth;
        canvas.height = displayHeight;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        return true;
    }
    return false;
}
resizeCanvas(); 

// Compila os shaders
function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

const shaderProgram = gl.createProgram();
gl.attachShader(shaderProgram, loadShader(gl, gl.VERTEX_SHADER, vsSource));
gl.attachShader(shaderProgram, loadShader(gl, gl.FRAGMENT_SHADER, fsSource));
gl.linkProgram(shaderProgram);
gl.useProgram(shaderProgram);

// Parte da Geometria (Cilindro)
 
const positions = [];
const textureCoords = [];
const radius = 1.0;
const thickness = 0.2;
const segments = 40; // Para ajustar o redondo da moeda

for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * 2 * Math.PI;
    const nextTheta = ((i + 1) / segments) * 2 * Math.PI;
    
    const x = Math.cos(theta) * radius;
    const y = Math.sin(theta) * radius;
    const nextX = Math.cos(nextTheta) * radius;
    const nextY = Math.sin(nextTheta) * radius;

    // Calculo das coordenadas
    // Y (V) permanece mesma para os dois lados.
    const coordY = -(y/radius)/2 + 0.5;
    const nextCoordY = -(nextY/radius)/2 + 0.5;

    // X (U) precisa ser "esmagada" para unifesp e $ nao ficarem na mesma face.
    const baseU = (x/radius)/2 + 0.5;
    const nextBaseU = (nextX/radius)/2 + 0.5;

    // Lado Esquerdo da textura (0.0 até 0.5) Coroa ($)
    const uFront = baseU / 2.0;
    const nextUFront = nextBaseU / 2.0;

    // Lado Direito da textura (0.5 até 1.0) Cara (UNIFESP)
    // Inverte o X do verso pra imagem não ficar espelhada
    const baseUBack = (-x/radius)/2 + 0.5;
    const nextBaseUBack = (-nextX/radius)/2 + 0.5;
    const uBack = baseUBack / 2.0 + 0.5;
    const nextUBack = nextBaseUBack / 2.0 + 0.5;


    // Cara (usa metade esquerda da textura)
    positions.push(0, 0, thickness/2);         textureCoords.push(0.25, 0.5); // Centro da esquerda
    positions.push(x, y, thickness/2);         textureCoords.push(uFront, coordY);
    positions.push(nextX, nextY, thickness/2); textureCoords.push(nextUFront, nextCoordY);

    // Coroa (usa metade fireita da textura)
    // Invertemos a ordem dos pontos x/y e nextX/nextY pra face apontar para trás 
    positions.push(0, 0, -thickness/2);          textureCoords.push(0.75, 0.5); // Centro da direita
    positions.push(nextX, nextY, -thickness/2);  textureCoords.push(nextUBack, nextCoordY);
    positions.push(x, y, -thickness/2);          textureCoords.push(uBack, coordY);

    // Borda (fatiazinha dourada da parte esquerda)
    const rimU1 = 0.0;
    const rimU2 = 0.05; // 5% da largura total 
    
    positions.push(x, y, thickness/2);            textureCoords.push(rimU1, 0); 
    positions.push(nextX, nextY, thickness/2);    textureCoords.push(rimU2, 0);
    positions.push(x, y, -thickness/2);           textureCoords.push(rimU1, 0.1);

    positions.push(nextX, nextY, thickness/2);    textureCoords.push(rimU2, 0);
    positions.push(nextX, nextY, -thickness/2);   textureCoords.push(rimU2, 0.1);
    positions.push(x, y, -thickness/2);           textureCoords.push(rimU1, 0.1);
}

// Buffers
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
const vertexPosition = gl.getAttribLocation(shaderProgram, "aVertexPosition");
gl.vertexAttribPointer(vertexPosition, 3, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(vertexPosition);

const textureCoordBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);
const textureCoord = gl.getAttribLocation(shaderProgram, "aTextureCoord");
gl.vertexAttribPointer(textureCoord, 2, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(textureCoord);

// Cria textura

const ctx = document.createElement('canvas').getContext('2d');

// Canvas 2x largura
ctx.canvas.width = 1024;
ctx.canvas.height = 512;

// Coroa $
// Fundo Dourado
ctx.fillStyle = '#FFD700';
ctx.fillRect(0, 0, 512, 512);
// Borda Laranja
ctx.beginPath();
// Centro do circulo
ctx.arc(256, 256, 240, 0, Math.PI * 2);
ctx.lineWidth = 20;
ctx.strokeStyle = '#DAA520';
ctx.stroke();
// Texto $
ctx.fillStyle = '#B8860B';
ctx.font = 'bold 300px sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('$', 256, 270);


// Cara UNIFESP
// origem do desneho
ctx.translate(512, 0);

// Fundo
ctx.fillStyle = '#FFD700'; 
ctx.fillRect(0, 0, 512, 512);

// Borda Unifesp
ctx.beginPath();
ctx.arc(256, 256, 240, 0, Math.PI * 2);
ctx.lineWidth = 20;
ctx.strokeStyle = '#B8860B'; // Azul escuro
ctx.stroke();

// Circulo e UNIFESP
ctx.fillStyle = '#DAA520';
ctx.beginPath();
ctx.arc(256, 256, 180, 0, Math.PI*2);
ctx.fill();

ctx.fillStyle = '#B8860B';
ctx.font = 'bold 80px sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('UNIFESP', 256, 256);

// Desfazer a translação para voltar ao normal, se necessário depois
ctx.translate(-512, 0);


// Enviar a textura para a GPU
const texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);
// Linear para a filtragem ficar boa na junção
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
// Clamp (não repetir a textura nas bordas)
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ctx.canvas);


// Matrizes

const mat4 = {
    perspective: function(fieldOfViewInRadians, aspect, near, far) {
        const f = Math.tan(Math.PI * 0.5 - 0.5 * fieldOfViewInRadians);
        const rangeInv = 1.0 / (near - far);
        return [
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (near + far) * rangeInv, -1,
            0, 0, near * far * rangeInv * 2, 0
        ];
    },
    create: function() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; },
    translate: function(m, tx, ty, tz) {
        m[12] += tx; m[13] += ty; m[14] += tz;
    },
    rotateY: function(m, angle) {
        const c = Math.cos(angle), s = Math.sin(angle);
        const mv0 = m[0], mv2 = m[2], mv8 = m[8], mv10 = m[10];
        m[0] = c * mv0 - s * mv2;
        m[2] = c * mv2 + s * mv0;
        m[8] = c * mv8 - s * mv10;
        m[10] = c * mv10 + s * mv8;
    }
};

// Renderização

const uProjectionMatrix = gl.getUniformLocation(shaderProgram, "uProjectionMatrix");
const uModelViewMatrix = gl.getUniformLocation(shaderProgram, "uModelViewMatrix");

let rotation = 0;

function render() {
    resizeCanvas(); 

    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    // Calcula o aspect ratio atualizado
    const aspect = gl.canvas.width / gl.canvas.height;
    const projectionMatrix = mat4.perspective(45 * Math.PI / 180, aspect, 0.1, 100.0);

    const modelViewMatrix = mat4.create();
    mat4.translate(modelViewMatrix, 0.0, 0.0, -5.0);
    mat4.rotateY(modelViewMatrix, rotation);

    gl.uniformMatrix4fv(uProjectionMatrix, false, new Float32Array(projectionMatrix));
    gl.uniformMatrix4fv(uModelViewMatrix, false, new Float32Array(modelViewMatrix));

    gl.drawArrays(gl.TRIANGLES, 0, positions.length / 3);

    rotation += 0.03;
    requestAnimationFrame(render);
}

render();
# 💡 Sistema de Iluminação - Aline

## 📦 Arquivos:
1. `normals.js` - Calcula normais automaticamente
2. `shaders-luz.js` - Shaders com iluminação Phong
3. `config-luz.js` - Configura luz automaticamente

## 🛠️ Como usar nos objetos:
// 1. Use meus shaders
const vsSource = window.shadersComLuz ? window.shadersComLuz.vertex : `...`;
const fsSource = window.shadersComLuz ? window.shadersComLuz.fragment : `...`;

// 2. Calcule normais (DEPOIS de gerar vertices)
const normals = window.calcularNormais ? window.calcularNormais(positions) : [];

// 3. Crie buffer de normais (DEPOIS do uvBuffer)
const normalBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
const aNormal = gl.getAttribLocation(program, "aVertexNormal");
if (aNormal !== -1) {
    gl.enableVertexAttribArray(aNormal);
    gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
}

// 4. Configure luz (DEPOIS de uProj e uMV)
let configLuz = null;
if (window.configurarIluminacao) {
    configLuz = window.configurarIluminacao(gl, program);
}

// 5. Aplique luz (na função render(), ANTES de gl.drawArrays())
if (configLuz) {
    configLuz.aplicar(mv);
}

### Passo 1: Carregue meus arquivos no HTML
```html
<script src="../Aline/normals.js"></script>
<script src="../Aline/shaders-luz.js"></script>
<script src="../Aline/config-luz.js"></script>
// Configura iluminação
function configurarIluminacao(gl, program) {
    // Obter locations dos uniforms
    const uNormalMatrix = gl.getUniformLocation(program, "uNormalMatrix");
    const uLightPosition = gl.getUniformLocation(program, "uLightPosition");
    const uAmbientColor = gl.getUniformLocation(program, "uAmbientColor");
    const uLightColor = gl.getUniformLocation(program, "uLightColor");
    
    // Configurar valores padrão
    return {
        aplicar: function(modelViewMatrix) {
            // Criar matriz normal simples
            const m = modelViewMatrix;
            const normalMat = [
                m[0], m[1], m[2],
                m[4], m[5], m[6],
                m[8], m[9], m[10]
            ];
            
            if (uNormalMatrix) gl.uniformMatrix3fv(uNormalMatrix, false, normalMat);
            if (uLightPosition) gl.uniform3f(uLightPosition, 5, 5, 5);
            if (uAmbientColor) gl.uniform3f(uAmbientColor, 0.2, 0.2, 0.2);
            if (uLightColor) gl.uniform3f(uLightColor, 1, 1, 1);
        }
    };
}

window.configurarIluminacao = configurarIluminacao;
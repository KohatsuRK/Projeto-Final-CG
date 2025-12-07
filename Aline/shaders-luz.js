// shaders-luz.js - Shaders prontos com iluminação
const shadersComLuz = {
    // Vertex shader com luz
    vertex: `
        attribute vec3 aVertexPosition;
        attribute vec3 aVertexNormal;
        attribute vec2 aTextureCoord;

        uniform mat4 uModelViewMatrix;
        uniform mat4 uProjectionMatrix;
        uniform mat3 uNormalMatrix;

        varying highp vec2 vTextureCoord;
        varying highp vec3 vNormal;
        varying highp vec3 vPosition;

        void main(void) {
            vec4 position = uModelViewMatrix * vec4(aVertexPosition, 1.0);
            vPosition = position.xyz;
            vNormal = normalize(uNormalMatrix * aVertexNormal);
            vTextureCoord = aTextureCoord;
            
            gl_Position = uProjectionMatrix * position;
        }
    `,
    
    // Fragment shader com luz básica
    fragment: `
        precision mediump float;
        
        varying highp vec2 vTextureCoord;
        varying highp vec3 vNormal;
        varying highp vec3 vPosition;
        
        uniform sampler2D uSampler;
        uniform vec3 uLightPosition;
        uniform vec3 uAmbientColor;
        uniform vec3 uLightColor;

        void main(void) {
            // Luz difusa simples
            vec3 normal = normalize(vNormal);
            vec3 lightDir = normalize(uLightPosition - vPosition);
            
            float difusa = max(dot(normal, lightDir), 0.0);
            vec3 luz = uAmbientColor + (uLightColor * difusa);
            
            vec4 corTextura = texture2D(uSampler, vTextureCoord);
            gl_FragColor = vec4(luz * corTextura.rgb, corTextura.a);
        }
    `
};

window.shadersComLuz = shadersComLuz;
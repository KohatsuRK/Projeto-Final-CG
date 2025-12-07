// normals.js - Calcula normais para qualquer objeto
function calcularNormais(vertices) {
    const normals = [];
    
    for (let i = 0; i < vertices.length; i += 9) {
        const v0 = [vertices[i], vertices[i+1], vertices[i+2]];
        const v1 = [vertices[i+3], vertices[i+4], vertices[i+5]];
        const v2 = [vertices[i+6], vertices[i+7], vertices[i+8]];
        
        const edge1 = [v1[0]-v0[0], v1[1]-v0[1], v1[2]-v0[2]];
        const edge2 = [v2[0]-v0[0], v2[1]-v0[1], v2[2]-v0[2]];
        
        const normal = [
            edge1[1]*edge2[2] - edge1[2]*edge2[1],
            edge1[2]*edge2[0] - edge1[0]*edge2[2],
            edge1[0]*edge2[1] - edge1[1]*edge2[0]
        ];
        
        const length = Math.sqrt(normal[0]**2 + normal[1]**2 + normal[2]**2);
        
        for (let j = 0; j < 3; j++) {
            normals.push(normal[0]/length, normal[1]/length, normal[2]/length);
        }
    }
    
    return normals;
}

// Expor para usar em outros arquivos
window.calcularNormais = calcularNormais;
export var AttributeLocation;
(function (AttributeLocation) {
    AttributeLocation[AttributeLocation["position"] = 0] = "position";
    AttributeLocation[AttributeLocation["normal"] = 1] = "normal";
    AttributeLocation[AttributeLocation["tangent"] = 2] = "tangent";
    AttributeLocation[AttributeLocation["texcoord"] = 3] = "texcoord";
    AttributeLocation[AttributeLocation["texcoord2"] = 4] = "texcoord2";
    AttributeLocation[AttributeLocation["color"] = 5] = "color";
    AttributeLocation[AttributeLocation["joints"] = 6] = "joints";
    AttributeLocation[AttributeLocation["weights"] = 7] = "weights";
})(AttributeLocation || (AttributeLocation = {}));
;
;
;
;
;
;
export class RenderGeometry {
    drawCount;
    vertexBuffers;
    layout;
    indexBuffer;
    constructor(drawCount, vertexBuffers, layout, indexBuffer) {
        this.drawCount = drawCount;
        this.vertexBuffers = vertexBuffers;
        this.layout = layout;
        this.indexBuffer = indexBuffer;
    }
}
;
//# sourceMappingURL=geometry.js.map
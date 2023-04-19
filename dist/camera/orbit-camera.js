import { Mat4, Vec3 } from '../../node_modules/gl-matrix/dist/esm/index.js';
export class OrbitCamera {
    orbitX = 0;
    orbitY = 0;
    maxOrbitX = Math.PI * 0.5;
    minOrbitX = -Math.PI * 0.5;
    maxOrbitY = Math.PI;
    minOrbitY = -Math.PI;
    constrainXOrbit = true;
    constrainYOrbit = false;
    maxDistance = 10;
    minDistance = 1;
    distanceStep = 0.005;
    constrainDistance = true;
    #distance = new Vec3(0, 0, 5);
    #target = new Vec3();
    #viewMat = new Mat4();
    #cameraMat = new Mat4();
    #position = new Vec3();
    #dirty = true;
    #element;
    #registerElement;
    constructor(element = null) {
        let lastX;
        let lastY;
        let eventCache = [];
        let lastPinchDelta = -1;
        const downCallback = (event) => {
            const index = eventCache.findIndex((cachedEvent) => cachedEvent.pointerId === event.pointerId);
            if (index >= 0) {
                eventCache[index] = event;
            }
            else {
                eventCache.push(event);
            }
            lastX = event.pageX;
            lastY = event.pageY;
        };
        const moveCallback = (event) => {
            let xDelta;
            let yDelta;
            // Pinch zoom gesture handling from:
            // https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Pinch_zoom_gestures
            const index = eventCache.findIndex((cachedEvent) => cachedEvent.pointerId === event.pointerId);
            eventCache[index] = event;
            if (document.pointerLockElement === this.#element) {
                xDelta = event.movementX;
                yDelta = event.movementY;
                this.orbit(xDelta * 0.025, yDelta * 0.025);
            }
            else if (eventCache.length === 1) {
                xDelta = event.pageX - lastX;
                yDelta = event.pageY - lastY;
                lastX = event.pageX;
                lastY = event.pageY;
                this.orbit(xDelta * 0.025, yDelta * 0.025);
            }
            else if (eventCache.length === 2) {
                // If two pointers are down, check for pinch gestures
                // Calculate the distance between the two pointers
                const pinchDelta = Math.abs(eventCache[0].clientX - eventCache[1].clientX);
                if (lastPinchDelta > 0) {
                    zoomCamera((lastPinchDelta - pinchDelta) * 10);
                }
                // Cache the distance for the next move event
                lastPinchDelta = pinchDelta;
            }
        };
        const upCallback = (event) => {
            // Remove the pointerId from the eventCache
            const index = eventCache.findIndex((cachedEvent) => cachedEvent.pointerId === event.pointerId);
            eventCache.splice(index, 1);
            if (eventCache.length < 2) {
                lastPinchDelta = -1;
            }
        };
        const wheelCallback = (event) => {
            zoomCamera(-event.deltaY);
            event.preventDefault();
        };
        const zoomCamera = (delta) => {
            this.distance = this.#distance[2] + (delta * this.distanceStep);
        };
        this.#registerElement = (value) => {
            if (this.#element && this.#element != value) {
                this.#element.removeEventListener('pointerdown', downCallback);
                this.#element.removeEventListener('pointermove', moveCallback);
                this.#element.removeEventListener('pointerup', upCallback);
                this.#element.removeEventListener('pointercancel', upCallback);
                this.#element.removeEventListener('pointerout', upCallback);
                this.#element.removeEventListener('pointerleave', upCallback);
                this.#element.removeEventListener('wheel', wheelCallback);
            }
            this.#element = value;
            if (this.#element) {
                this.#element.addEventListener('pointerdown', downCallback);
                this.#element.addEventListener('pointermove', moveCallback);
                this.#element.addEventListener('pointerup', upCallback);
                this.#element.addEventListener('pointercancel', upCallback);
                this.#element.addEventListener('pointerout', upCallback);
                this.#element.addEventListener('pointerleave', upCallback);
                this.#element.addEventListener('wheel', wheelCallback);
            }
        };
        this.#element = element;
        this.#registerElement(element);
    }
    set element(value) {
        this.#registerElement(value);
    }
    get element() {
        return this.#element;
    }
    orbit(xDelta, yDelta) {
        if (xDelta || yDelta) {
            this.orbitY += xDelta;
            if (this.constrainYOrbit) {
                this.orbitY = Math.min(Math.max(this.orbitY, this.minOrbitY), this.maxOrbitY);
            }
            else {
                while (this.orbitY < -Math.PI) {
                    this.orbitY += Math.PI * 2;
                }
                while (this.orbitY >= Math.PI) {
                    this.orbitY -= Math.PI * 2;
                }
            }
            this.orbitX += yDelta;
            if (this.constrainXOrbit) {
                this.orbitX = Math.min(Math.max(this.orbitX, this.minOrbitX), this.maxOrbitX);
            }
            else {
                while (this.orbitX < -Math.PI) {
                    this.orbitX += Math.PI * 2;
                }
                while (this.orbitX >= Math.PI) {
                    this.orbitX -= Math.PI * 2;
                }
            }
            this.#dirty = true;
        }
    }
    get target() {
        return [this.#target[0], this.#target[1], this.#target[2]];
    }
    set target(value) {
        Vec3.copy(this.#target, value);
        this.#dirty = true;
    }
    ;
    get distance() {
        return -this.#distance[2];
    }
    ;
    set distance(value) {
        this.#distance[2] = value;
        if (this.constrainDistance) {
            this.#distance[2] = Math.min(Math.max(this.#distance[2], this.minDistance), this.maxDistance);
        }
        this.#dirty = true;
    }
    ;
    #updateMatrices() {
        if (this.#dirty) {
            let camMat = this.#cameraMat;
            camMat.identity();
            camMat.translate(this.#target);
            camMat.rotateY(-this.orbitY).rotateX(-this.orbitX);
            camMat.translate(this.#distance);
            Mat4.invert(this.#viewMat, camMat);
            this.#dirty = false;
        }
    }
    get position() {
        this.#updateMatrices();
        Vec3.set(this.#position, 0, 0, 0);
        Vec3.transformMat4(this.#position, this.#position, this.#cameraMat);
        return this.#position;
    }
    get viewMatrix() {
        this.#updateMatrices();
        return this.#viewMat;
    }
}
//# sourceMappingURL=orbit-camera.js.map
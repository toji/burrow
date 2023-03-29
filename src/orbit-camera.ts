import { Mat4, Vec3 } from '../../gl-matrix/dist/src/index.js';

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
    let moving = false;
    let lastX, lastY;

    const downCallback = (event) => {
      if (event.isPrimary) {
        moving = true;
      }
      lastX = event.pageX;
      lastY = event.pageY;
    };
    const moveCallback = (event) => {
      let xDelta, yDelta;

      if(document.pointerLockElement) {
          xDelta = event.movementX;
          yDelta = event.movementY;
          this.orbit(xDelta * 0.025, yDelta * 0.025);
      } else if (moving) {
          xDelta = event.pageX - lastX;
          yDelta = event.pageY - lastY;
          lastX = event.pageX;
          lastY = event.pageY;
          this.orbit(xDelta * 0.025, yDelta * 0.025);
      }
    };
    const upCallback = (event) => {
      if (event.isPrimary) {
        moving = false;
      }
    };
    const wheelCallback = (event) => {
      this.distance = this.#distance[2] + (-event.wheelDeltaY * this.distanceStep);
      event.preventDefault();
    };

    this.#registerElement = (value) => {
      if (this.#element && this.#element != value) {
        this.#element.removeEventListener('pointerdown', downCallback);
        this.#element.removeEventListener('pointermove', moveCallback);
        this.#element.removeEventListener('pointerup', upCallback);
        this.#element.removeEventListener('mousewheel', wheelCallback);
      }

      this.#element = value;
      if (this.#element) {
        this.#element.addEventListener('pointerdown', downCallback);
        this.#element.addEventListener('pointermove', moveCallback);
        this.#element.addEventListener('pointerup', upCallback);
        this.#element.addEventListener('mousewheel', wheelCallback);
      }
    }

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
    if(xDelta || yDelta) {
      this.orbitY += xDelta;
      if(this.constrainYOrbit) {
          this.orbitY = Math.min(Math.max(this.orbitY, this.minOrbitY), this.maxOrbitY);
      } else {
          while (this.orbitY < -Math.PI) {
              this.orbitY += Math.PI * 2;
          }
          while (this.orbitY >= Math.PI) {
              this.orbitY -= Math.PI * 2;
          }
      }

      this.orbitX += yDelta;
      if(this.constrainXOrbit) {
          this.orbitX = Math.min(Math.max(this.orbitX, this.minOrbitX), this.maxOrbitX);
      } else {
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
    this.#target[0] = value[0];
    this.#target[1] = value[1];
    this.#target[2] = value[2];
    this.#dirty = true;
  };

  get distance() {
    return -this.#distance[2];
  };

  set distance(value) {
    this.#distance[2] = value;
    if(this.constrainDistance) {
      this.#distance[2] = Math.min(Math.max(this.#distance[2], this.minDistance), this.maxDistance);
    }
    this.#dirty = true;
  };

  #updateMatrices() {
    if (this.#dirty) {
      let mv = this.#cameraMat;
      mv.identity();

      mv.translate(this.#target);
      mv.rotateY(-this.orbitY);
      mv.rotateX(-this.orbitX);
      mv.translate(this.#distance);
      Mat4.invert(this.#viewMat, this.#cameraMat);

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
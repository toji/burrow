import { Mat4, Vec3, Vec3Like } from '../../gl-matrix/dist/src/index.js';

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

  #element: HTMLElement;
  #registerElement: (value: HTMLElement) => void;

  constructor(element = null) {
    let moving = false;
    let lastX: number;
    let lastY: number;

    const downCallback = (event: PointerEvent) => {
      if (event.isPrimary) {
        moving = true;
      }
      lastX = event.pageX;
      lastY = event.pageY;
    };
    const moveCallback = (event: PointerEvent) => {
      let xDelta: number;
      let yDelta: number;

      if(document.pointerLockElement === this.#element) {
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
    const upCallback = (event: PointerEvent) => {
      if (event.isPrimary) {
        moving = false;
      }
    };
    const wheelCallback = (event: WheelEvent) => {
      this.distance = this.#distance[2] + (-event.deltaY * this.distanceStep);
      event.preventDefault();
    };

    this.#registerElement = (value: HTMLElement) => {
      if (this.#element && this.#element != value) {
        this.#element.removeEventListener('pointerdown', downCallback);
        this.#element.removeEventListener('pointermove', moveCallback);
        this.#element.removeEventListener('pointerup', upCallback);
        this.#element.removeEventListener('wheel', wheelCallback);
      }

      this.#element = value;
      if (this.#element) {
        this.#element.addEventListener('pointerdown', downCallback);
        this.#element.addEventListener('pointermove', moveCallback);
        this.#element.addEventListener('pointerup', upCallback);
        this.#element.addEventListener('wheel', wheelCallback);
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

  orbit(xDelta: number, yDelta: number) {
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

  get target(): Vec3Like {
    return [this.#target[0], this.#target[1], this.#target[2]];
  }

  set target(value: Vec3Like) {
    Vec3.copy(this.#target, value);
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
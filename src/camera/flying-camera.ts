import { Mat4, Vec3 } from '../../node_modules/gl-matrix/dist/esm/index.js';

const DIR = Vec3.create();

export class FlyingCamera {
  #element: HTMLElement = null;
  #angles = new Vec3();
  #position = new Vec3();
  #viewMat = new Mat4();
  #rotMat = new Mat4();
  #pressedKeys = new Array(128);
  #dirty = true;

  #pointerdownCallback: (e: PointerEvent) => void;
  #pointermoveCallback: (e: PointerEvent) => void;
  #pointerupCallback: (e: PointerEvent) => void;

  speed = 3;

  constructor(element?: HTMLElement) {
    window.addEventListener('keydown', (event) => {
      this.#pressedKeys[event.keyCode] = true;
    });
    window.addEventListener('keyup', (event) => {
      this.#pressedKeys[event.keyCode] = false;
    });

    let moving = false;
    let lastX: number;
    let lastY: number;
    this.#pointerdownCallback = (event) => {
      if (event.isPrimary) {
        moving = true;
      }
      lastX = event.pageX;
      lastY = event.pageY;
    };
    this.#pointermoveCallback = (event) => {
      let xDelta: number;
      let yDelta: number;

      if(document.pointerLockElement) {
          xDelta = event.movementX;
          yDelta = event.movementY;
          this.rotateView(xDelta * 0.025, yDelta * 0.025);
      } else if (moving) {
          xDelta = event.pageX - lastX;
          yDelta = event.pageY - lastY;
          lastX = event.pageX;
          lastY = event.pageY;
          this.rotateView(xDelta * 0.025, yDelta * 0.025);
      }
    };
    this.#pointerupCallback = (event) => {
      if (event.isPrimary) {
        moving = false;
      }
    };

    if (element) {
      this.element = element;
    }

    let lastFrameTime = -1;
    const frameCallback = (timestamp: number) => {
      if (lastFrameTime == -1) {
        lastFrameTime = timestamp;
      } else {
        this.update(timestamp - lastFrameTime);
        lastFrameTime = timestamp;
      }
      requestAnimationFrame(frameCallback);
    }
    requestAnimationFrame(frameCallback);
  }

  set element(value: HTMLElement) {
    if (this.#element && this.#element != value) {
      this.#element.removeEventListener('pointerdown', this.#pointerdownCallback);
      this.#element.removeEventListener('pointermove', this.#pointermoveCallback);
      this.#element.removeEventListener('pointerup', this.#pointerupCallback);
    }

    this.#element = value;
    if (this.#element) {
      this.#element.addEventListener('pointerdown', this.#pointerdownCallback);
      this.#element.addEventListener('pointermove', this.#pointermoveCallback);
      this.#element.addEventListener('pointerup', this.#pointerupCallback);
    }
  }

  get element(): HTMLElement {
    return this.#element;
  }

  rotateView(xDelta: number, yDelta: number) {
    let rot = this.#rotMat;

    if(xDelta || yDelta) {
      this.#angles[1] += xDelta;
      // Keep our rotation in the range of [0, 2*PI]
      // (Prevents numeric instability if you spin around a LOT.)
      while (this.#angles[1] < 0) {
        this.#angles[1] += Math.PI * 2.0;
      }
      while (this.#angles[1] >= Math.PI * 2.0) {
        this.#angles[1] -= Math.PI * 2.0;
      }

      this.#angles[0] += yDelta;
      // Clamp the up/down rotation to prevent us from flipping upside-down
      if (this.#angles[0] < -Math.PI * 0.5) {
        this.#angles[0] = -Math.PI * 0.5;
      }
      if (this.#angles[0] > Math.PI * 0.5) {
        this.#angles[0] = Math.PI * 0.5;
      }

      // Update the directional matrix
      Mat4.identity(rot);

      Mat4.rotateY(rot, rot, -this.#angles[1]);
      Mat4.rotateX(rot, rot, -this.#angles[0]);

      this.#dirty = true;
    }
  }

  set position(value: Readonly<Vec3>) {
    Vec3.copy(this.#position, value);
    this.#dirty = true;
  }

  get position(): Readonly<Vec3> {
    return this.#position;
  }

  get viewMatrix(): Readonly<Mat4> {
    if (this.#dirty) {
      let mv = this.#viewMat;
      Mat4.identity(mv);

      //mat4.rotateX(mv, mv, -Math.PI * 0.5);
      Mat4.rotateX(mv, mv, this.#angles[0]);
      Mat4.rotateY(mv, mv, this.#angles[1]);
      Mat4.translate(mv, mv, [-this.#position[0], -this.#position[1], -this.#position[2]]);
      this.#dirty = false;
    }

    return this.#viewMat;
  }

  update(frameTime: number) {
    if (!this.#element) return;

    const speed = (this.speed / 1000) * frameTime;

    Vec3.set(DIR, 0, 0, 0);

    // This is our first person movement code. It's not really pretty, but it works
    if (this.#pressedKeys['W'.charCodeAt(0)]) {
      DIR[2] -= speed;
    }
    if (this.#pressedKeys['S'.charCodeAt(0)]) {
      DIR[2] += speed;
    }
    if (this.#pressedKeys['A'.charCodeAt(0)]) {
      DIR[0] -= speed;
    }
    if (this.#pressedKeys['D'.charCodeAt(0)]) {
      DIR[0] += speed;
    }
    if (this.#pressedKeys[32]) { // Space, moves up
      DIR[1] += speed;
    }
    if (this.#pressedKeys[16]) { // Shift, moves down
      DIR[1] -= speed;
    }

    if (DIR[0] !== 0 || DIR[1] !== 0 || DIR[2] !== 0) {
        // Move the camera in the direction we are facing
        Vec3.transformMat4(DIR, DIR, this.#rotMat);
        Vec3.add(this.#position, this.#position, DIR);

        this.#dirty = true;
    }
  }
}
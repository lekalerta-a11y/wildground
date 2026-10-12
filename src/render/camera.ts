import { CAMERA } from '../core/constants';
import { clamp, type Vec2 } from '../core/math';

export class Camera {
  x = 0;
  y = 0;
  zoom = CAMERA.DEFAULT_ZOOM;
  private targetZoom = CAMERA.DEFAULT_ZOOM;

  snapTo(target: Vec2) {
    this.x = target.x;
    this.y = target.y;
  }

  setZoom(z: number) {
    this.targetZoom = clamp(z, CAMERA.MIN_ZOOM, CAMERA.MAX_ZOOM);
  }

  /** Set zoom instantly with no smoothing (used when starting/switching matches). */
  snapZoom(z: number) {
    this.targetZoom = clamp(z, CAMERA.MIN_ZOOM, CAMERA.MAX_ZOOM);
    this.zoom = this.targetZoom;
  }

  adjustZoom(delta: number) {
    this.setZoom(this.targetZoom + delta);
  }

  update(dt: number, target: Vec2) {
    const followT = 1 - Math.exp(-CAMERA.SMOOTHING * dt);
    this.x += (target.x - this.x) * followT;
    this.y += (target.y - this.y) * followT;

    const zoomT = 1 - Math.exp(-CAMERA.ZOOM_SMOOTHING * dt);
    this.zoom += (this.targetZoom - this.zoom) * zoomT;
  }

  /** Convert a world-space point to screen-space pixels given canvas size. */
  worldToScreen(p: Vec2, canvasWidth: number, canvasHeight: number): Vec2 {
    return {
      x: (p.x - this.x) * this.zoom + canvasWidth / 2,
      y: (p.y - this.y) * this.zoom + canvasHeight / 2,
    };
  }

  screenToWorld(p: Vec2, canvasWidth: number, canvasHeight: number): Vec2 {
    return {
      x: (p.x - canvasWidth / 2) / this.zoom + this.x,
      y: (p.y - canvasHeight / 2) / this.zoom + this.y,
    };
  }
}

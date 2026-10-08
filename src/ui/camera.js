// camera.js — pan and zoom over the valley by moving the SVG viewBox.
// Wheel or pinch to zoom, drag empty ground to pan, double-tap to zoom in or
// back out. Smoothly eased; hit tests keep working because they go through
// getScreenCTM.
import { VIEW } from '../sim/geometry.js';

const MIN_Z = 1, MAX_Z = 2.6;

export class Camera {
  constructor() { this.x = 0; this.y = 0; this.z = 1; this.tx = 0; this.ty = 0; this.tz = 1; this.last = ''; }

  clampTarget() {
    this.tz = Math.max(MIN_Z, Math.min(MAX_Z, this.tz));
    const w = VIEW.w / this.tz, h = VIEW.h / this.tz;
    this.tx = Math.max(0, Math.min(VIEW.w - w, this.tx));
    this.ty = Math.max(0, Math.min(VIEW.h - h, this.ty));
  }

  // Zoom by factor, keeping the SVG point (px, py) under the cursor.
  zoomAt(px, py, factor) {
    const nz = Math.max(MIN_Z, Math.min(MAX_Z, this.tz * factor));
    const fx = (px - this.tx) / (VIEW.w / this.tz), fy = (py - this.ty) / (VIEW.h / this.tz);
    this.tz = nz;
    this.tx = px - fx * VIEW.w / nz;
    this.ty = py - fy * VIEW.h / nz;
    this.clampTarget();
  }

  panBy(dx, dy) { this.tx -= dx; this.ty -= dy; this.clampTarget(); }

  focus(x, y, z = 1.7) {
    this.tz = z;
    this.tx = x - VIEW.w / z / 2;
    this.ty = y - VIEW.h / z / 2;
    this.clampTarget();
  }

  reset() { this.tz = 1; this.tx = 0; this.ty = 0; }

  viewBox() { return `${this.x.toFixed(2)} ${this.y.toFixed(2)} ${(VIEW.w / this.z).toFixed(2)} ${(VIEW.h / this.z).toFixed(2)}`; }

  // Ease toward the target and write the viewBox when it changes.
  apply(svg, dt = 16) {
    const k = 1 - Math.pow(0.0001, dt / 1000 * 2.2);
    this.x += (this.tx - this.x) * k; this.y += (this.ty - this.y) * k; this.z += (this.tz - this.z) * k;
    if (Math.abs(this.tz - this.z) < 0.0005) this.z = this.tz;
    if (Math.abs(this.tx - this.x) < 0.05) this.x = this.tx;
    if (Math.abs(this.ty - this.y) < 0.05) this.y = this.ty;
    const vb = this.viewBox();
    if (vb !== this.last) { svg.setAttribute('viewBox', vb); this.last = vb; }
  }

  zoomed() { return this.tz > 1.02; }
}

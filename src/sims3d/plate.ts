/** Спільне для 3D-пластин (маятник, диск): текстура карти |j| і стрілки густини струму. */
import { THREE, ArrowPool } from '../ui/view3d';
import type { Grid } from '../physics/streamSolver';
import { plateImage } from '../sims/eddy/plateView';

export class PlateTexture {
  tex: THREE.CanvasTexture | null = null;
  private grid: Grid | null = null;
  mat = new THREE.MeshStandardMaterial({ transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.35, roughness: 0.5 });

  update(g: Grid, psi: Float64Array, scale: number, jRef: number, metal: [number, number, number]): void {
    const cv = plateImage(g, psi, scale, jRef, metal);
    if (g !== this.grid || !this.tex || this.tex.image !== cv) {
      this.tex?.dispose();
      this.tex = new THREE.CanvasTexture(cv);
      this.tex.colorSpace = THREE.SRGBColorSpace;
      this.tex.magFilter = THREE.LinearFilter;
      this.mat.map = this.tex;
      this.mat.needsUpdate = true;
      this.grid = g;
    }
    this.tex.needsUpdate = true;
  }
}

/**
 * Стрілки j = (∂ψ/∂y, −∂ψ/∂x) у вузлах розрідженої сітки, де |j| > 0.25 jRef.
 * at(i, j) — точка у світі, dir(jx, jy) — напрям у світі (одинична довжина відповідає jRef).
 */
export function currentArrows(
  pool: ArrowPool, g: Grid, psi: Float64Array, scale: number, jRef: number,
  at: (i: number, j: number) => THREE.Vector3, dir: (jx: number, jy: number) => THREE.Vector3, len: number,
): void {
  const { nx, ny, mask } = g;
  const step = Math.max(3, Math.round(nx / 9));
  for (let j = 2; j < ny - 2; j += step)
    for (let i = 2; i < nx - 2; i += step) {
      const k = j * nx + i;
      if (!mask[k] || !mask[k + 1] || !mask[k - 1] || !mask[k + nx] || !mask[k - nx]) continue;
      const jx = ((psi[k + nx] - psi[k - nx]) * scale) / 2, jy = (-(psi[k + 1] - psi[k - 1]) * scale) / 2;
      const m = Math.hypot(jx, jy);
      if (m < 0.25 * jRef) continue;
      const f = Math.min(1.2, m / jRef);
      pool.add(at(i, j), dir(jx / m, jy / m).multiplyScalar(len * (0.5 + 0.5 * f)));
    }
}

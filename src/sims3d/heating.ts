// SPDX-FileCopyrightText: 2026 Max Kravchenko
// SPDX-License-Identifier: MIT

/** 3D: суцільне і шихтоване осердя в котушці змінного струму; контури вихрових струмів у перерізах. */
import { THREE, View3D, Arrow3D, ArrowPool, C3, makeLabel, setLabel, metalMat, type Scene3D } from '../ui/view3d';
import type { Slab, SlabHeating } from '../physics/heating';

export interface HeatingState {
  slab: Slab;
  lam: Slab;
  heat: SlabHeating;
  n: number;
}

const S = 6;      // сторона перерізу
const LEN = 11;   // довжина осердя
const SLICES = [-3, 0, 3];

interface Core {
  g: THREE.Group;
  plates: THREE.Mesh[];
  loops: { line: THREE.LineLoop; mat: THREE.LineBasicMaterial; fr: number }[];
  coil: THREE.Mesh;
  coilMat: THREE.MeshStandardMaterial;
  bArrow: Arrow3D;
  iArrow: Arrow3D;
  cPool: ArrowPool;
  label: ReturnType<typeof makeLabel>;
  nl: number;
}

export function heatingScene(get: () => HeatingState) {
  return (v: View3D): Scene3D => {
    const root = new THREE.Group();
    v.scene.add(root);
    const legend = v.legend([
      [C3.bExt, 'B(t) уздовж осі осердя'], [C3.bInd, 'B інд вихрових струмів (проти Ḃ)'], [C3.cur, 'вихрові струми'], [C3.copper, 'обмотка (струм ∝ B)'],
    ]);
    const lPh = makeLabel('', '#4ea8ff', 13);
    lPh.position.set(0, S / 2 + 2.6, 0);
    root.add(lPh);

    const mkCore = (x: number): Core => {
      const g = new THREE.Group();
      g.position.x = x;
      root.add(g);
      // котушка-спіраль навколо осердя
      const pts: THREE.Vector3[] = [];
      const turns = 9, R = S * 0.78;
      for (let i = 0; i <= turns * 64; i++) {
        const t = i / 64, a = 2 * Math.PI * t;
        pts.push(new THREE.Vector3(R * Math.cos(a), R * Math.sin(a), -LEN / 2 + 0.6 + (t / turns) * (LEN - 1.2)));
      }
      const coilMat = new THREE.MeshStandardMaterial({ color: C3.copper, metalness: 0.6, roughness: 0.35, emissive: C3.copper, emissiveIntensity: 0 });
      const coil = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 64, 0.13, 8, false), coilMat);
      g.add(coil);
      const bArrow = new Arrow3D(C3.bExt, 0.16, 'B');
      const iArrow = new Arrow3D(C3.bInd, 0.13, 'B інд');
      g.add(bArrow.group, iArrow.group);
      const label = makeLabel('', '#e4e8ef', 13);
      label.position.set(0, -S / 2 - 2.2, 0);
      g.add(label);
      return { g, plates: [], loops: [], coil, coilMat, bArrow, iArrow, cPool: new ArrowPool(g, C3.cur, 0.06), label, nl: 0 };
    };
    const cores = [mkCore(-S * 1.15), mkCore(S * 1.15)];

    /** Перебудувати пластини та контури струму для nl пластин. */
    const buildPlates = (c: Core, nl: number) => {
      c.plates.forEach((m) => { c.g.remove(m); m.geometry.dispose(); });
      c.loops.forEach((l) => { c.g.remove(l.line); l.line.geometry.dispose(); });
      c.plates = [];
      c.loops = [];
      c.nl = nl;
      const gap = nl > 1 ? 0.12 : 0;
      const lw = (S - gap * (nl - 1)) / nl;
      const mat = metalMat(0x8b95a5, { transparent: true, opacity: 0.32, depthWrite: false });
      for (let k = 0; k < nl; k++) {
        const xc = -S / 2 + lw / 2 + k * (lw + gap);
        const m = new THREE.Mesh(new THREE.BoxGeometry(lw, S, LEN), mat);
        m.position.x = xc;
        c.g.add(m);
        c.plates.push(m);
        const nLoops = Math.max(1, Math.min(4, Math.floor((lw / S) * 8)));
        for (const z of SLICES)
          for (let q = 1; q <= nLoops; q++) {
            const fr = q / (nLoops + 0.5);
            const hw = (lw / 2) * fr * 0.92, hh = S / 2 - 0.25 - (1 - fr) * 1.2;
            const pts = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([a, b]) => new THREE.Vector3(xc + a, b, z));
            const lmat = new THREE.LineBasicMaterial({ color: C3.cur, transparent: true, opacity: 0.5 });
            const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), lmat);
            c.g.add(line);
            c.loops.push({ line, mat: lmat, fr });
          }
      }
    };

    v.look([S * 1.6, S * 1.4, LEN * 1.9], [0, 0, 0]);
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    return {
      update({ vectors }) {
        const s = get();
        legend.style.display = vectors ? '' : 'none';
        const ph = s.slab.omega * s.heat.t;
        const Bn = Math.sin(ph), dB = Math.cos(ph);
        setLabel(lPh, `B = ${Bn.toFixed(2)}·B₀`);
        [[cores[0], 1, s.slab, 'Суцільне осердя'], [cores[1], s.n, s.lam, `Шихтоване: ${s.n} пластин`]].forEach(([cc, nl, sl, name]) => {
          const c = cc as Core, n = nl as number;
          if (c.nl !== n) buildPlates(c, n);
          setLabel(c.label, name as string);
          c.coilMat.emissiveIntensity = 0.6 * Math.abs(Bn);
          for (const l of c.loops) {
            const amp = Math.min(1, (Math.abs(dB) * l.fr) / n);
            l.mat.opacity = 0.06 + 0.9 * amp;
          }
          const sg = Math.sign(Bn) || 1;
          c.bArrow.set(V(0, 0, -sg * (LEN / 2 + 0.5)), V(0, 0, sg * (LEN + 3.5) * Math.abs(Bn)), vectors && Math.abs(Bn) > 0.03);
          const ind = Math.min(1, Math.abs(dB) / Math.max(1, (n as number) * 0.6));
          c.iArrow.set(V(0, S / 2 + 1.0, 0), V(0, 0, -Math.sign(dB) * 4 * ind), vectors && Math.abs(dB) > 0.12);
          // напрям вихрового струму: Ḃ > 0 → за год. стрілкою, якщо дивитися з +z
          c.cPool.begin();
          if (vectors && Math.abs(dB) > 0.12) {
            const gap = n > 1 ? 0.12 : 0, lw = (S - gap * (n - 1)) / n, s2 = Math.sign(dB);
            for (let k = 0; k < n; k++) {
              const xc = -S / 2 + lw / 2 + k * (lw + gap);
              const amp = Math.min(1, Math.abs(dB) / n);
              const L = 1.4 * (0.4 + 0.6 * amp);
              c.cPool.add(V(xc + lw * 0.3, (s2 * L) / 2, LEN / 2 + 0.05), V(0, -s2 * L, 0));
              c.cPool.add(V(xc - lw * 0.3, (-s2 * L) / 2, LEN / 2 + 0.05), V(0, s2 * L, 0));
            }
          }
          c.cPool.end();
          void sl;
        });
      },
    };
  };
}

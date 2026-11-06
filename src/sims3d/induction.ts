// SPDX-FileCopyrightText: 2026 Max Kravchenko
// SPDX-License-Identifier: MIT

/**
 * 3D: асинхронний двигун (статор з трьома фазами, ротор «білкова клітка») і варіант
 * «банка під обертовим магнітом». Вісь обертання — локальна z (для банки повернута вертикально).
 */
import { THREE, View3D, Arrow3D, ArrowPool, C3, makeLabel, metalMat, currentRGB, magnetMesh, type Scene3D } from '../ui/view3d';
import type { InductionMotor } from '../physics/inductionMotor';

export interface InductionState {
  m: InductionMotor;
  can: boolean;
  iRef: number;
}

const PHASE = [0xf5c542, 0x4ade80, 0xf472b6];
const RS = 9, RR = 5.6, LR = 9;

export function inductionScene(get: () => InductionState, can: boolean) {
  return (v: View3D): Scene3D => {
    const root = new THREE.Group();
    v.scene.add(root);
    if (can) root.rotation.x = -Math.PI / 2; // вісь z → вертикаль
    const rotor = new THREE.Group();
    root.add(rotor);
    const coilMats: THREE.MeshStandardMaterial[] = [];
    let magnet: THREE.Group | null = null;
    if (!can) {
      const stator = new THREE.Mesh(
        new THREE.CylinderGeometry(RS + 2.2, RS + 2.2, LR + 1, 64, 1, true),
        metalMat(0x4b5563, { side: THREE.DoubleSide, transparent: true, opacity: 0.35, depthWrite: false }),
      );
      stator.rotation.x = Math.PI / 2;
      root.add(stator);
      for (let j = 0; j < 3; j++) {
        const ang = (2 * Math.PI * j) / 3;
        const mat = new THREE.MeshStandardMaterial({ color: PHASE[j], emissive: PHASE[j], emissiveIntensity: 0.2, roughness: 0.5 });
        coilMats.push(mat);
        for (const a of [ang, ang + Math.PI]) {
          const c = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.2, LR), mat);
          c.position.set(Math.cos(a) * RS, Math.sin(a) * RS, 0);
          c.rotation.z = a;
          root.add(c);
        }
        const l = makeLabel('ABC'[j], '#' + PHASE[j].toString(16), 15);
        l.position.set(Math.cos(ang) * (RS + 3.6), Math.sin(ang) * (RS + 3.6), LR / 2);
        root.add(l);
      }
    } else {
      magnet = new THREE.Group();
      const mg = magnetMesh(2 * RS, 1.6, false);
      mg.rotation.z = -Math.PI / 2; // N уздовж +x локально
      magnet.add(mg);
      magnet.position.z = -LR / 2 - 2.6;
      root.add(magnet);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 6, 12), metalMat(0xd0d5dd));
      base.rotation.x = Math.PI / 2;
      base.position.z = -LR / 2 - 5;
      root.add(base);
    }
    // ротор / банка
    const body = can
      ? new THREE.Mesh(new THREE.CylinderGeometry(RR, RR, LR, 64, 1, true), metalMat(0xc9ced6, { metalness: 0.75, roughness: 0.25, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }))
      : new THREE.Mesh(new THREE.CylinderGeometry(RR * 0.8, RR * 0.8, LR, 48), metalMat(0x2b3240, { metalness: 0.4, roughness: 0.6 }));
    body.rotation.x = Math.PI / 2;
    rotor.add(body);
    if (can) {
      const bottom = new THREE.Mesh(new THREE.CircleGeometry(RR, 64), metalMat(0xc9ced6, { side: THREE.DoubleSide }));
      bottom.position.z = -LR / 2;
      rotor.add(bottom);
    } else {
      for (const z of [-LR / 2, LR / 2]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(RR * 0.85, 0.35, 10, 64), metalMat(0xb0b6c0));
        ring.position.z = z;
        rotor.add(ring);
      }
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, LR + 8, 16), metalMat(0xd0d5dd));
      shaft.rotation.x = Math.PI / 2;
      rotor.add(shaft);
    }
    // мітка на роторі
    const mark = new THREE.Mesh(new THREE.BoxGeometry(RR * 0.9, 0.3, 0.3), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x666666 }));
    mark.position.set(RR * 0.45, 0, LR / 2 + 0.3);
    rotor.add(mark);

    let nBars = -1;
    const bars: { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; k: number; sg: number }[] = [];
    const buildBars = (N: number) => {
      bars.forEach((b) => rotor.remove(b.mesh));
      bars.length = 0;
      for (let k = 0; k < N; k++)
        for (const sg of [1, -1]) {
          const mat = new THREE.MeshStandardMaterial({ color: 0x888888, emissive: 0, metalness: 0.5, roughness: 0.4 });
          const r = can ? 0.16 : 0.42;
          const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, LR * (can ? 0.9 : 1), 10), mat);
          mesh.rotation.x = Math.PI / 2;
          const a = (Math.PI * k) / N + (sg * Math.PI) / 2;
          const rr = can ? RR + 0.05 : RR * 0.85;
          mesh.position.set(Math.cos(a) * rr, Math.sin(a) * rr, 0);
          rotor.add(mesh);
          bars.push({ mesh, mat, k, sg });
        }
      nBars = N;
    };

    const fPool = new ArrowPool(root, C3.force, 0.12);
    const iPool = new ArrowPool(root, C3.cur, 0.13);
    const phPool = new ArrowPool(root, 0xffffff, 0.12);
    const aB = new Arrow3D(C3.bExt, 0.28, 'B');
    const aWs = new Arrow3D(C3.bExt, 0.15, 'ω поля');
    const aW = new Arrow3D(0xd6dde8, 0.15, 'ω ротора');
    root.add(aB.group, aWs.group, aW.group);
    const legend = v.legend([
      [C3.bExt, can ? 'поле обертового магніту B' : 'результуюче обертове поле B'],
      ...(can ? [] : ([[PHASE[0], 'фази A, B, C та їхні складові поля']] as [number, string][])),
      [C3.cur, can ? 'вихрові струми в стінці банки' : 'струми в стрижнях клітки'],
      [C3.force, 'сили на струми (тягнуть за полем)'], [0xd6dde8, 'ω ротора / банки'],
    ]);
    if (can) v.look([RS * 1.7, RS * 0.75, RS * 2.0], [0, -1.5, 0]);
    else v.look([RS * 1.5, RS * 1.1, RS * 2.6], [0, 0, 0]);

    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const col = new THREE.Color();
    return {
      update({ vectors, lines }) {
        const s = get();
        const { m } = s;
        if (m.p.N !== nBars) buildBars(m.p.N);
        legend.style.display = vectors ? '' : 'none';
        const th = m.y[1], psiB = m.fieldAngle(), ws = m.ws;
        rotor.rotation.z = th;
        if (magnet) magnet.rotation.z = psiB;
        coilMats.forEach((mm, j) => (mm.emissiveIntensity = 0.1 + 0.9 * Math.abs(Math.cos(ws * m.t - (2 * Math.PI * j) / 3))));
        fPool.begin();
        iPool.begin();
        for (const b of bars) {
          const I = m.rotorCurrent(b.k);
          const fr = Math.min(1, Math.abs(I) / s.iRef);
          // на стрижні з кутом n + π/2 (sg = +1) струм «на нас» (+z) при I > 0
          const out = b.sg > 0 ? I > 0 : I < 0;
          currentRGB(out ? 1 : -1, fr, col);
          b.mat.color.copy(fr > 0.05 ? col : new THREE.Color(0x777777));
          b.mat.emissive.copy(col).multiplyScalar(0.8 * fr);
          if (vectors && fr > 0.12) {
            const a = th + (Math.PI * b.k) / m.p.N + (b.sg * Math.PI) / 2;
            const rr = can ? RR + 0.05 : RR * 0.85;
            const ro = rr + (can ? 0.55 : 0.85);
            const pos = V(Math.cos(a) * rr, Math.sin(a) * rr, 0), posO = V(Math.cos(a) * ro, Math.sin(a) * ro, 0);
            const sgn = out ? 1 : -1;
            iPool.add(posO.clone().add(V(0, 0, -sgn * LR * 0.3)), V(0, 0, sgn * LR * 0.6 * (0.4 + 0.6 * fr)));
            // F ∝ I ẑ × B̂ = I (−sin ψ, cos ψ)
            if (fr > 0.2) fPool.add(pos.clone().add(V(0, 0, LR / 2 + 0.4)), V(-Math.sin(psiB) * sgn, Math.cos(psiB) * sgn, 0).multiplyScalar(3 * fr));
          }
        }
        fPool.end();
        iPool.end();
        const BL = RS * 0.9;
        aB.set(V(-Math.cos(psiB) * BL * 0.2, -Math.sin(psiB) * BL * 0.2, can ? -LR / 2 - 1.2 : LR / 2 + 0.8), V(Math.cos(psiB), Math.sin(psiB), 0).multiplyScalar(BL * 1.2), lines || vectors);
        phPool.begin();
        if (!can && vectors)
          for (let j = 0; j < 3; j++) {
            const ang = (2 * Math.PI * j) / 3, ij = Math.cos(ws * m.t - ang);
            phPool.add(V(0, 0, LR / 2 + 1.4), V(Math.cos(ang), Math.sin(ang), 0).multiplyScalar(RS * 0.55 * ij * (2 / 3)), PHASE[j]);
          }
        phPool.end();
        aWs.set(V(0, 0, LR / 2 + 3), V(0, 0, 4), vectors);
        aW.set(V(0.9, 0, LR / 2 + 3), V(0, 0, 4 * Math.min(1, m.y[0] / ws)), vectors && m.y[0] > 0.05);
      },
    };
  };
}

// SPDX-FileCopyrightText: 2026 Max Kravchenko
// SPDX-License-Identifier: MIT

/** 3D: генератор змінного струму — рамка обертається в однорідному полі між полюсами N і S. Вісь — вертикальна. */
import { THREE, View3D, Arrow3D, ArrowPool, C3, makeLabel, setLabel, metalMat, currentRGB, type Scene3D } from '../ui/view3d';
import type { Generator } from '../physics/generator';

export interface GeneratorState {
  g: Generator;
  iRef: number;
  eRef: number;
}

const RW = 4, LZ = 8;

export function generatorScene(get: () => GeneratorState) {
  return (v: View3D): Scene3D => {
    const root = new THREE.Group();
    root.rotation.x = -Math.PI / 2; // локальна z (вісь обертання) → вертикаль
    v.scene.add(root);
    const poleGeo = new THREE.BoxGeometry(2.4, 8, LZ + 1);
    const pN = new THREE.Mesh(poleGeo, new THREE.MeshStandardMaterial({ color: C3.north, roughness: 0.5, transparent: true, opacity: 0.8 }));
    const pS = new THREE.Mesh(poleGeo, new THREE.MeshStandardMaterial({ color: C3.south, roughness: 0.5, transparent: true, opacity: 0.8 }));
    pN.position.x = -(RW + 2.4);
    pS.position.x = RW + 2.4;
    root.add(pN, pS);
    const lN = makeLabel('N', '#ffb4b4', 16), lS = makeLabel('S', '#b4ccff', 16);
    lN.position.set(-(RW + 2.4), 0, LZ / 2 + 1.2);
    lS.position.set(RW + 2.4, 0, LZ / 2 + 1.2);
    root.add(lN, lS);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, LZ + 10, 14), metalMat(0xd0d5dd));
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = -2;
    root.add(shaft);

    // рамка
    const frame = new THREE.Group();
    root.add(frame);
    const wireMat = new THREE.MeshStandardMaterial({ color: C3.copper, metalness: 0.6, roughness: 0.35, emissive: 0 });
    const cyl = (r: number, len: number) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), wireMat);
    for (const sy of [1, -1]) {
      const w = cyl(0.22, LZ);
      w.rotation.x = Math.PI / 2;
      w.position.y = sy * RW;
      frame.add(w);
    }
    const top = cyl(0.22, 2 * RW);
    top.position.z = LZ / 2;
    const b1 = cyl(0.22, RW - 0.5);
    b1.position.set(0, (RW + 0.5) / 2, -LZ / 2);
    const b2 = b1.clone();
    b2.position.y = -(RW + 0.5) / 2;
    frame.add(top, b1, b2);
    // контактні кільця та щітки
    const ringMat = metalMat(0xe0a060, { metalness: 0.85, roughness: 0.25 });
    const rings = [-LZ / 2 - 1.6, -LZ / 2 - 3.2].map((z) => {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.28, 10, 32), ringMat);
      r.position.z = z;
      root.add(r);
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.5), new THREE.MeshStandardMaterial({ color: 0x3a3a3a }));
      br.position.set(1.85, 0, z);
      root.add(br);
      return r;
    });
    void rings;
    const lE = makeLabel('', '#ffa63d', 13);
    lE.position.set(3.2, 0, -LZ / 2 - 2.4);
    root.add(lE);

    const lines = new THREE.Group();
    root.add(lines);
    const lm = new THREE.LineBasicMaterial({ color: C3.bExt, transparent: true, opacity: 0.35 });
    for (let iy = -3; iy <= 3; iy++)
      for (const z of [-LZ / 2 + 0.5, 0, LZ / 2 - 0.5])
        lines.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-RW - 1.2, iy * 1.15, z), new THREE.Vector3(RW + 1.2, iy * 1.15, z)]), lm));
    const bPool = new ArrowPool(root, C3.bExt, 0.07);
    const fPool = new ArrowPool(root, C3.force, 0.13);
    const iPool = new ArrowPool(root, C3.cur, 0.1);
    const aN = new Arrow3D(0xd6dde8, 0.07, 'n');
    const aBi = new Arrow3D(C3.bInd, 0.16, 'B інд');
    const aW = new Arrow3D(0xd6dde8, 0.15, 'ω');
    const aM = new Arrow3D(C3.force, 0.17, 'M (Ленц)');
    root.add(aN.group, aBi.group, aW.group, aM.group);
    const legend = v.legend([
      [C3.bExt, 'поле B (від N до S)'], [0xd6dde8, 'нормаль n до рамки, ω'], [C3.cur, 'індукований струм'],
      [C3.force, 'сили Ампера та гальмівний момент'], [C3.bInd, 'поле струму рамки B інд'],
    ]);
    v.look([RW * 2.6, RW * 2.6, RW * 3.6], [0, 0, 0]);

    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const col = new THREE.Color();
    return {
      update({ vectors, lines: showLines }) {
        const { g, iRef, eRef } = get();
        legend.style.display = vectors ? '' : 'none';
        lines.visible = showLines;
        const phi = g.y[0], w = g.y[1], I = g.current();
        const frac = Math.min(1, Math.abs(I) / iRef);
        frame.rotation.z = phi;
        currentRGB(I, frac, col);
        wireMat.emissive.copy(col).multiplyScalar(0.7 * frac);
        const tx = -Math.sin(phi), ty = Math.cos(phi), nx = Math.cos(phi), ny = Math.sin(phi);
        const a = V(RW * tx, RW * ty, 0), b = V(-RW * tx, -RW * ty, 0);
        const sI = Math.sign(I);
        fPool.begin();
        iPool.begin();
        if (vectors && frac > 0.03) {
          // I > 0: на стороні +t струм уздовж +z; F = (I/c) l ẑ × B x̂ ∝ +ŷ
          iPool.add(a.clone().add(V(0.5 * tx, 0.5 * ty, -sI * 2)), V(0, 0, sI * 4));
          iPool.add(b.clone().add(V(-0.5 * tx, -0.5 * ty, sI * 2)), V(0, 0, -sI * 4));
          fPool.add(a.clone(), V(0, sI * 3.5 * frac, 0));
          fPool.add(b.clone(), V(0, -sI * 3.5 * frac, 0));
        }
        fPool.end();
        iPool.end();
        bPool.begin();
        if (vectors && showLines)
          for (const y of [-2.3, 0, 2.3]) for (const z of [-LZ / 2 + 0.5, LZ / 2 - 0.5]) bPool.add(V(-RW - 1.4, y, z), V(1.6, 0, 0));
        bPool.end();
        aN.set(V(0, 0, 0.4), V(nx, ny, 0).multiplyScalar(RW * 0.75), vectors);
        aBi.set(V(0, 0, -0.4), V(nx, ny, 0).multiplyScalar(RW * 0.6 * sI * frac), vectors && frac > 0.03);
        aW.set(V(0, 0, LZ / 2 + 1), V(0, 0, (Math.sign(w) || 1) * 3.5), vectors && Math.abs(w) > 1e-3);
        const M = g.torque();
        aM.set(V(0.8, 0, LZ / 2 + 1), V(0, 0, Math.sign(M) * 3.5 * frac), vectors && frac > 0.03 && M !== 0);
        const e = g.emf();
        setLabel(lE, `ε = ${(e / eRef).toFixed(2)}·ε_max`);
      },
    };
  };
}

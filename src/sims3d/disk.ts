// SPDX-FileCopyrightText: 2026 Max Kravchenko
// SPDX-License-Identifier: MIT

/** 3D: електромагнітне гальмо — обертовий диск у зазорі П-подібного магніту. */
import { THREE, View3D, Arrow3D, ArrowPool, C3, makeLabel, metalMat, type Scene3D } from '../ui/view3d';
import type { DiskModel, DiskBrake, DiskParams } from '../physics/diskBrake';
import { PlateTexture, currentArrows } from './plate';

export interface DiskState {
  model: DiskModel;
  br: DiskBrake;
  p: DiskParams;
  jRef: number;
  scale: number;
}

export function diskScene(get: () => DiskState) {
  return (v: View3D): Scene3D => {
    const root = new THREE.Group();
    v.scene.add(root);
    const fixed = new THREE.Group();
    const spin = new THREE.Group();
    root.add(fixed, spin);
    const tex = new PlateTexture();
    const overlay = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), tex.mat);
    overlay.rotation.x = -Math.PI / 2;
    root.add(overlay);
    const pool = new ArrowPool(root, C3.cur, 0.1);
    const bPool = new ArrowPool(root, C3.bExt, 0.1);
    const aV = new Arrow3D(C3.vel, 0.12, 'v');
    const aF = new Arrow3D(C3.force, 0.16, 'F гальм.');
    const aW = new Arrow3D(0xd6dde8, 0.16, 'ω');
    const aM = new Arrow3D(C3.force, 0.16, 'M гальм.');
    root.add(aV.group, aF.group, aW.group, aM.group);
    const legend = v.legend([
      [C3.bExt, 'поле магніту B (вниз)'], [C3.cur, 'вихрові струми j (нерухомі в лаб. системі)'],
      [C3.vel, 'швидкість диска під полюсом'], [C3.force, 'гальмівна сила / момент'], [0xd6dde8, 'ω'],
    ]);
    let key = '';
    let model: DiskModel | null = null;

    const build = (s: DiskState) => {
      const { p } = s;
      fixed.clear();
      spin.clear();
      const th = Math.max(p.d, 0.12);
      const disk = new THREE.Mesh(new THREE.CylinderGeometry(p.Rd, p.Rd, th, 96), metalMat(0xb9c0ca, { metalness: 0.7, roughness: 0.3 }));
      spin.add(disk);
      // риски (видно обертання)
      for (let k = 0; k < 12; k++) {
        const a = (k * Math.PI) / 6;
        const r = new THREE.Mesh(new THREE.BoxGeometry(p.Rd * 0.8, 0.04, 0.16), new THREE.MeshStandardMaterial({ color: 0x1f242d }));
        r.position.set(Math.cos(a) * p.Rd * 0.56, th / 2 + 0.05, -Math.sin(a) * p.Rd * 0.56);
        r.rotation.y = a;
        spin.add(r);
      }
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 14, 20), metalMat(0xd0d5dd));
      fixed.add(shaft);
      overlay.geometry.dispose();
      overlay.geometry = new THREE.PlaneGeometry(2 * p.Rd, 2 * p.Rd);
      overlay.position.y = th / 2 + 0.02;
      // П-подібний магніт: N зверху, S знизу, поле в зазорі −y
      const gap = th / 2 + 0.6, ph = 3;
      const box = new THREE.BoxGeometry(2 * p.pole, ph, 2 * p.pole);
      const n = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: C3.north, roughness: 0.5, transparent: true, opacity: 0.85 }));
      const sP = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: C3.south, roughness: 0.5 }));
      n.position.set(p.r0, gap + ph / 2, 0);
      sP.position.set(p.r0, -gap - ph / 2, 0);
      const ym = metalMat(0x4b5563, { metalness: 0.3 });
      const xo = Math.max(p.Rd + 2, p.r0 + p.pole + 1.5);
      const yl = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2 * (gap + ph), 2 * p.pole), ym);
      yl.position.set(xo + 0.9, 0, 0);
      const t1 = new THREE.Mesh(new THREE.BoxGeometry(xo + 1.8 - p.r0, 1.4, 2 * p.pole), ym);
      t1.position.set((p.r0 + xo + 1.8) / 2, gap + ph - 0.7, 0);
      const t2 = t1.clone();
      t2.position.y = -(gap + ph - 0.7);
      fixed.add(n, sP, yl, t1, t2);
      const lN = makeLabel('N', '#ffb4b4', 14);
      lN.position.set(p.r0, gap + ph + 0.8, 0);
      const lS = makeLabel('S', '#b4ccff', 14);
      lS.position.set(p.r0, -gap - ph - 0.8, 0);
      fixed.add(lN, lS);
      v.look([-p.Rd * 0.9, p.Rd * 1.45, p.Rd * 2.0], [p.Rd * 0.15, 0, 0]);
    };

    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    return {
      update({ vectors, lines }) {
        const s = get();
        const { p, br } = s;
        const k2 = [p.Rd, p.d, p.r0, p.pole].join();
        if (k2 !== key) { key = k2; build(s); }
        legend.style.display = vectors ? '' : 'none';
        model = s.model;
        const g = model.grid;
        spin.rotation.y = br.y[1];
        tex.update(g, model.psi, s.scale, s.jRef, [175, 180, 190]);
        const w = br.y[0], dir = Math.sign(w) || 1;
        const top = Math.max(p.d, 0.12) / 2 + 0.08;
        pool.begin();
        if (vectors)
          currentArrows(pool, g, model.psi, s.scale, s.jRef,
            (i, j) => V(model!.x0 + i * g.h, top, -(model!.x0 + j * g.h)),
            (jx, jy) => V(jx, 0, -jy), p.Rd * 0.16);
        pool.end();
        bPool.begin();
        if (vectors && lines)
          for (const bx of [-0.5, 0.5]) for (const bz of [-0.5, 0.5]) bPool.add(V(p.r0 + bx * p.pole, top + 0.5, bz * p.pole), V(0, -(2 * top + 1), 0));
        bPool.end();
        // швидкість диска під полюсом: ω ŷ × r₀ x̂ = −ω r₀ ẑ
        const show = vectors && Math.abs(w) > 1e-3;
        aV.set(V(p.r0 + p.pole + 1.2, top, 0), V(0, 0, -dir * 4), show);
        const M = model.torque(w);
        const fr = Math.min(1, Math.abs(M) / (model.K0 * model.omegaC * 0.5));
        aF.set(V(p.r0 - p.pole - 1.2, top, 0), V(0, 0, dir * 5 * fr), show && Math.abs(M) > 0);
        aW.set(V(0, 7, 0), V(0, dir * 5, 0), show);
        aM.set(V(0, -7, 0), V(0, -dir * 5 * fr, 0), show && Math.abs(M) > 0);
      },
    };
  };
}

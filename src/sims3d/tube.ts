// SPDX-FileCopyrightText: 2026 Max Kravchenko
// SPDX-License-Identifier: MIT

/** 3D: магніт падає в мідній трубі; поруч — пластикова труба. Кільця-струми, поле диполя, сили. */
import { THREE, View3D, Arrow3D, C3, magnetMesh, currentRGB, makeLabel, type Scene3D } from '../ui/view3d';
import type { EddyTube, FreeFall, TubeParams } from '../physics/eddyTube';
import { G } from '../physics/constants';

export interface TubeState {
  sim: EddyTube;
  free: FreeFall;
  p: TubeParams;
  flip: boolean;
  vt: number;
}

const POOL = 140;

export function tubeScene(get: () => TubeState) {
  return (v: View3D): Scene3D => {
    const root = new THREE.Group();
    v.scene.add(root);
    let key = '';
    let tubes = new THREE.Group();
    root.add(tubes);
    const rings: THREE.Mesh[] = [];
    const ringMats: THREE.MeshStandardMaterial[] = [];
    let ringGeo: THREE.TorusGeometry | null = null;
    const ringGroup = new THREE.Group();
    root.add(ringGroup);

    const mag = new THREE.Group();
    const magFree = new THREE.Group();
    root.add(mag, magFree);
    const lines = new THREE.Group();
    mag.add(lines);

    const aV = new Arrow3D(C3.vel, 0.06, 'v');
    const aG = new Arrow3D(C3.grav, 0.07, 'Mg');
    const aF = new Arrow3D(C3.force, 0.08, 'F Фуко');
    const aBu = new Arrow3D(C3.bInd, 0.07, 'B інд');
    const aBd = new Arrow3D(C3.bInd, 0.07, 'B інд');
    const aIu = new Arrow3D(C3.cur, 0.05, 'I');
    const aId = new Arrow3D(C3.cur, 0.05, 'I');
    root.add(aV.group, aG.group, aF.group, aBu.group, aBd.group, aIu.group, aId.group);
    const lMetal = makeLabel('мідна (металева) труба', '#c8794a');
    const lPl = makeLabel('пластикова труба', '#9ca3af');
    root.add(lMetal, lPl);
    const legend = v.legend([
      [C3.bExt, 'поле магніту B'], [C3.bInd, 'поле струмів B інд'], [C3.cur, 'струм I > 0 (проти год. стр. згори)'],
      [C3.curNeg, 'струм I < 0'], [C3.force, 'сила Фуко'], [C3.grav, 'Mg'], [C3.vel, 'швидкість'],
    ]);

    const build = (s: TubeState) => {
      const { p } = s;
      root.remove(tubes);
      tubes = new THREE.Group();
      root.add(tubes);
      const R = p.a + p.w;
      const metal = new THREE.Mesh(
        new THREE.CylinderGeometry(R, R, p.length, 48, 1, true),
        new THREE.MeshStandardMaterial({ color: C3.copper, metalness: 0.6, roughness: 0.35, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
      );
      metal.position.y = p.length / 2;
      const inner = new THREE.Mesh(
        new THREE.CylinderGeometry(p.a, p.a, p.length, 48, 1, true),
        new THREE.MeshStandardMaterial({ color: C3.copper, metalness: 0.6, roughness: 0.4, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }),
      );
      inner.position.y = p.length / 2;
      const xp = -(2 * R + 2.5);
      const plastic = new THREE.Mesh(
        new THREE.CylinderGeometry(R, R, p.length, 40, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x8b93a1, roughness: 0.8, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
      );
      plastic.position.set(xp, p.length / 2, 0);
      const floor = new THREE.Mesh(new THREE.BoxGeometry(4 * R + 8, 0.3, 3 * R + 3), new THREE.MeshStandardMaterial({ color: 0x2a3242, roughness: 0.9 }));
      floor.position.set(xp / 2, s.sim.floorZ - 0.15, 0);
      tubes.add(metal, inner, plastic, floor);
      lPl.position.set(xp, p.length + 1, 0);
      lMetal.position.set(0, p.length + 1, 0);
      // кільця
      ringGeo?.dispose();
      ringGeo = new THREE.TorusGeometry(p.a + p.w / 2, Math.max(p.w / 2, 0.025), 8, 56);
      ringGroup.clear();
      rings.length = 0;
      ringMats.length = 0;
      for (let i = 0; i < POOL; i++) {
        const m = new THREE.MeshStandardMaterial({ color: 0x5a3a2a, emissive: 0x000000, roughness: 0.5, transparent: true, opacity: 0.9 });
        const r = new THREE.Mesh(ringGeo, m);
        r.rotation.x = Math.PI / 2;
        ringGroup.add(r);
        rings.push(r);
        ringMats.push(m);
      }
      // магніти
      const ml = Math.max(1.27, 0.9 * p.a), mr = 0.6 * p.a;
      mag.clear();
      mag.add(magnetMesh(ml, mr), lines);
      magFree.clear();
      magFree.add(magnetMesh(ml, mr));
      magFree.position.x = xp;
      // силові лінії диполя (у 4 меридіанних площинах), стрілки на екваторі
      lines.clear();
      const lm = new THREE.LineBasicMaterial({ color: C3.bExt, transparent: true, opacity: 0.45 });
      for (const r0 of [0.9, 1.5, 2.4, 3.8]) {
        const pts: THREE.Vector3[] = [];
        for (let k = 0; k <= 120; k++) {
          const th = 0.04 + (k / 120) * (Math.PI - 0.08);
          const r = r0 * p.a * Math.sin(th) ** 2;
          pts.push(new THREE.Vector3(r * Math.sin(th), r * Math.cos(th), 0));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        for (let q = 0; q < 4; q++) {
          const l = new THREE.Line(geo, lm);
          l.rotation.y = (q * Math.PI) / 2 + 0.3;
          lines.add(l);
          const cone = new THREE.Mesh(new THREE.ConeGeometry(0.07 * p.a, 0.22 * p.a, 10), new THREE.MeshBasicMaterial({ color: C3.bExt }));
          const a = (q * Math.PI) / 2 + 0.3;
          cone.position.set(r0 * p.a * Math.cos(a), 0, -r0 * p.a * Math.sin(a));
          cone.rotation.x = Math.PI; // на екваторі поле диполя спрямоване проти 𝔪
          lines.add(cone);
        }
      }
      v.look([5.5 * p.a + 3, s.sim.y[0] + 2.2 * p.a, 7 * p.a + 4], [xp / 3, s.sim.y[0], 0]);
    };

    const col = new THREE.Color();
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    return {
      update({ vectors, lines: showLines }) {
        const s = get();
        const { sim, free, p } = s;
        const k2 = [p.a, p.w, p.h, p.length, sim.nRings].join();
        if (k2 !== key) { key = k2; build(s); }
        const zc = sim.y[0];
        v.follow(V(v.controls.target.x, zc, v.controls.target.z));
        mag.position.y = Math.max(zc, sim.floorZ);
        mag.rotation.z = s.flip ? Math.PI : 0;
        magFree.position.y = free.landed ? free.floorZ : free.z;
        magFree.rotation.z = s.flip ? Math.PI : 0;
        lines.visible = showLines;
        legend.style.display = vectors ? '' : 'none';
        // кільця біля магніту
        const half = 6 * p.a;
        let kMin = Math.max(0, Math.floor((zc - half) / p.h));
        let kMax = Math.min(sim.nRings - 1, Math.ceil((zc + half) / p.h));
        const stride = Math.max(1, Math.ceil((kMax - kMin + 1) / POOL));
        let iMax = 1e-30;
        for (let k = kMin; k <= kMax; k++) iMax = Math.max(iMax, Math.abs(sim.ringCurrent(k)));
        let n = 0, kUp = -1, kDn = -1, iUp = 0, iDn = 0;
        for (let k = kMin; k <= kMax && n < POOL; k += stride, n++) {
          const I = s.flip ? -sim.ringCurrent(k) : sim.ringCurrent(k);
          const f = Math.min(1, Math.abs(I) / iMax);
          currentRGB(I, f, col);
          ringMats[n].color.copy(col);
          ringMats[n].emissive.copy(col).multiplyScalar(0.8 * f);
          ringMats[n].opacity = 0.25 + 0.75 * f;
          rings[n].position.y = sim.zRing(k);
          rings[n].visible = true;
          const zk = sim.zRing(k);
          if (zk > zc && Math.abs(I) > iUp) { iUp = Math.abs(I); kUp = k; }
          if (zk < zc && Math.abs(I) > iDn) { iDn = Math.abs(I); kDn = k; }
        }
        for (; n < POOL; n++) rings[n].visible = false;
        void kMin; void kMax;
        // вектори
        const vz = sim.y[1], Mg = p.mass * G, F = sim.force();
        const sc = 2.4 * p.a;
        const R = p.a + p.w;
        aV.set(V(R + 0.9, zc, 0), V(0, (sc * vz) / Math.max(s.vt, Math.abs(vz), 1e-9), 0), vectors && !sim.landed);
        aG.set(V(-0.25 * p.a, zc, 0.62 * p.a), V(0, -sc, 0), vectors);
        aF.set(V(0.25 * p.a, zc, 0.62 * p.a), V(0, (sc * Math.min(1.4, F / Mg)), 0), vectors && Math.abs(F) > 1e-3 * Mg);
        const ringVec = (k: number, aB: Arrow3D, aI: Arrow3D) => {
          if (k < 0 || !vectors) { aB.hide(); aI.hide(); return; }
          const I = s.flip ? -sim.ringCurrent(k) : sim.ringCurrent(k);
          const zk = sim.zRing(k), sg = Math.sign(I), f = Math.min(1, Math.abs(I) / iMax);
          // поле кільця на осі (правило правої руки): I > 0 → +y
          aB.set(V(0.72 * p.a, zk - (sg * f * 0.9 * p.a) / 2, -0.4 * p.a), V(0, sg * f * 0.9 * p.a, 0), f > 0.05);
          // напрям струму на передньому боці кільця (точка φ = −90°: (0, z, R)); I > 0 → дотична (+x)
          aI.set(V(-0.45 * R * sg, zk, R + 0.08), V(0.9 * R * sg, 0, 0), f > 0.05);
        };
        ringVec(kUp, aBu, aIu);
        ringVec(kDn, aBd, aId);
      },
    };
  };
}

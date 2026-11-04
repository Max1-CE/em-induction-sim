/** 3D: два маятники Вальтенгофена (суцільна пластина і гребінка) між полюсами електромагніту. */
import { THREE, View3D, Arrow3D, ArrowPool, C3, makeLabel, setLabel, metalMat, type Scene3D } from '../ui/view3d';
import type { PlateModel, Pendulum, PendulumParams } from '../physics/waltenhofen';
import { G } from '../physics/constants';
import { PlateTexture, currentArrows } from './plate';

export interface PendulumState {
  ps: Pendulum;
  pc: Pendulum;
  p: PendulumParams;
  jRef: number;
  labels: [string, string];
}

interface One {
  pivot: THREE.Group;
  swing: THREE.Group;
  tex: PlateTexture;
  plate: THREE.Mesh;
  pool: ArrowPool;
  bPool: ArrowPool;
  aV: Arrow3D;
  aF: Arrow3D;
  aW: Arrow3D;
  label: ReturnType<typeof makeLabel>;
  model: PlateModel | null;
}

export function pendulumScene(get: () => PendulumState) {
  return (v: View3D): Scene3D => {
    const root = new THREE.Group();
    v.scene.add(root);
    const frame = new THREE.Group();
    root.add(frame);
    const mk = (): One => {
      const pivot = new THREE.Group(), swing = new THREE.Group();
      pivot.add(swing);
      root.add(pivot);
      const tex = new PlateTexture();
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), tex.mat);
      swing.add(plate);
      const o: One = {
        pivot, swing, tex, plate, model: null,
        pool: new ArrowPool(swing, C3.cur, 0.07),
        bPool: new ArrowPool(pivot, C3.bExt, 0.07),
        aV: new Arrow3D(C3.vel, 0.09, 'v'),
        aF: new Arrow3D(C3.force, 0.12, 'F гальм.'),
        aW: new Arrow3D(0xd6dde8, 0.1, 'ω'),
        label: makeLabel('', '#e4e8ef', 13),
      };
      pivot.add(o.aV.group, o.aF.group, o.aW.group, o.label);
      return o;
    };
    const P = [mk(), mk()];
    const legend = v.legend([
      [C3.bExt, 'поле B між полюсами'], [C3.cur, 'густина вихрового струму j'], [C3.vel, 'швидкість центру пластини'],
      [C3.force, 'гальмівна сила (Ленц)'], [0xd6dde8, 'кутова швидкість ω (вздовж осі)'],
    ]);
    let key = '';

    const build = (s: GetState) => {
      const { p } = s;
      frame.clear();
      const dx = Math.max(p.b, 2 * p.pole) / 2 + 7;
      const gap = p.d / 2 + 0.5, pth = 2.2;
      [-dx, dx].forEach((x, idx) => {
        const o = P[idx];
        o.pivot.position.set(x, 0, 0);
        // стійка і вісь
        const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 4, 16), metalMat(0xd0d5dd));
        axle.rotation.x = Math.PI / 2;
        axle.position.set(x, 0, 0);
        frame.add(axle);
        // полюси (N спереди +z, S ззаду): поле в зазорі −z
        const box = new THREE.BoxGeometry(2 * p.pole, 2 * p.pole, pth);
        const n = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: C3.north, roughness: 0.5, transparent: true, opacity: 0.4, depthWrite: false }));
        const sP = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: C3.south, roughness: 0.5 }));
        n.position.set(x, -p.arm, gap + pth / 2);
        sP.position.set(x, -p.arm, -gap - pth / 2);
        const yoke = metalMat(0x4b5563, { metalness: 0.3 });
        const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 2 * gap + 2 * pth), yoke);
        back.position.set(x, -p.arm - p.pole - 3.5, 0);
        const a1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.5 + 0.8, 1.6), yoke);
        a1.position.set(x, -p.arm - p.pole - 3.5 / 2 + 0.4, gap + pth / 2);
        const a2 = a1.clone();
        a2.position.z = -gap - pth / 2;
        frame.add(n, sP, back, a1, a2);
        const lN = makeLabel('N', '#ffb4b4', 13), lS = makeLabel('S', '#b4ccff', 13);
        lN.position.set(x, -p.arm + p.pole + 0.6, gap + pth / 2);
        lS.position.set(x, -p.arm + p.pole + 0.6, -gap - pth / 2);
        frame.add(lN, lS);
      });
      // перекладина
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2 * dx + 6, 0.8, 0.8), metalMat(0x6b7280));
      bar.position.set(0, 0.8, -2.4);
      frame.add(bar);
      v.look([dx * 0.6, -p.arm * 0.35, p.arm * 2.1 + 8], [0, -p.arm * 0.55, 0]);
    };
    type GetState = PendulumState;

    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    return {
      update({ vectors, lines }) {
        const s = get();
        const { p } = s;
        const k2 = [p.b, p.c, p.arm, p.pole, p.d].join();
        if (k2 !== key) { key = k2; build(s); }
        legend.style.display = vectors ? '' : 'none';
        [s.ps, s.pc].forEach((pd, idx) => {
          const o = P[idx], pl = pd.plate, g = pl.grid;
          if (o.model !== pl) {
            o.model = pl;
            o.plate.geometry.dispose();
            o.plate.geometry = new THREE.PlaneGeometry(g.nx * g.h, g.ny * g.h);
            o.plate.position.set(pl.u0 + ((g.nx - 1) * g.h) / 2, pl.v0 + ((g.ny - 1) * g.h) / 2, 0);
            // підвіс (стрижень)
            o.swing.children.filter((c) => c.userData.rod).forEach((c) => o.swing.remove(c));
            const top = -p.arm + p.c / 2;
            const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, -top, 10), metalMat(0x9aa4b2));
            rod.position.y = top / 2;
            rod.userData.rod = true;
            o.swing.add(rod);
          }
          const th = pd.y[0], w = pd.y[1];
          o.swing.rotation.z = th;
          const psi = pl.psiAt(th);
          o.tex.update(g, psi, w, s.jRef, [150, 160, 175]);
          setLabel(o.label, s.labels[idx]);
          o.label.position.set(0, 2.2, 0);
          // вектори
          o.pool.begin();
          if (vectors)
            currentArrows(o.pool, g, psi, w, s.jRef,
              (i, j) => V(pl.u0 + i * g.h, pl.v0 + j * g.h, p.d / 2 + 0.06),
              (jx, jy) => V(jx, jy, 0), 1.4 * g.h * Math.max(3, Math.round(g.nx / 9)) * 0.55);
          o.pool.end();
          o.bPool.begin();
          if (vectors && lines)
            for (const bx of [-0.55, 0, 0.55]) for (const by of [-0.55, 0, 0.55])
              o.bPool.add(V(bx * p.pole, -p.arm + by * p.pole, p.d / 2 + 0.45), V(0, 0, -(p.d + 0.9)));
          o.bPool.end();
          const cs = Math.cos(th), sn = Math.sin(th);
          const cen = V(p.arm * sn, -p.arm * cs, 0); // центр пластини (0, −ℓ) повернутий на θ
          const tang = V(cs, sn, 0); // напрям руху центру при θ̇ > 0
          const wRef = Math.sqrt((2 * G * (1 - Math.cos(0.6))) / p.arm);
          o.aV.set(cen.clone().add(V(0, 0, p.d / 2 + 1.2)), tang.clone().multiplyScalar(6 * Math.max(-1.2, Math.min(1.2, w / wRef))), vectors && Math.abs(w) > 1e-3);
          const M = pd.torque();
          const Fm = M / p.arm, Fref = 0.5 * pl.mass * G;
          o.aF.set(cen.clone().add(V(0, -p.c * 0.65, p.d / 2 + 0.3)), tang.clone().multiplyScalar(Math.sign(Fm) * 6 * Math.min(1, Math.abs(Fm) / Fref)), vectors && Math.abs(M) > 1e-4 * pl.mass * G * pl.lcm);
          o.aW.set(V(0, 0, 2.1), V(0, 0, 3.5 * Math.max(-1.2, Math.min(1.2, w / wRef))), vectors && Math.abs(w) > 0.02);
        });
      },
    };
  };
}

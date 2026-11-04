/** 3D: колекторний двигун постійного струму. Вісь обертання — z, поле статора — +x (від N до S). */
import { THREE, View3D, Arrow3D, ArrowPool, C3, makeLabel, setLabel, metalMat, currentRGB, type Scene3D } from '../ui/view3d';
import type { DCMotor } from '../physics/dcMotor';

export interface DCState {
  m: DCMotor;
  mode: 'motor' | 'gen';
  iRef: number;
}

const RW = 4;     // радіус рамки
const LZ = 8;     // довжина активних провідників
const RC = 1.1;   // радіус колектора
const ZC = LZ / 2 + 1.6;

export function dcScene(get: () => DCState) {
  return (v: View3D): Scene3D => {
    const root = new THREE.Group();
    v.scene.add(root);
    // статор: полюси N (ліворуч) і S (праворуч) з увігнутими наконечниками
    const poleGeo = new THREE.BoxGeometry(2.4, 7.5, LZ + 1);
    const pN = new THREE.Mesh(poleGeo, new THREE.MeshStandardMaterial({ color: C3.north, roughness: 0.5, transparent: true, opacity: 0.75 }));
    const pS = new THREE.Mesh(poleGeo, new THREE.MeshStandardMaterial({ color: C3.south, roughness: 0.5 }));
    pN.position.x = -(RW + 2.2);
    pS.position.x = RW + 2.2;
    const yoke = new THREE.Mesh(new THREE.TorusGeometry(RW + 5.2, 0.9, 12, 64, Math.PI), metalMat(0x4b5563, { metalness: 0.3 }));
    yoke.rotation.z = 0;
    yoke.position.z = 0;
    const yoke2 = yoke.clone();
    yoke2.rotation.z = Math.PI;
    const capN = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, LZ + 1), metalMat(0x4b5563));
    capN.position.x = -(RW + 4.1);
    const capS = capN.clone();
    capS.position.x = RW + 4.1;
    root.add(pN, pS, yoke, yoke2, capN, capS);
    const lN = makeLabel('N', '#ffb4b4', 16), lS = makeLabel('S', '#b4ccff', 16);
    lN.position.set(-(RW + 2.2), 4.6, 0);
    lS.position.set(RW + 2.2, 4.6, 0);
    root.add(lN, lS);
    // вал
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, LZ + 9, 16), metalMat(0xd0d5dd));
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = 1.5;
    root.add(shaft);
    const rotor = new THREE.Group();
    root.add(rotor);
    // щітки (зверху «+», знизу «−»)
    const brushMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9 });
    const bT = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.9), brushMat);
    bT.position.set(0, RC + 0.75, ZC);
    const bB = bT.clone();
    bB.position.y = -(RC + 0.75);
    root.add(bT, bB);
    const lP = makeLabel('+', '#ff8080', 16), lM = makeLabel('−', '#80a8ff', 16);
    lP.position.set(0.9, RC + 1.6, ZC);
    lM.position.set(0.9, -(RC + 1.6), ZC);
    root.add(lP, lM);

    const lines = new THREE.Group();
    root.add(lines);
    const lm = new THREE.LineBasicMaterial({ color: C3.bExt, transparent: true, opacity: 0.35 });
    for (let iy = -3; iy <= 3; iy++)
      for (const z of [-LZ / 2 + 0.5, 0, LZ / 2 - 0.5]) {
        const y = iy * 1.1;
        lines.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-RW - 1, y, z), new THREE.Vector3(RW + 1, y, z)]), lm));
      }
    const bPool = new ArrowPool(root, C3.bExt, 0.07);
    const fPool = new ArrowPool(root, C3.force, 0.12);
    const iPool = new ArrowPool(root, C3.cur, 0.08);
    const aW = new Arrow3D(0xd6dde8, 0.14, 'ω');
    const aM = new Arrow3D(C3.good, 0.16, 'M ел');
    root.add(aW.group, aM.group);
    const legend = v.legend([
      [C3.bExt, 'поле статора B'], [C3.cur, 'струм у провідниках рамки'], [C3.force, 'сили Ампера F = (I/c) l × B'],
      [0xd6dde8, 'ω (вздовж осі)'], [C3.good, 'момент M ел (зелений — рушійний, червоний — гальмує)'],
    ]);
    const info = makeLabel('', '#ffa63d', 13);
    info.position.set(0, -RW - 4.2, 0);
    root.add(info);

    let nCoils = -1;
    const coils: { g: THREE.Group; mats: THREE.MeshStandardMaterial[] }[] = [];
    let comm: THREE.Mesh[] = [];
    const build = (n: number) => {
      rotor.clear();
      coils.length = 0;
      for (let j = 0; j < n; j++) {
        const g = new THREE.Group();
        const mats: THREE.MeshStandardMaterial[] = [];
        const mat = () => { const m = new THREE.MeshStandardMaterial({ color: C3.copper, metalness: 0.6, roughness: 0.35, emissive: 0 }); mats.push(m); return m; };
        const r = n > 3 ? 0.16 : 0.24;
        for (const sy of [1, -1]) {
          const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, LZ, 10), mat());
          w.rotation.x = Math.PI / 2;
          w.position.y = sy * RW;
          g.add(w);
        }
        // торцеві перемички та виводи до колектора
        const back = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 2 * RW, 10), mats[0]);
        back.position.z = -LZ / 2;
        const f1 = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r * 0.8, RW - RC, 8), mats[0]);
        f1.position.set(0, (RW + RC) / 2, LZ / 2);
        const f2 = f1.clone();
        f2.material = mats[1];
        f2.position.y = -(RW + RC) / 2;
        const lead = (y: number, m: THREE.Material) => {
          const l = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r * 0.6, ZC - LZ / 2, 8), m);
          l.rotation.x = Math.PI / 2;
          l.position.set(0, y, (ZC + LZ / 2) / 2);
          return l;
        };
        g.add(back, f1, f2, lead(RC, mats[0]), lead(-RC, mats[1]));
        rotor.add(g);
        coils.push({ g, mats });
      }
      // колектор: дві півкільцеві пластини із зазорами в площині рамки 0
      comm = [];
      for (const k of [0, 1]) {
        const sh = new THREE.Shape();
        sh.absarc(0, 0, RC, 0.15 + k * Math.PI, Math.PI - 0.15 + k * Math.PI, false);
        sh.absarc(0, 0, RC * 0.62, Math.PI - 0.15 + k * Math.PI, 0.15 + k * Math.PI, true);
        const geo = new THREE.ExtrudeGeometry(sh, { depth: 1.2, bevelEnabled: false, curveSegments: 24 });
        const m = new THREE.Mesh(geo, metalMat(k ? 0xa07040 : 0xe0a060, { metalness: 0.8, roughness: 0.25 }));
        m.position.z = ZC - 0.6;
        root.add(m);
        comm.push(m);
      }
      nCoils = n;
    };

    v.look([RW * 3.4, RW * 2.4, RW * 5.4], [0, 0, 1]);
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const col = new THREE.Color();
    return {
      update({ vectors, lines: showLines }) {
        const s = get();
        const { m } = s;
        const n = Math.max(1, m.p.coils || 6);
        if (n !== nCoils) {
          comm.forEach((c) => root.remove(c));
          build(n);
        }
        legend.style.display = vectors ? '' : 'none';
        lines.visible = showLines;
        const phi = m.y[1], I = m.current(), w = m.y[0];
        const frac = Math.min(1, Math.abs(I) / s.iRef);
        // колектор обертається разом із рамкою 0: зазори вздовж t = (−sin φ, cos φ)
        comm.forEach((c) => (c.rotation.z = phi + Math.PI / 2));
        fPool.begin();
        iPool.begin();
        coils.forEach((c, j) => {
          const pj = phi + (Math.PI * j) / n;
          c.g.rotation.z = pj;
          // струм після комутації: s_j = −sign(sin φ_j)·sign(I); провідник «a» (на +t) несе струм уздовж +z при s_j > 0
          const sj = -Math.sign(Math.sin(pj)) * Math.sign(I);
          currentRGB(sj, frac, col);
          c.mats.forEach((mm) => { mm.emissive.copy(col).multiplyScalar(0.7 * frac); });
          if (vectors && frac > 0.03) {
            const tx = -Math.sin(pj), ty = Math.cos(pj);
            const a = V(RW * tx, RW * ty, 0), b = V(-RW * tx, -RW * ty, 0);
            const L = 3.2 * frac;
            // F ∝ I ẑ × x̂ = I ŷ
            if (n <= 3) {
              fPool.add(a.clone(), V(0, sj * L, 0));
              fPool.add(b.clone(), V(0, -sj * L, 0));
            }
            iPool.add(a.clone().add(V(0, 0, -sj * 1.6)), V(0, 0, sj * 3.2));
            iPool.add(b.clone().add(V(0, 0, sj * 1.6)), V(0, 0, -sj * 3.2));
          }
        });
        fPool.end();
        iPool.end();
        bPool.begin();
        if (vectors && showLines)
          for (const y of [-2.2, 0, 2.2]) for (const z of [-LZ / 2 + 0.5, LZ / 2 - 0.5]) bPool.add(V(-RW - 1.2, y, z), V(1.6, 0, 0));
        bPool.end();
        aW.set(V(0, 0, ZC + 1.2), V(0, 0, Math.sign(w) * 3.5), vectors && Math.abs(w) > 0.5);
        const M = m.torque();
        aM.setColor(M * w < 0 ? C3.force : C3.good);
        aM.set(V(0, 0, -LZ / 2 - 4.8), V(0, 0, Math.sign(M) * 3.5 * Math.max(0.15, frac)), vectors && Math.abs(M) > 0);
        const eps = m.backEmf();
        setLabel(info, s.mode === 'gen'
          ? 'генератор: струм у рамці створює гальмівний момент (правило Ленца)'
          : `проти-ЕРС ε = ${((Math.abs(eps) / Math.max(1e-30, m.p.U)) * 100).toFixed(0)} % від U · I/I_пуск = ${(I / (m.p.U / m.Rtot || 1)).toFixed(2)}`);
      },
    };
  };
}

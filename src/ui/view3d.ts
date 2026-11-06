// SPDX-FileCopyrightText: 2026 Max Kravchenko
// SPDX-License-Identifier: MIT

/**
 * Спільне 3D-полотно (three.js): сцена, камера з обертанням мишею (OrbitControls), світло,
 * HTML-підписи (CSS2DRenderer) і «товсті» 3D-стрілки для векторів.
 * Модуль завантажується ліниво — лише коли користувач вмикає 3D.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export { THREE };

export const C3 = {
  bExt: 0x4ea8ff,
  bInd: 0xffa63d,
  cur: 0x5eead4,
  curNeg: 0xf472b6,
  force: 0xff5d5d,
  good: 0x4ade80,
  vel: 0xe6ebf2,
  grav: 0x9ca3af,
  north: 0xe5484d,
  south: 0x3e7bfa,
  copper: 0xc8794a,
  metal: 0xaab2bf,
  dark: 0x2a3242,
};

/** Об'ємна стрілка: циліндр + конус. set(origin, vector) — довжина = |vector|. */
export class Arrow3D {
  group = new THREE.Group();
  private shaft: THREE.Mesh;
  private head: THREE.Mesh;
  private mat: THREE.MeshStandardMaterial;
  label?: CSS2DObject;
  private static up = new THREE.Vector3(0, 1, 0);

  constructor(color: number, public radius = 0.08, label?: string) {
    this.mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.45, roughness: 0.5 });
    this.shaft = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12), this.mat);
    this.head = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 16), this.mat);
    this.group.add(this.shaft, this.head);
    if (label) {
      this.label = makeLabel(label, '#' + color.toString(16).padStart(6, '0'));
      this.group.add(this.label);
    }
  }

  set(origin: THREE.Vector3, v: THREE.Vector3, visible = true): void {
    const L = v.length();
    if (!visible || L < 1e-6) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    const r = this.radius;
    const hl = Math.min(L * 0.45, r * 5), hr = r * 2.4;
    this.group.position.copy(origin);
    this.group.quaternion.setFromUnitVectors(Arrow3D.up, v.clone().divideScalar(L));
    this.shaft.scale.set(r, L - hl, r);
    this.shaft.position.set(0, (L - hl) / 2, 0);
    this.head.scale.set(hr, hl, hr);
    this.head.position.set(0, L - hl / 2, 0);
    if (this.label) this.label.position.set(0, L + r * 4 + 0.15, 0);
  }

  setColor(c: number): void {
    this.mat.color.setHex(c);
    this.mat.emissive.setHex(c);
  }

  hide(): void {
    this.group.visible = false;
  }
}

export function makeLabel(text: string, color = '#e4e8ef', size = 12): CSS2DObject {
  const d = document.createElement('div');
  d.className = 'l3d';
  d.textContent = text;
  d.style.color = color;
  d.style.fontSize = size + 'px';
  return new CSS2DObject(d);
}

export function setLabel(o: CSS2DObject, text: string): void {
  if (o.element.textContent !== text) o.element.textContent = text;
}

/** Постійний магніт: дві половини (N червона, S синя). N уздовж +y локально. */
export function magnetMesh(len: number, size: number, round = true): THREE.Group {
  const g = new THREE.Group();
  const geo = round ? new THREE.CylinderGeometry(size, size, len / 2, 32) : new THREE.BoxGeometry(size * 2, len / 2, size * 2);
  const n = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: C3.north, roughness: 0.4, metalness: 0.2 }));
  const s = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: C3.south, roughness: 0.4, metalness: 0.2 }));
  n.position.y = len / 4;
  s.position.y = -len / 4;
  g.add(n, s);
  return g;
}

export const metalMat = (color = C3.metal, o: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.38, ...o });

/** Колір струму за знаком і відносною величиною f ∈ [0, 1]. */
export function currentRGB(I: number, f: number, out = new THREE.Color()): THREE.Color {
  const base = I >= 0 ? [94, 234, 212] : [244, 114, 182];
  return out.setRGB((60 + (base[0] - 60) * f) / 255, (45 + (base[1] - 45) * f) / 255, (35 + (base[2] - 35) * f) / 255, THREE.SRGBColorSpace);
}

/** Пул стрілок однакового кольору (для полів векторів). */
export class ArrowPool {
  private items: Arrow3D[] = [];
  private used = 0;
  constructor(private parent: THREE.Object3D, private color: number, private radius = 0.05) {}
  begin(): void {
    this.used = 0;
  }
  add(origin: THREE.Vector3, v: THREE.Vector3, color?: number): void {
    if (this.used >= this.items.length) {
      const a = new Arrow3D(this.color, this.radius);
      this.parent.add(a.group);
      this.items.push(a);
    }
    const a = this.items[this.used++];
    if (color != null) a.setColor(color);
    a.set(origin, v);
  }
  end(): void {
    for (let i = this.used; i < this.items.length; i++) this.items[i].hide();
  }
}

export class View3D {
  el: HTMLDivElement;
  renderer: THREE.WebGLRenderer;
  labels: CSS2DRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  private w = 0;
  private h = 0;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'stage3d';
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setClearColor(0x0a0d12);
    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = 'labels3d';
    this.el.append(this.renderer.domElement, this.labels.domElement);
    this.camera = new THREE.PerspectiveCamera(40, 2, 0.05, 2000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x20242c, 1.3));
    const d1 = new THREE.DirectionalLight(0xffffff, 1.8);
    d1.position.set(5, 9, 7);
    const d2 = new THREE.DirectionalLight(0x9fb8ff, 0.6);
    d2.position.set(-6, -3, -5);
    this.scene.add(d1, d2);
    const hint = document.createElement('div');
    hint.className = 'hint3d';
    hint.textContent = 'ЛКМ — обертати · колесо — масштаб · ПКМ — зсув';
    this.el.append(hint);
  }

  /** Легенда кольорів векторів (лівий верхній кут). */
  legend(items: [number, string][]): HTMLDivElement {
    const d = document.createElement('div');
    d.className = 'legend3d';
    d.innerHTML = items.map(([c, t]) => `<div><i style="background:#${c.toString(16).padStart(6, '0')}"></i>${t}</div>`).join('');
    this.el.append(d);
    return d;
  }

  /** Поставити камеру: позиція та точка, на яку дивимось. */
  look(pos: [number, number, number], target: [number, number, number]): void {
    this.camera.position.set(...pos);
    this.controls.target.set(...target);
    this.controls.update();
  }

  /** Зсунути камеру разом із ціллю (стеження за об'єктом). */
  follow(target: THREE.Vector3): void {
    const d = target.clone().sub(this.controls.target);
    this.controls.target.add(d);
    this.camera.position.add(d);
  }

  resize(w: number, h: number): void {
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.el.style.height = h + 'px';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }
}

/** Сцена конкретної симуляції. */
export interface Scene3D {
  update(o: { vectors: boolean; lines: boolean }): void;
}
export type Scene3DFactory = (v: View3D) => Scene3D;

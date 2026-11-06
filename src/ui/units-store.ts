// SPDX-FileCopyrightText: 2026 Max Kravchenko
// SPDX-License-Identifier: MIT

/** Глобальний вибір системи одиниць для виводу (фізика завжди в СГС). */
import { fmt, toSys, unitLabel, type Dim, type UnitSystem } from '../physics/units';

type Listener = (s: UnitSystem) => void;

let current: UnitSystem = 'CGS';
const listeners = new Set<Listener>();

export const units = {
  get sys(): UnitSystem {
    return current;
  },
  set(s: UnitSystem): void {
    if (s === current) return;
    current = s;
    document.body.classList.toggle('sys-SI', s === 'SI');
    document.body.classList.toggle('sys-CGS', s === 'CGS');
    listeners.forEach((l) => l(s));
  },
  on(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** Значення з одиницею у вибраній системі. */
  fmt(xCgs: number, dim: Dim, digits = 3): string {
    return fmt(xCgs, dim, current, digits);
  },
  val(xCgs: number, dim: Dim): number {
    return toSys(xCgs, dim, current);
  },
  label(dim: Dim): string {
    return unitLabel(dim, current);
  },
};

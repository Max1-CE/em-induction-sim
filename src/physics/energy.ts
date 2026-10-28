/**
 * Енергетичний баланс (головна перевірка коректності кожної моделі):
 *   E_мех + W_маг + Q_Дж − A_зовн = const,
 * де A_зовн — робота зовнішніх джерел (батарея, привід, змінне поле).
 */
export interface EnergyBudget {
  /** Механічна енергія (кінетична + потенціальна), ерг. */
  mech: number;
  /** Магнітна енергія струмів Σ L I² / (2c²), ерг. */
  mag: number;
  /** Накопичене джоулеве тепло ∫ I²R dt, ерг. */
  heat: number;
  /** Робота зовнішніх джерел, ерг. */
  ext: number;
}

/** Повна «збережувана» величина. */
export const energyTotal = (e: EnergyBudget): number => e.mech + e.mag + e.heat - e.ext;

/**
 * Відносне порушення балансу відносно початкового стану:
 *   |S(t) − S(0)| / max(|E_мех(0)|, Q, A, W, …) — нормуємо на найбільший масштаб енергій.
 */
export function energyError(e0: EnergyBudget, e: EnergyBudget): number {
  const scale = Math.max(
    Math.abs(e0.mech), Math.abs(e.mech), Math.abs(e.heat), Math.abs(e.ext), Math.abs(e.mag), 1e-300,
  );
  return Math.abs(energyTotal(e) - energyTotal(e0)) / scale;
}

/** Реєстр розділів і підрозділів застосунку. */
import type { Page } from './ui/simpage';
import { createCoilSim } from './sims/basics/coil';
import { createGeneratorSim } from './sims/basics/generator';
import { createRailsSim } from './sims/basics/rails';
import { createRLSim } from './sims/basics/rl';
import { createTubeSim } from './sims/eddy/tube';
import { createPendulumSim } from './sims/eddy/pendulum';
import { createDiskSim } from './sims/eddy/disk';
import { createHeatingSim } from './sims/eddy/heating';
import { createDCSim } from './sims/motor/dc';
import { createInductionSim, createCanSim } from './sims/motor/induction';
import { createReference } from './sims/reference';

export interface Section {
  id: string;
  title: string;
  subs: { id: string; title: string; make: () => Page }[];
}

export const SECTIONS: Section[] = [
  {
    id: 'basics',
    title: '1. Основи',
    subs: [
      { id: 'coil', title: '1a. Магніт і котушка', make: createCoilSim },
      { id: 'generator', title: '1b. Генератор', make: createGeneratorSim },
      { id: 'rails', title: '1c. Рейки та анти-Ленц', make: createRailsSim },
      { id: 'rl', title: '1d. RL-коло', make: createRLSim },
    ],
  },
  {
    id: 'eddy',
    title: '2. Струми Фуко',
    subs: [
      { id: 'tube', title: '2a. Магніт у трубі', make: createTubeSim },
      { id: 'pendulum', title: '2b. Маятник Вальтенгофена', make: createPendulumSim },
      { id: 'disk', title: '2c. Електромагнітне гальмо', make: createDiskSim },
      { id: 'heating', title: '2d. Нагрів і шихтування', make: createHeatingSim },
    ],
  },
  {
    id: 'motor',
    title: '3. Електродвигун',
    subs: [
      { id: 'dc', title: '3a. Двигун постійного струму', make: createDCSim },
      { id: 'induction', title: '3b. Асинхронний двигун', make: createInductionSim },
      { id: 'can', title: '3c. Банка під магнітом', make: createCanSim },
    ],
  },
  {
    id: 'ref',
    title: '4. Довідник',
    subs: [{ id: 'main', title: 'Довідник', make: createReference }],
  },
];

import type { PartDefinition, PartInstance, AssemblyConnection } from '../core/types.ts';

/** Fictional educational catalogue; reference ascent verified within the M1 model. */
export const CATALOGUE_VERSION = 'm1-reference-1';
export const PARTS: PartDefinition[] = [
  {
    id: 'command', name: 'Pathfinder Command', category: 'command',
    description: 'Uncrewed guidance module with batteries and attitude control.',
    widthM: 2.4, heightM: 2.6, dryMassKg: 650, costCredits: 1800,
    collision: { centreM: { x: 0, y: 0 }, widthM: 2.4, heightM: 2.6 },
    connectors: [{ id: 'bottom', positionM: { x: 0, y: -1.3 }, normal: { x: 0, y: -1 }, kind: 'structural', sizeM: 2.4 }],
    command: { baselinePowerW: 40, batteryCapacityWh: 400, maxBusPowerW: 900, maxControlTorqueNm: 1200 },
  },
  {
    id: 'tank', name: 'Atlas Propellant Tank', category: 'tank',
    description: 'Liquid propellant storage with axial fuel feed and equipment mounts.',
    widthM: 2.4, heightM: 5, dryMassKg: 800, costCredits: 900,
    collision: { centreM: { x: 0, y: 0 }, widthM: 2.4, heightM: 5 },
    connectors: [
      { id: 'top', positionM: { x: 0, y: 2.5 }, normal: { x: 0, y: 1 }, kind: 'structural', sizeM: 2.4 },
      { id: 'bottom', positionM: { x: 0, y: -2.5 }, normal: { x: 0, y: -1 }, kind: 'structural', sizeM: 2.4 },
      { id: 'right', positionM: { x: 1.2, y: 0 }, normal: { x: 1, y: 0 }, kind: 'equipment', sizeM: 0.4 },
      { id: 'left', positionM: { x: -1.2, y: 0 }, normal: { x: -1, y: 0 }, kind: 'equipment', sizeM: 0.4 },
    ],
    tank: { propellantType: 'educational-liquid', capacityKg: 26000, propellantCostPerKg: 0.02 },
  },
  {
    id: 'engine', name: 'Vector Liquid Engine', category: 'engine',
    description: 'Throttleable engine; needs connected compatible propellant.',
    widthM: 2.4, heightM: 2.4, dryMassKg: 480, costCredits: 1500,
    collision: { centreM: { x: 0, y: 0 }, widthM: 2.4, heightM: 2.4 },
    connectors: [{ id: 'top', positionM: { x: 0, y: 1.2 }, normal: { x: 0, y: 1 }, kind: 'structural', sizeM: 2.4 }],
    engine: { propellantType: 'educational-liquid', thrustSeaLevelN: 420000, thrustVacuumN: 460000, ispSeaLevelS: 350, ispVacuumS: 390, maxGimbalRad: 0.08, exhaustOriginM: { x: 0, y: -1.2 }, exhaustDirection: { x: 0, y: -1 }, exhaustClearanceM: 4 },
  },
  {
    id: 'solar', name: 'Sunwing Array', category: 'solar',
    description: 'Side-mounted solar array; charges batteries in sunlight.',
    widthM: 3.2, heightM: 0.8, dryMassKg: 45, costCredits: 450,
    collision: { centreM: { x: 0, y: 0 }, widthM: 3.2, heightM: 0.8 },
    connectors: [{ id: 'mount', positionM: { x: -1.6, y: 0 }, normal: { x: -1, y: 0 }, kind: 'equipment', sizeM: 0.4 }],
    solar: { ratedPowerW: 220 },
  },
];

/** Fixture coordinates share exact connector positions; origin is tank centre. */
export const SAMPLE_CRAFT: PartInstance[] = [
  { id: 'command-1', definitionId: 'command', positionM: { x: 0, y: 3.8 }, angleRad: 0 },
  { id: 'tank-1', definitionId: 'tank', positionM: { x: 0, y: 0 }, angleRad: 0, propellantKg: 26000 },
  { id: 'engine-1', definitionId: 'engine', positionM: { x: 0, y: -3.7 }, angleRad: 0 },
  { id: 'solar-1', definitionId: 'solar', positionM: { x: 2.8, y: 0 }, angleRad: 0 },
];
export const SAMPLE_CONNECTIONS: AssemblyConnection[] = [
  { a: { partId: 'command-1', nodeId: 'bottom' }, b: { partId: 'tank-1', nodeId: 'top' } },
  { a: { partId: 'tank-1', nodeId: 'bottom' }, b: { partId: 'engine-1', nodeId: 'top' } },
  { a: { partId: 'tank-1', nodeId: 'right' }, b: { partId: 'solar-1', nodeId: 'mount' } },
];
export function getPart(id: string): PartDefinition | undefined {
  return PARTS.find(part => part.id === id);
}

/** SI units. World and part-local axes: x right, y up; positive angles CCW. */
export interface Vec2 { x: number; y: number }
export type PartCategory = 'command' | 'tank' | 'engine' | 'solar';
export interface AttachmentNode {
  id: string;
  positionM: Vec2;
  normal: Vec2;
  kind: 'structural' | 'equipment';
  sizeM: number;
}
export interface PartBase {
  id: string;
  name: string;
  category: PartCategory;
  description: string;
  widthM: number;
  heightM: number;
  dryMassKg: number;
  costCredits: number;
  connectors: AttachmentNode[];
  /** Conservative physics envelope, independent of decorative artwork. */
  collision: { centreM: Vec2; widthM: number; heightM: number };
}
export interface CommandPart extends PartBase {
  category: 'command';
  command: { baselinePowerW: number; batteryCapacityWh: number; maxBusPowerW: number; maxControlTorqueNm: number };
}
export interface TankPart extends PartBase {
  category: 'tank';
  tank: { propellantType: 'educational-liquid'; capacityKg: number; propellantCostPerKg: number };
}
export interface EnginePart extends PartBase {
  category: 'engine';
  engine: { propellantType: 'educational-liquid'; thrustSeaLevelN: number; thrustVacuumN: number; ispSeaLevelS: number; ispVacuumS: number; maxGimbalRad: number; exhaustOriginM: Vec2; exhaustDirection: Vec2; exhaustClearanceM: number };
}
export interface SolarPart extends PartBase {
  category: 'solar';
  solar: { ratedPowerW: number };
}
export type PartDefinition = CommandPart | TankPart | EnginePart | SolarPart;
export interface PartInstance {
  id: string;
  definitionId: string;
  positionM: Vec2;
  angleRad: number;
  /** Required for tanks in valid saves; zero or absent for other parts. */
  propellantKg?: number;
}
export interface NodeRef { partId: string; nodeId: string }
export interface AssemblyConnection { a: NodeRef; b: NodeRef }
export interface VehicleAssembly { id: string; parts: PartInstance[]; connections: AssemblyConnection[] }
export interface CelestialBody {
  id: string;
  name: string;
  radiusM: number;
  gravitationalParameterM3S2: number;
  rotationRadPerS: number;
}
/** Save contract anticipates staging and changing frames; live M1 state is in dynamics.ts. */
export interface VehicleSnapshot {
  id: string;
  assembly: VehicleAssembly;
  referenceBodyId: string;
  positionM: Vec2;
  velocityMPerS: Vec2;
  angleRad: number;
  angularVelocityRadPerS: number;
  throttle: number;
  batteryWh: number;
  mode: 'pad' | 'flight' | 'landed' | 'rover' | 'detached';
}
export type FlightCommand =
  | { simulationTimeS: number; vehicleId: string; type: 'set-throttle'; value: number }
  | { simulationTimeS: number; vehicleId: string; type: 'set-steering'; value: number }
  | { simulationTimeS: number; vehicleId: string; type: 'cut-engine' };
export interface MissionSave {
  schemaVersion: 1;
  catalogueVersion: string;
  simulationTimeS: number;
  selectedVehicleId: string;
  seed: number;
  vehicles: VehicleSnapshot[];
  commands: FlightCommand[];
}

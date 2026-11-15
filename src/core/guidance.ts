import type { FlightState } from './dynamics.ts';
import { EARTH, orbitElements } from './orbit.ts';
import { massProperties } from './assembly.ts';
import { PARTS } from '../data/parts.ts';

/** Guidance sets ordinary controls; it never modifies position, velocity or fuel. */
export function applyGuidance(state: FlightState): void {
  if (!state.assistance || state.status === 'crashed') return;
  const r = Math.hypot(state.positionM.x,state.positionM.y);
  const up = { x: state.positionM.x/r, y: state.positionM.y/r };
  const tangent = { x: -up.y, y: up.x }; // eastward rotation at the north pad is left
  const radial = state.velocityMPerS.x*up.x+state.velocityMPerS.y*up.y;
  const horizontal = state.velocityMPerS.x*tangent.x+state.velocityMPerS.y*tangent.y;
  const altitude = r-EARTH.radiusM;
  const elements = orbitElements(state.positionM,state.velocityMPerS);
  state.attitudeHold = true;
  state.steering = 0;
  if ((elements.periapsisM ?? -1) > 120_000) {
    state.throttle = 0; state.assistance = false;
    state.message = 'Guided ascent complete: periapsis is above 120 km. You have control.';
    return;
  }
  // Pitch schedule is intentionally transparent and tuned for the reference craft.
  let pitchFromUp = Math.min(80*Math.PI/180, Math.pow(Math.max(0,altitude-1000)/100000,.7)*80*Math.PI/180);
  if (altitude > 100_000) {
    const targetVertical = 200;
    const correction = Math.max(-0.35, Math.min(0.65, (targetVertical-radial)/1100));
    pitchFromUp = Math.PI/2-correction;
  }
  const direction = { x: up.x*Math.cos(pitchFromUp)+tangent.x*Math.sin(pitchFromUp), y: up.y*Math.cos(pitchFromUp)+tangent.y*Math.sin(pitchFromUp) };
  state.targetAngleRad = Math.atan2(-direction.x,direction.y);
  const circular = Math.sqrt(EARTH.gravitationalParameterM3S2/r);
  const accelerationLimit = altitude < 40_000 ? 40 : 70;
  // Dynamics enforces this requested throttle without changing the engine model.
  const approximateMass = massProperties(state.assembly.parts,PARTS).wetMassKg;
  state.throttle = Math.max(0.08, Math.min(1, accelerationLimit*approximateMass/460000));
  if (altitude > 90_000 && (elements.apoapsisM ?? 0) > 230_000 && radial > 80 && horizontal < circular*0.95) {
    state.throttle = 0; // coast towards apoapsis before circularizing
    state.message = 'Guidance: coasting toward apoapsis before the circularization burn.';
  } else state.message = altitude < 70_000 ? 'Guidance: controlled ascent and gradual pitch toward the horizon.' : 'Guidance: shaping the orbit with a finite horizontal burn.';
}

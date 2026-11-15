import type { VehicleAssembly, Vec2, EnginePart, PartInstance } from './types.ts';
import { PARTS, getPart } from '../data/parts.ts';
import { massProperties, connectedTankIds } from './assembly.ts';
import { assemblyBounds, rotate } from './geometry.ts';
import { EARTH, orbitElements } from './orbit.ts';
import { applyGuidance } from './guidance.ts';
export { EARTH } from './orbit.ts';
export { connectedTankIds } from './assembly.ts';

export const G0 = 9.80665;
export const PHYSICS_STEP_S = 0.02;
export interface FlightState {
  timeS: number;
  positionM: Vec2;
  velocityMPerS: Vec2;
  angleRad: number;
  angularVelocityRadPerS: number;
  assembly: VehicleAssembly;
  throttle: number;
  steering: number;
  attitudeHold: boolean;
  targetAngleRad: number;
  assistance: boolean;
  status: 'pad' | 'flying' | 'crashed';
  launched: boolean;
  batteryWh: number;
  thrustN: number;
  accelerationMPerS2: number;
  message: string;
  /** Mission-owned camera/radio demand. Set before each fixed physical step. */
  payloadPowerW?: number;
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo,Math.min(hi,v));
const cross = (a: Vec2,b: Vec2) => a.x*b.y-a.y*b.x;

export function createFlight(assembly: VehicleAssembly): FlightState {
  const clone = structuredClone(assembly);
  // Canvas translation is an editing concern, never a physical launch offset.
  // Anchor the flight-local frame at the initial centre of mass, retaining all
  // relative connector/part geometry. The caller's builder data stays untouched.
  const initialCentre = massProperties(clone.parts,PARTS).centreOfMassM;
  for (const part of clone.parts) {
    part.positionM.x -= initialCentre.x;
    part.positionM.y -= initialCentre.y;
  }
  const bounds = assemblyBounds(clone.parts,PARTS);
  const altitude = Math.max(1,-bounds.minY);
  const radius = EARTH.radiusM+altitude;
  const batteryWh = clone.parts.reduce((sum,p)=>{ const d=getPart(p.definitionId); return sum+(d?.category==='command'?d.command.batteryCapacityWh:0); },0);
  return { timeS:0,positionM:{x:0,y:radius},velocityMPerS:{x:-radius*EARTH.rotationRadPerS,y:0},angleRad:0,angularVelocityRadPerS:0,assembly:clone,throttle:0,steering:0,attitudeHold:true,targetAngleRad:0,assistance:false,status:'pad',launched:false,batteryWh,thrustN:0,accelerationMPerS2:0,message:'On the launch pad. Increase throttle to ignite.' };
}

export function atmosphere(altitudeM: number): { densityKgM3:number; pressureRatio:number } {
  if (altitudeM>=100_000) return { densityKgM3:0,pressureRatio:0 };
  const factor = Math.exp(-Math.max(0,altitudeM)/8500);
  return { densityKgM3:1.225*factor,pressureRatio:factor };
}
function propulsion(state: FlightState): { instance:PartInstance; definition:EnginePart; tanks:PartInstance[] } | null {
  const instance = state.assembly.parts.find(p=>getPart(p.definitionId)?.category==='engine');
  if (!instance) return null;
  const definition = getPart(instance.definitionId) as EnginePart;
  const ids = connectedTankIds(state.assembly,instance.id);
  return { instance,definition,tanks:state.assembly.parts.filter(p=>ids.includes(p.id)) };
}
function controls(state: FlightState,mass:ReturnType<typeof massProperties>,engine:ReturnType<typeof propulsion>,thrust:number,h:number): { direction:Vec2; torque:number; actuatorPowerW:number } {
  const commands = state.assembly.parts.map(p=>getPart(p.definitionId)).filter(d=>d?.category==='command');
  const maxElectric = state.batteryWh>0 ? commands.reduce((s,d)=>s+(d?.category==='command'?d.command.maxControlTorqueNm:0),0) : 0;
  const steering = clamp(state.steering,-1,1);
  const error = Math.atan2(Math.sin(state.targetAngleRad-state.angleRad),Math.cos(state.targetAngleRad-state.angleRad));
  const requestedAcceleration = Math.abs(steering)>1e-6 ? steering*.15 : state.attitudeHold ? clamp(error*.9-state.angularVelocityRadPerS*1.8,-.15,.15) : 0;
  const requestedTorque = requestedAcceleration*mass.inertiaKgM2;
  const electric = clamp(requestedTorque,-maxElectric,maxElectric);
  let gimbal = 0, engineTorque = 0;
  const localAngle = engine?.instance.angleRad ?? 0;
  if (engine && thrust>0) {
    const lever = { x:engine.instance.positionM.x-mass.centreOfMassM.x,y:engine.instance.positionM.y-mass.centreOfMassM.y };
    const baseDirection = rotate({x:0,y:1},localAngle);
    const baseTorque = cross(lever,{x:baseDirection.x*thrust,y:baseDirection.y*thrust});
    const derivative = cross(lever,{x:-baseDirection.y*thrust,y:baseDirection.x*thrust});
    // Gimbal is used only with active manual or hold control, never as hidden stabilization.
    if ((state.attitudeHold || Math.abs(steering)>1e-6) && Math.abs(derivative)>1) gimbal=clamp((requestedTorque-electric-baseTorque)/derivative,-engine.definition.engine.maxGimbalRad,engine.definition.engine.maxGimbalRad);
    const force = rotate({x:0,y:thrust},localAngle+gimbal);
    engineTorque=cross(lever,force);
  }
  const torque = electric+engineTorque;
  const alpha = mass.inertiaKgM2>0 ? torque/mass.inertiaKgM2 : 0;
  const midAngle = state.angleRad + state.angularVelocityRadPerS*h/2 + alpha*h*h/8;
  return { direction:rotate({x:0,y:1},midAngle+localAngle+gimbal),torque,actuatorPowerW:Math.abs(electric)>1e-6?30:0 };
}

function microstep(state:FlightState,h:number): void {
  if (state.status==='crashed') { state.timeS+=h; return; }
  applyGuidance(state);
  state.throttle=clamp(state.throttle,0,1); state.steering=clamp(state.steering,-1,1);
  const m=massProperties(state.assembly.parts,PARTS), engine=propulsion(state);
  const altitude=Math.hypot(state.positionM.x,state.positionM.y)-EARTH.radiusM;
  const air=atmosphere(altitude);
  const fuel=engine?.tanks.reduce((s,t)=>s+(t.propellantKg??0),0)??0;
  const thrust=engine && fuel>0 && state.batteryWh>0 ? state.throttle*(engine.definition.engine.thrustVacuumN+(engine.definition.engine.thrustSeaLevelN-engine.definition.engine.thrustVacuumN)*air.pressureRatio) : 0;
  const isp=engine ? engine.definition.engine.ispVacuumS+(engine.definition.engine.ispSeaLevelS-engine.definition.engine.ispVacuumS)*air.pressureRatio : 1;
  const flow=thrust/(isp*G0);
  if (flow*h>fuel+1e-10) { const burnTime=fuel/flow; if (burnTime>1e-10) microstep(state,burnTime); microstep(state,h-burnTime); return; }
  const control=controls(state,m,engine,thrust,h);
  const area=state.assembly.parts.reduce((sum,p)=>{const d=getPart(p.definitionId)!;const axis=state.angleRad+p.angleRad; return sum + Math.abs(Math.sin(axis))*d.heightM*d.widthM*.25 + Math.abs(Math.cos(axis))*d.widthM*d.widthM*.35;},0);
  const consumed=flow*h;
  const acceleration=(x:number,y:number,vx:number,vy:number,mass:number):Vec2=>{
    const r=Math.hypot(x,y), gravity=-EARTH.gravitationalParameterM3S2/(r*r*r), density=atmosphere(r-EARTH.radiusM).densityKgM3;
    const rx=vx+EARTH.rotationRadPerS*y, ry=vy-EARTH.rotationRadPerS*x, speed=Math.hypot(rx,ry);
    const dragFactor=-.5*density*.28*area*speed/mass;
    return {x:gravity*x+thrust*control.direction.x/mass+dragFactor*rx,y:gravity*y+thrust*control.direction.y/mass+dragFactor*ry};
  };
  const {x,y}=state.positionM,{x:vx,y:vy}=state.velocityMPerS;
  const a1=acceleration(x,y,vx,vy,m.wetMassKg);
  if (state.status==='pad') {
    const radialThrust=thrust*(control.direction.x*x+control.direction.y*y)/Math.hypot(x,y);
    if (radialThrust/m.wetMassKg <= EARTH.gravitationalParameterM3S2/(x*x+y*y)) {
      const angle=EARTH.rotationRadPerS*h;
      state.positionM=rotate(state.positionM,angle); state.velocityMPerS={x:-EARTH.rotationRadPerS*state.positionM.y,y:EARTH.rotationRadPerS*state.positionM.x};
      state.angleRad+=angle; state.angularVelocityRadPerS=0; state.accelerationMPerS2=0;
    } else { state.status='flying';state.launched=true;state.message='Lift-off. Thrust and steering now shape your trajectory.'; }
  }
  if (state.status==='flying') {
    const a2=acceleration(x+vx*h/2,y+vy*h/2,vx+a1.x*h/2,vy+a1.y*h/2,m.wetMassKg-consumed/2);
    const a3=acceleration(x+(vx+a1.x*h/2)*h/2,y+(vy+a1.y*h/2)*h/2,vx+a2.x*h/2,vy+a2.y*h/2,m.wetMassKg-consumed/2);
    const a4=acceleration(x+(vx+a2.x*h/2)*h,y+(vy+a2.y*h/2)*h,vx+a3.x*h,vy+a3.y*h,m.wetMassKg-consumed);
    state.positionM={x:x+h*(vx+2*(vx+a1.x*h/2)+2*(vx+a2.x*h/2)+(vx+a3.x*h))/6,y:y+h*(vy+2*(vy+a1.y*h/2)+2*(vy+a2.y*h/2)+(vy+a3.y*h))/6};
    state.velocityMPerS={x:vx+h*(a1.x+2*a2.x+2*a3.x+a4.x)/6,y:vy+h*(a1.y+2*a2.y+2*a3.y+a4.y)/6};
    const alpha=m.inertiaKgM2>0?control.torque/m.inertiaKgM2:0;
    state.angleRad+=state.angularVelocityRadPerS*h+alpha*h*h/2;
    state.angularVelocityRadPerS+=alpha*h;
    state.accelerationMPerS2=Math.hypot(a1.x,a1.y);
    if (Math.hypot(state.positionM.x,state.positionM.y)<=EARTH.radiusM) { state.status='crashed';state.throttle=0;state.message='Surface impact. Revise thrust, steering or burn timing and retry.'; }
  }
  if (engine && consumed>0) {
    let remaining=consumed;
    for (const tank of engine.tanks) { const used=Math.min(tank.propellantKg??0,remaining);tank.propellantKg=Math.max(0,(tank.propellantKg??0)-used);remaining-=used; }
  }
  const commandPower=state.assembly.parts.reduce((s,p)=>{const d=getPart(p.definitionId);return s+(d?.category==='command'?d.command.baselinePowerW:0);},0);
  const sunlight=!(state.positionM.x<0 && Math.abs(state.positionM.y)<EARTH.radiusM);
  const solar=state.assembly.parts.reduce((s,p)=>{const d=getPart(p.definitionId);return s+(d?.category==='solar'?d.solar.ratedPowerW:0);},0);
  const capacity=state.assembly.parts.reduce((s,p)=>{const d=getPart(p.definitionId);return s+(d?.category==='command'?d.command.batteryCapacityWh:0);},0);
  const payloadPower=Number.isFinite(state.payloadPowerW)?clamp(state.payloadPowerW??0,0,900):0;
  state.batteryWh=clamp(state.batteryWh+((sunlight?solar:0)-commandPower-control.actuatorPowerW-payloadPower)*h/3600,0,capacity);
  state.thrustN=state.status==='crashed' || (engine && engine.tanks.every(t=>(t.propellantKg??0)<=1e-10)) ? 0 : thrust;
  if (engine && fuel-consumed<1e-8 && thrust>0) state.message='Propellant depleted. Coasting under gravity; the engine can no longer thrust.';
  if (state.batteryWh===0) state.message='Battery depleted: powered control is unavailable until solar charging restores energy.';
  state.timeS+=h;
}
export function stepFlight(state:FlightState,dt:number):void {
  if (!Number.isFinite(dt) || dt<0) throw new Error('Flight duration must be finite and nonnegative.');
  let remaining=dt;
  while (remaining>1e-10) { const h=Math.min(PHYSICS_STEP_S,remaining);microstep(state,h);remaining-=h; }
}
export function advanceFlight(state:FlightState,duration:number):void { stepFlight(state,duration); }

export function telemetry(state:FlightState) {
  const r=Math.hypot(state.positionM.x,state.positionM.y), up={x:state.positionM.x/r,y:state.positionM.y/r};
  const surfaceVelocity={x:state.velocityMPerS.x+EARTH.rotationRadPerS*state.positionM.y,y:state.velocityMPerS.y-EARTH.rotationRadPerS*state.positionM.x};
  const mass=massProperties(state.assembly.parts,PARTS), engine=propulsion(state), orbit=orbitElements(state.positionM,state.velocityMPerS);
  const available=engine?.tanks.reduce((s,p)=>s+(p.propellantKg??0),0)??0;
  const air=atmosphere(r-EARTH.radiusM);
  const maxThrust=engine?engine.definition.engine.thrustVacuumN+(engine.definition.engine.thrustSeaLevelN-engine.definition.engine.thrustVacuumN)*air.pressureRatio:0;
  return { altitudeM:r-EARTH.radiusM,speedMPerS:Math.hypot(state.velocityMPerS.x,state.velocityMPerS.y),verticalSpeedMPerS:surfaceVelocity.x*up.x+surfaceVelocity.y*up.y,horizontalSpeedMPerS:surfaceVelocity.x*(-up.y)+surfaceVelocity.y*up.x,propellantKg:mass.propellantKg,wetMassKg:mass.wetMassKg,twr:available>0&&state.batteryWh>0?maxThrust/(mass.wetMassKg*EARTH.gravitationalParameterM3S2/(r*r)):0,deltaVMPerS:engine?engine.definition.engine.ispVacuumS*G0*Math.log(mass.wetMassKg/(mass.wetMassKg-available)):0,apoapsisM:orbit.apoapsisM,periapsisM:orbit.periapsisM,periodS:orbit.periodS,escape:orbit.escape };
}

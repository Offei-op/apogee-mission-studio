import type { VehicleAssembly, PartInstance, AssemblyConnection, Vec2 } from './types.ts';
import type { FlightState } from './dynamics.ts';
import type { MissionState } from './mission.ts';
import { validateMission, MISSION_CONFIG } from './mission.ts';
import { CATALOGUE_VERSION, PARTS, getPart } from '../data/parts.ts';
import { massProperties, validateAssembly } from './assembly.ts';
import { EARTH } from './orbit.ts';

export interface SessionSave {
  schemaVersion: 2;
  catalogueVersion: string;
  craft: VehicleAssembly;
  flight: FlightState | null;
  mission: MissionState | null;
  view: 'assembly' | 'flight' | 'orbit' | 'mission';
  settings: { zoom: number; flightZoom: number; orbitZoom: number };
  savedAt: string;
}
export type SessionInput = Omit<SessionSave,'schemaVersion'|'catalogueVersion'|'savedAt'>;
const MAX_SAVE_CHARS = 2_000_000;
function fail(message: string): never { throw new Error(`Cannot restore session: ${message}`); }
function object(value: unknown, label: string): Record<string,unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(`${label} must be an object.`);
  return value as Record<string,unknown>;
}
function number(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(`${label} must be finite and between ${min} and ${max}.`);
  return value;
}
function text(value: unknown,label: string,max=120): string {
  if(typeof value!=='string'||value.length===0||value.length>max)fail(`${label} must be a nonempty string of at most ${max} characters.`);
  return value;
}
function id(value: unknown,label: string): string {
  const result=text(value,label,80);if(!/^[A-Za-z0-9_-]+$/.test(result))fail(`${label} contains unsupported characters.`);return result;
}
function bool(value: unknown,label: string): boolean {if(typeof value!=='boolean')fail(`${label} must be true or false.`);return value;}
function vector(value: unknown,label: string,max: number): Vec2 {
  const record=object(value,label);return {x:number(record.x,`${label} x`,-max,max),y:number(record.y,`${label} y`,-max,max)};
}
function array(value: unknown,label: string,max: number): unknown[] {
  if(!Array.isArray(value)||value.length>max)fail(`${label} must be an array with no more than ${max} entries.`);return value;
}

function assembly(value: unknown,label: string,inFlight=false): VehicleAssembly {
  const record=object(value,label);
  const parts: PartInstance[]=array(record.parts,`${label} parts`,128).map((entry,index)=>{
    const p=object(entry,`${label} part ${index+1}`),definitionId=id(p.definitionId,'Component definition');
    const definition=getPart(definitionId);if(!definition)fail(`Unknown component ${definitionId}.`);
    const result: PartInstance={id:id(p.id,'Part identity'),definitionId,positionM:vector(p.positionM,'Part position',10000),angleRad:number(p.angleRad,'Part angle',-1e6,1e6)};
    if(definition.category==='tank')result.propellantKg=number(p.propellantKg,'Tank propellant',0,definition.tank.capacityKg);
    else if(p.propellantKg!==undefined)result.propellantKg=number(p.propellantKg,'Non-tank propellant',0,0);
    return result;
  });
  const connections: AssemblyConnection[]=array(record.connections,`${label} connections`,127).map(entry=>{
    const c=object(entry,'Attachment connection');
    const ref=(value: unknown)=>{const r=object(value,'Connector reference');return {partId:id(r.partId,'Connected part'),nodeId:id(r.nodeId,'Connector identity')};};
    return {a:ref(c.a),b:ref(c.b)};
  });
  const result={id:id(record.id,'Craft identity'),parts,connections};
  const allowedIncomplete=new Set(['command-count','disconnected']);
  const issue=validateAssembly(parts,connections,PARTS).find(issue=>inFlight||!allowedIncomplete.has(issue.code));
  if(issue)fail(`${label}: ${issue.message}`);
  if(inFlight&&parts.filter(p=>getPart(p.definitionId)?.category==='engine').length!==1)fail('A flight must contain exactly one engine.');
  return result;
}

function flightState(value: unknown,craft: VehicleAssembly): FlightState {
  const f=object(value,'Flight'),vehicle=assembly(f.assembly,'Flight assembly',true);
  if(vehicle.id!==craft.id||vehicle.parts.length!==craft.parts.length)fail('Flight and editor craft identities do not match.');
  for(const part of vehicle.parts){
    const source=craft.parts.find(p=>p.id===part.id);
    if(!source||source.definitionId!==part.definitionId)fail('Flight components do not match the saved editor craft.');
    if((part.propellantKg??0)>(source.propellantKg??0)+1e-6)fail('Flight contains more propellant than its editor craft.');
  }
  const anchor=vehicle.parts[0],sourceAnchor=craft.parts.find(p=>p.id===anchor.id)!;
  const translation={x:anchor.positionM.x-sourceAnchor.positionM.x,y:anchor.positionM.y-sourceAnchor.positionM.y};
  for(const part of vehicle.parts){
    const source=craft.parts.find(p=>p.id===part.id)!;
    if(Math.hypot(part.positionM.x-source.positionM.x-translation.x,part.positionM.y-source.positionM.y-translation.y)>1e-5||Math.abs(Math.atan2(Math.sin(part.angleRad-source.angleRad),Math.cos(part.angleRad-source.angleRad)))>1e-6)fail('Flight geometry differs from its editor craft.');
  }
  const connectionKeys=(connections:AssemblyConnection[])=>connections.map(c=>[`${c.a.partId}/${c.a.nodeId}`,`${c.b.partId}/${c.b.nodeId}`].sort().join('|')).sort().join(';');
  if(connectionKeys(vehicle.connections)!==connectionKeys(craft.connections))fail('Flight connections differ from its editor craft.');
  const positionM=vector(f.positionM,'Flight position',1e13),velocityMPerS=vector(f.velocityMPerS,'Flight velocity',1e6);
  const radius=Math.hypot(positionM.x,positionM.y);
  if(radius<EARTH.radiusM-100000)fail('Flight position lies too far inside Earth.');
  const status=f.status;if(status!=='pad'&&status!=='flying'&&status!=='crashed')fail('Unknown flight status.');
  const launched=bool(f.launched,'Launch flag');
  if((status==='pad'&&launched)||(status!=='pad'&&!launched))fail('Flight status and launch flag disagree.');
  if(status==='pad'&&radius>EARTH.radiusM+1000)fail('A launchpad flight cannot be in space.');
  if(status==='flying'&&radius<EARTH.radiusM-1)fail('An underground flight must be marked as an impact.');
  const capacity=vehicle.parts.reduce((sum,p)=>{const d=getPart(p.definitionId);return sum+(d?.category==='command'?d.command.batteryCapacityWh:0);},0);
  const result: FlightState={
    assembly:vehicle,timeS:number(f.timeS,'Simulation time',0,1e9),positionM,velocityMPerS,
    angleRad:number(f.angleRad,'Flight attitude',-1e10,1e10),angularVelocityRadPerS:number(f.angularVelocityRadPerS,'Angular velocity',-1e4,1e4),
    throttle:number(f.throttle,'Throttle',0,1),steering:number(f.steering,'Steering',-1,1),
    attitudeHold:bool(f.attitudeHold,'Attitude hold'),targetAngleRad:number(f.targetAngleRad,'Target attitude',-1e10,1e10),assistance:bool(f.assistance,'Ascent assistance'),
    status,launched,batteryWh:number(f.batteryWh,'Battery energy',0,capacity),thrustN:number(f.thrustN,'Thrust',0,1e8),accelerationMPerS2:number(f.accelerationMPerS2,'Acceleration',0,1e7),
    message:text(f.message,'Flight message',1000),
    ...(f.payloadPowerW===undefined?{}:{payloadPowerW:number(f.payloadPowerW,'Payload power',0,100)}),
  };
  return result;
}

/** Validated JSON only. Restoring playback is always the UI's explicit paused action. */
export function decodeSession(json: string): SessionSave {
  if(typeof json!=='string'||json.length>MAX_SAVE_CHARS)fail('Save is missing or exceeds the supported size.');
  let parsed: unknown;try{parsed=JSON.parse(json);}catch{fail('File is not valid JSON.');}
  const input=object(parsed,'Session');
  if(input.schemaVersion!==2)fail('Unsupported save version. This build requires version 2.');
  if(input.catalogueVersion!==CATALOGUE_VERSION)fail('Component catalogue version differs. Load this save with its original game version.');
  const savedAt=text(input.savedAt,'Save timestamp',40),date=new Date(savedAt);
  if(!Number.isFinite(date.getTime())||date.toISOString()!==savedAt)fail('Save timestamp must be a valid ISO date.');
  if(date.getTime()>Date.now()+86400000)fail('Save timestamp lies in the future.');
  const craft=assembly(input.craft,'Editor assembly');
  const flight=input.flight===null?null:flightState(input.flight,craft);
  const mission=input.mission===null?null:validateMission(input.mission,flight);
  if(mission&&!flight)fail('Mission progress requires its saved flight.');
  if(mission&&Math.abs(mission.designCostCredits-massProperties(craft.parts,PARTS).costCredits-MISSION_CONFIG.fixedOperationsCostCredits)>1e-6)fail('Mission cost differs from the original editor craft and operations allocation.');
  const view=input.view;if(view!=='assembly'&&view!=='flight'&&view!=='orbit'&&view!=='mission')fail('Unknown studio view.');
  if((view==='flight'||view==='orbit')&&!flight)fail('Flight views require a saved flight.');
  const settings=object(input.settings,'View settings');
  return {schemaVersion:2,catalogueVersion:CATALOGUE_VERSION,craft,flight,mission,view,
    settings:{zoom:number(settings.zoom,'Assembly zoom',.2,8),flightZoom:number(settings.flightZoom,'Flight zoom',.2,8),orbitZoom:number(settings.orbitZoom,'Orbit zoom',.2,8)},savedAt};
}

export function encodeSession(input: SessionInput): string {
  // Validate before JSON.stringify so NaN and Infinity cannot silently become null.
  const session={...input,schemaVersion:2 as const,catalogueVersion:CATALOGUE_VERSION,savedAt:new Date().toISOString()};
  const json=JSON.stringify(session,(_key,value)=>{if(typeof value==='number'&&!Number.isFinite(value))fail('Numeric values must be finite.');return value;});
  const validated=decodeSession(json);
  return JSON.stringify(validated,null,2);
}

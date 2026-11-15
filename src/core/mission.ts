import type { FlightState } from './dynamics.ts';
import type { Vec2 } from './types.ts';
import { EARTH, orbitElements } from './orbit.ts';
import { getPart } from '../data/parts.ts';
import { PARTS } from '../data/parts.ts';
import { massProperties } from './assembly.ts';

export const MISSION_CONFIG = {
  id: 'pathfinder-coastal-survey', scenarioVersion: 'm2-1', name: 'Return a coastal observation',
  durationS: 7200, requiredObservations: 1, observationSizeMB: 16, storageCapacityMB: 32,
  budgetCredits:6500, fixedOperationsCostCredits:700,
  dwellS: 5, cameraPowerW: 60, radioPowerW: 40, downlinkMbps: 1,
  cameraHalfFovRad: 25*Math.PI/180, minimumAltitudeM: 100_000, stationElevationMaskRad: 10*Math.PI/180,
  reserveFraction: .2, recoverFraction: .3,
  targets: [{ id:'coast-01', name:'Equatorial Coast', longitudeRad:-20*Math.PI/180 }],
  stations: [{ id:'ground-01', name:'Dawn Ground Station', longitudeRad:10*Math.PI/180 }],
} as const;
export interface Observation {
  id: string; targetId: string; collectedAtS: number; sizeMB: number; remainingMB: number;
  qualifying: boolean; deliverAtS: number | null;
}
export interface MissionStats {
  observationWindowS:number; contactS:number; energyBlockedS:number; storageBlockedS:number;
  cameraDisabledWindowS:number; downlinkDisabledContactS:number; queuedWithoutContactS:number;
  interruptedDwells:number; payloadEnergyWh:number; minimumBatteryWh:number;
}
export interface MissionLogEntry { timeS:number; message:string }
export interface MissionState {
  id:string; scenarioVersion:string; startedAtS:number; deadlineS:number; lastUpdatedAtS:number;
  designCostCredits:number;
  status:'active'|'success'|'failed'|'ended'; cameraEnabled:boolean; downlinkEnabled:boolean;
  safeMode:boolean; dwellS:number; observations:Observation[]; stats:MissionStats;
  log:MissionLogEntry[];
  prepared:null|{timeS:number;camera:boolean;downlink:boolean;powerW:number};
}
export function surfacePoint(longitudeRad:number,timeS:number):Vec2 {
  const angle=longitudeRad+EARTH.rotationRadPerS*timeS;
  return {x:EARTH.radiusM*Math.cos(angle),y:EARTH.radiusM*Math.sin(angle)};
}
export function isSunlit(position:Vec2):boolean {
  return !(position.x<0&&Math.abs(position.y)<EARTH.radiusM);
}
function capacityWh(f:FlightState):number {
  return f.assembly.parts.reduce((s,p)=>{const d=getPart(p.definitionId);return s+(d?.category==='command'?d.command.batteryCapacityWh:0);},0);
}
function record(m:MissionState,timeS:number,message:string):void {
  m.log.push({timeS,message}); if(m.log.length>64)m.log.shift();
}
export function storageUsed(m:MissionState):number {
  return m.observations.reduce((s,o)=>s+o.remainingMB,0);
}
function completedCount(m:MissionState):number {
  return new Set(m.observations.filter(o=>o.qualifying&&o.remainingMB===0&&o.deliverAtS!==null&&o.deliverAtS<=m.deadlineS+1e-7).map(o=>o.targetId)).size;
}
/** Geometry is physical and evaluated from the actual trajectory, never a timed contact script. */
export function missionGeometry(f:FlightState) {
  const r=Math.hypot(f.positionM.x,f.positionM.y);
  const altitudeM=r-EARTH.radiusM;
  const orbital=orbitElements(f.positionM,f.velocityMPerS);
  const safeOrbit=f.status==='flying'&&altitudeM>=MISSION_CONFIG.minimumAltitudeM&&!orbital.escape&&(orbital.periapsisM??-1)>=MISSION_CONFIG.minimumAltitudeM;
  const footprintRad=Math.atan2(Math.max(0,altitudeM)*Math.tan(MISSION_CONFIG.cameraHalfFovRad),EARTH.radiusM);
  const target=MISSION_CONFIG.targets[0],targetPosition=surfacePoint(target.longitudeRad,f.timeS);
  const dot=(f.positionM.x*targetPosition.x+f.positionM.y*targetPosition.y)/(r*EARTH.radiusM);
  const separation=Math.acos(Math.max(-1,Math.min(1,dot)));
  const targetDaylight=targetPosition.x>0;
  const observationWindow=safeOrbit&&targetDaylight&&isSunlit(f.positionM)&&separation<=footprintRad;
  const stationPositions=MISSION_CONFIG.stations.map(s=>surfacePoint(s.longitudeRad,f.timeS));
  const contact=f.status==='flying'&&stationPositions.some(station=>{
    const dx=f.positionM.x-station.x,dy=f.positionM.y-station.y,d=Math.hypot(dx,dy);
    if(d<=0)return false;
    const sineElevation=(dx*station.x+dy*station.y)/(d*EARTH.radiusM);
    return sineElevation>=Math.sin(MISSION_CONFIG.stationElevationMaskRad);
  });
  return {contact,observationWindow,sunlit:isSunlit(f.positionM),targetDaylight,safeOrbit,footprintRad,targetPosition,stationPositions};
}
function activities(m:MissionState,f:FlightState) {
  const geometry=missionGeometry(f);
  const done=m.observations.some(o=>o.qualifying&&o.targetId===MISSION_CONFIG.targets[0].id);
  const camera=m.status==='active'&&!m.safeMode&&m.cameraEnabled&&geometry.observationWindow&&!done&&storageUsed(m)+MISSION_CONFIG.observationSizeMB<=MISSION_CONFIG.storageCapacityMB+1e-9;
  const downlink=m.status==='active'&&!m.safeMode&&m.downlinkEnabled&&geometry.contact&&storageUsed(m)>0;
  return {...geometry,camera,downlink,powerW:(camera?MISSION_CONFIG.cameraPowerW:0)+(downlink?MISSION_CONFIG.radioPowerW:0)};
}
export function createMission(flight:FlightState):MissionState {
  const designCostCredits=massProperties(flight.assembly.parts,PARTS).costCredits+MISSION_CONFIG.fixedOperationsCostCredits;
  if(designCostCredits>MISSION_CONFIG.budgetCredits)throw new Error('Mission design exceeds the 6500-credit budget.');
  return {id:MISSION_CONFIG.id,scenarioVersion:MISSION_CONFIG.scenarioVersion,startedAtS:flight.timeS,deadlineS:flight.timeS+MISSION_CONFIG.durationS,lastUpdatedAtS:flight.timeS,designCostCredits,status:'active',cameraEnabled:true,downlinkEnabled:true,safeMode:false,dwellS:0,observations:[],stats:{observationWindowS:0,contactS:0,energyBlockedS:0,storageBlockedS:0,cameraDisabledWindowS:0,downlinkDisabledContactS:0,queuedWithoutContactS:0,interruptedDwells:0,payloadEnergyWh:0,minimumBatteryWh:flight.batteryWh},log:[{timeS:flight.timeS,message:'Mission started. Collect one 16 MB daylight coastal observation and return it before the two-hour deadline.'}],prepared:null};
}
/** Prepare exactly one physical interval. Dynamics debits the returned payload power ONCE. */
export function missionPower(m:MissionState,f:FlightState):number {
  if(Math.abs(m.lastUpdatedAtS-f.timeS)>1e-6)throw new Error('Mission and flight clocks must agree before preparing payload power.');
  const cap=capacityWh(f);
  if(!m.safeMode&&f.batteryWh<=cap*MISSION_CONFIG.reserveFraction){m.safeMode=true;record(m,f.timeS,'Payload safe mode: battery reserve reached. Camera and radio suspended.');}
  else if(m.safeMode&&f.batteryWh>=cap*MISSION_CONFIG.recoverFraction&&cap>0){m.safeMode=false;record(m,f.timeS,'Payload operation restored after solar charging recovered the battery reserve.');}
  const a=activities(m,f);
  const allowed=m.status==='active'&&f.timeS<m.deadlineS&&f.status!=='crashed';
  m.prepared={timeS:f.timeS,camera:allowed&&a.camera,downlink:allowed&&a.downlink,powerW:allowed?a.powerW:0};
  return m.prepared.powerW;
}
/** Called after each <=0.02 s physical step, using the prepared start-of-interval activities. */
export function stepMission(m:MissionState,f:FlightState,dt:number):void {
  if(!Number.isFinite(dt)||dt<0||dt>.02000001)throw new Error('Mission stepping requires intervals from zero to 0.02 simulated seconds.');
  if(Math.abs(f.timeS-m.lastUpdatedAtS)<1e-8)return; // idempotent duplicate delivery of a completed step
  if(Math.abs(f.timeS-m.lastUpdatedAtS-dt)>1e-6)throw new Error('Mission must advance exactly once after every flight step.');
  const start=m.lastUpdatedAtS,prepared=m.prepared;
  if(!prepared||Math.abs(prepared.timeS-start)>1e-6)throw new Error('Call missionPower before the physical step.');
  m.prepared=null;m.lastUpdatedAtS=f.timeS;
  m.stats.minimumBatteryWh=Math.min(m.stats.minimumBatteryWh,f.batteryWh);
  if(m.status!=='active')return;
  const h=Math.max(0,Math.min(f.timeS,m.deadlineS)-start);
  const geometry=missionGeometry(f);
  if(geometry.observationWindow)m.stats.observationWindowS+=h;
  if(geometry.contact)m.stats.contactS+=h;
  if(m.safeMode)m.stats.energyBlockedS+=h;
  if(geometry.observationWindow&&!m.cameraEnabled)m.stats.cameraDisabledWindowS+=h;
  if(geometry.observationWindow&&storageUsed(m)+MISSION_CONFIG.observationSizeMB>MISSION_CONFIG.storageCapacityMB+1e-9)m.stats.storageBlockedS+=h;
  if(geometry.contact&&!m.downlinkEnabled&&storageUsed(m)>0)m.stats.downlinkDisabledContactS+=h;
  if(!geometry.contact&&storageUsed(m)>0)m.stats.queuedWithoutContactS+=h;
  m.stats.payloadEnergyWh+=prepared.powerW*h/3600;
  if(f.status==='crashed') {m.status='failed';m.dwellS=0;record(m,f.timeS,'Mission failed after surface impact.');return;}
  if(prepared.camera&&f.batteryWh>0&&h>0) {
    m.dwellS+=h;
    if(m.dwellS+1e-8>=MISSION_CONFIG.dwellS) {
      const targetId=MISSION_CONFIG.targets[0].id;
      if(!m.observations.some(o=>o.qualifying&&o.targetId===targetId)&&storageUsed(m)+MISSION_CONFIG.observationSizeMB<=MISSION_CONFIG.storageCapacityMB+1e-9) {
        const collectionTime=Math.min(m.deadlineS,f.timeS-(m.dwellS-MISSION_CONFIG.dwellS));
        m.observations.push({id:`${targetId}:1`,targetId,collectedAtS:collectionTime,sizeMB:MISSION_CONFIG.observationSizeMB,remainingMB:MISSION_CONFIG.observationSizeMB,qualifying:true,deliverAtS:null});
        record(m,collectionTime,'Coastal observation collected: 16 MB stored onboard. Return it through a ground contact to earn science credit.');
      }
      m.dwellS=0;
    }
  } else if(m.dwellS>0) {m.stats.interruptedDwells++;m.dwellS=0;}
  if(prepared.downlink&&f.batteryWh>0&&h>0) {
    let bytesMB=MISSION_CONFIG.downlinkMbps*h/8;
    let usedS=0;
    for(const o of m.observations) {
      if(o.remainingMB<=0||bytesMB<=0)continue;
      const transfer=Math.min(bytesMB,o.remainingMB);
      o.remainingMB=Math.max(0,o.remainingMB-transfer);bytesMB-=transfer;usedS+=transfer*8/MISSION_CONFIG.downlinkMbps;
      if(o.remainingMB<1e-9) {o.remainingMB=0;o.deliverAtS=Math.min(m.deadlineS,start+usedS);record(m,o.deliverAtS,'Observation fully returned and acknowledged by Dawn Ground Station.');}
    }
  }
  if(completedCount(m)>=MISSION_CONFIG.requiredObservations) {m.status='success';record(m,Math.min(m.deadlineS,f.timeS),'Mission complete: one qualifying observation was fully returned before the deadline.');}
  else if(f.timeS>=m.deadlineS-1e-8) {m.status='failed';m.dwellS=0;record(m,m.deadlineS,'Mission deadline reached before a qualifying observation was fully returned.');}
}
export function endMission(m:MissionState,f:FlightState):void {
  if(m.status==='active'){m.status='ended';m.dwellS=0;record(m,f.timeS,'Mission ended early by the player.');}
}
export function missionTelemetry(m:MissionState,f:FlightState) {
  const a=activities(m,f),deliveredMB=m.observations.reduce((s,o)=>s+o.sizeMB-o.remainingMB,0);
  let message=m.status==='success'?'Observation returned. Mission complete.':m.status==='failed'?'Mission ended without the required returned observation.':m.status==='ended'?'Mission ended early.':m.safeMode?'Payload safe mode: wait for solar charging or revise the energy design.':!a.safeOrbit?'Establish a bound orbit with periapsis above 100 km.':!m.observations.length?'Waiting for a daylight pass over Equatorial Coast.':a.downlink?'Ground contact: returning stored scientific data.':!m.downlinkEnabled?'Downlink is disabled. Enable it before the next ground pass.':'Observation stored. Waiting for Dawn Ground Station contact.';
  return {contact:a.contact,observationWindow:a.observationWindow,sunlit:a.sunlit,storageMB:storageUsed(m),deliveredMB,progress:Math.min(1,completedCount(m)/MISSION_CONFIG.requiredObservations),nextEventS:m.status==='active'?m.deadlineS:null,nextEventKind:'deadline' as const,powerDrawW:a.powerW,message,safeMode:m.safeMode,dwellS:m.dwellS,completedObservations:completedCount(m),batteryCapacityWh:capacityWh(f)};
}
export function missionReport(m:MissionState,f:FlightState) {
  const t=missionTelemetry(m,f),causes:string[]=[],suggestions:string[]=[];
  if(m.status==='success'){causes.push('A five-second daylight coastal observation was stored, then completely acknowledged during a geometric ground contact.');suggestions.push('Compare a lighter design with a solar-equipped design using remaining propellant and battery energy.');}
  else {
    if(f.status==='crashed'){causes.push('The spacecraft intersected Earth before completing the mission.');suggestions.push('Revise ascent direction and burn timing, or use ascent assistance with the reference craft.');}
    if(!m.observations.length){
      if(m.stats.observationWindowS<5){causes.push('The flown trajectory did not provide five continuous seconds in a qualifying daylight target window.');suggestions.push('Establish a bound orbit above the atmosphere and coast until the target passes through the camera footprint.');}
      if(m.stats.cameraDisabledWindowS>0){causes.push('The camera was disabled during available observation time.');suggestions.push('Enable the camera before the target pass.');}
      if(m.stats.interruptedDwells>0){causes.push('An observation attempt was interrupted before five continuous seconds of collection.');suggestions.push('Keep the camera enabled and above its battery reserve throughout the target window.');}
      if(m.stats.storageBlockedS>0){causes.push('Insufficient free storage prevented a complete new observation.');suggestions.push('Downlink stored data before attempting another collection.');}
    } else if(t.progress<1) {
      causes.push(`${t.storageMB.toFixed(2)} MB remained onboard; collected or partially transmitted data does not complete the objective.`);
      if(m.stats.queuedWithoutContactS>0){causes.push('Queued data spent time outside ground-station line of sight.');suggestions.push('Preserve enough mission time to reach the ground station after observation.');}
      if(m.stats.downlinkDisabledContactS>0){causes.push('The radio was disabled during a contact while data was queued.');suggestions.push('Enable downlink before the next ground contact.');}
    }
    if(m.stats.energyBlockedS>0){causes.push('Battery reserve protection suspended the camera and radio.');suggestions.push('Retain solar generation or reduce powered activity before the observation and downlink windows.');}
    if(m.status==='ended')causes.push('The player ended the run before returned-data completion.');
    if(m.status==='failed'&&f.timeS>=m.deadlineS)causes.push('The two-hour deadline expired.');
    if(!causes.length)causes.push('The mission is still in progress.');
  }
  const completionTimeS=m.status==='success'?Math.min(...m.observations.filter(o=>o.qualifying&&o.deliverAtS!==null&&o.deliverAtS<=m.deadlineS+1e-7).map(o=>o.deliverAtS!)):null;
  return {status:m.status,summary:m.status==='success'?'Mission successful: one unique coastal observation was fully returned on time.':m.status==='active'?'Mission in progress: collect and return one coastal observation.':'Mission incomplete: the required observation was not fully returned on time.',causes,suggestions:[...new Set(suggestions)],metrics:{...t,elapsedS:(completionTimeS??Math.min(f.timeS,m.deadlineS))-m.startedAtS,completionTimeS,batteryWh:f.batteryWh,payloadEnergyWh:m.stats.payloadEnergyWh,observationsCollected:m.observations.length,observationsDelivered:completedCount(m),deadlineS:m.deadlineS,missionCostCredits:m.designCostCredits,budgetCredits:MISSION_CONFIG.budgetCredits},log:structuredClone(m.log)};
}

/** Strict save boundary. This validates state consistency, not historical anti-cheat proof. */
export function validateMission(value:unknown,flight?:FlightState|null):MissionState {
  const fail=(message:string):never=>{throw new Error(`Invalid mission save: ${message}`);};
  if(!value||typeof value!=='object'||Array.isArray(value))fail('expected an object.');
  const m=value as MissionState;
  const finite=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
  if(m.id!==MISSION_CONFIG.id||m.scenarioVersion!==MISSION_CONFIG.scenarioVersion)fail('unsupported scenario or scenario version.');
  if(!finite(m.startedAtS)||!finite(m.deadlineS)||Math.abs(m.deadlineS-m.startedAtS-MISSION_CONFIG.durationS)>1e-6||!finite(m.lastUpdatedAtS,m.startedAtS))fail('inconsistent mission clock or deadline.');
  if(!finite(m.designCostCredits,MISSION_CONFIG.fixedOperationsCostCredits,MISSION_CONFIG.budgetCredits))fail('design cost exceeds the mission budget or is invalid.');
  if(!['active','success','failed','ended'].includes(m.status))fail('unknown result status.');
  if(typeof m.cameraEnabled!=='boolean'||typeof m.downlinkEnabled!=='boolean'||typeof m.safeMode!=='boolean'||!finite(m.dwellS,0,MISSION_CONFIG.dwellS))fail('invalid controls or dwell.');
  if(!Array.isArray(m.observations)||m.observations.length>128)fail('invalid observation records.');
  const ids=new Set<string>(),qualifyingTargets=new Set<string>();
  for(const o of m.observations) {
    if(!o||typeof o!=='object'||typeof o.id!=='string'||o.id.length>100||ids.has(o.id)||!MISSION_CONFIG.targets.some(t=>t.id===o.targetId))fail('duplicate or unknown observation.');
    ids.add(o.id);
    if(typeof o.qualifying!=='boolean'||!finite(o.collectedAtS,m.startedAtS,Math.min(m.lastUpdatedAtS,m.deadlineS))||!finite(o.sizeMB,0.000001,MISSION_CONFIG.storageCapacityMB)||!finite(o.remainingMB,0,o.sizeMB))fail('invalid observation quantities.');
    if(o.qualifying){if(o.sizeMB!==MISSION_CONFIG.observationSizeMB||qualifyingTargets.has(o.targetId))fail('duplicate science credit or incorrect observation size.');qualifyingTargets.add(o.targetId);}
    if(o.deliverAtS!==null&&!finite(o.deliverAtS,o.collectedAtS,Math.min(m.lastUpdatedAtS,m.deadlineS)))fail('invalid acknowledgement time.');
    if((o.remainingMB===0)!==(o.deliverAtS!==null))fail('acknowledgement and remaining bytes disagree.');
  }
  if(storageUsed(m)>MISSION_CONFIG.storageCapacityMB+1e-8)fail('storage capacity exceeded.');
  const keys:(keyof MissionStats)[]=['observationWindowS','contactS','energyBlockedS','storageBlockedS','cameraDisabledWindowS','downlinkDisabledContactS','queuedWithoutContactS','interruptedDwells','payloadEnergyWh','minimumBatteryWh'];
  if(!m.stats||typeof m.stats!=='object'||keys.some(k=>!finite(m.stats[k])))fail('invalid mission counters.');
  if(!Number.isInteger(m.stats.interruptedDwells))fail('fractional dwell interruption count.');
  const elapsed=m.lastUpdatedAtS-m.startedAtS;
  const durationKeys:(keyof MissionStats)[]=['observationWindowS','contactS','energyBlockedS','storageBlockedS','cameraDisabledWindowS','downlinkDisabledContactS','queuedWithoutContactS'];
  if(durationKeys.some(k=>m.stats[k]>elapsed+1e-6)||m.stats.payloadEnergyWh>(MISSION_CONFIG.cameraPowerW+MISSION_CONFIG.radioPowerW)*elapsed/3600+1e-7)fail('mission counters exceed elapsed time or available power.');
  if(!Array.isArray(m.log)||m.log.length>64||m.log.some(e=>!e||!finite(e.timeS,m.startedAtS,m.lastUpdatedAtS+1e-6)||typeof e.message!=='string'||e.message.length>500))fail('invalid event log.');
  if(m.prepared!==null)fail('save only after completing the mission step.');
  const complete=completedCount(m)>=MISSION_CONFIG.requiredObservations;
  if((m.status==='success')!==complete)fail('science records and result disagree.');
  if(m.status==='active'&&m.lastUpdatedAtS>=m.deadlineS-1e-8)fail('active mission has passed its deadline.');
  if(flight){
    if(Math.abs(flight.timeS-m.lastUpdatedAtS)>1e-6)fail('flight and mission clocks differ.');
    if(m.stats.minimumBatteryWh>capacityWh(flight)+1e-6||m.stats.minimumBatteryWh>flight.batteryWh+1e-6)fail('minimum battery counter exceeds installed or current energy.');
    if(m.status==='active'&&flight.status==='crashed')fail('crashed flight cannot have an active mission.');
  }
  return structuredClone(m);
}

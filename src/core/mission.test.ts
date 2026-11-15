import assert from 'node:assert/strict';
import test from 'node:test';
import { createFlight, stepFlight, telemetry } from './dynamics.ts';
import type { FlightState } from './dynamics.ts';
import { EARTH } from './orbit.ts';
import { SAMPLE_CRAFT, SAMPLE_CONNECTIONS } from '../data/parts.ts';
import { createMission,missionPower,stepMission,missionTelemetry,missionReport,validateMission,missionGeometry,surfacePoint,MISSION_CONFIG } from './mission.ts';
import type { MissionState } from './mission.ts';

function flightFixture(solar=true):FlightState {
  return createFlight({id:'reference',parts:SAMPLE_CRAFT.filter(p=>solar||p.definitionId!=='solar'),connections:SAMPLE_CONNECTIONS.filter(c=>solar||(c.a.partId!=='solar-1'&&c.b.partId!=='solar-1'))});
}
function orbitalFixture(longitudeRad:number,timeS=0):FlightState {
  const f=flightFixture(false),surface=surfacePoint(longitudeRad,timeS),r=EARTH.radiusM+400000,v=Math.sqrt(EARTH.gravitationalParameterM3S2/r);
  f.timeS=timeS;f.positionM={x:surface.x*r/EARTH.radiusM,y:surface.y*r/EARTH.radiusM};
  f.velocityMPerS={x:-f.positionM.y/r*v,y:f.positionM.x/r*v};f.status='flying';f.launched=true;f.attitudeHold=false;
  return f;
}
function run(m:MissionState,f:FlightState,durationS:number,batchS=.02):void {
  const end=f.timeS+durationS;
  while(f.timeS<end-1e-7){
    const batchEnd=Math.min(end,f.timeS+batchS);
    while(f.timeS<batchEnd-1e-8){const dt=Math.min(.02,batchEnd-f.timeS);f.payloadPowerW=missionPower(m,f);stepFlight(f,dt);stepMission(m,f,dt);}
  }
}
function queued(m:MissionState,size=16):void {
  m.observations.push({id:'coast-01:1',targetId:'coast-01',collectedAtS:0,sizeMB:16,remainingMB:size,qualifying:true,deliverAtS:null});
}
test('geometry requires daylight target footprint and a bound above-atmosphere orbit',()=>{
  const f=orbitalFixture(MISSION_CONFIG.targets[0].longitudeRad),m=createMission(f);
  assert.equal(missionGeometry(f).observationWindow,true);
  run(m,f,5.1);
  assert.equal(m.observations.length,1);assert.equal(m.observations[0].remainingMB,16);assert.equal(m.status,'active');
  const dark=orbitalFixture(Math.PI),dm=createMission(dark);run(dm,dark,6);
  assert.equal(dm.observations.length,0);
  const escape=orbitalFixture(MISSION_CONFIG.targets[0].longitudeRad);escape.velocityMPerS.x*=2;escape.velocityMPerS.y*=2;
  assert.equal(missionGeometry(escape).observationWindow,false);
});
test('without contact no data transfers, and a geometric contact fully returns data',()=>{
  const f=orbitalFixture(MISSION_CONFIG.targets[0].longitudeRad),m=createMission(f);queued(m);
  assert.equal(missionGeometry(f).contact,false);run(m,f,1);
  assert.equal(m.observations[0].remainingMB,16);
  const contact=orbitalFixture(MISSION_CONFIG.stations[0].longitudeRad),cm=createMission(contact);queued(cm);
  assert.equal(missionGeometry(contact).contact,true);run(cm,contact,128.1);
  assert.equal(cm.observations[0].remainingMB,0);assert.ok(Math.abs(cm.observations[0].deliverAtS!-128)<.02001);assert.equal(cm.status,'success');
  const frozen=structuredClone(cm.observations);run(cm,contact,1);assert.deepEqual(cm.observations,frozen);
});
test('camera and radio disable commands prevent their activities',()=>{
  const f=orbitalFixture(MISSION_CONFIG.targets[0].longitudeRad),m=createMission(f);m.cameraEnabled=false;
  run(m,f,6);assert.equal(m.observations.length,0);assert.ok(m.stats.cameraDisabledWindowS>5);
  const contact=orbitalFixture(MISSION_CONFIG.stations[0].longitudeRad),cm=createMission(contact);queued(cm);cm.downlinkEnabled=false;
  run(cm,contact,1);assert.equal(cm.observations[0].remainingMB,16);assert.ok(cm.stats.downlinkDisabledContactS>.9);
});
test('payload power is debited once and reserve hysteresis suspends payload operation',()=>{
  const f=orbitalFixture(MISSION_CONFIG.targets[0].longitudeRad),m=createMission(f);
  run(m,f,1);
  assert.ok(Math.abs(f.batteryWh-(400-100/3600))<1e-8); // 40 W bus + 60 W camera
  assert.ok(Math.abs(m.stats.payloadEnergyWh-60/3600)<1e-10);
  f.batteryWh=80;assert.equal(missionPower(m,f),0);assert.equal(m.safeMode,true);
  f.batteryWh=119;assert.equal(missionPower(m,f),0);assert.equal(m.safeMode,true);
  f.batteryWh=120;assert.equal(missionPower(m,f),60);assert.equal(m.safeMode,false);
  f.batteryWh=0;assert.equal(missionPower(m,f),0);assert.equal(m.safeMode,true);
});
test('a full buffer skips collection without overwriting and interrupted dwells earn no data',()=>{
  const f=orbitalFixture(MISSION_CONFIG.targets[0].longitudeRad),m=createMission(f);
  // Artificial unit fixture: pre-existing nonqualifying bytes occupy the buffer.
  m.observations.push({id:'old-data',targetId:'coast-01',collectedAtS:0,sizeMB:32,remainingMB:32,qualifying:false,deliverAtS:null});
  run(m,f,6);assert.equal(m.observations.length,1);assert.equal(m.observations[0].remainingMB,32);assert.ok(m.stats.storageBlockedS>5);
  const partial=orbitalFixture(MISSION_CONFIG.targets[0].longitudeRad),pm=createMission(partial);run(pm,partial,2);pm.cameraEnabled=false;run(pm,partial,.02);
  assert.equal(pm.observations.length,0);assert.equal(pm.dwellS,0);assert.equal(pm.stats.interruptedDwells,1);
});
test('repeated target passes cannot collect duplicate qualifying observations',()=>{
  const f=orbitalFixture(MISSION_CONFIG.targets[0].longitudeRad),m=createMission(f);run(m,f,12);
  assert.equal(m.observations.length,1);assert.equal(m.observations[0].sizeMB,16);assert.equal(missionTelemetry(m,f).progress,0);
  const duplicate=structuredClone(m);duplicate.observations.push({...duplicate.observations[0],id:'duplicate'});
  assert.throws(()=>validateMission(duplicate,f),/duplicate science credit/);
});
test('delivery exactly at the deadline qualifies; a remaining byte fraction does not',()=>{
  const base=flightFixture(false),m=createMission(base),f=orbitalFixture(MISSION_CONFIG.stations[0].longitudeRad,7199.98);
  m.lastUpdatedAtS=f.timeS;queued(m,.0025);m.observations[0].collectedAtS=6000;
  run(m,f,.02);assert.equal(m.status,'success');assert.equal(m.observations[0].deliverAtS,7200);validateMission(m,f);
  const late=createMission(base),lf=orbitalFixture(MISSION_CONFIG.stations[0].longitudeRad,7199.98);
  late.lastUpdatedAtS=lf.timeS;queued(late,.002625);late.observations[0].collectedAtS=6000;
  run(late,lf,.02);assert.equal(late.status,'failed');assert.ok(late.observations[0].remainingMB>0);assert.equal(late.observations[0].deliverAtS,null);
  run(late,lf,.1);assert.equal(late.status,'failed');assert.equal(missionTelemetry(late,lf).progress,0);
});
test('strict save validation rejects impossible quantities and immutable result inconsistencies',()=>{
  const f=orbitalFixture(MISSION_CONFIG.targets[0].longitudeRad),m=createMission(f);run(m,f,6);
  assert.deepEqual(validateMission(JSON.parse(JSON.stringify(m)),f),m);
  const bad=structuredClone(m);bad.observations[0].remainingMB=-1;assert.throws(()=>validateMission(bad,f),/quantities/);
  const result=structuredClone(m);result.status='success';assert.throws(()=>validateMission(result,f),/result disagree/);
  const clock=structuredClone(m);clock.deadlineS++;assert.throws(()=>validateMission(clock,f),/clock/);
  const cost=structuredClone(m);cost.designCostCredits=6501;assert.throws(()=>validateMission(cost,f),/budget/);
  const prepared=structuredClone(m);prepared.prepared={timeS:f.timeS,camera:true,downlink:false,powerW:60};assert.throws(()=>validateMission(prepared,f),/completing/);
  const counters=structuredClone(m);counters.stats.contactS=1000;assert.throws(()=>validateMission(counters,f),/counters exceed/);
});
test('initial design expenditure remains fixed after fuel is burned',()=>{
  const f=flightFixture(),m=createMission(f);f.throttle=1;run(m,f,10);
  assert.equal(m.designCostCredits,5870);assert.equal(missionReport(m,f).metrics.missionCostCredits,5870);
  const expensive=flightFixture();expensive.assembly.parts.push({...structuredClone(SAMPLE_CRAFT[1]),id:'extra-tank',positionM:{x:0,y:10}});
  assert.throws(()=>createMission(expensive),/budget/);
});
test('save roundtrip and time-warp batching preserve subsequent mission bytes and energy',()=>{
  const f=orbitalFixture(MISSION_CONFIG.stations[0].longitudeRad),m=createMission(f);queued(m);run(m,f,5);
  const restoredFlight=JSON.parse(JSON.stringify(f)) as FlightState;
  const restored=validateMission(JSON.parse(JSON.stringify(m)),restoredFlight);
  run(m,f,10,.02);run(restored,restoredFlight,10,2);
  assert.ok(Math.abs(m.observations[0].remainingMB-restored.observations[0].remainingMB)<1e-8);
  assert.ok(Math.abs(f.batteryWh-restoredFlight.batteryWh)<1e-8);assert.equal(m.status,restored.status);
});
test('two budgeted designs complete a naturally geometric surface-to-returned-data mission',()=>{
  const results=[];
  for(const solar of [true,false]){
    const f=flightFixture(solar);f.assistance=true;const m=createMission(f);
    for(let i=0;m.status==='active'&&i<360001;i++){f.payloadPowerW=missionPower(m,f);stepFlight(f,.02);stepMission(m,f,.02);}
    assert.equal(m.status,'success',JSON.stringify(missionReport(m,f)));
    assert.equal(missionTelemetry(m,f).deliveredMB,16);assert.ok(f.timeS<7200);
    assert.ok(telemetry(f).periapsisM!>100000);assert.ok(m.designCostCredits<=6500);
    validateMission(JSON.parse(JSON.stringify(m)),f);
    results.push({solar,completedAtS:f.timeS,batteryWh:f.batteryWh,fuelKg:telemetry(f).propellantKg,cost:m.designCostCredits});
  }
  assert.equal(results[0].cost,5870);assert.equal(results[1].cost,5420);
  assert.ok(results[0].batteryWh>results[1].batteryWh+40);
  assert.ok(results[1].fuelKg>results[0].fuelKg+100);
});

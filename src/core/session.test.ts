import assert from 'node:assert/strict';
import test from 'node:test';
import { SAMPLE_CRAFT,SAMPLE_CONNECTIONS,CATALOGUE_VERSION } from '../data/parts.ts';
import type { VehicleAssembly } from './types.ts';
import { createFlight,advanceFlight } from './dynamics.ts';
import { decodeSession,encodeSession } from './session.ts';
import type { SessionInput } from './session.ts';
import { removePart } from './builder.ts';
import { createMission,missionPower,stepMission } from './mission.ts';

function craft():VehicleAssembly{return structuredClone({id:'pathfinder',parts:SAMPLE_CRAFT,connections:SAMPLE_CONNECTIONS});}
function input(withFlight=false):SessionInput{const design=craft();return {craft:design,flight:withFlight?createFlight(design):null,mission:null,view:withFlight?'flight':'assembly',settings:{zoom:1,flightZoom:1,orbitZoom:1}};}
const mutate=(change:(save:Record<string,any>)=>void)=>{const save=JSON.parse(encodeSession(input(true)));change(save);return JSON.stringify(save);};

test('session JSON roundtrip preserves assembly, flight resource state and settings without mutation',()=>{
  const source=input(true);source.flight!.throttle=1;advanceFlight(source.flight!,2);
  const before=structuredClone(source),encoded=encodeSession(source),loaded=decodeSession(encoded);
  assert.equal(loaded.schemaVersion,2);assert.equal(loaded.catalogueVersion,CATALOGUE_VERSION);
  assert.deepEqual(loaded.craft,source.craft);assert.deepEqual(loaded.flight,source.flight);assert.deepEqual(loaded.settings,source.settings);
  assert.equal(loaded.mission,null);assert.deepEqual(source,before);
});

test('incomplete and empty builder designs save, while a disconnected flight does not',()=>{
  const source=input();source.craft=removePart(source.craft,'tank-1');
  assert.equal(decodeSession(encodeSession(source)).craft.parts.length,3);
  source.craft={id:'empty',parts:[],connections:[]};assert.deepEqual(decodeSession(encodeSession(source)).craft.parts,[]);
  assert.throws(()=>decodeSession(mutate(save=>{save.flight.assembly.connections=[];})),/connected assembly/i);
});

test('malformed JSON, unsupported schema and obsolete catalogue produce readable errors',()=>{
  assert.throws(()=>decodeSession('<html>not a save</html>'),/not valid JSON/);
  assert.throws(()=>decodeSession('null'),/Session must be an object/);
  assert.throws(()=>decodeSession(mutate(save=>{save.schemaVersion=1;})),/requires version 2/);
  assert.throws(()=>decodeSession(mutate(save=>{save.catalogueVersion='obsolete';})),/catalogue version differs/);
  assert.throws(()=>decodeSession(' '.repeat(2_000_001)),/supported size/);
});

test('nonfinite, negative and out-of-capacity resources cannot be encoded or imported',()=>{
  const source=input(true);source.flight!.velocityMPerS.x=Infinity;assert.throws(()=>encodeSession(source),/finite/);
  for(const change of [
    (s:any)=>s.craft.parts[1].propellantKg=-1,
    (s:any)=>s.flight.assembly.parts[1].propellantKg=26001,
    (s:any)=>s.flight.batteryWh=-1,
    (s:any)=>s.flight.batteryWh=401,
    (s:any)=>s.flight.throttle=1.1,
    (s:any)=>s.settings.orbitZoom=0,
    (s:any)=>s.flight.timeS=-1,
  ])assert.throws(()=>decodeSession(mutate(change)),/Cannot restore session/);
});

test('unknown components, duplicate IDs, dangling nodes, cycles and overlaps are rejected',()=>{
  for(const change of [
    (s:any)=>s.craft.parts[0].definitionId='invented',
    (s:any)=>s.craft.parts[1].id=s.craft.parts[0].id,
    (s:any)=>s.craft.connections[0].a.nodeId='missing',
    (s:any)=>s.craft.connections.push(s.craft.connections[0]),
    (s:any)=>{s.craft.connections=[];s.craft.parts[0].positionM={...s.craft.parts[1].positionM};},
  ])assert.throws(()=>decodeSession(mutate(change)),/Cannot restore session/);
});

test('flight identity, geometry and status must remain consistent with the editor design',()=>{
  for(const change of [
    (s:any)=>s.flight.assembly.parts[0].id='not-the-same-command',
    (s:any)=>s.flight.status='teleported',
    (s:any)=>s.flight.launched=true,
    (s:any)=>s.flight.positionM={x:0,y:1},
    (s:any)=>s.flight.positionM={x:0,y:7000000},
    (s:any)=>{s.craft.parts[1].propellantKg=0;},
  ])assert.throws(()=>decodeSession(mutate(change)),/Cannot restore session/);
});

test('fuel exhaustion is a valid resumable flight state',()=>{
  const source=input(true);source.flight!.assembly.parts.find(p=>p.definitionId==='tank')!.propellantKg=0;
  assert.equal(decodeSession(encodeSession(source)).flight!.assembly.parts.find(p=>p.definitionId==='tank')!.propellantKg,0);
});

test('timestamps must be valid ISO dates and cannot be impossibly far in the future',()=>{
  assert.throws(()=>decodeSession(mutate(s=>{s.savedAt='not-a-date';})),/timestamp/);
  assert.throws(()=>decodeSession(mutate(s=>{s.savedAt='2099-01-01T00:00:00.000Z';})),/future/);
});

test('view consistency and supported zoom extrema survive validation',()=>{
  const source=input();source.settings={zoom:.2,flightZoom:8,orbitZoom:8};assert.deepEqual(decodeSession(encodeSession(source)).settings,source.settings);
  source.view='mission';assert.equal(decodeSession(encodeSession(source)).mission,null,'planning brief can precede flight');
  assert.throws(()=>decodeSession(mutate(s=>{s.flight=null;s.view='flight';})),/require a saved flight/);
  assert.throws(()=>decodeSession(mutate(s=>{s.view='unrecognized';})),/Unknown studio view/);
});

test('mission session roundtrip preserves synchronized clock and completed-step resource ledger',()=>{
  const source=input(true);source.mission=createMission(source.flight!);source.view='mission';
  source.flight!.payloadPowerW=missionPower(source.mission,source.flight!);
  advanceFlight(source.flight!,.02);stepMission(source.mission,source.flight!,.02);
  const restored=decodeSession(encodeSession(source));
  assert.deepEqual(restored.mission,source.mission);assert.equal(restored.flight!.timeS,restored.mission!.lastUpdatedAtS);
});

test('mission imports reject missing flight, mismatched clock and half-completed power preparation',()=>{
  const source=input(true);source.mission=createMission(source.flight!);source.view='mission';
  const saved=JSON.parse(encodeSession(source));
  saved.flight=null;assert.throws(()=>decodeSession(JSON.stringify(saved)),/requires its saved flight/);
  const wrongClock=JSON.parse(encodeSession(source));wrongClock.mission.lastUpdatedAtS=1;assert.throws(()=>decodeSession(JSON.stringify(wrongClock)),/clocks differ/);
  const wrongCost=JSON.parse(encodeSession(source));wrongCost.mission.designCostCredits-=100;assert.throws(()=>decodeSession(JSON.stringify(wrongCost)),/Mission cost differs/);
  missionPower(source.mission,source.flight!);assert.throws(()=>encodeSession(source),/completing the mission step/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { PARTS, SAMPLE_CRAFT, SAMPLE_CONNECTIONS, getPart } from '../data/parts.ts';
import type { VehicleAssembly, PartInstance } from './types.ts';
import { connectorsCompatible, connectedTankIds, validateAssembly } from './assembly.ts';
import { addPart, autoAttach, createEmptyAssembly, getSnapCandidates, movePart, readiness, removePart, rotatePart } from './builder.ts';

const reference = (): VehicleAssembly => structuredClone({ id:'test-craft',parts:SAMPLE_CRAFT,connections:SAMPLE_CONNECTIONS });
const newTank = (positionM={x:0,y:-3.8}): PartInstance => ({id:'tank-1',definitionId:'tank',positionM,angleRad:0,propellantKg:26000});

test('snap aligns a compatible tank with the command bottom without mutating inputs',()=>{
  const assembly=createEmptyAssembly(), before=structuredClone(assembly);
  const result=addPart(assembly,'tank',{x:.3,y:-3.7});
  assert.ok(result.assembly,result.message);
  assert.deepEqual(assembly,before);
  const tank=result.assembly.parts.find(p=>p.definitionId==='tank')!;
  assert.ok(Math.abs(tank.positionM.x)<1e-12);
  assert.ok(Math.abs(tank.positionM.y+3.8)<1e-12);
  assert.deepEqual(validateAssembly(result.assembly.parts,result.assembly.connections,PARTS),[]);
});

test('typed roles, connector sizes and facing reject mechanically wrong arrangements',()=>{
  const tank=getPart('tank')!, command=getPart('command')!, engine=getPart('engine')!;
  assert.equal(connectorsCompatible(command,command.connectors[0],tank,tank.connectors[0]),true);
  assert.equal(connectorsCompatible(engine,engine.connectors[0],tank,tank.connectors[0]),false,'engine must feed from tank bottom');
  assert.equal(connectorsCompatible(command,{...command.connectors[0],sizeM:1.2},tank,tank.connectors[0]),false);
  const reversed={...newTank(),angleRad:Math.PI};
  assert.equal(getSnapCandidates(createEmptyAssembly(),reversed,20).length,0);
});

test('snapping rejects occupied target nodes and overlapping candidate envelopes',()=>{
  const craft=reference();
  const anotherEngine:PartInstance={id:'engine-2',definitionId:'engine',positionM:{x:0,y:-3.7},angleRad:0};
  assert.equal(getSnapCandidates(craft,anotherEngine,Infinity).length,0);
  const assembly=createEmptyAssembly();
  assembly.parts.push({id:'obstacle',definitionId:'engine',positionM:{x:0,y:-3.8},angleRad:0});
  assert.equal(getSnapCandidates(assembly,newTank(),1.3).length,0);
  assert.equal(addPart(createEmptyAssembly(),'tank',{x:100,y:100}).assembly,null);
});

test('keyboard attachment is deterministic and rejects unavailable compatible connectors',()=>{
  const start=createEmptyAssembly();
  const a=autoAttach(start,'tank'),b=autoAttach(start,'tank');
  assert.ok(a.assembly); assert.deepEqual(a,b);
  const engine=autoAttach(a.assembly,'engine');assert.ok(engine.assembly);
  assert.equal(autoAttach(engine.assembly,'engine').assembly,null);
  const solar=autoAttach(engine.assembly,'solar');assert.ok(solar.assembly);
  assert.equal(readiness(solar.assembly).blockers.length,0);
});

test('removal leaves dependent parts visible and disconnected; prior snapshot can restore exactly',()=>{
  const original=reference(), snapshot=structuredClone(original);
  const result=removePart(original,'tank-1');
  assert.equal(result.parts.length,3);
  assert.ok(result.parts.some(p=>p.id==='engine-1'));
  assert.ok(readiness(result).blockers.some(i=>i.code==='disconnected'));
  assert.ok(readiness(result).blockers.some(i=>i.code==='unfed-engine'));
  assert.deepEqual(original,snapshot);
  assert.equal(readiness(snapshot).blockers.length,0);
});

test('removing the command allows keyboard reconnecting a replacement command',()=>{
  const without=removePart(reference(),'command-1');
  assert.ok(readiness(without).blockers.some(i=>i.code==='command-count'));
  const result=autoAttach(without,'command'); assert.ok(result.assembly,result.message);
  assert.equal(readiness(result.assembly).blockers.length,0);
});

test('dragging an attached tank preserves its engine and solar subtree and valid connections',()=>{
  const craft=reference(),before=structuredClone(craft);
  const result=movePart(craft,'tank-1',{x:.4,y:.2}); assert.ok(result.assembly,result.message);
  assert.deepEqual(result.assembly.parts,craft.parts,'nearby reconnect returns same valid stack');
  assert.equal(readiness(result.assembly).blockers.length,0);
  assert.deepEqual(craft,before);
  assert.equal(movePart(craft,'tank-1',{x:100,y:0}).assembly,null);
  assert.deepEqual(craft,before,'failed move has no partial mutations');
});

test('moving command root translates connected assembly without distorting mass geometry',()=>{
  const craft=reference(),result=movePart(craft,'command-1',{x:10,y:13.8});assert.ok(result.assembly);
  for(const part of craft.parts){const p=result.assembly.parts.find(p=>p.id===part.id)!;assert.equal(p.positionM.x,part.positionM.x+10);assert.equal(p.positionM.y,part.positionM.y+10);}
  assert.equal(readiness(result.assembly).blockers.length,0);
});

test('engine feed traverses multiple connected tanks and excludes disconnected fuel',()=>{
  let craft=createEmptyAssembly();
  for(const id of ['tank','tank','engine']){const result=autoAttach(craft,id);assert.ok(result.assembly,result.message);craft=result.assembly;}
  const engine=craft.parts.find(p=>p.definitionId==='engine')!;
  assert.deepEqual(connectedTankIds(craft,engine.id).sort(),['tank-1','tank-2']);
  const ready=readiness(craft);
  assert.equal(ready.blockers.length,0);assert.equal(ready.metrics.propellantKg,52000);assert.ok(ready.metrics.deltaVMPerS>0);assert.ok(ready.warnings.some(i=>i.code==='low-twr'));
  const broken=structuredClone(craft);broken.connections=broken.connections.filter(c=>!(c.a.partId==='tank-1'&&c.b.partId==='tank-2')&&!(c.a.partId==='tank-2'&&c.b.partId==='tank-1'));
  assert.deepEqual(connectedTankIds(broken,engine.id),['tank-2']);
});

test('readiness reports exhaust obstruction separately from structural overlap',()=>{
  const craft=reference();
  craft.parts.push({id:'loose-solar',definitionId:'solar',positionM:{x:0,y:-6.5},angleRad:0});
  assert.ok(readiness(craft).blockers.some(i=>i.code==='blocked-exhaust'));
  assert.ok(!validateAssembly(craft.parts,craft.connections,PARTS).some(i=>i.code==='overlap'));
});

test('invalid propellant and zero fuel block launch without throwing on readiness',()=>{
  const empty=reference();empty.parts.find(p=>p.definitionId==='tank')!.propellantKg=0;
  assert.ok(readiness(empty).blockers.some(i=>i.code==='empty-propellant'));
  const invalid=reference();invalid.parts.find(p=>p.definitionId==='tank')!.propellantKg=-1;
  assert.ok(readiness(invalid).blockers.some(i=>i.code==='invalid-propellant'));
});

test('solar drag snaps to left mount with automatic half-turn and preserves angle when moved',()=>{
  const base=removePart(reference(),'solar-1'),before=structuredClone(base);
  const left=addPart(base,'solar',{x:-2.8,y:.15});assert.ok(left.assembly,left.message);
  const array=left.assembly.parts.find(p=>p.definitionId==='solar')!;
  assert.ok(Math.abs(array.positionM.x+2.8)<1e-10);assert.ok(Math.abs(array.angleRad-Math.PI)<1e-10);
  assert.equal(readiness(left.assembly).blockers.length,0);assert.deepEqual(base,before);
  const moved=movePart(left.assembly,array.id,{x:2.8,y:0});assert.ok(moved.assembly,moved.message);
  const after=moved.assembly.parts.find(p=>p.id===array.id)!;
  assert.ok(Math.abs(Math.sin(after.angleRad))<1e-10&&Math.cos(after.angleRad)>.99999);
  assert.ok(Math.abs(after.positionM.x-2.8)<1e-10);
});

test('two solar arrays attach symmetrically and eliminate lateral centre-of-mass offset',()=>{
  const result=autoAttach(reference(),'solar');assert.ok(result.assembly,result.message);
  const arrays=result.assembly.parts.filter(p=>p.definitionId==='solar');assert.equal(arrays.length,2);
  assert.ok(Math.abs(arrays[0].positionM.x+arrays[1].positionM.x)<1e-10);
  assert.ok(Math.abs(readiness(result.assembly).metrics.centreOfMassM.x)<1e-12);
  assert.equal(readiness(result.assembly).blockers.length,0);
  assert.equal(autoAttach(result.assembly,'solar').assembly,null,'both equipment mounts occupied');
});

test('flip-side keeps identity and snapshots immutable, rejects occupied opposite mount',()=>{
  const original=reference(),snapshot=structuredClone(original);
  const flipped=rotatePart(original,'solar-1');assert.ok(flipped.assembly,flipped.message);
  assert.ok(flipped.assembly.parts.find(p=>p.id==='solar-1')!.positionM.x<0);
  assert.deepEqual(original,snapshot);assert.equal(readiness(flipped.assembly).blockers.length,0);
  const back=rotatePart(flipped.assembly,'solar-1');assert.ok(back.assembly);
  assert.ok(back.assembly.parts.find(p=>p.id==='solar-1')!.positionM.x>0);
  const both=autoAttach(original,'solar');assert.ok(both.assembly);
  assert.equal(rotatePart(both.assembly,'solar-1').assembly,null);
  assert.equal(rotatePart(original,'tank-1').assembly,null);
});

test('solar left-side snap rejects collision and does not modify existing assembly',()=>{
  const original=reference();
  original.parts.push({id:'blocking-array',definitionId:'solar',positionM:{x:-2.8,y:0},angleRad:Math.PI});
  const snapshot=structuredClone(original);
  assert.equal(addPart(original,'solar',{x:-2.8,y:0}).assembly,null);
  assert.equal(rotatePart(original,'solar-1').assembly,null);
  assert.deepEqual(original,snapshot);
});

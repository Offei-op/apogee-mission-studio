import type { AssemblyConnection, PartInstance, VehicleAssembly, Vec2 } from './types.ts';
import { PARTS, getPart } from '../data/parts.ts';
import { connectorsCompatible, connectedTankIds, massProperties, validateAssembly } from './assembly.ts';
import type { AssemblyIssue, MassProperties } from './assembly.ts';
import { collisionCorners, rectanglesOverlap, rotate, worldNode, worldPoint } from './geometry.ts';

export interface BuildResult { assembly: VehicleAssembly | null; message: string }
export interface SnapCandidate { part: PartInstance; connection: AssemblyConnection; distanceM: number }
const nodeKey = (partId: string, nodeId: string) => `${partId}/${nodeId}`;
const clone = (assembly: VehicleAssembly): VehicleAssembly => structuredClone(assembly);

export function createEmptyAssembly(): VehicleAssembly {
  return { id: 'vehicle-1', parts: [{ id: 'command-1', definitionId: 'command', positionM: { x: 0, y: 0 }, angleRad: 0 }], connections: [] };
}

/** Solar mounts automatically orient toward the chosen equipment connector. */
export function getSnapCandidates(assembly: VehicleAssembly, moving: PartInstance, thresholdM = 1.3): SnapCandidate[] {
  const definition = getPart(moving.definitionId);
  if (!definition || !Number.isFinite(moving.positionM.x) || !Number.isFinite(moving.positionM.y) || thresholdM < 0) return [];
  const connections = assembly.connections.filter(c => c.a.partId !== moving.id && c.b.partId !== moving.id);
  const occupied = new Set(connections.flatMap(c => [nodeKey(c.a.partId,c.a.nodeId), nodeKey(c.b.partId,c.b.nodeId)]));
  const candidates: SnapCandidate[] = [];
  for (const target of assembly.parts) {
    if (target.id === moving.id) continue;
    const td = getPart(target.definitionId); if (!td) continue;
    const angles = definition.category === 'solar' ? [moving.angleRad,moving.angleRad+Math.PI/2,moving.angleRad+Math.PI,moving.angleRad-Math.PI/2] : [moving.angleRad];
    for (const angleRad of angles) for (const ownNode of definition.connectors) for (const targetNode of td.connectors) {
      if (occupied.has(nodeKey(target.id,targetNode.id)) || !connectorsCompatible(definition,ownNode,td,targetNode)) continue;
      const oriented = {...moving,angleRad};
      const from = worldNode(oriented, ownNode), to = worldNode(target,targetNode);
      if (from.normal.x*to.normal.x + from.normal.y*to.normal.y > -0.99999) continue;
      const distanceM = Math.hypot(from.positionM.x-to.positionM.x,from.positionM.y-to.positionM.y);
      if (distanceM > thresholdM) continue;
      const part = { ...oriented, positionM: { x: moving.positionM.x+to.positionM.x-from.positionM.x, y: moving.positionM.y+to.positionM.y-from.positionM.y } };
      const blocked = assembly.parts.some(other => { const od = getPart(other.definitionId); return other.id !== moving.id && od && rectanglesOverlap(collisionCorners(part,definition),collisionCorners(other,od)); });
      if (blocked) continue;
      const connection = { a: { partId: moving.id, nodeId: ownNode.id }, b: { partId: target.id, nodeId: targetNode.id } };
      const proposed = {...assembly,parts:[...assembly.parts.filter(p=>p.id!==moving.id),part],connections:[...connections,connection]};
      if (exhaustIssues(proposed).length) continue;
      candidates.push({ part, connection, distanceM });
    }
  }
  return candidates.sort((a,b) => a.distanceM-b.distanceM);
}

function exhaustIssues(assembly: VehicleAssembly): AssemblyIssue[] {
  const issues: AssemblyIssue[] = [];
  for (const engine of assembly.parts) {
    const d = getPart(engine.definitionId); if (!d || d.category !== 'engine') continue;
    const origin = worldPoint(engine,d.engine.exhaustOriginM), direction = rotate(d.engine.exhaustDirection,engine.angleRad);
    const halfWidth = d.widthM*0.25, length = d.engine.exhaustClearanceM;
    const point = (along: number, side: number) => ({ x: origin.x+direction.x*along-direction.y*side, y: origin.y+direction.y*along+direction.x*side });
    const corridor = [point(0,-halfWidth),point(0,halfWidth),point(length,halfWidth),point(length,-halfWidth)];
    for (const part of assembly.parts) {
      const pd = getPart(part.definitionId);
      if (part.id !== engine.id && pd && rectanglesOverlap(corridor,collisionCorners(part,pd))) issues.push({ code: 'blocked-exhaust', message: 'A component blocks the engine exhaust clearance.', partIds: [engine.id,part.id] });
    }
  }
  return issues;
}

function placementIssue(assembly: VehicleAssembly): AssemblyIssue | undefined {
  const physicalCodes = new Set(['overlap','incompatible-connection','occupied-node','attachment-cycle','invalid-transform','invalid-connection','unknown-part','duplicate-id']);
  return validateAssembly(assembly.parts,assembly.connections,PARTS).find(i => physicalCodes.has(i.code)) ?? exhaustIssues(assembly)[0];
}

function nextPart(definitionId: string, assembly: VehicleAssembly, positionM: Vec2): PartInstance | undefined {
  const definition = getPart(definitionId); if (!definition) return undefined;
  let serial = 1; while (assembly.parts.some(p => p.id === `${definitionId}-${serial}`)) serial++;
  return { id: `${definitionId}-${serial}`, definitionId, positionM: { ...positionM }, angleRad: 0, ...(definition.category === 'tank' ? { propellantKg: definition.tank.capacityKg } : {}) };
}

function addAtCandidate(assembly: VehicleAssembly, candidate: SnapCandidate): BuildResult {
  const result = clone(assembly); result.parts.push(structuredClone(candidate.part)); result.connections.push(structuredClone(candidate.connection));
  const issue = placementIssue(result);
  return issue ? { assembly: null, message: issue.message } : { assembly: result, message: `${getPart(candidate.part.definitionId)!.name} attached.` };
}

export function addPart(assembly: VehicleAssembly, definitionId: string, positionM: Vec2): BuildResult {
  const part = nextPart(definitionId,assembly,positionM);
  if (!part || ![positionM.x,positionM.y].every(Number.isFinite)) return { assembly: null, message: 'Choose a known component and a finite placement.' };
  if (!assembly.parts.length) return definitionId === 'command' ? { assembly: { ...clone(assembly), parts: [part] }, message: 'Command module placed.' } : { assembly: null, message: 'Place a command module before adding other parts.' };
  const candidates = getSnapCandidates(assembly,part);
  for (const candidate of candidates) { const result = addAtCandidate(assembly,candidate); if (result.assembly) return result; }
  return { assembly: null, message: 'No clear compatible attachment within snapping range. Match connector size, direction and part type.' };
}

/** Keyboard and touch alternative: choose the first physically valid free connector. */
export function autoAttach(assembly: VehicleAssembly, definitionId: string): BuildResult {
  const part = nextPart(definitionId,assembly,{x:0,y:0});
  if (!part) return { assembly: null, message: 'Unknown component.' };
  if (!assembly.parts.length) return addPart(assembly,definitionId,{x:0,y:0});
  for (const candidate of getSnapCandidates(assembly,part,Infinity)) { const result = addAtCandidate(assembly,candidate); if (result.assembly) return result; }
  return { assembly: null, message: 'No free compatible connector has sufficient clearance for this component.' };
}

/** Removal retains other parts on the canvas; readiness reports any disconnected remainder. */
export function removePart(assembly: VehicleAssembly, partId: string): VehicleAssembly {
  const result = clone(assembly); result.parts = result.parts.filter(p => p.id !== partId); result.connections = result.connections.filter(c => c.a.partId !== partId && c.b.partId !== partId); return result;
}

/** Deliberate side relocation, rather than an unsupported free-floating rotation. */
export function rotatePart(assembly: VehicleAssembly, partId: string): BuildResult {
  const selected = assembly.parts.find(p=>p.id===partId);
  if (!selected || getPart(selected.definitionId)?.category !== 'solar') return {assembly:null,message:'Flip side is available for an attached solar array.'};
  const edge = assembly.connections.find(c=>c.a.partId===partId||c.b.partId===partId);
  if (!edge) return {assembly:null,message:'Attach the array to a tank before flipping its side.'};
  const parentRef=edge.a.partId===partId?edge.b:edge.a;
  const parent=assembly.parts.find(p=>p.id===parentRef.partId), pd=parent&&getPart(parent.definitionId);
  const currentNode=pd?.connectors.find(n=>n.id===parentRef.nodeId);
  if(!parent||!pd||!currentNode) return {assembly:null,message:'The current solar attachment is invalid.'};
  const currentNormal=worldNode(parent,currentNode).normal;
  const base=removePart(assembly,partId);
  for(const candidate of getSnapCandidates(base,selected,Infinity)) {
    if(candidate.connection.b.partId!==parent.id)continue;
    const node=pd.connectors.find(n=>n.id===candidate.connection.b.nodeId)!;
    const normal=worldNode(parent,node).normal;
    if(normal.x*currentNormal.x+normal.y*currentNormal.y>-.99999)continue;
    const result=addAtCandidate(base,candidate);
    if(result.assembly)return {...result,message:'Solar array moved to the opposite side.'};
  }
  return {assembly:null,message:'The opposite equipment mount is occupied or lacks clearance.'};
}

function movingSubtree(assembly: VehicleAssembly, partId: string): Set<string> {
  const root = assembly.parts.find(p => getPart(p.definitionId)?.category === 'command');
  const graph = new Map(assembly.parts.map(p => [p.id,new Set<string>()]));
  for (const c of assembly.connections) { graph.get(c.a.partId)?.add(c.b.partId); graph.get(c.b.partId)?.add(c.a.partId); }
  const parents = new Map<string,string | null>();
  const walk = (id: string, parent: string | null) => { if (parents.has(id)) return; parents.set(id,parent); graph.get(id)?.forEach(next => walk(next,id)); };
  if (root) walk(root.id,null);
  const blockedParent = parents.get(partId);
  const moving = new Set<string>();
  const visit = (id: string) => { if (moving.has(id)) return; moving.add(id); graph.get(id)?.forEach(next => { if (!(id === partId && next === blockedParent)) visit(next); }); };
  visit(partId); return moving;
}

export function movePart(assembly: VehicleAssembly, partId: string, positionM: Vec2): BuildResult {
  const selected = assembly.parts.find(p => p.id === partId);
  if (!selected || ![positionM.x,positionM.y].every(Number.isFinite)) return { assembly: null, message: 'Choose an existing component and a finite placement.' };
  const moving = movingSubtree(assembly,partId), dx = positionM.x-selected.positionM.x, dy = positionM.y-selected.positionM.y;
  const result = clone(assembly);
  result.parts = result.parts.map(p => moving.has(p.id) ? { ...p, positionM: {x:p.positionM.x+dx,y:p.positionM.y+dy} } : p);
  result.connections = result.connections.filter(c => moving.has(c.a.partId) === moving.has(c.b.partId));
  const fixed = { ...result, parts: result.parts.filter(p => !moving.has(p.id)), connections: result.connections.filter(c => !moving.has(c.a.partId)) };
  if (!fixed.parts.length) return { assembly: result, message: 'Connected assembly moved.' };
  const movedRoot = result.parts.find(p => p.id === partId)!;
  const internallyOccupied = new Set(result.connections.flatMap(c => [nodeKey(c.a.partId,c.a.nodeId),nodeKey(c.b.partId,c.b.nodeId)]));
  for (const candidate of getSnapCandidates(fixed,movedRoot)) {
    if (internallyOccupied.has(nodeKey(partId,candidate.connection.a.nodeId))) continue;
    const candidateResult = clone(result), adjustX=candidate.part.positionM.x-movedRoot.positionM.x, adjustY=candidate.part.positionM.y-movedRoot.positionM.y;
    candidateResult.parts = candidateResult.parts.map(p => moving.has(p.id) ? { ...p, angleRad:p.id===partId?candidate.part.angleRad:p.angleRad,positionM:{x:p.positionM.x+adjustX,y:p.positionM.y+adjustY} } : p);
    candidateResult.connections.push(candidate.connection);
    if (!placementIssue(candidateResult)) return { assembly: candidateResult, message: 'Component and attached subtree snapped into place.' };
  }
  return { assembly: null, message: 'Move rejected: no compatible clear connection nearby. Attached child parts move together.' };
}

export function readiness(assembly: VehicleAssembly): { blockers: AssemblyIssue[]; warnings: AssemblyIssue[]; metrics: MassProperties & { twr: number; deltaVMPerS: number } } {
  const blockers = validateAssembly(assembly.parts,assembly.connections,PARTS);
  const warnings: AssemblyIssue[] = [];
  blockers.push(...exhaustIssues(assembly));
  const engines = assembly.parts.filter(p => getPart(p.definitionId)?.category === 'engine');
  if (engines.length !== 1) blockers.push({code:'engine-count',message:'M1 flight requires exactly one engine.',partIds:engines.map(p=>p.id)});
  const engine = engines[0], ed = engine && getPart(engine.definitionId);
  const feeds = engine ? connectedTankIds(assembly,engine.id) : [];
  const feedFuel = assembly.parts.filter(p=>feeds.includes(p.id)).reduce((sum,p)=>sum+(p.propellantKg??0),0);
  if (engine && !feeds.length) blockers.push({code:'unfed-engine',message:'Engine requires a connected compatible tank feed.',partIds:[engine.id]});
  else if (engine && feedFuel <= 0) blockers.push({code:'empty-propellant',message:'Fill a connected tank before flight.',partIds:feeds});
  let mass: MassProperties;
  try { mass = massProperties(assembly.parts,PARTS); }
  catch { mass = {dryMassKg:0,propellantKg:0,wetMassKg:0,costCredits:0,centreOfMassM:{x:0,y:0},inertiaKgM2:0}; }
  const twr = ed?.category === 'engine' && mass.wetMassKg > 0 ? ed.engine.thrustSeaLevelN/(mass.wetMassKg*9.80665) : 0;
  const deltaVMPerS = ed?.category === 'engine' && mass.wetMassKg > feedFuel && feedFuel > 0 ? ed.engine.ispVacuumS*9.80665*Math.log(mass.wetMassKg/(mass.wetMassKg-feedFuel)) : 0;
  if (engine && twr <= 1) warnings.push({code:'low-twr',message:'Surface thrust-to-weight is at or below one: this craft cannot lift off vertically.',partIds:[engine.id]});
  if (!assembly.parts.some(p=>getPart(p.definitionId)?.category === 'solar')) warnings.push({code:'no-solar',message:'No solar generation: electrical operation is limited to the command battery.',partIds:[]});
  for (const part of assembly.parts) {
    const d = getPart(part.definitionId);
    if (d?.category === 'command' && d.command.baselinePowerW > d.command.maxBusPowerW) blockers.push({code:'bus-limit',message:'Command baseline demand exceeds its electrical bus limit.',partIds:[part.id]});
  }
  return { blockers, warnings, metrics:{...mass,twr,deltaVMPerS} };
}

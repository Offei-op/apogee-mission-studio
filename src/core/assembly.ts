import type { AssemblyConnection, AttachmentNode, PartDefinition, PartInstance, Vec2, VehicleAssembly } from './types.ts';
import { collisionCorners, rectanglesOverlap, worldNode } from './geometry.ts';
import { PARTS } from '../data/parts.ts';

export interface AssemblyIssue { code: string; message: string; partIds: string[] }
export interface MassProperties { dryMassKg: number; propellantKg: number; wetMassKg: number; costCredits: number; centreOfMassM: Vec2; inertiaKgM2: number }

export function massProperties(parts: readonly PartInstance[], definitions: readonly PartDefinition[]): MassProperties {
  let dryMassKg = 0, propellantKg = 0, costCredits = 0, weightedX = 0, weightedY = 0;
  const masses = parts.map(part => {
    const d = definitions.find(d => d.id === part.definitionId);
    if (!d) throw new Error(`Unknown part definition: ${part.definitionId}`);
    const fuel = part.propellantKg ?? 0;
    if (!Number.isFinite(fuel) || fuel < 0 || (d.category !== 'tank' && fuel !== 0) || (d.category === 'tank' && fuel > d.tank.capacityKg)) throw new Error(`Invalid propellant on ${part.id}`);
    const m = d.dryMassKg + fuel;
    dryMassKg += d.dryMassKg; propellantKg += fuel;
    costCredits += d.costCredits + (d.category === 'tank' ? fuel * d.tank.propellantCostPerKg : 0);
    weightedX += m * part.positionM.x; weightedY += m * part.positionM.y;
    return { part, d, m };
  });
  const wetMassKg = dryMassKg + propellantKg;
  const centreOfMassM = wetMassKg ? { x: weightedX / wetMassKg, y: weightedY / wetMassKg } : { x: 0, y: 0 };
  const inertiaKgM2 = masses.reduce((total, { part, d, m }) => total + m * ((d.widthM**2 + d.heightM**2)/12 + (part.positionM.x-centreOfMassM.x)**2 + (part.positionM.y-centreOfMassM.y)**2), 0);
  return { dryMassKg, propellantKg, wetMassKg, costCredits, centreOfMassM, inertiaKgM2 };
}

/** Component roles are deliberately bounded to the M1 axial stack catalogue. */
export function connectorsCompatible(a: PartDefinition, an: AttachmentNode, b: PartDefinition, bn: AttachmentNode): boolean {
  if (an.kind !== bn.kind || Math.abs(an.sizeM - bn.sizeM) > 1e-6) return false;
  if (a.category === 'solar') return b.category === 'tank' && an.id === 'mount' && bn.kind === 'equipment';
  if (b.category === 'solar') return a.category === 'tank' && bn.id === 'mount' && an.kind === 'equipment';
  if (an.kind !== 'structural') return false;
  if (a.category === 'command') return b.category === 'tank' && an.id === 'bottom' && bn.id === 'top';
  if (b.category === 'command') return a.category === 'tank' && bn.id === 'bottom' && an.id === 'top';
  if (a.category === 'engine') return b.category === 'tank' && an.id === 'top' && bn.id === 'bottom';
  if (b.category === 'engine') return a.category === 'tank' && bn.id === 'top' && an.id === 'bottom';
  return a.category === 'tank' && b.category === 'tank' && ((an.id === 'top' && bn.id === 'bottom') || (an.id === 'bottom' && bn.id === 'top'));
}

/** Only aligned, compatible tank-chain connections can feed the selected engine. */
export function connectedTankIds(assembly: VehicleAssembly, enginePartId: string, definitions: readonly PartDefinition[] = PARTS): string[] {
  const engine = assembly.parts.find(p => p.id === enginePartId);
  const ed = engine && definitions.find(d => d.id === engine.definitionId);
  if (!engine || !ed || ed.category !== 'engine') return [];
  const graph = new Map(assembly.parts.map(p => [p.id, new Set<string>()]));
  const nodeCounts = new Map<string, number>();
  for (const c of assembly.connections) for (const ref of [c.a,c.b]) {
    const key = `${ref.partId}/${ref.nodeId}`; nodeCounts.set(key, (nodeCounts.get(key) ?? 0) + 1);
  }
  for (const c of assembly.connections) {
    if ([c.a,c.b].some(ref => nodeCounts.get(`${ref.partId}/${ref.nodeId}`) !== 1)) continue;
    const a = assembly.parts.find(p => p.id === c.a.partId), b = assembly.parts.find(p => p.id === c.b.partId);
    const ad = a && definitions.find(d => d.id === a.definitionId), bd = b && definitions.find(d => d.id === b.definitionId);
    const an = ad?.connectors.find(n => n.id === c.a.nodeId), bn = bd?.connectors.find(n => n.id === c.b.nodeId);
    if (!a || !b || !ad || !bd || !an || !bn || !connectorsCompatible(ad,an,bd,bn)) continue;
    const allowed = (d: PartDefinition, id: string) => id === enginePartId || (d.category === 'tank' && d.tank.propellantType === ed.engine.propellantType);
    if (!allowed(ad,a.id) || !allowed(bd,b.id)) continue;
    const aw = worldNode(a,an), bw = worldNode(b,bn);
    if (Math.hypot(aw.positionM.x-bw.positionM.x, aw.positionM.y-bw.positionM.y) > 1e-5 || aw.normal.x*bw.normal.x+aw.normal.y*bw.normal.y > -0.99999) continue;
    graph.get(a.id)!.add(b.id); graph.get(b.id)!.add(a.id);
  }
  const visited = new Set<string>();
  const visit = (id: string) => { if (visited.has(id)) return; visited.add(id); graph.get(id)?.forEach(visit); };
  visit(enginePartId);
  return assembly.parts.filter(p => p.id !== enginePartId && visited.has(p.id)).map(p => p.id);
}

/** Shared structural, feed and geometry checks; readiness adds mission requirements. */
export function validateAssembly(parts: readonly PartInstance[], connections: readonly AssemblyConnection[], definitions: readonly PartDefinition[]): AssemblyIssue[] {
  const issues: AssemblyIssue[] = [];
  const report = (code: string, message: string, partIds: string[]) => issues.push({ code, message, partIds });
  const ids = new Set<string>();
  for (const p of parts) {
    if (ids.has(p.id)) report('duplicate-id', 'Part instance IDs must be unique.', [p.id]);
    ids.add(p.id);
    if (!definitions.some(d => d.id === p.definitionId)) report('unknown-part', 'Unknown component definition.', [p.id]);
    if (![p.positionM.x, p.positionM.y, p.angleRad].every(Number.isFinite)) report('invalid-transform', 'Component transform must be finite.', [p.id]);
    const d = definitions.find(d => d.id === p.definitionId);
    if (d) {
      const f = p.propellantKg ?? 0;
      if (!Number.isFinite(f) || f < 0 || (d.category === 'tank' ? f > d.tank.capacityKg : f !== 0)) report('invalid-propellant', 'Propellant exceeds capacity or is assigned to a non-tank.', [p.id]);
    }
  }
  if (issues.some(i => ['duplicate-id', 'unknown-part', 'invalid-transform'].includes(i.code))) return issues;
  if (parts.filter(p => definitions.find(d => d.id === p.definitionId)?.category === 'command').length !== 1) report('command-count', 'Assembly requires exactly one command module.', parts.map(p => p.id));
  const graph = new Map(parts.map(p => [p.id, new Set<string>()]));
  const used = new Set<string>();
  const parent = new Map(parts.map(p => [p.id, p.id]));
  const root = (id: string): string => { let r = id; while (parent.get(r) !== r) r = parent.get(r)!; return r; };
  for (const c of connections) {
    const a = parts.find(p => p.id === c.a.partId), b = parts.find(p => p.id === c.b.partId);
    const an = a && definitions.find(d => d.id === a.definitionId)?.connectors.find(n => n.id === c.a.nodeId);
    const bn = b && definitions.find(d => d.id === b.definitionId)?.connectors.find(n => n.id === c.b.nodeId);
    if (!a || !b || !an || !bn || a.id === b.id) { report('invalid-connection', 'Connection must reference two valid distinct parts and nodes.', [c.a.partId, c.b.partId]); continue; }
    const keys = [`${a.id}/${an.id}`, `${b.id}/${bn.id}`];
    if (keys.some(k => used.has(k))) { report('occupied-node', 'Each attachment node supports one connection.', [a.id,b.id]); continue; }
    keys.forEach(k => used.add(k));
    const aw = worldNode(a, an), bw = worldNode(b, bn);
    const aligned = Math.hypot(aw.positionM.x-bw.positionM.x, aw.positionM.y-bw.positionM.y) < 1e-5;
    const facing = aw.normal.x*bw.normal.x + aw.normal.y*bw.normal.y < -0.99999;
    const legalPair = connectorsCompatible(definitions.find(d=>d.id===a.definitionId)!, an, definitions.find(d=>d.id===b.definitionId)!, bn);
    if (!aligned || !facing || !legalPair) { report('incompatible-connection', 'Connector type, size, alignment and component pairing must match.', [a.id,b.id]); continue; }
    if (root(a.id) === root(b.id)) report('attachment-cycle', 'Attachment graph must not contain cycles.', [a.id,b.id]);
    else parent.set(root(a.id), root(b.id));
    graph.get(a.id)!.add(b.id); graph.get(b.id)!.add(a.id);
  }
  const visited = new Set<string>();
  const visit = (id: string) => { if (visited.has(id)) return; visited.add(id); graph.get(id)?.forEach(visit); };
  if (parts.length) visit(parts[0].id);
  if (visited.size !== parts.length) report('disconnected', 'All flight parts must form one connected assembly.', parts.filter(p => !visited.has(p.id)).map(p => p.id));
  for (let i=0; i<parts.length; i++) for (let j=i+1; j<parts.length; j++) {
    const a = parts[i], b = parts[j];
    if (rectanglesOverlap(collisionCorners(a, definitions.find(d=>d.id===a.definitionId)!), collisionCorners(b, definitions.find(d=>d.id===b.definitionId)!))) report('overlap', 'Component collision envelopes overlap.', [a.id,b.id]);
  }
  return issues;
}

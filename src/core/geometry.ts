import type { PartDefinition, PartInstance, Vec2, AttachmentNode } from './types.ts';

export function rotate(point: Vec2, angleRad: number): Vec2 {
  const c = Math.cos(angleRad), s = Math.sin(angleRad);
  return { x: c * point.x - s * point.y, y: s * point.x + c * point.y };
}
export function worldPoint(part: PartInstance, local: Vec2): Vec2 {
  const p = rotate(local, part.angleRad);
  return { x: part.positionM.x + p.x, y: part.positionM.y + p.y };
}
export function worldNode(part: PartInstance, node: AttachmentNode): AttachmentNode {
  return { ...node, positionM: worldPoint(part, node.positionM), normal: rotate(node.normal, part.angleRad) };
}
export function collisionCorners(part: PartInstance, definition: PartDefinition): Vec2[] {
  const { centreM: c, widthM: w, heightM: h } = definition.collision;
  return [ { x: c.x-w/2, y: c.y-h/2 }, { x: c.x+w/2, y: c.y-h/2 }, { x: c.x+w/2, y: c.y+h/2 }, { x: c.x-w/2, y: c.y+h/2 } ].map(p => worldPoint(part, p));
}
export interface Bounds { minX: number; minY: number; maxX: number; maxY: number; widthM: number; heightM: number }
export function assemblyBounds(parts: readonly PartInstance[], definitions: readonly PartDefinition[]): Bounds {
  const points = parts.flatMap(part => {
    const d = definitions.find(d => d.id === part.definitionId);
    if (!d) throw new Error(`Unknown part definition: ${part.definitionId}`);
    return collisionCorners(part, d);
  });
  if (!points.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0, widthM: 0, heightM: 0 };
  const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
  return { minX, minY, maxX, maxY, widthM: maxX-minX, heightM: maxY-minY };
}
/** Separating-axis test. Touching edges are allowed; penetration is not. */
export function rectanglesOverlap(a: Vec2[], b: Vec2[], toleranceM = 1e-6): boolean {
  for (const polygon of [a, b]) {
    for (let i = 0; i < 2; i++) {
      const p = polygon[i], q = polygon[i+1];
      const length = Math.hypot(q.x-p.x, q.y-p.y);
      const axis = { x: -(q.y-p.y)/length, y: (q.x-p.x)/length };
      const project = (points: Vec2[]) => points.map(v => v.x*axis.x + v.y*axis.y);
      const ap = project(a), bp = project(b);
      if (Math.min(Math.max(...ap), Math.max(...bp)) - Math.max(Math.min(...ap), Math.min(...bp)) <= toleranceM) return false;
    }
  }
  return true;
}

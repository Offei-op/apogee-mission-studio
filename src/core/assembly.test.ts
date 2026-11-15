import assert from 'node:assert/strict';
import test from 'node:test';
import { PARTS, SAMPLE_CRAFT, SAMPLE_CONNECTIONS } from '../data/parts.ts';
import { massProperties, validateAssembly } from './assembly.ts';
import { assemblyBounds, rotate, worldPoint, collisionCorners, rectanglesOverlap } from './geometry.ts';

test('reference assembly nodes align and do not penetrate', () => {
  assert.deepEqual(validateAssembly(SAMPLE_CRAFT, SAMPLE_CONNECTIONS, PARTS), []);
  const bounds = assemblyBounds(SAMPLE_CRAFT, PARTS);
  assert.ok(Math.abs(bounds.heightM - 10) < 1e-10);
  assert.ok(Math.abs(bounds.widthM - 5.6) < 1e-10);
});
test('mass and propellant ledger matches independent component arithmetic', () => {
  const m = massProperties(SAMPLE_CRAFT, PARTS);
  assert.equal(m.dryMassKg, 650 + 800 + 480 + 45);
  assert.equal(m.wetMassKg, 27975);
  assert.equal(m.costCredits, 1800 + 900 + 1500 + 450 + 26000 * 0.02);
  assert.ok(Math.abs(m.centreOfMassM.x - 45 * 2.8 / 27975) < 1e-12);
  assert.ok(Math.abs(m.centreOfMassM.y - (650 * 3.8 - 480 * 3.7) / 27975) < 1e-12);
  const empty = SAMPLE_CRAFT.map(p => ({ ...p, propellantKg: p.definitionId === 'tank' ? 0 : undefined }));
  assert.equal(massProperties(empty, PARTS).wetMassKg, 1975);
});
test('local geometry rotates counterclockwise, then translates', () => {
  const r = rotate({ x: 1, y: 0 }, Math.PI/2);
  assert.ok(Math.abs(r.x) < 1e-12); assert.equal(r.y, 1);
  const p = worldPoint({ id: 'p', definitionId: 'tank', positionM: { x: 10, y: 5 }, angleRad: Math.PI/2 }, { x: 2, y: 0 });
  assert.ok(Math.abs(p.x-10) < 1e-12); assert.equal(p.y, 7);
});
test('invalid feeds, occupied nodes, disconnected parts and propellant are rejected', () => {
  assert.ok(validateAssembly(SAMPLE_CRAFT, SAMPLE_CONNECTIONS.slice(1), PARTS).some(i => i.code === 'disconnected'));
  assert.ok(validateAssembly(SAMPLE_CRAFT, [...SAMPLE_CONNECTIONS, SAMPLE_CONNECTIONS[0]], PARTS).some(i => i.code === 'occupied-node'));
  const wrong = structuredClone(SAMPLE_CRAFT); wrong[2].angleRad = Math.PI;
  assert.ok(validateAssembly(wrong, SAMPLE_CONNECTIONS, PARTS).some(i => i.code === 'incompatible-connection'));
  const overfilled = structuredClone(SAMPLE_CRAFT); overfilled[1].propellantKg = 26001;
  assert.ok(validateAssembly(overfilled, SAMPLE_CONNECTIONS, PARTS).some(i => i.code === 'invalid-propellant'));
  assert.throws(() => massProperties(overfilled, PARTS), /Invalid propellant/);
});
test('collision test permits edge contact but rejects rotated penetration', () => {
  const def = PARTS.find(p=>p.id==='tank')!;
  const a = { id: 'a', definitionId: 'tank', positionM: { x: 0, y: 0 }, angleRad: 0 };
  const b = { ...a, id: 'b', positionM: { x: 2.4, y: 0 } };
  assert.equal(rectanglesOverlap(collisionCorners(a, def), collisionCorners(b, def)), false);
  assert.equal(rectanglesOverlap(collisionCorners(a, def), collisionCorners({ ...b, positionM: { x: 1, y: 0 }, angleRad: Math.PI/4 }, def)), true);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { EARTH, orbitElements, predictCoast } from './orbit.ts';

test('circular and elliptical elements match independent vis-viva fixtures', () => {
  const r = EARTH.radiusM+400_000, mu=EARTH.gravitationalParameterM3S2;
  const o=orbitElements({x:r,y:0},{x:0,y:Math.sqrt(mu/r)});
  assert.ok(Math.abs(o.eccentricity)<1e-12);
  assert.ok(Math.abs(o.periapsisM!-400_000)<1e-6);
  assert.ok(Math.abs(o.apoapsisM!-400_000)<1e-6);
  assert.ok(Math.abs(o.periodS!-2*Math.PI*Math.sqrt(r**3/mu))<1e-9);
  const rp=EARTH.radiusM+200_000,ra=EARTH.radiusM+2_000_000,a=(rp+ra)/2;
  const ellipse=orbitElements({x:rp,y:0},{x:0,y:Math.sqrt(mu*(2/rp-1/a))});
  assert.ok(Math.abs(ellipse.periapsisM!-200_000)<1e-6);
  assert.ok(Math.abs(ellipse.apoapsisM!-2_000_000)<1e-6);
});
test('escape paths have no apoapsis or period and coast points obey the conic', () => {
  const r=EARTH.radiusM+400_000,mu=EARTH.gravitationalParameterM3S2;
  const initial={x:r,y:0},velocity={x:0,y:Math.sqrt(2*mu/r)*1.05};
  const o=orbitElements(initial,velocity);
  assert.equal(o.escape,true); assert.equal(o.apoapsisM,null); assert.equal(o.periodS,null);
  const points=predictCoast(initial,velocity);
  assert.ok(points.length>5);
  for (const p of points) {
    const angle=Math.atan2(p.y,p.x);
    const expected=o.angularMomentumM2PerS**2/mu/(1+o.eccentricity*Math.cos(angle));
    assert.ok(Math.abs(Math.hypot(p.x,p.y)-expected)<1e-5);
    assert.ok(Math.hypot(p.x,p.y)>=EARTH.radiusM);
  }
});
test('suborbital prediction stops at the surface rather than passing through Earth', () => {
  const points=predictCoast({x:EARTH.radiusM+150_000,y:0},{x:-500,y:2000},360);
  assert.ok(points.length>1);
  for (const p of points) assert.ok(Math.hypot(p.x,p.y)>=EARTH.radiusM-1e-7);
  assert.ok(Math.abs(Math.hypot(points.at(-1)!.x,points.at(-1)!.y)-EARTH.radiusM)<1e-5);
});

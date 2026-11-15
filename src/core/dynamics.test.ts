import assert from 'node:assert/strict';
import test from 'node:test';
import { createFlight, advanceFlight, stepFlight, telemetry, EARTH, G0, atmosphere } from './dynamics.ts';
import { orbitElements } from './orbit.ts';
import { PARTS, SAMPLE_CRAFT, SAMPLE_CONNECTIONS } from '../data/parts.ts';
import { massProperties } from './assembly.ts';

function fixture(withSolar=true) {
  const parts=structuredClone(SAMPLE_CRAFT).filter(p=>withSolar||p.definitionId!=='solar');
  const connections=structuredClone(SAMPLE_CONNECTIONS).filter(c=>withSolar||(c.a.partId!=='solar-1'&&c.b.partId!=='solar-1'));
  return createFlight({id:'reference',parts,connections});
}
function vacuumFixture() {
  const s=fixture(false); s.positionM={x:1e12,y:0};s.velocityMPerS={x:0,y:0};s.status='flying';s.launched=true;s.attitudeHold=false;
  return s;
}
test('fuel flow and ideal vacuum burn agree with independent rocket equation', () => {
  const s=vacuumFixture();s.throttle=.4;
  const engine=PARTS.find(p=>p.category==='engine')!;
  assert.equal(engine.category,'engine');if(engine.category!=='engine')return;
  const initial=massProperties(s.assembly.parts,PARTS).wetMassKg;
  const duration=10, thrust=engine.engine.thrustVacuumN*.4;
  const used=thrust/(engine.engine.ispVacuumS*G0)*duration;
  advanceFlight(s,duration);
  assert.ok(Math.abs(telemetry(s).propellantKg-(26000-used))<1e-6);
  const expected=engine.engine.ispVacuumS*G0*Math.log(initial/(initial-used));
  assert.ok(Math.abs(s.velocityMPerS.y-expected)/expected<1e-7);
  assert.ok(Math.abs(s.velocityMPerS.x)<1e-5); // negligible gravity at 1e12 m, not disabled gravity
});
test('depletion splits the last burn, never producing negative fuel or continued thrust', () => {
  const s=vacuumFixture();s.assembly.parts.find(p=>p.definitionId==='tank')!.propellantKg=.1;s.throttle=1;
  const initial=massProperties(s.assembly.parts,PARTS).wetMassKg;
  advanceFlight(s,1);
  assert.equal(telemetry(s).propellantKg,0);assert.equal(s.thrustN,0);
  const e=PARTS.find(p=>p.category==='engine')!;if(e.category!=='engine')return;
  const expected=e.engine.ispVacuumS*G0*Math.log(initial/(initial-.1));
  assert.ok(Math.abs(s.velocityMPerS.y-expected)<1e-6);
});
test('no connected tank means no thrust and no fuel expenditure', () => {
  const s=vacuumFixture();s.assembly.connections=[];s.throttle=1;
  advanceFlight(s,1);assert.equal(s.thrustN,0);assert.equal(telemetry(s).propellantKg,26000);
});
test('engine-off steering rotates the body without changing translational momentum beyond gravity', () => {
  const s=vacuumFixture();s.steering=1;
  advanceFlight(s,2);
  assert.ok(s.angleRad>0);assert.ok(s.angularVelocityRadPerS>0);
  assert.ok(Math.hypot(s.velocityMPerS.x,s.velocityMPerS.y)<1e-5);
});
test('asymmetric mass causes torque when stabilisation is disabled', () => {
  const s=fixture();s.positionM={x:1e12,y:0};s.velocityMPerS={x:0,y:0};s.status='flying';s.attitudeHold=false;s.throttle=.5;
  advanceFlight(s,.2);
  assert.ok(s.angularVelocityRadPerS<0);
  const symmetric=vacuumFixture();symmetric.throttle=.5;advanceFlight(symmetric,.2);
  assert.ok(Math.abs(symmetric.angularVelocityRadPerS)<1e-12);
});
test('ten unpowered orbits conserve radius and specific orbital energy', () => {
  const s=fixture();const r=EARTH.radiusM+400_000,mu=EARTH.gravitationalParameterM3S2;
  s.positionM={x:r,y:0};s.velocityMPerS={x:0,y:Math.sqrt(mu/r)};s.status='flying';s.attitudeHold=false;
  const initial=orbitElements(s.positionM,s.velocityMPerS),period=initial.periodS!;
  let maxRadiusError=0,maxEnergyError=0;
  for(let i=0;i<100;i++) {
    advanceFlight(s,period/10);
    maxRadiusError=Math.max(maxRadiusError,Math.abs(Math.hypot(s.positionM.x,s.positionM.y)-r)/r);
    maxEnergyError=Math.max(maxEnergyError,Math.abs((orbitElements(s.positionM,s.velocityMPerS).specificEnergyJPerKg-initial.specificEnergyJPerKg)/initial.specificEnergyJPerKg));
  }
  assert.ok(maxRadiusError<.001,`radius drift ${maxRadiusError}`);
  assert.ok(maxEnergyError<.001,`energy drift ${maxEnergyError}`);
  assert.equal(s.status,'flying');
});
test('timestamped commands replay identically across warp batch sizes', () => {
  const a=vacuumFixture(),b=vacuumFixture();
  for(const s of [a,b])s.throttle=.7;
  advanceFlight(a,4);for(let i=0;i<200;i++)stepFlight(b,.02);
  for(const s of [a,b]){s.throttle=0;s.steering=.5;}
  advanceFlight(a,3);for(let i=0;i<150;i++)stepFlight(b,.02);
  assert.ok(Math.hypot(a.positionM.x-b.positionM.x,a.positionM.y-b.positionM.y)<1e-6);
  assert.ok(Math.abs(a.angleRad-b.angleRad)<1e-9);
  assert.ok(Math.abs(telemetry(a).propellantKg-telemetry(b).propellantKg)<1e-7);
});
test('half-step convergence does not materially change finite burn trajectory', () => {
  const a=vacuumFixture(),b=vacuumFixture();a.throttle=.8;b.throttle=.8;
  advanceFlight(a,5);for(let i=0;i<500;i++)stepFlight(b,.01);
  assert.ok(Math.hypot(a.velocityMPerS.x-b.velocityMPerS.x,a.velocityMPerS.y-b.velocityMPerS.y)<1e-5);
  assert.ok(Math.abs(a.positionM.y-b.positionM.y)<1e-5);
});
test('reference assisted ascent physically reaches a stable orbit above the atmosphere', () => {
  const s=fixture();s.assistance=true;
  for(let i=0;i<16000&&s.assistance&&s.status!=='crashed';i++)stepFlight(s,.02);
  const t=telemetry(s);
  assert.equal(s.status,'flying');assert.equal(s.assistance,false);assert.equal(s.throttle,0);
  assert.ok(t.periapsisM!>120_000,`periapsis ${t.periapsisM}`);
  assert.ok(t.propellantKg>0);assert.ok(t.altitudeM<300_000);
  const initial=orbitElements(s.positionM,s.velocityMPerS),period=initial.periodS!;
  advanceFlight(s,period);
  assert.equal(s.status,'flying');assert.ok(telemetry(s).periapsisM!>120_000);
  assert.ok(Math.abs(orbitElements(s.positionM,s.velocityMPerS).specificEnergyJPerKg-initial.specificEnergyJPerKg)/Math.abs(initial.specificEnergyJPerKg)<.001);
});
test('atmosphere uses rotating-relative velocity and vacuum cutoff', () => {
  assert.equal(atmosphere(100_000).densityKgM3,0);
  assert.equal(atmosphere(0).densityKgM3,1.225);
  assert.ok(atmosphere(10_000).densityKgM3<atmosphere(0).densityKgM3);
  const s=fixture();const t=telemetry(s);
  assert.ok(Math.abs(t.horizontalSpeedMPerS)<1e-9);
  assert.ok(t.speedMPerS>460); // inertial motion from Earth's rotation
});
test('prograde raises apoapsis and retrograde lowers periapsis through actual burns', () => {
  const r=EARTH.radiusM+400_000,v=Math.sqrt(EARTH.gravitationalParameterM3S2/r);
  const prograde=fixture(false),retrograde=fixture(false);
  for(const s of [prograde,retrograde]) {
    s.positionM={x:r,y:0};s.velocityMPerS={x:0,y:v};s.status='flying';s.attitudeHold=false;s.throttle=.1;
  }
  prograde.angleRad=0;retrograde.angleRad=Math.PI;
  advanceFlight(prograde,1);advanceFlight(retrograde,1);
  assert.ok(telemetry(prograde).apoapsisM!>400_000);
  assert.ok(telemetry(retrograde).periapsisM!<400_000);
});
test('ballistic descent ends in impact and an underpowered vehicle stays on the pad', () => {
  const falling=fixture(false);
  falling.positionM={x:0,y:EARTH.radiusM+50};falling.velocityMPerS={x:0,y:-100};falling.status='flying';falling.launched=true;
  advanceFlight(falling,2);assert.equal(falling.status,'crashed');assert.equal(falling.thrustN,0);
  const pad=fixture();pad.throttle=.1;advanceFlight(pad,2);
  assert.equal(pad.status,'pad');assert.equal(pad.launched,false);assert.ok(telemetry(pad).altitudeM>0);
});
test('builder-origin translation cannot change pad placement or the subsequent physical flight', () => {
  const a=fixture();
  const translated=structuredClone(SAMPLE_CRAFT).map(p=>({...p,positionM:{x:p.positionM.x+100,y:p.positionM.y-200}}));
  const before=structuredClone(translated);
  const b=createFlight({id:'translated',parts:translated,connections:structuredClone(SAMPLE_CONNECTIONS)});
  assert.deepEqual(translated,before); // creating a flight must not move the editor craft
  assert.ok(Math.abs(telemetry(a).altitudeM-telemetry(b).altitudeM)<1e-9);
  for(const s of [a,b]){s.throttle=1;s.attitudeHold=true;advanceFlight(s,10);}
  assert.ok(Math.hypot(a.positionM.x-b.positionM.x,a.positionM.y-b.positionM.y)<1e-7);
  assert.ok(Math.hypot(a.velocityMPerS.x-b.velocityMPerS.x,a.velocityMPerS.y-b.velocityMPerS.y)<1e-7);
  assert.ok(Math.abs(a.angleRad-b.angleRad)<1e-10);
});

import type { CelestialBody, Vec2 } from './types.ts';

export const EARTH: CelestialBody = {
  id: 'earth', name: 'Earth', radiusM: 6_371_000,
  gravitationalParameterM3S2: 3.986004418e14, rotationRadPerS: 7.2921159e-5,
};
export interface OrbitElements {
  eccentricity: number;
  eccentricityVector: Vec2;
  semiMajorAxisM: number | null;
  /** Apsis values are altitude above the spherical reference surface. */
  apoapsisM: number | null;
  periapsisM: number | null;
  periodS: number | null;
  escape: boolean;
  angularMomentumM2PerS: number;
  specificEnergyJPerKg: number;
}
export function orbitElements(position: Vec2, velocity: Vec2, body: CelestialBody = EARTH): OrbitElements {
  const r = Math.hypot(position.x, position.y), mu = body.gravitationalParameterM3S2;
  if (!(r > 0) || ![position.x, position.y, velocity.x, velocity.y].every(Number.isFinite)) throw new Error('Orbit requires finite position and velocity away from the body centre.');
  const v2 = velocity.x**2 + velocity.y**2, rv = position.x*velocity.x + position.y*velocity.y;
  const h = position.x*velocity.y-position.y*velocity.x;
  const eccentricityVector = { x: ((v2-mu/r)*position.x-rv*velocity.x)/mu, y: ((v2-mu/r)*position.y-rv*velocity.y)/mu };
  const e = Math.hypot(eccentricityVector.x, eccentricityVector.y);
  const energy = v2/2-mu/r, escape = energy >= 0;
  const a = Math.abs(energy) > 1e-9 ? -mu/(2*energy) : null;
  const p = h*h/mu;
  return {
    eccentricity: e, eccentricityVector, semiMajorAxisM: a,
    apoapsisM: !escape && a !== null ? a*(1+e)-body.radiusM : null,
    periapsisM: Math.abs(h) > 1e-6 ? p/(1+e)-body.radiusM : -body.radiusM,
    periodS: !escape && a !== null ? 2*Math.PI*Math.sqrt(a**3/mu) : null,
    escape, angularMomentumM2PerS: h, specificEnergyJPerKg: energy,
  };
}

/** Geometric osculating coast conic, not an assumed future powered trajectory. */
export function predictCoast(position: Vec2, velocity: Vec2, count = 180): Vec2[] {
  const elements = orbitElements(position, velocity), mu = EARTH.gravitationalParameterM3S2;
  const n = Math.max(8, Math.min(1200, Math.floor(count))), e = elements.eccentricity;
  const h = elements.angularMomentumM2PerS, p = h*h/mu;
  const r0 = Math.hypot(position.x, position.y);
  if (Math.abs(h) < 1e-4) {
    // Degenerate radial trajectory: do not manufacture an ellipse.
    const outward = position.x*velocity.x+position.y*velocity.y > 0;
    const endR = outward ? r0*3 : EARTH.radiusM;
    return Array.from({ length: n }, (_, i) => {
      const r = r0 + (endR-r0)*i/(n-1);
      return { x: position.x*r/r0, y: position.y*r/r0 };
    });
  }
  const orientation = e > 1e-8 ? Math.atan2(elements.eccentricityVector.y, elements.eccentricityVector.x) : Math.atan2(position.y,position.x);
  const raw = Math.atan2(position.y,position.x)-orientation;
  const initial = Math.atan2(Math.sin(raw),Math.cos(raw)), direction = Math.sign(h);
  const points: Vec2[] = [{ ...position }];
  const maxSweep = elements.escape ? Math.PI*1.99 : Math.PI*2;
  for (let i=1; i<=n; i++) {
    const nu = initial + direction*maxSweep*i/n;
    const denominator = 1+e*Math.cos(nu);
    if (denominator <= 0) break;
    const r = p/denominator;
    if (r > Math.max(r0*15, EARTH.radiusM*25)) break;
    const angle = orientation+nu;
    const point = { x: r*Math.cos(angle), y: r*Math.sin(angle) };
    if (r < EARTH.radiusM) {
      // Intersect the last chord with the surface instead of drawing through it.
      const before = points[points.length-1], dx = point.x-before.x, dy = point.y-before.y;
      const aa = dx*dx+dy*dy, bb = 2*(before.x*dx+before.y*dy), cc = before.x**2+before.y**2-EARTH.radiusM**2;
      const discriminant = bb*bb-4*aa*cc;
      if (aa > 0 && discriminant >= 0) {
        const t = (-bb-Math.sqrt(discriminant))/(2*aa);
        if (t >= 0 && t <= 1) points.push({ x: before.x+t*dx, y: before.y+t*dy });
      }
      break;
    }
    points.push(point);
  }
  return points;
}

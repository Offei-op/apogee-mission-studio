import { getPart, PARTS, SAMPLE_CRAFT } from '../data/parts.ts';
import { assemblyBounds, rotate } from '../core/geometry.ts';
import type { PartInstance, Vec2 } from '../core/types.ts';
import { EARTH, telemetry } from '../core/dynamics.ts';
import type { FlightState } from '../core/dynamics.ts';
import { predictCoast } from '../core/orbit.ts';
import { MISSION_CONFIG, missionGeometry, surfacePoint } from '../core/mission.ts';
import type { MissionState } from '../core/mission.ts';

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
let svgInstance = 0;

function definitions(prefix: string): string {
  return `<defs>
    <linearGradient id="${prefix}-hull"><stop stop-color="#9babae"/><stop offset=".18" stop-color="#e6e6dc"/><stop offset=".42" stop-color="#fffdf1"/><stop offset=".8" stop-color="#c8cdc5"/><stop offset="1" stop-color="#7a8c91"/></linearGradient>
    <linearGradient id="${prefix}-dark"><stop stop-color="#172329"/><stop offset=".45" stop-color="#566268"/><stop offset="1" stop-color="#172329"/></linearGradient>
    <linearGradient id="${prefix}-flame" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff7d3"/><stop offset=".2" stop-color="#ffd793"/><stop offset=".55" stop-color="#ed9762" stop-opacity=".75"/><stop offset="1" stop-color="#ec8e5b" stop-opacity="0"/></linearGradient>
    <radialGradient id="${prefix}-earth"><stop stop-color="#436e78"/><stop offset=".7" stop-color="#203e4c"/><stop offset="1" stop-color="#0d202d"/></radialGradient>
    <linearGradient id="${prefix}-sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#09121c"/><stop offset=".65" stop-color="#122d40"/><stop offset="1" stop-color="#527b88"/></linearGradient>
    <pattern id="${prefix}-grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="#537c8b" stroke-opacity=".18"/></pattern>
    <pattern id="${prefix}-cells" width="8" height="7" patternUnits="userSpaceOnUse"><rect width="8" height="7" fill="#294c64"/><path d="M8 0H0V7" fill="none" stroke="#8aabb8" stroke-width=".45"/></pattern>
  </defs>`;
}

function stars(): string {
  return Array.from({ length: 53 }, (_, i) => `<circle cx="${(i * 173 + 29) % 900}" cy="${(i * 79 + 43) % 570}" r="${i % 8 === 0 ? 1.25 : .65}" fill="#dae7e7" opacity="${.12 + (i % 5) * .07}"/>`).join('');
}

/** NASA natural-colour composite is an illustration; navigation uses the 2D surface. */
function earthArtwork(prefix:string,x:number,y:number,r:number,rotationDeg=0):string {
  return `<g data-body-id="earth"><title>Earth · NASA Blue Marble natural-colour composite</title><defs><clipPath id="${prefix}-earth-disc"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath><radialGradient id="${prefix}-air"><stop offset=".9" stop-color="#68c5f2" stop-opacity="0"/><stop offset=".97" stop-color="#62b8ef" stop-opacity=".18"/><stop offset="1" stop-color="#62b8ef" stop-opacity="0"/></radialGradient><linearGradient id="${prefix}-night"><stop stop-color="#010711" stop-opacity=".88"/><stop offset=".35" stop-color="#010711" stop-opacity=".58"/><stop offset=".63" stop-color="#010711" stop-opacity=".04"/><stop offset="1" stop-color="#010711" stop-opacity="0"/></linearGradient></defs><circle cx="${x}" cy="${y}" r="${r*1.05}" fill="url(#${prefix}-air)"/><circle cx="${x}" cy="${y}" r="${r}" fill="#10395e"/><g clip-path="url(#${prefix}-earth-disc)"><image href="/assets/earth-blue-marble.jpg" x="${x-r}" y="${y-r}" width="${r*2}" height="${r*2}" preserveAspectRatio="xMidYMid slice" transform="rotate(${rotationDeg} ${x} ${y})"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#${prefix}-night)"/></g><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#8fd4f5" stroke-opacity=".55" stroke-width="1.3"/></g>`;
}

// Body geometry and poses are shared with assembly validation. Artwork is local.
function partArtwork(id: string, width: number, height: number, prefix: string): string {
  const x = -width / 2, y = -height / 2;
  const hull = `url(#${prefix}-hull)`, dark = `url(#${prefix}-dark)`;
  const stroke = '#64767a';
  if (id.includes('command')) return `<path d="M${x},${height/2} L${-width*.35},${-height*.12} Q0,${-height*.76} ${width*.35},${-height*.12} L${width/2},${height/2}Z" fill="${hull}" stroke="${stroke}" stroke-width=".8"/><path d="M${-width*.22},${-height*.1}Q0,${-height*.35} ${width*.22},${-height*.1}L${width*.19},${height*.12}H${-width*.19}Z" fill="#173542" stroke="#97a9a9" stroke-width=".6"/><path d="M${x},${height*.36}H${width/2}" stroke="#7b8988" stroke-width="1.4"/><path d="M${x+3},${height*.42}H${width/2-3}" stroke="#edf0df" stroke-width="1.2"/>`;
  if (id.includes('engine')) return `<rect x="${-width*.28}" y="${y}" width="${width*.56}" height="${height*.22}" rx="2" fill="${hull}" stroke="${stroke}" stroke-width=".8"/><path d="M${-width*.19},${-height*.3}L${-width*.13},${-height*.04}L${x},${height/2}Q0,${height*.48} ${width/2},${height/2}L${width*.13},${-height*.04}L${width*.19},${-height*.3}Z" fill="${dark}" stroke="#758489" stroke-width=".9"/>${[.06,.15,.24,.33,.42].map(v => `<path d="M${-width*(.18+v*.64)},${height*v}H${width*(.18+v*.64)}" stroke="#9aa29d" stroke-opacity=".4" stroke-width=".7"/>`).join('')}<path d="M${-width*.35},${-height*.37}V${height*.05}" fill="none" stroke="#c3cac0" stroke-width="2"/>`;
  if (id.includes('solar')) return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="1" fill="url(#${prefix}-cells)" stroke="#b0bfb9" stroke-width="1"/><path d="M0,${y}V${height/2}" stroke="#b5c3bf" stroke-width="1.3"/><path d="M${x},0H${width/2}" stroke="#b5c3bf" stroke-width=".6"/>`;
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="2" fill="${hull}" stroke="${stroke}" stroke-width=".8"/><path d="M${x},${y+height*.07}H${width/2}M${x},${y+height*.93}H${width/2}" stroke="#53676d" stroke-width="2"/><rect x="${x+1}" y="${y+height*.32}" width="${width-2}" height="${height*.035}" fill="#a39262" opacity=".8"/><path d="M${width*.31},${y+height*.12}V${y+height*.88}" stroke="#fffef2" stroke-opacity=".5"/><text x="0" y="${height*.16}" text-anchor="middle" fill="#65787c" font-family="monospace" font-size="5" letter-spacing="2">A S T R A</text>`;
}

function svg(prefix: string, title: string, content: string): string {
  const markup = `<svg class="mission-scene" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 620" role="img" aria-labelledby="${prefix}-title"><title id="${prefix}-title">${title}</title>${definitions(prefix)}${content}</svg>`;
  // Multiple snapshots may share a page; SVG paint IDs are document-global.
  const sizedMarkup = prefix === 'assembly' ? markup.replace('viewBox="0 0 900 620"', 'viewBox="0 0 600 620"') : markup;
  return sizedMarkup.replaceAll(`${prefix}-`, `${prefix}-${++svgInstance}-`);
}

export function assemblyCamera(parts: readonly PartInstance[], zoom = 1) {
  const bounds = assemblyBounds(parts, PARTS);
  return {
    centreX: (bounds.minX + bounds.maxX) / 2,
    centreY: (bounds.minY + bounds.maxY) / 2,
    pixelsPerM: Math.min(48, 468 / Math.max(bounds.widthM, 1), 484 / Math.max(bounds.heightM, 1)) * Math.max(.2, Math.min(8, zoom)),
    viewBox: {x: 0, y: 0, width: 600, height: 620},
  };
}

export function assemblyPointFromSvg(point: Vec2, parts: readonly PartInstance[], zoom = 1): Vec2 {
  const camera = assemblyCamera(parts, zoom);
  return {x: (point.x - 300) / camera.pixelsPerM + camera.centreX, y: camera.centreY - (point.y - 310) / camera.pixelsPerM};
}

export function renderAssemblyScene({ parts = SAMPLE_CRAFT, selectedPartId, showNodes = true, zoom = 1, ghost, ghostParts, ghostValid = false }: {parts?: PartInstance[]; selectedPartId?: string; showNodes?: boolean; zoom?: number; ghost?: PartInstance; ghostParts?: PartInstance[]; ghostValid?: boolean} = {}): string {
  const camera = assemblyCamera(parts, zoom), scale = camera.pixelsPerM;
  const transform = `translate(${300-camera.centreX*scale} ${310+camera.centreY*scale})`;
  const previews = ghostParts ?? (ghost ? [ghost] : []);
  const previewRoot = previews.find(p=>p.id === (ghost?.id ?? selectedPartId)) ?? previews[0];
  const movingIds = new Set(previews.map(p=>p.id));
  const originalArtwork = parts.map(part=>`<g opacity="${movingIds.has(part.id) ? '.22' : '1'}">${craft('assembly', scale, selectedPartId, showNodes, [part])}</g>`).join('');
  const previewArtwork = previewRoot ? `<g opacity=".72" pointer-events="none" data-drag-preview="${ghostValid ? 'valid' : 'invalid'}">${craft('assembly', scale, previewRoot.id, true, previews)}<g transform="translate(${previewRoot.positionM.x*scale} ${-previewRoot.positionM.y*scale})"><circle r="12" fill="${ghostValid ? '#217c68' : '#b34a39'}"/><text text-anchor="middle" y="4" font-family="sans-serif" font-size="14" fill="white">${ghostValid ? '+' : '×'}</text></g></g>` : '';
  return svg('assembly', 'Spacecraft assembly with compatible attachment nodes', `<rect width="600" height="620" fill="url(#assembly-grid)"/><path d="M300 30V590M30 310H570" stroke="#6c949d" stroke-opacity=".15" stroke-dasharray="4 7"/><g transform="${transform}">${originalArtwork}${previewArtwork}</g><path d="M24 24h18M24 24v18M576 24h-18M576 24v18M24 596h18M24 596v-18M576 596h-18M576 596v-18" fill="none" stroke="#6e969d" stroke-opacity=".4"/>`);
}

export function renderFlightScene({ state, throttle = .68, showVectors = false, zoom = 1 }: {state?: FlightState; throttle?: number; showVectors?: boolean; zoom?:number} = {}): string {
  if (state) return renderPhysicalFlight(state, showVectors, zoom);
  const power = Math.max(0, Math.min(1, throttle));
  return svg('flight', 'Illustrative powered flight above the Earth limb', `<rect width="900" height="620" fill="url(#flight-sky)"/>${stars()}${earthArtwork('flight',370,1460,996)}<g transform="translate(460 267) rotate(12)">${exhaust(power, 29)}${craft('flight', 29)}${showVectors ? '<path d="M-70 115L-25-155l-7 9m7-9 3 11" fill="none" stroke="#7fc3d0" stroke-width="1.3"/><text x="-104" y="-166" fill="#9bd0da" font-family="monospace" font-size="10">Velocity</text><path d="M0-170v-48l-5 9m5-9 5 9" fill="none" stroke="#e6b76e" stroke-width="1.3"/><text x="12" y="-204" fill="#e6b76e" font-family="monospace" font-size="10">Attitude</text>' : ''}</g>`);
}

function exhaust(power: number, scale: number, parts: readonly PartInstance[] = SAMPLE_CRAFT): string {
  if (power <= 0) return '';
  return parts.map(instance => {
    const definition = getPart(instance.definitionId);
    if (!definition || definition.category !== 'engine') return '';
    const outlet = definition.engine.exhaustOriginM;
    const direction = definition.engine.exhaustDirection;
    const plumeAngle = Math.atan2(direction.x, -direction.y) * -180 / Math.PI;
    const halfWidth = definition.widthM * scale * .18;
    return `<g transform="translate(${instance.positionM.x*scale} ${-instance.positionM.y*scale}) rotate(${-instance.angleRad*180/Math.PI}) translate(${outlet.x*scale} ${-outlet.y*scale}) rotate(${plumeAngle})"><path d="M${-halfWidth} 0Q${-halfWidth*1.4} ${40+power*100} 0 ${60+power*155}Q${halfWidth*1.4} ${40+power*100} ${halfWidth} 0Z" fill="url(#flight-flame)"/><path d="M${-halfWidth*.4} 0L0 ${24+power*62}L${halfWidth*.4} 0Z" fill="#fffce0" opacity=".85"/></g>`;
  }).join('');
}

export function renderOrbitScene({ state, showPrediction = true, zoom = 1, mission }: {state?: FlightState; showPrediction?: boolean; zoom?:number; mission?:MissionState|null} = {}): string {
  if (state) return renderPhysicalOrbit(state, showPrediction, zoom, mission);
  // Static circular coast path. The alternative ellipse meets the craft at
  // periapsis and has Earth at a focus: c=45, a=287, b=sqrt(a²-c²).
  const alternativeSemiMinor = Math.sqrt(287 ** 2 - 45 ** 2);
  return svg('orbit', 'Static illustrative Earth orbit with an optional alternative path, not a calculated manoeuvre', `<rect width="900" height="620" fill="#0a151e"/>${stars()}${earthArtwork('orbit',425,310,116)}<circle cx="425" cy="310" r="242" fill="none" stroke="#91b9ba" stroke-width="1.2"/>${showPrediction ? `<ellipse cx="380" cy="310" rx="287" ry="${alternativeSemiMinor}" fill="none" stroke="#d7b274" stroke-width="1" stroke-dasharray="5 7" opacity=".8"/>` : ''}<g transform="translate(667 310) scale(.16)">${craft('orbit', 29)}</g><circle cx="667" cy="310" r="8" fill="none" stroke="#e4b872" stroke-opacity=".8"/><circle cx="183" cy="310" r="3" fill="#a7c6c4"/><path d="M425 172V161M425 448V459M287 310H276M563 310H574" stroke="#79a2a6" stroke-opacity=".4"/>`);
}

function renderPhysicalFlight(state: FlightState, vectors: boolean, zoom = 1): string {
  const parts = state.assembly.parts;
  const bounds = assemblyBounds(parts, PARTS);
  const scale = Math.min(30, 330 / Math.max(1, bounds.heightM), 370 / Math.max(1, bounds.widthM)) * Math.max(.2,Math.min(8,zoom));
  const centre = {x: (bounds.minX+bounds.maxX)/2, y:(bounds.minY+bounds.maxY)/2};
  const radius = Math.hypot(state.positionM.x, state.positionM.y);
  const up = {x: state.positionM.x/radius, y: state.positionM.y/radius};
  const right = {x: up.y, y:-up.x};
  const altitude = Math.max(0, radius-EARTH.radiusM);
  const radialAngle = Math.atan2(-up.x, up.y);
  const rotation = -(state.angleRad-radialAngle)*180/Math.PI;
  const atmosphere = Math.max(0, 1-altitude/100000);
  const worldCentreOffset = rotate(centre, state.angleRad);
  const centreAltitude = altitude + worldCentreOffset.x*up.x + worldCentreOffset.y*up.y;
  const groundY = 300+centreAltitude*scale;
  const padX = 450-(state.positionM.x+worldCentreOffset.x)*scale;
  const activeThrust = state.thrustN > 0 && state.status !== 'crashed' ? state.throttle : 0;
  const vx = state.velocityMPerS.x*right.x + state.velocityMPerS.y*right.y;
  const vy = -(state.velocityMPerS.x*up.x + state.velocityMPerS.y*up.y);
  const speed = Math.hypot(vx,vy);
  const arrow = (dx:number,dy:number,colour:string,label:string) => {
    const length = Math.hypot(dx,dy) || 1;
    const x = dx/length*100, y = dy/length*100;
    return `<g><path d="M450 300l${x} ${y}" stroke="${colour}" stroke-width="2"/><circle cx="${450+x}" cy="${300+y}" r="3" fill="${colour}"/><text x="${450+x+10}" y="${300+y-8}" fill="${colour}" font-family="sans-serif" font-size="13">${label}</text></g>`;
  };
  const bodyNose = {x:-Math.sin(state.angleRad), y:Math.cos(state.angleRad)};
  const heading = {x: bodyNose.x*right.x+bodyNose.y*right.y,y:-(bodyNose.x*up.x+bodyNose.y*up.y)};
  return svg('flight', 'Live spacecraft flight in a local vertical frame', `<rect width="900" height="620" fill="#09141e"/>${stars()}<rect width="900" height="620" fill="#6195ae" opacity="${atmosphere*.65}"/>${altitude > 1000 ? earthArtwork('flight',450,1250,800-Math.min(80,altitude/10000),state.timeS*EARTH.rotationRadPerS*180/Math.PI) : ''}${groundY < 700 ? `<path d="M0 ${groundY}H900V620H0Z" fill="#48584e"/><path d="M0 ${groundY}H900" stroke="#a9b2a0" stroke-width="2"/><rect x="${padX-70}" y="${groundY-6}" width="140" height="6" fill="#b6bbb0"/>` : ''}<g transform="translate(450 300) rotate(${rotation}) translate(${-centre.x*scale} ${centre.y*scale})">${exhaust(activeThrust,scale,parts)}${craft('flight',scale,undefined,false,parts)}</g>${vectors ? arrow(heading.x,heading.y,'#e6b76e','Attitude') + (speed>1 ? arrow(vx,vy,'#9bd0da','Inertial velocity') : '') : ''}${state.status === 'crashed' ? '<text x="450" y="70" text-anchor="middle" fill="#f0bb88" font-family="sans-serif" font-size="20">Surface impact</text>' : ''}`);
}

export function orbitCamera(state: FlightState, zoom=1) {
  const points = predictCoast(state.positionM,state.velocityMPerS,200);
  const range = Math.max(EARTH.radiusM*1.35,Math.hypot(state.positionM.x,state.positionM.y),...points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)).map(p=>Math.hypot(p.x,p.y)));
  const z=Math.max(.2,Math.min(8,zoom)), follow=Math.min(1,Math.max(0,z-1));
  return {centreX:state.positionM.x*follow,centreY:state.positionM.y*follow,pixelsPerM:252/range*z,viewBox:{x:0,y:0,width:900,height:620}};
}

function missionMarkers(state:FlightState,screen:(p:Vec2)=>Vec2,mission:MissionState):string {
  const geometry=missionGeometry(state);
  const marker=(position:Vec2,label:string,id:string,kind:'target'|'station',active:boolean)=>{
    const p=screen(position), colour=active?'#95e1bf':kind==='target'?'#f3bd69':'#90cee3';
    return `<g data-mission-marker="${id}"><title>${escape(label)} · ${kind}${active?' · active window':''}</title>${kind==='target'?`<circle cx="${p.x}" cy="${p.y}" r="6" fill="#112b36" stroke="${colour}" stroke-width="2"/><circle cx="${p.x}" cy="${p.y}" r="2" fill="${colour}"/>`:`<rect x="${p.x-5}" y="${p.y-5}" width="10" height="10" fill="#112b36" stroke="${colour}" stroke-width="2"/>`}<text x="${p.x+11}" y="${p.y-11}" fill="${colour}" font-family="sans-serif" font-size="13">${escape(label)}</text></g>`;
  };
  const stationLinks=geometry.contact?geometry.stationPositions.map(p=>{const a=screen(p),b=screen(state.positionM);return `<path d="M${a.x} ${a.y}L${b.x} ${b.y}" stroke="#95e1bf" stroke-width="1.2" stroke-dasharray="5 5"/>`;}).join(''):'';
  return `${stationLinks}${MISSION_CONFIG.targets.map(t=>marker(surfacePoint(t.longitudeRad,state.timeS),t.name,t.id,'target',geometry.observationWindow&&mission.status==='active')).join('')}${MISSION_CONFIG.stations.map(s=>marker(surfacePoint(s.longitudeRad,state.timeS),s.name,s.id,'station',geometry.contact)).join('')}`;
}

function renderPhysicalOrbit(state: FlightState, showPrediction: boolean, zoom=1, mission?:MissionState|null): string {
  const points = showPrediction ? predictCoast(state.positionM, state.velocityMPerS, 200) : [];
  const finitePoints = points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
  const camera=orbitCamera(state,zoom), scale=camera.pixelsPerM;
  const screen = (p:Vec2) => ({x:450+(p.x-camera.centreX)*scale,y:310-(p.y-camera.centreY)*scale});
  const earthCentre=screen({x:0,y:0});
  const current = screen(state.positionM), earthR = EARTH.radiusM*scale;
  const path = finitePoints.map((p,i)=>{const q=screen(p);return `${i?'L':'M'}${q.x.toFixed(2)} ${q.y.toFixed(2)}`;}).join(' ');
  const info = telemetry(state);
  const surfaceEnd = finitePoints.at(-1);
  const intercept = surfaceEnd && Math.hypot(surfaceEnd.x,surfaceEnd.y) <= EARTH.radiusM+100;
  const end = surfaceEnd ? screen(surfaceEnd) : current;
  const markers = [
    {kind:'Periapsis', value:info.periapsisM, point: finitePoints.reduce<Vec2|undefined>((best,p)=>!best||Math.hypot(p.x,p.y)<Math.hypot(best.x,best.y)?p:best,undefined)},
    {kind:'Apoapsis', value:info.apoapsisM, point: finitePoints.reduce<Vec2|undefined>((best,p)=>!best||Math.hypot(p.x,p.y)>Math.hypot(best.x,best.y)?p:best,undefined)},
  ].filter(m=>m.value !== null && m.point && m.value >= 0 && !info.escape && !intercept);
  return svg('orbit', 'Live Earth-centred orbit and coast prediction from current position and velocity', `<rect width="900" height="620" fill="#0a151e"/>${stars()}${earthArtwork('orbit',earthCentre.x,earthCentre.y,earthR,state.timeS*EARTH.rotationRadPerS*180/Math.PI)}${mission ? missionMarkers(state,screen,mission) : ''}${path ? `<path d="${path}" fill="none" stroke="#a8c9ca" stroke-width="1.6"/>` : ''}${markers.map(m=>{const p=screen(m.point!);return `<circle cx="${p.x}" cy="${p.y}" r="3" fill="#b2cecf"/><text x="${p.x+8}" y="${p.y-8}" fill="#c5d7d3" font-family="sans-serif" font-size="12">${m.kind} ${Math.round(m.value!/1000)} km</text>`;}).join('')}<circle cx="${current.x}" cy="${current.y}" r="5" fill="#efb65b"/><circle cx="${current.x}" cy="${current.y}" r="10" fill="none" stroke="#efb65b" stroke-opacity=".65"/>${intercept ? `<path d="M${end.x-5} ${end.y-5}l10 10m-10 0 10-10" stroke="#f0ac7b" stroke-width="2"/><text x="${end.x+10}" y="${end.y+20}" fill="#f0bd99" font-family="sans-serif" font-size="12">Surface intercept</text>` : ''}<text x="30" y="588" fill="#8aa9ad" font-family="monospace" font-size="12">${info.escape ? 'ESCAPE TRAJECTORY' : 'EARTH-CENTRED COAST'} · ${showPrediction ? 'VACUUM COAST · DRAG NOT PREDICTED' : 'PREDICTION HIDDEN'}</text>`);
}

// Filled against the shared schema below; no independent geometry catalogue.
function craft(prefix: string, scale: number, selected?: string, nodes = false, parts: readonly PartInstance[] = SAMPLE_CRAFT): string {
  return parts.map(instance => {
    const definition = getPart(instance.definitionId);
    if (!definition) return '';
    const width = definition.widthM * scale, height = definition.heightM * scale;
    const chosen = instance.id === selected || instance.definitionId === selected;
    return `<g data-part-id="${escape(instance.id)}" transform="translate(${instance.positionM.x*scale} ${-instance.positionM.y*scale}) rotate(${-instance.angleRad*180/Math.PI})"><title>${escape(definition.name)}</title>${chosen ? `<rect x="${-width/2-5}" y="${-height/2-5}" width="${width+10}" height="${height+10}" rx="4" fill="#e5b96f" fill-opacity=".06" stroke="#e5b96f" stroke-width="1.3"/>` : ''}${partArtwork(instance.definitionId, width, height, prefix)}${nodes ? definition.connectors.map(node => `<circle data-node-id="${escape(node.id)}" data-part-id="${escape(instance.id)}" cx="${node.positionM.x*scale}" cy="${-node.positionM.y*scale}" r="4.5" fill="#102936" stroke="#8cbdc7" stroke-width="1.5"/>`).join('') : ''}</g>`;
  }).join('');
}

export function renderPartIcon(definitionId: string): string {
  const definition = getPart(definitionId);
  if (!definition) return '';
  const unit = Math.min(50/definition.widthM, 62/definition.heightM);
  const prefix = `icon-${escape(definitionId)}-${++svgInstance}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" role="img" aria-label="${escape(definition.name)}">${definitions(prefix)}<g transform="translate(40 40)">${partArtwork(definitionId, definition.widthM*unit, definition.heightM*unit, prefix)}</g></svg>`;
}







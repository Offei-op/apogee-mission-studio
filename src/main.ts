import './style.css';
import { PARTS, getPart, SAMPLE_CRAFT, SAMPLE_CONNECTIONS } from './data/parts';
import type { VehicleAssembly, PartInstance, Vec2 } from './core/types';
import { massProperties } from './core/assembly';
import { addPart, movePart, removePart, autoAttach, rotatePart, readiness } from './core/builder';
import { createFlight, advanceFlight, telemetry, EARTH } from './core/dynamics';
import type { FlightState } from './core/dynamics';
import { createMission, stepMission, missionPower, missionTelemetry, missionReport, endMission, MISSION_CONFIG } from './core/mission';
import type { MissionState } from './core/mission';
import { encodeSession, decodeSession } from './core/session';
import { renderAssemblyScene, renderFlightScene, renderOrbitScene, renderPartIcon, assemblyPointFromSvg } from './render/scenes';

type View = 'assembly' | 'flight' | 'orbit' | 'mission';
let view: View = 'assembly';
let craft: VehicleAssembly = referenceCraft();
let selectedId: string | null = 'tank-1';
let libraryId = 'tank';
let zoom = 1, flightZoom = 1, orbitZoom = 1, nodes = true, vectors = true, prediction = true;
let flight: FlightState | null = null;
let mission: MissionState | null = null;
let paused = true, warp = 1, elapsedRemainder = 0;
let notice = 'Reference craft loaded. Arrays snap to either side; open Mission for your science brief.';
const SAVE_KEY = 'apogee-m2-session';
let lastAutosave = 0;
let canAutosave = true;
const undoStack: VehicleAssembly[] = [], redoStack: VehicleAssembly[] = [];
let drag: {definitionId:string;instanceId?:string;start:Vec2;offset:Vec2;position:Vec2;active:boolean;pointerId:number} | null = null;
let suppressClickUntil = 0;
const app = document.querySelector<HTMLDivElement>('#app')!;
const arrow = '<span aria-hidden="true">→</span>';
const labels: Record<string,{name:string;summary:string}> = {
 command:{name:'Command module',summary:'Guidance and attitude control.'},tank:{name:'Fuel tank',summary:'Liquid propellant storage.'},
 engine:{name:'Liquid engine',summary:'Throttleable thrust.'},solar:{name:'Solar array',summary:'Electrical generation.'},
};
function referenceCraft():VehicleAssembly { return {id:'pathfinder',parts:structuredClone(SAMPLE_CRAFT),connections:structuredClone(SAMPLE_CONNECTIONS)}; }
const escape = (v:unknown) => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const num = (n:number,d=0) => Number.isFinite(n)?n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const fmtTime = (s:number) => `${Math.floor(s/3600).toString().padStart(2,'0')}:${Math.floor(s/60%60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}`;
function selected() { return craft.parts.find(p=>p.id===selectedId); }
function definition() { return getPart(selected()?.definitionId??libraryId)!; }
function metric(label:string,value:string,unit='',key='') { return `<div class="metric"><span>${label}</span><strong ${key?`data-live="${key}"`:''}>${escape(value)}<small>${escape(unit)}</small></strong></div>`; }
function button(text:string,action:string,cls='secondary-button',disabled=false) { return `<button class="${cls}" data-action="${action}" ${disabled?'disabled':''}>${text}</button>`; }
function header() { return `<header class="topbar"><a class="brand" href="#" aria-label="Apogee build home"><span class="brand-symbol" aria-hidden="true">A<span>•</span></span><span>APOGEE<small>MISSION STUDIO</small></span></a><nav class="view-tabs" aria-label="Studio views">${([['assembly','1','Build'],['flight','2','Fly'],['orbit','3','Orbit'],['mission','4','Mission']] as const).map(([id,n,label])=>`<button data-view="${id}" class="view-tab ${view===id?'active':''}" aria-current="${view===id?'page':'false'}"><span>${n}</span>${label}</button>`).join('')}</nav><button class="save-button" data-action="save">Save session</button></header><div class="mission-strip"><div><strong>First light</strong><span class="mission-description">${mission?'Return a coastal observation':'Build · launch · explore'}</span></div><div class="session-tools">${button('Resume saved','restore','compact-button')}${button('Export','export','compact-button')}${button('Import','import','compact-button')}<input id="session-file" type="file" accept=".json,application/json" hidden></div></div>`; }
function library() { return `<aside class="left-panel"><div class="panel-heading"><h1>Parts library</h1><p>Drag a part onto a matching connector.</p></div><div class="parts-list">${PARTS.map(p=>`<button class="part-card ${libraryId===p.id?'selected':''}" data-library="${p.id}" aria-pressed="${libraryId===p.id}" title="Drag to assemble, or select then use Add part"><span class="part-icon">${renderPartIcon(p.id)}</span><span class="part-card-text"><strong>${escape(labels[p.id]?.name??p.name)}</strong><span>${escape(labels[p.id]?.summary??p.description)}</span></span><span class="part-select-mark" aria-hidden="true">+</span></button>`).join('')}</div><div class="builder-actions">${button('Undo','undo','compact-button',!undoStack.length)}${button('Redo','redo','compact-button',!redoStack.length)}${button('New craft','new','compact-button')}${button('Load reference','reference','compact-button')}</div><div class="tray-note"><span class="note-symbol">i</span><p><strong>Build a connected stack</strong>Command module → tank → engine. Select a library part and use Add part for keyboard placement.</p></div></aside>`; }
function inspector() {
 const d=definition(),p=selected(),r=readiness(craft),m=massProperties(craft.parts,PARTS);
 return `<aside class="right-panel builder-inspector"><div class="inspector-scroll"><div class="panel-heading"><span class="eyebrow">${p?'SELECTED PART':'LIBRARY PART'}</span><h2>${escape(d.name)}</h2><p>${p?'On your spacecraft':'Ready to attach'}</p></div><div class="part-overview"><div class="inspector-hero">${renderPartIcon(d.id)}</div><p class="component-description">${escape(d.description)}</p></div><div class="spec-list">${metric('Dry mass',num(d.dryMassKg),' kg')}${metric('Connector',num(d.connectors[0]?.sizeM??0,1),' m')}</div><div class="builder-actions inspector-actions">${button('Add part','add','compact-button')}${button('Remove part','remove','compact-button',!p)}${p&&d.category==='solar'?button('Flip side','flip','compact-button'):''}</div>${p&&d.category==='tank'?`<div class="fill-control"><label for="fuel-fill">Tank fill <strong>${num((p.propellantKg??0)/d.tank.capacityKg*100)}%</strong></label><input id="fuel-fill" type="range" min="0" max="100" step="5" value="${(p.propellantKg??0)/d.tank.capacityKg*100}"></div>`:''}<details class="engineering-details"><summary>Vehicle engineering</summary><div class="spec-list">${metric('Wet mass',num(m.wetMassKg),' kg')}${metric('Dry mass',num(m.dryMassKg),' kg')}${metric('Fuel',num(m.propellantKg),' kg')}${metric('Cost',num(m.costCredits),' cr')}${metric('Lift-off TWR',num(r.metrics.twr,2))}${metric('Ideal delta-v',num(r.metrics.deltaVMPerS),' m/s')}${metric('Centre of mass x',num(m.centreOfMassM.x,3),' m')}${metric('Inertia',num(m.inertiaKgM2),' kg m²')}</div></details><div class="readiness"><h3>Assembly checks</h3>${r.blockers.length?r.blockers.map(i=>`<p class="check-error">! ${escape(i.message)}</p>`).join(''):'<p class="check-good">✓ Connections and fuel feed ready</p>'}${r.warnings.map(i=>`<p class="check-warning">△ ${escape(i.message)}</p>`).join('')}</div></div><button class="primary-button" data-action="launchpad" ${r.blockers.length?'disabled':''}>Go to launchpad ${arrow}</button></aside>`;
}
function assemblyScreen() { return `${library()}<section class="scene-panel assembly-panel" aria-label="Spacecraft assembly"><div class="canvas-top"><span class="canvas-title">Spacecraft assembly</span><span class="scale-label">2D</span></div><div class="scene-art assembly-art">${renderAssemblyScene({parts:craft.parts,selectedPartId:selectedId??undefined,showNodes:nodes,zoom})}</div><div class="canvas-bottom"><span class="canvas-caption">Drag to snap · click to inspect</span><div class="canvas-controls">${button('Nodes','nodes','toggle-button')}<button class="icon-button" data-action="zoom-out" aria-label="Zoom out">−</button><span class="zoom-value">${num(zoom*100)}%</span><button class="icon-button" data-action="zoom-in" aria-label="Zoom in">+</button></div></div></section>${inspector()}`; }
function liveLeft() {
 const t=telemetry(flight!);
 return `<aside class="left-panel"><div class="panel-heading"><h1>${view==='orbit'?'Orbital map':'Flight deck'}</h1><p>Live Earth flight · SI units</p></div><div class="telemetry-group">${metric('Altitude',num(t.altitudeM/1000,1),' km','altitude')}${metric('Inertial speed',num(t.speedMPerS),' m/s','speed')}${metric('Vertical speed',num(t.verticalSpeedMPerS),' m/s','vertical')}${metric('Horizontal speed',num(t.horizontalSpeedMPerS),' m/s','horizontal')}${metric('Apoapsis',t.apoapsisM===null?'—':num(t.apoapsisM/1000,1),' km','apo')}${metric('Periapsis',t.periapsisM===null?'—':num(t.periapsisM/1000,1),' km','peri')}</div><div class="flight-status"><span class="eyebrow">FLIGHT STATUS</span><strong data-live="status"></strong><p data-live="flight-message"></p></div><div class="tray-note"><p><strong>Flight keys</strong>← / → steer · ↑ / ↓ throttle<br>Space cuts thrust · P pauses<br>Turn first, then burn to change orbit.</p></div></aside>`;
}
function missionOperations() {
 if(!mission||!flight)return `<div class="mission-operations"><h3>Science mission</h3><p>Launch a complete survey mission from its briefing.</p>${button('Open mission brief','mission','compact-button')}</div>`;
 const t=missionTelemetry(mission,flight),disabled=mission.status!=='active';
 return `<div class="mission-operations"><h3>Science operations</h3><div class="resource-label"><span>Battery</span><strong data-live="battery">${num(flight.batteryWh,1)} Wh</strong></div><div class="resource-label"><span>Onboard data</span><strong data-live="storage">${num(t.storageMB,1)} / 32 MB</strong></div><div class="resource-label"><span>Returned</span><strong data-live="delivered">${num(t.deliveredMB,1)} MB</strong></div><div class="resource-label"><span>Payload draw</span><strong data-live="payload-power">${num(t.powerDrawW)} W</strong></div><p data-live="contact">${t.contact?'Ground contact available':'No ground contact'}</p><p data-live="mission-message">${escape(t.message)}</p><div class="operation-toggles"><button data-action="camera" class="toggle-button ${mission.cameraEnabled?'is-on':''}" aria-pressed="${mission.cameraEnabled}" ${disabled?'disabled':''}>Camera ${mission.cameraEnabled?'on':'off'}</button><button data-action="downlink" class="toggle-button ${mission.downlinkEnabled?'is-on':''}" aria-pressed="${mission.downlinkEnabled}" ${disabled?'disabled':''}>Radio ${mission.downlinkEnabled?'on':'off'}</button></div>${button('Mission dashboard','mission','compact-button')}${button('Coast at 100×','coast','compact-button',flight.throttle>0||flight.assistance)}</div>`;
}
function zoomControls() {
 const z=view==='flight'?flightZoom:view==='orbit'?orbitZoom:zoom;
 return `<div class="scene-zoom" aria-label="View zoom"><button class="icon-button" data-action="view-zoom-out" aria-label="Zoom view out">−</button><span data-zoom-label>${num(z*100)}%</span><button class="icon-button" data-action="view-zoom-in" aria-label="Zoom view in">+</button>${button('Fit','view-fit','compact-button')}</div>`;
}
function reportRows():Array<{label:string;value:string}> {
 if(!mission||!flight)return [];
 const r=missionReport(mission,flight),t=missionTelemetry(mission,flight);
 return [{label:'Mission cost',value:`${num(mission.designCostCredits)} cr`},{label:'Budget remaining',value:`${num(MISSION_CONFIG.budgetCredits-mission.designCostCredits)} cr`},{label:'Elapsed mission time',value:fmtTime(r.metrics.elapsedS)},{label:'Observations returned',value:`${t.completedObservations} / 1`},{label:'Data returned',value:`${num(t.deliveredMB,2)} MB`},{label:'Data still onboard',value:`${num(t.storageMB,2)} MB`},{label:'Battery remaining',value:`${num(flight.batteryWh,2)} Wh`},{label:'Minimum battery',value:`${num(mission.stats.minimumBatteryWh,2)} Wh`},{label:'Payload energy used',value:`${num(mission.stats.payloadEnergyWh,2)} Wh`},{label:'Propellant remaining',value:`${num(telemetry(flight).propellantKg,2)} kg`}];
}
function missionScreen() {
 const cost=massProperties(craft.parts,PARTS).costCredits+MISSION_CONFIG.fixedOperationsCostCredits;
 if(!mission||!flight)return `<section class="mission-page"><div class="mission-heading"><span class="eyebrow">MISSION BRIEF / FIRST LIGHT</span><h1>Bring the science home.</h1><p>Build and launch a spacecraft, observe Equatorial Coast in daylight, then return all 16 MB through Dawn Ground Station before the two-hour deadline.</p></div><div class="brief-grid"><article><h2>Your objective</h2><ol><li>Establish an orbit above 100 km.</li><li>Collect one five-second daylight observation.</li><li>Downlink the complete observation to Earth.</li></ol><p>Collected data earns credit only after complete delivery. Contact and observation opportunities follow the actual orbit.</p></article><article><h2>Mission resources</h2>${metric('Mission budget',num(MISSION_CONFIG.budgetCredits),' cr')}${metric('Your launch cost',num(cost),' cr')}${metric('Data buffer','32',' MB')}${metric('Radio rate','1',' Mbps')}<p>Cost includes hardware, the initial propellant load and ${MISSION_CONFIG.fixedOperationsCostCredits} credits for launch and operations.</p></article><article><h2>Plan your power</h2><p>The command module includes the survey camera, radio and 32 MB buffer within its stated mass and price.</p><p>Camera: 60 W while collecting. Radio: 40 W while transmitting. Battery reserve suspends the payload before flight control loses power.</p><p>More solar generation costs mass and credits. A lighter battery-only design has less energy margin.</p></article></div><div class="mission-brief-actions"><button class="primary-button" data-action="start-mission" aria-describedby="budget-status" ${cost>MISSION_CONFIG.budgetCredits?"disabled":""}>Start science mission</button>${button('Return to build','edit','compact-button')}</div><p id="budget-status" class="mission-footnote">${cost>MISSION_CONFIG.budgetCredits?`Over budget by ${num(cost-MISSION_CONFIG.budgetCredits)} credits. Reduce hardware or fuel before starting.`:'Your design is within the mission budget.'}</p><p class="mission-footnote">Starting a science mission resets flight to the launchpad with this design. Camera and radio policies begin enabled. Ascent assistance is enabled; press Launch when ready. During coast, use 100× to reach the target pass faster.</p></section>`;
 const t=missionTelemetry(mission,flight),report=missionReport(mission,flight),finished=mission.status!=='active';
 return `<section class="mission-page"><div class="mission-heading"><span class="eyebrow">${finished?'MISSION DEBRIEF':'MISSION CONTROL'}</span><h1>${finished?(mission.status==='success'?'Science returned. Mission complete.':'Mission review'):'First light / coastal survey'}</h1><p data-live="mission-message">${escape(finished?report.summary:t.message)}</p></div><div class="mission-metrics">${metric('Objective',`${num(t.progress*100)}%`,'','progress')}${metric('Stored',num(t.storageMB,1),' MB','storage-short')}${metric('Returned',num(t.deliveredMB,1),' MB','delivered')}${metric('Battery',num(flight.batteryWh,1),' Wh','battery')}${metric('Time remaining',fmtTime(Math.max(0,mission.deadlineS-flight.timeS)),'','remaining')}</div><div class="brief-grid"><article><h2>${finished?'What happened':'Operations'}</h2>${finished?report.causes.map(c=>`<p>${escape(c)}</p>`).join(''):missionOperations()}${finished?`<h3>Try next</h3>${report.suggestions.map(s=>`<p>${escape(s)}</p>`).join('')}`:''}</article><article><h2>Mission record</h2>${finished?reportRows().map(row=>metric(row.label,row.value)).join(''):`<p data-live="contact">${t.contact?'Ground contact available':'No ground contact'}</p><p data-live="daylight">${t.sunlit?'Spacecraft in sunlight':'Spacecraft in eclipse'}</p><p>Deadline: T + ${fmtTime(mission.deadlineS)}. Five continuous seconds of target coverage are required; radio delivery can span contacts.</p>`}</article><article><h2>Event timeline</h2><ol class="mission-log" data-mission-log>${mission.log.slice(-10).map(e=>`<li><time>T + ${fmtTime(e.timeS)}</time>${escape(e.message)}</li>`).join('')}</ol></article></div><div class="mission-brief-actions">${button('Open orbital map','orbit','compact-button')}${finished?button('Retry science mission','start-mission','compact-button')+button('Download report','report','compact-button'):button('End and review','end-mission','compact-button')}${finished?'':button(paused?'Resume':'Pause','pause','compact-button')}${button('Save session','save','compact-button')}</div></section>`;
}
function liveRight() {
 const f=flight!,t=telemetry(f),initial=massProperties(craft.parts,PARTS).propellantKg;
 return `<aside class="right-panel flight-controls"><div class="inspector-scroll"><div class="panel-heading"><span class="eyebrow">PROPULSION</span><h2>Flight control</h2><p>Thrust and steering change your trajectory.</p></div><div class="throttle-display"><span>THROTTLE</span><strong data-live="throttle">${num(f.throttle*100)}%</strong></div><div class="throttle-control"><label for="throttle">Engine throttle</label><input id="throttle" type="range" min="0" max="100" value="${f.throttle*100}"><div><span>OFF</span><span>FULL</span></div></div>${button('Cut engine · Space','cutoff')}<div class="steering-controls"><button data-steer="1" aria-label="Steer left">← Left</button><button data-steer="-1" aria-label="Steer right">Right →</button></div><div class="builder-actions flight-toggles"><button class="toggle-button ${f.attitudeHold?'is-on':''}" aria-pressed="${f.attitudeHold}" data-action="hold">Attitude hold</button><button class="toggle-button ${f.assistance?'is-on':''}" aria-pressed="${f.assistance}" data-action="assist">Ascent assist</button></div><div class="resource-display"><div class="resource-label"><span>Propellant</span><strong data-live="fuel">${num(t.propellantKg)} kg</strong></div><div class="resource-bar"><i data-fuel-bar style="width:${initial?t.propellantKg/initial*100:0}%"></i></div><div class="resource-label"><span>Ideal delta-v</span><strong data-live="delta-v">${num(t.deltaVMPerS)} m/s</strong></div><p>Vacuum estimate excludes gravity and drag losses.</p></div>${missionOperations()}<div class="builder-actions">${button('Retry flight','retry','compact-button')}${button('Edit craft','edit','compact-button')}</div></div><button class="primary-button" data-action="ignite">${f.status==='pad'?'Launch':'Full throttle'} ${arrow}</button></aside>`;
}
function liveScreen() { return `${liveLeft()}<section class="scene-panel ${view==='flight'?'flight':'orbit'}-panel" aria-label="${view==='flight'?'Live flight':'Live orbital map'}"><div class="canvas-top"><span class="canvas-title">${view==='flight'?'Earth / flight':'Gravity-only coast trajectory'}</span><span class="sample-pill">LIVE PHYSICS</span></div><div class="scene-art ${view==='flight'?'flight':'orbit'}-art">${view==='flight'?renderFlightScene({state:flight!,showVectors:vectors,zoom:flightZoom}):renderOrbitScene({state:flight!,showPrediction:prediction,zoom:orbitZoom,mission:mission??undefined})}</div><div class="flight-bottom"><span class="flight-coordinate" data-live="clock">T + ${fmtTime(flight!.timeS)}</span>${button(paused?'Resume':'Pause','pause','compact-button pause-control',!!mission&&mission.status!=='active')}<div class="warp-control"><span>TIME</span>${[1,5,10,100].map(w=>`<button data-warp="${w}" class="${warp===w?'active':''}" aria-pressed="${warp===w}">${w}×</button>`).join('')}</div></div><div class="view-tools">${zoomControls()}${button(view==='flight'?'Show orbital map':'Show flight view',view==='flight'?'orbit':'flight','compact-button')}${button(view==='flight'?'Toggle vectors':'Toggle coast path',view==='flight'?'vectors':'prediction','compact-button')}</div></section>${liveRight()}`; }
function render(focusSelector?:string) {
 app.innerHTML=`${header()}<div class="mission-notice" role="status">${escape(notice)}</div><main class="workspace ${view}-workspace">${view==='assembly'?assemblyScreen():view==='mission'?missionScreen():liveScreen()}</main><footer class="statusbar"><span>M2 · Mission studio</span><span>Earth gravity · fictional hardware · single stage</span></footer>`;
 bind(); if(focusSelector)app.querySelector<HTMLElement>(focusSelector)?.focus(); if(view!=='assembly')updateLive();
}
function commit(next:VehicleAssembly,message:string,focusSelector='[data-action="add"]') { const reset=!!mission;undoStack.push(structuredClone(craft));if(undoStack.length>60)undoStack.shift();redoStack.length=0;craft=next;flight=null;mission=null;paused=true;elapsedRemainder=0;notice=message+(reset?' Flight and mission reset for the changed design.':'');if(!selected())selectedId=null;render(focusSelector);saveSession(false); }
function beginFlight() { const r=readiness(craft);if(r.blockers.length){notice=r.blockers[0].message;view='assembly';render();return false;}if(!flight)flight=createFlight(structuredClone(craft));return true; }
function changeView(next:View) { if((next==='flight'||next==='orbit')&&!beginFlight())return;if(next==='assembly'||(next==='mission'&&!mission)){paused=true;if(flight)flight.steering=0;}view=next;render(`.view-tab[data-view="${next}"]`); }
function setManualSteering(value:number) { if(!flight||view==='assembly'||(mission&&mission.status!=='active'))return;flight.steering=value;if(value){flight.assistance=false;flight.attitudeHold=false;warp=1;}updateLive(); }
function action(a:string) {
 if(a==='save'){saveSession(true);return;}
 if(a==='restore'){restoreSession();return;}
 if(a==='export'){try{download('apogee-mission.json',encodeSession(sessionInput()),'application/json');notice='Session exported. Import this file to resume on another browser.';}catch(e){notice=errorMessage(e);}render('[data-action="export"]');return;}
 if(a==='import'){app.querySelector<HTMLInputElement>('#session-file')?.click();return;}
 if(a==='mission'){changeView('mission');return;}
 if(a==='start-mission'){
  const r=readiness(craft);if(r.blockers.length){notice=r.blockers[0].message;view='assembly';render();return;}
  try{flight=createFlight(structuredClone(craft));mission=createMission(flight);flight.assistance=true;paused=true;warp=1;elapsedRemainder=0;view='flight';notice='Science mission ready. Ascent assist, camera and radio are enabled. Press Launch.';render('[data-action="ignite"]');saveSession(false);}catch(e){flight=null;mission=null;notice=errorMessage(e);view='mission';render();}return;
 }
 if(a==='end-mission'&&mission&&flight){endMission(mission,flight);flight.payloadPowerW=0;paused=true;view='mission';notice='Mission ended. Review what limited the result.';render();saveSession(false);return;}
 if(a==='report'&&mission&&flight){const report=missionReport(mission,flight);const body=`<!doctype html><html lang="en"><meta charset="utf-8"><title>Apogee mission report</title><style>body{font:17px/1.6 system-ui;max-width:900px;margin:40px auto;padding:0 24px;color:#142332}h1,h2{line-height:1.2}td,th{padding:8px 12px;border:1px solid #ccc;text-align:left}table{border-collapse:collapse;width:100%}</style><h1>First light mission report</h1><p>${escape(report.summary)}</p><h2>Causes</h2>${report.causes.map(c=>`<p>${escape(c)}</p>`).join('')}<h2>Next experiment</h2>${report.suggestions.map(c=>`<p>${escape(c)}</p>`).join('')}<h2>Metrics</h2><table>${reportRows().map(row=>`<tr><th>${escape(row.label)}</th><td>${escape(row.value)}</td></tr>`).join('')}</table><h2>Timeline</h2>${mission.log.map(e=>`<p>T + ${fmtTime(e.timeS)} — ${escape(e.message)}</p>`).join('')}<p>Educational 2D mission model. Fictional component capabilities; simplified atmosphere and communications.</p></html>`;download('apogee-mission-report.html',body,'text/html');return;}
 if(a==='camera'&&mission&&mission.status==='active'){mission.cameraEnabled=!mission.cameraEnabled;render('[data-action="camera"]');saveSession(false);return;}
 if(a==='downlink'&&mission&&mission.status==='active'){mission.downlinkEnabled=!mission.downlinkEnabled;render('[data-action="downlink"]');saveSession(false);return;}
 if(a==='coast'&&flight){if(mission&&mission.status!=='active'){notice='Mission ended. Retry to begin a new run.';render();return;}if(flight.throttle>0||flight.assistance){notice='Cut thrust and disable ascent assist before selecting a high-speed coast.';render('[data-action="coast"]');return;}warp=100;enforceWarp();paused=false;notice=`Coasting at ${warp}× toward the next opportunity. Payload policies remain active.`;render(`[data-warp="${warp}"]`);return;}
 if(a==='flip'&&selectedId){const result=rotatePart(craft,selectedId);if(result.assembly)commit(result.assembly,result.message,'[data-action="flip"]');else{notice=result.message;render('[data-action="flip"]');}return;}
 if(a==='view-zoom-in'||a==='view-zoom-out'||a==='view-fit'){setViewZoom(a==='view-fit'?1:currentViewZoom()*(a==='view-zoom-in'?1.25:.8));render(`[data-action="${a}"]`);return;}
 if(a==='undo'&&undoStack.length){redoStack.push(structuredClone(craft));craft=undoStack.pop()!;flight=null;mission=null;notice='Assembly change undone.';render('[data-action="undo"]');saveSession(false);return;}
 if(a==='redo'&&redoStack.length){undoStack.push(structuredClone(craft));craft=redoStack.pop()!;flight=null;mission=null;notice='Assembly change restored.';render('[data-action="redo"]');saveSession(false);return;}
 if(a==='new'){selectedId='command-1';commit({id:'pathfinder',parts:[{id:'command-1',definitionId:'command',positionM:{x:0,y:0},angleRad:0}],connections:[]},'New craft. Add a tank below the command module, then an engine.','[data-action="new"]');return;}
 if(a==='reference'){selectedId='tank-1';commit(referenceCraft(),'Reference craft restored. Enable ascent assist to try a guided launch.','[data-action="reference"]');return;}
 if(a==='add'){const result=autoAttach(craft,libraryId);if(result.assembly){selectedId=result.assembly.parts.find(p=>!craft.parts.some(old=>old.id===p.id))?.id??selectedId;commit(result.assembly,result.message);}else{notice=result.message;render('[data-action="add"]');}return;}
 if(a==='remove'&&selectedId){commit(removePart(craft,selectedId),'Part removed. Reconnect any remaining pieces before launch.');return;}
 if(a==='nodes')nodes=!nodes;
 if(a==='zoom-in')zoom=Math.min(8,zoom*1.25);
 if(a==='zoom-out')zoom=Math.max(.2,zoom*.8);
 if(a==='launchpad'){if(beginFlight()){view='flight';paused=true;notice='On the launchpad. Choose manual flight or enable ascent assist, then Launch.';}}
 if(a==='flight'||a==='orbit'){changeView(a);return;}
 if(a==='edit'){changeView('assembly');return;}
 if(a==='retry'){const hadMission=!!mission;flight=createFlight(structuredClone(craft));mission=hadMission?createMission(flight):null;flight.assistance=hadMission;paused=true;warp=1;elapsedRemainder=0;notice='Flight reset. Your spacecraft design is preserved.';}
 if(flight){
  if((a==='pause'||a==='ignite'||a==='coast')&&mission&&mission.status!=='active'){paused=true;notice='Mission ended. Review the result or retry with a fresh mission.';render();return;}
  if(a==='pause')paused=!paused;
  if(a==='ignite'){if(flight.status==='crashed'){notice='Flight ended. Retry or edit your craft.';}else{flight.throttle=1;paused=false;warp=1;notice=flight.assistance?'Assisted ascent running through the flight model.':'Manual flight. Steer gradually eastward to gain horizontal speed.';}}
  if(a==='cutoff'){flight.throttle=0;flight.assistance=false;notice='Engine cut. The spacecraft continues under momentum and gravity.';}
  if(a==='assist'){flight.assistance=!flight.assistance;flight.attitudeHold=true;flight.targetAngleRad=flight.angleRad;warp=1;notice=flight.assistance?'Ascent assist enabled. Launch to begin; manual steering disables it.':'Ascent assist disabled.';}
  if(a==='hold'){flight.attitudeHold=!flight.attitudeHold;flight.targetAngleRad=flight.angleRad;flight.assistance=false;}
 }
 if(a==='vectors')vectors=!vectors;
 if(a==='prediction')prediction=!prediction;
 render(`[data-action="${a}"]`);
}
function currentViewZoom():number { return view==='flight'?flightZoom:view==='orbit'?orbitZoom:zoom; }
function setViewZoom(value:number) { const z=Math.max(.2,Math.min(8,value));if(view==='flight')flightZoom=z;else if(view==='orbit')orbitZoom=z;else zoom=z; }
function sessionInput() { return {craft,flight,mission,view,settings:{zoom,flightZoom,orbitZoom}}; }
function errorMessage(e:unknown):string { return e instanceof Error?e.message:'The requested operation could not be completed.'; }
function saveSession(announce:boolean) {
 if(!canAutosave&&!announce)return;
 if(announce)canAutosave=true;
 try{localStorage.setItem(SAVE_KEY,encodeSession(sessionInput()));lastAutosave=performance.now();if(announce){notice='Session saved on this browser. Restoring always starts paused.';const status=app.querySelector('.mission-notice');if(status)status.textContent=notice;}}
 catch(e){lastAutosave=performance.now();if(announce){notice=errorMessage(e);const status=app.querySelector('.mission-notice');if(status)status.textContent=notice;}}
}
function applySaved(raw:string) { const saved=decodeSession(raw);craft=saved.craft;flight=saved.flight;mission=saved.mission;view=saved.view;zoom=saved.settings.zoom;flightZoom=saved.settings.flightZoom;orbitZoom=saved.settings.orbitZoom;paused=true;warp=1;elapsedRemainder=0;canAutosave=true;if(flight)flight.steering=0;selectedId=craft.parts[0]?.id??null;libraryId=craft.parts[0]?.definitionId??'tank';undoStack.length=0;redoStack.length=0;notice=`Saved session restored, paused at T + ${fmtTime(flight?.timeS??0)}.`;render('[data-action="save"]'); }
function restoreSession() { try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)throw new Error('No saved session exists on this browser yet.');applySaved(raw);}catch(e){notice=errorMessage(e);render('[data-action="restore"]');} }
function download(name:string,body:string,type:string) { const blob=new Blob([body],{type}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
function bind() {
 app.querySelector('.brand')?.addEventListener('click',e=>{e.preventDefault();changeView('assembly');});
 app.querySelectorAll<HTMLElement>('[data-view]').forEach(b=>b.addEventListener('click',()=>changeView(b.dataset.view as View)));
 app.querySelectorAll<HTMLElement>('[data-action]').forEach(b=>b.addEventListener('click',()=>action(b.dataset.action!)));
 app.querySelector<HTMLInputElement>('#session-file')?.addEventListener('change',async e=>{const input=e.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;try{if(file.size>2_000_000)throw new Error('Save file is too large. Maximum size is 2 MB.');applySaved(await file.text());saveSession(false);}catch(error){notice=errorMessage(error);render('[data-action="import"]');}});
 app.querySelectorAll<HTMLElement>('.assembly-art,.flight-art,.orbit-art').forEach(art=>art.addEventListener('wheel',e=>{const event=e as WheelEvent;if(drag)return;event.preventDefault();setViewZoom(currentViewZoom()*Math.exp(-Math.max(-200,Math.min(200,event.deltaY))*.002));if(view==='assembly'){const canvas=app.querySelector('.assembly-art');if(canvas)canvas.innerHTML=renderAssemblyScene({parts:craft.parts,selectedPartId:selectedId??undefined,showNodes:nodes,zoom});const label=app.querySelector('.zoom-value');if(label)label.textContent=`${num(zoom*100)}%`;bindAssemblyParts();}else{const label=app.querySelector('[data-zoom-label]');if(label)label.textContent=`${num(currentViewZoom()*100)}%`;}},{passive:false}));
 app.querySelectorAll<HTMLElement>('[data-library]').forEach(b=>{
  b.addEventListener('click',()=>{if(performance.now()<suppressClickUntil)return;libraryId=b.dataset.library!;selectedId=null;render(`[data-library="${libraryId}"]`);});
  b.addEventListener('pointerdown',e=>startDrag(e,b.dataset.library!));
 });
 bindAssemblyParts();
 app.querySelectorAll<HTMLElement>('[data-warp]').forEach(b=>b.addEventListener('click',()=>{warp=Number(b.dataset.warp);enforceWarp();render(`[data-warp="${warp}"]`);}));
 app.querySelector<HTMLInputElement>('#throttle')?.addEventListener('input',e=>{if(!flight)return;flight.throttle=Number((e.target as HTMLInputElement).value)/100;flight.assistance=false;warp=1;enforceWarp();updateLive();});
 app.querySelector<HTMLInputElement>('#fuel-fill')?.addEventListener('change',e=>{const p=selected(),d=definition();if(!p||d.category!=='tank')return;const next=structuredClone(craft);next.parts.find(i=>i.id===p.id)!.propellantKg=d.tank.capacityKg*Number((e.target as HTMLInputElement).value)/100;commit(next,'Tank fill updated. Wet mass, TWR and delta-v recalculated.','#fuel-fill');});
 app.querySelectorAll<HTMLElement>('[data-steer]').forEach(b=>{
  b.addEventListener('pointerdown',e=>{e.preventDefault();setManualSteering(Number(b.dataset.steer));});
  b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.code==='Space'){e.preventDefault();setManualSteering(Number(b.dataset.steer));}});
  b.addEventListener('keyup',e=>{if(e.key==='Enter'||e.code==='Space'){e.preventDefault();setManualSteering(0);}});
 });
}
function bindAssemblyParts() { app.querySelectorAll<SVGGElement>('.assembly-art g[data-part-id]').forEach(b=>{
 b.addEventListener('click',e=>{e.stopPropagation();if(performance.now()<suppressClickUntil)return;selectedId=b.dataset.partId!;libraryId=selected()?.definitionId??libraryId;render();});
 b.addEventListener('pointerdown',e=>{e.stopPropagation();const p=craft.parts.find(p=>p.id===b.dataset.partId);if(p)startDrag(e,p.definitionId,p);});
}); }
function svgPoint(client:Vec2):Vec2|null { const svg=app.querySelector<SVGSVGElement>('.assembly-art svg');if(!svg)return null;const ctm=svg.getScreenCTM();if(!ctm)return null;const p=new DOMPoint(client.x,client.y).matrixTransform(ctm.inverse());return assemblyPointFromSvg({x:p.x,y:p.y},craft.parts,zoom); }
function startDrag(e:PointerEvent,definitionId:string,instance?:PartInstance) { if(e.button!==0||view!=='assembly')return;const point=svgPoint({x:e.clientX,y:e.clientY});if(!point)return;drag={definitionId,instanceId:instance?.id,start:{x:e.clientX,y:e.clientY},offset:instance?{x:instance.positionM.x-point.x,y:instance.positionM.y-point.y}:{x:0,y:0},position:point,active:false,pointerId:e.pointerId}; }
function movingPart():PartInstance { const d=getPart(drag!.definitionId)!;return {id:drag!.instanceId??'drag-preview',definitionId:d.id,positionM:drag!.position,angleRad:selected()?.id===drag!.instanceId?selected()!.angleRad:0,...(d.category==='tank'?{propellantKg:d.tank.capacityKg}:{})}; }
window.addEventListener('pointermove',e=>{
 if(!drag||e.pointerId!==drag.pointerId)return;
 if(Math.hypot(e.clientX-drag.start.x,e.clientY-drag.start.y)>5)drag.active=true;
 if(!drag.active)return;e.preventDefault();const p=svgPoint({x:e.clientX,y:e.clientY});if(!p)return;drag.position={x:p.x+drag.offset.x,y:p.y+drag.offset.y};
 const moving=movingPart();const result=drag.instanceId?movePart(craft,drag.instanceId,drag.position):addPart(craft,drag.definitionId,drag.position);
 const changed=result.assembly?.parts.filter(p=>{const old=craft.parts.find(o=>o.id===p.id);return !old||Math.hypot(old.positionM.x-p.positionM.x,old.positionM.y-p.positionM.y)>1e-6||Math.abs(old.angleRad-p.angleRad)>1e-6;});
 const art=app.querySelector('.assembly-art');if(art)art.innerHTML=renderAssemblyScene({parts:craft.parts,selectedPartId:drag.instanceId,showNodes:true,zoom,ghost:result.assembly?undefined:moving,ghostParts:changed,ghostValid:!!result.assembly});
});
window.addEventListener('pointerup',e=>{
 setManualSteering(0);if(!drag||e.pointerId!==drag.pointerId)return;const current=drag;drag=null;if(!current.active)return;suppressClickUntil=performance.now()+250;
 const art=app.querySelector('.assembly-art')?.getBoundingClientRect();if(!art||e.clientX<art.left||e.clientX>art.right||e.clientY<art.top||e.clientY>art.bottom){notice='Drop inside the assembly canvas near a compatible connector.';render();return;}
 const result=current.instanceId?movePart(craft,current.instanceId,current.position):addPart(craft,current.definitionId,current.position);
 if(result.assembly){selectedId=current.instanceId??result.assembly.parts.find(p=>!craft.parts.some(old=>old.id===p.id))?.id??null;libraryId=current.definitionId;commit(result.assembly,result.message);}else{notice=result.message;render();}
});
window.addEventListener('pointercancel',()=>{drag=null;setManualSteering(0);render();});
window.addEventListener('keydown',e=>{
 if(e.defaultPrevented)return;
 if(e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement)return;
 if(e.target instanceof HTMLInputElement&&(e.target.type!=='range'||(e.code!=='Space'&&e.key.toLowerCase()!=='p')))return;
 if(view==='assembly'){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();action(e.shiftKey?'redo':'undo');}return;}
 if(view==='mission'){if(e.key.toLowerCase()==='p'&&!e.repeat){e.preventDefault();action('pause');}return;}
 if(!flight)return;
 if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setManualSteering(e.key==='ArrowLeft'?1:-1);}
 if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();flight.assistance=false;flight.throttle=Math.max(0,Math.min(1,flight.throttle+(e.key==='ArrowUp'?.05:-.05)));warp=1;enforceWarp();updateLive();}
 if(e.code==='Space'){const nativeControl=e.target instanceof Element?e.target.closest('button,a'):null;if(nativeControl&&!nativeControl.matches('[data-action="ignite"]'))return;e.preventDefault();action('cutoff');}
 if(e.key.toLowerCase()==='p'&&!e.repeat){e.preventDefault();action('pause');}
});
window.addEventListener('keyup',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight')setManualSteering(0);});
window.addEventListener('blur',()=>{if(flight)flight.steering=0;paused=true;});
document.addEventListener('visibilitychange',()=>{if(document.hidden){paused=true;if(flight)flight.steering=0;}});
function enforceWarp() { if(!flight)return;const altitude=Math.hypot(flight.positionM.x,flight.positionM.y)-EARTH.radiusM;const powered=flight.throttle>0||flight.steering!==0||flight.assistance;const limit=powered?5:altitude<100000?10:100;if(warp>limit){warp=limit;notice=`Time acceleration limited to ${limit}× during ${powered?'powered or assisted':'atmospheric'} flight.`;} }
function updateLive() {
 if(!flight||view==='assembly')return;const t=telemetry(flight);
 const values:Record<string,string>={altitude:`${num(t.altitudeM/1000,1)} km`,speed:`${num(t.speedMPerS)} m/s`,vertical:`${num(t.verticalSpeedMPerS)} m/s`,horizontal:`${num(t.horizontalSpeedMPerS)} m/s`,apo:t.apoapsisM===null?'—':`${num(t.apoapsisM/1000,1)} km`,peri:t.periapsisM===null?'—':t.periapsisM<0?'Below surface':`${num(t.periapsisM/1000,1)} km`,status:flight.status==='crashed'?'Surface impact':flight.status==='pad'?'On launchpad':t.escape?'Escape trajectory':t.periapsisM!==null&&t.periapsisM>100000?'Orbit established':'Suborbital / flight', 'flight-message':flight.message,throttle:`${num(flight.throttle*100)}%`,fuel:`${num(t.propellantKg)} kg`,'delta-v':`${num(t.deltaVMPerS)} m/s`,clock:`T + ${fmtTime(flight.timeS)} ${paused?'· PAUSED':''}`};
 if(mission){const mt=missionTelemetry(mission,flight);Object.assign(values,{battery:`${num(flight.batteryWh,1)} Wh`,storage:`${num(mt.storageMB,1)} / 32 MB`,'storage-short':`${num(mt.storageMB,1)} MB`,delivered:`${num(mt.deliveredMB,1)} MB`,'payload-power':`${num(mt.powerDrawW)} W`,progress:`${num(mt.progress*100)}%`,remaining:fmtTime(Math.max(0,mission.deadlineS-flight.timeS)),contact:mt.contact?'Ground contact available':'No ground contact',daylight:mt.sunlit?'Spacecraft in sunlight':'Spacecraft in eclipse','mission-message':mission.status==='active'?mt.message:missionReport(mission,flight).summary});const log=app.querySelector('[data-mission-log]');if(log&&mission.log.length!==Number(log.getAttribute('data-count'))){log.innerHTML=mission.log.slice(-10).map(e=>`<li><time>T + ${fmtTime(e.timeS)}</time>${escape(e.message)}</li>`).join('');log.setAttribute('data-count',String(mission.log.length));}}
 app.querySelectorAll<HTMLElement>('[data-live]').forEach(e=>{e.textContent=values[e.dataset.live!]??'';});
 const initial=massProperties(craft.parts,PARTS).propellantKg;const bar=app.querySelector<HTMLElement>('[data-fuel-bar]');if(bar)bar.style.width=`${initial?t.propellantKg/initial*100:0}%`;
 const slider=app.querySelector<HTMLInputElement>('#throttle');if(slider&&document.activeElement!==slider)slider.value=String(flight.throttle*100);
 for(const name of ['hold','assist']){const b=app.querySelector<HTMLButtonElement>(`[data-action="${name}"]`);const on=name==='hold'?flight.attitudeHold:flight.assistance;b?.setAttribute('aria-pressed',String(on));b?.classList.toggle('is-on',on);}
 const pause=app.querySelector('[data-action="pause"]');if(pause)pause.textContent=paused?'Resume':'Pause';
 const coast=app.querySelector<HTMLButtonElement>('[data-action="coast"]');if(coast)coast.disabled=flight.throttle>0||flight.assistance||!!mission&&mission.status!=='active';
 const ignite=app.querySelector<HTMLButtonElement>('[data-action="ignite"]');if(ignite){const text=flight.status==='pad'?'Launch →':'Full throttle →';if(ignite.textContent!==text)ignite.textContent=text;ignite.disabled=!!mission&&mission.status!=='active';}
 app.querySelectorAll<HTMLElement>('[data-warp]').forEach(b=>{const on=Number(b.dataset.warp)===warp;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
 const message=app.querySelector('.mission-notice');if(message&&message.textContent!==notice)message.textContent=notice;
}
let lastTime=performance.now(), lastDraw=0;
function frame(now:number) {
 const elapsed=Math.min(.1,(now-lastTime)/1000);lastTime=now;
 if(flight&&view!=='assembly'&&!paused&&flight.status!=='crashed'&&(!mission||mission.status==='active')){
  enforceWarp();elapsedRemainder+=elapsed*warp;
  while(elapsedRemainder>=.02&&!isCrashed(flight)){
   const wasAssisted=flight.assistance;
   const previousObservations=mission?.observations.length??0,wasSafe=mission?.safeMode??false;
   if(mission)flight.payloadPowerW=missionPower(mission,flight);
   advanceFlight(flight,.02);elapsedRemainder-=.02;
   if(mission){stepMission(mission,flight,.02);if(mission.observations.length>previousObservations){warp=Math.min(warp,10);notice='Observation captured. Waiting for ground contact to return all 16 MB.';elapsedRemainder=0;}if(mission.safeMode&&!wasSafe){warp=1;notice='Payload safe mode: battery reserve reached. Camera and radio paused.';elapsedRemainder=0;}if(mission.status!=='active'){flight.payloadPowerW=0;flight.steering=0;paused=true;view='mission';notice=missionReport(mission,flight).summary;render();saveSession(false);elapsedRemainder=0;break;}}
   if(wasAssisted&&!flight.assistance)notice=flight.message;
   const previousWarp=warp;enforceWarp();
   if(warp<previousWarp){elapsedRemainder=0;break;}
  }
  if(isCrashed(flight)){paused=true;notice='Surface impact. Retry flight or revise your craft.';}
 }
 if(flight&&view!=='assembly'&&now-lastDraw>33){lastDraw=now;updateLive();if(view==='flight'||view==='orbit'){const art=app.querySelector(view==='flight'?'.flight-art':'.orbit-art');if(art)art.innerHTML=view==='flight'?renderFlightScene({state:flight,showVectors:vectors,zoom:flightZoom}):renderOrbitScene({state:flight,showPrediction:prediction,zoom:orbitZoom,mission:mission??undefined});}}
 if(now-lastAutosave>5000)saveSession(false);
 requestAnimationFrame(frame);
}
function isCrashed(state:FlightState):boolean { return state.status==='crashed'; }
try{const saved=localStorage.getItem(SAVE_KEY);if(saved)applySaved(saved);else render();}catch(e){canAutosave=false;notice=`Saved session could not be restored. ${errorMessage(e)} Use Import for a different file, or Save session to replace it.`;render();}
requestAnimationFrame(frame);

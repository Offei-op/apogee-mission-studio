# M1 integration review

14 November 2026

## Outcome

The game now has a working builder and a state-driven two-dimensional flight model. The supplied reference craft reaches Earth orbit using finite thrust, fuel, torque and guidance. The enlarged interface from the approved readability revision is retained.

Specialist agents implemented the pure builder, physics/guidance and SVG rendering in separate owned files. The lead implemented the interface, pointer/keyboard handling, fixed-step browser loop and integration. Independent cross-reviews identified and resolved the issues below.

## Scope delivered

- Drag library components to compatible structural/equipment connectors; preview a complete moved subtree and reject invalid drops without partially changing the craft.
- Add parts by keyboard, remove parts, undo/redo, reset to a command module, load the reference, and adjust tank fill.
- Validate graph connectivity, node occupancy/type/size/facing, component pairing, overlap, exhaust clearance, control presence, connected propellant and electrical baseline limits. Report mass, centre of mass, inertia, cost, TWR and ideal delta-v.
- Integrate Earth gravity, rotating-atmosphere drag, variable mass, fuel flow/depletion, finite attitude control and engine gimbal. Support the launchpad, engine-off coast and surface impact.
- Provide manual throttle/steering, attitude hold, reference-tuned ascent assistance, pause, retry and live map/flight switching.
- Compute orbital elements and a gravity-only coast forecast from the current physical state. Forecasts explicitly exclude atmospheric drag and future thrust.
- Keep 0.02-second physics steps at accelerated time. Limit powered/assisted flight to 5x, atmospheric coasting to 10x and vacuum coasting to 100x. Manual inputs return to 1x; warp is checked within integration batches.

## Independent numerical evidence

The lead ran `npm test`: **32 passed, zero failed**. Fixtures include builder validity and immutability, connector mismatches, feed paths through multiple tanks, exhaust obstruction, mass accounting, origin-translation invariance, fuel depletion, the rocket equation, torque, engine-off rotation, timestep convergence, ten circular coast orbits, command replay across batch sizes, impact, prograde/retrograde burns, escape and surface-intersecting predictions.

The original component values were retained. Reference guided insertion occurs at approximately 241.10 seconds with periapsis 120.075 km, apoapsis 1,431.490 km and 64.423 kg propellant remaining. The automated reference test coasts for another full orbital period. See [M1_PHYSICS.md](M1_PHYSICS.md) for equations, tolerances, the coordinate convention and detailed model limitations.

The result is a stable eccentric orbit with a small fuel margin. It is not precision circularisation at 400 km or a claim about real hardware feasibility.

## Browser verification

In the local Chromium preview, the lead:

1. Started a new craft and attached a tank using keyboard selection and Add part. Verified that the incomplete craft could not launch.
2. Dragged an engine from the library onto the tank. The engine snapped correctly, the readiness blocker cleared and launch became available.
3. Dragged a solar array onto the command module. The drop was rejected with a compatibility explanation; the craft was unchanged.
4. Exercised Undo and Redo and observed removal/restoration of the engine.
5. Loaded the reference, entered the launchpad paused, enabled Ascent assist, launched and selected 5x. The browser reached the same approximately 120.1 km / 1,431.5 km orbit as the independent model test.
6. Switched to the live orbital map, observed fuel consumption and guidance cutoff, and continued coasting with stable displayed apsides.
7. Selected 100x coast and adjusted the throttle. The selected warp returned to 1x. Cutoff set throttle to zero; Pause froze the displayed simulation time.
8. Applied manual steering after guided insertion. Attitude hold disengaged, the rate returned to 1x and the engine-off orbit remained unchanged while attitude evolved.
9. Tested Space while the Launch button was focused: it cut thrust instead of invoking the button. Also tested keyboard throttle, retry and focus restoration.
10. Inspected browser error logs: none reported in the checked session. Inspected the final orbit screen, then checked responsive assembly/flight layout at landscape-tablet dimensions.

Local evidence includes [completed orbit](../artifacts/m1/orbit-final.jpg), [orbital telemetry](../artifacts/m1/browser-orbit-final.json) and [manual coast](../artifacts/m1/manual-coast.jpg). Screenshots are ignored local QA artifacts, not source assets.

## Review findings resolved

| Finding | Correction |
|---|---|
| Moving the editor root could alter physical launch placement | Recenter the cloned flight assembly; regression verifies identical translated designs have identical launches |
| Single-part ghost could disagree with subtree drop validation | Use the actual immutable builder operation as the preview; render all changed parts |
| Escape could be labelled as an established orbit | Check escape before bound-orbit completion |
| Keyboard builder actions lost focus on rerender | Restore an appropriate action/part control after mutations |
| Manual steering or throttle retained accelerated time | Explicit return to 1x on manual intervention |
| Large warp batches could cross a safety boundary before slowing | Check limits between fixed integration steps; assistance also retains powered-flight limits |
| Motion drawing was limited to 10 updates per second | Reduce the scene redraw interval to approximately 33 ms; this is a target, not a reference-device benchmark |
| Sticky actions obscured inspector content | Separate scrolling content from the primary action; keep Pause beside the flight clock |
| Space could activate a focused Launch button | Reserve Space for cutoff in flight, while respecting explicit steering-button hold controls |
| Velocity frames and forecast assumptions were ambiguous | Label inertial velocity and gravity-only vacuum coast; label below-surface periapsis plainly |

## Remaining boundaries

No science observations/downlinks, mission success scoring, robust saves or learning-effectiveness claims are included. Those belong to M2 and later milestones. Staging, other bodies, landing and rovers are not implemented. Pointer interaction and keyboard alternatives were checked by the lead; student playtesting, touch-device testing and performance on the declared school-laptop reference remain outstanding.

The model approximates a rigid spacecraft with point-mass translation, planar inertia, simplified drag and fixed-Sun electrical generation. Collision uses a simplified surface-impact rule. High-rate time warp runs the same physics rather than an unvalidated skip; actual throughput depends on the device. Guidance is tuned for the supplied craft and can fail with other configurations.

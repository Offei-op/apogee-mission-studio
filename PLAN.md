# Space Mission Simulator Build Plan

Updated 15 November 2026

## Purpose and current state

Build a polished browser game for secondary school students through small playable milestones. Product requirements live in [MISSION_GAME_SPECIFICATION.md](MISSION_GAME_SPECIFICATION.md); this file defines execution order, ownership and evidence of completion. Inspiration images are in [inspirations](inspirations/).

M0, M1 and M2 are complete. The browser game now connects compatible assembly and actual two-dimensional flight to a complete budgeted science mission, geometric downlink, battery/solar power, validated local saves and a causal debrief. M3 is next. No milestone below is complete merely because its plan or code exists. Record actual verification before marking it complete.

## Fixed direction

- Flight and surface driving always remain 2D.
- Predefined parts snap through compatible structural connections; fuel and electrical functionality are checked separately.
- Thrust, steering, changing mass, gravity and drag affect actual motion. Orbit paths are predictions from physical state.
- Time acceleration advances all physical and mission resources consistently.
- Solar panels and batteries belong in the initial science loop.
- Multistage rockets, extraterrestrial missions, landing and controllable rovers are planned extensions.
- First prove and polish a small complete mission, then expand content.

## Agent workflow

The lead agent owns architecture, shared interfaces, integration, scope decisions, final verification and updates to this plan. Specialist recommendations are evidence to assess, not automatic approval.

Three specialist roles contributed to planning and M0 implementation:

| Role | Responsibility | Required evidence |
|---|---|---|
| Physics and engineering | Assembly connectivity, propulsion, dynamics, trajectories, time warp and resource accounting | Analytical fixtures, numerical error measurements and reproducible failure cases |
| Gameplay and learning | Mission loop, controls, progression, tutorials, feedback and retries | Playable interactions, observed usability problems and defined playtest tasks |
| Visual design and game feel | Reference interpretation, original parts, screen hierarchy, camera, effects and sound | Actual screenshots at target sizes and interaction checks |

During implementation, assign independent tasks to these roles when parallel work helps. With four concurrent slots including the lead, run at most three specialists at once. Reuse roles where practical; do not assume the same agents persist across future chats.

Before any parallel edits, the lead defines input/output contracts and gives each agent explicit file ownership. Suggested boundaries are simulation/assembly logic, gameplay/UI, and rendering/assets. Shared types, dependency changes, and integration belong to the lead unless explicitly reassigned. Avoid concurrent edits to the same files. A dependent task waits for its required interface; it does not invent a competing one.

Every agent task should specify:

1. The player-visible outcome and relevant requirement IDs.
2. Owned files and dependencies on other work.
3. Constraints and exclusions for this task.
4. Acceptance checks and evidence to return.
5. A request to report uncertainty, regressions and unresolved issues.

Use a reviewer who did not author the change when practical. Reviews target concrete failure cases. The lead resolves findings and checks the integrated game; an agent's assertion that a task passes is insufficient.

## Milestones and completion gates

### M0 Establish the foundation

Choose and document the browser rendering/UI stack after checking current official documentation and local capabilities. Keep simulation independent of the renderer. Define part and connector schemas, SI units, coordinate frames, simulation-time commands, vehicle identity and save versioning.

Create an original visual style sheet and three representative screen mockups from the inspiration images: assembly, powered flight and orbital map. Use one command module, tank, engine and solar array to establish side-view components, consistent diameters and light direction, readable metallic surfaces, a blueprint grid and a restrained flight HUD. Existing images guide the design; they are not production sprites. Define physical dimensions, local origins, connector coordinates, collision bounds and exhaust origins separately from artwork. Use vector masters or high-resolution transparent sprites with consistent scale.

**Gate:** shared interfaces are documented, the app can run locally, and a sample part uses the same geometry and attachment coordinates in assembly and flight. Record intended browser sizes and a performance reference device.

### M1 Prove assembly and physics

Implement a minimal command module, tank and engine catalogue. Add drag previews, compatible snapping, invalid-drop explanations, undo/redo and keyboard placement. Calculate dry/wet mass, fuel paths, centre of mass and approximate inertia.

Implement launch-pad contact, throttle, finite steering authority, fuel depletion, gravity, simplified drag, coast and orbit prediction. Provide optional attitude hold and ascent assistance through the same command system as manual flight.

**Gate:** one documented reference craft can reach an Earth orbit. Physics fixtures meet specification A14–A18 where applicable. Validate against analytical expectations and timestep convergence, not solely against the same code used by the predictor. Disconnected engines cannot thrust; undo restores connectivity and mass properties.

**Risk:** a single-stage ascent from real Earth is demanding. Establish reachable fictional part statistics explicitly; do not silently alter gravity to make a failed design work. If this remains infeasible, report the evidence and propose a scoped change before expanding the catalogue.

### M2 Deliver the first small complete mission

Connect assembly, readiness review, launch, orbit, one scientific observation, solar/battery power, one downlink opportunity and a short debrief. This first playable slice targets 5–10 minutes with guidance or suitable starting conditions; it is smaller than the proposed 30–45 minute full missions.

Include pause, permitted time-warp rates, safe slowdown, local save/resume, retry flight and edit craft. Keep valid but underpowered designs testable; distinguish structural blockers from performance warnings. Practice mode can omit science equipment.

**Gate:** the whole mission works without developer commands. Fuel depletion, battery thresholds, contact boundaries, impact and deadlines remain correct under warp. Save/reload preserves state and outcomes. At least two viable designs demonstrate a meaningful trade-off.

### M3 Polish the playable slice

Tune snapping, steering sensitivity, throttle response, camera tracking/zoom, flight/map switching, readable warnings and quick retries. Add throttle-linked exhaust, contextual audio, gentle optional vibration and accessible reduced-motion behaviour. Preserve the craft after failure.

Show information by context: connectors and cost while building; throttle, fuel, altitude and velocity during ascent; trajectories and apsides in orbit; energy, storage and contacts during science. Advanced engineering metrics remain available without overwhelming the initial cockpit.

**Gate:** inspect actual rendered screens and perform interactions at desktop and landscape-tablet sizes. Capture short interaction recordings when tooling permits. Check connector seams, clipping, focus, text contrast, zoom and reduced motion. No obstructed controls, unreadable figures or distracting effects. Label craft heading separately from velocity; avoid long columns of indistinguishable fuel bars. Preserve responsive input on the reference device before increasing particles or effects. A provisional usability target is four of five representative students assembling a valid craft without verbal coaching. Record observations; agent review cannot substitute for student playtesting.

### M4 Complete the first Earth release

Expand the catalogue, mission briefings and three science scenarios. Add causal debriefs, controlled events, reports, same-seed comparisons, save export/import and the complete tutorial sequence. Balance each scenario against saved reference designs.

**Gate:** applicable specification A01–A18 checks pass with recorded evidence. Complete keyboard, malformed-save, offline if supported, performance and regression checks. Students can explain a failure and choose a targeted revision. Resolve earlier milestone defects before calling the release complete.

### M5 Add multistage rockets

Add decouplers, editable stage order, graph splitting, stage activation and control transfer. Update mass properties, fuel feeds, electrical paths and delta-v estimates after separation. Detached bodies inherit appropriate position and velocity, including rotational motion; separation is not implemented as mass deletion.

**Gate:** mass and momentum accounting pass; disconnected stages cannot feed the active vehicle; stage order is understandable and deliberate. Complete a reference payload-to-orbit mission with staging.

### M6 Add lunar travel and landing

Introduce data-defined celestial bodies and coplanar transfers. Select and document patched-conic or multi-body propagation. Add arrival, capture, landing controls and a surface state.

**Gate:** frame transitions are continuous and do not create artificial energy or velocity jumps. Forecasts and reference transfers are independently checked. A complete Earth-to-Moon landing is playable and explainable.

### M7 Add rover exploration

Add transportable rover payloads, deployment, control switching, terrain, wheel contact, traction, slopes, tipping, instruments and communication. Extend solar power to local day/night and applicable shadows.

**Gate:** resting contact, driving, slopes, energy depletion and solar recovery pass isolated tests before the combined mission. Complete launch, transfer, landing, deployment, driving, science and returned-data objectives.

### M8 Expand destinations and challenges

Add planetary destinations and missions using validated existing systems. Introduce new physics only where a mission requires it, with dedicated verification. Flight remains 2D throughout.

## Quality rules for every milestone

- Implement the named milestone to its acceptance criteria; avoid unrelated features.
- Test consequential simulation and state transitions with independent expected results. Avoid tests that merely repeat implementation logic.
- Verify appearance in the running game. Successful compilation does not establish visual or interaction quality.
- Record what ran, what passed, what was inspected, and what remains unverified. Do not invent student feedback or claim testing that tools could not perform.
- Prefer understandable failures, preserved designs and fast retries. Report one primary cause with evidence before listing secondary issues.
- Distinguish numerical correctness, enjoyable handling, readable presentation and educational value; each needs its own evidence.
- Keep original assets cohesive in scale, connector alignment, shading and style. Asset polish cannot conceal broken mechanics.
- Update this plan and the specification when a consequential decision changes. Keep future mechanics modular without building unused frameworks now.

## How to direct the work

Give an observable outcome, a bounded milestone, references, constraints and a definition of done. Describe what feels wrong and when it happens; screenshots, reproduction steps and a reference image are more useful than “make it better.” The following prompts are project-specific working templates, not a promise that wording alone guarantees quality.

### Implementation prompt

> Read PLAN.md and MISSION_GAME_SPECIFICATION.md. Implement milestone M1 through its completion gate. Use specialist agents for independent tasks with explicit file ownership, and have a reviewer challenge the integrated result. Preserve permanent 2D flight and the approved visual direction. Make routine decisions autonomously and explain consequential trade-offs. Run meaningful physics and interaction checks, inspect the actual interface, fix findings, and update PLAN.md with evidence and remaining limitations. Do not expand into later milestones.

Replace M1 with the milestone desired. For M0, ask for foundation and visual mockups rather than a completed flight game.

### Visual and feel iteration prompt

> Improve [specific screen or interaction] using [reference image] for [specific qualities]. Current problem: [what happens and why it feels wrong]. Preserve [working behaviour]. Tune the running game, compare before and after at the target screen sizes, and check that controls and physics still behave correctly. Use a visual reviewer and report the evidence briefly.

### Review prompt

> Review the current milestone against PLAN.md and the relevant specification criteria. Use independent specialist reviews for physics, gameplay and visuals. Reproduce the highest-impact issues, rank them by player impact, fix those within the milestone, and rerun relevant checks. State what remains unverified; do not add unrelated features.

### Feedback from the project owner

You set priorities and judge whether the game matches your intended experience. Useful feedback is concrete: “steering overshoots after key release,” “snapping chooses the wrong node,” or “the fuel numbers are unreadable at this zoom.” If a desired change alters scope, record the decision before implementation. No elaborate prompt is necessary for a small correction.

Official guidance used for prompting principles: [OpenAI Codex best practices](https://learn.chatgpt.com/docs/learn/best-practices). The milestone sequence, role assignments and acceptance gates above are our project recommendations.

## Progress ledger

| Item | Status | Evidence |
|---|---|---|
| Product specification v0.3 | Written | MISSION_GAME_SPECIFICATION.md |
| Physics and gameplay planning reviews | Received | Findings incorporated into milestone gates and risks |
| Visual planning review | Received | Reference inspection informed screen mockups, asset geometry and visual/performance gates |
| M0 | Complete | Strict TypeScript and Vite production build pass; 5/5 analytical fixtures pass; three browser views reviewed at 1440x900 and 1024x768; see docs/M0_REVIEW.md |
| M1 | Complete | 32 tests passed; production build passed; pointer/keyboard builder and actual guided orbital insertion verified in browser; see docs/M1_REVIEW.md |
| M2 | Complete | 58/58 tests and production build pass; ordinary browser controls completed launch-to-downlink mission, reload preserved state, two viable designs verified; see docs/M2_REVIEW.md |
| M3 through M8 | Not started | Presentation/learning polish, expanded scenarios, staging and extraterrestrial exploration remain |

### M0 evidence and decisions

- Stack: TypeScript 5.9.3, Vite 7.3.8, standard DOM controls and original SVG scenes. Installed versions are captured in package-lock.json. Official Vite and MDN references are linked in README.md.
- Architecture: docs/ARCHITECTURE.md defines SI units, y-up physical frames, part-local origins, shared connector/collision geometry, simulation-time commands, vehicle identity and versioned save contracts. Core modules are browser-independent.
- Art direction: docs/ART_DIRECTION.md records original side-view assets and the assembly/flight/orbit visual language drawn from the inspiration collection.
- Runtime evidence: six local screenshots under artifacts/m0; index and browser check details in docs/M0_REVIEW.md. Keyboard solar selection and throttle, inspector updates, zoom, nodes, cutoff and forecast toggles were exercised. Browser error log inspection returned no errors in the checked session.
- Independent review fixes: readable supporting text, preserved keyboard focus, unique SVG identifiers, coherent orbit geometry, distinct attitude/velocity labels, typed catalogue access and no external font dependency.
- Dependency repair: the initial installation produced malformed lock records and incorrect native-parser output. A clean install with Rollup 4.67.5 override restored normal parsing and a successful production build. The evidence does not establish a proven upstream version regression; a native binding change also occurred. Reversible dependency backups are ignored locally.
- Target viewports: desktop 1440x900 and landscape tablet 1024x768. Declared performance reference: Intel Core i5-8250U, 8 GB RAM, integrated graphics, Chromium at 1440x900. This device has not been benchmarked; actual flight performance is a later gate.
- Final lead verification: npm run build passed; npm test passed 5/5; reloaded the repaired local app and switched screens successfully. Local preview server was stopped after verification; start it with npm run dev.
- Limits: no claim of verified orbital reachability, live dynamics, mission persistence, functional warp, student learning gains or a completed accessibility audit. Those are later milestone responsibilities.

### UI readability revision

Updated the three mockups using inspirations/Airy APOGEE spacecraft builder.png as the spacing and type-scale reference. Body text is 16px, panel headings 27px, part names 17px, and primary controls are at least 44px high. Larger cards, shorter library descriptions, higher contrast, separate panels and a larger assembly camera scale replace the compact layout. The inspector moves below the workspace at tablet widths; its text does not shrink to fit three columns. Flight remains permanently 2D.

Browser checks covered the 1590x990 reference size, 1440x900 desktop and 1024x768 tablet. At 1440x900 the page fits the viewport with scrolling inside longer side panels; the primary action stays visible. At tablet size the page scrolls vertically. Selection by keyboard, inspector updates, zoom, throttle Home and view navigation were exercised. No browser console errors were reported in the inspected session. An independent visual reviewer found no material readability issue; the observed tablet CTA order was corrected. Evidence is saved locally under artifacts/ui-readability. Production build passed after the changes. This revision adds no new simulation mechanics.

### M1 evidence and decisions

- Three specialist agents separately implemented the immutable builder, physics/guidance and state-driven rendering. The lead integrated pointer/keyboard controls and the browser loop. Independent cross-reviews found and resolved origin invariance, escape classification, subtree preview, focus, time-warp and action-layout issues.
- Builder: typed compatible snapping, valid/invalid ghosts, subtree moves, keyboard Add, remove, Undo/Redo, new/reference craft and tank fill. Readiness blocks malformed/disconnected or unfed assemblies; cost and engineering metrics are displayed. No arbitrary budget threshold was invented for this flight milestone.
- Physics: real Earth parameters, 0.02-second integration, variable mass, connected propellant, finite steering/gimbal, atmospheric drag, pad/impact, coast and live orbital elements. No original component statistics were altered to achieve the reference ascent.
- Reference insertion: about 241.10 simulated seconds, 120.075 km periapsis, 1,431.490 km apoapsis, 64.423 kg propellant remaining. This is a stable eccentric orbit with little fuel margin, not a precision 400 km circular insertion. A full subsequent coast orbit is covered by the independent test.
- Lead verification: npm test passed 32/32, including ten-orbit conservation, the rocket equation, depletion, feed, torque, prograde/retrograde burns, convergence, translated-editor geometry and command replay. npm run build passed TypeScript and production bundling.
- Browser verification: keyboard-built tank; dragged engine onto tank; rejected solar-to-command drop without mutation; Undo/Redo; paused launchpad; guided flight into orbit at 5x; coast at 100x; manual input returned to 1x; cutoff, steering, pause, retry and view switching worked. Space cuts thrust even when Launch is focused. Error-log inspection returned none in the checked session.
- Readability: enlarged UI retained. Pause is beside the clock; scrollable inspectors do not obscure the primary action. Desktop and landscape-tablet layouts were inspected. Screenshots and visible telemetry records are under artifacts/m1; docs/M1_REVIEW.md indexes evidence and limits.
- Coast prediction is explicitly a gravity-only vacuum projection with no future thrust. Actual atmospheric motion includes simplified drag. Nonphysical below-surface periapsis is labelled plainly. The redraw interval targets approximately 30 updates per second; reference-device throughput has not been benchmarked.
- Limits: guidance is tuned to the reference craft. No science objective, downlink, mission score, robust persistence, staging, other body, landing or rover is claimed. M2 is the next implementation milestone.

### M2 evidence and decisions

- Completed the first mission: budgeted design → launch → orbit → daylight observation → physical ground contact → full downlink → causal debrief. Camera/radio/storage are included in the command module's existing mass and cost for this bounded slice; separate equipment choices remain catalogue expansion work.
- Mission power is prepared before each 0.02-second flight step, and science is advanced after that same step. Fixed intervals remain intact under warp. Reserve safe mode uses 20% entry / 30% recovery hysteresis. Observation, transmission, contact, impact and deadline tests pass.
- Solar arrays now attach to either side with automatic rotation and an explicit Flip side control. Collision, occupied-mount, symmetric-array and immutable-undo cases are tested.
- Added wheel/buttons/Fit zoom from 20% to 800% for assembly, flight and map. NASA Blue Marble is locally projected onto a globe with atmosphere and shading; credit and rendering limits are documented in docs/EARTH_ASSET.md.
- Saves validate schema/catalogue versions, graph, flight resources, clocks and science state. Autosave, explicit save/resume and JSON export/import restore paused. A mid-mission browser reload preserved collected data; the resumed run completed, and a second reload preserved the final result.
- Lead verification: 58/58 tests and the TypeScript/Vite production build passed. The normal browser mission returned 16 MB at T+01:28:35, with 5,870 credits spent, 400 Wh battery and 64.42 kg fuel. Downloadable HTML report verified. Two viable designs exhibit cost/mass/fuel versus electrical-reserve trade-offs; see docs/M2_MISSION.md.
- Specialist reviews resolved native keyboard activation, dashboard shortcuts, stale controls, terminal-state resumption and over-budget explanation findings. Final Earth/zoom screenshots received independent visual review. Evidence and outstanding limits are indexed in docs/M2_REVIEW.md and artifacts/m2.
- M3 retains student usability, audio/feel/accessibility polish and reference-device performance measurement. Detailed link budgets, separate payload selection, cloud/weather simulation, full historical replay and challenge events are not claimed by M2. Staging, other bodies and rovers remain later milestones.

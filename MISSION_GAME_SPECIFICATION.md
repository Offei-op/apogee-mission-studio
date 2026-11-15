# Space Mission Simulator Specification

Version 0.3 | 14 November 2026 | Permanent 2D scope and exploration roadmap incorporated

## 1 Product decision

We will build a single-player browser spacecraft building and mission simulation game for secondary school students. Players choose a scientific objective, drag predefined parts into a physically meaningful spacecraft assembly, launch it, steer and control thrust, establish or change an orbit, conduct science operations, and evaluate the results.

The first release will cover uncrewed Earth observation missions from concept through mission closeout. Its central challenge is to return useful scientific data within a fixed budget and deadline. Collecting data is only an intermediate step; the data must reach a ground station to count.

The audience, browser format, drag-and-snap assembly, compatible attachment rules, controllable flight, time acceleration, and dynamically changing trajectories are confirmed requirements. Flight will always be two-dimensional, including travel to other worlds. The long-term scope includes extraterrestrial missions, controllable rovers, solar power, and multistage rockets. Version 1 establishes Earth flight and science operations; later levels introduce these additional capabilities. Numerical settings and release boundaries remain design proposals for review.

We will not start implementing the game as part of this specification task.

## 2 Intended experience and learning goals

A complete science mission should take approximately 30–45 minutes once students know the flight controls. Assembly and flight tutorials may be completed separately before a classroom mission. These are usability targets to validate with students, not measured results. Students should be able to begin without prior orbital mechanics knowledge. Explanations introduce units and concepts when they become relevant.

After playing, a student should be able to:

- Explain why a more capable instrument may require a larger power system, more storage, a stronger radio, and a more expensive launcher.
- Distinguish power in watts from stored energy in watt-hours.
- Explain why orbital geometry determines when a satellite can observe a target or contact a ground station.
- Separate launch feasibility from operational feasibility: a spacecraft can fit a rocket and still fail its mission.
- Compare two designs against the same objective, using measured results and explicit trade-offs.
- Identify the chain of causes behind a failed objective and propose a specific revision.
- Distinguish spacecraft orientation from velocity direction: turning the craft redirects future thrust, while existing momentum persists.
- Explain how thrust, changing mass, fuel consumption, gravity, and drag shape acceleration and trajectory.
- Predict how a prograde or retrograde burn will change an orbit and compare the prediction with the resulting path.

The game should reward understandable engineering decisions. A small, well-planned satellite should sometimes outperform a larger spacecraft carrying too many instruments.

## 3 Scope of the first release

| Area | Included in version 1 | Deferred |
|---|---|---|
| Mission setting | One Earth, one satellite per mission, three scenario briefs | Moon, Mars, landers, crewed missions, constellations |
| Design | Predefined parts of different shapes, sizes and capabilities; drag-and-snap assembly with typed connectors | User-authored parts, arbitrary mesh building, structural flex and stress solvers |
| Simulation | Two-dimensional powered ascent, gravity, simplified drag, fuel consumption, variable mass, changing orbits, science and resource operations | Additional celestial bodies, lift modelling, detailed heating and structural simulation; 3D flight is excluded permanently |
| Launch | Player-built single-stage vehicle; throttle and steering; guided launch assistance | Multistage separation, recoverable boosters, real launch bookings |
| Operations | Timelines, automatic policies, manual overrides, bounded events | Complex scripting languages and real mission APIs |
| Learning | Guided tutorial, explanations, debrief, replay comparison | Teacher accounts, grading integrations, multiplayer |
| Persistence | Local saves and downloadable mission reports | Accounts, cloud sync, public leaderboards |

The complete lifecycle means a complete educational workflow within this scope. It does not mean an engineering-grade simulation of every spacecraft subsystem.

## 4 Mission scenarios

All scenarios reuse the same simulation and component catalogue. Scenario files define target coordinates, observation requirements, deadline, starting budget, weather schedule, and event schedule. A scenario is not ready for release until a reference design demonstrably completes it.

| Scenario | Scientific objective | Main decision pressure | Proposed success threshold |
|---|---|---|---|
| Coastal mapping | Return visible-light observations of coastal target areas | Coverage versus image quality and downlink capacity | Deliver 8 unique qualifying target observations within 24 simulated hours |
| Wildfire monitoring | Return thermal observations of designated hotspots | Timely delivery versus power and contact availability | Deliver 6 unique qualifying observations, each within 2 simulated hours of collection, over a 24-hour mission |
| Vegetation survey | Return multispectral observations across a larger region | Instrument cost and data volume versus coverage | Deliver 12 unique qualifying target observations within 48 simulated hours |

Each brief states its required instrument type, maximum accepted ground sampling distance in metres per pixel, target list, and any daylight or cloud restrictions. A target observation is a named target and observation interval pair. Repeated imaging of the same pair cannot generate duplicate credit.

Targets and thresholds above are initial balancing settings. Their final coordinates and schedules must be selected through feasibility tests, rather than invented independently of the orbit model.

An unguided practice mode uses these same scenarios with optional budget relaxation. Its reports are labelled practice and are not compared directly with standard-budget runs. A flight tutorial precedes science missions: assemble a command module above a tank and engine, demonstrate lift-off, and establish an orbit with periapsis above the atmosphere boundary. The first science scenario offers launch guidance so learning to fly does not prevent students from exploring mission management.

## 5 Player journey and screens

### Mission briefing

The player selects a scenario and sees the scientific question, success conditions, deadline, budget, and target map. The tutorial begins with coastal mapping and explains what counts as a returned observation.

### Spacecraft design

The assembly screen contains a parts tray, a central build canvas, and a live engineering summary. Students drag predefined parts onto the canvas, rotate where allowed, and snap compatible attachment nodes together. A ghost preview highlights valid connections; invalid placement explains its cause and returns the part to its previous position. Provide undo, redo, deletion, zoom, and a keyboard alternative that selects a part and an available compatible node.

Parts differ in visible geometry and engineering capability. The initial catalogue contains two uncrewed command or payload-bus modules, three tank sizes, three engine types, three science instruments, and two choices each for solar array, battery, storage, and radio. Command modules may resemble capsules but do not imply crew support. Each component specifies cost, dimensions, dry mass, connector types and sizes, and applicable electrical or propulsion properties. Tank fill is adjustable before launch; wet mass includes the selected propellant quantity.

The first release supports one axial propulsion stack with side-mounted equipment. In nose-to-tail order, a typical valid assembly is command module or payload bus, compatible tank or contiguous tanks, then engine with its nozzle pointing aft. Engine fuel inlets connect only to compatible tank feed nodes; tank upper structural nodes connect to another tank or a command/payload module. Instruments, radios and arrays attach to equipment mounts. Connector diameter and orientation must match; implicit size conversion is forbidden. Size adapters and multi-engine clusters are deferred.

Each node accepts one connection. Parts cannot overlap, float disconnected, form attachment cycles, block the engine exhaust clearance, or attach through an incompatible connector. All flight parts must form one connected assembly with exactly one command module. Fuel reaches the engine only through connected compatible tank feed paths. Electrical equipment must connect to a powered bus path. A physically snapped part is not automatically functional: the review also validates fuel, control, and electrical connectivity.

The summary updates cost, dry and wet mass, centre of mass, thrust, surface thrust-to-weight ratio, available propellant, estimated vacuum delta-v, electrical generation and demand, battery energy, and storage. Additional fuel improves available impulse but increases mass; a larger engine may improve lift-off acceleration while adding dry mass and consuming propellant faster. Component statistics are fictional balancing parameters. A viable single-stage orbital reference design is required before freezing their values.

### Orbit and ground network

The player selects a target orbit in the game's shared two-dimensional plane. The initial Earth missions use an equatorial plane, with target regions reachable from that plane. Approximate 400 km, 550 km, and 700 km circular paths are planning targets, not paths to which the game locks the spacecraft. Actual position and velocity determine the achieved orbit. Inclination changes and out-of-plane navigation are excluded. Future celestial bodies use explicitly coplanar educational representations, rather than claiming to reproduce the full three-dimensional Solar System.

A preview shows opportunities for the intended orbit and labels them estimates until the actual orbit is established. During flight, predictions update from the current state after each burn. The player chooses a basic or expanded ground network, trading an up-front cost for additional communication opportunities.

### Operations planning and readiness review

The player chooses observation priorities, a battery reserve, and a downlink policy. Defaults create a usable plan automatically. Students may edit the plan and preview the expected mission timeline.

The readiness review separates hard blockers from operational warnings. Exceeding budget, build-envelope or electrical limits; incompatible, disconnected or overlapping parts; missing control; an unfed engine; or a missing required instrument blocks mission launch. Surface thrust-to-weight ratio at or below one, insufficient estimated delta-v, predicted power shortages, storage pressure, and inadequate coverage produce warnings. A valid but underpowered craft can be tested; the game explains why it cannot lift off. Practice mode permits assemblies without a science instrument.

### Launch and mission control

Launch begins on the surface with the assembled craft. Players ignite the engine, set throttle, pitch the spacecraft, and cut thrust to coast. Guidance displays a suggested ascent direction and burn timing; optional assisted flight applies commands through the same physics model. Hardware is locked after launch, while attitude, throttle, and orbit remain controllable. Engine cut-off does not stop the spacecraft. Fuel exhaustion removes engine thrust, while gravity and momentum continue to affect motion.

Controls provide left/right steering, throttle increase/decrease, immediate engine cut-off, pause, and optional attitude hold. Flight instruments show altitude, inertial speed, surface-relative vertical and horizontal speed, heading, acceleration, thrust, remaining propellant, estimated burn time and delta-v, apoapsis and periapsis when defined. A close flight view and map view share the same simulation state.

Mission control includes a rotating Earth or map-based orbit view, satellite position, target footprints, ground stations, and a shared timeline. Resource panels show battery charge, power generation and consumption, stored data, returned data, remaining time, and mission progress.

Controls include safe mode, instrument enable or disable, target priority, and transmit when contact is available. Students can switch between observation-priority and downlink-priority policies. Transmission requires a contact window; a button cannot bypass orbital geometry.

Time controls offer pause, 1x, 5x, 10x, 100x and 1000x simulated time. Powered flight is capped at 5x; atmospheric flight is capped at 10x, with the stricter cap taking priority. Higher rates are for unpowered flight above the atmosphere. Ignition or manual steering at high warp first returns to 1x. The game automatically slows before atmospheric entry, impact, planned burns, and actionable mission events. All resource consumption, deadlines, and contact windows advance with simulated time. Fast-forward cannot bypass fuel use, power shortages, or collisions.

### Debrief and revision

The mission ends at its deadline or when the player ends it early. The debrief shows objective completion, resource history, spending, warnings, events, and a causal explanation of missed observations. Students can duplicate the design, change one decision, and rerun the same scenario and seed.

Mission closeout includes a disposal-planning reflection and may include a controlled retrograde deorbit burn using remaining fuel. Atmospheric entry terminates the orbital mission with a simplified entry outcome; detailed reentry heating, parachutes, landing, and regulatory compliance calculations are deferred. Surface impact is a deterministic mission failure with a trajectory-based explanation.

## 6 Simulation rules

### Model boundaries

The simulation uses a spherical rotating Earth, a fixed two-dimensional equatorial flight plane, and a fixed Sun direction over the short scenario duration. Position and velocity evolve under central gravity, engine thrust and simplified atmospheric drag. The model supports circular, elliptical, suborbital and escape trajectories. A body rotating in the plane supplies surface-relative velocity and ground tracks. Out-of-plane steering is permanently excluded. Other gravitational bodies, lift, detailed heating, structural flex, and orbital perturbations are outside version 1.

The renderer reads the simulation state. Animation speed never changes numerical outcomes. Use a proposed fixed 0.02-second physics step for powered and atmospheric flight. During unpowered vacuum flight, use two-body propagation with bounded event-search intervals for surface or atmosphere intersections, eclipse, contact and observation boundaries. Do not enlarge a numerical integration step merely to increase time warp. Final step sizes and propagation tolerances must pass the accuracy criteria below. Step-to-event is enabled only where a predictable coast segment permits it.

### Propulsion and kinematics

Internally use SI units: metres, seconds, kilograms, newtons and radians. With position vector r, velocity v, Earth gravitational parameter mu, current mass m, thrust T, thrust direction u, and drag force D, integrate dr/dt = v and dv/dt = -mu*r/|r|^3 + (T*u + D)/m. This supplies both gravity and changing acceleration as propellant mass decreases.

For throttle q between zero and one, thrust is q times the engine's rated thrust at the current atmospheric condition. Propellant consumption is dm_prop/dt = -T/(Isp*g0), where Isp is specific impulse in seconds and g0 is standard reference gravity. Tanks store a compatible fuel-and-oxidizer mixture as a single propellant resource. Engine tables specify sea-level and vacuum thrust and Isp; interpolate by ambient pressure. Consume only the available connected propellant, split the final burn step at depletion, and then set thrust to zero. Propellant and total mass must never become negative.

Display ideal remaining vacuum delta-v as Isp_vac*g0*ln(m_current/m_dry) for the active single-stage configuration, explicitly labelled as excluding gravity and drag losses. Constant-throttle burn time is an estimate from current conditions, not a promise that fuel will last that long during changing throttle or pressure.

Steering applies a bounded control torque using the command module's electrical attitude system. Track angle and angular velocity; derive centre of mass and approximate rotational inertia from component geometry and current tank fill. Apply engine thrust at its mounted location so off-centre thrust can induce torque. Limit engine gimbal deflection; attitude hold has finite authority and electricity demand. Rotation consumes electrical energy; the main engine consumes propellant only when firing. Simulate no structural bending or aerodynamic torque in version 1. Guidance must not silently cancel torque or grant unlimited rotation.

Atmospheric drag opposes velocity relative to the rotating atmosphere: D = -0.5*rho*Cd*A*|v_rel|*v_rel. Use a documented simplified density profile, assembly-derived projected area, and bounded drag coefficients. Surface contact prevents falling through the launch pad; ground impact after departure ends the flight. The educational model must label its atmospheric simplifications.

### Orbit prediction

Recompute the instantaneous coast trajectory from current position and velocity after steering and thrust inputs change the physical state. Rotating with the engine off changes orientation but does not immediately alter translational velocity. Show the current coast path as a solid line and an optional finite-burn forecast as a distinct dashed line. Label the latter with its assumed throttle, attitude, duration, and remaining-fuel limit.

Display apoapsis, periapsis, orbital period and time to apsides only when defined. For an escape path show escape status; for a surface-intersecting path show an impact warning and predicted intersection instead of drawing a safe closed orbit. Remaining fuel and burn-time forecasts update live. Science windows and contacts are recomputed from the evolving trajectory, rather than from the original target-orbit template.

### Resource accounting

| Quantity | Unit | Version 1 rule |
|---|---|---|
| Budget | Mission credits | Sum hardware, propellant, launch-pad fee, network, and fixed operations allocation; charge once before launch |
| Spacecraft mass | kg | Sum attached dry components and remaining propellant; update throughout burns |
| Propellant | kg | Consume from compatible connected tanks according to thrust and specific impulse |
| Thrust | N | Engine output depends on throttle and ambient pressure; zero without propellant or valid control |
| Electrical power | W | Add baseline and active subsystem loads; enforce bus limit |
| Battery energy | Wh | Integrate generation minus demand over elapsed hours, including explicit charge and discharge efficiencies |
| Storage | MB | Add collected observation data; remove data after successful transmission acknowledgement |
| Downlink | Mbps | Transfer only during contact; convert bits to bytes explicitly; cap by available queued data |
| Time | s internally | Use a common mission clock for orbit, events, observation validity, and deadlines |

Battery energy is bounded between zero and its rated capacity. Surplus solar energy beyond available charge capacity is unused. Solar arrays produce their rated educational-model output in sunlight and zero in eclipse; orientation, degradation, and detailed temperature effects are omitted and disclosed.

If an activity would exceed bus power, the lower-priority activity is deferred and the reason is logged. Flight control receives priority over science. At the reserve threshold, automatic safe mode suspends instruments and high-rate downlink while keeping the baseline bus active. It exits after recovering above a separate higher threshold, preventing rapid mode switching. At zero battery energy, the spacecraft enters a recoverable brownout until sunlight restores sufficient energy. Main engine control and attitude actuation cease; existing angular motion and the translational trajectory persist under gravity and drag. The mission deadline continues to run.

When storage is full, the satellite skips new collection and records the missed opportunity. It does not silently overwrite scientific data. Partially transmitted observations retain their remaining byte count; they earn credit only when fully delivered.

### Observation and communications geometry

An observation is possible only when the target lies within the instrument footprint and the instrument is enabled. Visible and multispectral instruments require daylight and an unobscured target. Thermal observations may occur at night, but are also blocked by cloud in this simplified model. Weather is a scenario input visible through a forecast.

Each instrument specifies its swath and ground sampling distance at a reference altitude. Version 1 scales both linearly with altitude at fixed angular field of view. Each observation also has a specified dwell time, data volume, and active power demand. The simplification must be explained alongside the instrument details.

Ground contact requires line of sight above a fixed station elevation mask. Each radio uses a fixed effective data rate during eligible contact. Antenna pointing, RF link budgets, interference, and variable range losses are not simulated. This is a deliberate educational abstraction, not a claim that real radios have constant performance.

Science credit requires the correct instrument, accepted quality, valid target coverage, and complete delivery before the applicable deadline. Expired or otherwise invalid data may still be transmitted, but its lack of credit must be explained.

### Controlled events

Version 1 includes three bounded event types: cloud blocking an observation, temporary ground-station outage, and temporary instrument shutdown requiring a reset. Each event has a clear duration or recovery condition, a visible explanation, and a log entry. The tutorial introduces one scripted event after the student has learned normal operations.

Challenge events are generated from a saved seed. Replays with identical configuration, seed, and commands must match. Events should create recoverable decisions; random instant mission destruction is excluded. Comparisons between changed designs show any differences in exposure to the same event schedule.

## 7 Success and feedback

Version 1 uses objective completion as the primary result, rather than a weighted score that could obscure failure. A run succeeds if it delivers the required number of qualifying observations on time while satisfying prelaunch constraints. Partial success displays the exact fraction achieved.

Secondary metrics show cost per qualifying observation, unique targets covered, data delivered, data expired, minimum battery energy, time spent in safe mode, and unused budget. These metrics support comparison without making every trade-off collapse into one number.

The debrief includes at least three linked explanations where applicable, such as:

“Two observations missed their delivery deadlines. Their data remained in storage until after the next contact. A faster radio would not have created an earlier contact; the expanded ground network or an earlier observation could help.”

Proposed improvements must follow from the recorded cause. The game should not recommend a battery upgrade when the actual bottleneck was an unavailable ground station.

Before comparing runs, the interface identifies changed hardware, policy settings, scenario, and seed. A brief reflection asks the student to predict what one change will improve and what it may make worse.

## 8 Interface and accessibility

The visual style is a readable mission-control interface with a dark space background, restrained colour, and clear satellite illustrations. The map and charts communicate state; decorative animation must not hide decisions. Scientific quantities always display units.

The main desktop layout places the parts tray on the left, the assembly canvas or flight view in the centre, and resource summaries on the right. Attachment nodes, compatible sizes, fuel paths and electrical paths can be highlighted. During flight, throttle, steering and time-warp controls remain visible beside the map/flight-view switch. A bottom timeline is shared by planning and operations. On smaller screens, panels become tabs. The first release targets desktop and landscape tablet use; phone interaction is deferred.

All essential actions must work with keyboard navigation. Focus is visible, status is communicated with text and icons as well as colour, charts have readable text summaries, and reduced-motion preferences are respected. Audio is optional and never the sole warning channel. An expandable “Why?” explanation is available beside every launch blocker and major operational warning.

## M2 implementation boundary (15 November 2026)

The first playable slice uses one coastal target and one ground station, a two-hour simulated deadline, a 6,500-credit budget and a 700-credit fixed operations allocation. The command module includes its first camera, radio and 32 MB buffer in its stated mass and price. A five-second qualifying daylight observation creates 16 MB; full geometric downlink earns credit. Separate instruments and detailed link-budget choices remain catalogue expansion work.

M2 session schema2 saves the current complete craft/flight/mission state, versions, controls and zoom settings, with paused resume and JSON portability. Seeded events and full historical command replay described below remain broader release requirements; M2 does not claim them. Earth imagery is an illustrative local orthographic NASA composite; mission target/contact geometry uses the physical simulation rather than image pixels. See docs/M2_MISSION.md and docs/M2_REVIEW.md for measured evidence and simplifications.

## 9 Technical design and saved data

Proposed implementation: a TypeScript browser application with a component-based interface, a Canvas or SVG orbit visualisation, and a pure simulation module separate from rendering. Final library versions are selected when implementation begins. A backend is unnecessary for the first release.

The simulation exposes commands, advances state deterministically, and emits events. The UI cannot directly modify resource totals. Scenario data and the component catalogue are separate versioned configuration files, so balancing does not require rewriting simulation logic.

Core records are PartDefinition, PartInstance, AttachmentNode, AssemblyConnection, PropellantTank, Engine, GroundNetwork, TargetOrbit, Scenario, MissionDesign, FlightCommand, OperationsPolicy, SimulationState, MissionEvent, and MissionResult. Definitions contain explicit units, geometry, connector sizes and types, cost, dry mass, and subsystem properties. Instances record position, orientation, connections, remaining propellant, and operating state. The assembly graph determines mass properties and fuel and electrical connectivity.

A save includes schema and catalogue versions, scenario version, the complete assembly graph, seed, clock, position, velocity, attitude, angular velocity, throttle, resource state, event state, assistance settings, and timestamped command history. Time-warp choices must not alter the outcome of an identical sequence of simulation-time commands.

Save automatically after design changes and significant simulation events, with a manual save option. Local storage supports resume on the same browser. Provide JSON export and import for portability, validate imported values, and reject incompatible saves with a readable message. Do not silently reinterpret old component values.

Reports can be downloaded as a standalone HTML summary suitable for browser printing. No login, student name, external analytics, or paid service is required. Offline availability after an initial successful load is a proposed deployment goal, to be tested explicitly rather than assumed.

## 10 Acceptance criteria

| ID | Requirement | Evidence required before release |
|---|---|---|
| A01 | Complete lifecycle | A new player can progress from briefing through design, launch, operation, and debrief without developer intervention |
| A02 | Correct readiness checks | Budget, build-envelope, electrical, connector, overlap, control and feed-path checks accept valid assemblies and explain invalid ones |
| A03 | Consistent resources | Known power schedules produce expected battery changes; data never becomes negative or exceeds storage capacity |
| A04 | Real geometric restrictions | A target outside the reachable footprint cannot be observed; transmission without contact transfers zero bytes |
| A05 | Correct science credit | Duplicate, incomplete, expired, wrong-instrument, and poor-quality observations receive no qualifying credit |
| A06 | Deterministic replay | Identical inputs and seed produce matching results across pause, resume, step, and speed settings |
| A07 | Recoverable operations | Safe mode, brownout recovery, interrupted downlink, and temporary outages have documented, tested transitions |
| A08 | Feasible scenarios | A saved reference design completes each scenario; at least two designs exhibit a meaningful cost or performance trade-off |
| A09 | Honest feedback | Debrief explanations reconcile with the event log and identify the actual limiting resource or window |
| A10 | Save integrity | Export, reload, and import preserve the mission result; malformed or incompatible imports fail safely |
| A11 | Usable and accessible | Every essential control works by keyboard; key status remains understandable without colour or animation |
| A12 | Responsive playback | On a declared school-laptop reference device, controls remain responsive during fast-forward and the visual view targets 30 frames per second |
| A13 | Meaningful drag assembly | Engine-to-tank and tank-to-command connections snap correctly; incompatible sizes, reversed nodes, blocked exhaust, disconnected parts and invalid equipment mounts are rejected; undo restores the previous valid graph |
| A14 | Conserved fuel and changing mass | Constant-thrust fixtures match T/(Isp*g0) consumption within 0.1 percent; mass equals dry mass plus remaining propellant; thrust stops exactly at depletion |
| A15 | Verified orbital dynamics | An unpowered circular orbit at 400 km maintains radius and specific energy within 0.1 percent over ten orbits; an ideal vacuum burn agrees with the rocket equation within 0.5 percent |
| A16 | Steering and prediction | Engine-off rotation leaves translational velocity unchanged in vacuum at the command instant; prograde and retrograde reference burns produce the expected orbital changes; trajectory forecasts agree with replay under their stated assumptions |
| A17 | Safe time acceleration | Replays at each permitted warp rate agree within the physics tolerance; depletion, atmosphere entry, impact and mission deadlines are not skipped; powered-flight warp limits are enforced |
| A18 | Assembly affects handling | Added mass reduces acceleration at the same thrust; offset thrust produces torque; attitude response changes with inertia and respects control limits |

Testing uses small analytical fixtures before full missions: connector and feed-path examples, lift-off thrust-to-weight checks, free coast, a constant-thrust vacuum burn, a sunlight/eclipse battery cycle, a known contact window, a full-storage case, and an observation that finishes transmission exactly at its deadline. Orbit forecast position should agree with a no-input coast replay to within 1 km over one orbit. Event timing should agree across time-warp rates to within one active-flight physics step. The deadline rule is inclusive: complete delivery at the deadline qualifies; later delivery does not.

The educational pilot should involve approximately five to eight representative students. Observe first-run completion, misunderstood terms, and whether students can explain a failed mission and choose a targeted revision. Use a short pre/post question set as formative feedback; this small pilot cannot establish a general causal claim about learning effectiveness.

## 11 Build sequence

1. **Prove assembly and flight.** Build a command module, tank and engine with snapping and feed validation. Demonstrate surface launch, steering, fuel depletion, coast, a changing orbit and time warp. Exit when analytical flight fixtures pass and a single-stage reference craft reaches a stable orbit.
2. **Deliver one complete mission.** Connect briefing, design, readiness, controlled launch, orbital science operations and debrief. Exit when coastal mapping works with one validated reference craft and local saving.
3. **Make trade-offs understandable.** Add launch assistance, explanations, resource charts, trajectory and burn forecasts, same-seed comparison, and assembly/flight tutorials. Exit when students can identify a specific cause of failure.
4. **Expand and balance.** Add the other two scenarios, the complete catalogue, and bounded events. Exit when each scenario has feasible reference designs and no single design dominates all objectives.
5. **Validate classroom use.** Conduct usability, accessibility, physics accuracy, warp performance, offline, and save-recovery checks. Resolve observed blockers before release.

Delivery dates and cost estimates remain open until team capacity, deadline, hosting constraints, and visual fidelity are known. A reasonable first prototype proves one complete mission before adding content breadth.

## 12 Review decisions and major risks

The game permanently uses two-dimensional assembly and flight with typed snap connectors, fictional component statistics, manual throttle and steering, optional guidance, and an evolving orbit. The first playable release uses one active single-stage spacecraft. Multistage rockets, extraterrestrial flight, landing, and controllable rovers are committed roadmap capabilities whose release order is proposed below. Solar generation and batteries are included from the first release.

The largest scope risk is expanding into a general spaceflight sandbox before the educational loop works. The largest scientific risk is presenting simplified models as realistic predictions. The largest gameplay risk is a catalogue with one obviously superior configuration. The mitigation is to keep model limitations visible, validate each scenario with reference runs, and compare designs on multiple outcomes.

Before implementation, review whether the first release can focus on single-stage Earth missions before the exploration levels, whether the proposed session length fits the teaching setting, and whether any competition rubric mandates specific features. Multistage flight and rovers are part of the product direction, so assembly, mass accounting, control ownership and saves must anticipate them. Colour themes and exact component names can be resolved during implementation.

### Progression to exploration

| Level group | Capability introduced | Player challenge |
|---|---|---|
| Earth flight | Compatible assembly, throttle, steering, orbit, time acceleration | Build a working spacecraft and reach a stable orbit |
| Earth science and energy | Solar panels, batteries, instruments and communication | Complete observations and return data while surviving eclipse |
| Multistage rockets | Decouplers, stage ordering, engine activation and discarded mass | Reach a target orbit with a payload by managing fuel and staging |
| Lunar exploration | Coplanar transfer, changing gravitational environment, powered landing | Depart Earth, arrive at the Moon and land a payload |
| Surface exploration | Deployable controllable rover, wheels, terrain and solar charging | Drive to science sites and return results within an energy budget |
| Planetary exploration | Further destinations and longer transfer and surface missions | Coordinate launch timing, propulsion, communication and surface energy |

Level order is a proposal; the feature commitments are confirmed. Every flight and surface-driving view remains 2D. New levels may combine existing mechanics before introducing a new one.

### Requirements for later capabilities

**Multistage rockets.** Add compatible decouplers and an editable stage sequence to the builder. On separation, split the attachment graph, recalculate mass, inertia and fuel/electrical paths, and transfer control to the selected command-bearing vehicle. Detached parts inherit appropriate position and velocity and cannot keep feeding the active stage. Stage delta-v estimates account for future discarded dry mass. Prevent accidental simultaneous activation or separation through clear stage previews and deliberate commands. Validate momentum and mass accounting at separation; detailed debris simulation can remain bounded.

**Extraterrestrial flight.** Define celestial bodies through data: radius, gravitational parameter, coplanar orbit, rotation, surface, atmosphere where applicable, and lighting. The first Earth-only model must not hardcode these properties throughout the game. Choose and validate a multi-body or patched-conic propagation approach before adding lunar travel; ensure reference-frame changes do not create artificial velocity jumps. Transfers, orbit capture, landing and time warp must use a consistent world clock and trajectory model. Additional destinations must not be cosmetic Earth reskins with identical gravity and atmosphere.

**Controllable rovers.** Players assemble or select a rover payload, transport it, land it, deploy it, and switch control from the lander to the rover. A 2D side-view terrain model provides wheel contact, traction, slopes, obstacles and tipping. Rover mass, motor torque, grip, speed and electrical demand affect driving. Support stop, forward/reverse, speed control, instrument use and deployment actions. Battery depletion stops powered motion without erasing data; solar charging can restore operation when illumination permits. Surface terrain and wheel physics require their own validation alongside orbital physics.

**Solar power.** Panels and batteries are first-release components, not a feature postponed until rover levels. Later levels extend the initial sunlight/eclipse model with local day and night, panel deployment or orientation, terrain shadowing, and destination-dependent sunlight. Rover driving, instruments, heaters if introduced, and communication share the electrical budget. Resource displays distinguish generated power, consumed power and stored energy; high time acceleration must still resolve nightfall and depletion.

### Architectural provisions

Keep celestial-body data separate from the propagator, and allow multiple vehicle identities with one selected control target. Preserve local part coordinates and attachment graphs independently from world position and velocity. Reserve explicit vehicle modes for attached launch stages, free flight, landed craft and rover driving. Stage, deployment and landing transitions emit events and update the same resource ledger. Save schema changes must record body/frame identity, vehicle membership and control target. These are extension points for the core design; implementing every later mechanic is not required for the first playable release.

## 13 Scientific references and interpretation

The following sources support the underlying concepts. They do not validate the fictional catalogue, mission thresholds, event probabilities, or learning outcomes; those require our own implementation checks and playtesting.

- NASA, *Catalog of Earth Satellite Orbits*. Background on orbital altitude, inclination, and observation patterns. https://science.nasa.gov/earth/earth-observatory/catalog-of-earth-satellite-orbits/
- NASA, *Small Spacecraft Technology State of the Art Summary*. Background on coupled spacecraft subsystem constraints and the relationship between data production and downlink capacity. https://www.nasa.gov/smallsat-institute/sst-soa/summary/
- NASA, *Communications*. Background on spacecraft and ground communication segments. Version 1 deliberately substitutes a contact-gated effective rate for a detailed RF model. https://www.nasa.gov/smallsat-institute/sst-soa/soa-communications/
- NASA, *Ground Data Systems and Mission Operations*. Background on ground networks and direct-to-Earth communication opportunities. https://www.nasa.gov/smallsat-institute/sst-soa/ground-data-systems-and-mission-operations/
- NASA Glenn, *Specific Impulse*. Relationship between thrust, propellant flow and specific impulse. https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/specific-impulse/
- NASA Glenn, *Ideal Rocket Equation*. Basis for the labelled ideal delta-v estimate and vacuum burn verification. https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/
- NASA, *Gravity and Mechanics*. Background on thrust, orbital energy and manoeuvres. https://science.nasa.gov/learn/basics-of-space-flight/chapter3-4/

The next step is to review and revise this specification, then freeze a version 1 scope before writing the game.

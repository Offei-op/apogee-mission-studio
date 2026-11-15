# Simulation and rendering architecture

## M1 implementation update

The original M0 contracts below remain the foundation. M1 now adds the pure builder in `src/core/builder.ts`, the fixed-step flight model in `dynamics.ts`, guidance in `guidance.ts` and orbital elements/prediction in `orbit.ts`. Builder and dynamics consume the data catalogue; generic geometry and mass accounting retain caller-supplied definitions. They do not depend on browser or renderer APIs.

The browser owns command input and wall-clock scheduling, then advances the same 0.02-second dynamics at every time rate. It checks warp safety between substeps. SVG scenes consume live state. Editor geometry is cloned and recentred at flight creation so moving the whole design cannot change its launch conditions. The inspector and drag preview use immutable builder results, including translated child parts, before committing a drop.

See [M1_PHYSICS.md](M1_PHYSICS.md), [M1_RENDER.md](M1_RENDER.md) and [M1_REVIEW.md](M1_REVIEW.md) for current implementation details and measured evidence. The M0-only descriptions below record the earlier milestone boundary; flight is no longer a mockup. Persistence remains a future contract.

## M0 boundary

M0 establishes contracts, geometry, fictional component data, a static reference assembly and validation helpers. It does not implement flight, fuel consumption, time warp, science credit, or a working drag builder. Passing M0 tests does not establish orbital reachability or validate engine balance.

`src/core` contains pure types, transforms, mass accounting and assembly checks. Core never imports UI, rendering, browser APIs or the catalogue. Callers supply part definitions. `src/data/parts.ts` supplies `PARTS`, `getPart`, `SAMPLE_CRAFT`, and explicit `SAMPLE_CONNECTIONS`. Definitions are authoring data; instances hold mutable mission quantities such as tank contents. Clone reference fixtures before editing them.

## Coordinates and geometry

All physical quantities use SI units, with units encoded in property names. World/inertial axes and local component axes use x right and y up; angles are radians counterclockwise. Local origin is the geometric centre. `positionM` in an assembled part instance is its origin in assembly coordinates, not planetary position. Vehicle position later specifies the assembly reference origin in its declared reference frame.

The engine points upward at angle zero, with exhaust downward. Rendering converts y-up into screen coordinates only at the camera boundary. Map zoom and camera changes must never rescale physical dimensions or mutate simulation values.

Component width and height define its physical size. The collision rectangle is separate from illustration details. Connector positions, connector normals, and engine exhaust origin are local physical geometry used by every renderer and the builder. Artwork must fit these shared bounds. Do not use sprite pixel dimensions for physics or snapping.

`worldPoint` currently means a part-local to assembly-coordinate transform; the name does not imply a planetary reference frame. `worldNode` also rotates the connector normal. `assemblyBounds` returns the conservative collision envelope. Mass properties approximate every component, including evenly distributed tank propellant, as a rectangular lamina, with the parallel-axis theorem for rotational inertia. This simplification must be revisited if tank fill distribution becomes a learning mechanic.

The reference stack has command centre (0, 3.8), tank centre (0, 0), engine centre (0, -3.7), and solar centre (2.8, 0), all metres. The command bottom meets the tank top at y=2.5; tank bottom meets engine top at y=-2.5. Right-side solar mount meets the tank at x=1.2. Total collision extent is 10 metres tall and 5.6 metres wide. The asymmetric solar array deliberately makes centre of mass slightly off-axis; M1 must model rather than conceal that torque.

## Assembly and resources

Connections are explicit pairs of part/node IDs. Proximity alone does not create a connection. The M0 validator checks identities, finite transforms, tank capacities, command count, occupied nodes, connector type/size/alignment, category pairing, disconnected graphs, cycles and rectangle penetration. It is not the complete launch-readiness service. Exhaust obstruction, graph-based fuel/electrical feed, build envelope and budget gates must be implemented in the builder milestone. Validate imports before calculating or rendering untrusted data; TypeScript interfaces alone are not runtime validation.

Mass accounting includes each instance's dry mass and remaining tank propellant. Fuel pricing is separate from tank hardware cost. M0 values are fictional preview settings. Do not label the sample spacecraft as capable of orbit until a documented assisted ascent passes M1. `getPart` returns undefined for unknown IDs; callers must handle missing definitions explicitly.

## Future state and commands

The simulation is authoritative. UI sends timestamped commands; a reducer/simulation step validates and applies them. Rendering consumes read-only snapshots and interpolates display state without feeding values back into physics. Commands use simulation timestamps so a replay can run at different render frame rates or time-warp rates with the same physical outcome.

`VehicleSnapshot` includes stable vehicle identity, assembly identity, reference-body identity, position, velocity, angle, angular velocity, throttle, battery, and movement mode. `MissionSave` reserves a versioned catalogue, schema version, common simulation time, selected vehicle, seed, multiple vehicles and command history. These are M0 contracts, not an implemented persistence system. Extend with scenario version, pending events and deterministic random-generator state when those systems arrive. Never silently reinterpret a saved catalogue version.

Staging later partitions the assembly graph into new vehicle identities, preserves local transforms and point velocities, recalculates fuel/electric paths and mass properties, and transfers control deliberately. Celestial body definitions are separate data; physics must not hardcode Earth parameters. Frame conversions must preserve physical state. Rover mode will use a separate terrain-contact model while retaining the same resource ledger and clock.

## Verification

Run `node --test src/core/assembly.test.ts` with Node 24. M0 fixtures independently check coordinate transforms, analytic mass arithmetic, connector continuity, invalid capacities, invalid connectivity and collision edge contact. M1 must add orbital conservation, rocket-equation, depletion, timestep-convergence, prediction and warp equivalence tests before any claim of verified flight.

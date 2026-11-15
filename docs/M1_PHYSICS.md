# M1 flight physics

## Implemented scope

M1 provides actual two-dimensional powered ascent, engine-off coast, manual torque control, bounded attitude hold and gimbal, fuel depletion, a changing-mass trajectory, simplified atmospheric drag, impact, electrical consumption, simple sunlight/eclipse charging, orbital elements and a geometric coast forecast. The rendering layer reads this state; guidance sends the same throttle and attitude targets available to ordinary flight controls. No scripted positions, orbital teleportation, arbitrary velocity assignment or decorative orbit substitution occurs during ascent.

The catalogue has not been retuned. Its numbers remain fictional educational components. M1 proves that the existing reference assembly can reach one stable eccentric orbit under the implemented model; it does not establish real-world spacecraft feasibility or precision insertion into the planned 400 km target orbit.

## Modules and interfaces

- `src/core/dynamics.ts` exports `FlightState`, `createFlight(assembly)`, `stepFlight(state, dt)`, `advanceFlight(state, duration)`, `telemetry(state)`, `atmosphere(altitudeM)`, `PHYSICS_STEP_S`, `G0` and `EARTH`. It re-exports the shared `connectedTankIds` helper from `assembly.ts`.
- `src/core/orbit.ts` exports `EARTH`, `orbitElements(position, velocity, body?)`, and `predictCoast(position, velocity, count?)`.
- `src/core/guidance.ts` exports `applyGuidance(state)` and changes only guidance/control fields, messages and the assistance flag.

`FlightState.positionM` and `velocityMPerS` are Earth-centred inertial translational state. Positive angle is counterclockwise from the initial body orientation, whose +Y axis points upward and supplies nominal thrust. At the north launch point Earth rotates toward negative X; the initial inertial velocity includes that rotation. Ground-relative vertical/horizontal speeds subtract the rotating atmosphere velocity. The inertial speed therefore reads approximately 465 m/s while the rocket is stationary on the launch pad.

At flight creation the cloned assembly is translated so its initial centre of mass is the local origin. Pad clearance is then derived from the normalized collision envelope. Moving the whole craft around the editor therefore cannot change launch altitude, inertia or the subsequent flight. The editor's assembly data is not mutated.

Torque uses the computed instantaneous centre of mass and rectangular-lamina inertia. The compact craft's translational state is a point-mass approximation anchored to the initial centre-of-mass reference: later fuel-dependent centre migration affects torque but does not add a separate translational frame correction. The reference craft's local centre migration is less than a metre. Part geometry is used for pad clearance, drag area and rotational handling, while ground collision after launch currently tests the translational point against the spherical surface. Full-part terrain contact belongs to the later landing/rover model.

## Equations and stepping

Earth radius is 6,371,000 m; gravitational parameter is 3.986004418e14 m3/s2; rotation rate is 7.2921159e-5 rad/s. The reference gravity used for specific impulse is 9.80665 m/s2. All physical state uses SI units.

Translation integrates position and velocity with classical fourth-order Runge Kutta using steps no larger than 0.02 simulated seconds:

`dr/dt = v`

`dv/dt = -mu*r/|r|^3 + (T*u + D)/m`

Engine thrust and specific impulse interpolate between catalogue sea-level and vacuum ratings using a simplified exponential pressure ratio. Propellant flow is `T/(Isp*g0)` and is removed only from compatible tanks reachable through the shared validated feed graph. Each integration step evaluates thrust acceleration at initial, midpoint and final mass. The last powered step is split at the exact remaining-fuel duration. Negative fuel and continuing thrust after depletion are excluded.

Ideal remaining delta-v uses `Isp_vac*g0*ln(m_current/m_without_accessible_propellant)`. This excludes gravity and drag losses. TWR is the maximum currently available engine thrust divided by local weight, rather than throttle-scaled instantaneous acceleration; it becomes zero if fuel or electrical control is unavailable.

The steering controller requests bounded angular acceleration, then applies electric torque up to catalogue authority and uses the engine's limited gimbal range for the remaining torque when hold/manual control is active. The actual gimballed thrust is applied at the mounted engine relative to the changing centre of mass. Hold uses a proportional/derivative controller; it does not reset angle, angular velocity or off-axis torque. With hold disabled and steering released, asymmetric thrust can spin the craft. Electrical control is an explicitly simplified attitude system, not a detailed reaction-wheel momentum-saturation model. Variable-mass rotational flow effects and structural flex are also omitted.

Atmospheric density is `1.225*exp(-altitude/8500)` kg/m3 below 100 km, with a declared vacuum cutoff at 100 km. Drag is `-0.5*rho*Cd*A*|v_relative|*v_relative`, using Cd=0.28 and a bounded assembly-derived projected-area approximation. Drag acts against motion relative to the rotating atmosphere. This is not an Earth standard-atmosphere or aerodynamic design solver; there is no lift, aerodynamic torque, heating, wind, structural failure or realistic deployed-panel ascent survival.

The pad supplies support until outward thrust exceeds local weight. Engines can burn fuel while unable to lift off. During unsupported flight a surface crossing ends in impact. Continuous collision timing is bounded by the 0.02-second step; the point may penetrate slightly before the impact state is recorded.

Electrical accounting sums command and attitude-actuator demand and solar output, integrates W to Wh through simulated time, and clamps stored energy to rated capacity. The Sun is fixed along +X; Earth's shadow is the corresponding simple cylinder in this 2D model. Orientation, panel deployment and charging efficiency are not yet modelled. Main engine and electric steering commands become unavailable at zero stored energy, while gravity, momentum and existing rotation continue.

## Time acceleration and forecast

Time acceleration batches the same small physical steps; it does not multiply velocity, thrust or fuel. Browser/UI code limits allowed warp during burns and atmospheric flight. The core accepts a simulated duration and integrates it; it does not infer wall-clock speed or enforce UI warp limits. Identical simulation-time inputs produce equivalent results independent of batch size within the tested tolerances.

The coast predictor derives an osculating conic from current position and velocity. Bound trajectories display current apoapsis, periapsis and period; escape paths have null apoapsis and period. Apsis values are altitude above the spherical surface. Forecast geometry is capped at surface contact or a bounded escape extent and never assumes that continued throttle is part of the coast path. A degenerate radial trajectory is represented as a radial line, not a fabricated ellipse. The line is an illustrative geometric extent, not a timed ballistic forecast.

The current implementation does not perform multi-body propagation, event-time root solving, stage separation, rover contact or a finite-burn future preview. Even at high warp the short step bounds contact, atmosphere and depletion events; exact event-located coasting can be added later if profiling warrants it. Resource transitions such as battery depletion have the same step-resolution limit.

## Reference ascent evidence

Reference inputs are the unchanged `SAMPLE_CRAFT` and `SAMPLE_CONNECTIONS`, full 26,000 kg propellant, initially full command battery, and `assistance=true`. The pilot sets ordinary targets through `applyGuidance`; it follows an altitude-dependent pitch schedule, limits thrust acceleration through throttle, and cuts off once periapsis exceeds 120 km. It is tuned for this reference craft, not a general optimal ascent algorithm.

Measured on 14 November 2026 by repeated 0.02-second calls:

| Quantity at guidance cut-off | Result |
|---|---:|
| Simulation time | 241.10 s |
| Altitude | 145.347 km |
| Inertial speed | 8,158.750 m/s |
| Ground-relative vertical speed | 206.622 m/s |
| Ground-relative horizontal speed | 7,680.953 m/s |
| Periapsis altitude | 120.075 km |
| Apoapsis altitude | 1,431.490 km |
| Orbital period | 6,012.801 s |
| Remaining propellant | 64.423 kg |
| Remaining ideal vacuum delta-v | 122.764 m/s |

One additional complete coast orbit preserves those apsides and returns to the cut-off position within centimetres in the numerical test run. This is a stable eccentric orbit above the model's atmospheric cutoff. Its fuel margin is small, and the result must not be described as a circular 400 km mission orbit. Broader reference designs and precise circularisation are future tuning work.

## Verification gates

Run `node --test src/core/dynamics.test.ts src/core/orbit.test.ts`, or `npm test` to include assembly/builder checks.

Tests use independent rocket-equation, vis-viva and circular-period calculations rather than only comparing the predictor with its own simulation. They verify fuel flow, ideal vacuum delta-v, the depletion boundary, disconnected tanks, engine-off steering, asymmetric thrust torque, ten circular orbits, same-time command replay in different batches, half-step convergence, real prograde/retrograde burns, actual reference ascent followed by a complete coast orbit, impact, pad support, rotating-relative telemetry, escape and surface-intersecting forecasts. A regression fixture translates the entire reference craft by 100 m horizontally and -200 m vertically in editor coordinates, then verifies unchanged pad placement, flight outcome and original editor data.

The ten-orbit radius and specific-energy tolerances are 0.1 percent. The vacuum burn test is stricter than the planned 0.5 percent rocket-equation tolerance. These passing fixtures support the limited M1 model. They do not validate omitted aerodynamics, real hardware, learning effectiveness or future extraterrestrial manoeuvres.

## Scientific background

The equations and distinctions between thrust, propellant flow, ideal delta-v and orbital energy are consistent with the following NASA teaching references. Component statistics, atmosphere approximation, controller gains and ascent tuning are game design choices requiring their own validation.

- NASA Glenn, [Specific Impulse](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/specific-impulse/).
- NASA Glenn, [Ideal Rocket Equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/).
- NASA, [Gravity and Mechanics](https://science.nasa.gov/learn/basics-of-space-flight/chapter3-4/).

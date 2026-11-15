# M2 coastal observation mission

## Playable objective

Build an uncrewed spacecraft within 6,500 mission credits, launch it, establish an orbit, collect one unique daylight observation of Equatorial Coast, and fully return its 16 MB of data through Dawn Ground Station within two simulated hours. Observation by itself and partially transmitted data do not complete the objective. The deadline is inclusive: a complete acknowledgement at exactly the deadline qualifies.

This is the first complete educational mission, with a deliberately small objective. The command module's existing 650 kg dry mass and 1,800-credit hardware price include a fictional survey camera, radio and 32 MB storage. M2 does not add invisible mass-free equipment on top of a command-only part. Distinct instrument, radio and storage choices belong to the planned catalogue expansion.

Hardware and loaded propellant costs come from the actual initial design; a fixed 700-credit allocation covers mission operations and ground access. The initial total is captured once in `MissionState.designCostCredits` and is not reduced as propellant burns. `createMission` rejects costs above the scenario budget. The UI must start a fresh flight from the editor craft before creating the mission; creating it partway through a fuel-depleted free-flight run would not capture that run's original expenditure.

The target and station are fictional teaching locations in the coplanar simulation. Their coordinates are game-frame longitudes, not a georeferenced claim about the precise coastline visible in a decorative Earth texture.

## Actual geometry

`MISSION_CONFIG` in `src/core/mission.ts` defines the target at -20 degrees and station at +10 degrees measured counterclockwise from the world +X direction at simulation time zero. Both rotate with the same Earth clock used by flight dynamics. `surfacePoint(longitudeRad, timeS)` returns the current world position for the renderer. There is no scripted contact timer or target-pass trigger.

Camera operation requires a flying spacecraft above 100 km, a bound orbit with periapsis at least 100 km, daylight at the target, sunlight at the spacecraft, and target proximity within the camera footprint. The footprint uses a simplified local-flat projection of a 25-degree half-field-of-view onto the spherical ground angle. It scales with altitude. The integrated educational camera automatically tracks nadir; independent pointing mechanics and angular-rate blur are not modelled in M2 and must not be inferred from the spacecraft attitude alone.

Collection requires five continuous simulated seconds of valid powered camera operation. Interrupted dwell resets and earns no data. One complete collection produces a 16 MB observation record. The same target cannot produce a second qualifying record during the run.

Contact uses line-of-sight geometry above a ten-degree station elevation mask. Radio transfer requires a positive-data queue, an enabled radio, available payload power, and actual contact. Effective rate is a fictional constant 1 Mbps. Conversion is explicit: `MB transferred = Mbps * seconds / 8`, using decimal megabytes consistently. Interrupted transmissions retain their remaining byte-equivalent quantity and resume on later contact. Storage is reclaimed only for successfully transmitted quantities; acknowledgement is recorded when the entire observation has arrived.

Detailed antenna pointing, variable-distance link budgets, clouds, image-resolution scoring and interference are omitted from this first mission. These do not justify fabricating target or communication opportunities.

## Power integration and safe mode

The flight simulation already accounts for baseline command demand, finite electrical attitude actuation, solar generation, sunlight/eclipse, battery capacity, thrust and propellant. Mission payload demand is added exactly once through optional `FlightState.payloadPowerW`:

```ts
flight.payloadPowerW = missionPower(mission, flight);
stepFlight(flight, 0.02);
stepMission(mission, flight, 0.02);
```

Call this sequence for every fixed physical interval, including intervals executed inside a high-warp batch. `missionPower` prepares the start-of-interval camera/radio activity and returns only its additional demand. `stepMission` checks matching clocks and consumes that prepared activity after dynamics has advanced. The consumed preparation is cleared. The UI must not also debit baseline, solar or payload energy separately.

The camera consumes 60 W during active dwell and the radio 40 W while actively transmitting. Mission telemetry's `powerDrawW` is **payload power**, not an estimate of the complete spacecraft's electrical load. Tests verify a camera interval with no solar or attitude demand draws exactly baseline 40 W plus camera 60 W, not twice either value.

Payload safe mode enters at 20 percent of installed battery capacity and exits only after recovery to 30 percent. It suspends the camera and radio, retaining their user enable settings and queued data. Baseline flight systems retain priority and continue to use energy. A solar-less craft can therefore complete this short mission using its battery, while solar generation provides greater operational margin. Safe-mode pauses must not manufacture or silently discard science credit.

The first and last fraction of a geometric window are resolved by the fixed 0.02-second interval. Prepared operation is held during that short interval; its boundary uncertainty is at most one interval. The core requires a separate preparation and mission update for each physical interval, rather than accepting a long warp-duration update that could skip a window.

## State, validation and persistence contract

`MissionState` includes scenario ID/version, start/deadline/update clocks, captured design cost, status, camera/radio enable flags, safe mode, partial dwell, observation records, bounded event log, and diagnostic counters. Observation records contain target identity, collection time, original size, remaining size, scientific qualification and nullable complete-acknowledgement time. Progress is derived from unique fully acknowledged qualifying targets, never from a free-standing editable score.

Statuses are `active`, `success`, `failed` and `ended`. Surface impact or an unmet deadline fails the objective; voluntary early termination uses `ended`. Terminal observation records remain unchanged by later stepping. The report preserves the successful acknowledgement time as its completion time even if the player continues coasting afterward.

`validateMission(value, flight?)` throws for unsupported scenario versions, invalid clocks/deadlines, budget violations, malformed counters, over-capacity storage, negative or nonfinite data quantities, duplicate science records, impossible acknowledgement times, status/progress contradictions, or unfinished interval preparation. Optional flight validation also checks clock agreement, battery-counter consistency and crashed/active contradictions. Accepted state is cloned.

Save only after `stepMission`, when `prepared === null`. The session layer additionally validates craft and flight state and checks the captured mission cost against the original editor design plus the fixed allocation. This is consistency checking for a local educational game, not tamper-proof verification of an imported run's entire historical trajectory.

## Feedback and timeline

Telemetry exposes observation-window state, contact, sunlight, queued storage, delivered quantities, unique progress, safe mode, payload power and a contextual explanation. `nextEventS` currently identifies the next known scheduled deadline, with `nextEventKind: 'deadline'`. It does **not** claim to predict the next contact or observation time. The map supplies actual target and station positions; any later contact countdown requires a separately validated time-propagation forecast.

Debrief explanations are grounded in recorded activity: absence or interruption of a qualifying target window, disabled camera, full storage, data waiting outside contact, disabled radio during contact, energy-reserve suspension, impact, early termination or deadline expiry. Suggestions follow the identified cause. For example, waiting for a geometric station pass is not diagnosed as a need for a faster radio.

## End to end evidence

Both runs below start on the actual surface with the same real-Earth physics, full propellant and battery, ordinary ascent assistance, and enabled camera/downlink. Each interval calls the power/flight/mission sequence above. The game coasts along the achieved orbit until the physical target and station geometries permit their activities.

| Outcome | Reference with one solar array | Same craft without solar |
|---|---:|---:|
| Initial mission cost | 5,870 credits | 5,420 credits |
| Observation complete at | 4,849.94 s | 4,742.58 s |
| Full acknowledgement at | 5,315.98 s | 5,214.58 s |
| Mission deadline | 7,200 s | 7,200 s |
| Returned qualifying data | 16 MB | 16 MB |
| Battery at completion | 400.00 Wh | 338.40 Wh |
| Remaining propellant | 64.42 kg | 184.81 kg |
| Payload electrical energy | 1.50556 Wh | 1.50556 Wh |
| Result | Success | Success |

These results demonstrate a meaningful trade-off: removing the array saves 450 credits and 45 kg, improves propulsion margin and changes the achieved orbit and pass timing, but provides no electrical replenishment. The solar-equipped design reaches the same scientific objective with a fuller battery. Neither design dominates every measured outcome.

These are deterministic software reference runs measured on 14 November 2026, not student usability results or proof of real satellite performance. The full mission takes roughly 87–89 simulated minutes; presentation speed depends on the permitted ascent and coast warp rates, student decisions and pauses.

## Verification

`node --test src/core/mission.test.ts` verifies:

- Physically qualifying daylight and orbit windows, with no collection at a wrong or dark target location or on an escape path.
- No transfer without contact and complete delivery through a genuine geometric contact.
- Camera/radio disable commands and interrupted-dwell behaviour.
- Exactly-once payload energy debit and 20/30-percent safe-mode hysteresis.
- Full-buffer rejection without overwrite, using an explicit synthetic preloaded-buffer unit fixture.
- Duplicate-credit rejection, partial transmissions and inclusive deadline completion.
- Malformed-save rejection and consistent JSON roundtrip.
- Mission budget enforcement and immutable original expenditure after fuel consumption.
- Equivalent mission bytes and energy across different warp batch sizes when physical intervals are preserved.
- Both complete surface-launch-to-returned-data designs in the table above.

Run the complete `npm test` and production build after integration with browser controls and persistence. Browser QA must separately establish that the mission can be understood and completed without developer commands; the core fixtures do not substitute for that check.

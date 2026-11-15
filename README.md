# Apogee Mission Studio

A local browser game for permanently 2D spacecraft building, flight and science operations. M2 connects assembly and orbital flight to a budgeted observation mission, battery/solar power, ground-station downlink, a causal debrief and local session saves.

## Project presentation

[Download the seven-slide PowerPoint showcase](docs/presentations/Apogee-Mission-Studio.pptx).

## Run

Use Node.js 24 LTS and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. For a production build and local preview:

```sh
npm run build
npm run preview
```

Run engineering fixtures with `npm test`. No account, API key or backend is required.

## Build and fly

- The reference craft is loaded initially. Select **Go to launchpad**, enable **Ascent assist**, then select **Launch**. Choose **5×** to watch the guided ascent faster. Guidance cuts thrust when it establishes a periapsis above 120 km, approximately four simulated minutes after launch.
- To build yourself, select **New craft**. Drag a tank onto the bottom connector of the command module, then drag an engine below the tank. Solar arrays snap to either side of a tank, automatically facing the correct way. Select an installed array and **Flip side** to move it to the opposite free mount. A valid ghost indicates a compatible drop; an invalid drop leaves the design unchanged.
- Keyboard alternative: select a library part, then select **Add part**. The builder chooses a valid free compatible connector. Use **Remove part**, **Undo**, **Redo**, and the tank-fill slider to experiment. Engineering details report mass, fuel, TWR and ideal delta-v. Readiness blockers explain why launch is unavailable.
- Manual flight: **left/right arrows** apply steering torque, **up/down arrows** change throttle, **Space** cuts the engine, and **P** pauses. You can also hold the steering buttons and use the throttle slider. **Attitude hold** stabilizes the current orientation; **Ascent assist** is tuned for the supplied reference craft. Manual steering or throttle disables assistance.
- Switch between **Test flight** and **Orbit** while the same flight continues. The orbit view projects a gravity-only coast with no future thrust; atmospheric drag can alter that path. A surface-intersecting prediction is not a safe orbit.
- **Pause**, **Retry flight** and **Edit craft** preserve a quick experimentation loop. Editing pauses flight; changing the design resets the flight and science run. Leaving the browser tab pauses simulation.
- Use the mouse wheel or **− / + / Fit** to zoom the assembly, flight scene and orbital map independently.
- Sessions autosave locally every five real seconds. **Save session**, **Resume saved**, **Export** and **Import** provide explicit control. Reload resumes paused; importing validates the version, craft, resources and mission clocks. Browser storage belongs to the current origin, so changing the localhost port creates a separate save location.

Time controls offer 1×, 5×, 10× and 100×. Powered/assisted flight is limited to 5× and atmospheric coasting to 10×. Manual steering, throttle changes and ignition return to 1×. Fixed physics substeps are retained at every speed. High-rate coast automatically slows on atmospheric entry.

The reference reaches a stable **eccentric** orbit, approximately 120 km periapsis and 1,431 km apoapsis. It does not target a precise 400 km circular orbit, and its remaining fuel margin is small. Component values are fictional; the result demonstrates the game's model, not real-world hardware feasibility.

## Complete the science mission

Select **Mission → Start science mission → Launch**. This starts a fresh guided flight with the camera and radio enabled. Use **5×** during ascent, then **Coast at 100×** after orbital insertion. One 16 MB daylight observation must reach the ground station within two simulated hours and a 6,500-credit budget. The reference craft costs 5,870 credits including operations.

The camera collects only over the target in a qualifying orbit. The radio transmits only during actual station contact. The map marks both locations and the dashboard explains current constraints. Collection automatically slows time; select **Coast at 100×** again to wait for downlink. Solar generation, eclipse, battery reserves, data storage and transmission progress continue through every fixed physics step. Success opens a debrief with costs, resources and an event timeline; the report can be downloaded.

The command module includes the first mission's camera, radio and storage in its existing mass and cost. Separate instrument choices, multistaging, other celestial bodies, landing and rovers remain later milestones. See [M2 mission model](docs/M2_MISSION.md) for equations, simplifications and the two verified viable designs.

## Project structure

| Location | Purpose |
|---|---|
| `src/core` | Browser-independent builder, geometry, mass/fuel accounting, flight dynamics, guidance, orbit prediction and tests |
| `src/data` | Fictional part definitions and exact sample assembly |
| `src/render` | Original SVG artwork and scenes using the shared geometry |
| `src/main.ts` and `src/style.css` | Builder interactions, keyboard/pointer controls, fixed-step flight loop and readable interface |
| `docs/ARCHITECTURE.md` | Units, frames, commands, saves and extension boundaries |
| `docs/ART_DIRECTION.md` | Reference interpretation, style and asset conventions |
| `docs/M0_REVIEW.md` | Integration checks, screenshots and limitations |
| `docs/M1_PHYSICS.md` | Equations, reference ascent evidence, numerical checks and model limitations |
| `docs/M1_REVIEW.md` | Integrated builder and flight verification |
| `docs/M2_REVIEW.md` | Mission, saves, solar mounting and zoom verification |
| `docs/EARTH_ASSET.md` | Local Earth imagery source and rendering limits |
| `PLAN.md` | Milestones, gates and progress evidence |

## Technical choice

TypeScript, Vite and DOM controls with SVG scenes keep this first milestone small. SVG provides scalable, inspectable part geometry and sharp rendering at different zoom levels. Pure core modules do not depend on browser APIs or the artwork. Future flight physics will supply state to rendering through the documented contracts.

Dependency versions are fixed by the lockfile after installation. Official references checked for the choice: [Vite getting started](https://vite.dev/guide/) and [MDN SVG viewBox](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/viewBox).

## Target displays and performance reference

Target browser viewports are 1440 by 900 for desktop and 1024 by 768 for landscape tablet. Smaller widths should remain usable but phone gameplay is not a first-release target.

The proposed performance reference is an Intel Core i5-8250U laptop with 8 GB RAM and integrated graphics, running a current Chromium browser at 1440 by 900. This is a declared target configuration, not a device on which performance has already been measured. The local host CPU/RAM query was unavailable through the execution sandbox. M0's static SVGs do not establish M1 flight frame rate; measure input responsiveness and the 30 fps minimum on the reference device before claiming that gate passes.

Flight telemetry is now computed from the evolving state. Reference orbital reachability is verified within the simplified model; classroom learning outcomes and performance on the declared reference device remain unmeasured.

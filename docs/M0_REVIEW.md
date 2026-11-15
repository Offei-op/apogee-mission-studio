# M0 integration review

14 November 2026

## Scope delivered

Three original interactive design mockups: assembly, powered flight and orbital map. A shared four-part catalogue supplies dimensions, local origins, attachment nodes, collision bounds, instance placements and engine exhaust origin. The same rendering function draws the same assembly in assembly and flight views. Browser-independent interfaces and helpers establish units, frames, mass accounting, vehicle identity, timestamped commands and versioned saves.

No drag building, flight integrator, consumed resources, functional time warp or saved mission is claimed at M0. All flight telemetry, orbit paths and forecast controls are visibly illustrative. Component statistics remain fictional and unvalidated for orbital reachability.

## Specialist review and fixes

| Finding | Resolution |
|---|---|
| Decorative noncircular Earth-centred orbit could teach incorrect geometry | Changed the coast path to a circle; placed the craft on it; alternative ellipse has Earth at a focus and meets the craft |
| Repeated SVG icons reused internal identifiers | Unique prefixes now distinguish all scene and icon instances; browser DOM inspections found no duplicate IDs |
| Attitude and velocity arrows were unlabeled | Added separate labels and distinct illustrative directions |
| Supporting text was too small | Increased supporting typography and preserved internal panel scrolling on tablet |
| Rerendering could lose keyboard focus | Restored focus to the active control after button updates; range changes update without replacing the slider |
| Catalogue access guessed field names through unsafe casts | Replaced with actual typed part definitions and explicit missing-part handling |
| External font loading made preview depend on another service | Removed external font requests; use local system fonts |
| Assembly limitation was below the tablet scroll area | Added a concise explanation near the component-library heading |
| Production bundling failed in dependency parsing | Clean installation, regenerated lockfile and Rollup 4.67.5 override restored normal import parsing; lead independently reran the production build successfully |

The lead reviewed the integrated application; the gameplay reviewer independently inspected the tablet assembly and flight screenshots. No severe visual or usability blocker was identified in those screenshots. Student playtesting has not occurred.

## Checks performed

- `npm test`: five analytical fixtures passed, zero failures. Covers sample connector alignment, component/propellant mass arithmetic, coordinate rotation, invalid assembly state and rotated rectangle collision/contact.
- `npm run build`: strict TypeScript and Vite production bundling passed after dependency repair; output generated in dist. The lead independently reran this after the specialist's check.
- Opened the app through a local Vite server in the in-app Chromium browser.
- Inspected all three scenes at 1440 by 900 and 1024 by 768.
- Selected components by pointer and selected the solar array using Enter; inspector and selected state updated.
- Toggled attachment-node display and changed assembly zoom from 100 to 110 percent.
- Changed throttle to 30 percent; the displayed value and exhaust changed together. Keyboard Home set zero while retaining slider focus; engine cutoff left zero throttle with button focus preserved.
- Opened flight and orbit from the navigation and contextual action buttons.
- Toggled the illustrative orbit forecast and verified its pressed state changed.
- Inspected document dimensions at both target viewports: no page-level overflow. Side panels intentionally scroll where content exceeds available height.
- Inspected browser error logs after the three-view walkthrough: none reported in the checked session.
- Restarted the local server with repaired dependencies, reloaded the app and verified view navigation again. Stopped the owned preview server after verification; use `npm run dev` to reopen it.

## Screenshot evidence

| View | Desktop | Landscape tablet |
|---|---|---|
| Assembly | [1440 by 900](../artifacts/m0/assembly-1440.jpg) | [1024 by 768](../artifacts/m0/assembly-1024.jpg) |
| Flight | [1440 by 900](../artifacts/m0/flight-1440.jpg) | [1024 by 768](../artifacts/m0/flight-1024.jpg) |
| Orbital map | [1440 by 900](../artifacts/m0/orbit-1440.jpg) | [1024 by 768](../artifacts/m0/orbit-1024.jpg) |

Evidence files are local QA outputs under the ignored artifacts directory. The desktop assembly screenshot includes the final library-heading clarification; the earlier tablet assembly screenshot predates that text-only clarification.

## Limits and next milestone

The performance reference configuration and target viewports are declared in README.md. Actual frame rate on the reference school laptop is unmeasured. Static SVG checks do not establish flight performance. Reduced-motion rules and visible focus styles exist; a complete accessibility audit, assistive-technology testing and student pilot remain future work.

M1 should establish a valid manual and assisted launch through verified dynamics, with a reachable reference craft before catalogue expansion. Tests must compare against independent analytical expectations, not only predictor/replay agreement from shared code.

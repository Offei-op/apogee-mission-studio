# Art direction

## Intent

An original side-view spacecraft game with precise, readable engineering and the atmosphere of a restrained mission-control console. The inspiration collection guides proportions, modularity and the distinction between assembly and flight; its images are not production assets.

## Visual language

- Warm ivory hulls, graphite nozzles, muted aluminium bands, ochre insulation, and blue-black photovoltaic cells.
- Broad silhouettes first, panel seams and small mechanical details second. Detail must survive the normal gameplay zoom without becoming noise.
- Cylindrical parts receive restrained side shading; all parts share one lighting convention. A warm upper-left highlight and cool lower-right shadow establish volume without introducing a perspective mismatch.
- Assembly uses a pale blueprint field with a low-contrast grid and precise snap nodes. Flight uses a dark atmosphere, a luminous Earth limb, and restrained exhaust. Orbit uses generous negative space, a clear Earth silhouette and readable paths.
- Amber is reserved for selection, guidance and active actions. Cyan indicates informational geometry or compatible connections. Status also uses text or shape, never colour alone.
- Satellite and rover assets must be redrawn in the same orthographic side-view system. Isometric reference art must not be mixed directly with side-view rockets.

## M0 output boundaries

The three SVG scenes are illustrative presentation snapshots, not simulated flight. Exhaust, velocity vectors and orbit curves in these previews establish visual hierarchy only. The actual flight renderer will consume simulation state in later milestones. No preview should be represented as a validated orbit or live telemetry.

Part geometry, attachment coordinates and assembly placements are read from the shared part catalogue. The renderer may add visual surface detail within those bounds but may not invent alternative component dimensions. Each scene uses a viewBox, an accessible title and a mission-scene class. Part groups carry data-part-id for UI selection.

## Asset and coordinate rules

Part definitions supply physical width and height, local connector positions, and instance poses. Render local geometry inside those measured bounds. Keep sunlight, exhaust plumes, selection rings and node handles in separate visual layers; they do not enlarge the physical body. Engine exhaust begins at the declared outlet where available. Use the same part drawing function and assembly graph in assembly and flight.

SVG gradients, patterns and clipping paths need scene-specific IDs. Never embed external artwork or fonts. Keep artwork deterministic, scalable and usable without raster downloads. Escape labels and IDs inserted into markup.

## Interaction and feel targets

Assembly should feel deliberate: a clear ghost, compatible-node indication, one restrained snap acknowledgement, immediate summary updates, and reliable undo. Invalid drops explain the specific mismatch. Selection must not obscure the part beneath it.

Flight should feel responsive and weighty through bounded steering, smooth camera following and throttle-related exhaust and audio. Camera movement and visual effects never change physics. Engine cut-off must be visibly and audibly clear. Optional launch shake is brief, small and disabled by reduced-motion preferences.

The primary flight HUD prioritises altitude, speed, propellant and throttle. Advanced engineering values belong in an expandable panel. Show craft attitude and velocity as different indicators. In orbit, prioritise the coast path, prediction assumptions and apsides; avoid paths that disappear behind labels.

## Review gates

1. Inspect assembly, flight and orbit at desktop and landscape-tablet sizes, plus zoomed views of connector seams.
2. Verify that the sample craft has identical proportions, positions and attachment geometry in assembly and flight.
3. Verify readable silhouettes on both blueprint and space backgrounds; no clipping or accidental part overlap.
4. Check selection, focus, node labels and warnings without relying on colour.
5. Compare empty and selected states. Selected outlines should be clear without swallowing thin solar-cell geometry.
6. Record drag/snap, launch, steering, coast and map transitions when implemented. Static screenshots cannot establish game feel.
7. Measure responsive input and rendering on the declared reference device before increasing particle density or background effects.


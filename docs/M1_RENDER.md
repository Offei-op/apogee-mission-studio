# M1 renderer contract

## Assembly coordinates

The assembly SVG always uses `viewBox="0 0 600 620"`. `assemblyCamera(parts, zoom)` returns the world-space geometric bounds centre in metres, `pixelsPerM`, and the viewBox. World axes are x-right, y-up; SVG axes are x-right, y-down.

Convert a browser pointer to SVG coordinates with the root SVG's `getScreenCTM().inverse()`, then call `assemblyPointFromSvg(point, parts, zoom)`. The inverse mapping is `x = (svg.x - 300) / pixelsPerM + centreX` and `y = centreY - (svg.y - 310) / pixelsPerM`.

Keep the assembly camera inputs fixed during a drag. Show the candidate through `ghost` and `ghostValid`, then commit the graph mutation at drop. Fitting a camera to an actively moving part causes the coordinate conversion to move under the pointer. Ghosts are excluded from fit, cannot receive pointer events, and display an explicit valid/invalid marker.

Part groups carry exact `data-part-id` instance identifiers. Visible connector circles also carry their `data-node-id` and part instance ID. The same geometry and artwork draw every tank instance and all rotations; dimensions are never duplicated in the renderer.

## Flight

Supplying `state` makes flight rendering depend on `FlightState`, rather than the M0 illustrative fixture. The local up direction is the radial direction from Earth. Attitude is shown relative to this up frame; the velocity arrow uses actual inertial velocity projected into the local frame. Near the ground, height advances against the local surface; the launch-pad marker remains tied to the launch longitude. Sky brightness fades with altitude. Exhaust is present only when actual thrust is positive and the vehicle has not crashed.

The renderer's camera is visual only. It neither modifies dynamics nor integrates a second trajectory. The state position is represented by the craft's body reference point; all component poses remain assembly-local.

## Orbit

The map draws Earth at its physical radius, the current position, and points from the shared `predictCoast` function. It fits Earth, the vehicle and the bounded coast forecast into the viewport. Prediction assumes no further thrust. There is no decorative finite-burn ellipse in live mode. Surface interception is marked when the coast endpoint reaches the surface. Apsis labels are shown only for available bound-orbit values without an imminent surface interception.

M0 fallback scenes remain available only when no flight state is supplied, for component previews. The M1 UI should always supply the active state to flight and orbit.

## Checks

- Invert the camera for several translated/rotated assemblies and zoom levels; centre conversion must recover the world bounds centre.
- Compare rendered connector centres against the shared world-node geometry.
- Add a second tank and verify both instances, exact IDs, and fit bounds.
- Compare flight scenes at pad, ascent and vacuum states; change angle while keeping velocity fixed and verify that only attitude turns.
- At zero thrust, verify no plume even if requested throttle remains nonzero.
- Verify all forecast points are from core orbit code, and surface-impact paths are not depicted as safe closed orbits.

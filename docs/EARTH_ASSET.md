# Earth artwork

## Source and credit

The game uses NASA's Blue Marble world mosaic, sourced from the official [NASA Scientific Visualization Studio entry 2915](https://svs.gsfc.nasa.gov/2915).

Credit: NASA/Goddard Space Flight Center Scientific Visualization Studio. Blue Marble data courtesy of Reto Stockli NASA/GSFC and NASA's Earth Observatory.

Downloaded source: https://svs.gsfc.nasa.gov/vis/a000000/a002900/a002915/bluemarble-2048.png (2048 × 1024, approximately 1.4 MB).

The equirectangular source is projected onto an orthographic sphere centred at 20° E, 15° N by `scripts/project-earth.py`, with bilinear sampling and subtle limb shading. This avoids pasting a flat map into a circle. The 1024 × 1024 JPEG derivative is at `public/assets/earth-blue-marble.jpg`, served as `/assets/earth-blue-marble.jpg`. The source is retained under `artifacts/m2/earth-texture-source.png`; Python/Pillow/numpy are development utilities only. The game makes no third-party network requests at runtime.

## Interpretation

This is a natural-colour satellite surface composite with ocean, land and ice detail, not a contemporaneous photograph of the simulated mission. A shared SVG function clips it into the physical Earth disc and adds a restrained atmospheric rim and a visual night-side shade. Dynamic clouds are not modelled.

Navigation remains strictly two-dimensional. The image is an illustrative body texture; continents and cloud patterns are not georeferenced to the game's equatorial mission target markers. Those markers are positioned from the actual simulation clock and surface coordinates. Texture rotation supplies visual motion only and never changes contact geometry, lighting rules, drag, orbit or spacecraft state.

In the close flight view, the distant Earth limb is an illustrative backdrop scaled for readability; nearby surface height is tied to the local flight altitude. The orbital map uses the actual Earth radius and a single scale for Earth, spacecraft and trajectory.

## Zoom contract

Assembly, flight and orbit accept zoom from 0.2 to 8. Assembly camera conversion remains deterministic. Flight zoom adjusts the camera scale around the craft. Orbital Fit at zoom 1 centres Earth and fits the bounded coast path. Increasing map zoom from 1 to 2 smoothly moves focus to the current spacecraft; at zoom 2 and above the craft stays centred while Earth may naturally extend beyond the viewport.

The orbital coast line is shared physics output and assumes no further thrust, with drag excluded. Mission markers show the science target and ground station; an active station contact draws a dashed line to the spacecraft. SVG title elements provide hover information on Earth and markers.

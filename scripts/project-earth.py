"""Project NASA's equirectangular Blue Marble into an illustrative orthographic globe.

Development utility: requires Pillow and numpy. No Python dependency at runtime.
Usage: python scripts/project-earth.py input.png public/assets/earth-blue-marble.jpg
"""
import sys
import numpy as np
from PIL import Image

source = np.asarray(Image.open(sys.argv[1]).convert('RGB'))
size = 1024
axis = (np.arange(size) + .5) / size * 2 - 1
x, y = np.meshgrid(axis, -axis)
r2 = x*x + y*y
z = np.sqrt(np.maximum(0, 1-r2))
latitude0, longitude0 = np.deg2rad([15, 20])
latitude = np.arcsin(np.clip(y*np.cos(latitude0) + z*np.sin(latitude0), -1, 1))
longitude = longitude0 + np.arctan2(x, z*np.cos(latitude0)-y*np.sin(latitude0))
u = ((longitude + np.pi) / (2*np.pi) * source.shape[1]) % source.shape[1]
v = np.clip((np.pi/2-latitude) / np.pi * source.shape[0], 0, source.shape[0]-1)
# Bilinear sampling avoids jagged coastlines and seams.
u0, v0 = u.astype(int), v.astype(int)
u1, v1 = (u0+1) % source.shape[1], np.minimum(v0+1, source.shape[0]-1)
a, b = (u-u0)[..., None], (v-v0)[..., None]
pixels = ((1-a)*(1-b)*source[v0,u0] + a*(1-b)*source[v0,u1]
          + (1-a)*b*source[v1,u0] + a*b*source[v1,u1])
pixels *= (.80+.20*z)[...,None]
pixels[r2>1] = 0
Image.fromarray(np.uint8(np.clip(pixels,0,255))).save(sys.argv[2], quality=93, optimize=True)

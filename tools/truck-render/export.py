"""Turns the PNGs rendered by build.html (tools/truck-render/out/final/**) into the AVIF files the site loads,
all inside public/assets/parcel-story/:

    2-truck-side/   01-truck-complete (the side view), 02-wheel-front, 03-wheel-rear
    3-truck-flip/   000..044          (the side -> overhead flip)
    4-truck-top/    01-truck-top      (the truck from above)
    5-mobile/       truck-top         (the vertical truck on phones)

    python3 tools/truck-render/export.py
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(HERE, 'out', 'final')
STORY = os.path.join(ROOT, 'public', 'assets', 'parcel-story')


def save(im, dst, q=80):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.convert('RGBA').save(dst, format='AVIF', quality=q, speed=6)


jobs = [
    (f'{SRC}/side/plate.png', f'{STORY}/2-truck-side/01-truck-complete.avif'),
    (f'{SRC}/side/wheel-front.png', f'{STORY}/2-truck-side/02-wheel-front.avif'),
    (f'{SRC}/side/wheel-rear.png', f'{STORY}/2-truck-side/03-wheel-rear.avif'),
    (f'{SRC}/top/top.png', f'{STORY}/4-truck-top/01-truck-top.avif'),
]
for k in range(45):
    jobs.append((f'{SRC}/flip/{k:03d}.png', f'{STORY}/3-truck-flip/{k:03d}.avif'))
for s, d in jobs:
    save(Image.open(s), d)
print(len(jobs), 'files written')

# mobile: the truck from above, front pointing down, in the same 154x643 box as before but at 2x.
# The overhead render is 660 px per metre (2x the flip frame); on the phone it is 131 px per metre (2x).
k = 2
CW, CH = 154 * k, 643 * k
scale = 131 / 660
crop = (2330, 160, 5140, 1460)          # the whole truck, mirrors included


def mobile(src, dst):
    im = Image.open(src).convert('RGBA').crop(crop)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS).rotate(-90, expand=True)
    canvas = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((CW - im.width) // 2, CH - im.height))
    save(canvas, dst, 80)


mobile(f'{SRC}/top/top.png', f'{STORY}/5-mobile/truck-top.avif')
print('mobile truck written')

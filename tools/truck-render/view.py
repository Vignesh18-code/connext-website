import sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
bg = tuple(int(x) for x in (sys.argv[3] if len(sys.argv)>3 else '200,205,200').split(','))
maxw = int(sys.argv[4]) if len(sys.argv)>4 else 1600
im = Image.open(src).convert('RGBA')
b = Image.new('RGBA', im.size, bg+(255,)); b.alpha_composite(im)
if b.width > maxw: b = b.resize((maxw, int(b.height*maxw/b.width)), Image.LANCZOS)
b.convert('RGB').save(dst); print(im.size, im.getchannel('A').getbbox())

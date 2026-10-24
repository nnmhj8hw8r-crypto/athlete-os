# Разметка мышц на рисунках public/anatomy (v0.10): водораздел (watershed) от опорных точек seeds.json по границам мышц.
# Запуск: python scripts/anatomy/seg.py public/anatomy public/anatomy/labels  (нужны pillow, numpy, scipy, scikit-image).
# В PNG: номер мышцы × 15 (порядок MUSCLES), 0 — не мышца, 250 — кромка фона, 255 — фон.
import json, sys, os
import numpy as np
from PIL import Image
from skimage.segmentation import watershed
from skimage.filters import sobel
from skimage.color import rgb2hsv
from skimage.morphology import disk, binary_opening, remove_small_objects
from scipy import ndimage as ndi

MUSCLES = ['chest','delts','biceps','triceps','forearms','abs','obliques','quads','adductors','calves','traps','lats','rearDelts','lowerBack','glutes','hamstrings']
seeds = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'seeds.json')))
src_dir, out_dir = sys.argv[1], sys.argv[2]
os.makedirs(out_dir, exist_ok=True)
FORCE = {  # бледная фасция поясницы — тоже «поясница»
  'male-back': {'lowerBack': (39, 30, 61, 42)},
  'female-back': {'lowerBack': (39, 31, 61, 44)},
}
CLIP = {  # где мышца может быть (в % рисунка) — чтобы заливка не «утекала» на соседние области
  'male-front': {'obliques': (28, 26, 72, 43), 'quads': (20, 39.5, 80, 67), 'chest': (24.5, 18, 75.5, 31), 'traps': (28, 14, 72, 21), 'adductors': (36, 44, 64, 62)},
  'male-back': {'lowerBack': (40.5, 29, 59.5, 41.5), 'calves': (20, 62, 80, 88), 'glutes': (22, 39, 78, 52)},
  'female-front': {'obliques': (28, 27, 72, 46), 'quads': (20, 41, 80, 70), 'chest': (26, 18, 74, 31), 'traps': (28, 14, 72, 21), 'adductors': (41, 47, 59, 62)},
  'female-back': {'traps': (15, 13, 85, 40), 'lowerBack': (38, 30, 62, 43), 'calves': (18, 66, 82, 90), 'glutes': (18, 39, 82, 54)},
}
for view, conf in seeds.items():
    im = np.asarray(Image.open(f'{src_dir}/{view}.jpg').convert('RGB')).astype(float) / 255
    H, W, _ = im.shape
    hsv = rgb2hsv(im)
    sat, val = hsv[..., 1], hsv[..., 2]
    gray = im.mean(axis=2)
    muscle = (sat > 0.28) & (val > 0.25)
    muscle = ndi.binary_fill_holes(binary_opening(muscle, disk(1))) & (sat > 0.2)
    labels_ids = {m: i + 1 for i, m in enumerate(MUSCLES)}
    labels_ids['other'] = 99
    markers = np.zeros((H, W), dtype=np.int32)
    yy, xx = np.mgrid[0:H, 0:W]
    for m, pts in conf.items():
        for (px, py) in pts:
            for x in (px, 100 - px):
                cx, cy = x * W / 100, py * H / 100
                markers[((xx - cx) ** 2 + (yy - cy) ** 2 <= 9) & muscle] = labels_ids[m]
    mask = muscle.copy()
    for m, (x0, y0, x1, y1) in FORCE.get(view, {}).items():
        r = (((xx - (x0 + x1) * W / 200) / ((x1 - x0) * W / 200)) ** 2 + ((yy - (y0 + y1) * H / 200) / ((y1 - y0) * H / 200)) ** 2 <= 1) & (val < 0.985)
        mask |= r
    elev = sobel(ndi.gaussian_filter(gray, 0.8))
    lab = watershed(elev, markers, mask=mask)
    def clip(lab):
        for m, (x0, y0, x1, y1) in CLIP.get(view, {}).items():
            r = (xx >= x0 * W / 100) & (xx <= x1 * W / 100) & (yy >= y0 * H / 100) & (yy <= y1 * H / 100)
            lab[(lab == labels_ids[m]) & ~r] = 0
        return lab
    before = lab.copy()
    lab = clip(lab)
    # то, что отрезали ограничением, отдаём соседним мышцам (кроме «прочего»)
    cleared = (lab == 0) & (before > 0) & (before != 99)
    for _ in range(2):
        lab = watershed(elev, lab, mask=(lab > 0) | cleared)
        lab = clip(lab)
    lab[lab == 99] = 0
    for m, (x0, y0, x1, y1) in FORCE.get(view, {}).items():
        r = (((xx - (x0 + x1) * W / 200) / ((x1 - x0) * W / 200)) ** 2 + ((yy - (y0 + y1) * H / 200) / ((y1 - y0) * H / 200)) ** 2 <= 1) & (val < 0.985) & ~muscle
        lab[r] = labels_ids[m]
    # убрать мелкие островки
    out = np.zeros_like(lab)
    for i in range(1, len(MUSCLES) + 1):
        b = remove_small_objects(lab == i, 40)
        out[b] = i
    # фон: светлые малонасыщенные пиксели, связанные с краем рисунка → 255 (прозрачный), кромка → 250 (полупрозрачная)
    cand = (val > 0.84) & (sat < 0.14)
    comp, n = ndi.label(cand)
    border = set(np.unique(np.concatenate([comp[0], comp[-1], comp[:, 0], comp[:, -1]]))) - {0}
    bg = np.isin(comp, list(border))
    edge = ndi.binary_dilation(~bg) & bg
    enc = (out * 15).astype(np.uint8)
    enc[bg] = 255
    enc[edge] = 250
    Image.fromarray(enc, 'L').save(f'{out_dir}/{view}.png', optimize=True)
    # превью
    rng = np.random.RandomState(3)
    pal = rng.randint(40, 255, (len(MUSCLES) + 1, 3)); pal[0] = 0
    prev = (im * 255).astype(np.uint8).copy()
    col = pal[out]
    sel = out > 0
    prev[sel] = (prev[sel] * 0.35 + col[sel] * 0.65).astype(np.uint8)
    from PIL import ImageDraw
    pim = Image.fromarray(prev).resize((W * 2, H * 2)); d = ImageDraw.Draw(pim)
    for i, m in enumerate(MUSCLES):
        lab_i, n = ndi.label(out == i + 1)
        for k in range(1, n + 1):
            ys, xs = np.nonzero(lab_i == k)
            if len(xs) < 150: continue
            d.text((xs.mean() * 2 - 12, ys.mean() * 2 - 5), m[:6], fill=(0, 0, 0))
    if os.environ.get('PREVIEW'): pim.save(f'{view}-prev.png')
    print(view, {m: int((out == i + 1).sum()) for i, m in enumerate(MUSCLES)})

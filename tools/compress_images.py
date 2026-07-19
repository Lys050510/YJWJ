"""图片压缩工具：PNG → WebP，大幅减小体积。"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')

# 卡片背景图 → 最长边 800px，WebP 质量 85%
CARD_DIRS = ['', 'heroes', 'weapons', 'players']
CARD_MAX = 800
QUALITY_CARD = 85

# 全屏背景 → 最大宽 1920px
BG_MAX_WIDTH = 1920
QUALITY_BG = 85

# 英雄/武器小图 → 不改尺寸，仅转 WebP
QUALITY_ICON = 90

results = []

def convert(filepath, max_size=None, quality=85):
    """将 PNG/JPEG 转为 WebP，可选缩放。返回 (原大小, 新大小, 路径)"""
    name = os.path.basename(filepath)
    dirname = os.path.dirname(filepath)
    base, _ = os.path.splitext(name)
    out = os.path.join(dirname, base + '.webp')

    im = Image.open(filepath)
    orig_w, orig_h = im.size
    orig_size = os.path.getsize(filepath)

    # 确保 RGBA → RGBA，其他 → RGB
    if im.mode in ('RGBA', 'P', 'PA'):
        im = im.convert('RGBA')
    else:
        im = im.convert('RGB')

    # 缩放
    if max_size:
        w, h = im.size
        longest = max(w, h)
        if longest > max_size:
            ratio = max_size / longest
            new_w = int(w * ratio)
            new_h = int(h * ratio)
            im = im.resize((new_w, new_h), Image.LANCZOS)

    # 保存 WebP
    save_kwargs = {'quality': quality, 'method': 6}
    if im.mode == 'RGBA':
        save_kwargs['lossless'] = False
    im.save(out, 'webp', **save_kwargs)

    new_size = os.path.getsize(out)
    pct = (1 - new_size / orig_size) * 100 if orig_size else 0
    return orig_size, new_size, out, im.size, orig_w, orig_h

# ─── 1. 卡片背景图（大图，缩放） ───
card_files = [
    'card-bg.png', 'card-bg1.png', 'card-bg2.png', 'card-bg3.png',
    'card_bg.png', 'card_bg1.png'
]
for f in card_files:
    fp = os.path.join(ASSETS, f)
    if os.path.exists(fp):
        orig, new, out, new_dim, old_w, old_h = convert(fp, max_size=CARD_MAX, quality=QUALITY_CARD)
        results.append((f, orig, new, old_w, old_h, new_dim[0], new_dim[1]))
        print(f'  {f}: {orig/1024:.0f}KB → {new/1024:.0f}KB ({old_w}x{old_h} → {new_dim[0]}x{new_dim[1]})')

# ─── 2. 全屏背景 ───
bg_file = os.path.join(ASSETS, 'bg.png')
if os.path.exists(bg_file):
    orig, new, out, new_dim, old_w, old_h = convert(bg_file, max_size=BG_MAX_WIDTH, quality=QUALITY_BG)
    results.append(('bg.png', orig, new, old_w, old_h, new_dim[0], new_dim[1]))
    print(f'  bg.png: {orig/1024:.0f}KB → {new/1024:.0f}KB ({old_w}x{old_h} → {new_dim[0]}x{new_dim[1]})')

# ─── 3. 英雄/武器/人员小图（不缩放，仅转格式） ───
for subdir in ['heroes', 'weapons', 'players']:
    subpath = os.path.join(ASSETS, subdir)
    if not os.path.exists(subpath):
        continue
    for f in sorted(os.listdir(subpath)):
        fp = os.path.join(subpath, f)
        if not os.path.isfile(fp):
            continue
        ext = os.path.splitext(f)[1].lower()
        if ext in ('.png', '.jpg', '.jpeg'):
            orig, new, out, new_dim, old_w, old_h = convert(fp, max_size=None, quality=QUALITY_ICON)
            results.append((f'{subdir}/{f}', orig, new, old_w, old_h, new_dim[0], new_dim[1]))
            print(f'  {subdir}/{f}: {orig/1024:.0f}KB → {new/1024:.0f}KB')

# ─── 汇总 ───
total_orig = sum(r[1] for r in results)
total_new = sum(r[2] for r in results)
print(f'\n{"="*60}')
print(f'总计: {total_orig/1024/1024:.1f} MB → {total_new/1024/1024:.1f} MB (节省 {(1-total_new/total_orig)*100:.0f}%)')
print(f'文件数: {len(results)}')

"""
一次性脚本：处理 god.png → god.webp
复用 process_box_icons.py 的 trim_dark_border + process_item_icon 逻辑
"""
import os
from PIL import Image, ImageFilter

# 配置常量（与 process_box_icons.py 一致）
ICON_SIZE = 128
ICON_PADDING = 4
DARK_THRESHOLD = 25
SHARPEN_RADIUS = 0.5
SHARPEN_AMOUNT = 80
WEBP_QUALITY_ICON = 90

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT = os.path.join(ROOT, 'assets', 'box', 'god.png')
OUTPUT = os.path.join(ROOT, 'assets', 'box', 'god.webp')


def trim_dark_border(im):
    """检测并裁切四边暗色像素"""
    w, h = im.size
    pixels = im.load()

    # 左边界
    left = 0
    for x in range(w):
        has_light = False
        for y in range(h):
            r, g, b = pixels[x, y][:3]
            if r > DARK_THRESHOLD or g > DARK_THRESHOLD or b > DARK_THRESHOLD:
                has_light = True
                break
        if has_light:
            left = x
            break

    # 右边界
    right = w - 1
    for x in range(w - 1, -1, -1):
        has_light = False
        for y in range(h):
            r, g, b = pixels[x, y][:3]
            if r > DARK_THRESHOLD or g > DARK_THRESHOLD or b > DARK_THRESHOLD:
                has_light = True
                break
        if has_light:
            right = x
            break

    # 上边界
    top = 0
    for y in range(h):
        has_light = False
        for x in range(w):
            r, g, b = pixels[x, y][:3]
            if r > DARK_THRESHOLD or g > DARK_THRESHOLD or b > DARK_THRESHOLD:
                has_light = True
                break
        if has_light:
            top = y
            break

    # 下边界
    bottom = h - 1
    for y in range(h - 1, -1, -1):
        has_light = False
        for x in range(w):
            r, g, b = pixels[x, y][:3]
            if r > DARK_THRESHOLD or g > DARK_THRESHOLD or b > DARK_THRESHOLD:
                has_light = True
                break
        if has_light:
            bottom = y
            break

    if left >= right or top >= bottom:
        return im

    return im.crop((left, top, right + 1, bottom + 1))


def process_item_icon(im):
    """裁黑边 → 缩放到128×128居中 → 锐化 → 返回处理后的 Image"""
    print(f"  Original size: {im.size}")

    # 1.
    im = trim_dark_border(im)
    print(f"  After crop: {im.size}")

    # 2. 缩放到画布内（留 padding）
    canvas_w = ICON_SIZE - ICON_PADDING * 2
    canvas_h = ICON_SIZE - ICON_PADDING * 2
    cw, ch = im.size

    ratio = min(canvas_w / cw, canvas_h / ch)
    new_w = max(1, int(cw * ratio))
    new_h = max(1, int(ch * ratio))
    im = im.resize((new_w, new_h), Image.LANCZOS)

    # 3. 居中放到透明画布
    canvas = Image.new('RGBA', (ICON_SIZE, ICON_SIZE), (0, 0, 0, 0))
    offset_x = (ICON_SIZE - new_w) // 2
    offset_y = (ICON_SIZE - new_h) // 2
    canvas.paste(im, (offset_x, offset_y), im if im.mode == 'RGBA' else None)

    # 4. 锐化
    canvas = canvas.filter(ImageFilter.UnsharpMask(
        radius=SHARPEN_RADIUS, percent=SHARPEN_AMOUNT
    ))

    return canvas


def main():
    if not os.path.exists(INPUT):
        print(f"ERROR: {INPUT} not found")
        return

    print(f"Processing god.png -> god.webp")
    im = Image.open(INPUT)
    if im.mode not in ('RGBA', 'RGB'):
        im = im.convert('RGBA')

    result = process_item_icon(im)
    result.save(OUTPUT, 'webp', quality=WEBP_QUALITY_ICON, method=6)

    in_size = os.path.getsize(INPUT)
    out_size = os.path.getsize(OUTPUT)
    print(f"DONE!")
    print(f"  Input:  {in_size/1024:.0f} KB ({im.size[0]}x{im.size[1]})")
    print(f"  Output: {out_size/1024:.1f} KB (128x128)")


if __name__ == '__main__':
    main()

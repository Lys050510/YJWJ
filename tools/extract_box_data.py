"""提取所有 assets/box/*/箱子概况.xlsx 数据，输出结构化 JSON"""
import openpyxl, os, json, re

BASE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'box')
OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'box_data_all.json')

QUALITY_MAP = {
    '红': 'red', '金': 'gold', '橙': 'orange', '紫': 'purple', '蓝': 'blue',
}

def parse_footer(text):
    """解析保底规则文本为结构化数据"""
    result = {
        'probabilities': {},
        'pity': {
            'cycle': None,
            'special': None,
            'extraGoldPity': None,
            'noRepeatRed': False,
            'wishEnabled': False,
            'wishDescription': '',
            'hasDualPity': False,
            'notes': '',
        }
    }

    # 提取概率
    prob_patterns = [
        (r'红色[（(]神品[）)]\s*[：:]\s*(\d+\.?\d*)\s*%', 'red'),
        (r'金色[（(]极品[）)]\s*[：:]\s*(\d+\.?\d*)\s*%', 'gold'),
        (r'橙色[（(][^)）]*[）)]\s*[：:]\s*(\d+\.?\d*)\s*%', 'orange'),
        (r'紫色[（(]优品[）)]\s*[：:]\s*(\d+\.?\d*)\s*%', 'purple'),
        (r'蓝色[（(]良品[）)]\s*[：:]\s*(\d+\.?\d*)\s*%', 'blue'),
    ]
    for pattern, key in prob_patterns:
        m = re.search(pattern, text)
        if m:
            result['probabilities'][key] = float(m.group(1)) / 100

    # 检测保底类型
    has_cycle = '循环保底' in text
    has_special = '特殊保底' in text
    has_purple_pity = '每开启至多10次' in text or '每开启至多10' in text
    has_extreme = '极品外观保底' in text or '极品外观' in text and '25' in text
    has_wish = '心愿' in text
    no_repeat = '不会重复获得' in text or '不会重复' in text

    result['pity']['noRepeatRed'] = no_repeat
    result['pity']['wishEnabled'] = has_wish
    result['pity']['hasDualPity'] = has_special

    # 循环保底
    if has_cycle:
        cycle_count_100 = '每开启至多100次' in text
        cycle_count_10 = '每开启至多10次' in text or '每开启至多10' in text
        if cycle_count_100:
            result['pity']['cycle'] = {'targetQuality': 'red', 'count': 100, 'repeatable': True}
        elif cycle_count_10:
            result['pity']['cycle'] = {'targetQuality': 'purple', 'count': 10, 'repeatable': True}
        else:
            # 尝试提取数字
            m = re.search(r'每开启至多(\d+)次', text)
            if m:
                count = int(m.group(1))
                target = 'red' if count >= 100 else 'purple'
                result['pity']['cycle'] = {'targetQuality': target, 'count': count, 'repeatable': True}

    # 特殊保底
    if has_special:
        m = re.search(r'前(\d+)次开启.*至少.*(红|金|紫)', text)
        if m:
            count = int(m.group(1))
            quality_map = {'红': 'red', '金': 'gold', '紫': 'purple'}
            target = quality_map.get(m.group(2), 'red')
            result['pity']['special'] = {'targetQuality': target, 'count': count, 'repeatable': False, 'priorityOverCycle': True}

    # 极品外观保底
    if has_extreme:
        m_count = re.search(r'(\d+)次以内', text)
        m_max = re.search(r'触发(\d+)次', text)
        count = int(m_count.group(1)) if m_count else 25
        max_triggers = int(m_max.group(1)) if m_max else 14
        result['pity']['extraGoldPity'] = {'count': count, 'maxTriggers': max_triggers}

    if has_wish:
        result['pity']['wishDescription'] = '每次抽中神品外观，获得1次指定极品外观的机会'

    # 补充说明
    notes_match = re.search(r'补充说明[：:]\s*(.+?)(?:\n|$)', text)
    if notes_match:
        result['pity']['notes'] = notes_match.group(1).strip()

    return result


def main():
    dirs = sorted([d for d in os.listdir(BASE) if os.path.isdir(os.path.join(BASE, d))])

    all_boxes = []
    skipped = []

    for dirname in dirs:
        xlsx_path = os.path.join(BASE, dirname, '箱子概况.xlsx')
        if not os.path.exists(xlsx_path):
            skipped.append(dirname)
            print(f'SKIP {dirname}: no xlsx found')
            continue

        wb = openpyxl.load_workbook(xlsx_path)
        ws = wb.active
        rows = []
        for row in ws.iter_rows(values_only=True):
            rows.append([str(c) if c is not None else '' for c in row])

        if len(rows) < 3:
            skipped.append(dirname)
            print(f'SKIP {dirname}: too few rows ({len(rows)})')
            continue

        # Row 0: box name and cover image
        box_name = rows[0][0]
        cover_image = rows[0][2] if rows[0][2] else f'{dirname}.png'
        cover_path = f'assets/box/{dirname}/{cover_image}'

        # Rows 2 to N-1: items
        items = []
        for row in rows[2:-1]:
            name = row[0].strip()
            quality_cn = row[1].strip() if row[1] else ''
            image = row[2].strip() if row[2] else ''

            if not name or not quality_cn:
                continue  # skip empty/malformed rows

            quality = QUALITY_MAP.get(quality_cn, quality_cn)
            img_path = f'assets/box/{dirname}/{image}' if image else ''

            items.append({
                'name': name,
                'quality': quality,
                'qualityCN': quality_cn,
                'image': img_path,
            })

        # Last row: footer text
        footer_text = rows[-1][0] if rows[-1][0] else ''

        # Parse footer for structured pity data
        pity_data = parse_footer(footer_text)

        # Determine box type
        is_spring = dirname.startswith('xinchun')
        box_type = 'spring_festival' if is_spring else 'regular'

        box = {
            'id': dirname,
            'name': box_name,
            'type': box_type,
            'image': cover_path,
            'items': items,
            'probabilities': pity_data['probabilities'],
            'pity': pity_data['pity'],
            'footerRaw': footer_text,
        }

        all_boxes.append(box)
        print(f'OK {dirname}: {box_name} | {len(items)} items | type={box_type} | probs={pity_data["probabilities"]}')

    # Output
    with open(OUTPUT, 'w', encoding='utf-8') as f:
        json.dump({'boxes': all_boxes, 'skipped': skipped}, f, ensure_ascii=False, indent=2)

    print(f'\nDone! {len(all_boxes)} boxes written to {OUTPUT}')
    if skipped:
        print(f'Skipped: {skipped}')


if __name__ == '__main__':
    main()

# Собирает офлайн-базу российских товаров из полной выгрузки Open Food Facts.
#
# Лицензия данных: Open Database License (ODbL) 1.0, содержимое — Database Contents License 1.0.
# Источник: https://world.openfoodfacts.org/data  (en.openfoodfacts.org.products.csv.gz)
# Производная база распространяется на тех же условиях ODbL; атрибуция — в public/data/off-ru.LICENSE.txt.
#
# Запуск: python scripts/build-off-russia.py <products.csv.gz> public/data/off-ru.json
#
# В файл попадают только товары с отметкой «Россия» (countries_tags содержит en:russia), со штрихкодом
# EAN/UPC и полным КБЖУ на 100 г/мл. Неполные карточки отбрасываются: ноль вместо «нет данных» не пишем.
import csv, gzip, json, re, sys

SRC, OUT = sys.argv[1], sys.argv[2]
csv.field_size_limit(10**9)

# Колонка OFF -> (поле приложения, множитель к единицам приложения: г / мг / мкг)
EXTRA = {
    'sugars_100g': ('sugars', 1), 'added-sugars_100g': ('addedSugars', 1), 'fiber_100g': ('fiber', 1),
    'saturated-fat_100g': ('satFat', 1), 'monounsaturated-fat_100g': ('monoFat', 1),
    'polyunsaturated-fat_100g': ('polyFat', 1), 'trans-fat_100g': ('transFat', 1), 'omega-3-fat_100g': ('omega3', 1),
    'cholesterol_100g': ('cholesterol', 1000), 'sodium_100g': ('sodium', 1000), 'potassium_100g': ('potassium', 1000),
    'calcium_100g': ('calcium', 1000), 'iron_100g': ('iron', 1000), 'magnesium_100g': ('magnesium', 1000),
    'vitamin-d_100g': ('vitD', 1_000_000),
}
# Верхние границы правдоподобия (на 100 г) в единицах приложения — отсекают опечатки участников.
LIMITS = {'sugars': 100, 'addedSugars': 100, 'fiber': 100, 'satFat': 100, 'monoFat': 100, 'polyFat': 100,
          'transFat': 100, 'omega3': 100, 'cholesterol': 5000, 'sodium': 40000, 'potassium': 10000,
          'calcium': 10000, 'iron': 500, 'magnesium': 5000, 'vitD': 1000}

ML = re.compile(r'\d\s*(ml|мл|cl|l|л)(?![a-zа-яё])', re.I)


def num(v):
    if v is None or v == '':
        return None
    try:
        x = float(v)
    except ValueError:
        return None
    return x if x == x and x >= 0 else None


def r(x):
    return round(x, 1) if x >= 1 else round(x, 3)


stats = {'rows': 0, 'russia': 0, 'kept': 0, 'no_name': 0, 'no_barcode': 0, 'incomplete': 0, 'implausible': 0}
out, seen = [], set()
with gzip.open(SRC, 'rt', encoding='utf-8', errors='replace', newline='') as f:
    reader = csv.reader(f, delimiter='\t', quoting=csv.QUOTE_NONE)
    header = next(reader)
    col = {h: i for i, h in enumerate(header)}
    brand_col = next((col[h] for h in ('brands', 'brands_en', 'brand_owner') if h in col), None)

    def get(row, name):
        i = col.get(name)
        return row[i] if i is not None and i < len(row) else ''

    for row in reader:
        stats['rows'] += 1
        if 'en:russia' not in get(row, 'countries_tags'):
            continue
        stats['russia'] += 1
        code = get(row, 'code').strip()
        if not re.fullmatch(r'\d{8,14}', code) or code in seen:
            stats['no_barcode'] += 1
            continue
        name = re.sub(r'\s+', ' ', get(row, 'product_name')).strip()
        if not name:
            stats['no_name'] += 1
            continue
        kcal = num(get(row, 'energy-kcal_100g'))
        if kcal is None:
            kj = num(get(row, 'energy-kj_100g'))
            kcal = kj / 4.184 if kj is not None else None
        p, fat, c = (num(get(row, k)) for k in ('proteins_100g', 'fat_100g', 'carbohydrates_100g'))
        if None in (kcal, p, fat, c):
            stats['incomplete'] += 1
            continue
        basis = 1 if ML.search(get(row, 'quantity')) else 0
        if kcal > 950 or p > 100 or fat > 100 or c > 100 or (basis == 0 and p + fat + c > 100.5):
            stats['implausible'] += 1
            continue
        extra = {}
        for column, (key, mult) in EXTRA.items():
            v = num(get(row, column))
            if v is not None:
                v *= mult
                if v <= LIMITS[key]:
                    extra[key] = r(v)
        brand = ''
        if brand_col is not None and brand_col < len(row):
            brand = row[brand_col].split(',')[0].strip()
        seen.add(code)
        out.append([code, name[:160], brand[:80], basis, r(kcal), r(p), r(fat), r(c), extra or 0])
        stats['kept'] += 1

out.sort(key=lambda x: x[1].lower())
import datetime
payload = {
    'generated': datetime.date.today().isoformat(),
    'stats': stats,
    'source': 'Open Food Facts — https://world.openfoodfacts.org',
    'license': 'ODbL 1.0 (база), DbCL 1.0 (содержимое)',
    'fields': ['code', 'name', 'brand', 'basis(0=g,1=ml)', 'kcal', 'protein', 'fat', 'carbs', 'extra'],
    'products': out,
}
with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
    json.dump(payload, f, ensure_ascii=False, separators=(',', ':'))
print(json.dumps(stats, ensure_ascii=False))

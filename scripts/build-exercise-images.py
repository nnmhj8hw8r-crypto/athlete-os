"""Скачивает иллюстрации упражнений Everkinetic (CC BY-SA 4.0) в public/exercises/.

Соответствие «слаг упражнения → номер рисунка» берётся из src/domain/exerciseImages.ts.
Запуск из корня проекта:  python scripts/build-exercise-images.py
Рисунки лежат в репозитории, поэтому запускать нужно только после изменения списка.
"""
import pathlib
import re
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
MAP_FILE = ROOT / 'src' / 'domain' / 'exerciseImages.ts'
OUT = ROOT / 'public' / 'exercises'
BASE = 'https://raw.githubusercontent.com/everkinetic/data/main/dist/svg/{id}-{pose}.svg'

LICENSE = """Иллюстрации упражнений в этой папке — из открытого набора Everkinetic
https://github.com/everkinetic/data (оригинал: http://everkinetic.com, автор Greg Priday).

Лицензия: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)
https://creativecommons.org/licenses/by-sa/4.0/

Изменения: файлы переименованы по упражнениям приложения, из SVG удалены размеры
(width/height), чтобы рисунок масштабировался. Изменённые файлы распространяются
на тех же условиях CC BY-SA 4.0.
"""


def main() -> None:
    text = MAP_FILE.read_text(encoding='utf-8')
    block = text.split('EXERCISE_IMAGE_SOURCE', 1)[1].split('};', 1)[0]
    pairs = re.findall(r"'?([a-z0-9-]+)'?\s*:\s*'(\d{4})'", block)
    OUT.mkdir(parents=True, exist_ok=True)
    missing = []
    for slug, num in pairs:
        svg = None
        for pose in ('tension', 'relaxation'):
            try:
                with urllib.request.urlopen(BASE.format(id=num, pose=pose), timeout=30) as r:
                    svg = r.read().decode('utf-8')
                break
            except urllib.error.HTTPError:
                continue
        if svg is None:
            missing.append(f'{slug} ({num})')
            continue
        # Убираем фиксированные размеры: рисунок подстраивается под круг иконки по viewBox.
        svg = re.sub(r'<svg([^>]*?)\s+width="[^"]*"\s+height="[^"]*"', r'<svg\1', svg, count=1)
        (OUT / f'{slug}.svg').write_text(svg, encoding='utf-8')
        print(slug, num, len(svg))
    (OUT / 'LICENSE.txt').write_text(LICENSE, encoding='utf-8')
    print('готово:', len(pairs) - len(missing))
    if missing:
        print('НЕТ РИСУНКА — уберите из exerciseImages.ts:', ', '.join(missing))


if __name__ == '__main__':
    main()

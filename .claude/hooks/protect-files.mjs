// PreToolUse-хук: запрещает Claude править файлы с секретами, личными данными и сгенерированные файлы.
// Код выхода 2 — правка отклоняется, текст из stderr видит Claude.
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const file = String(input.tool_input?.file_path ?? input.tool_input?.notebook_path ?? '').replace(/\\/g, '/');
if (!file) process.exit(0);

const rules = [
  [/(^|\/)\.env(\.(?!example$)[^/]*)?$/, 'файл с секретами (.env) — правьте его сами, ключи в чат не присылайте'],
  [/(^|\/)backups\//, 'папка с резервными копиями (личные данные)'],
  [/(\.backup\.json|athlete-os-backup-[^/]*\.json)$/, 'резервная копия дневника (личные данные)'],
  [/src\/data\/referenceFoods\.ts$/, 'сгенерированный файл: пересоберите scripts/build-reference-foods.py'],
  [/public\/data\/off-ru\.json$/, 'сгенерированный файл: пересоберите scripts/build-off-russia.py'],
];

for (const [re, why] of rules) {
  if (re.test(file)) {
    process.stderr.write(`Правка запрещена хуком проекта: ${file} — ${why}.\n`);
    process.exit(2);
  }
}
process.exit(0);

// PostToolUse-хук: после правки .ts/.tsx прогоняет ESLint по этому файлу.
// Ошибки возвращаются Claude (код выхода 2), чтобы он исправил их сразу, а не в конце на npm run check.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
const file = String(input.tool_input?.file_path ?? '');
if (!/\.(ts|tsx)$/.test(file) || !existsSync(file)) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const eslint = join(root, 'node_modules', 'eslint', 'bin', 'eslint.js');
if (!existsSync(eslint)) process.exit(0);

const r = spawnSync(process.execPath, [eslint, '--no-warn-ignored', file], { cwd: root, encoding: 'utf8' });
if (r.status !== 0) {
  process.stderr.write(`ESLint нашёл проблемы в ${file}:\n${r.stdout}${r.stderr}`);
  process.exit(2);
}
process.exit(0);

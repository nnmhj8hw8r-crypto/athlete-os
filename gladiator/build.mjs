// Сборка в один файл: node gladiator/build.mjs
// dist/gladiator.html — рабочий файл (открывается двойным кликом, без интернета).
// dist/artifact.html — та же страница без обёртки <html>, для онлайн-демо.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(root, 'src', f), 'utf8');
const safeScript = (js) => js.replace(/<\/script/gi, '<\\/script');

const head = read('head.html').trim();
const css = read('style.css');
const body = read('body.html').trim();
const logo = 'data:image/jpeg;base64,' + readFileSync(join(root, 'src', 'logo.jpg')).toString('base64');
const scripts = '<script>\n' + safeScript(read('logic.js')) + '\n</script>\n<script>\n' + safeScript(read('app.js').replace('__LOGO__', logo)) + '\n</script>';

const page = head + '\n<style>\n' + css + '</style>\n' + body + '\n' + scripts + '\n';
const full = '<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
  head + '\n<style>\n' + css + '</style>\n</head>\n<body>\n' + body + '\n' + scripts + '\n</body>\n</html>\n';

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'gladiator.html'), full);
writeFileSync(join(root, 'dist', 'artifact.html'), '<meta name="claude:viewport-fit-sides" content="cover">\n' + page.replace('<script>', '<script>globalThis.GLADIATOR_DEMO = true;</script>\n<script>'));
console.log('Готово: dist/gladiator.html (' + Math.round(full.length / 1024) + ' КБ)');

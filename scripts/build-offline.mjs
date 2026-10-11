// Builds dist/ClassShuffle.html: the whole app (HTML, CSS, JavaScript and
// icon) in one file that opens with a double-click, without a server or an
// internet connection. Browsers block JavaScript modules on file:// pages,
// so the modules are bundled into a single classic script with esbuild
// (fetched by npx when building; the app itself has no dependencies).
// CLASSSHUFFLE_OFFLINE makes it save under its own storage keys, separate
// from the web version.
//   npm run build:offline
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');

const bundle = execSync('npx --yes esbuild@0.24.0 js/app.js --bundle --format=iife --target=es2022 --minify --legal-comments=none --define:CLASSSHUFFLE_OFFLINE=true', {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'inherit'],
});

const iconData = Buffer.from(read('icons/icon.svg')).toString('base64');
const replacements = [
  ['<link rel="icon" href="icons/icon.svg" type="image/svg+xml">', `<link rel="icon" href="data:image/svg+xml;base64,${iconData}">`],
  ['<link rel="stylesheet" href="css/app.css">', `<style>\n${read('css/app.css')}\n</style>`],
  // "</script" inside the code would end the tag early; "<\/script" means the same in JavaScript.
  ['<script type="module" src="js/app.js"></script>', `<script>\n${bundle.replace(/<\/script/gi, '<\\/script')}</script>`],
];

let html = read('index.html');
for (const [from, to] of replacements) {
  if (!html.includes(from)) {
    console.error(`index.html changed: couldn't find ${from}`);
    process.exit(1);
  }
  html = html.replace(from, () => to);
}

const out = join(root, 'dist', 'ClassShuffle.html');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`Offline version written to ${out} (${Math.round(html.length / 1024)} KB)`);

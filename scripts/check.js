// Syntax-checks every server + script file without needing MongoDB. Run: npm run check
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(path.join(d, e.name))) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []);
let bad = 0;
for (const f of ['server', 'scripts', 'tests', 'web/js'].flatMap((d) => fs.existsSync(d) ? walk(d) : [])) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { bad++; console.error(`✖ ${f}\n${e.stderr}`); }
}
console.log(bad ? `${bad} file(s) failed` : '✔ all files parse'); process.exit(bad ? 1 : 0);

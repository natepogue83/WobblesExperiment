// run-all.js — npm test: run every tests/test-*.js in its own node process.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter(f => /^test-.*\.js$/.test(f)).sort();
let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [join(dir, f)], { stdio: 'inherit' });
  if (r.status !== 0) { failed++; console.log('\nFAILED: ' + f); }
}
console.log('\n' + (files.length - failed) + '/' + files.length + ' test files passed');
process.exit(failed ? 1 : 0);

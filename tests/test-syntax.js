// test-syntax.js — every module parses, including the browser-only UI ones the
// other tests never import.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { section, ok } from './lib.js';

section('Every module parses');
{
  const files = [];
  const walk = dir => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(dir, e.name));
      else if (e.name.endsWith('.js')) files.push(join(dir, e.name));
    }
  };
  walk(join(dirname(fileURLToPath(import.meta.url)), '..', 'src'));
  for (const f of files) {
    try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
    catch (err) { assert.fail(f + ': ' + String(err.stderr || err.message).split('\n').slice(0, 4).join(' ')); }
  }
  ok(`${files.length} modules under src/ parse`);
}

section('styles.css');
{
  // Two @keyframes with one name silently replace each other (the later wins),
  // which has broken animations twice. Names must be unique.
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'styles.css'), 'utf8');
  const names = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map(m => m[1]);
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  assert.deepEqual(dupes, [], 'duplicate @keyframes: ' + dupes.join(', '));
  ok(`${names.length} @keyframes, all uniquely named`);
}

console.log('\ntest-syntax: all passed');

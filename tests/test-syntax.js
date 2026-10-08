// test-syntax.js — every module parses, including the browser-only UI ones the
// other tests never import.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
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

console.log('\ntest-syntax: all passed');

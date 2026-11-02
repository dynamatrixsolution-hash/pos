import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const envContent = readFileSync(path.resolve(process.cwd(), '.env.restro.local'), 'utf8');
const env = { ...process.env };
for (const line of envContent.split(/\r?\n/)) {
  if (line.trim() && !line.trimStart().startsWith('#')) {
    const idx = line.indexOf('=');
    if (idx !== -1) {
      env[line.slice(0, idx)] = line.slice(idx + 1);
    }
  }
}

console.log('Running prisma db push with isolated db credentials...');
const res = spawnSync('node', ['node_modules/prisma/build/index.js', 'db', 'push', '--schema', 'packages/db/prisma/schema.prisma'], {
  env,
  stdio: 'inherit',
  shell: true
});

if (res.status !== 0) {
  process.exit(res.status || 1);
}

console.log('Running prisma generate...');
const genRes = spawnSync('node', ['node_modules/prisma/build/index.js', 'generate', '--schema', 'packages/db/prisma/schema.prisma'], {
  env,
  stdio: 'inherit',
  shell: true
});

if (genRes.status !== 0) {
  process.exit(genRes.status || 1);
}

console.log('Prisma schema updated and client generated successfully!');


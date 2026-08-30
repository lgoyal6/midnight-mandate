import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const signatures = [
  ['sk', 'ant-api03-'].join('-'),
  ['sk', 'proj', '[A-Za-z0-9]'].join('-'),
  ['-----BEGIN ', '(RSA|OPENSSH|EC)', ' PRIVATE KEY-----'].join(''),
];
const tracked = spawnSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard'],
  { encoding: 'utf8' },
);

if (tracked.error || tracked.status !== 0 || typeof tracked.stdout !== 'string') {
  process.stderr.write(typeof tracked.stderr === 'string' ? tracked.stderr : '');
  throw tracked.error ?? new Error(`could not enumerate repository files: ${tracked.status}`);
}

const pattern = new RegExp(signatures.join('|'));
const findings: string[] = [];

for (const file of tracked.stdout.split('\n').filter(Boolean)) {
  const bytes = readFileSync(file);
  if (bytes.includes(0)) continue;
  const lines = bytes.toString('utf8').split('\n');
  lines.forEach((line, index) => {
    if (pattern.test(line)) findings.push(`${file}:${index + 1}`);
  });
}

if (findings.length > 0) {
  process.stderr.write(`${findings.join('\n')}\n`);
  throw new Error('secret-like material found');
}

console.log('SECRET_SCAN_PASS');

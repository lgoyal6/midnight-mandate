import { spawnSync } from 'node:child_process';

const signatures = [
  ['sk', 'ant-api03-'].join('-'),
  ['sk', 'proj', '[A-Za-z0-9]'].join('-'),
  ['-----BEGIN ', '(RSA|OPENSSH|EC)', ' PRIVATE KEY-----'].join(''),
];
const result = spawnSync(
  'rg',
  [
    '-n',
    `(${signatures.join('|')})`,
    '.',
    '--glob',
    '!node_modules/**',
    '--glob',
    '!contracts/managed/**',
    '--glob',
    '!midnight-level-db/**',
    '--glob',
    '!logs/**',
  ],
  { encoding: 'utf8' },
);

if (result.status === 1) {
  console.log('SECRET_SCAN_PASS');
  process.exit(0);
}
if (result.status === 0) {
  process.stderr.write(result.stdout);
  throw new Error('secret-like material found');
}
process.stderr.write(result.stderr);
throw new Error(`secret scan failed with rg exit ${result.status}`);

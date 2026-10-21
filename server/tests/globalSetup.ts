import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** Crea una base de datos de pruebas limpia aplicando las migraciones versionadas. */
export default function setup() {
  const serverDir = path.resolve(__dirname, '..');
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    fs.rmSync(path.join(serverDir, 'prisma', `test.db${suffix}`), { force: true });
  }
  fs.rmSync(path.join(serverDir, '.test-outbox'), { recursive: true, force: true });

  const prismaCli = require.resolve('prisma/build/index.js', { paths: [serverDir] });
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: serverDir,
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'pipe',
  });
}

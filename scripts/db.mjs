import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const container = 'ruang-teduh-mongo';
const image = 'mongo:8.0@sha256:b9924c330a8bbc5800fe9c69f04a84e221eca7b28fd049a0354147d9908fa142';

function docker(args, { allowFailure = false } = {}) {
  // Pass arguments directly so PowerShell, cmd.exe and Bash quoting do not differ.
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true });
  if (result.error?.code === 'ENOENT') {
    throw new Error('Docker tidak ditemukan. Install Docker Desktop, lalu buka terminal baru.');
  }
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || 'Perintah Docker gagal.');
  }
  return result;
}

async function waitForMongo(script, attempts, message) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const result = docker(['exec', container, 'mongosh', '--quiet', '--eval', script], {
      allowFailure: true,
    });
    if (result.status === 0) return;
    if (attempt + 1 < attempts) await delay(1000);
  }
  throw new Error(`${message} Periksa dengan: docker logs ${container}`);
}

async function main() {
  const server = docker(['info', '--format', '{{.OSType}}'], { allowFailure: true });
  if (server.status !== 0) {
    throw new Error('Docker belum siap. Buka Docker Desktop dan tunggu sampai engine berjalan.');
  }
  if (server.stdout.trim() !== 'linux') {
    throw new Error('MongoDB ini memerlukan Linux containers. Pilih mode Linux di Docker Desktop.');
  }

  const existing = docker([
    'container',
    'ls',
    '--all',
    '--filter',
    `name=^/${container}$`,
    '--format',
    '{{.Names}}',
  ]).stdout.trim();
  if (existing === container) {
    docker(['start', container]);
  } else {
    console.log('Menyiapkan MongoDB; unduhan image pertama dapat memerlukan beberapa menit…');
    docker([
      'run',
      '-d',
      '--name',
      container,
      '-p',
      '127.0.0.1:27017:27017',
      '-v',
      `${container}:/data/db`,
      image,
      '--replSet',
      'rs0',
      '--bind_ip_all',
    ]);
  }

  await waitForMongo(
    'if (db.adminCommand({ping:1}).ok !== 1) quit(1)',
    60,
    'MongoDB belum merespons.',
  );
  docker([
    'exec',
    container,
    'mongosh',
    '--quiet',
    '--eval',
    'try { rs.status(); } catch(e) { if(e.code===94) rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]}); else throw e; }',
  ]);
  await waitForMongo('if (!db.hello().isWritablePrimary) quit(1)', 30, 'Replica set belum siap.');
  console.log('MongoDB siap di 127.0.0.1:27017 (replica set rs0).');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

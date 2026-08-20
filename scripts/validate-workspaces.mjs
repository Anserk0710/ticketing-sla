import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifests = {
  root: 'package.json',
  api: 'apps/api/package.json',
  web: 'apps/web/package.json',
  contracts: 'packages/contracts/package.json',
};

const readJson = (relativePath) => {
  const absolutePath = resolve(root, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Manifest tidak ditemukan: ${relativePath}`);
  }
  return JSON.parse(readFileSync(absolutePath, 'utf8'));
};

const packages = Object.fromEntries(
  Object.entries(manifests).map(([key, path]) => [key, readJson(path)]),
);

const expectedDependency = 'file:../../packages/contracts';
for (const workspace of ['api', 'web']) {
  const dependency = packages[workspace].dependencies?.['@ticketing/contracts'];
  if (dependency !== expectedDependency) {
    throw new Error(
      `${packages[workspace].name} harus memakai ${expectedDependency}, ditemukan: ${dependency ?? 'tidak ada'}`,
    );
  }
}

if (packages.contracts.name !== '@ticketing/contracts') {
  throw new Error('Nama package contracts tidak valid.');
}

const versions = new Set(
  [packages.root, packages.api, packages.web, packages.contracts].map((pkg) => pkg.version),
);
if (versions.size !== 1) {
  throw new Error(`Versi workspace tidak sinkron: ${[...versions].join(', ')}`);
}

const apiSeed = resolve(root, 'apps/api/prisma/seed.js');
if (!existsSync(apiSeed)) {
  throw new Error('Runtime seed tidak ditemukan di apps/api/prisma/seed.js.');
}
if (packages.api.scripts?.['prisma:seed'] !== 'node prisma/seed.js') {
  throw new Error('Script prisma:seed API harus menjalankan node prisma/seed.js.');
}
if (packages.api.prisma) {
  throw new Error('Konfigurasi package.json#prisma deprecated harus dihapus.');
}

const contractsDirectory = resolve(root, 'packages/contracts');
if (!existsSync(resolve(contractsDirectory, 'src/index.ts'))) {
  throw new Error('Source contracts tidak ditemukan di packages/contracts/src/index.ts.');
}

console.log(`Workspace validation OK — version ${packages.root.version}`);
console.log(`Local dependency OK — ${expectedDependency}`);
console.log('Runtime seed OK — node prisma/seed.js');

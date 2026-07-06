import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(rootDir, 'dist');

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

const copyTargets = ['index.html', 'brochure.html', '_redirects', 'functions'];

for (const target of copyTargets) {
  await cp(path.join(rootDir, target), path.join(distDir, target), {
    recursive: true,
  });
}

console.log('Static site copied to dist/');

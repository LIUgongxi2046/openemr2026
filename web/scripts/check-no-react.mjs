import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const manifest = JSON.parse(await readFile(join(webDir, 'package.json'), 'utf8'));
const forbiddenPackages = ['react', 'react-dom', '@vitejs/plugin-react', '@types/react', '@types/react-dom'];
const declared = { ...manifest.dependencies, ...manifest.devDependencies };
const packageFailures = forbiddenPackages.filter((name) => name in declared);
const sourceFailures = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (['.tsx', '.jsx'].includes(extname(entry.name))) sourceFailures.push(relative(webDir, path));
    else if (['.ts', '.vue', '.js', '.mjs'].includes(extname(entry.name))) {
      const source = await readFile(path, 'utf8');
      if (/from ['"]react(?:-dom)?(?:\/[^'"]*)?['"]|import\(['"]react(?:-dom)?/.test(source)) sourceFailures.push(relative(webDir, path));
    }
  }
}

await walk(join(webDir, 'src'));
if (packageFailures.length || sourceFailures.length) {
  console.error(JSON.stringify({ package_failures: packageFailures, source_failures: sourceFailures, gate: 'FAIL' }));
  process.exit(1);
}
console.log(JSON.stringify({ forbidden_packages: forbiddenPackages.length, source_failures: 0, gate: 'PASS' }));

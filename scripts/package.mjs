import { createWriteStream } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZipArchive } from 'archiver';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];

if (!['chrome', 'firefox', 'source'].includes(target)) {
  throw new Error('Usage: npm run package:archive -- <chrome|firefox|source>');
}

const artifactsDirectory = path.join(rootDirectory, 'artifacts');
const stagingDirectory = path.join(artifactsDirectory, `.staging-${target}`);

const readManifest = async () =>
  JSON.parse(await readFile(path.join(rootDirectory, 'manifest.json'), 'utf8'));

// Chrome runs the background as a service worker; Firefox MV3 only supports background scripts.
const adaptManifestForTarget = (manifest) => {
  if (target !== 'firefox') return manifest;

  const { service_worker: serviceWorker, ...background } = manifest.background;
  return { ...manifest, background: { ...background, scripts: [serviceWorker] } };
};

const getSourceFiles = () => [
  'README.md',
  'manifest.json',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'webpack.config.js',
  'eslint.config.mjs',
  '_locales',
  'src',
  'public',
  'icons',
];

const createArchive = (sourceDirectory, archivePath) =>
  new Promise((resolve, reject) => {
    const output = createWriteStream(archivePath);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.on('close', () => resolve(archive.pointer()));
    output.on('error', reject);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDirectory, false);
    archive.finalize();
  });

const packageExtension = async () => {
  const manifest = await readManifest();
  const archiveName = `yt-quick-filters-${manifest.version}-${target}.zip`;
  const archivePath = path.join(artifactsDirectory, archiveName);

  await mkdir(artifactsDirectory, { recursive: true });
  await rm(stagingDirectory, { recursive: true, force: true });
  await mkdir(stagingDirectory, { recursive: true });

  try {
    const files =
      target === 'source'
        ? getSourceFiles()
        : ['dist', 'public', 'icons', '_locales', 'manifest.json'];
    for (const file of files) {
      await cp(path.join(rootDirectory, file), path.join(stagingDirectory, file), {
        recursive: true,
      });
    }

    if (target !== 'source') {
      await writeFile(
        path.join(stagingDirectory, 'manifest.json'),
        `${JSON.stringify(adaptManifestForTarget(manifest), null, 2)}\n`,
      );
    }

    const bytes = await createArchive(stagingDirectory, archivePath);
    console.log(`Created artifacts/${archiveName} (${bytes} bytes)`);
  } finally {
    await rm(stagingDirectory, { recursive: true, force: true });
  }
};

await packageExtension();

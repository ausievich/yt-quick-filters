import { createWriteStream } from 'node:fs';
import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZipArchive } from 'archiver';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];

if (target !== 'chrome' && target !== 'firefox') {
  throw new Error('Usage: npm run package:archive -- <chrome|firefox>');
}

const artifactsDirectory = path.join(rootDirectory, 'artifacts');
const stagingDirectory = path.join(artifactsDirectory, `.staging-${target}`);

const readManifest = async () =>
  JSON.parse(await readFile(path.join(rootDirectory, 'manifest.json'), 'utf8'));

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
    for (const directory of ['dist', 'public', 'icons', 'manifest.json']) {
      await cp(path.join(rootDirectory, directory), path.join(stagingDirectory, directory), {
        recursive: true,
      });
    }

    const bytes = await createArchive(stagingDirectory, archivePath);
    console.log(`Created artifacts/${archiveName} (${bytes} bytes)`);
  } finally {
    await rm(stagingDirectory, { recursive: true, force: true });
  }
};

await packageExtension();

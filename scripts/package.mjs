import { createWriteStream } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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

const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'));

const createManifest = async () => {
  const manifest = await readJson(path.join(rootDirectory, 'manifest.json'));

  if (target === 'chrome') {
    if (manifest.background?.scripts) {
      throw new Error('Chrome manifest must not contain background.scripts.');
    }
    if (!manifest.background?.service_worker) {
      throw new Error('Chrome manifest must contain background.service_worker.');
    }
    return manifest;
  }

  const firefoxOverrides = await readJson(path.join(rootDirectory, 'manifests', 'firefox.json'));
  const firefoxManifest = { ...manifest, ...firefoxOverrides };
  delete firefoxManifest.minimum_chrome_version;

  if (firefoxManifest.background?.service_worker || !firefoxManifest.background?.scripts) {
    throw new Error(
      'Firefox manifest must contain background.scripts without background.service_worker.',
    );
  }

  return firefoxManifest;
};

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
  const manifest = await createManifest();
  const archiveName = `yt-quick-filters-${manifest.version}-${target}.zip`;
  const archivePath = path.join(artifactsDirectory, archiveName);

  await mkdir(artifactsDirectory, { recursive: true });
  await rm(stagingDirectory, { recursive: true, force: true });
  await mkdir(stagingDirectory, { recursive: true });

  try {
    for (const directory of ['dist', 'public', 'icons']) {
      await cp(path.join(rootDirectory, directory), path.join(stagingDirectory, directory), {
        recursive: true,
      });
    }
    await writeFile(
      path.join(stagingDirectory, 'manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );

    const bytes = await createArchive(stagingDirectory, archivePath);
    console.log(`Created artifacts/${archiveName} (${bytes} bytes)`);
  } finally {
    await rm(stagingDirectory, { recursive: true, force: true });
  }
};

await packageExtension();

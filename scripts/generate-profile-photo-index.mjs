import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import convertHeic from "heic-convert";
import sharp from "sharp";
import { normalizeProfileName } from "../directory-core.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const photosDirectory = path.join(projectRoot, "photos");
const resizedDirectory = path.join(photosDirectory, "resized");
const outputPath = path.join(projectRoot, "sources", "profile-photos.json");

const files = (await readdir(photosDirectory))
  .filter((filename) => /\.(jpe?g|png|webp|heic)$/i.test(filename))
  .sort((a, b) => a.localeCompare(b, "en"));
const photos = {};
await mkdir(resizedDirectory, { recursive: true });

for (const filename of files) {
  const stem = path.parse(filename).name;
  const separator = stem.lastIndexOf(" - ");
  if (separator < 0) continue;
  const name = stem.slice(separator + 3).replace(/\s*\(\d+\)$/, "");
  const key = normalizeProfileName(name);
  const extension = path.extname(filename).toLowerCase();
  const resizedExtension = extension === ".heic" ? ".jpg" : extension;
  const resizedFilename = `${stem}${resizedExtension}`;
  const resizedPath = path.join(resizedDirectory, resizedFilename);
  const inputPath = path.join(photosDirectory, filename);
  const input = extension === ".heic"
    ? await convertHeic({ buffer: await readFile(inputPath), format: "JPEG", quality: 0.9 })
    : inputPath;
  const result = await sharp(input)
    .autoOrient()
    .resize(300, 300, { fit: "cover" })
    .toFile(resizedPath);
  if (result.width !== 300 || result.height !== 300) {
    throw new Error(`Expected a 300x300 image after resizing ${filename}.`);
  }
  if (key && !photos[key]) photos[key] = `photos/resized/${resizedFilename}`;
}

await writeFile(outputPath, `${JSON.stringify(photos, null, 2)}\n`, "utf8");
console.log(`Generated ${files.length} 300x300 images and indexed ${Object.keys(photos).length} profile photos.`);
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as cheerio from "cheerio";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(projectRoot, "sources", "faculty-directory.json");
const sources = [
  {
    name: "NYU CNS Core Faculty",
    url: "https://as.nyu.edu/departments/cns/people/CoreFaculty.html",
    accepts: (profileUrl) => /\/departments\/cns\/people\/faculty\./i.test(profileUrl),
  },
  {
    name: "NYU Langone Neuroscience Faculty",
    url: "https://med.nyu.edu/departments-institutes/neuroscience/faculty",
    accepts: (profileUrl) => /^(https:\/\/med\.nyu\.edu\/faculty\/|https:\/\/med\.nyu\.edu\/research\/kang-lab\/|https:\/\/nyulangone\.org\/doctors\/)/i.test(profileUrl),
  },
];

function cleanName(value) {
  const name = value
    .replace(/\s+/g, " ")
    .replace(/\s*\.\s*Opens in a new tab.*$/i, "")
    .replace(/\s*\(Starting [^)]+\)\s*$/i, "")
    .replace(/\s*,?\s*(?:(?:PhD|MD|ScD|DPhil|DDS)\s*,?\s*)+$/i, "")
    .trim();
  return /Ã.|Â.|â€/.test(name) ? Buffer.from(name, "latin1").toString("utf8") : name;
}

function identityKey(name) {
  const parts = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().match(/[a-z0-9]+/g) || [];
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)}` : name.toLocaleLowerCase();
}

async function scrape(source) {
  const response = await fetch(source.url, {
    headers: { "User-Agent": "CNS trainee directory faculty roster refresh/1.0" },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${source.name} returned HTTP ${response.status}`);

  const html = Buffer.from(await response.arrayBuffer());
  const $ = cheerio.loadBuffer(html);
  const faculty = new Map();

  $("a[href]").each((_, element) => {
    const link = $(element);
    const name = cleanName(link.text());
    const rawUrl = link.attr("href");
    if (!name || name.split(/\s+/).length < 2 || !rawUrl) return;

    let url;
    try {
      url = new URL(rawUrl, source.url).href;
    } catch {
      return;
    }
    if (!source.accepts(url)) return;

    const key = url.toLocaleLowerCase();
    const previous = faculty.get(key);
    if (!previous || name.length > previous.name.length) {
      faculty.set(key, { name, url, source: source.name });
    }
  });

  if (faculty.size === 0) throw new Error(`No faculty profiles were extracted from ${source.url}`);
  return [...faculty.values()];
}

const results = await Promise.all(sources.map(async (source) => ({
  source,
  faculty: await scrape(source),
})));

const combined = new Map();
for (const { faculty } of results) {
  for (const entry of faculty) {
    const key = identityKey(entry.name);
    const existing = combined.get(key);
    if (!existing || (entry.source === "NYU CNS Core Faculty" && existing.source !== entry.source)) combined.set(key, entry);
  }
}

let existingFaculty = [];
try {
  existingFaculty = JSON.parse(await readFile(outputPath, "utf8")).faculty ?? [];
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const existing = new Map(existingFaculty.map((entry) => [identityKey(entry.name), entry]));

const additions = [...combined].filter(([key]) => !existing.has(key));
const removals = [...existing].filter(([key]) => !combined.has(key));

const interactive = process.stdin.isTTY && process.stdout.isTTY;
const prompt = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : null;

// Empty input or a non-interactive run takes the default.
async function confirm(question, defaultYes) {
  if (!prompt) return defaultYes;
  const answer = (await prompt.question(`${question} ${defaultYes ? "[Y/n]" : "[y/N]"} `)).trim().toLowerCase();
  if (!answer) return defaultYes;
  return answer === "y" || answer === "yes";
}

const describe = (entry) => `  ${entry.name} (${entry.source}) ${entry.url}`;
const final = new Map(combined);

if (existingFaculty.length && !interactive && (additions.length || removals.length)) {
  console.log("Non-interactive run: adding new faculty and keeping removed faculty.");
}

if (existingFaculty.length && additions.length) {
  console.log(`\n${additions.length} new faculty found:`);
  for (const [, entry] of additions) console.log(describe(entry));
  if (!(await confirm("Add these faculty?", true))) {
    for (const [key] of additions) final.delete(key);
  }
}

if (removals.length) {
  console.log(`\n${removals.length} faculty no longer found in the directories:`);
  for (const [, entry] of removals) console.log(describe(entry));
  if (!(await confirm("Remove these faculty from the roster?", false))) {
    for (const [key, entry] of removals) final.set(key, entry);
  }
}

prompt?.close();

const output = {
  generatedAt: new Date().toISOString(),
  sources: results.map(({ source, faculty }) => ({
    name: source.name,
    url: source.url,
    profiles: faculty.length,
  })),
  faculty: [...final.values()].sort((a, b) => a.name.localeCompare(b.name)),
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Wrote ${output.faculty.length} faculty profiles to ${path.relative(projectRoot, outputPath)}`);
for (const source of output.sources) console.log(`  ${source.name}: ${source.profiles} profiles`);
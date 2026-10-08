// Renders the trainee directory as static, inline-styled HTML for CMSs that cannot run JavaScript (Google Sites, Weebly).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  ARCHIVE_AGE_MONTHS, PUBLISHED_CSV_URL, archiveCutoff, createFacultyLinker, groupByRole,
  isArchived, latestPeople, parseCsv, siteLinks,
} from "../directory-core.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const facultyRosterPath = path.join(projectRoot, "sources", "faculty-directory.json");

// Pasted HTML has no base URL, so images must be absolute and publicly reachable.
const options = {
  "image-url": "https://garrettjblair.com/cns_trainees/sources/no_image.png",
  out: path.join("dist", "trainees-embed.html"),
  csv: PUBLISHED_CSV_URL,
};
for (const arg of process.argv.slice(2)) {
  const match = /^--([\w-]+)=(.*)$/.exec(arg);
  if (!match || !(match[1] in options)) {
    console.error(`Unknown argument "${arg}". Options: ${Object.keys(options).map((key) => `--${key}=<value>`).join(" ")}`);
    process.exit(1);
  }
  options[match[1]] = match[2];
}

const PURPLE = "#57068c";
const MUTED = "#666666";
const RULE = "#c9c9c9";

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]
));
const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const link = (href, text, external = false) =>
  `<a href="${escapeHtml(href)}" style="color:${PURPLE};"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${escapeHtml(text)}</a>`;

async function loadCsv(source) {
  if (!/^https?:\/\//i.test(source)) return readFile(path.resolve(source), "utf8");
  const response = await fetch(source, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`CSV request returned HTTP ${response.status}`);
  const text = await response.text();
  // An unpublished sheet redirects to a Google sign-in page that still returns HTTP 200.
  if (!text.includes("First Name")) throw new Error("The response was not the trainee sheet; check that the sheet is still published to the web.");
  return text;
}

async function loadFaculty() {
  try {
    return JSON.parse(await readFile(facultyRosterPath, "utf8")).faculty ?? [];
  } catch (error) {
    console.warn(`Faculty roster unavailable (${error.message}); lab names will not be linked.`);
    return [];
  }
}

const detailLine = (label, valueHtml) =>
  `<div style="display:flex;gap:0.75em;"><span style="flex:0 0 8em;color:${MUTED};text-align:right;">${label}</span><span style="min-width:0;overflow-wrap:anywhere;">${valueHtml}</span></div>`;

function renderPerson(person, linkLab) {
  const lines = [];
  if (person.lab) {
    lines.push(detailLine("Lab", linkLab(person.lab).map((segment) => (segment.url ? link(segment.url, segment.text) : escapeHtml(segment.text))).join("")));
  }
  if (person.email) lines.push(detailLine("Email", link(`mailto:${person.email}`, person.email)));
  if (person.previousAffiliation) lines.push(detailLine("Prior affiliation", escapeHtml(person.previousAffiliation)));
  if (person.website) {
    lines.push(detailLine("Site", siteLinks(person.website).map((site) => link(site.href, site.text, true)).join("; ")));
  }

  return `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:24px;padding:16px 0;border-bottom:1px solid ${RULE};">
<div style="flex:0 0 200px;max-width:100%;"><img src="${escapeHtml(options["image-url"])}" alt="Placeholder portrait for ${escapeHtml(person.name)}" width="200" style="display:block;width:200px;max-width:100%;aspect-ratio:1/1;object-fit:cover;"></div>
<div style="flex:1 1 300px;min-width:0;">
<h3 style="margin:0 0 3px;color:${PURPLE};font-size:1.05em;font-weight:700;line-height:1.25;">${escapeHtml(person.name)}</h3>
${person.role ? `<p style="margin:0 0 12px;color:${MUTED};font-weight:700;">${escapeHtml(person.role)}</p>` : ""}
<div style="font-size:0.93em;">${lines.join("\n")}</div>
</div>
</div>`;
}

const rows = parseCsv(await loadCsv(options.csv));
const everyone = latestPeople(rows);
if (!everyone.length) throw new Error("No trainee profiles were found in the CSV.");

const cutoff = archiveCutoff(ARCHIVE_AGE_MONTHS);
const current = everyone.filter((person) => !isArchived(person, cutoff));
const groups = groupByRole(current);
const linkLab = createFacultyLinker(await loadFaculty());

const nav = groups.map(([role]) => `<a href="#cns-role-${slug(role)}" style="color:${PURPLE};">${escapeHtml(role)}</a>`).join(" | ");
const sections = groups.map(([role, people]) => `<h2 id="cns-role-${slug(role)}" style="margin:24px 0 0;padding:8px 0 10px;border-bottom:1px solid #444444;color:${PURPLE};font-size:1em;font-weight:700;text-transform:uppercase;">${escapeHtml(role)} <span style="color:${MUTED};font-size:0.8em;font-weight:400;">${people.length}</span></h2>
${people.map((person) => renderPerson(person, linkLab)).join("\n")}`).join("\n");

const html = `<!-- CNS trainee directory, generated ${new Date().toISOString()} from the published sheet. Regenerate with: npm run build:embed -->
<div id="cns-trainee-directory" style="font-family:Helvetica,Arial,sans-serif;color:#333333;line-height:1.5;">
<p style="margin:0 0 8px;text-align:center;">${nav}</p>
${sections}
</div>
`;

const outputPath = path.resolve(projectRoot, options.out);
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, html, "utf8");
console.log(`Wrote ${current.length} profiles in ${groups.length} roles (${everyone.length - current.length} archived hidden) to ${path.relative(projectRoot, outputPath)} (${Math.round(Buffer.byteLength(html) / 1024)} KB).`);
console.log(`Photos load from ${options["image-url"]}; make sure that URL is reachable before pasting.`);
